/* DavidStore prototipe — sync.js (INF-01, ADR-003)
   Sinkron localStorage <-> Google Sheet lewat Apps Script Web App (prototype/gsheet/Code.gs).
   Urutan skrip: config.js -> catalog.js -> store.js -> sync.js -> (logic.js) -> app.js.
   Sumber katalog: (1) ds_config_v1 ber-token = tab sheet; (2) tanpa token tapi DS_PUBLIC.catalogUrl = op=catalog (baca saja);
   (3) tidak ada keduanya = katalog kosong. Tidak ada data contoh di klien.
   Bisa di-load di Node (tes): butuh DS dari store.js, localStorage/fetch boleh berupa stub. */
(function (root) {
  'use strict';
  var DS = root.DS;
  if (!DS) { if (typeof console !== 'undefined') console.error('sync.js: store.js harus dimuat lebih dulu'); return; }

  var K_CFG = 'ds_config_v1';
  var K_SYNC = 'ds_sync_v1';
  var K_CAT = 'ds_catalog_v1';
  var K_DROPPED = 'ds_local_dropped_v1'; // cadangan order/PO lokal yang tidak ikut ke sheet
  var K_CAT_PUB = 'ds_catalog_pub_v1'; // cache katalog publik (mode tanpa token)
  var AUTO_PULL_MS = 45000; // tarik otomatis berkala saat tab aktif (pesanan baru dari toko publik)
  var TABS = ['settings', 'brands', 'distributors', 'orders', 'purchase_orders']; // urutan kirim
  var PULL_TIMEOUT = 10000;
  var PUSH_TIMEOUT = 20000;
  var RETRY_MS = 30000;
  var ST = DS._store;

  /* ============================================================ konversi murni (diuji di Node) */

  // "2.815.000", "Rp 2.815.000", "2815000,00" -> 2815000 (integer). Kosong/tak terbaca -> null.
  function parseMoney(v) {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v) : null;
    var s = String(v == null ? '' : v).trim();
    if (!s) return null;
    s = s.replace(/rp/ig, '').replace(/\s/g, '').replace(/[.,]\d{1,2}$/, '');
    var d = s.replace(/\D/g, '');
    return d ? parseInt(d, 10) : null;
  }
  // Ketat untuk harga produk: "abc", "12 juta", kosong, 0 -> null (bukan angka yang valid)
  function parseMoneyStrict(v) {
    if (typeof v === 'number') return isFinite(v) && v > 0 ? Math.round(v) : null;
    var s = String(v == null ? '' : v).trim().replace(/^rp\.?\s*/i, '').replace(/\s/g, '');
    if (!/^\d[\d.,]*$/.test(s)) return null;
    s = s.replace(/[.,]\d{1,2}$/, '');
    var d = s.replace(/\D/g, '');
    if (!d) return null;
    var n = parseInt(d, 10);
    return n > 0 ? n : null;
  }
  // Kolom yang kurang/salah pada satu baris produk (kosong = layak tampil). Cermin productProblems_ di Code.gs.
  function productProblems(r, brandIds, catIds) {
    var bad = [], c = String(r.category || '').trim();
    if (!String(r.sku || r.id || '').trim()) bad.push('sku');
    if (!String(r.name || '').trim()) bad.push('name');
    if (parseMoneyStrict(r.price) === null) bad.push('price');
    if (String(r.price_to || '').trim() !== '' && parseMoneyStrict(r.price_to) === null) bad.push('price_to');
    if (!brandIds[String(r.brand_id || '').trim()]) bad.push('brand_id');
    if (!catIds[c]) bad.push('category');
    if (c === 'blade' && !parseList(r.handles).length) bad.push('handles');
    if (c === 'karet') {
      if (!parseList(r.thicknesses).length) bad.push('thicknesses');
      if (!parseList(r.colors).length) bad.push('colors');
    }
    return bad;
  }
  // FALSE/0/TIDAK/N (tanpa beda huruf) = false; kosong/lainnya = true
  function parseBool(v) {
    if (typeof v === 'boolean') return v;
    var s = String(v == null ? '' : v).trim().toLowerCase();
    return !(s === 'false' || s === '0' || s === 'tidak' || s === 'n' || s === 'no');
  }
  function parseNum(v) {
    var s = String(v == null ? '' : v).trim().replace(',', '.');
    if (s === '') return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }
  function parseList(v) {
    return String(v == null ? '' : v).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function parseSpec(v) {
    return String(v == null ? '' : v).split(';').map(function (x) { return x.trim(); }).filter(Boolean).map(function (line) {
      var i = line.indexOf(':');
      return i < 0 ? ['', line] : [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    });
  }
  function specToString(spec) {
    return (spec || []).map(function (pair) { return (pair[0] ? pair[0] + ': ' : '') + pair[1]; }).join('; ');
  }
  function strOrNull(v) { var s = String(v == null ? '' : v).trim(); return s === '' ? null : s; }

  function optValues(p, key) {
    var o = (p.options || []).filter(function (x) { return x.key === key; })[0];
    return o ? o.values.join(', ') : '';
  }

  // objek produk DS_CATALOG -> baris datar tab products (semua string)
  function productToRow(p) {
    return {
      sku: p.sku, slug: p.slug, ref: p.ref == null ? '' : String(p.ref), category: p.category,
      brand_id: DS._slug(p.brand), name: p.name,
      price: p.price == null ? '' : String(Math.round(p.price)),
      price_to: p.price_to == null ? '' : String(Math.round(p.price_to)),
      price_from: p.price_from ? 'TRUE' : 'FALSE',
      price_status: p.price_status || '',
      speed: p.speed || '', type: p.type || '', note: p.note || '',
      handles: optValues(p, 'handle'), thicknesses: optValues(p, 'thickness'), colors: optValues(p, 'color'),
      isi: optValues(p, 'isi'), sizes: optValues(p, 'size'), widths: optValues(p, 'width'),
      spec: specToString(p.spec), image: p.image || '', is_active: p.is_active === false ? 'FALSE' : 'TRUE'
    };
  }

  // baris tab products -> objek produk berbentuk DS_CATALOG. Opsi varian HANYA dari kolom sheet (tanpa nilai bawaan).
  function rowToProduct(row, brandName) {
    var cat = row.category, options = [];
    if (cat === 'blade') {
      var h = parseList(row.handles);
      if (h.length) options.push({ key: 'handle', label: 'Handle', type: 'seg', values: h });
    }
    if (cat === 'karet') {
      var t = parseList(row.thicknesses), c = parseList(row.colors);
      if (t.length) options.push({ key: 'thickness', label: 'Ketebalan sponge (mm)', type: 'seg', values: t });
      if (c.length) options.push({ key: 'color', label: 'Warna', type: 'swatch', values: c });
    }
    var isi = parseList(row.isi), sizes = parseList(row.sizes), wid = parseList(row.widths);
    if (isi.length) options.push({ key: 'isi', label: 'Isi per pak (bola)', type: 'seg', values: isi });
    if (sizes.length) options.push({ key: 'size', label: 'Ukuran (EU)', type: 'seg', values: sizes });
    if (wid.length) options.push({ key: 'width', label: 'Lebar (mm)', type: 'seg', values: wid });
    var refN = parseNum(row.ref);
    var p = {
      sku: String(row.sku || row.id || '').trim(),
      slug: String(row.slug || '').trim() || DS._slug(brandName + ' ' + String(row.name || '')),
      ref: refN != null ? refN : strOrNull(row.ref),
      category: cat,
      brand: brandName,
      name: String(row.name || '').trim(),
      price: parseMoney(row.price) || 0,
      price_to: parseMoney(row.price_to),
      price_from: String(row.price_from || '').trim() === '' ? false : parseBool(row.price_from),
      price_status: String(row.price_status || '').trim() || 'S',
      avail: 'via_konfirmasi',
      speed: strOrNull(row.speed),
      type: strOrNull(row.type),
      options: options,
      spec: parseSpec(row.spec),
      note: String(row.note || ''),
      is_active: parseBool(row.is_active)
    };
    var img = String(row.image || '').trim();
    p.image = img || null; // selalu ada; null bila kosong (sama dengan katalog asli)
    return p;
  }

  function bySort(rows) {
    var any = rows.some(function (r) { return parseNum(r.sort) != null; });
    if (!any) return rows;
    return rows.map(function (r, i) { return { r: r, i: i, s: parseNum(r.sort) }; }).sort(function (a, b) {
      var sa = a.s == null ? 1e9 : a.s, sb = b.s == null ? 1e9 : b.s;
      return sa - sb || a.i - b.i;
    }).map(function (x) { return x.r; });
  }

  // tab master hasil pull -> bentuk DS_CATALOG. Tab kosong = bagian itu kosong (TIDAK ada data bawaan).
  // Produk tidak lengkap (harga/brand/kategori/sku salah) tidak masuk `products`, tapi dicatat di `incomplete`.
  function buildCatalog(tabs, base) {
    base = base || {}; tabs = tabs || {};
    var cat = { sample: false, colors: base.colors || {}, assembly_fee: null, store: { address: '', wa: '', hours: '' }, brands: [], categories: [], distributors: [], products: [], incomplete: [] };
    var brandRows = (Array.isArray(tabs.brands) ? tabs.brands : []).filter(function (r) { return String(r.id == null ? '' : r.id).trim(); });
    cat.brands = bySort(brandRows).map(function (r) {
      return { id: String(r.id).trim(), name: String(r.name || r.id).trim(), distributor_id: strOrNull(r.distributor_id) };
    });
    var catRows = (Array.isArray(tabs.categories) ? tabs.categories : []).filter(function (r) { return String(r.id == null ? '' : r.id).trim(); });
    cat.categories = bySort(catRows).map(function (r) {
      return { id: String(r.id).trim(), name: String(r.name || r.id).trim(), prefix: String(r.prefix || '').trim() };
    });
    cat.distributors = (Array.isArray(tabs.distributors) ? tabs.distributors : []).filter(function (r) { return String(r.id == null ? '' : r.id).trim(); }).map(function (r) {
      return { id: String(r.id).trim(), name: String(r.name || r.id).trim(), wa: String(r.wa || '').trim(), note: String(r.note || '') };
    });
    var nameById = {}, catIds = {}, seenSku = {}, seenSlug = {};
    cat.brands.forEach(function (b) { nameById[b.id] = b.name; });
    cat.categories.forEach(function (c) { catIds[c.id] = true; });
    (Array.isArray(tabs.products) ? tabs.products : []).forEach(function (r) {
      var sku = String(r.sku || r.id || '').trim(), nm = String(r.name || '').trim();
      if (!sku && !nm) return; // baris benar-benar kosong
      var bad = productProblems(r, nameById, catIds);
      if (sku && seenSku[sku]) bad.push('sku (dobel)');
      if (bad.length) { cat.incomplete.push({ sku: sku, name: nm, missing: bad }); return; }
      seenSku[sku] = true;
      var p = rowToProduct(r, nameById[String(r.brand_id).trim()]);
      if (seenSlug[p.slug]) p.slug = p.slug + '-' + DS._slug(sku);
      seenSlug[p.slug] = true;
      cat.products.push(p);
    });
    (tabs.settings || []).forEach(function (r) {
      var v = String(r.value == null ? '' : r.value).trim();
      if (r.id === 'address') cat.store.address = v; else if (r.id === 'david_wa') cat.store.wa = v; else if (r.id === 'store_hours') cat.store.hours = v;
    });
    var af = (tabs.settings || []).filter(function (r) { return r.id === 'assembly_fee'; })[0];
    if (af && String(af.value == null ? '' : af.value).trim() !== '') { var n = parseMoney(af.value); if (n != null) cat.assembly_fee = n; }
    return cat;
  }

  // ds_settings_v1 (bentuk store.js) <-> peta datar tab settings
  function settingsToFlat(s) {
    var f = {
      address: s.address, david_wa: s.david_wa, store_hours: s.store_hours, bank_name: (s.bank || {}).bank, bank_no: (s.bank || {}).no,
      bank_holder: (s.bank || {}).name, pay_hours: s.pay_hours
    };
    Object.keys(s.margins || {}).forEach(function (k) { f['margin.' + k] = s.margins[k]; });
    if (s.assembly_fee != null) f.assembly_fee = s.assembly_fee;
    Object.keys(f).forEach(function (k) { if (f[k] == null) delete f[k]; });
    return f;
  }
  function flatToSettings(map) {
    var s = { bank: {}, margins: {}, distributors: {} };
    Object.keys(map).forEach(function (k) {
      var v = map[k];
      if (k === 'address' || k === 'david_wa' || k === 'store_hours') s[k] = String(v);
      else if (k === 'bank_name') s.bank.bank = String(v);
      else if (k === 'bank_no') s.bank.no = String(v);
      else if (k === 'bank_holder') s.bank.name = String(v);
      else if (k === 'pay_hours') { var n = parseNum(v); if (n != null && n > 0) s.pay_hours = n; }
      else if (k.indexOf('margin.') === 0) { var m = parseNum(v); if (m != null) s.margins[k.slice(7)] = m; }
    });
    return s;
  }

  // sidik ringan (dua hash 32-bit + panjang) agar ds_sync_v1 tidak menggandakan seluruh order
  function sigOf(x) {
    var s = typeof x === 'string' ? x : JSON.stringify(x), h1 = 5381, h2 = 2166136261;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = Math.imul(h2 ^ c, 16777619) >>> 0;
    }
    return s.length + '.' + h1.toString(36) + '.' + h2.toString(36);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function nowIso() { return DS.isoWIB(); }
  function hhmm(iso) { return iso ? String(iso).slice(11, 16).replace(':', '.') : ''; }

  /* ============================================================ keadaan */

  function loadCfg() {
    var c = ST.read(K_CFG);
    if (c && typeof c.url === 'string' && c.url.trim()) return { url: c.url.trim(), token: String(c.token || '') };
    return null;
  }
  function freshSync() { return { queue: [], base: {}, sig: {}, last_pull_at: null, last_sync: null, last_error: null }; }
  function loadSync() {
    var s = ST.read(K_SYNC);
    if (!s || typeof s !== 'object') return freshSync();
    var f = freshSync();
    Object.keys(f).forEach(function (k) { if (s[k] != null) f[k] = s[k]; });
    if (!Array.isArray(f.queue)) f.queue = [];
    return f;
  }

  var cfg = loadCfg();
  var S = loadSync();
  var rt = { state: 'idle', ready: false, readyCbs: [], applying: false, pulling: null, flushing: null, seq: 0,
    baseCatalog: null, catSig: null, timer: null, flushTimer: null, retry: null, needPull: false };

  function mode() { return cfg ? 'sheet' : 'local'; }
  DS._mode = mode;

  function saveS() { ST.write(K_SYNC, S); }
  function emit(name, detail) {
    try {
      if (!root.dispatchEvent) return;
      if (typeof root.CustomEvent === 'function') root.dispatchEvent(new root.CustomEvent(name, { detail: detail }));
      else root.dispatchEvent({ type: name, detail: detail });
    } catch (e) { /* abaikan */ }
  }
  function status() {
    return { mode: mode(), state: mode() === 'local' ? 'idle' : rt.state, pending: S.queue.length,
      lastSync: S.last_sync || null, error: S.last_error || null,
      catalog: cfg ? 'sheet' : (pubUrl() ? 'public' : 'none'), catalogError: rt.pubError || null };
  }
  function emitStatus() { saveS(); emit('ds:sync', status()); }
  function setState(s) { rt.state = s; emitStatus(); }

  function mkErr(kind, msg) { var e = new Error(msg); e.kind = kind; return e; }
  function fail(e) {
    var net = e && e.kind === 'network';
    S.last_error = (e && e.message) || 'Gagal sinkron';
    rt.state = net ? 'offline' : 'error';
    emitStatus();
  }

  /* ============================================================ jaringan */

  function offline() { return root.navigator && root.navigator.onLine === false; }

  function req(url, init, ms) {
    if (offline()) return Promise.reject(mkErr('network', 'Tidak ada koneksi internet'));
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = null;
    if (ctl) { init = Object.assign({}, init, { signal: ctl.signal }); timer = setTimeout(function () { ctl.abort(); }, ms); }
    var p;
    try { p = root.fetch(url, init); } catch (e) { return Promise.reject(mkErr('network', 'Gagal menghubungi Google Sheet')); }
    return p.then(function (r) {
      return r.text().then(function (t) {
        clearTimeout(timer);
        try { return JSON.parse(t); } catch (e) {
          throw mkErr('server', 'Jawaban bukan JSON. Cek deploy: "Who has access" harus Anyone dan URL berakhiran /exec');
        }
      });
    }, function (e) {
      clearTimeout(timer);
      throw mkErr('network', e && e.name === 'AbortError' ? 'Google Sheet tidak menjawab dalam ' + Math.round(ms / 1000) + ' detik' : 'Gagal menghubungi Google Sheet');
    });
  }
  function srvErr(res) {
    var code = res && res.error;
    var msg = code === 'unauthorized' ? 'Token ditolak' : code === 'busy' ? 'Sheet sedang sibuk, coba lagi' :
      'Server menolak: ' + (code || 'jawaban kosong');
    var e = mkErr('server', msg); e.code = code; return e;
  }
  // op admin (ping/pull) lewat POST: token di badan, bukan di URL (T5)
  function getOp(c, op) { return postOp(c, { op: op }, PULL_TIMEOUT); }
  function postOp(c, body, ms) {
    body.token = c.token;
    return req(c.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }, ms || PUSH_TIMEOUT);
  }

  /* ============================================================ antrian kirim */

  function qk(tab, id) { return tab + ':' + id; }
  function enqueue(tab, id) {
    var hit = null;
    S.queue.forEach(function (e) { if (e.tab === tab && e.id === id) hit = e; });
    if (hit) hit.v = ++rt.seq; else S.queue.push({ tab: tab, id: id, v: ++rt.seq });
  }
  function queued(tab) {
    var m = {};
    S.queue.forEach(function (e) { if (e.tab === tab) m[e.id] = true; });
    return m;
  }

  function diffRecords(tab, arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function (r) {
      if (!r || r.id == null) return;
      var k = qk(tab, r.id), s = sigOf(r);
      if (S.sig[k] !== s) { S.sig[k] = s; enqueue(tab, r.id); }
    });
  }
  function diffSettings() {
    var cur = DS.getSettings(), raw = ST.read(DS.KEYS.settings) || {};
    var flat = settingsToFlat(Object.assign({}, cur, raw.assembly_fee != null ? { assembly_fee: raw.assembly_fee } : {}));
    Object.keys(flat).forEach(function (key) {
      var k = qk('settings', key), s = String(flat[key]);
      if (S.sig[k] !== s) { S.sig[k] = s; enqueue('settings', key); }
    });
    var ov = cur.distributors || {};
    Object.keys(ov).forEach(function (id) {
      var k = qk('distributors', id), s = JSON.stringify({ wa: ov[id].wa == null ? null : ov[id].wa, note: ov[id].note == null ? null : ov[id].note });
      if (S.sig[k] !== s) { S.sig[k] = s; enqueue('distributors', id); }
    });
  }
  function brandSig(b) { return (b.visible !== false) + '|' + b.name; }
  function diffBrands(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach(function (b) {
      if (!b || b.id == null) return;
      var k = qk('brands', b.id), s = brandSig(b);
      if (S.sig[k] !== s) { S.sig[k] = s; enqueue('brands', b.id); }
    });
  }

  DS._onWrite = function (key, value) {
    if (rt.applying || !cfg) return;
    var before = S.queue.length + ':' + rt.seq;
    if (key === DS.KEYS.orders) diffRecords('orders', value);
    else if (key === DS.KEYS.pos) diffRecords('purchase_orders', value);
    else if (key === DS.KEYS.settings) diffSettings();
    else if (key === DS.KEYS.brands) diffBrands(value);
    else return;
    if (before !== S.queue.length + ':' + rt.seq) { emitStatus(); scheduleFlush(); }
  };

  function scheduleFlush() {
    if (rt.flushTimer) return;
    rt.flushTimer = setTimeout(function () { rt.flushTimer = null; flush(); }, 250);
    if (rt.flushTimer && rt.flushTimer.unref) rt.flushTimer.unref();
  }

  function buildRecord(tab, id) {
    var i, a;
    if (tab === 'orders' || tab === 'purchase_orders') {
      a = tab === 'orders' ? DS.getOrders() : DS.getPOs();
      for (i = 0; i < a.length; i++) if (a[i].id === id) return a[i];
      return null;
    }
    if (tab === 'settings') {
      var raw = ST.read(DS.KEYS.settings) || {};
      var flat = settingsToFlat(Object.assign({}, DS.getSettings(), raw.assembly_fee != null ? { assembly_fee: raw.assembly_fee } : {}));
      return flat[id] == null ? null : { id: id, value: String(flat[id]) };
    }
    if (tab === 'brands') {
      a = DS.getBrands();
      for (i = 0; i < a.length; i++) if (a[i].id === id) return { id: id, name: a[i].name, visible: a[i].visible ? 'TRUE' : 'FALSE' };
      return null;
    }
    if (tab === 'distributors') {
      var o = (DS.getSettings().distributors || {})[id];
      if (!o) return null;
      var r = { id: id };
      if (o.wa != null) r.wa = String(o.wa);
      if (o.note != null) r.note = String(o.note);
      return r;
    }
    return null;
  }

  function withApplying(fn) {
    var prev = rt.applying; rt.applying = true;
    try { return fn(); } finally { rt.applying = prev; }
  }

  function dropEntry(tab, id, v) {
    S.queue = S.queue.filter(function (e) { return !(e.tab === tab && e.id === id && (v == null || e.v === v)); });
  }

  function applyResult(tab, entry, res, ctx) {
    var k = qk(tab, entry.id), rec;
    if (!res) return; // tidak dijawab: tetap di antrian
    if (res.status === 'ok') {
      S.base[k] = res.updated_at;
      if (tab === 'orders' || tab === 'purchase_orders') {
        withApplying(function () {
          var arr = tab === 'orders' ? DS.getOrders() : DS.getPOs(), hit = null;
          arr.forEach(function (r) { if (r.id === entry.id) hit = r; });
          if (hit) {
            hit.updated_at = res.updated_at;
            S.sig[k] = sigOf(hit);
            if (tab === 'orders') DS.saveOrders(arr); else DS.savePOs(arr);
          }
        });
      }
      dropEntry(tab, entry.id, entry.v); // v berubah = ada simpan baru selama kirim: tetap di antrian
      ctx.sent++;
    } else if (res.status === 'remapped' && res.new_id) {
      remap(tab, entry.id, res.new_id, res.updated_at);
      dropEntry(tab, entry.id, entry.v);
      ctx.sent++;
    } else if (res.status === 'stale') {
      dropEntry(tab, entry.id, entry.v);
      ctx.needPull = true;
      if ((tab === 'orders' || tab === 'purchase_orders') && res.server_record) {
        rec = res.server_record;
        withApplying(function () {
          var arr = tab === 'orders' ? DS.getOrders() : DS.getPOs(), found = false;
          arr = arr.map(function (r) { if (r.id === entry.id) { found = true; return rec; } return r; });
          if (!found) arr.push(rec);
          if (tab === 'orders') DS.saveOrders(arr); else DS.savePOs(arr);
        });
        S.base[k] = rec.updated_at; S.sig[k] = sigOf(rec);
      }
      emit('ds:stale', { tab: tab, id: entry.id, kind: 'stale',
        message: 'Data ' + entry.id + ' diubah di perangkat lain. Versi terbaru dimuat; perubahan terakhirmu tidak tersimpan.' });
      emit('ds:data', { changed: [tab] });
    } else if (res.status === 'invalid') {
      dropEntry(tab, entry.id, entry.v);
      S.last_error = 'Ditolak server (' + (res.reason || 'invalid') + '): ' + entry.id;
      emit('ds:stale', { tab: tab, id: entry.id, kind: 'invalid', message: S.last_error });
    }
  }

  // id lokal diganti id baru dari server (bentrok antar-perangkat); PO yang menunjuk order ikut diperbarui
  function remap(tab, from, to, updatedAt) {
    withApplying(function () {
      var arr, pos;
      if (tab === 'orders') {
        arr = DS.getOrders().map(function (o) { if (o.id === from) { o.id = to; o.updated_at = updatedAt; } return o; });
        DS.saveOrders(arr);
        pos = DS.getPOs();
        var touched = [];
        pos.forEach(function (p) { if (p.order_id === from) { p.order_id = to; touched.push(p.id); } });
        if (touched.length) { DS.savePOs(pos); touched.forEach(function (pid) { delete S.sig[qk('purchase_orders', pid)]; }); }
        arr.forEach(function (o) { if (o.id === to) S.sig[qk('orders', to)] = sigOf(o); });
        touched.forEach(function (pid) { pos.forEach(function (p) { if (p.id === pid) { S.sig[qk('purchase_orders', pid)] = sigOf(p); enqueue('purchase_orders', pid); } }); });
      } else {
        arr = DS.getPOs().map(function (p) { if (p.id === from) { p.id = to; p.updated_at = updatedAt; } return p; });
        DS.savePOs(arr);
        arr.forEach(function (p) { if (p.id === to) S.sig[qk('purchase_orders', to)] = sigOf(p); });
      }
    });
    S.base[qk(tab, to)] = updatedAt;
    emit('ds:idremap', { from: from, to: to });
    emit('ds:data', { changed: [tab] });
  }

  // SERIALISASI: kirim (flush) dan tarik (pull) tidak boleh berjalan bersamaan. Bila tarikan berangkat sebelum kirim selesai,
  // jawabannya (foto sheet yang lebih lama) menimpa perubahan lokal yang sudah terkirim tapi belum terlihat di sheet:
  // PO yang baru dibuat hilang, status mundur, `chosen` lenyap (bug PO batal saat Terima bayar).
  var xq = Promise.resolve();
  function exclusive(fn) { var p = xq.then(fn); xq = p.then(function () { }, function () { }); return p; }

  function flush() {
    if (!cfg) return Promise.resolve({ ok: true, skipped: true });
    if (rt.flushing) return rt.flushing;
    if (!S.queue.length) return Promise.resolve({ ok: true, sent: 0 });
    rt.flushing = exclusive(doFlush).then(function (r) {
      rt.flushing = null;
      if (r.needPull) return pull().then(function () { return { ok: true, sent: r.sent }; });
      return r;
    });
    return rt.flushing;
  }
  function doFlush() {
    if (!cfg || !S.queue.length) return Promise.resolve({ ok: true, sent: 0 });
    var c = cfg, ctx = { sent: 0, needPull: false, error: null };
    setState('syncing');
    var chain = Promise.resolve();
    TABS.forEach(function (tab) {
      chain = chain.then(function () {
        if (ctx.error) return;
        var entries = S.queue.filter(function (e) { return e.tab === tab; }).map(function (e) { return { tab: e.tab, id: e.id, v: e.v }; });
        var rows = [], sendEntries = [];
        entries.forEach(function (e) {
          var rec = buildRecord(tab, e.id);
          if (rec == null) { dropEntry(tab, e.id, e.v); return; } // record hilang: tidak ada yang dikirim
          rows.push({ id: e.id, base_updated_at: S.base[qk(tab, e.id)] || null, record: rec });
          sendEntries.push(e);
        });
        if (!rows.length) return;
        return postOp(c, { op: 'upsert', tab: tab, rows: rows }).then(function (res) {
          if (!res || !res.ok) throw srvErr(res);
          var byId = {};
          (res.results || []).forEach(function (r) { byId[r.id] = r; });
          sendEntries.forEach(function (e) { applyResult(tab, e, byId[e.id], ctx); });
        });
      }).catch(function (e) { ctx.error = e; });
    });
    return chain.then(function () {
      if (ctx.error) { fail(ctx.error); return { ok: false, error: ctx.error.message, sent: ctx.sent }; }
      S.last_error = S.last_error && /^Ditolak server/.test(S.last_error) ? S.last_error : null;
      if (ctx.sent) S.last_sync = nowIso();
      rt.state = 'idle';
      emitStatus();
      return { ok: true, sent: ctx.sent, needPull: ctx.needPull };
    });
  }

  /* ============================================================ tarik dari sheet */

  function parseTx(rows) {
    var out = [];
    rows.forEach(function (r) {
      try {
        var rec = JSON.parse(r.json);
        if (!rec || typeof rec !== 'object') return;
        rec.id = r.id || rec.id;
        rec.updated_at = r.updated_at || rec.updated_at;
        out.push(rec);
      } catch (e) { if (typeof console !== 'undefined') console.warn('sync: json rusak untuk ' + r.id); }
    });
    return out;
  }

  function mergeTx(tab, rows, getter, setter, changed) {
    if (!Array.isArray(rows)) return;
    var sheet = parseTx(rows), local = getter(), q = queued(tab), localMap = {}, seen = {}, out = [], dropped = [];
    local.forEach(function (l) { localMap[l.id] = l; });
    sheet.forEach(function (r) {
      var k = qk(tab, r.id);
      seen[r.id] = true;
      if (q[r.id] && localMap[r.id]) { out.push(localMap[r.id]); return; } // perubahan lokal belum terkirim menang sementara
      out.push(r); S.base[k] = r.updated_at; S.sig[k] = sigOf(r);
    });
    local.forEach(function (l) {
      if (seen[l.id]) return;
      if (q[l.id]) out.push(l); else dropped.push(l);
    });
    if (dropped.length) backupDropped(tab, dropped);
    if (JSON.stringify(out) !== JSON.stringify(local)) { setter(out); changed.push(tab); }
  }

  function backupDropped(tab, recs) {
    var b = ST.read(K_DROPPED);
    if (!b || typeof b !== 'object') b = { orders: [], purchase_orders: [] };
    b[tab] = (b[tab] || []).concat(recs);
    b.at = nowIso();
    ST.write(K_DROPPED, b);
  }

  function applyPull(tabs) {
    var changed = [];
    withApplying(function () {
      // order & PO
      mergeTx('orders', tabs.orders, DS.getOrders, function (a) { DS.saveOrders(a); }, changed);
      mergeTx('purchase_orders', tabs.purchase_orders, DS.getPOs, function (a) { DS.savePOs(a); }, changed);

      // settings (+ override distributor: tab distributors adalah kebenaran)
      if (Array.isArray(tabs.settings) && tabs.settings.length) {
        var before = JSON.stringify(ST.read(DS.KEYS.settings));
        var qs = queued('settings'), qd = queued('distributors');
        var curS = DS.getSettings();
        var localFlat = settingsToFlat(curS);
        var map = {};
        tabs.settings.forEach(function (r) { if (r.id) map[r.id] = r.value; });
        Object.keys(qs).forEach(function (k) { if (localFlat[k] != null) map[k] = localFlat[k]; });
        var ns = flatToSettings(map);
        Object.keys(qd).forEach(function (id) { if (curS.distributors && curS.distributors[id]) ns.distributors[id] = curS.distributors[id]; });
        DS.saveSettings(ns);
        if (JSON.stringify(ST.read(DS.KEYS.settings)) !== before) changed.push('settings');
        var flat2 = settingsToFlat(DS.getSettings());
        tabs.settings.forEach(function (r) {
          if (!r.id || qs[r.id]) return;
          S.base[qk('settings', r.id)] = r.updated_at;
          if (flat2[r.id] != null) S.sig[qk('settings', r.id)] = String(flat2[r.id]);
        });
      }
      if (Array.isArray(tabs.distributors)) {
        tabs.distributors.forEach(function (r) { if (r.id && !queued('distributors')[r.id]) S.base[qk('distributors', r.id)] = r.updated_at; });
      }

      // brand
      if (Array.isArray(tabs.brands)) {
        var beforeB = JSON.stringify(ST.read(DS.KEYS.brands));
        var qb = queued('brands'), localB = {};
        DS.getBrands().forEach(function (b) { localB[b.id] = b; });
        var arr = tabs.brands.filter(function (r) { return r.id; }).map(function (r) {
          var id = String(r.id).trim();
          if (qb[id] && localB[id]) return { id: id, name: localB[id].name, visible: localB[id].visible };
          return { id: id, name: String(r.name || id).trim(), visible: parseBool(r.visible) };
        });
        // brand lokal yang sudah masuk antrian tapi belum ada di sheet
        Object.keys(qb).forEach(function (id) {
          if (!arr.some(function (b) { return b.id === id; }) && localB[id]) arr.push({ id: id, name: localB[id].name, visible: localB[id].visible });
        });
        ST.write(DS.KEYS.brands, arr);
        if (JSON.stringify(ST.read(DS.KEYS.brands)) !== beforeB) changed.push('brands');
        tabs.brands.forEach(function (r) {
          var id = String(r.id || '').trim();
          if (!id || qb[id]) return;
          S.base[qk('brands', id)] = r.updated_at;
          S.sig[qk('brands', id)] = brandSig({ name: String(r.name || id).trim(), visible: parseBool(r.visible) });
        });
      }

      // katalog (kategori, distributor, produk, brand): tab kosong = katalog kosong
      var any = ['categories', 'distributors', 'products', 'brands'].some(function (t) { return Array.isArray(tabs[t]); });
      if (any) {
        var cat = buildCatalog(tabs, baseCatalog());
        var sig = sigOf(cat);
        if (sig !== rt.catSig) { rt.catSig = sig; applyCatalog(cat); changed.push('catalog'); }
        cat.fetched_at = nowIso();
        ST.write(K_CAT, cat);
      }
    });
    return changed;
  }

  function baseCatalog() {
    if (!rt.baseCatalog) rt.baseCatalog = clone(root.DS_CATALOG) || { brands: [], categories: [], distributors: [], products: [], colors: {}, sample: false };
    return rt.baseCatalog;
  }
  // timpa isi window.DS_CATALOG di tempat, supaya referensi lama di app tetap segar
  function applyCatalog(cat) {
    if (!root.DS_CATALOG) root.DS_CATALOG = {};
    var t = root.DS_CATALOG;
    Object.keys(cat).forEach(function (k) { if (k !== 'fetched_at') t[k] = cat[k]; });
  }

  function pull(opts) {
    if (!cfg) return Promise.resolve({ ok: true, skipped: true });
    if (rt.pulling) return rt.pulling;
    rt.pulling = exclusive(function () { return doPull(opts); }).then(function (r) { rt.pulling = null; return r; });
    return rt.pulling;
  }
  function doPull(opts) {
    if (!cfg) return Promise.resolve({ ok: true, skipped: true });
    var c = cfg, silent = !!(opts && opts.silent) && rt.state === 'idle';
    if (!silent) setState('syncing');
    return getOp(c, 'pull').then(function (res) {
      if (!res || !res.ok) throw srvErr(res);
      var changed = applyPull(res.tabs || {});
      S.last_pull_at = S.last_sync = nowIso();
      S.last_error = null;
      rt.state = 'idle';
      if (silent && !changed.length) saveS(); else emitStatus(); // tarik otomatis tanpa perubahan: jangan memicu render ulang
      if (changed.length) emit('ds:data', { changed: changed });
      return { ok: true, changed: changed };
    }).catch(function (e) {
      fail(e);
      return { ok: false, error: e.message };
    });
  }

  function syncNow(opts) {
    if (!cfg) return Promise.resolve({ ok: true, skipped: true });
    return flush().then(function () { return pull(opts); });
  }

  /* ============================================================ katalog publik (tanpa token) + jalur pesanan publik */

  function pubUrl() {
    var u = root.DS_PUBLIC && root.DS_PUBLIC.catalogUrl;
    return typeof u === 'string' && /^https:\/\/script\.google\.com\//i.test(u.trim()) ? u.trim() : null;
  }
  function pubGet(query) { var u = pubUrl(); return req(u + (u.indexOf('?') < 0 ? '?' : '&') + query, { method: 'GET' }, PULL_TIMEOUT); }
  function pubPost(body) {
    return req(pubUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }, PUSH_TIMEOUT);
  }

  // Tarik katalog publik (hanya baca). Tidak ada penulisan master.
  function pullPublic() {
    if (cfg || !pubUrl()) return Promise.resolve({ ok: true, skipped: true });
    if (rt.pullingPub) return rt.pullingPub;
    rt.pullingPub = pubGet('op=catalog').then(function (res) {
      if (!res || !res.ok || !res.tabs) throw srvErr(res);
      var stp = res.store || {}, prow = [];
      if (res.assembly_fee != null) prow.push({ id: 'assembly_fee', value: String(res.assembly_fee) });
      ['address', 'david_wa', 'store_hours'].forEach(function (k) { if (stp[k]) prow.push({ id: k, value: String(stp[k]) }); });
      var ptabs = Object.assign({}, res.tabs, { settings: prow });
      var cat = buildCatalog(ptabs, baseCatalog()), sig = sigOf(cat), changed = [];
      if (sig !== rt.catSig) { rt.catSig = sig; applyCatalog(cat); changed.push('catalog'); }
      cat.fetched_at = nowIso();
      ST.write(K_CAT_PUB, cat);
      rt.pubError = null; rt.pubAt = Date.now();
      emit('ds:sync', status());
      if (changed.length) emit('ds:data', { changed: changed });
      return { ok: true, changed: changed };
    }).catch(function (e) {
      rt.pubError = (e && e.message) || 'Katalog gagal dimuat';
      emit('ds:sync', status());
      return { ok: false, error: rt.pubError };
    }).then(function (r) { rt.pullingPub = null; return r; });
    return rt.pullingPub;
  }

  // Jalur publik tanpa token: order_create / order_track / order_customer_action. Kegagalan jaringan TIDAK pernah
  // diam-diam disimpan lokal; pemanggil menerima { ok:false, network:true } dan harus menampilkannya.
  var NET_MSG = 'Tidak bisa terhubung ke server. Periksa internet Anda, lalu coba lagi.';
  function pubCall(fn) {
    if (!pubUrl()) return Promise.resolve({ ok: false, error: 'no_public_url', message: 'Alamat server toko belum diatur.' });
    return fn().then(function (res) {
      if (!res || typeof res !== 'object') return { ok: false, error: 'bad_response', message: 'Jawaban server tidak dikenali.' };
      if (!res.ok && !res.message) res.message = 'Server menolak: ' + (res.error || 'tanpa keterangan');
      return res;
    }, function (e) {
      return { ok: false, network: true, error: 'network', message: e && e.kind === 'server' ? e.message : NET_MSG };
    });
  }
  DS.pub = {
    enabled: function () { return !!pubUrl(); },
    createOrder: function (payload) { return pubCall(function () { return pubPost(Object.assign({}, payload, { op: 'order_create' })); }); },
    track: function (id, wa, k) { return pubCall(function () { return pubGet('op=order_track&id=' + encodeURIComponent(id) + '&wa=' + encodeURIComponent(wa) + '&k=' + encodeURIComponent(k || '')); }); },
    action: function (id, wa, k, action, extra) { return pubCall(function () { return pubPost(Object.assign({}, extra, { op: 'order_customer_action', id: id, wa: wa, k: k || '', action: action })); }); }
  };

  /* ============================================================ ready, konfigurasi, seed */

  function fireReady() {
    if (rt.ready) return;
    rt.ready = true;
    var cbs = rt.readyCbs; rt.readyCbs = [];
    cbs.forEach(function (cb) { try { cb(); } catch (e) { if (typeof console !== 'undefined') console.error(e); } });
  }
  DS.ready = function (cb) {
    if (typeof cb !== 'function') return;
    if (rt.ready) cb(); else rt.readyCbs.push(cb);
  };
  DS.syncStatus = status;

  function localCount() { return DS.getOrders().length + DS.getPOs().length; }

  function startTimers() {
    if (rt.retry || !cfg) return;
    rt.retry = setInterval(function () { if (cfg && S.queue.length && !rt.flushing) flush(); }, RETRY_MS);
    if (rt.retry.unref) rt.retry.unref();
    // tarik otomatis berkala saat tab terlihat, supaya pesanan baru dari toko publik muncul di Dashboard
    rt.auto = setInterval(function () {
      if (!cfg || rt.flushing || rt.pulling) return;
      if (root.document && root.document.visibilityState === 'hidden') return;
      syncNow({ silent: true });
    }, AUTO_PULL_MS);
    if (rt.auto.unref) rt.auto.unref();
  }

  var GS_URL_RE = /^https:\/\/script\.google\.com\//i;
  var GS_URL_MSG = 'URL harus diawali https://script.google.com/ (alamat Web App Apps Script). Skema lain ditolak.';
  function testConnection(c) {
    c = c || cfg;
    if (!c || !c.url) return Promise.resolve({ ok: false, error: 'URL belum diisi' });
    if (!GS_URL_RE.test(String(c.url).trim())) return Promise.resolve({ ok: false, error: GS_URL_MSG });
    return getOp({ url: c.url, token: c.token || '' }, 'ping').then(function (res) {
      if (!res || !res.ok) throw srvErr(res);
      return { ok: true, sheet: res.sheet, counts: res.counts || {} };
    }).catch(function (e) { return { ok: false, error: e.message }; });
  }

  function saveConfig(c) {
    var url = String((c && c.url) || '').trim(), token = String((c && c.token) || '').trim();
    if (!url) { disconnect(); return Promise.resolve({ ok: true, mode: 'local' }); }
    if (!GS_URL_RE.test(url)) return Promise.resolve({ ok: false, error: GS_URL_MSG });
    if (!token) return Promise.resolve({ ok: false, error: 'Token belum diisi' });
    var same = cfg && cfg.url === url && cfg.token === token;
    ST.write(K_CFG, { url: url, token: token });
    cfg = { url: url, token: token };
    if (!same) {
      S = freshSync();
      // order/PO lokal yang sudah ada dianggap "sudah dikenal" supaya tidak dikirim sebagai pesanan baru;
      // pull pertama membuangnya dari tampilan (salinannya disimpan di ds_local_dropped_v1)
      DS.getOrders().forEach(function (o) { S.sig[qk('orders', o.id)] = sigOf(o); });
      DS.getPOs().forEach(function (p) { S.sig[qk('purchase_orders', p.id)] = sigOf(p); });
      rt.catSig = null;
    }
    saveS();
    startTimers();
    return pull().then(function (r) { return Object.assign({ mode: 'sheet' }, r); });
  }

  function disconnect() {
    ST.remove(K_CFG); ST.remove(K_SYNC); ST.remove(K_CAT);
    if (!pubUrl()) emptyCatalogInPlace();
    cfg = null; S = freshSync(); rt.state = 'idle';
    if (rt.retry) { clearInterval(rt.retry); rt.retry = null; }
    if (rt.auto) { clearInterval(rt.auto); rt.auto = null; }
    emit('ds:sync', status());
  }

  // ADMIN: isi bukti transfer dari Drive via Apps Script (butuh token). -> Promise<{ok, mime, base64, ...}|{ok:false, message}>
  function proofGet(orderId) {
    if (!cfg) return Promise.resolve({ ok: false, error: 'no_token', message: 'Foto bukti hanya bisa dibuka di Dashboard yang terhubung (token).' });
    return postOp(cfg, { op: 'proof_get', id: orderId }, 30000).then(function (res) {
      if (res && res.ok) return res;
      return { ok: false, error: (res && res.error) || 'server', message: (res && res.message) || (res && res.error === 'unauthorized' ? 'Token ditolak' : 'Server menolak') };
    }, function (e) { return { ok: false, error: 'network', message: (e && e.message) || 'Gagal menghubungi server' }; });
  }
  // ADMIN (ADM-24): unggah foto serah terima; server yang memindahkan status ke completed. -> Promise<{ok, updated_at}|{ok:false, message}>
  function deliveryUpload(orderId, b64, receiver, note) {
    if (!cfg) return Promise.resolve({ ok: false, error: 'no_token', message: 'Dashboard belum terhubung ke Sheet (token).' });
    return postOp(cfg, { op: 'delivery_proof_upload', id: orderId, file_b64: b64, receiver_name: receiver || '', note: note || '' }, 60000).then(function (res) {
      if (res && res.ok) return res;
      return { ok: false, error: (res && res.error) || 'server', message: (res && res.message) || (res && res.error === 'unauthorized' ? 'Token ditolak' : 'Server menolak') };
    }, function (e) { return { ok: false, error: 'network', message: (e && e.message) || 'Gagal menghubungi server' }; });
  }
  function deliveryGet(orderId) {
    if (!cfg) return Promise.resolve({ ok: false, error: 'no_token', message: 'Foto hanya bisa dibuka di Dashboard yang terhubung (token).' });
    return postOp(cfg, { op: 'delivery_proof_get', id: orderId }, 30000).then(function (res) {
      if (res && res.ok) return res;
      return { ok: false, error: (res && res.error) || 'server', message: (res && res.message) || 'Server menolak' };
    }, function (e) { return { ok: false, error: 'network', message: (e && e.message) || 'Gagal menghubungi server' }; });
  }
  // ADMIN: kunci Lacak untuk pesanan (membuat bila belum ada). -> Promise<{ok, track_key}>
  function ensureTrackKey(orderId) {
    if (!cfg) return Promise.resolve({ ok: false, error: 'no_token' });
    return postOp(cfg, { op: 'track_key_ensure', id: orderId }, PUSH_TIMEOUT).then(function (res) { return res && res.ok ? res : { ok: false, error: (res && res.error) || 'server' }; }, function () { return { ok: false, error: 'network' }; });
  }

  // Hanya membuat tab + header di sheet (tanpa data). Tombol "Siapkan tab sheet".
  function setupSheet() {
    if (!cfg) return Promise.resolve({ ok: false, error: 'Hubungkan ke Google Sheet dulu' });
    return postOp(cfg, { op: 'setup' }, 60000).then(function (res) {
      if (!res || !res.ok) throw srvErr(res);
      return pull().then(function (r) { return { ok: true, counts: res.counts || {}, pull: r }; });
    }).catch(function (e) { return { ok: false, error: e.message }; });
  }

  // kosongkan DS_CATALOG di tempat (referensi lama di app tetap sama)
  function emptyCatalogInPlace() { applyCatalog(buildCatalog({}, baseCatalog())); rt.catSig = null; }

  /* ============================================================ UI */

  function badgeHtml() {
    var s = status(), cls, txt, tip = '';
    if (s.mode === 'local' && s.catalog === 'public') {
      if (s.catalogError) { cls = 'badge--bad'; txt = 'Katalog gagal dimuat'; tip = s.catalogError; }
      else { cls = 'badge--ok'; txt = 'Katalog dari Google Sheet (baca saja)'; }
    } else if (s.mode === 'local') { cls = 'badge--neutral'; txt = 'Sumber data: Lokal'; }
    else if (s.state === 'error' || s.state === 'offline') {
      cls = 'badge--bad'; txt = 'Gagal sinkron (' + s.pending + ' tertunda)'; tip = s.error || '';
    } else if (s.state === 'syncing') { cls = 'badge--info'; txt = 'Sumber data: Google Sheet · menyimpan…'; }
    else if (s.pending > 0) { cls = 'badge--wait'; txt = 'Sumber data: Google Sheet · ' + s.pending + ' tertunda'; }
    else { cls = 'badge--ok'; txt = 'Sumber data: Google Sheet' + (s.lastSync ? ' · tersinkron ' + hhmm(s.lastSync) : ''); }
    return '<span class="badge ' + cls + '" data-ds-badge role="status"' + (tip ? ' title="' + esc(tip) + '"' : '') + '>' + esc(txt) + '</span>';
  }

  function statusLine() {
    var s = status();
    if (s.mode === 'local') return 'Mode lokal: pesanan dan pengaturan hanya di browser ini. Katalog: ' + ({ public: 'dari Google Sheet (baca saja)', none: 'kosong (tidak ada sumber)' }[s.catalog] || '-') + '.' + (s.catalogError ? ' Pesan: ' + s.catalogError : '');
    var t = 'Mode Google Sheet. ' + ({ idle: 'Siap', syncing: 'Menyinkron…', error: 'Gagal', offline: 'Tidak terhubung' }[s.state] || s.state) + '. ' +
      s.pending + ' perubahan tertunda.' + (s.lastSync ? ' Terakhir sinkron ' + hhmm(s.lastSync) + '.' : '');
    if (s.error) t += ' Pesan: ' + s.error;
    return t;
  }

  function renderSettings(el) {
    if (!el) return;
    var id = 'ds' + Math.random().toString(36).slice(2, 7);
    var c = cfg || { url: '', token: '' };
    el.innerHTML = [
      '<section class="panel" style="background:var(--surface,#fff);border:1px solid var(--border,#d6d6d6);border-radius:var(--r-md,10px);padding:var(--sp-5,20px);margin-bottom:var(--sp-4,16px)">',
      '<h2>Sumber data</h2>',
      '<p class="muted">Kosongkan URL untuk memakai data di browser ini saja. Isi URL Apps Script untuk menyimpan ke Google Sheet yang bisa dibuka bersama.</p>',
      '<div class="note wait" role="note"><div><strong>URL + token = akses penuh ke seluruh sheet</strong> (order, nama dan WA customer, Harga Distributor, margin). ',
      'Simpan token di tempat pribadi, jangan di chat atau repo. Ganti DS_TOKEN bila dicurigai bocor.</div></div>',
      '<div class="field"><label class="f" for="' + id + '-url">URL Web App Apps Script</label>',
      '<input class="input" id="' + id + '-url" type="url" autocomplete="off" spellcheck="false" placeholder="https://script.google.com/macros/s/.../exec" value="' + esc(c.url) + '">',
      '<div class="hint">Salin dari Deploy &gt; Manage deployments. Harus berakhiran /exec.</div></div>',
      '<div class="field"><label class="f" for="' + id + '-tok">Token</label>',
      '<input class="input" id="' + id + '-tok" type="password" autocomplete="off" spellcheck="false" value="' + esc(c.token) + '">',
      '<div class="hint">Sama dengan DS_TOKEN di Script Properties. Disimpan di browser ini saja.</div></div>',
      '<div class="row">',
      '<button type="button" class="btn" data-a="save">Simpan dan hubungkan</button>',
      '<button type="button" class="btn sec" data-a="test">Tes koneksi</button>',
      '<button type="button" class="btn sec" data-a="pull">Tarik ulang</button>',
      '<button type="button" class="btn sec" data-a="setup">Siapkan tab sheet</button>',
      '<button type="button" class="btn danger" data-a="off">Putuskan</button>',
      '</div>',
      '<p class="hint" id="' + id + '-msg" role="status" aria-live="polite"></p>',
      '<p class="hint" id="' + id + '-st"></p>',
      '</section>'
    ].join('');

    var q = function (sel) { return el.querySelector(sel); };
    var msg = q('#' + id + '-msg'), stEl = q('#' + id + '-st');
    function say(t) { msg.textContent = t; }
    function vals() { return { url: q('#' + id + '-url').value.trim(), token: q('#' + id + '-tok').value.trim() }; }
    function refresh() { stEl.textContent = statusLine(); }
    refresh();

    function onSync() {
      if (!root.document || !root.document.body.contains(el)) { root.removeEventListener('ds:sync', onSync); return; }
      refresh();
    }
    if (root.addEventListener) {
      if (el._dsOnSync) root.removeEventListener('ds:sync', el._dsOnSync);
      el._dsOnSync = onSync;
      root.addEventListener('ds:sync', onSync);
    }

    function busy(btn, on) { btn.disabled = on; }
    var actions = {
      test: function () {
        say('Menguji koneksi…');
        return testConnection(vals()).then(function (r) {
          if (!r.ok) return say('Gagal: ' + r.error);
          var n = r.counts || {};
          say('Terhubung ke "' + (r.sheet || '?') + '": ' + (n.products || 0) + ' produk, ' + (n.orders || 0) + ' order.');
        });
      },
      save: function () {
        var v = vals();
        if (!v.url) { return actions.off(); }
        if (!GS_URL_RE.test(v.url)) return Promise.resolve(say('Gagal: ' + GS_URL_MSG));
        if (!String(v.token || '').trim()) return Promise.resolve(say('Gagal: Token belum diisi'));
        var n = cfg ? 0 : localCount();
        if (n && root.confirm && !root.confirm('Ada ' + n + ' order/PO di browser ini. Order/PO lokal tidak ikut dipindah ke sheet dan akan hilang dari tampilan setelah tarik data pertama (salinannya disimpan di browser, key ds_local_dropped_v1). Lanjut?')) return Promise.resolve();
        say('Menghubungkan…' + (v.token.length < 32 ? ' PERINGATAN: token hanya ' + v.token.length + ' karakter; gunakan minimal 32 karakter acak (DS_TOKEN di Script Properties).' : ''));
        return saveConfig(v).then(function (r) { say((r.ok ? 'Tersimpan. Data ditarik dari sheet.' : (cfg ? 'Tersimpan, tapi tarik data gagal: ' : 'Tidak tersimpan: ') + r.error) + (v.token.length < 32 ? ' PERINGATAN: token < 32 karakter, segera ganti.' : '')); });
      },
      pull: function () {
        if (!cfg) return Promise.resolve(say('Belum terhubung ke Google Sheet.'));
        say('Menarik data…');
        return syncNow().then(function () { var s = status(); say(s.state === 'idle' ? 'Selesai.' : 'Gagal: ' + (s.error || s.state)); });
      },
      setup: function () {
        if (!cfg) return Promise.resolve(say('Simpan URL dan token dulu.'));
        say('Menyiapkan tab…');
        return setupSheet().then(function (r) {
          if (!r.ok) return say('Gagal: ' + r.error);
          say('Tab siap (hanya header; tidak ada data yang ditulis atau ditimpa). Isi data di Google Sheet: lihat PANDUAN-ISI-DATA.md.');
        });
      },
      off: function () {
        if (!cfg) { say('Sudah mode lokal.'); return Promise.resolve(); }
        if (S.queue.length && root.confirm && !root.confirm(S.queue.length + ' perubahan belum terkirim ke sheet dan akan hilang. Putuskan juga?')) return Promise.resolve();
        disconnect();
        say('Diputus. Memuat ulang ke mode lokal…');
        if (root.location && root.location.reload) setTimeout(function () { root.location.reload(); }, 400);
        return Promise.resolve();
      }
    };
    // satu pendengar klik per container, walau renderSettings dipanggil berulang (re-render dashboard)
    el._dsActions = actions; el._dsUi = { say: say, refresh: refresh, busy: busy };
    if (!el._dsBound) {
      el._dsBound = true;
      el.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('button[data-a]') : null;
        var act = b && el._dsActions[b.getAttribute('data-a')];
        if (!b || !el.contains(b) || !act) return;
        var ui = el._dsUi;
        ui.busy(b, true);
        Promise.resolve(act()).then(function () { ui.busy(b, false); ui.refresh(); }, function (e) { ui.busy(b, false); ui.say('Error: ' + (e && e.message)); });
      });
    }
  }

  DS.sync = {
    renderSettings: renderSettings,
    badgeHtml: badgeHtml,
    now: syncNow, pull: pull, flush: flush,
    testConnection: testConnection, proofGet: proofGet, deliveryUpload: deliveryUpload, deliveryGet: deliveryGet, ensureTrackKey: ensureTrackKey, setupSheet: setupSheet, pullPublic: pullPublic,
    getConfig: function () { return cfg ? { url: cfg.url, token: cfg.token } : null; },
    saveConfig: saveConfig, disconnect: disconnect,
    _pure: { parseMoney: parseMoney, parseMoneyStrict: parseMoneyStrict, parseBool: parseBool, productToRow: productToRow, rowToProduct: rowToProduct,
      productProblems: productProblems, buildCatalog: buildCatalog, settingsToFlat: settingsToFlat, flatToSettings: flatToSettings, sigOf: sigOf,
      parseSpec: parseSpec, applyPull: applyPull }
  };
  // Katalog sesuai tampilan publik: buang produk nonaktif dan produk brand yang disembunyikan
  DS.getCatalog = function (opts) {
    var cat = root.DS_CATALOG || { brands: [], categories: [], distributors: [], products: [] };
    if (!opts || !opts.publicOnly) return cat;
    var out = Object.assign({}, cat);
    out.products = (cat.products || []).filter(function (p) { return p.is_active !== false && DS.isBrandVisible(p.brand); });
    return out;
  };

  /* ============================================================ init */

  if (cfg) {
    // cache katalog dari sheet terakhir dipakai dulu; kalau pull gagal, ini yang tampil (bukan data contoh)
    var cached = ST.read(K_CAT);
    baseCatalog();
    if (cached && Array.isArray(cached.products)) {
      var cc = clone(cached); delete cc.fetched_at;
      rt.catSig = sigOf(cc);
      applyCatalog(cached);
    }
    startTimers();
    var t = setTimeout(fireReady, PULL_TIMEOUT);
    if (t && t.unref) t.unref();
    pull().then(fireReady).then(function () { return flush(); });
  } else if (pubUrl()) {
    // tanpa token: katalog publik read-only. Cache terakhir tampil dulu; tarik baru di belakang.
    baseCatalog();
    var cachedP = ST.read(K_CAT_PUB);
    if (cachedP && Array.isArray(cachedP.products)) {
      var cp = clone(cachedP); delete cp.fetched_at;
      rt.catSig = sigOf(cp);
      applyCatalog(cachedP);
    }
    var tp = setTimeout(fireReady, PULL_TIMEOUT);
    if (tp && tp.unref) tp.unref();
    pullPublic().then(fireReady);
  } else {
    rt.ready = true;
  }
  // pendengar dipasang selalu (mode bisa berpindah saat berjalan); semuanya tidak berbuat apa-apa di mode lokal
  if (root.addEventListener) {
    root.addEventListener('beforeunload', function (e) {
      if (cfg && S.queue.length) { e.preventDefault(); e.returnValue = ''; return ''; }
    });
    root.addEventListener('online', function () { if (cfg) syncNow(); });
  }
  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('visibilitychange', function () {
      if (cfg && root.document.visibilityState === 'visible') syncNow();
      else if (!cfg && pubUrl() && root.document.visibilityState === 'visible' && (!rt.pubAt || Date.now() - rt.pubAt > 60000)) pullPublic();
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = DS.sync;
})(typeof window !== 'undefined' ? window : globalThis);
