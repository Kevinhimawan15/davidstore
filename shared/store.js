/* DavidStore prototipe — store.js
   Helper data bersama sesuai prototype/KONTRAK-DATA.md. Sejak INF-01 dikerjakan bersama sync.js
   (sinkron ke Google Sheet): store.js hanya memasang kait `DS._onWrite` / `DS._mode`; kode jaringan di sync.js.
   Semua akses storage dibungkus try/catch; kalau storage mati, data hidup di memori.
   Tetap bisa di-load di Node (tes) tanpa DOM. */
(function (root) {
  'use strict';

  var K_ORD = 'ds_orders_v1';
  var K_PO = 'ds_pos_v1';
  var K_SET = 'ds_settings_v1'; // tambahan dashboard: margin, alamat David, rekening, WA distributor
  var K_BRANDS = 'ds_brands_v1'; // [{id,name,visible}] — INF-01/ADM-21; brand yang tidak ada = visible true

  var mem = {};

  function read(k) {
    try {
      var raw = root.localStorage.getItem(k);
      if (raw != null) return JSON.parse(raw);
    } catch (e) { /* storage mati / JSON rusak: pakai memori */ }
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null;
  }
  function write(k, v) {
    mem[k] = v;
    var ok = false;
    try { root.localStorage.setItem(k, JSON.stringify(v)); ok = true; } catch (e) { /* storage mati */ }
    // kait sync.js (default no-op). Kegagalan kait tidak boleh menggagalkan simpan lokal.
    try { DS._onWrite(k, v); } catch (e) { /* abaikan */ }
    return ok;
  }
  function remove(k) {
    delete mem[k];
    try { root.localStorage.removeItem(k); } catch (e) { /* abaikan */ }
  }

  // Tidak ada daftar distributor bawaan: datang dari tab `distributors` di Google Sheet (lewat DS_CATALOG.distributors).
  var DISTRIBUTORS = [];

  var CATEGORIES = [
    ['blade', 'Blade'], ['karet', 'Karet'], ['bet_rakitan', 'Bet rakitan (komponen)'], ['bet_jadi', 'Bet jadi'],
    ['bola', 'Bola'], ['meja', 'Meja'], ['net', 'Net & tiang'], ['tas', 'Tas & cover'], ['sepatu', 'Sepatu'],
    ['apparel', 'Apparel'], ['aksesoris', 'Aksesoris'], ['alat_latihan', 'Alat latihan'], ['lainnya', 'Lainnya']
  ];

  function defaultSettings() {
    return {
      address: '', // diisi David di Pengaturan; tidak ada nilai contoh (akan tersinkron ke sheet dan dibaca publik)
      david_wa: '',
      store_hours: '',
      bank: { bank: '', no: '', name: '' },
      pay_hours: 24,
      margins: { blade: 15, karet: 15, bet_rakitan: 15, bet_jadi: 20, bola: 20, meja: 12, net: 20, tas: 25,
        sepatu: 15, apparel: 25, aksesoris: 25, alat_latihan: 12, lainnya: 15 },
      distributors: {} // id -> { wa, note } penimpa
    };
  }

  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }

  // ISO dengan offset WIB (+07:00) supaya sama dengan contoh kontrak
  function isoWIB(ms) {
    var d = new Date((ms == null ? Date.now() : ms) + 7 * 3600e3);
    return d.toISOString().slice(0, 19) + '+07:00';
  }
  function ymdWIB(ms) {
    var d = new Date((ms == null ? Date.now() : ms) + 7 * 3600e3);
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
  }

  var rpFmt = null;
  function formatRupiah(n) {
    n = Math.round(Number(n) || 0);
    try {
      if (!rpFmt) rpFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
      return rpFmt.format(n).replace('−', '-');
    } catch (e) {
      return 'Rp ' + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
  }
  function formatAngka(n) {
    n = Math.round(Number(n) || 0);
    return (n < 0 ? '-' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function slugify(x) {
    return String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // Mode lokal: isi updated_at untuk record yang berubah (JSON tanpa updated_at beda dengan versi tersimpan).
  // Mode sheet: updated_at dicap server, klien tidak menyentuhnya.
  function stampChanged(arr, key) {
    if (!Array.isArray(arr) || DS._mode() === 'sheet') return;
    var prev = {}, old = read(key);
    if (Array.isArray(old)) old.forEach(function (r) { if (r && r.id != null) prev[r.id] = stripUpd(r); });
    var now = isoWIB();
    arr.forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      if (prev[r.id] !== stripUpd(r)) r.updated_at = now;
    });
  }
  function stripUpd(r) {
    var c = Object.assign({}, r); delete c.updated_at; return JSON.stringify(c);
  }

  function nextId(prefix, existing) {
    var ymd = ymdWIB();
    var base = prefix + '-' + ymd + '-';
    var max = 0;
    existing.forEach(function (x) {
      if (x && typeof x.id === 'string' && x.id.indexOf(base) === 0) {
        var s = parseInt(x.id.slice(base.length), 10);
        if (s > max && s < 8000) max = s; // 8000+ dicadangkan untuk data contoh penjualan
      }
    });
    return base + pad(max + 1, 4);
  }

  var DS = {
    KEYS: { orders: K_ORD, pos: K_PO, settings: K_SET, brands: K_BRANDS },
    DISTRIBUTORS: DISTRIBUTORS,
    CATEGORIES: CATEGORIES,
    isoWIB: isoWIB,
    formatRupiah: formatRupiah,
    formatAngka: formatAngka,

    getOrders: function () { var v = read(K_ORD); return Array.isArray(v) ? v : []; },
    saveOrders: function (arr) { stampChanged(arr, K_ORD); return write(K_ORD, arr); },
    updateOrder: function (id, patch) {
      var all = DS.getOrders(), hit = null;
      all.forEach(function (o) {
        if (o.id === id) { Object.keys(patch || {}).forEach(function (k) { o[k] = patch[k]; }); hit = o; }
      });
      if (hit) DS.saveOrders(all);
      return hit;
    },
    getPOs: function () { var v = read(K_PO); return Array.isArray(v) ? v : []; },
    savePOs: function (arr) { stampChanged(arr, K_PO); return write(K_PO, arr); },
    newOrderId: function () { return nextId('DS', DS.getOrders()); },
    newPoId: function () { return nextId('PO', DS.getPOs()); },

    getSettings: function () {
      var d = defaultSettings(), s = read(K_SET);
      if (!s || typeof s !== 'object') return d;
      d.address = s.address || d.address;
      d.david_wa = s.david_wa || d.david_wa;
      d.store_hours = s.store_hours != null ? String(s.store_hours) : d.store_hours;
      d.bank = Object.assign(d.bank, s.bank || {});
      d.pay_hours = Number(s.pay_hours) > 0 ? Number(s.pay_hours) : d.pay_hours;
      d.margins = Object.assign(d.margins, s.margins || {});
      d.distributors = s.distributors || {};
      return d;
    },
    saveSettings: function (s) { return write(K_SET, s); },
    getDistributors: function () {
      var ov = DS.getSettings().distributors;
      var cat = root.DS_CATALOG, base = DISTRIBUTORS;
      // daftar distributor dari tab `distributors` (lewat katalog hasil pull); kosong = daftar kosong
      if (cat && Array.isArray(cat.distributors)) base = cat.distributors;
      return base.map(function (d) {
        var o = ov[d.id] || {};
        return { id: d.id, name: d.name, wa: o.wa || d.wa, note: o.note != null ? o.note : (d.note || '') };
      });
    },
    distributorName: function (id) {
      var f = DS.getDistributors().filter(function (d) { return d.id === id; })[0];
      return f ? f.name : (id || '—');
    },

    // ---------- brand (INF-01 / ADM-21) ----------
    // Gabungan DS_CATALOG.brands + ds_brands_v1. Brand yang tidak ada di array tersimpan = visible true.
    getBrands: function () {
      var cat = root.DS_CATALOG, out = [], idx = {};
      var stored = read(K_BRANDS);
      var sv = {};
      if (Array.isArray(stored)) stored.forEach(function (b) { if (b && b.id != null) sv[b.id] = b; });
      function add(id, name) {
        if (idx[id] != null) return;
        var s = sv[id];
        idx[id] = out.length;
        out.push({ id: id, name: (s && s.name) || name || id, visible: s ? s.visible !== false : true });
      }
      if (cat && Array.isArray(cat.brands)) cat.brands.forEach(function (b) { if (b && b.id != null) add(b.id, b.name); });
      Object.keys(sv).forEach(function (id) { add(id, sv[id].name); });
      return out;
    },
    setBrandVisible: function (id, visible) {
      var all = DS.getBrands(), hit = null, key = String(id);
      all.forEach(function (b) { if (!hit && (b.id === key || b.name === key)) hit = b; });
      var target = hit ? hit.id : key;
      var stored = read(K_BRANDS);
      stored = Array.isArray(stored) ? stored.slice() : [];
      var found = false;
      stored = stored.map(function (b) {
        if (b && b.id === target) { found = true; return { id: b.id, name: b.name || (hit && hit.name) || target, visible: !!visible }; }
        return b;
      });
      if (!found) stored.push({ id: target, name: hit ? hit.name : target, visible: !!visible });
      write(K_BRANDS, stored);
      return true;
    },
    // nameOrId: id brand ("butterfly"), nama ("Butterfly"), atau slug-nya. Tidak dikenal = tampil.
    isBrandVisible: function (nameOrId) {
      if (nameOrId == null || nameOrId === '') return true;
      var k = String(nameOrId), kl = k.toLowerCase(), ks = slugify(k), res = true;
      var all = DS.getBrands();
      for (var i = 0; i < all.length; i++) {
        var b = all[i];
        if (b.id === k || String(b.name).toLowerCase() === kl || b.id === ks) { res = b.visible; break; }
      }
      return res;
    },

    // ---------- kait sinkron (dipasang sync.js) ----------
    _onWrite: function (key, value) { /* no-op sampai sync.js dimuat */ },
    _mode: function () { return 'local'; },
    _store: { read: read, write: write, remove: remove },
    _slug: slugify,

    // ---------- data lokal ----------
    // Tidak ada lagi seed/data demo (INF-01: tanpa data contoh). Hapus pesanan/PO yang tersimpan di browser ini
    // (TIDAK menyentuh Google Sheet). Tidak dipakai di mode sheet.
    clearLocal: function () {
      if (DS._mode() === 'sheet') return false;
      remove(K_ORD); remove(K_PO);
      return true;
    },
    clearAll: function () { remove(K_ORD); remove(K_PO); remove(K_SET); }
  };

  root.DS = DS;
  if (typeof module !== 'undefined' && module.exports) module.exports = DS;
})(typeof window !== 'undefined' ? window : globalThis);
