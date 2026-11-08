/**
 * DavidStore prototipe — Code.gs (INF-01, ADR-003)
 * Google Apps Script Web App: Google Sheet sebagai database PROTOTIPE.
 * Hanya untuk data CONTOH. Siapa pun pemegang URL + token = admin penuh (tidak ada peran).
 *
 * Salinan di repo ini adalah SUMBER. Editor Apps Script hanya tempat tempel.
 * Setelah mengubah: Deploy > Manage deployments > pensil > Version: New version > Deploy.
 *
 * Bagian atas = fungsi MURNI (tanpa SpreadsheetApp), diuji lewat Node.
 * Bagian bawah = jembatan ke Google (tidak bisa diuji di luar Google).
 *
 * Kontrak. Admin (token di BADAN POST text/plain; GET tidak pernah memakai token):
 *   POST { token, op:"ping" }                       -> { ok, sheet, counts, server_time }
 *   POST { token, op:"pull" }                       -> { ok, server_time, tabs:{ <tab>:[baris] } }
 *   POST { token, op:"upsert", tab, rows:[{id, base_updated_at, record}] } -> { ok, results:[...] }
 *   POST { token, op:"setup" }                      -> tab + header saja (tidak menimpa)
 *   POST { token, op:"proof_get", id }              -> { ok, mime, base64 } (foto bukti dari Drive)
 *   POST { token, op:"track_key_ensure", id }       -> { ok, track_key } (pesanan lama tanpa kunci Lacak)
 *  PUBLIK (tanpa token, tervalidasi server):
 *   GET  ?op=catalog        -> { ok, assembly_fee, tabs:{categories, brands(visible), products(is_active)} }
 *   GET  ?op=order_track&id=&wa=&k=      -> { ok, order(versi customer) }  id + wa + track_key harus cocok
 *   POST { op:"order_create", name, wa, address, city, note, items:[...], client_ref, hp } -> { ok, id, wa, track_key, order }
 *   POST { op:"order_customer_action", id, wa, k, action: item_decision|cancel|payment_proof, ... } -> { ok, order }
 * Token salah -> { ok:false, error:"unauthorized" } (HTTP tetap 200).
 * Dijalankan manual dari editor: setupSheet(), resetMasterTabs() (sekali).
 */

/* ============================================================ definisi tab */

var HEADERS = {
  settings: ['id', 'value', 'note', 'updated_at'],
  brands: ['id', 'name', 'visible', 'distributor_id', 'sort', 'updated_at'],
  categories: ['id', 'name', 'prefix', 'sort', 'updated_at'],
  distributors: ['id', 'name', 'wa', 'note', 'updated_at'],
  products: ['sku', 'slug', 'ref', 'category', 'brand_id', 'name', 'price', 'price_to', 'price_from', 'price_status',
    'speed', 'type', 'note', 'handles', 'thicknesses', 'colors', 'isi', 'sizes', 'widths', 'spec', 'image', 'is_active', 'updated_at'],
  orders: ['id', 'status', 'created_at', 'updated_at', 'customer_name', 'customer_wa', 'city', 'item_count', 'subtotal_est',
    'shipping_fee', 'total_final', 'payment_status', 'pay_deadline', 'courier', 'resi', 'json'],
  purchase_orders: ['id', 'order_id', 'distributor_id', 'status', 'created_at', 'sent_at', 'responded_at', 'updated_at', 'item_count', 'json'],
  order_items: ['order_id', 'line_id', 'kind', 'sku', 'brand', 'name', 'variant', 'qty', 'est_price', 'cost_price', 'final_price',
    'item_status', 'distributor_id'],
  po_items: ['po_id', 'order_id', 'line_id', 'component', 'sku', 'name', 'variant', 'qty', 'cost_price', 'available', 'eta', 'received_qty']
};
var MASTER_TABS = ['settings', 'brands', 'categories', 'distributors', 'products'];
var TX_TABS = ['orders', 'purchase_orders'];
var DERIVED_TABS = ['order_items', 'po_items'];
var KEY_COL = { products: 'sku' }; // selain ini, kolom kunci = "id"
var JSON_LIMIT = 45000; // satu sel maks 50.000 karakter
var STALE_STATUS_DECLINED = { declined: 1, unavailable: 1, cancelled: 1 };

/* ============================================================ fungsi murni */

function keyCol_(tab) { return KEY_COL[tab] || 'id'; }

// Cap waktu server, WIB, milidetik: "2026-11-08T10:15:00.123+07:00" (urut sebagai string)
function formatStamp_(date) {
  return new Date(date.getTime() + 7 * 3600e3).toISOString().slice(0, 23) + '+07:00';
}

// Nilai apa pun -> string sel. Uang integer tidak pernah jadi float/format lokal.
function cell_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return isFinite(v) ? String(v) : '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function rowToObj_(headers, row) {
  var o = {};
  for (var i = 0; i < headers.length; i++) o[headers[i]] = row[i] === undefined ? '' : row[i];
  return o;
}

// Gabungkan record ke baris yang ada. Kolom yang tidak ada di record dibiarkan (David boleh mengisinya di sheet).
// updated_at selalu dicap server.
function mergeRecordIntoRow_(headers, existingRow, record, stamp) {
  var out = [];
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (h === 'updated_at') out.push(stamp);
    else if (record && Object.prototype.hasOwnProperty.call(record, h)) out.push(cell_(record[h]));
    else out.push(existingRow && existingRow[i] !== undefined ? existingRow[i] : '');
  }
  return out;
}

function sumItems_(items, field, onlyBillable) {
  var total = 0, any = false;
  (items || []).forEach(function (it) {
    if (onlyBillable && STALE_STATUS_DECLINED[it.item_status]) return;
    var v = it[field];
    if (v === null || v === undefined || v === '') return;
    any = true;
    total += Math.round(Number(v)) * (Math.round(Number(it.qty)) || 1);
  });
  return any ? total : null;
}

// Kolom ringkasan orders (diturunkan dari json; tidak pernah dibaca balik)
function orderSummary_(order, stamp) {
  var items = order.items || [], c = order.customer || {}, pay = order.payment || {}, sh = order.shipment || {};
  var sub = sumItems_(items, 'est_price', false);
  var fin = sumItems_(items, 'final_price', true);
  var ship = order.shipping_fee === null || order.shipping_fee === undefined ? null : Math.round(Number(order.shipping_fee));
  return {
    id: order.id, status: order.status, created_at: order.created_at, updated_at: stamp,
    customer_name: c.name, customer_wa: c.wa, city: c.city, item_count: items.length,
    subtotal_est: sub, shipping_fee: ship, total_final: fin === null ? null : fin + (ship || 0),
    payment_status: pay.status, pay_deadline: order.pay_deadline, courier: sh.courier, resi: sh.resi
  };
}

function poSummary_(po, stamp) {
  return {
    id: po.id, order_id: po.order_id, distributor_id: po.distributor_id, status: po.status, created_at: po.created_at,
    sent_at: po.sent_at, responded_at: po.responded_at, updated_at: stamp, item_count: (po.items || []).length
  };
}

function orderItemRows_(order) {
  return (order.items || []).map(function (it) {
    return { order_id: order.id, line_id: it.line_id, kind: it.kind, sku: it.sku, brand: it.brand, name: it.name,
      variant: it.variant, qty: it.qty, est_price: it.est_price, cost_price: it.cost_price, final_price: it.final_price,
      item_status: it.item_status, distributor_id: it.distributor_id };
  });
}

