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
 * Kontrak:
 *   GET  ?op=ping&token=T   -> { ok, sheet, counts, server_time }
 *   GET  ?op=pull&token=T   -> { ok, server_time, tabs:{ <tab>:[baris] } }
 *   POST (text/plain, JSON) { token, op:"upsert", tab, rows:[{id, base_updated_at, record}] }
 *                           -> { ok, results:[{id, status, updated_at, new_id?, server_record?, reason?}] }
 *   POST (text/plain, JSON) { token, op:"seed", tabs:{ <tab>:[{id, record}] } }  (ditolak bila sheet berisi)
 * Token salah -> { ok:false, error:"unauthorized" } (HTTP tetap 200).
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

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!checkToken_(p.token, token_())) return out_({ ok: false, error: 'unauthorized' });
  var now = formatStamp_(new Date());
  if (p.op === 'ping') return out_({ ok: true, sheet: ss_().getName(), counts: counts_(), server_time: now });
  if (p.op === 'pull') {
    var tabs = {};
    MASTER_TABS.forEach(function (t) {
      var h = HEADERS[t], kc = h.indexOf(keyCol_(t));
      tabs[t] = dataRows_(t).filter(function (r) { return String(r[kc]).trim() !== ''; }).map(function (r) {
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
    return out_({ ok: true, server_time: now, tabs: tabs });
  }
  return out_({ ok: false, error: 'unknown_op' });
}

function doPost(e) {
  var body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || ''); } catch (err) { return out_({ ok: false, error: 'bad_json' }); }
  if (!body || !checkToken_(body.token, token_())) return out_({ ok: false, error: 'unauthorized' });
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return out_({ ok: false, error: 'busy' }); }
  try {
    if (body.op === 'upsert') return out_(opUpsert_(body));
    if (body.op === 'seed') return out_(opSeed_(body));
    return out_({ ok: false, error: 'unknown_op' });
  } catch (err) {
    return out_({ ok: false, error: 'server_error: ' + String(err && err.message) });
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
  return { ok: true, results: plan.results };
}

function opSeed_(body) {
  var tabs = body.tabs || {}, stamp = formatStamp_(new Date());
  if (dataRows_('products').length > 0 || dataRows_('orders').length > 0) return { ok: false, error: 'sheet_not_empty' };
  setupSheet(); // seed membuat semua tab sendiri (dan membuang "Sheet1" kosong); tidak menimpa header yang sudah ada
  var done = {}, bad = [];
  // validasi dulu semuanya: tidak menulis separuh
  Object.keys(tabs).forEach(function (t) {
    (tabs[t] || []).forEach(function (r) { var why = validateRow_(t, r); if (why) bad.push(t + ':' + (r && r.id) + ':' + why); });
  });
  if (bad.length) return { ok: false, error: 'invalid_rows: ' + bad.slice(0, 5).join(', ') };
  Object.keys(tabs).forEach(function (t) {
    var rows = (tabs[t] || []).map(function (r) { return { id: r.id, base_updated_at: null, record: r.record }; });
    var plan = planUpsert_(t, { rows: [] }, rows, stamp);
    if (TX_TABS.indexOf(t) >= 0) writeTx_(t, plan); else writeMaster_(t, plan);
    done[t] = plan.results.filter(function (r) { return r.status === 'ok'; }).length;
  });
  return { ok: true, counts: done };
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
