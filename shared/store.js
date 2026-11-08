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

  var DISTRIBUTORS = [
    { id: 'daya-prima', name: 'Daya Prima', wa: '6280000000001', note: '' },
    { id: 'donic', name: 'Donic', wa: '6280000000002', note: '' },
    { id: 'andro', name: 'Andro', wa: '6280000000003', note: '' },
    { id: 'stiga', name: 'Stiga', wa: '6280000000004', note: '' },
    { id: 'sinar-surya', name: 'Sinar Surya', wa: '6280000000005', note: '' }
  ];

  var CATEGORIES = [
    ['blade', 'Blade'], ['karet', 'Karet'], ['bet_rakitan', 'Bet rakitan (komponen)'], ['bet_jadi', 'Bet jadi'],
    ['bola', 'Bola'], ['meja', 'Meja'], ['net', 'Net & tiang'], ['tas', 'Tas & cover'], ['sepatu', 'Sepatu'],
    ['apparel', 'Apparel'], ['aksesoris', 'Aksesoris'], ['alat_latihan', 'Alat latihan'], ['lainnya', 'Lainnya']
  ];

  function defaultSettings() {
    return {
      address: 'Toko David (CONTOH) — Jl. Contoh Raya No. 12, Jakarta Barat 11000',
      david_wa: '6280000000000',
      bank: { bank: 'BCA (CONTOH)', no: '0000000000', name: 'David (CONTOH)' },
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
      // mode sheet: daftar distributor dari tab `distributors` (lewat katalog hasil pull)
      if (DS._mode() === 'sheet' && cat && Array.isArray(cat.distributors) && cat.distributors.length) base = cat.distributors;
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
    buildDemoData: function () { return buildDemo(); },

    // ---------- seed demo ----------
    seedIfEmpty: function () {
      if (DS._mode() === 'sheet') return false; // mode sheet: sheet adalah kebenaran, jangan tertimpa data demo
      if (DS.getOrders().length === 0) { seedDemo(); return true; }
      return false;
    },
    resetDemo: function () {
      if (DS._mode() === 'sheet') return false;
      remove(K_ORD); remove(K_PO);
      seedDemo();
      return true;
    },
    clearAll: function () { remove(K_ORD); remove(K_PO); remove(K_SET); }
  };

  function seedDemo() {
    var d = buildDemo();
    DS.saveOrders(d.orders);
    DS.savePOs(d.pos);
  }

  // Membangun data contoh tanpa menyimpannya (dipakai juga untuk mengisi Google Sheet).
  function buildDemo() {
    var NOW = Date.now();
    var HR = 3600e3;
    function ago(h) { return isoWIB(NOW - h * HR); }
    function ahead(h) { return isoWIB(NOW + h * HR); }
    function oid(daysAgo, n) { return 'DS-' + ymdWIB(NOW - daysAgo * 24 * HR) + '-' + pad(n, 4); }
    function pid(daysAgo, n) { return 'PO-' + ymdWIB(NOW - daysAgo * 24 * HR) + '-' + pad(n, 4); }
    function item(line, o) {
      return Object.assign({ line_id: line, kind: 'product', qty: 1, final_price: null, item_status: 'pending',
        distributor_id: null, components: null }, o);
    }
    function poi(line, o) {
      return Object.assign({ line_id: line, component: null, qty: 1, cost_price: null, available: null, eta: null,
        received_qty: 0 }, o);
    }
    function h(status, hours, by, note) { return { at: ago(hours), status: status, by: by, note: note || '' }; }
    function cust(name, city) {
      return { name: name + ' (CONTOH)', wa: '62800000000' + pad(Math.floor(Math.random() * 90) + 10, 2),
        address: 'Jl. Contoh No. ' + (10 + name.length) + ', ' + city, city: city, note: '' };
    }
    function dateOnly(h2) { return isoWIB(NOW + h2 * HR).slice(0, 10); }

    var orders = [], pos = [];

    // 1. placed — ada bet rakitan
    orders.push({
      id: oid(0, 1), created_at: ago(3), status: 'placed', sample: true,
      customer: cust('Rina A.', 'Bandung'),
      items: [
        item('L1', { sku: 'BF-T05', brand: 'Butterfly', name: 'Tenergy 05', variant: '2.1 mm · Merah', qty: 2, est_price: 975000, category: 'karet' }),
        item('L2', { kind: 'rakitan', sku: 'RAKITAN', brand: '', name: 'Bet rakitan', variant: 'Viscaria FL + Tenergy 05 (Merah / Hitam)', est_price: 4785000,
          category: 'bet_rakitan',
          components: {
            blade: { sku: 'BF-VISC', name: 'Butterfly Viscaria', handle: 'FL' },
            fh: { sku: 'BF-T05', name: 'Butterfly Tenergy 05', thickness: '2.1 mm', color: 'Merah' },
            bh: { sku: 'BF-T05', name: 'Butterfly Tenergy 05', thickness: '2.1 mm', color: 'Hitam' },
            assembly_fee: 20000 } })
      ],
      shipping_fee: null, pay_deadline: null, payment: { status: 'none' }, shipment: null,
      history: [h('placed', 3, 'customer', 'Pesanan diajukan')]
    });

    // 2. sourcing — PO Donic terkirim 30 jam tanpa balasan; PO Stiga masih draf
    orders.push({
      id: oid(2, 1), created_at: ago(52), status: 'sourcing', sample: true,
      customer: cust('Budi S.', 'Jakarta'),
      items: [
        item('L1', { sku: 'DN-BF-JP01', brand: 'Donic', name: 'Bluefire JP01 Turbo', variant: 'Max · Merah', est_price: 850000, category: 'karet' }),
        item('L2', { sku: 'DN-BF-M1', brand: 'Donic', name: 'Bluefire M1', variant: '2.0 mm · Hitam', est_price: 900000, category: 'karet' }),
        item('L3', { sku: 'ST-CYB-W', brand: 'Stiga', name: 'Cybershape Wood', variant: 'FL', est_price: 3700000, category: 'blade' })
      ],
      shipping_fee: null, pay_deadline: null, payment: { status: 'none' }, shipment: null,
      history: [h('placed', 52, 'customer', 'Pesanan diajukan'), h('sourcing', 30, 'david', 'PO ' + pid(1, 1) + ' dikirim ke Donic')]
    });
    pos.push({ id: pid(1, 1), order_id: oid(2, 1), distributor_id: 'donic', status: 'sent', created_at: ago(31), sent_at: ago(30), responded_at: null,
      items: [
        poi('L1', { sku: 'DN-BF-JP01', name: 'Donic Bluefire JP01 Turbo', variant: 'Max · Merah' }),
        poi('L2', { sku: 'DN-BF-M1', name: 'Donic Bluefire M1', variant: '2.0 mm · Hitam' })
      ], responses: [] });
    pos.push({ id: pid(0, 1), order_id: oid(2, 1), distributor_id: 'stiga', status: 'draft', created_at: ago(2), sent_at: null, responded_at: null,
      items: [poi('L3', { sku: 'ST-CYB-W', name: 'Stiga Cybershape Wood', variant: 'FL' })], responses: [] });

    // 3. sourcing — PO Andro sudah dibalas semua tersedia: siap susun harga final
    orders.push({
      id: oid(1, 1), created_at: ago(28), status: 'sourcing', sample: true,
      customer: cust('Sari W.', 'Surabaya'),
      items: [
        item('L1', { sku: 'AN-R47', brand: 'Andro', name: 'Rasanter R47', variant: '2.0 mm · Merah', qty: 2, est_price: 875000, category: 'karet', item_status: 'available', distributor_id: 'andro' }),
        item('L2', { sku: 'AN-TCOS', brand: 'Andro', name: 'Treiber CO S', variant: 'FL', est_price: 1250000, category: 'blade', item_status: 'available', distributor_id: 'andro' })
      ],
      shipping_fee: null, pay_deadline: null, payment: { status: 'none' }, shipment: null,
      history: [h('placed', 28, 'customer', 'Pesanan diajukan'), h('sourcing', 26, 'david', 'PO ' + pid(1, 2) + ' dikirim ke Andro')]
    });
    pos.push({ id: pid(1, 2), order_id: oid(1, 1), distributor_id: 'andro', status: 'responded', created_at: ago(27), sent_at: ago(26), responded_at: ago(5),
      items: [
        poi('L1', { sku: 'AN-R47', name: 'Andro Rasanter R47', variant: '2.0 mm · Merah', qty: 2, cost_price: 790000, available: true, eta: dateOnly(72) }),
        poi('L2', { sku: 'AN-TCOS', name: 'Andro Treiber CO S', variant: 'FL', cost_price: 1150000, available: true, eta: dateOnly(72) })
      ], responses: [
        { at: ago(5), line_id: 'L1', component: null, available: true, cost_price: 790000, eta: dateOnly(72), note: '' },
        { at: ago(5), line_id: 'L2', component: null, available: true, cost_price: 1150000, eta: dateOnly(72), note: '' }
      ] });

    // 4. quoted — menunggu transfer (belum ada bukti)
    orders.push({
      id: oid(2, 2), created_at: ago(50), status: 'quoted', sample: true,
      customer: cust('Agus P.', 'Semarang'),
      items: [
        item('L1', { sku: 'DHS-H3N', brand: 'DHS', name: 'Hurricane 3 Neo', variant: 'Komersial 39° · Merah', qty: 2, est_price: 475000, category: 'karet', final_price: 460000, item_status: 'available', distributor_id: 'sinar-surya' }),
        item('L2', { sku: 'ST-DNA-PM', brand: 'Stiga', name: 'DNA Platinum M', variant: 'Max+ 2.3 mm · Merah', est_price: 810000, category: 'karet', final_price: 875000, item_status: 'available', distributor_id: 'stiga' })
      ],
      shipping_fee: 25000, pay_deadline: ahead(20), payment: { status: 'none' }, shipment: null,
      history: [h('placed', 50, 'customer', 'Pesanan diajukan'), h('sourcing', 46, 'david', 'PO dikirim'), h('quoted', 4, 'david', 'Harga final dikirim, total Rp 1.820.000')]
    });
    pos.push({ id: pid(2, 2), order_id: oid(2, 2), distributor_id: 'sinar-surya', status: 'responded', created_at: ago(47), sent_at: ago(46), responded_at: ago(20),
      items: [poi('L1', { sku: 'DHS-H3N', name: 'DHS Hurricane 3 Neo', variant: 'Komersial 39° · Merah', qty: 2, cost_price: 400000, available: true, eta: dateOnly(96), chosen: true })], responses: [] });
    pos.push({ id: pid(2, 3), order_id: oid(2, 2), distributor_id: 'stiga', status: 'responded', created_at: ago(47), sent_at: ago(46), responded_at: ago(22),
      items: [poi('L2', { sku: 'ST-DNA-PM', name: 'Stiga DNA Platinum M', variant: 'Max+ 2.3 mm · Merah', cost_price: 760000, available: true, eta: dateOnly(96), chosen: true })], responses: [] });

    // 5. quoted + bukti bayar menunggu verifikasi
    orders.push({
      id: oid(3, 1), created_at: ago(74), status: 'quoted', sample: true,
      customer: cust('Dewi L.', 'Medan'),
      items: [
        item('L1', { sku: 'XM-VP', brand: 'Xiom', name: 'Vega Pro', variant: '2.0 mm · Merah', est_price: 490000, category: 'karet', final_price: 484000, item_status: 'available', distributor_id: 'sinar-surya' }),
        item('L2', { sku: 'GW-TOFF', brand: 'Gewo', name: 'Talent OFF', variant: 'FL', est_price: 500000, category: 'blade', final_price: 495000, item_status: 'available', distributor_id: 'daya-prima' })
      ],
      shipping_fee: 30000, pay_deadline: ahead(6), payment: { status: 'pending_verification', proof_name: 'bukti-transfer-contoh.jpg', amount: 1009000, at: ago(2) }, shipment: null,
      history: [h('placed', 74, 'customer', 'Pesanan diajukan'), h('sourcing', 70, 'david', 'PO dikirim'), h('quoted', 18, 'david', 'Harga final dikirim, total Rp 1.009.000')]
    });
    pos.push({ id: pid(3, 2), order_id: oid(3, 1), distributor_id: 'sinar-surya', status: 'responded', created_at: ago(71), sent_at: ago(70), responded_at: ago(40),
      items: [poi('L1', { sku: 'XM-VP', name: 'Xiom Vega Pro', variant: '2.0 mm · Merah', cost_price: 420000, available: true, eta: dateOnly(48), chosen: true })], responses: [] });
    pos.push({ id: pid(3, 3), order_id: oid(3, 1), distributor_id: 'daya-prima', status: 'responded', created_at: ago(71), sent_at: ago(70), responded_at: ago(41),
      items: [poi('L2', { sku: 'GW-TOFF', name: 'Gewo Talent OFF', variant: 'FL', cost_price: 430000, available: true, eta: dateOnly(48), chosen: true })], responses: [] });

    // 6. paid — belum dikonfirmasi ke distributor
    orders.push({
      id: oid(3, 2), created_at: ago(80), status: 'paid', sample: true,
      customer: cust('Hendra T.', 'Yogyakarta'),
      items: [
        item('L1', { sku: 'YS-MLC', brand: 'Yasaka', name: 'Ma Lin Carbon', variant: 'FL', est_price: 1012500, category: 'blade', final_price: 1170000, item_status: 'accepted', distributor_id: 'daya-prima' })
      ],
      shipping_fee: 20000, pay_deadline: ago(-0), payment: { status: 'verified', proof_name: 'bukti-contoh-2.jpg', amount: 1190000, at: ago(6) }, shipment: null,
      history: [h('placed', 80, 'customer', 'Pesanan diajukan'), h('sourcing', 76, 'david', 'PO dikirim'), h('quoted', 30, 'david', 'Harga final dikirim'), h('paid', 5, 'david', 'Bukti transfer diterima')]
    });
    pos.push({ id: pid(3, 4), order_id: oid(3, 2), distributor_id: 'daya-prima', status: 'responded', created_at: ago(77), sent_at: ago(76), responded_at: ago(50),
      items: [poi('L1', { sku: 'YS-MLC', name: 'Yasaka Ma Lin Carbon', variant: 'FL', cost_price: 1020000, available: true, eta: dateOnly(48), chosen: true })], responses: [] });

    // 7. fulfilling — sebagian diterima
    orders.push({
      id: oid(5, 1), created_at: ago(130), status: 'fulfilling', sample: true,
      customer: cust('Tono R.', 'Tangerang'),
      items: [
        item('L1', { sku: 'DN-OTC', brand: 'Donic', name: 'Ovtcharov True Carbon', variant: 'FL', est_price: 1400000, category: 'blade', final_price: 1530000, item_status: 'accepted', distributor_id: 'donic' }),
        item('L2', { sku: 'DN-BF-JP01', brand: 'Donic', name: 'Bluefire JP01 Turbo', variant: 'Max · Hitam', qty: 2, est_price: 850000, category: 'karet', final_price: 900000, item_status: 'accepted', distributor_id: 'donic' })
      ],
      shipping_fee: 35000, pay_deadline: ago(40), payment: { status: 'verified', proof_name: 'bukti-contoh-3.jpg', amount: 3365000, at: ago(46) }, shipment: null,
      history: [h('placed', 130, 'customer', 'Pesanan diajukan'), h('sourcing', 120, 'david', 'PO dikirim'), h('quoted', 70, 'david', 'Harga final dikirim'), h('paid', 46, 'david', 'Bukti transfer diterima'), h('fulfilling', 44, 'david', 'PO dikonfirmasi ke Donic')]
    });
    pos.push({ id: pid(5, 2), order_id: oid(5, 1), distributor_id: 'donic', status: 'confirmed', created_at: ago(121), sent_at: ago(120), responded_at: ago(90),
      items: [
        poi('L1', { sku: 'DN-OTC', name: 'Donic Ovtcharov True Carbon', variant: 'FL', cost_price: 1300000, available: true, eta: dateOnly(24), chosen: true, received_qty: 0 }),
        poi('L2', { sku: 'DN-BF-JP01', name: 'Donic Bluefire JP01 Turbo', variant: 'Max · Hitam', qty: 2, cost_price: 760000, available: true, eta: dateOnly(24), chosen: true, received_qty: 1 })
      ], responses: [] });

    // 8. received — bet rakitan, semua komponen diterima
    orders.push({
      id: oid(6, 1), created_at: ago(170), status: 'received', sample: true,
      customer: cust('Lia M.', 'Bekasi'),
      items: [
        item('L1', { kind: 'rakitan', sku: 'RAKITAN', brand: '', name: 'Bet rakitan', variant: 'Ma Lin Carbon FL + Bluefire JP01 (Merah / Hitam)', est_price: 2732500, category: 'bet_rakitan',
          final_price: 2820000, item_status: 'received',
          components: {
            blade: { sku: 'YS-MLC', name: 'Yasaka Ma Lin Carbon', handle: 'FL' },
            fh: { sku: 'DN-BF-JP01', name: 'Donic Bluefire JP01 Turbo', thickness: 'Max', color: 'Merah' },
            bh: { sku: 'DN-BF-JP01', name: 'Donic Bluefire JP01 Turbo', thickness: 'Max', color: 'Hitam' },
            assembly_fee: 20000 } })
      ],
      shipping_fee: 20000, pay_deadline: ago(100), payment: { status: 'verified', proof_name: 'bukti-contoh-4.jpg', amount: 2840000, at: ago(100) }, shipment: null,
      history: [h('placed', 170, 'customer', 'Pesanan diajukan'), h('sourcing', 160, 'david', 'PO dikirim'), h('quoted', 120, 'david', 'Harga final dikirim'), h('paid', 100, 'david', 'Bukti transfer diterima'), h('fulfilling', 98, 'david', 'PO dikonfirmasi'), h('received', 20, 'david', 'Semua barang diterima')]
    });
    pos.push({ id: pid(7, 1), order_id: oid(6, 1), distributor_id: 'daya-prima', status: 'fulfilled', created_at: ago(161), sent_at: ago(160), responded_at: ago(130),
      items: [poi('L1', { component: 'blade', sku: 'YS-MLC', name: 'Yasaka Ma Lin Carbon', variant: 'FL', cost_price: 1020000, available: true, eta: dateOnly(-30), chosen: true, received_qty: 1 })], responses: [] });
    pos.push({ id: pid(7, 2), order_id: oid(6, 1), distributor_id: 'donic', status: 'fulfilled', created_at: ago(161), sent_at: ago(160), responded_at: ago(130),
      items: [
        poi('L1', { component: 'fh', sku: 'DN-BF-JP01', name: 'Donic Bluefire JP01 Turbo', variant: 'Max · Merah', cost_price: 760000, available: true, eta: dateOnly(-30), chosen: true, received_qty: 1 }),
        poi('L1', { component: 'bh', sku: 'DN-BF-JP01', name: 'Donic Bluefire JP01 Turbo', variant: 'Max · Hitam', cost_price: 760000, available: true, eta: dateOnly(-30), chosen: true, received_qty: 1 })
      ], responses: [] });

    // 9. shipped
    orders.push({
      id: oid(8, 1), created_at: ago(220), status: 'shipped', sample: true,
      customer: cust('Eko B.', 'Malang'),
      items: [
        item('L1', { sku: 'ST-ACR', brand: 'Stiga', name: 'Allround CR WRB', variant: 'FL', est_price: 850000, category: 'blade', final_price: 890000, item_status: 'shipped', distributor_id: 'stiga' })
      ],
      shipping_fee: 25000, pay_deadline: ago(150), payment: { status: 'verified', proof_name: 'bukti-contoh-5.jpg', amount: 915000, at: ago(150) },
      shipment: { courier: 'JNE', resi: 'JNE-CONTOH-0001' },
      history: [h('placed', 220, 'customer', 'Pesanan diajukan'), h('sourcing', 210, 'david', 'PO dikirim'), h('quoted', 180, 'david', 'Harga final dikirim'), h('paid', 150, 'david', 'Bukti transfer diterima'), h('fulfilling', 148, 'david', 'PO dikonfirmasi'), h('received', 60, 'david', 'Barang diterima'), h('shipped', 30, 'david', 'JNE JNE-CONTOH-0001')]
    });
    pos.push({ id: pid(9, 1), order_id: oid(8, 1), distributor_id: 'stiga', status: 'fulfilled', created_at: ago(211), sent_at: ago(210), responded_at: ago(190),
      items: [poi('L1', { sku: 'ST-ACR', name: 'Stiga Allround CR WRB', variant: 'FL', cost_price: 780000, available: true, eta: dateOnly(-80), chosen: true, received_qty: 1 })], responses: [] });


    // field margin per item (cost_price, margin_type, margin_value) untuk order yang sudah punya harga final
    orders.forEach(function (o) {
      o.items.forEach(function (it) {
        if (it.final_price == null) return;
        var cost = 0, found = false;
        pos.forEach(function (p) {
          if (p.order_id !== o.id) return;
          p.items.forEach(function (pi) {
            if (pi.line_id === it.line_id && pi.chosen && pi.cost_price != null) { cost += pi.cost_price; found = true; }
          });
        });
        if (!found) return;
        if (it.kind === 'rakitan') { cost = cost; }
        it.cost_price = cost;
        it.margin_type = 'pct';
        var extra = it.kind === 'rakitan' && it.components ? it.components.assembly_fee || 0 : 0;
        it.margin_value = Math.round((it.final_price - cost - extra) / cost * 1000) / 10;
      });
    });
    return { orders: orders, pos: pos };
  }

  root.DS = DS;
  if (typeof module !== 'undefined' && module.exports) module.exports = DS;
})(typeof window !== 'undefined' ? window : globalThis);