function poItemRows_(po) {
  return (po.items || []).map(function (it) {
    return { po_id: po.id, order_id: po.order_id, line_id: it.line_id, component: it.component, sku: it.sku, name: it.name,
      variant: it.variant, qty: it.qty, cost_price: it.cost_price, available: it.available, eta: it.eta, received_qty: it.received_qty };
  });
}

// Bangun semua baris (array of array) untuk satu record transaksi: { main, items }
function buildTxRows_(tab, record, stamp) {
  var rec = JSON.parse(JSON.stringify(record));
  rec.updated_at = stamp;
  var summary = tab === 'orders' ? orderSummary_(rec, stamp) : poSummary_(rec, stamp);
  summary.json = JSON.stringify(rec);
  var mainRow = HEADERS[tab].map(function (h) { return cell_(summary[h]); });
  var itemTab = tab === 'orders' ? 'order_items' : 'po_items';
  var itemObjs = tab === 'orders' ? orderItemRows_(rec) : poItemRows_(rec);
  var items = itemObjs.map(function (o) { return HEADERS[itemTab].map(function (h) { return cell_(o[h]); }); });
  return { main: mainRow, items: items, record: rec };
}

// Cek versi. existing = { updated_at } atau null. Mengembalikan 'ok' | 'stale' | 'remapped'
function decideUpsert_(tab, existing, baseUpdatedAt) {
  var base = baseUpdatedAt === undefined || baseUpdatedAt === '' ? null : baseUpdatedAt;
  if (!existing) return 'ok';
  if (TX_TABS.indexOf(tab) >= 0) {
    if (base === null) return 'remapped'; // record baru tapi id sudah dipakai
    return String(existing.updated_at || '') > String(base) ? 'stale' : 'ok';
  }
  // master: klien harus sudah pernah melihat barisnya; kalau tidak, jangan menimpa diam-diam
  if (base === null) return 'stale';
  return String(existing.updated_at || '') > String(base) ? 'stale' : 'ok';
}

// Stempel monoton: bila stempel baru <= stempel lama di baris itu (dua upsert dalam milidetik yang sama),
// pakai lama + 1 ms supaya perbandingan versi di decideUpsert_ deterministik.
function monotonicStamp_(stamp, prev) {
  var p = String(prev || '');
  if (!p || p < stamp) return stamp;
  var t = Date.parse(p);
  return isNaN(t) ? stamp : formatStamp_(new Date(t + 1));
}

// DS-yyyymmdd-xxxx / PO-yyyymmdd-xxxx: id bebas berikutnya untuk tanggal yang sama
function nextFreeId_(id, takenIds) {
  var m = /^([A-Z]+)-(\d{8})-(\d+)$/.exec(String(id));
  var i, t;
  if (!m) {
    for (i = 2; i < 10000; i++) { t = id + '-' + i; if (takenIds.indexOf(t) < 0) return t; }
    return id + '-' + new Date().getTime();
  }
  var prefix = m[1] + '-' + m[2] + '-', max = 0;
  takenIds.forEach(function (x) {
    if (String(x).indexOf(prefix) === 0) {
      var n = parseInt(String(x).slice(prefix.length), 10);
      if (n > max) max = n;
    }
  });
  var s = String(max + 1);
  while (s.length < 4) s = '0' + s;
  return prefix + s;
}

// null = sah; selain itu alasan penolakan
function validateRow_(tab, row) {
  if (!HEADERS[tab] || DERIVED_TABS.indexOf(tab) >= 0) return 'unknown_tab';
  if (!row || row.id === undefined || row.id === null || String(row.id).trim() === '') return 'empty_id';
  if (!row.record || typeof row.record !== 'object') return 'empty_record';
  if (TX_TABS.indexOf(tab) >= 0) {
    var js = JSON.stringify(row.record);
    if (js.length > JSON_LIMIT) return 'json_too_large';
  }
  return null;
}

function checkToken_(given, expected) {
  if (typeof expected !== 'string' || expected === '') return false; // DS_TOKEN belum diisi = tertutup
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  var diff = 0;
  for (var i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// Tab turunan: buang baris dengan kolom `idx` termasuk ids, lalu tambah newRows
function mergeDerived_(existingRows, idx, ids, newRows) {
  var drop = {};
  ids.forEach(function (i) { drop[i] = true; });
  return existingRows.filter(function (r) { return !drop[r[idx]]; }).concat(newRows);
}

// Inti upsert satu tab, tanpa sentuh sheet. state = { rows: [array...] (tanpa header) }.
// Mengembalikan { results, writes:[{rowIndex|null, values}], txRows:{ <id>: {main, items} } }
function planUpsert_(tab, state, rows, baseStamp) {
  var headers = HEADERS[tab], kc = headers.indexOf(keyCol_(tab)), uc = headers.indexOf('updated_at');
  var index = {}, taken = [];
  state.rows.forEach(function (r, i) { index[r[kc]] = i; taken.push(r[kc]); });
  var results = [], writes = [], tx = {};
  var isTx = TX_TABS.indexOf(tab) >= 0;
  rows.forEach(function (row) {
    var bad = validateRow_(tab, row);
    if (bad) { results.push({ id: row && row.id, status: 'invalid', reason: bad }); return; }
    var id = String(row.id), i = index[id];
    var existing = i === undefined ? null : { updated_at: state.rows[i][uc] };
    var verdict = decideUpsert_(tab, existing, row.base_updated_at);
    if (verdict === 'stale') {
      var cur = state.rows[i];
      var sr = isTx ? safeParse_(cur[headers.indexOf('json')]) : rowToObj_(headers, cur);
      if (isTx && sr) sr.updated_at = cur[uc];
      results.push({ id: id, status: 'stale', updated_at: cur[uc], server_record: sr });
      return;
    }
    var rec = row.record, newId = null, stamp = monotonicStamp_(baseStamp, existing && verdict !== 'remapped' ? existing.updated_at : '');
    if (verdict === 'remapped') {
      newId = nextFreeId_(id, taken);
      rec = JSON.parse(JSON.stringify(rec)); rec.id = newId;
    }
    var finalId = newId || id;
    if (isTx) {
      var built = buildTxRows_(tab, rec, stamp);
      tx[finalId] = built;
      var at = verdict === 'remapped' ? null : i;
      writes.push({ rowIndex: at === undefined ? null : at, values: built.main, id: finalId });
    } else {
      var recForRow = Object.assign({}, rec);
      recForRow[keyCol_(tab)] = finalId;
      writes.push({ rowIndex: i === undefined ? null : i, values: mergeRecordIntoRow_(headers, i === undefined ? null : state.rows[i], recForRow, stamp), id: finalId });
    }
    taken.push(finalId);
    var res = { id: id, status: newId ? 'remapped' : 'ok', updated_at: stamp };
    if (newId) res.new_id = newId;
    results.push(res);
  });
  return { results: results, writes: writes, txRows: tx };
}

function safeParse_(s) { try { return JSON.parse(s); } catch (e) { return null; } }

/* ============================================================ fungsi murni: jalur PUBLIK (katalog, pesanan customer) */

var PUBLIC_POST_OPS = { order_create: 1, order_customer_action: 1 };
var PUBLIC_CATEGORY_COLS = ['id', 'name', 'prefix', 'sort'];
var PUBLIC_BRAND_COLS = ['id', 'name', 'sort']; // tanpa distributor_id (peta pemasok tidak untuk publik)
// Daftar-putih kolom produk. Kolom lain (ref, is_active, updated_at, dan kolom biaya apa pun yang kelak ditambah) TIDAK pernah keluar.
var PUBLIC_PRODUCT_COLS = ['sku', 'slug', 'category', 'brand_id', 'name', 'price', 'price_to', 'price_from', 'price_status',
  'speed', 'type', 'note', 'handles', 'thicknesses', 'colors', 'isi', 'sizes', 'widths', 'spec', 'image'];
var LIM = { name: 80, address: 300, city: 60, note: 300, variant: 120, proof: 120, items: 20, qtyMax: 20 };
var QUOTA = { windowMs: 600000, globalMax: 30, perWaMax: 3, trackFailMax: 10, dayMax: 200 };
var CATALOG_CACHE_KEY = 'ds_catalog_v1', CATALOG_CACHE_SEC = 60;

// kosong/lainnya = true; FALSE/0/TIDAK/N/NO = false (sama dengan sync.js)
function parseBool_(v) {
  if (typeof v === 'boolean') return v;
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  return !(s === 'false' || s === '0' || s === 'tidak' || s === 'n' || s === 'no');
}
// "2.815.000", "Rp 2.815.000", "2815000,00" -> 2815000. Selain angka (mis. "abc", "12 juta") -> null. Nol/negatif -> null.
function parseMoneyStrict_(v) {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? Math.round(v) : null;
  var s = String(v === null || v === undefined ? '' : v).trim().replace(/^rp\.?\s*/i, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  s = s.replace(/[.,]\d{1,2}$/, '');
  var d = s.replace(/\D/g, '');
  if (!d) return null;
  var n = parseInt(d, 10);
  return n > 0 ? n : null;
}
function parseList_(v) {
  return String(v === null || v === undefined ? '' : v).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
}
function pick_(o, cols) { var r = {}; cols.forEach(function (c) { r[c] = o[c] === undefined ? '' : o[c]; }); return r; }
// Satu baris, tanpa karakter kontrol. null bila melebihi max (dihitung SEBELUM awalan).
// Awalan ' bila diawali = + - @ tab CR: sel tetap terbaca tapi tidak pernah jadi rumus Sheet (T1).
function cleanText_(v, max) {
  var raw = String(v === null || v === undefined ? '' : v);
  var s = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > max) return null;
  if (s !== '' && (/^[=+\-@]/.test(s) || /^[\t\r]/.test(raw))) s = "'" + s;
  return s;
}
function newKey_() { return Utilities.getUuid().replace(/-/g, ''); } // 32 hex, acak (T2)
function normWa_(s) {
  var d = String(s === null || s === undefined ? '' : s).replace(/\D/g, '');
  if (d.indexOf('62') === 0) return d;
  if (d.indexOf('0') === 0) return '62' + d.slice(1);
  if (d.indexOf('8') === 0) return '62' + d;
  return d;
}
function validWa_(s) { return /^628\d{8,12}$/.test(normWa_(s)); }

// Payload publik op=catalog dari baris mentah { categories:[obj], brands:[obj], products:[obj] }.
// Hanya brand visible, hanya produk is_active (dan bukan milik brand yang disembunyikan). Tidak ada distributors/settings/orders/PO.
function catalogPayload_(raw) {
  raw = raw || {};
  var brandsAll = raw.brands || [], hidden = {};
  var brands = brandsAll.filter(function (b) {
    var id = String(b.id === undefined ? '' : b.id).trim();
    if (!id) return false;
    if (!parseBool_(b.visible)) { hidden[id] = true; return false; }
    return true;
  }).map(function (b) { return pick_(b, PUBLIC_BRAND_COLS); });
  var products = (raw.products || []).filter(function (p) {
    return String(p.sku === undefined ? '' : p.sku).trim() !== '' && parseBool_(p.is_active) && !hidden[String(p.brand_id || '').trim()];
  }).map(function (p) { return pick_(p, PUBLIC_PRODUCT_COLS); });
  var categories = (raw.categories || []).filter(function (c) { return String(c.id === undefined ? '' : c.id).trim() !== ''; })
    .map(function (c) { return pick_(c, PUBLIC_CATEGORY_COLS); });
  return { categories: categories, brands: brands, products: products };
}

// Alasan sebuah baris produk tidak boleh dijual (kosong = layak). Cermin aturan klien (sync.js).
function productProblems_(r, brandsById, catsById) {
  var bad = [];
  if (!String(r.sku || '').trim()) bad.push('sku');
  if (!String(r.name || '').trim()) bad.push('name');
  if (parseMoneyStrict_(r.price) === null) bad.push('price');
  if (String(r.price_to || '').trim() !== '' && parseMoneyStrict_(r.price_to) === null) bad.push('price_to');
  if (!brandsById[String(r.brand_id || '').trim()]) bad.push('brand_id');
  if (!catsById[String(r.category || '').trim()]) bad.push('category');
  if (r.category === 'blade' && !parseList_(r.handles).length) bad.push('handles');
  if (r.category === 'karet') {
    if (!parseList_(r.thicknesses).length) bad.push('thicknesses');
    if (!parseList_(r.colors).length) bad.push('colors');
  }
  return bad;
}

function indexBy_(rows, key) { var m = {}; (rows || []).forEach(function (r) { var k = String(r[key] === undefined ? '' : r[key]).trim(); if (k && !m[k]) m[k] = r; }); return m; }
function settingsMap_(rows) { var m = {}; (rows || []).forEach(function (r) { var k = String(r.id || '').trim(); if (k) m[k] = r.value; }); return m; }
function err_(code, message) { return { ok: false, error: code, message: message }; }
function thk_(v) { return v === 'Max' ? 'Max' : v + 'mm'; }

// Bangun record pesanan dari input customer. HARGA SELALU dari sheet (ctx), tak pernah dari klien.
// ctx = { products:[obj], brands:[obj], categories:[obj], settings:{id:value}, stamp }
// Mengembalikan { ok:true, order } (tanpa id; server mengisinya) atau { ok:false, error, message }.
function buildOrderFromInput_(input, ctx) {
  input = input || {};
  var name = cleanText_(input.name, LIM.name), address = cleanText_(input.address, LIM.address), city = cleanText_(input.city, LIM.city), note = cleanText_(input.note, LIM.note);
  if (name === null || name === '') return err_('invalid_input', 'Nama wajib diisi (maks. 80 huruf).');
  if (!validWa_(input.wa)) return err_('invalid_input', 'Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890');
  if (address === null || address === '') return err_('invalid_input', 'Alamat wajib diisi (maks. 300 huruf).');
  if (city === null || city === '') return err_('invalid_input', 'Kota wajib diisi (maks. 60 huruf).');
  if (note === null) return err_('invalid_input', 'Catatan terlalu panjang (maks. 300 huruf).');
  var items = input.items;
  if (!Array.isArray(items) || !items.length) return err_('invalid_input', 'Keranjang kosong.');
  if (items.length > LIM.items) return err_('invalid_input', 'Maksimal ' + LIM.items + ' baris barang per pesanan.');
  var brandsById = indexBy_(ctx.brands, 'id'), catsById = indexBy_(ctx.categories, 'id'), prodBySku = indexBy_(ctx.products, 'sku');
  var feeRaw = ctx.settings ? ctx.settings.assembly_fee : '';
  var fee = feeFrom_(feeRaw); // kosong = belum ditentukan; "0" = gratis
  function sellable(sku) { // -> { row, brandName } | { error }
    var r = prodBySku[String(sku === undefined || sku === null ? '' : sku).trim()];
    // satu pesan untuk semua penyebab (tidak ada / nonaktif / brand tersembunyi / data belum lengkap): tidak membocorkan nama produk (T7)
    var NA = { error: 'Produk ' + (cleanText_(sku, 40) || '?') + ' tidak tersedia. Hapus dari keranjang lalu muat ulang halaman.' };
    if (!r) return NA;
    if (!parseBool_(r.is_active)) return NA;
    var b = brandsById[String(r.brand_id || '').trim()];
    if (b && !parseBool_(b.visible)) return NA;
    if (productProblems_(r, brandsById, catsById).length) return NA;
    return { row: r, brandName: String(b.name || b.id).trim() };
  }
  var out = [], i;
  for (i = 0; i < items.length; i++) {
    var it = items[i] || {}, qty = Number(it.qty), line = 'L' + (i + 1);
    if (!isFinite(qty) || qty !== Math.floor(qty) || qty < 1 || qty > LIM.qtyMax) return err_('invalid_input', 'Jumlah barang harus 1 sampai ' + LIM.qtyMax + '.');
    if (it.kind === 'rakitan') {
      var comp = it.components || {}, parts = {}, total = 0, k, keys = ['blade', 'fh', 'bh'];
      for (var j = 0; j < 3; j++) {
        k = keys[j];
        var c = comp[k] || {}, s = sellable(c.sku);
        if (s.error) return err_('product_unavailable', s.error);
        var want = k === 'blade' ? 'blade' : 'karet';
        if (s.row.category !== want) return err_('invalid_input', 'Komponen bet rakitan tidak sesuai (' + k + ').');
        parts[k] = { s: s, c: c };
        total += parseMoneyStrict_(s.row.price);
      }
      if (parseList_(parts.blade.s.row.handles).indexOf(String(parts.blade.c.handle)) < 0) return err_('invalid_input', 'Handle blade tidak valid.');
      ['fh', 'bh'].forEach(function (kk) { parts[kk].bad = parseList_(parts[kk].s.row.thicknesses).indexOf(String(parts[kk].c.thickness)) < 0 || parseList_(parts[kk].s.row.colors).indexOf(String(parts[kk].c.color)) < 0; });
      if (parts.fh.bad || parts.bh.bad) return err_('invalid_input', 'Ketebalan atau warna karet tidak valid.');
      var cf = parts.fh.c.color, cb = parts.bh.c.color;
      if (!(cf !== cb && (cf === 'Hitam' || cb === 'Hitam'))) return err_('invalid_input', 'Aturan ITTF: satu sisi hitam, sisi lain berwarna.');
      var comps = {};
      keys.forEach(function (kk) {
        var p = parts[kk], r = p.s.row;
        comps[kk] = { sku: r.sku, category: kk === 'blade' ? 'blade' : 'karet', name: p.s.brandName + ' ' + r.name, price: parseMoneyStrict_(r.price) };
        if (kk === 'blade') comps[kk].handle = p.c.handle; else { comps[kk].thickness = p.c.thickness; comps[kk].color = p.c.color; }
      });
      comps.assembly_fee = fee === null ? 0 : fee;
      if (fee === null) comps.assembly_note = '[?] biaya rakit belum ditentukan David';
      out.push({ line_id: line, kind: 'rakitan', sku: 'RAKIT-' + comps.blade.sku + '-' + comps.fh.sku + '-' + comps.bh.sku, category: 'bet_rakitan', brand: 'Rakitan',
        name: 'Bet Rakitan ' + parts.blade.s.row.name,
        variant: comps.blade.handle + ' · FH ' + comps.fh.color + ' ' + thk_(comps.fh.thickness) + ' · BH ' + comps.bh.color + ' ' + thk_(comps.bh.thickness),
        qty: qty, est_price: total + comps.assembly_fee, final_price: null, item_status: 'pending', distributor_id: null, components: comps });
    } else {
      var sp = sellable(it.sku);
      if (sp.error) return err_('product_unavailable', sp.error);
      var variant = cleanText_(it.variant, LIM.variant);
      if (variant === null) return err_('invalid_input', 'Varian terlalu panjang.');
      out.push({ line_id: line, kind: 'product', sku: sp.row.sku, category: sp.row.category, brand: sp.brandName, name: sp.row.name, variant: variant,
        qty: qty, est_price: parseMoneyStrict_(sp.row.price), final_price: null, item_status: 'pending', distributor_id: null, components: null });
    }
  }
  var at = ctx.stamp.slice(0, 19) + '+07:00';
  return { ok: true, order: {
    id: '', created_at: at, status: 'placed', source: 'public',
    customer: { name: name, wa: normWa_(input.wa), address: address, city: city, note: note },
    items: out, shipping_fee: null, pay_deadline: null, payment: { status: 'none' }, shipment: null,
    history: [{ at: at, status: 'placed', by: 'customer', note: 'Pesanan diajukan' }]
  } };
}

// Pesanan versi customer SAJA: tanpa cost_price, margin, distributor_id, PO, catatan internal.
function customerView_(order, settings) {
  var o = order || {}, c = o.customer || {}, p = o.payment || { status: 'none' }, sh = o.shipment;
  var view = {
    id: o.id, created_at: o.created_at, updated_at: o.updated_at, status: o.status,
    customer: { name: c.name, wa: c.wa, city: c.city },
    items: (o.items || []).map(function (it) {
      var r = { line_id: it.line_id, kind: it.kind, sku: it.sku, brand: it.brand, name: it.name, variant: it.variant, qty: it.qty,
        est_price: it.est_price, final_price: it.final_price === undefined ? null : it.final_price, item_status: it.item_status };
      if (it.alternative && typeof it.alternative === 'object') r.alternative = { name: it.alternative.name, variant: it.alternative.variant, price: it.alternative.price };
      return r;
    }),
    shipping_fee: o.shipping_fee === undefined ? null : o.shipping_fee, pay_deadline: o.pay_deadline === undefined ? null : o.pay_deadline,
    payment: { status: p.status, proof_name: p.proof_name, amount: p.amount, reject_reason: p.reject_reason, has_file: !!p.proof_file_id, uploaded_at: p.uploaded_at },
    shipment: sh ? { courier: sh.courier, resi: sh.resi } : null,
    history: (o.history || []).map(function (h) {
      var r = { at: h.at, status: h.status };
      if (h.by === 'customer' || h.status === 'cancelled' || h.status === 'expired') r.note = h.note;
      return r;
    })
  };
  if (o.status === 'quoted' && settings) view.bank = { bank: settings.bank_name || '[?]', no: settings.bank_no || '[?]', name: settings.bank_holder || '[?]' };
  return JSON.parse(JSON.stringify(view)); // buang undefined
}

var PROOF = { folder: 'DStore — Bukti Transfer', imgMax: 1024 * 1024, pdfMax: 5 * 1024 * 1024, maxUploads: 3, b64Max: 7200000 };
// Cek isi berkas dari byte pertama (mime kiriman klien DIABAIKAN). bytes = array (boleh bertanda, gaya Apps Script).
function checkProofBytes_(bytes) {
  var n = bytes ? bytes.length : 0;
  function b(i) { return bytes[i] & 255; }
  if (n < 8) return err_('invalid_input', 'Berkas kosong atau rusak.');
  var mime = null, ext = null;
  if (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) { mime = 'image/jpeg'; ext = 'jpg'; }
  else if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47 && b(4) === 0x0D && b(5) === 0x0A && b(6) === 0x1A && b(7) === 0x0A) { mime = 'image/png'; ext = 'png'; }
  else if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46 && b(4) === 0x2D) { mime = 'application/pdf'; ext = 'pdf'; }
  if (!mime) return err_('invalid_input', 'Format berkas harus JPG, PNG, atau PDF.');
  if (mime === 'application/pdf' ? n > PROOF.pdfMax : n > PROOF.imgMax) return err_('invalid_input', 'Berkas terlalu besar (foto maks. 1 MB setelah dikecilkan, PDF maks. 5 MB).');
  return { ok: true, mime: mime, ext: ext, size: n };
}

var DECISIONS = { alternative_offered: ['accepted', 'declined'], available: ['declined'], accepted: ['declined'], declined: ['available'] };
var DECISION_LABEL = { accepted: 'diterima', declined: 'ditolak', available: 'penolakan dibatalkan' };

// Terapkan SATU aksi customer yang sah. Whitelist: item_decision, cancel, payment_proof. Tidak menyentuh harga/status lain.
// nowMs untuk uji. Mengembalikan { ok:true, order } atau { ok:false, error, message }.
function applyCustomerAction_(order, req, stamp, nowMs, file) {
  var o = JSON.parse(JSON.stringify(order)), pay = o.payment || { status: 'none' };
  var locked = pay.status === 'pending_verification' || pay.status === 'verified';
  var at = stamp.slice(0, 19) + '+07:00';
  req = req || {};
  if (!o.history) o.history = [];
  if (req.action === 'item_decision') {
    if (o.status !== 'quoted') return err_('not_allowed', 'Pilihan barang hanya bisa diubah saat harga final menunggu persetujuan.');
    if (locked) return err_('not_allowed', 'Bukti transfer sudah dikirim. Hubungi David bila perlu mengubah pesanan.');
    var it = (o.items || []).filter(function (x) { return x.line_id === req.line_id; })[0];
    if (!it) return err_('invalid_input', 'Barang tidak ditemukan di pesanan.');
    if ((DECISIONS[it.item_status] || []).indexOf(req.decision) < 0) return err_('not_allowed', 'Perubahan itu tidak diperbolehkan untuk barang ini.');
    it.item_status = req.decision;
    o.history.push({ at: at, status: o.status, by: 'customer', note: 'Barang ' + it.line_id + ' ' + DECISION_LABEL[req.decision] });
  } else if (req.action === 'cancel') {
    if (['placed', 'sourcing', 'quoted'].indexOf(o.status) < 0) return err_('not_allowed', 'Pesanan pada tahap ini tidak bisa dibatalkan sendiri. Hubungi David.');
    if (locked) return err_('not_allowed', 'Bukti transfer sudah dikirim. Hubungi David untuk pembatalan.');
    o.status = 'cancelled';
    o.history.push({ at: at, status: 'cancelled', by: 'customer', note: 'Dibatalkan oleh customer' });
  } else if (req.action === 'payment_proof') {
    if (o.status !== 'quoted') return err_('not_allowed', 'Bukti bayar hanya diterima setelah harga final dikirim.');
    if (pay.status === 'verified') return err_('not_allowed', 'Pembayaran sudah terverifikasi.');
    if (o.pay_deadline && (nowMs === undefined ? Date.now() : nowMs) > Date.parse(o.pay_deadline)) return err_('not_allowed', 'Batas bayar sudah lewat. Hubungi David.');
    var amt = Number(req.amount);
    if (!isFinite(amt) || amt !== Math.floor(amt) || amt <= 0 || amt > 1e10) return err_('invalid_input', 'Nominal harus bilangan bulat lebih dari 0.');
    var used = o.history.filter(function (h) { return h && h.proof_upload; }).length;
    if (used >= PROOF.maxUploads) return err_('not_allowed', 'Batas ' + PROOF.maxUploads + ' unggahan bukti per pesanan sudah tercapai. Hubungi David.');
    if (!file || !file.file_id) return err_('invalid_input', 'Foto atau PDF bukti transfer wajib dilampirkan.');
    var pn = cleanText_(String(req.proof_name || '').replace(/^.*[\\\/]/, ''), LIM.proof) || ('bukti.' + file.ext);
    o.payment = { status: 'pending_verification', proof_file_id: file.file_id, proof_mime: file.mime, proof_name: pn, amount: amt, uploaded_at: at, at: at }; // lama tetap tercatat di history
    o.history.push({ at: at, status: o.status, by: 'customer', note: 'Bukti bayar diunggah: ' + pn + (used ? ' (pengganti, unggahan ke-' + (used + 1) + ')' : ''), proof_upload: true, file_id: file.file_id });
  } else {
    return err_('invalid_input', 'Aksi tidak dikenal.');
  }
  return { ok: true, order: o };
}

// Kuota jendela tetap. entry = { n, t0 } atau null. Mengembalikan { ok, entry (baru bila ok) }.
function quotaStep_(entry, nowMs, max, windowMs) {
  var e = entry && nowMs - entry.t0 < windowMs ? { n: entry.n, t0: entry.t0 } : { n: 0, t0: nowMs };
  if (e.n >= max) return { ok: false, entry: e };
  e.n++;
  return { ok: true, entry: e };
}

/* ============================================================ jembatan ke Google (tidak diuji di luar Google) */

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function token_() { return PropertiesService.getScriptProperties().getProperty('DS_TOKEN'); }
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(tab, create) {
  var sh = ss_().getSheetByName(tab);
  if (!sh && create) sh = ss_().insertSheet(tab);
  return sh;
}
function dataRows_(tab) {
  var sh = sheet_(tab, false);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HEADERS[tab].length).getDisplayValues();
}
function counts_() {
  var c = {};
  Object.keys(HEADERS).forEach(function (t) {
    var sh = sheet_(t, false);
    c[t] = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
  });
  return c;
}

// ---- jalur publik (tanpa token). Semua keluaran lewat daftar-putih di atas. ----
function cache_() { try { return CacheService.getScriptCache(); } catch (e) { return null; } }
function cacheGet_(k) { var c = cache_(); if (!c) return null; try { var v = c.get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function cachePut_(k, v, sec) { var c = cache_(); if (!c) return; try { c.put(k, JSON.stringify(v), sec); } catch (e) { /* terlalu besar / kuota: lewati */ } }
function rawObjs_(tab) {
  var h = HEADERS[tab], kc = h.indexOf(keyCol_(tab));
  return dataRows_(tab).filter(function (r) { return String(r[kc]).trim() !== ''; }).map(function (r) { return rowToObj_(h, r); });
}

// biaya rakit dari settings: integer >= 0, atau null bila kosong/tidak terbaca ("0" = gratis)
function feeFrom_(raw) {
  var s = String(raw === undefined || raw === null ? '' : raw).trim();
  if (s === '') return null;
  var n = parseMoneyStrict_(s);
  return n !== null ? n : (/^0+$/.test(s) ? 0 : null);
}
// HANYA kunci ini dari settings yang boleh dibaca publik. Rekening/margin/dll. tidak pernah.
function publicStore_(st) {
  function t(v) { return String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200); }
  return { address: t(st.address), david_wa: t(st.david_wa), store_hours: t(st.store_hours) };
}
function opCatalog_() {
  var hit = cacheGet_(CATALOG_CACHE_KEY);
  if (hit) return hit;
  var payload = { ok: true, server_time: formatStamp_(new Date()), assembly_fee: feeFrom_(settingsNow_().assembly_fee), store: publicStore_(settingsNow_()), // daftar-putih kunci settings publik: assembly_fee, address, david_wa, store_hours
    tabs: catalogPayload_({ categories: rawObjs_('categories'), brands: rawObjs_('brands'), products: rawObjs_('products') }) };
  cachePut_(CATALOG_CACHE_KEY, payload, CATALOG_CACHE_SEC);
  return payload;
}

// Cari satu pesanan tanpa membaca seluruh kolom json: baca kolom id dulu.
function findOrderRow_(id) {
  var sh = sheet_('orders', false);
  if (!sh) return null;
  var last = sh.getLastRow();
  if (last < 2) return null;
  var want = String(id || '').trim().toUpperCase(), ids = sh.getRange(2, 1, last - 1, 1).getDisplayValues(), h = HEADERS.orders;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim().toUpperCase() === want && want) {
      var row = sh.getRange(i + 2, 1, 1, h.length).getDisplayValues()[0];
      var order = safeParse_(row[h.indexOf('json')]);
      if (order) { order.id = row[0]; order.updated_at = row[h.indexOf('updated_at')]; }
      return { index: i, order: order, updated_at: row[h.indexOf('updated_at')] };
    }
  }
  return null;
}
function takenOrderIds_() {
  var sh = sheet_('orders', false);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().map(function (r) { return r[0]; });
}
var NOT_FOUND_MSG = 'Pesanan tidak ditemukan. Periksa nomor pesanan dan nomor WhatsApp yang Anda pakai saat memesan.';
// id salah dan wa salah menghasilkan jawaban yang SAMA. Percobaan gagal per id dibatasi (id yang tidak ada ikut dihitung).
function authOrder_(id, wa, key) {
  var k = 'trk:' + String(id || '').trim().toUpperCase().slice(0, 40), now = Date.now(), cur = cacheGet_(k);
  var f = findOrderRow_(id);
  // id + wa + track_key harus cocok. Pesanan tanpa track_key tidak bisa dibuka lewat jalur publik.
  var tk = f && f.order && f.order.track_key;
  if (tk && typeof key === 'string' && validWa_(wa) && normWa_(f.order.customer && f.order.customer.wa) === normWa_(wa) && checkToken_(key, String(tk))) return { ok: true, found: f };
  var locked = cur && now - cur.t0 < QUOTA.windowMs && cur.n >= QUOTA.trackFailMax;
  if (locked) return err_('rate_limited', 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
  var q = quotaStep_(cur, now, QUOTA.trackFailMax + 1, QUOTA.windowMs);
  cachePut_(k, q.entry, Math.ceil(QUOTA.windowMs / 1000));
  return err_('not_found', NOT_FOUND_MSG);
}
function settingsNow_() { return settingsMap_(rawObjs_('settings')); }

function opOrderTrack_(p) {
  var a = authOrder_(p.id, p.wa, p.k);
  if (!a.ok) return a;
  return { ok: true, order: customerView_(a.found.order, settingsNow_()) };
}

// peringatan batas ke pemilik script, maks 1x per hari (T3). Alamat diambil dari akun pemasang, tidak ditulis di kode.
function alertLimit_(kind, ymd) {
  var key = 'mail:' + ymd;
  if (cacheGet_(key)) return;
  cachePut_(key, { kind: kind }, 86400);
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'DavidStore: batas pesanan tercapai (' + kind + ')',
      'Toko menolak pesanan baru karena batas ' + kind + ' tercapai. Bila ini bukan lonjakan pembeli asli, periksa tab orders di Google Sheet (kemungkinan spam). Email ini dikirim maksimal sekali per hari.');
  } catch (e) { console.error('alertLimit_ gagal: ' + e); }
}

function appendOrderRows_(tx) { // pesanan BARU: tambah baris saja, tab order_items tidak ditulis ulang (T3)
  var sh = sheet_('orders', false), ish = sheet_('order_items', false);
  put_(sh, sh.getLastRow() + 1, HEADERS.orders.length, [tx.main]);
  if (tx.items.length) put_(ish, ish.getLastRow() + 1, HEADERS.order_items.length, tx.items);
}

function opOrderCreate_(body) {
  if (String(body.hp || '').trim() !== '') return err_('rejected', 'Permintaan ditolak.'); // honeypot
  var ref = /^[A-Za-z0-9_-]{8,64}$/.test(String(body.client_ref || '')) ? 'ref:' + body.client_ref : null;
  if (ref) { // kirim ulang (jaringan putus setelah server menulis): jawab pesanan yang sama, jangan menggandakan. WA harus cocok (T6)
    var dup = cacheGet_(ref), f0 = dup && findOrderRow_(dup.id);
    if (f0 && f0.order && f0.order.customer && validWa_(body.wa) && normWa_(f0.order.customer.wa) === normWa_(body.wa) && f0.order.track_key) {
      return { ok: true, id: f0.order.id, wa: f0.order.customer.wa, track_key: f0.order.track_key, order: customerView_(f0.order, null), duplicate: true };
    }
  }
  if (!sheet_('orders', false)) setupSheet();
  var stamp = formatStamp_(new Date());
  var built = buildOrderFromInput_(body, { products: rawObjs_('products'), brands: rawObjs_('brands'), categories: rawObjs_('categories'), settings: settingsNow_(), stamp: stamp });
  if (!built.ok) return built;
  var wa = built.order.customer.wa, now = Date.now(), ymd = stamp.slice(0, 10).replace(/-/g, '');
  var day = cacheGet_('q:day:' + ymd) || { n: 0 };
  if (day.n >= QUOTA.dayMax) { alertLimit_('harian', ymd); return err_('rate_limited', 'Toko sedang membatasi pesanan hari ini. Coba lagi besok atau hubungi David.'); }
  var g = quotaStep_(cacheGet_('q:all'), now, QUOTA.globalMax, QUOTA.windowMs);
  var w = quotaStep_(cacheGet_('q:wa:' + wa), now, QUOTA.perWaMax, QUOTA.windowMs);
  if (!g.ok) alertLimit_('10 menit', ymd);
  if (!g.ok || !w.ok) return err_('rate_limited', 'Terlalu banyak pesanan dalam waktu singkat. Coba lagi beberapa menit lagi.');
  var id = nextFreeId_('DS-' + ymd + '-0001', takenOrderIds_());
  built.order.id = id;
  built.order.track_key = newKey_(); // rahasia tautan Lacak; hanya di json, tidak di kolom ringkasan
  var tx = buildTxRows_('orders', built.order, stamp);
  appendOrderRows_(tx);
  var sec = Math.ceil(QUOTA.windowMs / 1000);
  cachePut_('q:all', g.entry, sec); cachePut_('q:wa:' + wa, w.entry, sec); cachePut_('q:day:' + ymd, { n: day.n + 1 }, 86400);
  if (ref) cachePut_(ref, { id: id }, sec);
  return { ok: true, id: id, wa: wa, track_key: built.order.track_key, order: customerView_(tx.record, null) };
}

function proofFolder_() {
  var it = DriveApp.getFoldersByName(PROOF.folder);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PROOF.folder); // PRIVAT: tidak ada setSharing
}
function opOrderAction_(body) {
  var a = authOrder_(body.id, body.wa, body.k);
  if (!a.ok) return a;
  var f = a.found, stamp = monotonicStamp_(formatStamp_(new Date()), f.updated_at), file = null;
  if (body.action === 'payment_proof') {
    // 1) cek aturan (status, batas unggahan, nominal) SEBELUM menyimpan berkas, supaya tidak ada berkas yatim
    var pre = applyCustomerAction_(f.order, body, stamp, undefined, { file_id: 'cek', ext: 'jpg', mime: 'image/jpeg' });
    if (!pre.ok) return pre;
    var b64 = String(body.file_b64 || '');
    if (!b64) return err_('invalid_input', 'Foto atau PDF bukti transfer wajib dilampirkan.');
    if (b64.length > PROOF.b64Max) return err_('invalid_input', 'Berkas terlalu besar.');
    var bytes;
    try { bytes = Utilities.base64Decode(b64); } catch (e) { return err_('invalid_input', 'Berkas rusak.'); }
    var chk = checkProofBytes_(bytes);
    if (!chk.ok) return chk;
    var name = f.order.id + '-' + stamp.slice(0, 19).replace(/[-:]/g, '') + '.' + chk.ext;
    var saved = proofFolder_().createFile(Utilities.newBlob(bytes, chk.mime, name));
    file = { file_id: saved.getId(), ext: chk.ext, mime: chk.mime };
  }
  var r = applyCustomerAction_(f.order, body, stamp, undefined, file);
  if (!r.ok) return r;
  var tx = buildTxRows_('orders', r.order, stamp), id = f.order.id;
  writeTx_('orders', { writes: [{ rowIndex: f.index, values: tx.main, id: id }], txRows: (function () { var m = {}; m[id] = tx; return m; })() });
  return { ok: true, order: customerView_(tx.record, settingsNow_()) };
}
// ADMIN (token): isi bukti dari Drive. Tidak ada jalur publik.
function opProofGet_(p) {
  var f = findOrderRow_(p.id);
  if (!f || !f.order) return { ok: false, error: 'not_found', message: 'Pesanan tidak ditemukan.' };
  var pay = f.order.payment || {};
  if (!pay.proof_file_id) return { ok: false, error: 'no_file', message: 'Belum ada berkas bukti (hanya nama berkas).' };
  try {
    var bytes = DriveApp.getFileById(pay.proof_file_id).getBlob().getBytes();
    var chk = checkProofBytes_(bytes); // mime ditentukan ulang dari isi berkas, bukan dari json
    if (!chk.ok) return { ok: false, error: 'bad_file', message: 'Isi berkas bukan JPG/PNG/PDF yang sah.' };
    return { ok: true, mime: chk.mime, name: pay.proof_name, uploaded_at: pay.uploaded_at, base64: Utilities.base64Encode(bytes) };
  } catch (e) { return { ok: false, error: 'drive_error', message: 'Berkas tidak bisa dibuka dari Drive.' }; }
}

function opPing_() { return { ok: true, sheet: ss_().getName(), counts: counts_(), server_time: formatStamp_(new Date()) }; }
function opPull_() {
  var now = formatStamp_(new Date()), tabs = {};
  MASTER_TABS.forEach(function (t) {
    var h = HEADERS[t], kc = h.indexOf(keyCol_(t)), nc = h.indexOf('name');
    tabs[t] = dataRows_(t).filter(function (r) { return String(r[kc]).trim() !== '' || (t === 'products' && String(r[nc]).trim() !== ''); }).map(function (r) {
      var o = rowToObj_(h, r);
      if (t === 'products') o.id = o.sku;
      return o;
    });
  });
  TX_TABS.forEach(function (t) {
    var h = HEADERS[t], ic = h.indexOf('id'), uc = h.indexOf('updated_at'), jc = h.indexOf('json');
    tabs[t] = dataRows_(t).filter(function (r) { return String(r[ic]).trim() !== ''; }).map(function (r) {
      return { id: r[ic], updated_at: r[uc], json: r[jc] };
    });
  });
  return { ok: true, server_time: now, tabs: tabs };
}
// ADMIN: buat track_key untuk pesanan lama yang belum punya (dipakai Dashboard saat mengirim harga final). Tidak menimpa key yang ada.
function opTrackKeyEnsure_(body) {
  var f = findOrderRow_(body.id);
  if (!f || !f.order) return { ok: false, error: 'not_found', message: 'Pesanan tidak ditemukan.' };
  if (f.order.track_key) return { ok: true, track_key: f.order.track_key, created: false };
  var stamp = monotonicStamp_(formatStamp_(new Date()), f.updated_at), rec = f.order;
  rec.track_key = newKey_();
  var tx = buildTxRows_('orders', rec, stamp), id = rec.id;
  writeTx_('orders', { writes: [{ rowIndex: f.index, values: tx.main, id: id }], txRows: (function () { var m = {}; m[id] = tx; return m; })() });
  return { ok: true, track_key: rec.track_key, created: true, updated_at: stamp };
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.op === 'catalog') return out_(opCatalog_()); // PUBLIK, tanpa token, hanya baca
  if (p.op === 'order_track') return out_(opOrderTrack_(p)); // PUBLIK: id + wa harus cocok
  // ping/pull/proof_get/dll. (admin) HANYA lewat POST dengan token di badan; GET tidak pernah memakai token (T5).
  return out_({ ok: false, error: 'unauthorized' });
}

function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || ''); } catch (err) { return out_({ ok: false, error: 'bad_json' }); }
  if (!body || typeof body !== 'object') return out_({ ok: false, error: 'bad_json' });
  var isPublic = Object.prototype.hasOwnProperty.call(PUBLIC_POST_OPS, body.op);
  if (!isPublic && !checkToken_(body.token, token_())) return out_({ ok: false, error: 'unauthorized' });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return out_(isPublic ? err_('busy', 'Server sedang sibuk. Coba lagi sebentar.') : { ok: false, error: 'busy' }); }
  try {
    if (body.op === 'order_create') return out_(opOrderCreate_(body));
    if (body.op === 'order_customer_action') return out_(opOrderAction_(body));
    if (body.op === 'ping') return out_(opPing_());
    if (body.op === 'pull') return out_(opPull_());
    if (body.op === 'proof_get') return out_(opProofGet_(body));
    if (body.op === 'track_key_ensure') return out_(opTrackKeyEnsure_(body));
    if (body.op === 'upsert') return out_(opUpsert_(body));
    if (body.op === 'setup') return out_(opSetup_());
    return out_({ ok: false, error: 'unknown_op' });
  } catch (err) {
    console.error('doPost ' + body.op + ': ' + String(err && err.message)); // log di server saja
    return out_(isPublic ? err_('server_error', 'Terjadi gangguan di server. Coba lagi sebentar.') : { ok: false, error: 'server_error: ' + String(err && err.message) });
  } finally {
    lock.releaseLock();
  }
}

// Tulis nilai ke sheet sebagai teks biasa; menambah baris bila perlu
function put_(sh, row, n, values) {
  var need = row + values.length - 1;
  if (sh.getMaxRows() < need) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
  var rg = sh.getRange(row, 1, values.length, n);
  rg.setNumberFormat('@');
  rg.setValues(values);
}

function writeTx_(tab, plan) {
  var sh = sheet_(tab, false), h = HEADERS[tab], n = h.length;
  var appendRows = [];
  plan.writes.forEach(function (w) {
    if (w.rowIndex === null || w.rowIndex === undefined || w.rowIndex < 0) appendRows.push(w.values);
    else put_(sh, w.rowIndex + 2, n, [w.values]);
  });
  if (appendRows.length) put_(sh, sh.getLastRow() + 1, n, appendRows);
  // tab turunan
  var itemTab = tab === 'orders' ? 'order_items' : 'po_items', ih = HEADERS[itemTab], isheet = sheet_(itemTab, false);
  var ids = Object.keys(plan.txRows), newItems = [];
  ids.forEach(function (id) { newItems = newItems.concat(plan.txRows[id].items); });
  // id lama (sebelum remap) tidak punya baris turunan, jadi cukup buang berdasarkan id akhir
  var existing = dataRows_(itemTab);
  var idx = ih.indexOf(tab === 'orders' ? 'order_id' : 'po_id');
  var merged = mergeDerived_(existing, idx, ids, newItems);
  if (isheet.getLastRow() > 1) isheet.getRange(2, 1, isheet.getLastRow() - 1, ih.length).clearContent();
  if (merged.length) put_(isheet, 2, ih.length, merged);
}

function writeMaster_(tab, plan) {
  var sh = sheet_(tab, false), n = HEADERS[tab].length, appendRows = [];
  plan.writes.forEach(function (w) {
    if (w.rowIndex === null || w.rowIndex === undefined || w.rowIndex < 0) appendRows.push(w.values);
    else put_(sh, w.rowIndex + 2, n, [w.values]);
  });
  if (appendRows.length) put_(sh, sh.getLastRow() + 1, n, appendRows);
}

function opUpsert_(body) {
  var tab = body.tab;
  if (!HEADERS[tab] || DERIVED_TABS.indexOf(tab) >= 0) return { ok: true, results: (body.rows || []).map(function (r) { return { id: r && r.id, status: 'invalid', reason: 'unknown_tab' }; }) };
  if (!sheet_(tab, false)) setupSheet(); // tab dibuat otomatis bila belum ada
  var plan = planUpsert_(tab, { rows: dataRows_(tab) }, body.rows || [], formatStamp_(new Date()));
  if (TX_TABS.indexOf(tab) >= 0) writeTx_(tab, plan); else writeMaster_(tab, plan);
  if (MASTER_TABS.indexOf(tab) >= 0) { var cc = cache_(); if (cc) { try { cc.remove(CATALOG_CACHE_KEY); } catch (e) { /* abaikan */ } } } // Pengaturan/produk berubah: katalog publik langsung segar
  return { ok: true, results: plan.results };
}

// Hanya membuat tab + header (idempoten, tidak menimpa). Tidak lagi mengisi data contoh.
function opSetup_() {
  setupSheet();
  return { ok: true, counts: counts_() };
}

/* ============================================================ pemasangan */

// Dipanggil otomatis oleh seed; boleh juga dijalankan manual dari editor (Run). Tidak pernah menimpa isi: kalau baris 1 sudah ada dan beda, berhenti dengan pesan.
function setupSheet() {
  var problems = [];
  Object.keys(HEADERS).forEach(function (tab) {
    var h = HEADERS[tab], sh = sheet_(tab, true), first = sh.getRange(1, 1, 1, h.length).getValues()[0];
    var empty = first.every(function (v) { return String(v) === ''; });
    if (empty) {
      sh.getRange(1, 1, sh.getMaxRows(), h.length).setNumberFormat('@'); // Plain text: angka tidak berubah diam-diam
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
      sh.setFrozenRows(1);
      if (DERIVED_TABS.indexOf(tab) >= 0) {
        sh.getRange(1, 1, 1, h.length).setBackground('#d9d9d9').setNote('Diisi otomatis. Edit di Dashboard.');
      } else if (TX_TABS.indexOf(tab) >= 0) {
        sh.getRange(1, 1, 1, h.length).setBackground('#d9d9d9').setNote('Kolom ringkasan diturunkan dari kolom json. Edit di Dashboard; edit di sini ditimpa.');
      }
    } else if (first.join('|') !== h.join('|')) {
      problems.push(tab);
    }
  });
  // buang tab bawaan "Sheet1" hanya bila benar-benar kosong
  var ss = ss_(), d = ss.getSheetByName('Sheet1');
  if (d && d.getLastRow() === 0 && d.getLastColumn() === 0 && ss.getSheets().length > 1) ss.deleteSheet(d);
  if (problems.length) {
    throw new Error('Baris 1 tab ini sudah berisi header lain, tidak diubah: ' + problems.join(', ') + '. Ganti nama/hapus tabnya manual lalu jalankan lagi.');
  }
  return 'setupSheet selesai';
}

// SEKALI dari editor Apps Script (Run). MENGHAPUS isi baris data brands, products, categories (header tetap).
// distributors: tersisa 5 baris nama (data asli dari Kevin), kolom wa dikosongkan. Pesanan/PO tidak disentuh.
// Penjaga: menolak dijalankan kedua kali supaya data asli David tidak terhapus tak sengaja.
function resetMasterTabs() {
  var props = PropertiesService.getScriptProperties(), done = props.getProperty('DS_MASTER_RESET_DONE');
  if (done) throw new Error('resetMasterTabs sudah dijalankan pada ' + done + '. Menjalankannya lagi MENGHAPUS isi brands/products/categories. ' +
    'Bila benar-benar ingin, hapus properti DS_MASTER_RESET_DONE di Project Settings > Script Properties.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupSheet();
    var report = [], stamp = formatStamp_(new Date());
    ['brands', 'products', 'categories'].forEach(function (tab) {
      var sh = sheet_(tab, false), n = Math.max(0, sh.getLastRow() - 1);
      if (n > 0) sh.getRange(2, 1, n, HEADERS[tab].length).clearContent();
      report.push(tab + ': ' + n + ' baris dikosongkan');
    });
    var dsh = sheet_('distributors', false), dn = Math.max(0, dsh.getLastRow() - 1);
    if (dn > 0) dsh.getRange(2, 1, dn, HEADERS.distributors.length).clearContent();
    var names = ['Daya Prima', 'Donic', 'Andro', 'Stiga', 'Sinar Surya'];
    put_(dsh, 2, HEADERS.distributors.length, names.map(function (nm) { return [nm.toLowerCase().replace(/[^a-z0-9]+/g, '-'), nm, '', '', stamp]; }));
    report.push('distributors: ' + dn + ' baris diganti 5 nama, wa dikosongkan');
    // biaya rakit CONTOH dari seed lama (bukan data David) dihapus; nilai yang diisi David (tanpa tanda CONTOH) dibiarkan
    var ssh = sheet_('settings', false), sh2 = HEADERS.settings;
    if (ssh && ssh.getLastRow() > 1) {
      var srows = ssh.getRange(2, 1, ssh.getLastRow() - 1, sh2.length).getDisplayValues();
      srows.forEach(function (r, i) {
        if (r[0] === 'assembly_fee' && /^CONTOH/i.test(r[2])) { ssh.getRange(i + 2, 1, 1, sh2.length).clearContent(); report.push('settings: baris assembly_fee CONTOH dihapus'); }
      });
    }
    var c = cache_(); if (c) { try { c.remove(CATALOG_CACHE_KEY); } catch (e) { /* abaikan */ } }
    props.setProperty('DS_MASTER_RESET_DONE', stamp);
    var text = 'resetMasterTabs selesai. ' + report.join(' | ');
    if (typeof Logger !== 'undefined') Logger.log(text);
    return text;
  } finally {
    lock.releaseLock();
  }
}

// Simple trigger: edit manual David di tab master -> cap updated_at (sheet versi baru, klien akan tahu saat pull)
function onEdit(e) {
  try {
    var r = e && e.range;
    if (!r) return;
    var sh = r.getSheet(), tab = sh.getName();
    if (MASTER_TABS.indexOf(tab) < 0) return;
    var uc = HEADERS[tab].indexOf('updated_at') + 1, stamp = formatStamp_(new Date());
    for (var row = r.getRow(); row < r.getRow() + r.getNumRows(); row++) {
      if (row < 2) continue;
      if (r.getColumn() === uc && r.getNumColumns() === 1) continue; // yang diedit kolom updated_at itu sendiri
      sh.getRange(row, uc).setValue(stamp);
    }
  } catch (err) { /* simple trigger tidak boleh melempar */ }
}
