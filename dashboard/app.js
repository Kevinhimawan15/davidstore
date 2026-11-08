/* Dashboard David — app.js (UI). Aturan domain ada di logic.js; data di shared/store.js. */
(function () {
  'use strict';
  var DS = window.DS, L = window.DSLogic, A = L.A;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var HR = 3600e3;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var rp = DS.formatRupiah, num = DS.formatAngka;
  function digits(v) { return Math.round(Number(String(v || '').replace(/[^\d-]/g, '')) || 0); }
  function decimal(v) { var n = parseFloat(String(v || '').replace(',', '.')); return isNaN(n) ? 0 : n; }

  // ---------- ikon (Lucide) ----------
  var IC = {
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    'badge-check': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    'package-check': '<path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/><path d="m16 17 2 2 4-4"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'x-circle': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    reply: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="m10 7-3 3 3 3"/><path d="M17 13v-1a2 2 0 0 0-2-2H7"/>',
    clip: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z"/>',
    tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 16V9M12 16V5M17 16v-4"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    layout: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>'
  };
  function ic(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">' + (IC[n] || '') + '</svg>'; }

  // ---------- label status (label David, DESIGN §3.3) ----------
  var OST = {
    placed: ['Baru — perlu dicek', 'info', 'inbox'], sourcing: ['Menunggu balasan distributor', 'wait', 'hourglass'],
    quoted: ['Harga final terkirim — tunggu transfer', 'wait', 'wallet'], paid: ['Lunas — pesan ke distributor', 'info', 'badge-check'],
    fulfilling: ['Diproses (menunggu barang dari distributor)', 'info', 'package'], received: ['Barang di David — siap dikirim', 'info', 'package-check'],
    shipped: ['Dikirim', 'info', 'truck'], completed: ['Selesai', 'ok', 'check-circle'], cancelled: ['Dibatalkan', 'bad', 'x-circle'],
    expired: ['Kedaluwarsa (tidak dibayar)', 'neutral', 'clock']
  };
  var PST = {
    draft: ['Draf', 'neutral', 'file'], sent: ['Terkirim, belum dibalas', 'wait', 'send'], responded: ['Dibalas', 'ok', 'reply'],
    confirmed: ['Sudah dipesan ke distributor', 'info', 'clip'], fulfilled: ['Barang diterima David', 'ok', 'package-check'],
    rejected: ['Distributor tidak sanggup', 'bad', 'ban'], cancelled: ['Dibatalkan', 'bad', 'x-circle']
  };
  var IST = {
    pending: ['Belum dicek', 'neutral'], available: ['Tersedia', 'ok'], unavailable: ['Tidak tersedia', 'bad'],
    alternative_offered: ['Alternatif ditawarkan', 'partial'], accepted: ['Disetujui customer', 'ok'], declined: ['Ditolak customer', 'bad'],
    received: ['Sudah diterima', 'ok'], shipped: ['Dikirim', 'info'], cancelled: ['Dibatalkan', 'bad']
  };
  function badge(map, k, extra) { var m = map[k] || [k, 'neutral', 'file']; return '<span class="badge badge--' + m[1] + '">' + (m[2] ? ic(m[2]) : '') + esc(m[0]) + (extra ? ' · ' + esc(extra) : '') + '</span>'; }

  // ---------- waktu ----------
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  function wib(t) { var d = new Date(L.ms(t) + 7 * HR); return d; }
  function fmtDT(t) { if (!t) return '—'; var d = wib(t), p = function (n) { return ('0' + n).slice(-2); }; return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + p(d.getUTCHours()) + '.' + p(d.getUTCMinutes()); }
  function fmtD(t) { if (!t) return '—'; var d = wib(t); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function age(t) {
    var h = Math.max(0, (Date.now() - (typeof t === 'number' ? t : L.ms(t))) / HR);
    if (h < 1) return Math.max(1, Math.round(h * 60)) + ' menit';
    if (h < 48) return Math.floor(h) + ' jam';
    return Math.floor(h / 24) + ' hari';
  }
  function ageHrs(t) { return (Date.now() - (typeof t === 'number' ? t : L.ms(t))) / HR; }

  // ---------- util UI ----------
  function toast(msg, kind, action) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' err' : '');
    el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
    el.innerHTML = ic(kind === 'err' ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>';
    if (action) { var b = document.createElement('button'); b.textContent = action.label; b.onclick = function () { action.fn(); el.remove(); }; el.appendChild(b); }
    $('#toasts').appendChild(el);
    if (kind !== 'err') setTimeout(function () { el.remove(); }, 8000);
    else { var x = document.createElement('button'); x.textContent = 'Tutup'; x.onclick = function () { el.remove(); }; el.appendChild(x); }
  }
  var modalStack = [];
  function closeModal() {
    var m = modalStack.pop(); if (!m) return;
    m.el.remove(); if (m.prev && m.prev.focus) try { m.prev.focus(); } catch (e) { /* abaikan */ }
  }
  // opts: {title, body, wide, actions:[{label, kind:'primary|sec|danger|fill-danger', id, disabled, fn(el)->false untuk tetap terbuka}]}
  function openModal(opts) {
    var ov = document.createElement('div'); ov.className = 'overlay';
    var acts = (opts.actions || [{ label: 'Tutup', kind: 'sec' }]).map(function (a, i) {
      return '<button type="button" class="btn ' + ({ sec: 'sec', danger: 'danger', 'fill-danger': 'fill-danger' }[a.kind] || '') + '" data-mi="' + i + '"' + (a.id ? ' id="' + a.id + '"' : '') + (a.disabled ? ' disabled' : '') + '>' + esc(a.label) + '</button>';
    }).join('');
    ov.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(opts.title) + '"><header><h2>' + esc(opts.title) + '</h2></header><div class="mbody">' + opts.body + '</div><footer>' + acts + '</footer></div>';
    var rec = { el: ov, prev: document.activeElement };
    modalStack.push(rec);
    ov.addEventListener('click', function (e) {
      if (e.target === ov) { closeModal(); return; }
      var b = e.target.closest('[data-mi]'); if (!b || b.disabled) return;
      var a = (opts.actions || [{}])[Number(b.getAttribute('data-mi'))];
      var keep = a && a.fn ? a.fn(ov) === false : false;
      if (!keep && modalStack.indexOf(rec) >= 0) closeModal();
    });
    $('#modal-root').appendChild(ov);
    var f = $('input,select,textarea', ov) || $('button', ov); if (f) f.focus();
    return ov;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalStack.length) closeModal();
    if (e.key === 'Tab' && modalStack.length) {
      var ov = modalStack[modalStack.length - 1].el, f = $$('button:not([disabled]),input,select,textarea,a[href]', ov);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  function note(kind, icon, html) { return '<div class="note ' + kind + '">' + ic(icon) + '<div>' + html + '</div></div>'; }
  function fieldErr(ov, msg) { var e = $('.errmsg', ov); if (!e) { e = document.createElement('div'); e.className = 'errmsg'; e.setAttribute('role', 'alert'); $('.mbody', ov).appendChild(e); } e.innerHTML = ic('alert').replace('<svg', '<svg width="18" height="18" stroke="currentColor" fill="none" stroke-width="2"') + esc(msg); }
  function afterAction(r, okMsg, flashId) {
    if (!r.ok) { toast(r.error, 'err'); render(); return false; }
    if (okMsg) toast(okMsg);
    render();
    return true;
  }
  function getData() { return L.load(); }
  function orderById(id) { return DS.getOrders().filter(function (o) { return o.id === id; })[0]; }
  function poById(id) { return DS.getPOs().filter(function (o) { return o.id === id; })[0]; }
  function itemLabel(it) { return (it.brand ? it.brand + ' ' : '') + it.name + (it.variant ? ' — ' + it.variant : ''); }
  function custName(o) { return o.customer && o.customer.name || '—'; }
  function waOpen(url) { try { window.open(url, '_blank', 'noopener'); } catch (e) { /* popup diblok */ } }
  function copyText(t) { try { navigator.clipboard.writeText(t).then(function () { toast('Teks disalin.'); }, function () { toast('Gagal menyalin. Pilih teks lalu salin manual.', 'err'); }); } catch (e) { toast('Gagal menyalin. Pilih teks lalu salin manual.', 'err'); } }

  // ---------- state ----------
  var wiz = null;   // {orderId, step, sel:{key:distId}}
  var quote = null; // {orderId, lines:{line_id:{...}}, shipping, hours}
  var ordersFilter = 'semua', ordersQuery = '', catQuery = '', ordersIds = null; // ordersIds: daftar id terpilih dari tautan Beranda

  // ---------- routing ----------
  function route() { var h = (location.hash || '#/beranda').replace(/^#\/?/, ''); return h.split('/').map(decodeURIComponent); }
  function go(p) { location.hash = '#/' + p; }

  var NAV = [['beranda', 'Beranda', 'home'], ['pesanan', 'Pesanan', 'list'], ['po', 'Daftar PO', 'send'], ['distributor', 'Distributor', 'store'],
    ['katalog', 'Katalog', 'tag'], ['brand', 'Brand', 'eye'], ['laporan', 'Laporan', 'chart'], ['pengaturan', 'Pengaturan', 'gear']];

  function counts() {
    var d = getData(), a = L.actionSummary(d.orders, d.pos).total, p = 0; // sama persis dengan baris "Perlu tindakan" di Beranda
    d.pos.forEach(function (po) { if (po.status === 'draft' || (po.status === 'sent' && ageHrs(po.sent_at) > 24)) p++; });
    return { orders: a, po: p };
  }
  function renderSide(sec) {
    var c = counts();
    $('#side').innerHTML = '<div class="brand"><img class="logo-full" src="../assets/logo/logo.svg" alt="DavidStore" height="32"><img class="logo-mark" src="../assets/logo/mark.svg" alt="DavidStore" height="32"><small>Dashboard David</small></div><div class="nav">' +
      NAV.map(function (n) {
        var k = c[n[0] === 'pesanan' ? 'orders' : n[0] === 'po' ? 'po' : ''];
        return '<a href="#/' + n[0] + '"' + (n[0] === sec ? ' aria-current="page"' : '') + '>' + ic(n[2]) + '<span>' + n[1] + '</span>' + (k ? '<span class="cnt" aria-label="' + k + ' perlu tindakan">' + k + '</span>' : '') + '</a>';
      }).join('') + '</div><div class="foot">' + (DS.syncStatus && DS.syncStatus().mode === 'sheet' ? '<p>Data tersimpan di Google Sheet.</p>' : '<p>Pesanan dan PO tersimpan di browser ini saja.</p><button class="btn sec sm" data-act="clear-local">Hapus data lokal browser ini</button>') + '</div>';
  }

  function render() {
    var r = route(), sec = r[0] || 'beranda', html = '';
    if (sec === 'ringkasan') { sec = 'beranda'; try { history.replaceState(null, '', '#/beranda'); } catch (e) { /* abaikan */ } } // alamat lama
    try { A.sweepExpired(); } catch (e) { /* abaikan */ }
    try {
      if (sec === 'beranda') html = pgBeranda();
      else if (sec === 'pesanan') html = r[1] ? (r[2] === 'po' ? pgWizard(r[1]) : r[2] === 'harga' ? pgQuote(r[1]) : pgOrder(r[1])) : pgOrders();
      else if (sec === 'po') html = r[1] ? pgPoDetail(r[1]) : pgPos();
      else if (sec === 'distributor') html = pgDistributor();
      else if (sec === 'katalog') html = pgKatalog();
      else if (sec === 'brand') html = pgBrand();
      else if (sec === 'laporan') html = pgLaporan();
      else if (sec === 'pengaturan') html = pgPengaturan();
      else html = '<h1>Halaman tidak ada</h1><p><a href="#/beranda">Kembali ke Beranda</a></p>';
    } catch (e) {
      console.error(e);
      html = '<div class="note bad">' + ic('alert') + '<div><b>Data belum bisa ditampilkan.</b> Coba muat ulang halaman. Kode: ' + esc(e && e.message) + '</div></div>';
    }
    var m = $('#main'); m.innerHTML = '<div class="fade">' + html + '</div>';
    renderSide(sec);
    document.title = 'Dashboard David — DavidStore';
    if (sec === 'pesanan' && r[2] === 'harga') bindQuote();
    if (sec === 'pengaturan') mountSync();
    hydrateProofs();
  }

  function pageHead(title, right, sub) {
    var d = new Date(Date.now() + 7 * HR), days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return '<div class="pagehead"><div><h1>' + title + '</h1>' + (sub ? '<div class="muted small">' + sub + '</div>' : '') + '</div><div class="row">' + (right || '') + syncBadge() +
      '<span class="muted small">' + days[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + '</span></div></div>';
  }

  // ---------- Beranda (ADM-22) ----------
  var GROUP_LABEL = { baru: 'Order baru', po: 'PO perlu ditindak', harga: 'Siap susun harga final', bayar: 'Bukti bayar menunggu verifikasi', konfirmasi: 'Lunas, belum dikonfirmasi ke distributor', kirim: 'Barang siap kirim' };
  var bPeriod = { kind: 'month', ym: '' };
  var ordersGroup = '';

  function pctTxt(n) { return n == null ? '—' : String(n).replace('.', ',') + '%'; }
  function dShort(t) { var p = L.wibParts(t); return p.d + ' ' + MON[p.m]; }
  function dFull(t) { var p = L.wibParts(t); return p.d + ' ' + MON[p.m] + ' ' + p.y; }
  function dec1(x) { return String(Math.round(x * 10) / 10).replace('.', ','); }
  function fmtHrs(h) { return h < 1 ? Math.max(1, Math.round(h * 60)) + ' menit' : h < 48 ? dec1(h) + ' jam' : dec1(h / 24) + ' hari'; }
  function brandVisible(name) { try { return DS.isBrandVisible ? DS.isBrandVisible(name) !== false : true; } catch (e) { return true; } }
  function makeBrandOf() { // brand komponen bet rakitan: dari katalog (sku), lalu awalan nama
    var C = window.DS_CATALOG, bySku = {}, names = [];
    if (C && Array.isArray(C.products)) C.products.forEach(function (p) { bySku[p.sku] = p.brand; if (names.indexOf(p.brand) < 0) names.push(p.brand); });
    names.sort(function (a, b) { return b.length - a.length; });
    return function (sku, name) {
      if (bySku[sku]) return bySku[sku];
      var n = String(name || '').toLowerCase();
      for (var i = 0; i < names.length; i++) if (n.indexOf(names[i].toLowerCase()) === 0) return names[i];
      return L.firstWord(name);
    };
  }
  function curYm() { var p = L.wibParts(Date.now()); return p.y + '-' + ('0' + (p.m + 1)).slice(-2); }
  function monthOptions(first) { // bulan kalender dari pencatatan pertama sampai bulan ini (maks. 36)
    var now = L.wibParts(Date.now()), f = first ? L.wibParts(first) : now, y = now.y, m = now.m, out = [];
    while (out.length < 36 && (y > f.y || (y === f.y && m >= f.m))) {
      out.push({ ym: y + '-' + ('0' + (m + 1)).slice(-2), label: L.MONTHS_ID[m] + ' ' + y });
      m--; if (m < 0) { m = 11; y--; }
    }
    return out;
  }
  function delta(c, s, kind) {
    if (s.prevNoData) return '<span class="delta">Belum ada data pembanding (pencatatan mulai ' + dFull(s.since) + ')</span>';
    if (c.state === 'noSales') return '<span class="delta">periode lalu: tidak ada penjualan</span>';
    if (c.state === 'na') return '<span class="delta">periode lalu: —</span>';
    if (!c.diff) return '<span class="delta">Sama seperti periode lalu</span>';
    var d = c.diff, amt = kind === 'rp' ? rp(Math.abs(d)) : kind === 'pt' ? dec1(Math.abs(d)) + ' poin' : Math.abs(d) + ' pesanan';
    return '<span class="delta ' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? 'Naik ' : 'Turun ') + amt +
      (c.pct != null ? ' (' + (c.pct > 0 ? '+' : '−') + dec1(Math.abs(c.pct)) + '%)' : '') + '</span>';
  }
  function stat(label, value, sub, cmp, cls) {
    return '<div class="stat"><div class="k">' + label + '</div><div class="v num' + (cls ? ' ' + cls : '') + '">' + value + '</div>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + (cmp ? '<div class="cmp">' + cmp + '</div>' : '') + '</div>';
  }
  function distLabel(k) { return k === '?' ? 'Distributor belum diketahui' : DS.distributorName(k); }
  function shortRp(n) { return n >= 1e6 ? dec1(n / 1e6) + ' jt' : n >= 1e3 ? Math.round(n / 1e3) + ' rb' : String(n); }

  // grafik batang omzet harian — SVG tangan, nilai persis ada di <title> tiap batang
  function chartSvg(days) {
    var main = $('#main'), W = Math.max(300, Math.min(900, (main ? main.clientWidth : 760) - 70)), Hh = 190, pl = 44, pb = 24, pt = 10, pr = 6;
    var max = days.reduce(function (m, d) { return Math.max(m, d.omzet); }, 0);
    if (!max) return '';
    var step = Math.pow(10, Math.floor(Math.log(max) / Math.LN10)), top = Math.ceil(max / step) * step;
    var iw = W - pl - pr, ih = Hh - pt - pb, bw = iw / days.length, g = '';
    [0, .5, 1].forEach(function (f) {
      var y = pt + ih - ih * f;
      g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '" class="gl"/><text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="ax">' + shortRp(top * f) + '</text>';
    });
    var every = Math.ceil(days.length / Math.max(2, Math.floor(iw / 44)));
    days.forEach(function (d, k) {
      var h = d.omzet / top * ih, x = pl + k * bw, p = L.wibParts(d.start);
      if (d.omzet > 0) g += '<rect x="' + (x + bw * .14) + '" y="' + (pt + ih - h) + '" width="' + Math.max(2, bw * .72) + '" height="' + h + '" class="bar"><title>' + p.d + ' ' + MON[p.m] + ': ' + rp(d.omzet) + '</title></rect>';
      if (k % every === 0) g += '<text x="' + (x + bw / 2) + '" y="' + (Hh - 6) + '" text-anchor="middle" class="ax">' + p.d + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '" role="img" aria-label="Grafik omzet harian. Nilai tiap hari ada di tooltip batang.">' + g + '</svg>';
  }

  function salesBlock(d) {
    var first = null;
    d.orders.forEach(function (o) { var t = L.ms(o.created_at); if (t && (first === null || t < first)) first = t; });
    var opts = monthOptions(first);
    if (bPeriod.kind === 'pick' && !bPeriod.ym) bPeriod.ym = (opts[1] || opts[0] || { ym: curYm() }).ym;
    var S, ss = DS.syncStatus ? DS.syncStatus() : null;
    try {
      if (ss && ss.mode === 'sheet' && ss.state === 'error' && !d.orders.length) throw new Error(ss.error || 'sumber data tidak bisa dibaca');
      S = L.computeSalesSummary(d.orders, d.pos, bPeriod, Date.now(), { brandOf: makeBrandOf(), isBrandVisible: brandVisible }); }
    catch (e) {
      console.error(e);
      return '<section class="card"><div class="note bad" style="margin:0">' + ic('alert') + '<div><b>Gagal memuat data penjualan.</b> ' + esc(e && e.message) + '</div><button class="btn sec sm" data-act="bp-retry" style="margin-left:auto">Coba lagi</button></div></section>';
    }
    var c = S.cur, r = S.range, sample = d.orders.some(function (o) { return o.sample; });
    var tabs = [['today', 'Hari ini'], ['7d', '7 hari'], ['month', 'Bulan ini'], ['pick', 'Pilih bulan']].map(function (t) {
      return '<button class="tab" data-act="bp" data-v="' + t[0] + '" aria-pressed="' + (bPeriod.kind === t[0]) + '">' + t[1] + '</button>';
    }).join('');
    var pick = bPeriod.kind === 'pick' ? '<div class="field" style="margin:0"><label class="f" for="bp-m">Bulan</label><select id="bp-m" class="input" data-act="bp-month" style="min-width:200px">' +
      opts.map(function (o) { return '<option value="' + o.ym + '"' + (o.ym === bPeriod.ym ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') + '</select></div>' : '';
    var rangeTxt = (r.kind === 'today' ? dFull(r.start) + ', sampai sekarang' : dShort(r.start) + ' – ' + dFull(r.effEnd)) +
      ' · pembanding: ' + r.cmpLabel + ' (' + (r.kind === 'today' ? dShort(r.cmpStart) : dShort(r.cmpStart) + ' – ' + dShort(r.cmpEnd)) + ')';
    var warns = '';
    if (S.undatedPaid) warns += note('wait', 'alert', '<b>' + S.undatedPaid + ' pesanan lunas tidak punya tanggal lunas di riwayat</b> — tidak dihitung di periode mana pun.');
    if (S.noPriceItems) warns += note('wait', 'alert', '<b>' + S.noPriceItems + ' item terhitung belum punya harga final</b> — tidak ikut omzet.');
    if (c.missingCostItems) warns += note('wait', 'alert', '<b>Untung belum lengkap: ' + c.missingCostItems + ' item belum ada harga distributor</b> (' + c.missingCostOrders.map(esc).join(', ') + '). Item itu tidak dianggap berharga distributor Rp 0; ikut omzet, tidak ikut untung dan margin.');
    if (c.refundItems || S.prev.refundItems) warns += note('info', 'info', 'Termasuk koreksi refund' + (c.refundItems ? ': ' + c.refundItems + ' item senilai ' + rp(c.refundAmount) + ' dikeluarkan dari periode ini' : '') + '. Refund dikurangkan di periode tanggal lunas pesanannya, jadi angka periode lalu bisa berubah.');

    var cards;
    if (S.noData) {
      cards = '<div class="note info">' + ic('info') + '<div><b>Belum ada data untuk periode ini</b>' + (S.since ? ' (pencatatan mulai ' + dFull(S.since) + ').' : ' (belum ada pesanan tercatat).') + ' Ini bukan Rp 0 — periode ini sebelum pesanan pertama tercatat.</div></div>';
    } else {
      var cmp = S.compare, none = c.orderCount === 0;
      var profitUnknown = c.profitBase === 0 && c.missingCostItems > 0;
      cards = '<div class="stats">' +
        stat('Omzet', rp(c.omzet), none ? '0 pesanan lunas di periode ini' : 'tanpa ongkir', delta(cmp.omzet, S, 'rp')) +
        stat('Untung kotor <span class="muted">(harga jual − harga distributor)</span>', profitUnknown ? '—' : rp(c.profit), c.missingCostItems ? 'belum lengkap: ' + c.missingCostItems + ' item belum ada harga distributor' : none ? 'belum ada penjualan' : 'belum dikurangi ongkir distributor', delta(cmp.profit, S, 'rp'), c.profit < 0 ? 'loss' : '') +
        stat('Margin', pctTxt(c.margin), c.margin == null ? (none ? 'belum ada penjualan' : 'harga distributor belum tercatat') : 'untung ÷ omzet', delta(cmp.margin, S, 'pt')) +
        stat('Pesanan lunas', String(c.orderCount), none ? '0 pesanan lunas' : '', delta(cmp.orders, S, 'n')) +
        stat('Rata-rata nilai pesanan', c.avg == null ? '—' : rp(c.avg), c.avg == null ? 'belum ada pesanan lunas' : 'omzet ÷ pesanan lunas', delta(cmp.avg, S, 'rp')) + '</div>';
    }

    var chart = '';
    if (!S.noData && S.daily.length >= 3) {
      var svg = chartSvg(S.daily);
      chart = '<section class="card"><h2>Omzet harian</h2>' + (svg ? '<div class="chartwrap">' + svg + '</div><p class="hint">Per hari lunas (WIB), tanpa ongkir. Arahkan kursor ke batang untuk nilai persisnya.</p>' : '<div class="calm">' + ic('chart') + '<span>Belum ada penjualan di periode ini.</span></div>') + '</section>';
    }

    var f = S.funnel;
    function frow(label, big, text, pct) {
      return '<div class="frow"><div class="fl">' + label + '</div><div class="fv"><b class="num">' + big + '</b> <span>' + text + '</span></div>' +
        (pct != null ? '<div class="bar-track"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>' : '') + '</div>';
    }
    var fun = '<section class="card"><h2>Dari pesanan masuk sampai lunas</h2>' +
      frow('Pesanan masuk <span class="muted">(dibuat di periode ini)</span>', f.b6, f.b6 ? 'pesanan' : 'belum ada pesanan masuk', null) +
      frow('Masuk → lunas', f.b7.of ? f.b7.n + ' dari ' + f.b7.of : '—', f.b7.of ? '(' + pctTxt(f.b7.pct) + ')' + (f.b7.running ? ' · ' + f.b7.running + ' masih berjalan' : '') : 'belum ada pesanan masuk', f.b7.pct) +
      frow('Harga final → lunas', f.b8.of ? f.b8.n + ' dari ' + f.b8.of : '—', f.b8.of ? '(' + pctTxt(f.b8.pct) + ')' + (f.b8.running ? ' · ' + f.b8.running + ' masih berjalan' : '') : 'belum ada pesanan yang sampai harga final', f.b8.pct) +
      '<p class="hint">Periode yang masih berjalan belum final — pesanan "masih berjalan" bisa menambah angka lunas.</p></section>';
    var b10 = f.b10, b10n = b10.cancelledBeforePaid + b10.cancelledAfterPaid + b10.expired;
    var speed = '<section class="card"><h2>Kecepatan & yang gagal</h2>' +
      '<div class="frow"><div class="fl">Waktu sampai harga final <span class="muted">(median)</span></div><div class="fv">' +
      (f.b9.n ? '<b class="num">' + fmtHrs(f.b9.median) + '</b> <span>· ' + f.b9.late + ' dari ' + f.b9.n + ' lewat 24 jam</span>' : '<b class="num">—</b> <span>belum ada pesanan yang sampai harga final di periode ini</span>') + '</div></div>' +
      '<div class="frow"><div class="fl">Batal & kedaluwarsa</div><div class="fv">' + (b10n ? '' : '<b class="num">0</b> <span>tidak ada pesanan batal atau kedaluwarsa</span>') +
      (b10n ? '<ul class="plain"><li><b class="num">' + (b10.cancelledBeforePaid + b10.cancelledAfterPaid) + '</b> batal' + (b10.cancelledAfterPaid ? ' — ' + b10.cancelledAfterPaid + ' setelah lunas, refund ' + rp(b10.refundTotal) : '') + '</li><li><b class="num">' + b10.expired + '</b> kedaluwarsa (tidak dibayar)</li></ul>' : '') + '</div></div></section>';

    function money(x, inc) { return rp(x) + (inc ? '<span class="star" title="Belum semua item punya harga distributor">*</span>' : ''); }
    var incAny = c.products.some(function (p) { return p.incomplete; }) || c.brands.some(function (p) { return p.incomplete; }) || c.dists.some(function (p) { return p.incomplete; });
    var none5 = '<div class="calm">' + ic('tag') + '<span>Belum ada penjualan di periode ini.</span></div>';
    var tProd = c.products.length ? '<div class="tablewrap"><table><thead><tr><th>Produk</th><th class="num">Qty</th><th class="num">Omzet</th><th class="num hide-md">Untung</th></tr></thead><tbody>' +
      c.products.slice(0, 5).map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td class="num">' + p.qty + '</td><td class="num">' + rp(p.omzet) + '</td><td class="num hide-md">' + money(p.profit, p.incomplete) + '</td></tr>'; }).join('') + '</tbody></table></div>' : none5;
    var tBrand = c.brands.length ? '<div class="tablewrap"><table><thead><tr><th>Brand</th><th class="num">Qty</th><th class="num">Omzet</th><th class="num hide-md">Untung</th></tr></thead><tbody>' +
      c.brands.slice(0, 5).map(function (p) { return '<tr><td>' + esc(p.name) + (p.hidden ? ' <span class="badge badge--wait">Disembunyikan di toko</span>' : '') + '</td><td class="num">' + p.qty + '</td><td class="num">' + rp(p.omzet) + '</td><td class="num hide-md">' + money(p.profit, p.incomplete) + '</td></tr>'; }).join('') + '</tbody></table></div>' : none5;
    function pctOf(p) { return p.incomplete || !(p.omzet > 0) ? '—' : (Math.round(p.profit / p.omzet * 1000) / 10).toString().replace('.', ',') + '%'; }
    function ordLink(p, label) { var ids = Object.keys(p.ords || {}); return ids.length ? ' <a href="#/pesanan" data-act="orders-ids" data-ids="' + esc(ids.join(',')) + '">' + label.replace('{n}', ids.length) + '</a>' : ''; }
    var tDist = c.dists.length ? '<div class="tablewrap"><table><thead><tr><th>Distributor</th><th class="num">PO dikonfirmasi</th><th class="num">Dibayar ke distributor (Rp)</th><th class="num">Dijual ke customer (Rp)</th><th class="num">Untung (Rp)</th><th class="num">Margin %</th></tr></thead><tbody>' +
      c.dists.map(function (p) { var unk = p.key === '?'; return '<tr><td>' + (unk ? '<b>Belum ada PO dikonfirmasi</b>' + ordLink(p, 'lihat {n} pesanan') : esc(distLabel(p.key))) + '</td><td class="num">' + p.pos + '</td><td class="num">' + rp(p.modal) + '</td><td class="num">' + rp(p.omzet) + '</td><td class="num">' + money(p.profit, p.incomplete) + '</td><td class="num">' + pctOf(p) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="calm">' + ic('store') + '<span>Belum ada PO yang dipesan untuk penjualan di periode ini.</span></div>';
    var actIds = [], waitIds = [];
    d.orders.forEach(function (o) { if (L.ACTIVE && L.ACTIVE.indexOf(o.status) < 0) return; var a2 = L.actionFor(o, d.pos); if (a2 && a2.kind === 'action') actIds.push(o.id); else if (a2) waitIds.push(o.id); });

    return '<section class="card salescard"><div class="cardhead"><h2>Penjualan' + (sample ? ' <span class="sample-tag">Data contoh</span>' : '') + '</h2></div>' +
      '<div class="row" style="align-items:flex-end;margin-bottom:var(--sp-3)"><div class="tabs" role="group" aria-label="Periode" style="margin:0">' + tabs + '</div>' + pick + '</div>' +
      '<p class="muted small" style="margin:0 0 var(--sp-4)"><b>' + esc(r.label) + '</b>: ' + esc(rangeTxt) + '</p>' + warns + cards + '</section>' +
      (S.noData ? '' : chart + '<div class="grid2 gridtop">' + fun + speed + '</div>' +
        '<div class="grid2 gridtop"><section class="card"><h2>Produk terlaris <span class="muted small">(5 teratas, urut omzet)</span></h2>' + tProd + '</section><section class="card"><h2>Brand terlaris</h2>' + tBrand + '</section></div>' +
        '<section class="card"><h2>Belanja ke distributor</h2><p class="muted small">Dari pesanan lunas di periode ini: berapa yang dibayar ke tiap distributor dan untung dari barangnya.</p>' + tDist + (incAny ? '<p class="hint"><span class="star">*</span> Untung belum lengkap: ada item belum ada harga distributor.</p>' : '') + '<p class="hint">Bet rakitan dipecah per komponen ke distributor pemasoknya. Jasa rakit masuk ke untung David.</p></section>') +
      '<p class="muted small"><b class="num">' + S.activeNow + '</b> pesanan masih berjalan — ' + (actIds.length ? '<a href="#/pesanan" data-act="open-group"><b class="num">' + actIds.length + '</b> menunggu tindakan David</a>' : '<b class="num">0</b> menunggu tindakan David') + ', ' + (waitIds.length ? '<a href="#/pesanan" data-act="orders-ids" data-ids="' + esc(waitIds.join(',')) + '"><b class="num">' + waitIds.length + '</b> menunggu customer/distributor</a>' : '<b class="num">0</b> menunggu customer/distributor') + '.</p>';
  }

  function pgBeranda() {
    var d = getData(), AS = L.actionSummary(d.orders, d.pos), rows = AS.groups;
    var list = rows.map(function (g) {
      return '<li><b class="cntbig num">' + g.n + '</b><div class="what"><b>' + GROUP_LABEL[g.group] + '</b><span class="muted small">tertua ' + age(g.oldest) + '</span>' + (g.group === 'bayar' ? '<span class="pthumbs">' + d.orders.filter(function (o) { return o.status === 'quoted' && o.payment && o.payment.status === 'pending_verification'; }).slice(0, 4).map(function (o) { return proofSlot(o, true); }).join('') + '</span>' : '') + '</div><a class="btn sec sm" href="#/pesanan" data-act="open-group" data-g="' + g.group + '">Buka</a></li>';
    }).join('');
    var sample = d.orders.some(function (o) { return o.sample; });
    return pageHead('Beranda', sample ? '<span class="sample-tag" data-sample>Data contoh</span>' : '') +
      '<section class="card"><div class="cardhead"><h2>Perlu diurus sekarang</h2>' + (AS.total ? '<a class="btn text sm" href="#/pesanan" data-act="open-group" data-g="">Lihat semua (' + AS.total + ')</a>' : '') + '</div>' +
      (rows.length ? '<ul class="todo">' + list + '</ul>' : '<div class="calm">' + ic('check-circle') + '<span>Tidak ada yang perlu diurus sekarang.</span></div>') + '</section>' +
      salesBlock(d);
  }

  // ---------- Daftar pesanan ----------
  var FILTERS = [['semua', 'Semua'], ['tindakan', 'Perlu tindakan'], ['placed', 'Baru'], ['sourcing', 'Menunggu distributor'], ['quoted', 'Menunggu bayar'], ['paid', 'Lunas'],
    ['fulfilling', 'Diproses'], ['received', 'Siap kirim'], ['shipped', 'Dikirim'], ['completed', 'Selesai'], ['cancelled', 'Batal / kedaluwarsa']];
  function pgOrders() {
    var d = getData(), q = ordersQuery.trim().toLowerCase();
    var list = d.orders.map(function (o) { return { o: o, a: L.actionFor(o, d.pos) }; }).filter(function (x) {
      var s = x.o.status;
      if (ordersIds && ordersIds.indexOf(x.o.id) < 0) return false;
      if (ordersFilter === 'tindakan' && !(x.a && x.a.kind === 'action')) return false;
      if (ordersFilter === 'tindakan' && ordersGroup && x.a.group !== ordersGroup) return false;
      if (ordersFilter === 'cancelled' && s !== 'cancelled' && s !== 'expired') return false;
      if (['semua', 'tindakan', 'cancelled'].indexOf(ordersFilter) < 0 && s !== ordersFilter) return false;
      if (q && (x.o.id + ' ' + x.o.customer.name + ' ' + x.o.customer.wa).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    list.sort(function (x, y) {
      var xa = x.a && x.a.kind === 'action' ? 0 : 1, ya = y.a && y.a.kind === 'action' ? 0 : 1;
      if (xa !== ya) return xa - ya;
      return xa === 0 ? x.a.since - y.a.since : L.ms(y.o.created_at) - L.ms(x.o.created_at);
    });
    function cnt(k) { return d.orders.filter(function (o) { return k === 'semua' ? true : k === 'tindakan' ? (function () { var a = L.actionFor(o, d.pos); return a && a.kind === 'action'; })() : k === 'cancelled' ? (o.status === 'cancelled' || o.status === 'expired') : o.status === k; }).length; }
    return pageHead('Pesanan') +
      '<div class="tabs" role="group" aria-label="Filter status">' + FILTERS.map(function (f) { return '<button class="tab" data-act="filter" data-v="' + f[0] + '" aria-pressed="' + (ordersFilter === f[0]) + '">' + f[1] + ' (' + cnt(f[0]) + ')</button>'; }).join('') + '</div>' +
      (ordersFilter === 'tindakan' && ordersGroup ? '<div class="note info">' + ic('info') + '<div>Disaring: <b>' + GROUP_LABEL[ordersGroup] + '</b> (' + list.length + ' dari ' + cnt('tindakan') + ' pesanan yang perlu tindakan).</div><button class="btn text sm" data-act="clear-group" style="margin-left:auto">Tampilkan semua</button></div>' : '') +
      '<div class="field" style="max-width:480px"><label class="f" for="q">Cari</label><input id="q" class="input" placeholder="Nama / no. HP / no. order" value="' + esc(ordersQuery) + '" data-input="orders-q"></div>' +
      (list.length ? '<div class="tablewrap"><table><thead><tr><th>No. Order</th><th class="hide-md">Masuk</th><th>Customer</th><th class="num hide-md">Item</th><th class="num">Total (Rp)</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (x) {
          var o = x.o, t = L.totals(o), est = o.items.reduce(function (s, i) { return s + i.est_price * i.qty; }, 0);
          var isAct = x.a && x.a.kind === 'action';
          var extra = o.status === 'sourcing' && x.a && x.a.since ? age(x.a.since) : '';
          return '<tr class="click' + (o.status === 'placed' ? ' newrow' : '') + '" data-act="open-order" data-id="' + esc(o.id) + '"><td><a class="mono" href="#/pesanan/' + esc(o.id) + '">' + esc(o.id) + '</a></td><td class="hide-md">' + fmtDT(o.created_at) + '</td><td>' + esc(custName(o)) + '</td><td class="num hide-md">' + o.items.length + '</td><td class="num">' + (t.jual ? num(t.total) : num(est) + '<span class="sub">estimasi</span>') + '</td><td>' + badge(OST, o.status, extra) + (isAct ? '<span class="sub"><b>' + esc(x.a.text) + '</b></span>' : '') + (o.status === 'quoted' && o.payment && o.payment.status === 'pending_verification' ? proofSlot(o, true) : '') + '</td><td><a class="btn text" href="#/pesanan/' + esc(o.id) + '">Buka</a></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="card calm">' + ic('inbox') + '<span>Tidak ada pesanan yang cocok dengan filter ini.</span><button class="btn sec sm" data-act="filter" data-v="semua">Hapus filter</button></div>');
  }

  // ---------- Detail pesanan ----------
  var STEPS = [['placed', 'Pesanan masuk'], ['sourcing', 'Cek ketersediaan'], ['quoted', 'Menunggu bayar'], ['paid', 'Lunas'], ['fulfilling', 'Diproses'], ['received', 'Barang di David'], ['shipped', 'Dikirim'], ['completed', 'Selesai']];
  function stepper(o) {
    var order = STEPS.map(function (s) { return s[0]; });
    var idx = order.indexOf(o.status), dead = idx < 0;
    if (dead) { // dibatalkan/kedaluwarsa: berhenti di langkah terakhir yang pernah dicapai
      idx = 0; (o.history || []).forEach(function (h) { var i = order.indexOf(h.status); if (i > idx) idx = i; });
    }
    return '<ol class="stepper' + (dead ? ' dead' : '') + '">' + STEPS.map(function (s, i) {
      var h = (o.history || []).filter(function (x) { return x.status === s[0]; })[0];
      var cls = i < idx || (i === idx && (o.status === 'completed' || dead)) ? 'done' : i === idx ? 'now' : '';
      if (dead && i === idx) cls = 'done now';
      return '<li class="' + cls + '"' + (cls.indexOf('now') >= 0 && !dead ? ' aria-current="step"' : '') + '><span class="dot">' + (cls.indexOf('done') >= 0 ? ic('check') : '') + '</span>' + s[1] + (h ? '<time>' + fmtDT(h.at) + '</time>' : '') + '</li>';
    }).join('') + '</ol>';
  }

  function itemRow(o, d, it) {
    var ps = L.itemPoState(o, d.pos, it), canAct = ['placed', 'sourcing'].indexOf(o.status) >= 0;
    var showPrice = it.final_price != null && L.isBillable(it);
    var poCol = ps.map(function (u) {
      var labels = { nopo: 'belum ada PO', draft: 'PO draf', waiting: 'menunggu balasan', available: 'tersedia', unavailable: 'tidak tersedia' };
      var ids = u.pos.map(function (p) { return '<a class="mono" href="#/po/' + esc(p.id) + '">' + esc(p.id.slice(-9)) + '</a>'; }).join(', ');
      return '<div>' + (u.unit.label ? '<span class="muted">' + u.unit.label + ': </span>' : '') + labels[u.state] + (ids ? ' · ' + ids : '') + '</div>';
    }).join('');
    var acts = '';
    if (canAct && it.item_status === 'unavailable') acts = '<div class="row" style="margin-top:6px"><button class="btn sm sec" data-act="re-po" data-id="' + esc(o.id) + '">Cari distributor lain</button>' +
      (it.kind !== 'rakitan' ? '<button class="btn sm sec" data-act="alt" data-id="' + esc(o.id) + '" data-line="' + it.line_id + '">Tawarkan alternatif</button>' : '') +
      (it.manual ? '' : '<button class="btn sm text" data-act="mark-unavail" data-id="' + esc(o.id) + '" data-line="' + it.line_id + '">Tandai tidak tersedia</button>') + '</div>';
    if (canAct && it.item_status === 'pending' && ps.every(function (u) { return u.state !== 'draft' && u.state !== 'waiting'; }) && false) acts = '';
    if (['sourcing', 'quoted'].indexOf(o.status) >= 0 && it.item_status !== 'declined' && L.isBillable(it) && it.item_status !== 'received')
      acts += '<div style="margin-top:6px"><button class="btn sm text" data-act="decline" data-id="' + esc(o.id) + '" data-line="' + it.line_id + '">Customer menolak item ini</button></div>';
    var rak = '';
    if (it.kind === 'rakitan' && it.components) {
      rak = '<span class="sub">' + L.unitsOf(it).map(function (u) { return u.label + ': ' + esc(u.name) + (u.variant ? ' (' + esc(u.variant) + ')' : ''); }).join(' · ') + ' · rakit ' + rp(it.components.assembly_fee || 0) + '</span>';
    }
    return '<tr><td>' + esc(itemLabel(it)) + (it.original ? '<span class="sub">Alternatif untuk ' + esc(it.original.name) + '</span>' : '') + rak + acts + '</td><td class="num">' + it.qty + '</td><td class="num">' + num(it.est_price) + '</td><td class="num">' + (showPrice ? num(it.final_price) : '—') +
      '</td><td>' + badge2(IST, it.item_status) + '</td><td class="small">' + poCol + '</td></tr>';
  }
  function badge2(map, k) { var m = map[k] || [k, 'neutral']; return '<span class="badge badge--' + m[1] + '">' + esc(m[0]) + '</span>'; }

  function pgOrder(id) {
    var d = getData(), o = d.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return '<h1>Pesanan tidak ditemukan</h1><p><a href="#/pesanan">Kembali ke Pesanan</a></p>';
    var pos = d.pos.filter(function (p) { return p.order_id === id; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    var t = L.totals(o), est = o.items.reduce(function (s, i) { return s + i.est_price * i.qty; }, 0), st = o.status;
    var elig = L.eligibleUnits(o, d.pos), pend = o.items.filter(function (i) { return i.item_status === 'pending'; });
    var unavail = o.items.filter(function (i) { return i.item_status === 'unavailable'; });
    var nextHtml = '';

    if (st === 'placed' || st === 'sourcing') {
      var rd = L.quoteReady(o, d.pos);
      nextHtml += '<div class="row">' +
        (elig.length ? '<a class="btn" href="#/pesanan/' + esc(id) + '/po" data-act="start-wiz" data-id="' + esc(id) + '">' + ic('send') + 'Buat PO (' + elig.length + ' item belum punya PO)</a>' : '') +
        (st === 'sourcing' ? (rd.ok ? '<a class="btn ' + (elig.length ? 'sec' : '') + '" href="#/pesanan/' + esc(id) + '/harga" data-act="start-quote" data-id="' + esc(id) + '">Susun harga final</a>' : '<button class="btn sec" disabled aria-disabled="true">Susun harga final</button>') : '') + '</div>' +
        (st === 'sourcing' && !rd.ok ? '<p class="why">Susun harga final belum bisa: ' + esc(rd.reason) + '</p>' : '');
    } else if (st === 'quoted') {
      var pm = o.payment || {}, deadMs = L.ms(o.pay_deadline);
      nextHtml += '<p>Batas bayar: <b>' + fmtDT(o.pay_deadline) + '</b> (' + (deadMs > Date.now() ? 'sisa ' + age(2 * Date.now() - deadMs) : 'lewat') + ')</p>';
      if (pm.status === 'pending_verification') {
        nextHtml += proofCard(o, t);
        nextHtml +=
          '<div class="row"><button class="btn" data-act="verify-ok" data-id="' + esc(id) + '">Terima pembayaran</button><button class="btn danger" data-act="verify-no" data-id="' + esc(id) + '">Tolak bukti…</button></div>';
      } else {
        nextHtml += (pm.status === 'rejected' ? note('bad', 'alert', 'Bukti terakhir ditolak: ' + esc(pm.reason || '') + '. Menunggu customer unggah ulang.') : '<p class="muted">Menunggu customer transfer dan unggah bukti.</p>') +
          '<div class="row"><button class="btn sec" data-act="extend" data-id="' + esc(id) + '">Perpanjang 24 jam</button><button class="btn sec" data-act="pull" data-id="' + esc(id) + '">Tarik harga final</button><button class="btn text" data-act="sim-proof" data-id="' + esc(id) + '">Demo: simulasikan customer unggah bukti</button></div>';
      }
      nextHtml += '<div class="row" style="margin-top:12px"><button class="btn sec" data-act="show-quote-wa" data-id="' + esc(id) + '">' + ic('send') + 'Kirim ulang harga final via WA</button></div>';
    } else if (st === 'paid') {
      nextHtml += '<p>Pesanan sudah lunas. Konfirmasi beli ke tiap distributor lewat WA (tombol ada di kartu PO di bawah).</p>';
    } else if (st === 'fulfilling') {
      var rec = 0, tot = 0;
      pos.forEach(function (p) { p.items.forEach(function (pi) { if (pi.chosen) { tot++; if (pi.received_qty >= pi.qty) rec++; } }); });
      nextHtml += '<p><b>' + rec + ' dari ' + tot + ' item diterima.</b> Catat penerimaan per item di kartu PO di bawah.</p>';
    } else if (st === 'received') {
      var rak = o.items.filter(function (i) { return i.kind === 'rakitan' && L.isBillable(i); });
      nextHtml += rak.map(function (i) { return '<label class="radiorow" style="min-height:56px"><input type="checkbox" data-act="assembly" data-id="' + esc(id) + '" data-line="' + i.line_id + '"' + (o.assembly && o.assembly[i.line_id] ? ' checked' : '') + '> Sudah dirakit: ' + esc(itemLabel(i)) + '</label>'; }).join('') +
        '<div class="row"><button class="btn" data-act="ship" data-id="' + esc(id) + '">' + ic('truck') + 'Tandai dikirim</button></div>';
    } else if (st === 'shipped') {
      nextHtml += '<p>' + shipInfo(o) + '</p><div class="row"><button class="btn sec" data-act="ship-wa" data-id="' + esc(id) + '">' + (L.isSelfShip(o.shipment) ? 'Kabari customer via WA' : 'Kirim resi via WA') + '</button><button class="btn text" data-act="complete" data-id="' + esc(id) + '">Demo: tandai selesai (customer konfirmasi)</button></div>';
    } else if (st === 'cancelled' || st === 'expired') {
      nextHtml += '<p class="muted">' + (st === 'cancelled' ? 'Dibatalkan: ' + esc(o.cancel_reason || '') : 'Batas bayar lewat tanpa bukti.') + '</p>' +
        (o.refund ? note(o.refund.status === 'perlu_ditransfer' ? 'bad' : 'ok', 'wallet', '<b>Refund ' + rp(o.refund.amount) + ':</b> ' + (o.refund.status === 'perlu_ditransfer' ? 'perlu ditransfer ke customer.' : 'sudah ditransfer.')) + (o.refund.status === 'perlu_ditransfer' ? '<button class="btn" data-act="refund-done" data-id="' + esc(id) + '">Tandai refund sudah ditransfer</button>' : '') : '');
    } else nextHtml += '<p class="muted">Tidak ada tindakan lagi.</p>';
    var inc = L.inconsistency(o, d.pos);
    if (inc) nextHtml = '<div class="note bad" role="alert">' + ic('alert') + '<div><b>Data PO tidak konsisten.</b> Pesanan berstatus ' + esc(OST[st] ? OST[st][0] : st) + ', tetapi tidak ada PO aktif yang menutupi: ' + esc(inc.lines.join(', ')) + '. ' + (inc.cancelled.length ? 'PO terbatal otomatis bisa dipulihkan: ' + inc.cancelled.map(function (pid) { return '<button class="btn sm" data-act="restore-po" data-id="' + esc(pid) + '">Pulihkan ' + esc(pid) + '</button>'; }).join(' ') : 'Buat PO baru atau hubungi Kevin.') + '</div></div>' + nextHtml;

    var warn = '';
    if (unavail.length && ['placed', 'sourcing'].indexOf(st) >= 0) warn = note('partial', 'alert', '<b>' + unavail.length + ' item tidak tersedia — tanya customer</b> atau cari di distributor lain / tawarkan alternatif (tombol di baris item).');

    var profitCard = '';
    if (t.jual) profitCard = '<section class="card"><h2>Untung pesanan <span class="badge badge--neutral">hanya terlihat David</span></h2><div class="tablewrap"><table><tbody>' +
      '<tr><td>Total Harga Distributor</td><td class="num">' + rp(t.modal) + '</td></tr><tr><td>Total harga jual barang</td><td class="num">' + rp(t.jual) + '</td></tr>' +
      '<tr class="total"><td>Untung</td><td class="num ' + (t.untung <= 0 ? 'loss' : 'profit') + '">' + rp(t.untung) + ' · ' + t.pct.toFixed(1).replace('.', ',') + '%</td></tr>' +
      '<tr><td class="muted">Ongkir (dipisah, bukan untung)</td><td class="num">' + rp(t.ongkir) + '</td></tr></tbody></table></div></section>';

    var rows = o.items.map(function (it) { return itemRow(o, d, it); }).join('');
    var hist = (o.history || []).slice().reverse().map(function (h) { return '<tr><td style="white-space:nowrap">' + fmtDT(h.at) + '</td><td>' + badge(OST, h.status) + '</td><td>' + esc(h.by) + '</td><td>' + esc(h.note) + '</td></tr>'; }).join('');
    var wizBack = '';

    return '<a class="btn text" href="#/pesanan">' + ic('back') + 'Kembali ke Pesanan</a>' +
      pageHead('<span class="mono">' + esc(o.id) + '</span> <button class="btn text sm" data-act="copy" data-v="' + esc(o.id) + '" aria-label="Salin nomor order">' + ic('copy') + 'Salin</button>', badge(OST, st) + (o.sample ? '<span class="sample-tag" data-sample>CONTOH</span>' : ''),
        esc(custName(o)) + ' · ' + esc(o.customer.wa) + ' · <a href="' + L.waLink(o.customer.wa, 'Halo, soal pesanan ' + o.id) + '" target="_blank" rel="noopener">Hubungi via WhatsApp</a>') +
      '<section class="card"><h2>Perkembangan</h2>' + stepper(o) + '</section>' +
      '<section class="card"><h2>Langkah berikutnya</h2>' + warn + nextHtml + (L.CANCELLABLE.indexOf(st) >= 0 ? '<div class="row" style="margin-top:16px"><span class="spacer"></span><button class="btn danger sm" data-act="cancel" data-id="' + esc(id) + '">Batalkan pesanan</button></div>' : '') + '</section>' +
      '<section class="card"><h2>Item pesanan</h2><div class="tablewrap"><table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Harga est. (Rp)</th><th class="num">Harga final (Rp)</th><th>Status item</th><th>PO</th></tr></thead><tbody>' + rows +
      '<tr class="total"><td>' + (t.jual ? 'Total tagihan (barang + ongkir ' + num(t.ongkir) + ')' : 'Total estimasi') + '</td><td></td><td class="num">' + num(est) + '</td><td class="num">' + (t.jual ? num(t.total) : '—') + '</td><td></td><td></td></tr></tbody></table></div></section>' +
      '<section><h2>PO terkait</h2>' + (pos.length ? pos.map(function (p) { return poCard(p, o, false); }).join('') : '<div class="card calm">' + ic('file') + '<span>Belum ada PO untuk pesanan ini.</span></div>') + '</section>' +
      profitCard +
      '<div class="grid2"><section class="card"><h2>Customer & pengiriman</h2><div class="stack small"><div><b>' + esc(custName(o)) + '</b></div><div>' + esc(o.customer.address) + '</div>' + (o.customer.note ? '<div class="muted">Catatan: ' + esc(o.customer.note) + '</div>' : '') +
      '<div>Pengiriman: ' + (o.shipment ? shipInfo(o) : '<span class="muted">belum dikirim</span>') + '</div></div></section>' +
      '<section class="card"><h2>Pembayaran</h2><div class="stack small"><div>Status: <b>' + ({ none: 'Belum ada bukti', pending_verification: 'Bukti menunggu verifikasi', verified: 'Terverifikasi', rejected: 'Bukti ditolak' }[o.payment.status] || o.payment.status) + '</b></div>' +
      (o.payment.proof_name ? '<div>Bukti: <span class="mono">' + esc(o.payment.proof_name) + '</span></div>' : '') + (o.payment.amount != null ? '<div>Nominal diklaim: ' + rp(o.payment.amount) + '</div>' : '') + '<div>Batas bayar: ' + fmtDT(o.pay_deadline) + '</div></div></section></div>' +
      '<section class="card" style="margin-top:20px"><h2>Riwayat</h2><div class="tablewrap"><table><thead><tr><th>Waktu</th><th>Status</th><th>Oleh</th><th>Catatan</th></tr></thead><tbody>' + hist + '</tbody></table></div></section>';
  }

  // ---------- kartu PO (dipakai di detail pesanan & daftar PO) ----------
  function poCard(po, o, showOrder) {
    var d = null, items = po.items.filter(function (x) { return !x.superseded; });
    var ost = o ? o.status : '', ageTxt = '';
    if (po.status === 'sent' && po.sent_at) ageTxt = age(po.sent_at);
    var late = po.status === 'sent' && ageHrs(po.sent_at) > 24;
    var canReceive = po.status === 'confirmed' && ost === 'fulfilling';
    var rows = items.map(function (pi) {
      var key = L.unitKey(pi), ans = pi.available === true ? '<span class="badge badge--ok">Ada</span>' : pi.available === false ? '<span class="badge badge--bad">Tidak ada</span>' : '<span class="badge badge--neutral">Belum dijawab</span>';
      var recv = '';
      if (pi.chosen && ['confirmed', 'fulfilled'].indexOf(po.status) >= 0) {
        recv = canReceive ? '<div class="row"><input class="input num" style="width:84px" type="number" min="0" max="' + pi.qty + '" value="' + pi.received_qty + '" id="rcv-' + esc(po.id + '-' + key) + '" aria-label="Jumlah diterima ' + esc(pi.name) + '"> <span>dari ' + pi.qty + '</span><button class="btn sm sec" data-act="receive" data-po="' + esc(po.id) + '" data-key="' + esc(key) + '">Catat diterima</button></div>' : pi.received_qty + ' dari ' + pi.qty;
      }
      var move = po.status === 'draft' ? '<button class="btn sm text" data-act="move" data-po="' + esc(po.id) + '" data-key="' + esc(key) + '">Pindah distributor</button>' : '';
      return '<tr><td>' + esc(pi.name) + (pi.variant ? ' — ' + esc(pi.variant) : '') + (pi.component ? '<span class="sub">komponen bet rakitan: ' + ({ blade: 'blade', fh: 'karet FH', bh: 'karet BH' }[pi.component]) + '</span>' : '') + (pi.chosen ? '<span class="sub">dipakai untuk pesanan ini</span>' : '') + '</td><td class="num">' + pi.qty + '</td><td>' + ans + '</td><td class="num">' + (pi.cost_price != null ? num(pi.cost_price) : '—') + '</td><td>' + (pi.eta ? fmtD(pi.eta) : '—') + '</td><td>' + (recv || move) + '</td></tr>';
    }).join('');
    var foot = '';
    if (po.status === 'draft') foot = '<button class="btn" data-act="send-po" data-po="' + esc(po.id) + '">' + ic('send') + 'Kirim via WA ke ' + esc(DS.distributorName(po.distributor_id)) + '</button>';
    if (['sent', 'responded', 'rejected'].indexOf(po.status) >= 0 && ['placed', 'sourcing'].indexOf(ost) >= 0)
      foot += '<button class="btn ' + (po.status === 'sent' ? '' : 'sec') + '" data-act="reply" data-po="' + esc(po.id) + '">' + ic('reply') + (po.status === 'sent' ? 'Catat balasan' : 'Ubah balasan') + '</button>';
    if (po.status === 'sent') foot += '<button class="btn sec" data-act="send-po-again" data-po="' + esc(po.id) + '">Kirim ulang via WA</button>';
    if (po.status === 'responded' && ['paid', 'fulfilling'].indexOf(ost) >= 0 && items.some(function (x) { return x.chosen; }))
      foot += '<button class="btn" data-act="confirm-po" data-po="' + esc(po.id) + '">' + ic('clip') + 'Konfirmasi beli via WA</button>';
    var hist = (po.responses || []).length ? '<details><summary>Riwayat balasan (' + po.responses.length + ')</summary><div class="tablewrap"><table><thead><tr><th>Waktu</th><th>Item</th><th>Jawaban</th><th class="num">Harga Distributor (Rp)</th><th>ETA</th></tr></thead><tbody>' + po.responses.map(function (r) {
      var pi = po.items.filter(function (x) { return x.line_id === r.line_id && x.component === r.component; })[0];
      return '<tr><td>' + fmtDT(r.at) + '</td><td>' + esc(pi ? pi.name : r.line_id) + '</td><td>' + (r.available ? 'Ada' : 'Tidak ada') + (r.note ? ' · ' + esc(r.note) : '') + '</td><td class="num">' + (r.cost_price != null ? num(r.cost_price) : '—') + '</td><td>' + (r.eta ? fmtD(r.eta) : '—') + '</td></tr>';
    }).join('') + '</tbody></table></div></details>' : '';
    return '<div class="po"><header><a class="mono" href="#/po/' + esc(po.id) + '">' + esc(po.id) + '</a><strong>' + esc(DS.distributorName(po.distributor_id)) + '</strong>' + badge(PST, po.status, late ? ageTxt : (po.status === 'sent' && ageHrs(po.sent_at) > 24 ? ageTxt : '')) +
      (showOrder && o ? '<span class="spacer"></span><a href="#/pesanan/' + esc(o.id) + '" class="mono">' + esc(o.id) + '</a>' : '') + '</header>' +
      '<div class="body"><div class="tablewrap"><table><thead><tr><th>Item</th><th class="num">Qty</th><th>Jawaban</th><th class="num">Harga Distributor / unit (Rp)</th><th>Estimasi tiba</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' + hist + '</div>' +
      (foot ? '<footer>' + foot + '</footer>' : '') + '</div>';
  }

  // ---------- Daftar PO ----------
  function pgPos() {
    var d = getData();
    var list = d.pos.slice().sort(function (a, b) { return a.id < b.id ? 1 : -1; });
    return pageHead('Daftar PO') + (list.length ? '<div class="tablewrap"><table><thead><tr><th>No. PO</th><th>Distributor</th><th>Pesanan</th><th class="num">Item</th><th>Dikirim</th><th>Status</th></tr></thead><tbody>' +
      list.map(function (p) {
        var late = p.status === 'sent' && ageHrs(p.sent_at) > 24;
        return '<tr class="click" data-act="open-po" data-id="' + esc(p.id) + '"><td><a class="mono" href="#/po/' + esc(p.id) + '">' + esc(p.id) + '</a></td><td>' + esc(DS.distributorName(p.distributor_id)) + '</td><td><span class="mono">' + esc(p.order_id) + '</span></td><td class="num">' + p.items.filter(function (x) { return !x.superseded; }).length + '</td><td>' + (p.sent_at ? fmtDT(p.sent_at) : '—') + '</td><td>' + badge(PST, p.status, late ? age(p.sent_at) : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="card calm">' + ic('file') + '<span>Belum ada PO.</span></div>');
  }
  function pgPoDetail(id) {
    var po = poById(id); if (!po) return '<h1>PO tidak ditemukan</h1><p><a href="#/po">Kembali</a></p>';
    var o = orderById(po.order_id);
    return '<a class="btn text" href="#/po">' + ic('back') + 'Kembali ke Daftar PO</a>' + pageHead('<span class="mono">' + esc(po.id) + '</span>', badge(PST, po.status)) +
      poCard(po, o, true) + '<section class="card"><h2>Teks PO yang dikirim ke distributor</h2><pre class="pre">' + esc(L.poText(po)) + '</pre><p class="hint">Teks PO tidak memuat nama, alamat, atau nomor customer.</p></section>';
  }

  // ---------- Wizard buat PO ----------
  function pgWizard(id) {
    var d = getData(), o = d.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return '<h1>Pesanan tidak ditemukan</h1>';
    var elig = L.eligibleUnits(o, d.pos);
    if (!wiz || wiz.orderId !== id) wiz = { orderId: id, step: 1, sel: {} };
    var dists = DS.getDistributors();
    var s = wiz.step;
    var head = '<a class="btn text" href="#/pesanan/' + esc(id) + '" data-act="wiz-exit">' + ic('back') + 'Kembali ke pesanan</a>' + pageHead('Buat PO — <span class="mono">' + esc(id) + '</span>') +
      '<div class="steps"><span class="' + (s === 1 ? 'on' : '') + '">1. Pilih item</span><span class="' + (s === 2 ? 'on' : '') + '">2. Pilih distributor</span><span class="' + (s === 3 ? 'on' : '') + '">3. Periksa & buat</span></div>';
    if (!elig.length) return head + '<div class="card calm">' + ic('check-circle') + '<span>Semua item sudah punya PO aktif.</span></div>';
    var chosen = elig.filter(function (u) { return u.key in wiz.sel; });
    if (s === 1) {
      return head + '<section class="card"><h2>Pilih item yang mau dipesan</h2>' + elig.map(function (u) {
        var on = u.key in wiz.sel;
        return '<label class="radiorow' + (on ? ' on' : '') + '"><input type="checkbox" data-act="wiz-toggle" data-key="' + esc(u.key) + '"' + (on ? ' checked' : '') + '><span><b>' + esc(u.name) + '</b>' + (u.variant ? ' — ' + esc(u.variant) : '') + ' × ' + u.qty + (u.label ? '<span class="muted"> · ' + u.label + '</span>' : '') + '</span></label>';
      }).join('') + '<div class="row end" style="margin-top:12px"><button class="btn sec" data-act="wiz-all">Pilih semua</button><button class="btn" data-act="wiz-next"' + (chosen.length ? '' : ' disabled aria-disabled="true"') + '>Lanjut: pilih distributor</button></div>' + (chosen.length ? '' : '<p class="why" style="text-align:right">Centang minimal satu item dulu.</p>') + '</section>';
    }
    if (s === 2) {
      var opts = '<option value="">— pilih distributor —</option>' + dists.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('');
      return head + '<section class="card"><h2>Pilih distributor untuk tiap item</h2><p class="muted small">Item bisa dipecah ke beberapa distributor — satu PO per distributor. Pemetaan brand → distributor belum diketahui, jadi dipilih manual.</p>' +
        '<div class="field" style="max-width:420px"><label class="f" for="all-d">Pakai satu distributor untuk semua</label><select id="all-d" class="input" data-act="wiz-all-dist">' + opts + '</select></div>' +
        '<div class="tablewrap"><table><thead><tr><th>Item</th><th>Distributor</th></tr></thead><tbody>' + chosen.map(function (u) {
          return '<tr><td>' + esc(u.name) + (u.variant ? ' — ' + esc(u.variant) : '') + ' × ' + u.qty + (u.label ? '<span class="sub">' + u.label + '</span>' : '') + '</td><td><select class="input" data-act="wiz-dist" data-key="' + esc(u.key) + '" aria-label="Distributor untuk ' + esc(u.name) + '">' +
            dists.reduce(function (h, x) { return h + '<option value="' + esc(x.id) + '"' + (wiz.sel[u.key] === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }, '<option value=""' + (wiz.sel[u.key] ? '' : ' selected') + '>— pilih distributor —</option>') + '</select></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="row" style="margin-top:12px"><button class="btn sec" data-act="wiz-back">Kembali</button><span class="spacer"></span><button class="btn" data-act="wiz-next">Lanjut: periksa</button></div><div id="wiz-err"></div></section>';
    }
    // step 3
    var by = {};
    chosen.forEach(function (u) { (by[wiz.sel[u.key]] = by[wiz.sel[u.key]] || []).push(u); });
    var s2 = DS.getSettings();
    return head + '<section class="card"><h2>Periksa sebelum dibuat</h2><p>Akan dibuat <b>' + Object.keys(by).length + ' PO draf</b>. PO baru dikirim ke distributor setelah kamu menekan "Kirim via WA" di tiap PO.</p>' +
      Object.keys(by).map(function (dk) {
        var fake = { id: '(nomor PO dibuat saat disimpan)', distributor_id: dk, items: by[dk].map(function (u) { return { name: u.name, variant: u.variant, qty: u.qty }; }) };
        return '<h3>' + esc(DS.distributorName(dk)) + '</h3><pre class="pre">' + esc(L.poText(fake)).replace(esc(s2.address), '<b>' + esc(s2.address) + '</b>') + '</pre>';
      }).join('') + '<p class="hint">Alamat kirim = alamat David (tebal di atas), bukan alamat customer.</p><div class="row" style="margin-top:12px"><button class="btn sec" data-act="wiz-back">Kembali</button><span class="spacer"></span><button class="btn" data-act="wiz-create">Buat ' + Object.keys(by).length + ' PO draf</button></div></section>';
  }

  // ---------- Susun harga final ----------
  function buildQuoteState(id) {
    var d = getData(), o = d.orders.filter(function (x) { return x.id === id; })[0], s = DS.getSettings(), lines = {};
    o.items.forEach(function (it) {
      if (!L.isBillable(it)) return;
      var offers = it.kind === 'rakitan' ? [] : L.offersOf(d.pos, o, it);
      var pick = null;
      if (it.kind !== 'rakitan') {
        pick = offers.some(function (e) { return e.po.distributor_id === it.distributor_id; }) ? it.distributor_id : (offers.slice().sort(function (a, b) { return a.pi.cost_price - b.pi.cost_price; })[0] || { po: {} }).po.distributor_id;
      }
      var c = L.costOf(d.pos, o, it, pick), extra = L.assemblyFee(it);
      var type = it.margin_type || 'pct', val, price;
      if (it.final_price != null && it.cost_price === c.cost) { val = it.margin_value; price = it.final_price; }
      else { type = 'pct'; val = s.margins[L.categoryOf(it)]; price = L.priceFrom(c.cost, 'pct', val, extra); }
      lines[it.line_id] = { pick: pick, cost: c.cost, missing: c.missing, type: type, value: val, price: price, extra: extra, loss: false };
    });
    return { orderId: id, lines: lines, shipping: o.shipping_fee != null ? o.shipping_fee : 0, hours: s.pay_hours };
  }
  function pgQuote(id) {
    var d = getData(), o = d.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return '<h1>Pesanan tidak ditemukan</h1>';
    if (o.status !== 'sourcing') return '<a class="btn text" href="#/pesanan/' + esc(id) + '">' + ic('back') + 'Kembali ke pesanan</a><div class="card calm">' + ic('info') + '<span>Harga final hanya bisa disusun saat status "Menunggu balasan distributor".</span></div>';
    var rd = L.quoteReady(o, d.pos);
    if (!rd.ok) return '<a class="btn text" href="#/pesanan/' + esc(id) + '">' + ic('back') + 'Kembali ke pesanan</a><div class="card calm">' + ic('info') + '<span>' + esc(rd.reason) + '</span></div>';
    if (!quote || quote.orderId !== id) quote = buildQuoteState(id);
    var gone = o.items.filter(function (i) { return !L.isBillable(i); });
    var rows = o.items.filter(L.isBillable).map(function (it) {
      var q = quote.lines[it.line_id], offers = it.kind === 'rakitan' ? [] : L.offersOf(d.pos, o, it);
      var distCell = it.kind === 'rakitan' ? 'Per komponen (termurah)' : offers.length > 1 ? '<select class="input" data-q="pick" data-line="' + it.line_id + '" aria-label="Distributor untuk ' + esc(it.name) + '">' + offers.map(function (e) { return '<option value="' + esc(e.po.distributor_id) + '"' + (q.pick === e.po.distributor_id ? ' selected' : '') + '>' + esc(DS.distributorName(e.po.distributor_id)) + ' — ' + num(e.pi.cost_price) + '</option>'; }).join('') + '</select>' : esc(DS.distributorName(q.pick));
      return '<tr data-line="' + it.line_id + '"><td>' + esc(itemLabel(it)) + '<span class="sub">Kategori: ' + esc(L.categoryOf(it)) + ' · est. katalog ' + rp(it.est_price) + (q.extra ? ' · biaya rakit ' + rp(q.extra) + ' ikut di harga jual' : '') + '</span></td>' +
        '<td class="num">' + it.qty + '</td><td>' + distCell + '</td><td class="num" id="cost-' + it.line_id + '">' + num(q.cost) + '</td>' +
        '<td><div class="row" style="flex-wrap:nowrap"><input class="input num" style="width:110px" inputmode="decimal" data-q="mval" data-line="' + it.line_id + '" aria-label="Margin ' + esc(it.name) + '" value="' + esc(q.type === 'rp' ? num(q.value) : String(q.value).replace('.', ',')) + '">' +
        '<span class="seg" role="group" aria-label="Satuan margin"><button type="button" data-q="mtype" data-line="' + it.line_id + '" data-v="pct" aria-pressed="' + (q.type === 'pct') + '">%</button><button type="button" data-q="mtype" data-line="' + it.line_id + '" data-v="rp" aria-pressed="' + (q.type === 'rp') + '">Rp</button></span></div></td>' +
        '<td><div class="rp"><input class="input num" style="width:160px" inputmode="numeric" data-q="price" data-line="' + it.line_id + '" aria-label="Harga jual per unit ' + esc(it.name) + '" value="' + num(q.price) + '"></div></td>' +
        '<td class="num" id="profit-' + it.line_id + '"></td></tr>' +
        '<tr data-warn="' + it.line_id + '" hidden><td colspan="7"><div class="note bad" style="margin:0">' + ic('alert') + '<div><b>Jual rugi / tanpa untung:</b> harga jual tidak di atas harga distributor. Masih boleh disimpan, tapi dicatat di riwayat.</div></div></td></tr>';
    }).join('');
    return '<a class="btn text" href="#/pesanan/' + esc(id) + '" data-act="quote-exit">' + ic('back') + 'Kembali ke pesanan</a>' + pageHead('Susun harga final — <span class="mono">' + esc(id) + '</span>') +
      (gone.length ? note('partial', 'alert', '<b>' + gone.length + ' item tidak ikut ditagih:</b> ' + gone.map(function (g) { return esc(g.name); }).join(', ')) : '') +
      '<section class="card"><p class="muted small" style="margin-top:0">Margin awal dari Pengaturan (per kategori), dibulatkan ke atas Rp1.000. Ubah margin (% atau Rp) atau ubah harga jual langsung — yang lain ikut dihitung. Harga yang sudah dikirim ke customer tidak berubah bila Pengaturan diganti.</p>' +
      '<div class="tablewrap"><table><thead><tr><th>Item</th><th class="num">Qty</th><th>Distributor</th><th class="num">Harga Distributor / unit (Rp)</th><th>Margin</th><th>Harga jual / unit</th><th class="num">Untung (Rp)</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' +
      '<div class="grid2"><section class="card"><h2>Ongkir & batas bayar</h2><div class="field"><label class="f" for="ship">Ongkir (diisi manual)</label><div class="rp"><input id="ship" class="input num" inputmode="numeric" data-q="ship" value="' + num(quote.shipping) + '"></div></div>' +
      '<div class="field"><label class="f" for="hrs">Batas bayar (jam dari sekarang)</label><input id="hrs" class="input num" inputmode="numeric" data-q="hours" value="' + quote.hours + '"></div></section>' +
      '<section class="card"><h2>Ringkasan <span class="badge badge--neutral">hanya terlihat David</span></h2><div class="tablewrap"><table><tbody><tr><td>Total Harga Distributor</td><td class="num" id="s-modal"></td></tr><tr><td>Total harga jual barang</td><td class="num" id="s-jual"></td></tr><tr class="total"><td>Total untung</td><td class="num" id="s-untung"></td></tr><tr><td class="muted">Ongkir (bukan untung)</td><td class="num" id="s-ongkir"></td></tr><tr><td><b>Total ditagih ke customer</b></td><td class="num" id="s-total"></td></tr></tbody></table></div></section></div>' +
      '<div class="row end"><a class="btn sec" href="#/pesanan/' + esc(id) + '" data-act="quote-exit">Batal</a><button class="btn" data-act="quote-send">' + ic('send') + 'Kirim ke customer via WA…</button></div><div id="q-err"></div>';
  }
  function qCalc() {
    var d = getData(), o = d.orders.filter(function (x) { return x.id === quote.orderId; })[0], modal = 0, jual = 0, anyLoss = false;
    o.items.filter(L.isBillable).forEach(function (it) {
      var q = quote.lines[it.line_id];
      var profit = (q.price - q.cost) * it.qty, loss = q.price - q.cost - q.extra <= 0; q.loss = loss;
      modal += q.cost * it.qty; jual += q.price * it.qty; if (loss) anyLoss = true;
      var cell = $('#profit-' + it.line_id); if (cell) cell.innerHTML = '<span class="' + (loss ? 'loss' : 'profit') + '">' + (loss ? ic('alert').replace('<svg', '<svg width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"') + ' ' : '') + num(profit) + '</span>';
      var w = $('[data-warn="' + it.line_id + '"]'); if (w) w.hidden = !loss;
      var cc = $('#cost-' + it.line_id); if (cc) cc.textContent = num(q.cost);
    });
    var un = jual - modal, pct = modal > 0 ? un / modal * 100 : 0;
    $('#s-modal').textContent = rp(modal); $('#s-jual').textContent = rp(jual);
    $('#s-untung').innerHTML = '<span class="' + (un <= 0 ? 'loss' : 'profit') + '">' + rp(un) + ' · ' + pct.toFixed(1).replace('.', ',') + '%</span>';
    $('#s-ongkir').textContent = rp(quote.shipping); $('#s-total').textContent = rp(jual + quote.shipping);
    return { modal: modal, jual: jual, anyLoss: anyLoss };
  }
  function bindQuote() { if (quote && $('#s-modal')) qCalc(); }
  function onQuoteInput(el) {
    var k = el.getAttribute('data-q'), ln = el.getAttribute('data-line'), q = ln ? quote.lines[ln] : null;
    if (k === 'ship') { quote.shipping = digits(el.value); }
    else if (k === 'hours') { quote.hours = digits(el.value) || 24; }
    else if (k === 'mval') { var v = q.type === 'rp' ? digits(el.value) : decimal(el.value); q.value = v; q.price = L.priceFrom(q.cost, q.type, v, q.extra); var pi = $('[data-q="price"][data-line="' + ln + '"]'); if (pi) pi.value = num(q.price); }
    else if (k === 'price') { q.price = digits(el.value); q.value = L.marginFrom(q.cost, q.price, q.type, q.extra); var mi = $('[data-q="mval"][data-line="' + ln + '"]'); if (mi) mi.value = q.type === 'rp' ? num(q.value) : String(q.value).replace('.', ','); }
    qCalc();
  }

  // ---------- Distributor / Katalog / Laporan / Pengaturan (versi sederhana) ----------
  function pgDistributor() {
    var d = getData();
    var dl = DS.getDistributors();
    if (!dl.length) return pageHead('Distributor') + '<div class="card calm">' + ic('info') + '<span>Belum ada distributor. Isi tab <span class="mono">distributors</span> di Google Sheet (kolom id, name, wa), lalu klik Tarik ulang di Pengaturan. Panduan: <span class="mono">prototype/gsheet/PANDUAN-ISI-DATA.md</span>.</span></div>';
    return pageHead('Distributor') + '<div class="note info">' + ic('info') + '<div>Nomor WA yang kosong tampil <b>[?]</b> sampai David mengisinya. Pemetaan brand → distributor belum ada — distributor dipilih manual saat membuat PO.</div></div><div class="tablewrap"><table><thead><tr><th>Nama</th><th>Nomor WA</th><th>Catatan</th><th class="num">PO</th><th></th></tr></thead><tbody>' +
      dl.map(function (x) { return '<tr><td><b>' + esc(x.name) + '</b></td><td class="mono">' + (x.wa ? esc(x.wa) : '[?] belum diisi') + '</td><td>' + esc(x.note || '—') + '</td><td class="num">' + d.pos.filter(function (p) { return p.distributor_id === x.id; }).length + '</td><td><button class="btn sm sec" data-act="edit-dist" data-id="' + esc(x.id) + '">Ubah</button></td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function catRows() {
    var C = window.DS_CATALOG; if (!C || !Array.isArray(C.products)) return null;
    var br = {}; (C.brands || []).forEach(function (b) { if (b && typeof b === 'object') br[b.id] = b.name; });
    var cat = {}; (C.categories || []).forEach(function (b) { if (b && typeof b === 'object') cat[b.id] = b.name; });
    return C.products.map(function (p) {
      var price = p.est_price != null ? p.est_price : p.price != null ? p.price : p.price_est != null ? p.price_est : p.price_min != null ? p.price_min : (p.variants && p.variants[0] && (p.variants[0].est_price || p.variants[0].price)) || null;
      return { name: p.name || p.title || '—', brand: br[p.brand] || p.brand_name || (typeof p.brand === 'string' ? p.brand : '—'), hidden: !brandVisible(br[p.brand] || p.brand_name || (typeof p.brand === 'string' ? p.brand : '')), cat: cat[p.category] || p.category_name || (typeof p.category === 'string' ? p.category : '—'), price: price };
    });
  }
  function pgKatalog() {
    var rows = catRows();
    if (!rows) return pageHead('Katalog') + '<div class="card calm">' + ic('tag') + '<span>Katalog belum tersedia (<span class="mono">shared/catalog.js</span> belum ada). Dashboard tetap berjalan memakai data dari pesanan.</span></div>';
    var inc = (window.DS_CATALOG && window.DS_CATALOG.incomplete) || [];
    var incHtml = inc.length ? '<div class="note wait">' + ic('alert') + '<div><b>' + inc.length + ' baris produk belum lengkap dan TIDAK tampil di toko.</b> Perbaiki barisnya di tab <span class="mono">products</span> di Google Sheet.</div></div>' +
      '<div class="tablewrap"><table><thead><tr><th>SKU</th><th>Nama</th><th>Status</th></tr></thead><tbody>' + inc.map(function (r) {
        return '<tr><td class="mono">' + esc(r.sku || '(kosong)') + '</td><td>' + esc(r.name || '(kosong)') + '</td><td><span class="badge badge--wait">data belum lengkap: ' + esc(r.missing.join(', ')) + '</span></td></tr>';
      }).join('') + '</tbody></table></div>' : '';
    if (!rows.length) return pageHead('Katalog', '', 'Hanya baca — isi produk di Google Sheet') + incHtml + (inc.length ? '' : '<div class="card calm">' + ic('tag') + '<span>Belum ada produk. Isi tab <span class="mono">products</span> di Google Sheet (urutan: categories, brands, distributors, products), lalu klik Tarik ulang di Pengaturan. Panduan: <span class="mono">prototype/gsheet/PANDUAN-ISI-DATA.md</span>.</span></div>');
    var q = catQuery.trim().toLowerCase();
    var list = rows.filter(function (r) { return !q || (r.name + ' ' + r.brand + ' ' + r.cat).toLowerCase().indexOf(q) >= 0; });
    return pageHead('Katalog', '', 'Hanya baca — isi atau ubah produk di Google Sheet') + incHtml + '<div class="field" style="max-width:420px"><label class="f" for="cq">Cari produk</label><input id="cq" class="input" value="' + esc(catQuery) + '" data-input="cat-q"></div>' +
      '<div class="tablewrap"><table><thead><tr><th>Produk</th><th>Brand</th><th>Kategori</th><th class="num">Harga est. (Rp)</th></tr></thead><tbody>' + list.slice(0, 300).map(function (r) { return '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.brand) + (r.hidden ? ' <span class="badge badge--wait">Brand disembunyikan</span>' : '') + '</td><td>' + esc(r.cat) + '</td><td class="num">' + (r.price != null ? num(r.price) : '—') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function pgLaporan() {
    var d = getData(), by = {}, sum = { modal: 0, jual: 0 };
    d.orders.forEach(function (o) { by[o.status] = (by[o.status] || 0) + 1; });
    var rows = d.orders.filter(function (o) { var t = L.totals(o); return t.jual && ['cancelled', 'expired'].indexOf(o.status) < 0; }).map(function (o) {
      var t = L.totals(o); sum.modal += t.modal; sum.jual += t.jual;
      return '<tr class="click" data-act="open-order" data-id="' + esc(o.id) + '"><td><a class="mono" href="#/pesanan/' + esc(o.id) + '">' + esc(o.id) + '</a></td><td>' + esc(custName(o)) + '</td><td>' + badge(OST, o.status) + '</td><td class="num">' + num(t.modal) + '</td><td class="num">' + num(t.jual) + '</td><td class="num ' + (t.untung <= 0 ? 'loss' : 'profit') + '">' + num(t.untung) + '</td><td class="num">' + t.pct.toFixed(1).replace('.', ',') + '%</td></tr>';
    }).join('');
    var un = sum.jual - sum.modal;
    return pageHead('Laporan', '<span class="badge badge--neutral">hanya terlihat David</span>') + '<section class="card"><h2>Jumlah pesanan per status</h2><div class="badges">' + Object.keys(by).map(function (k) { return badge(OST, k, by[k] + ' pesanan'); }).join('') + '</div></section>' +
      '<section><h2>Untung per pesanan (yang sudah punya harga final, tidak termasuk batal)</h2><div class="tablewrap"><table><thead><tr><th>No. Order</th><th>Customer</th><th>Status</th><th class="num">Harga Distributor (Rp)</th><th class="num">Jual (Rp)</th><th class="num">Untung (Rp)</th><th class="num">%</th></tr></thead><tbody>' + rows +
      '<tr class="total"><td colspan="3">Total</td><td class="num">' + num(sum.modal) + '</td><td class="num">' + num(sum.jual) + '</td><td class="num">' + num(un) + '</td><td class="num">' + (sum.modal ? (un / sum.modal * 100).toFixed(1).replace('.', ',') : '0') + '%</td></tr></tbody></table></div><p class="hint">Ongkir tidak dihitung sebagai untung.</p></section>';
  }
  function pgPengaturan() {
    var s = DS.getSettings();
    return pageHead('Pengaturan') + '<section class="card" id="sync-card"><h2>Sumber data</h2><div id="sync-box"></div></section><section class="card"><h2>Margin per kategori</h2><p class="muted small">Dipakai sebagai nilai awal saat menyusun harga final. Mengubahnya tidak mengubah harga pesanan yang sudah dikirim ke customer.</p><div class="grid2" id="set-margins">' +
      DS.CATEGORIES.map(function (c) { return '<div class="field"><label class="f" for="m-' + c[0] + '">' + c[1] + ' (%)</label><input id="m-' + c[0] + '" class="input num" inputmode="decimal" data-m="' + c[0] + '" value="' + String(s.margins[c[0]]).replace('.', ',') + '"></div>'; }).join('') + '</div></section>' +
      '<section class="card"><h2>Toko David (tampil di toko online dan alamat kirim di PO)</h2><div class="field"><label class="f" for="s-addr">Alamat lengkap</label><textarea id="s-addr" class="input">' + esc(s.address) + '</textarea></div><div class="field" style="max-width:360px"><label class="f" for="s-wa">WhatsApp David</label><input id="s-wa" class="input" inputmode="tel" placeholder="0812…" value="' + esc(s.david_wa) + '"><div class="hint">Dipakai tombol WhatsApp di toko online. Boleh 08… atau 62….</div></div><div class="field"><label class="f" for="s-hours">Jam operasional</label><input id="s-hours" class="input" placeholder="mis. Senin–Sabtu 09.00–17.00" value="' + esc(s.store_hours || '') + '"><div class="hint">Tampil di footer toko online. Kosong = tidak ditampilkan.</div></div></section>' +
      '<section class="card"><h2>Rekening transfer</h2><div class="grid2"><div class="field"><label class="f" for="s-bank">Bank</label><input id="s-bank" class="input" value="' + esc(s.bank.bank) + '"></div><div class="field"><label class="f" for="s-rek">Nomor rekening</label><input id="s-rek" class="input" value="' + esc(s.bank.no) + '"></div></div><div class="field"><label class="f" for="s-an">Atas nama</label><input id="s-an" class="input" value="' + esc(s.bank.name) + '"></div><div class="field" style="max-width:260px"><label class="f" for="s-hrs">Batas bayar default (jam)</label><input id="s-hrs" class="input num" inputmode="numeric" value="' + s.pay_hours + '"></div></section>' +
      '<div class="row end"><button class="btn" data-act="save-settings">Simpan perubahan</button></div>';
  }

  // ---------- Brand tampil di toko (ADM-21) ----------
  function brandRows() { // dasar = brand katalog; status tampil dari DS (tidak ada di data = tampil)
    var C = window.DS_CATALOG, base = (C && Array.isArray(C.brands) ? C.brands : []).map(function (b) { return { id: b.id, name: b.name }; }), seen = {};
    base.forEach(function (b) { seen[b.id] = true; });
    var stored = [];
    try { if (DS.getBrands) stored = DS.getBrands() || []; } catch (e) { stored = []; }
    stored.forEach(function (b) { if (b && !seen[b.id]) { seen[b.id] = true; base.push({ id: b.id, name: b.name || b.id }); } });
    return base.map(function (b) {
      var vis = true;
      try {
        if (DS.isBrandVisible) vis = DS.isBrandVisible(b.id) !== false;
        else stored.forEach(function (s) { if (s.id === b.id) vis = s.visible !== false; });
      } catch (e) { vis = true; }
      return { id: b.id, name: b.name, visible: vis };
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }
  function pgBrand() {
    var d = getData(), C = window.DS_CATALOG, canSet = !!DS.setBrandVisible, rows = brandRows();
    var st = L.brandStats(d.orders, C && C.products, makeBrandOf());
    var hidden = rows.filter(function (r) { return !r.visible; }).length;
    var head = pageHead('Brand', '', 'Atur brand mana yang terlihat customer di toko');
    if (!rows.length) return head + '<div class="card calm">' + ic('eye') + '<span>Daftar brand belum tersedia (<span class="mono">shared/catalog.js</span> belum ada).</span></div>';
    return head +
      (canSet ? '' : note('wait', 'alert', '<b>Pengaturan brand belum tersedia.</b> Sakelar dimatikan sampai <span class="mono">DS.setBrandVisible</span> ada di <span class="mono">shared/store.js</span>.')) +
      '<div class="note info">' + ic('info') + '<div>Brand yang disembunyikan tidak terlihat customer (katalog, pencarian, filter, pembuat bet rakitan). Di dashboard, produk dan pesanan brand itu <b>tetap terlihat dan tetap bisa diproses</b>. ' + (hidden ? '<b>' + hidden + ' brand sedang disembunyikan.</b>' : 'Semua brand sedang tampil.') + '</div></div>' +
      '<div class="tablewrap"><table class="brands"><thead><tr><th>Brand</th><th class="num">Produk</th><th class="num">Pesanan aktif</th><th>Tampil di toko</th></tr></thead><tbody>' +
      rows.map(function (b) {
        var s = st[b.name] || { products: 0, activeOrders: 0 };
        return '<tr' + (b.visible ? '' : ' class="off"') + '><td><b>' + esc(b.name) + '</b>' + (b.visible ? '' : '<span class="sub">Disembunyikan dari customer</span>') + '</td><td class="num">' + s.products + '</td><td class="num">' + s.activeOrders + '</td>' +
          '<td><div class="swrow"><button type="button" class="switch" role="switch" aria-checked="' + b.visible + '" aria-label="Tampil di toko: ' + esc(b.name) + '" data-act="brand-toggle" data-id="' + esc(b.id) + '" data-name="' + esc(b.name) + '"' + (canSet ? '' : ' disabled') + '><span class="knob"></span></button><span class="swlab">' + (b.visible ? 'Tampil' : 'Disembunyikan') + '</span></div></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="hint">Pesanan aktif = pesanan berstatus Baru sampai Dikirim yang berisi brand itu (termasuk komponen bet rakitan). Pencatatan ke log audit (ADM-19) belum ada di prototipe.</p>';
  }
  function setBrand(id, name, on, products) {
    try { DS.setBrandVisible(id, on); } catch (e) { toast('Gagal menyimpan: ' + (e && e.message), 'err'); return; }
    render();
    if (on) toast(name + ' tampil lagi di toko.');
    else toast(name + ' disembunyikan dari toko' + (products ? ' — ' + products + ' produk tidak terlihat customer.' : '.'), null, { label: 'Batalkan', fn: function () { setBrand(id, name, true, 0); } });
  }

  // (data contoh penjualan dihapus: dashboard tidak lagi membuat pesanan/produk contoh; INF-01)

  function mountSync() {
    var el = $('#sync-box'); if (!el) return;
    if (DS.sync && typeof DS.sync.renderSettings === 'function') {
      try { DS.sync.renderSettings(el); } catch (e) { el.innerHTML = '<p class="muted">Pengaturan sumber data gagal dimuat: ' + esc(e && e.message) + '</p>'; }
    } else el.innerHTML = '<p class="muted">Pengaturan sumber data belum tersedia.</p>';
  }
  function syncBadge() { try { return DS.sync && typeof DS.sync.badgeHtml === 'function' ? DS.sync.badgeHtml() || '' : ''; } catch (e) { return ''; } }

  // ---------- Bukti transfer (foto dimuat langsung dari Drive lewat proof_get; cache di memori per sesi) ----------
  var proofCache = {}; // fileId -> { state:'loading'|'ok'|'err', kind:'img'|'pdf', url, msg }
  function proofSlot(o, thumb) {
    var pm = o.payment || {}; if (!pm.proof_file_id) return '';
    return '<span class="' + (thumb ? 'pthumb' : 'pbox') + '" data-proof-file="' + esc(pm.proof_file_id) + '" data-proof-order="' + esc(o.id) + '"' + (thumb ? ' data-thumb="1"' : '') + '><span class="skel" role="status" aria-label="Memuat bukti transfer"></span></span>';
  }
  function proofHtml(c, orderId, fileId, thumb) {
    if (!c || c.state === 'loading') return '<span class="skel" role="status" aria-label="Memuat bukti transfer"></span>';
    if (c.state === 'err') return thumb ? '<span class="pthumb__err" title="' + esc(c.msg) + '">!</span>' : '<div class="note bad">' + ic('alert') + '<div><b>Foto bukti belum bisa dimuat.</b> ' + esc(c.msg) + '</div><button class="btn sec sm" data-act="proof-retry" data-file="' + esc(fileId) + '" data-id="' + esc(orderId) + '">Coba lagi</button></div>';
    if (c.kind === 'pdf') return thumb ? '<span class="pthumb__pdf">PDF</span>' : '<div class="proofpdf"><b>Bukti berupa PDF</b><a class="btn" href="' + esc(c.url) + '" download="bukti-transfer.pdf">Unduh PDF</a></div>';
    return thumb ? '<img class="pthumbimg" src="' + esc(c.url) + '" alt="Bukti transfer">' : '<img class="proofimg" src="' + esc(c.url) + '" alt="Bukti transfer (klik untuk memperbesar)" data-act="lb-open" data-id="' + esc(orderId) + '" tabindex="0">';
  }
  function loadProof(orderId, fileId) {
    if (proofCache[fileId]) return;
    proofCache[fileId] = { state: 'loading' };
    DS.sync.proofGet(orderId).then(function (res) {
      if (!res.ok) { proofCache[fileId] = { state: 'err', msg: res.message || 'Gagal memuat.' }; }
      else if (res.mime === 'application/pdf') proofCache[fileId] = { state: 'ok', kind: 'pdf', url: 'data:application/pdf;base64,' + res.base64 }; // hanya diunduh, tidak ditampilkan se-origin (tanpa blob/iframe)
      else if (res.mime === 'image/jpeg' || res.mime === 'image/png') proofCache[fileId] = { state: 'ok', kind: 'img', url: 'data:' + res.mime + ';base64,' + res.base64 };
      else proofCache[fileId] = { state: 'err', msg: 'Jenis berkas tidak dikenal.' };
      hydrateProofs();
    });
  }
  function hydrateProofs() {
    var els = $$('[data-proof-file]'), thumbs = 0;
    els.forEach(function (el) {
      var f = el.getAttribute('data-proof-file'), oid = el.getAttribute('data-proof-order'), th = !!el.getAttribute('data-thumb');
      if (th && ++thumbs > 8) return; // daftar panjang: muat 8 thumbnail pertama saja
      if (!proofCache[f]) loadProof(oid, f);
      el.innerHTML = proofHtml(proofCache[f], oid, f, th);
    });
    if (!$('.pbox') && $('#lightbox')) closeLightbox();
  }
  function closeLightbox() { var l = $('#lightbox'); if (l && l.parentNode) l.parentNode.removeChild(l); }
  function openLightbox(orderId) {
    var o = orderById(orderId); if (!o) return;
    var c = proofCache[o.payment && o.payment.proof_file_id]; if (!c || c.state !== 'ok' || c.kind !== 'img') return;
    var t = L.totals(o), pend = o.status === 'quoted' && o.payment.status === 'pending_verification';
    closeLightbox();
    var lb = document.createElement('div'); lb.id = 'lightbox'; lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Bukti transfer ' + o.id);
    lb.innerHTML = '<div class="lightbox__bar"><span><b class="mono">' + esc(o.id) + '</b> · diklaim ' + rp(o.payment.amount) + ' · total tagihan ' + rp(t.total) + '</span><button class="btn sec sm" data-act="lb-close">Tutup</button></div>' +
      '<div class="lightbox__stage"><img class="lightbox__img" src="' + esc(c.url) + '" alt="Bukti transfer, klik untuk zoom" data-act="lb-zoom"></div>' +
      '<div class="lightbox__foot"><span class="muted small">Klik foto untuk zoom. Esc untuk menutup.</span>' + (pend ? '<button class="btn" data-act="verify-ok" data-id="' + esc(o.id) + '">Terima pembayaran</button><button class="btn danger" data-act="verify-no" data-id="' + esc(o.id) + '">Tolak bukti…</button>' : '') + '</div>';
    document.body.appendChild(lb);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#lightbox') && !modalStack.length) closeLightbox(); });
  function proofCard(o, t) { // kartu "Bukti transfer": foto besar + perbandingan nominal
    var pm = o.payment || {}, bank = DS.getSettings().bank || {}, has = !!pm.proof_file_id;
    var diff = pm.amount == null ? null : pm.amount - t.total, same = diff === 0;
    var cmp = '<div class="proofcmp"><div class="proofcmp__row"><span>Nominal diklaim customer</span><b class="num">' + (pm.amount == null ? '—' : rp(pm.amount)) + '</b></div>' +
      '<div class="proofcmp__row"><span>Total tagihan</span><b class="num">' + rp(t.total) + '</b></div>' +
      '<div class="proofcmp__diff ' + (same ? 'ok' : 'bad') + '" role="status">' + (diff == null ? 'Nominal tidak diisi customer' : same ? 'Nominal SAMA' : 'Selisih ' + (diff > 0 ? '+' : '−') + rp(Math.abs(diff))) + '</div>' +
      '<div class="proofcmp__row"><span>Rekening tujuan (Pengaturan)</span><b>' + esc((bank.bank || '[?]') + ' · ' + (bank.no || '[?]') + ' a.n. ' + (bank.name || '[?]')) + '</b></div>' +
      '<div class="proofcmp__row"><span>Diunggah</span><b>' + (pm.uploaded_at || pm.at ? fmtDT(pm.uploaded_at || pm.at) : '—') + '</b></div>' +
      '<div class="proofcmp__row"><span>Nama berkas</span><span class="mono">' + esc(pm.proof_name || '—') + '</span></div></div>';
    var left = has ? proofSlot(o, false) : '<div class="note wait">' + ic('alert') + '<div><b>Customer belum mengunggah foto</b> (hanya nama berkas: <span class="mono">' + esc(pm.proof_name || '—') + '</span>). Minta bukti lewat WhatsApp sebelum menerima.</div></div>';
    return '<section class="card proofcard"><h2>Bukti transfer</h2><div class="proofgrid"><div class="proofleft">' + left + '</div>' + cmp + '</div></section>';
  }

  // ---------- dialog aksi ----------
  function waModal(o) { // o: {title, text, url, onSent, sentLabel, note}
    var opened = false;
    var ov = openModal({
      title: o.title, wide: true,
      body: (o.note ? '<p>' + o.note + '</p>' : '') + '<pre class="pre">' + o.textHtml + '</pre><div class="row"><button class="btn sec" data-wa="copy">' + ic('copy') + 'Salin teks</button><button class="btn" data-wa="open">' + ic('send') + 'Buka WhatsApp</button></div><p class="why" id="wa-why">Buka WhatsApp dulu, kirim pesannya, lalu kembali ke sini dan tekan "' + esc(o.sentLabel) + '". Status baru berubah setelah itu — sistem tidak bisa tahu pesan benar-benar terkirim.</p>',
      actions: [{ label: 'Belum jadi dikirim', kind: 'sec' }, { label: o.sentLabel, id: 'wa-sent', disabled: true, fn: function () { return o.onSent(); } }]
    });
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-wa]'); if (!b) return;
      if (b.getAttribute('data-wa') === 'copy') copyText(o.text);
      else { waOpen(o.url); opened = true; var s = $('#wa-sent', ov); s.disabled = false; $('#wa-why', ov).textContent = 'WhatsApp dibuka. Sudah kamu kirim? Tekan "' + o.sentLabel + '".'; }
    });
    return ov;
  }
  function plain(t) { return esc(t); }

  function dlgSendPo(poId) {
    var po = poById(poId), dd = L.dist(po.distributor_id), text = L.poText(po), s = DS.getSettings();
    waModal({ title: 'Kirim PO ke ' + dd.name + '?', text: text, url: L.waLink(dd.wa, text), sentLabel: 'Sudah terkirim',
      note: 'Kepada <b>' + esc(dd.name) + '</b> via WhatsApp ' + esc(dd.wa) + ' (placeholder). Alamat kirim = alamat David.',
      textHtml: esc(text).replace(esc(s.address), '<b>' + esc(s.address) + '</b>'),
      onSent: function () { if (po.status === 'sent') return true; var r = A.markPoSent(poId); afterAction(r, poId + ' terkirim ke ' + dd.name + '.'); return r.ok; } });
  }
  function dlgReply(poId) {
    var po = poById(poId), items = po.items.filter(function (x) { return !x.superseded; });
    var body = '<p class="muted small">Catat balasan distributor per item. Setiap simpan menjadi entri riwayat baru.</p><div class="tablewrap"><table><thead><tr><th>Item</th><th>Jawaban</th><th class="num">Harga Distributor / unit (Rp)</th><th>Estimasi tiba</th><th>Catatan</th></tr></thead><tbody>' + items.map(function (pi) {
      var key = L.unitKey(pi), av = pi.available === true ? 'y' : pi.available === false ? 'n' : '';
      return '<tr data-key="' + esc(key) + '"><td>' + esc(pi.name) + (pi.variant ? ' — ' + esc(pi.variant) : '') + ' × ' + pi.qty + '</td><td><select class="input" data-r="av" aria-label="Jawaban ' + esc(pi.name) + '" style="min-width:150px"><option value="">Belum dijawab</option><option value="y"' + (av === 'y' ? ' selected' : '') + '>Ada</option><option value="n"' + (av === 'n' ? ' selected' : '') + '>Tidak ada</option></select></td>' +
        '<td><input class="input num" style="width:130px" inputmode="numeric" data-r="cost" aria-label="Harga Distributor ' + esc(pi.name) + '" value="' + (pi.cost_price != null ? num(pi.cost_price) : '') + '"></td><td><input class="input" type="date" data-r="eta" aria-label="Estimasi tiba ' + esc(pi.name) + '" value="' + esc(pi.eta || '') + '"></td><td><input class="input" data-r="note" aria-label="Catatan ' + esc(pi.name) + '" value="' + esc(pi.note || '') + '"></td></tr>';
    }).join('') + '</tbody></table></div>';
    openModal({ title: 'Catat balasan ' + DS.distributorName(po.distributor_id) + ' — ' + po.id, body: body, wide: true, actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Simpan balasan', fn: function (ov) {
      var rows = $$('tr[data-key]', ov).map(function (tr) { var a = $('[data-r="av"]', tr).value; return { key: tr.getAttribute('data-key'), available: a === '' ? null : a === 'y', cost: digits($('[data-r="cost"]', tr).value), eta: $('[data-r="eta"]', tr).value, note: $('[data-r="note"]', tr).value }; });
      var r = A.recordReply(poId, rows);
      if (!r.ok) { fieldErr(ov, r.error); return false; }
      afterAction(r, r.status === 'responded' ? 'Balasan dicatat. PO sudah dibalas.' : r.status === 'rejected' ? 'Balasan dicatat. Distributor tidak sanggup sama sekali.' : 'Balasan dicatat. Masih ada item belum dijawab.');
    } }] });
  }
  function dlgMove(poId, key) {
    var po = poById(poId);
    openModal({ title: 'Pindahkan item ke distributor lain', body: '<div class="field"><label class="f" for="mv">Distributor tujuan</label><select id="mv" class="input">' + DS.getDistributors().filter(function (x) { return x.id !== po.distributor_id; }).map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('') + '</select></div>', actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Pindahkan', fn: function (ov) { afterAction(A.movePoItem(poId, key, $('#mv', ov).value), 'Item dipindahkan.'); } }] });
  }
  function dlgConfirmPo(poId) {
    var po = poById(poId), o = orderById(po.order_id), dd = L.dist(po.distributor_id), text = L.poConfirmText(po, o), s = DS.getSettings();
    waModal({ title: 'Konfirmasi beli ke ' + dd.name + '?', text: text, url: L.waLink(dd.wa, text), sentLabel: 'Sudah terkirim',
      note: 'Pesanan sudah lunas. Ini komitmen beli ke distributor.', textHtml: esc(text).replace(esc(s.address), '<b>' + esc(s.address) + '</b>'),
      onSent: function () { var r = A.confirmPo(poId); afterAction(r, poId + ' dikonfirmasi. Menunggu barang dari ' + dd.name + '.'); return r.ok; } });
  }
  // pesanan lama tanpa kunci Lacak: minta server membuatnya (op admin), tarik ulang, lanjutkan. Mode lokal: lanjut tanpa kunci.
  function withTrackKey(o, fn) {
    if (o.track_key || !(DS.syncStatus && DS.syncStatus().mode === 'sheet') || !DS.sync.ensureTrackKey) { fn(o); return; }
    DS.sync.ensureTrackKey(o.id).then(function (r) {
      if (!r.ok) { toast('Kunci tautan Lacak belum bisa dibuat (' + (r.error || 'gagal') + '). Tautan tanpa kunci tidak akan bisa dibuka customer.', 'err'); fn(o); return; }
      DS.sync.pull().then(function () { fn(orderById(o.id) || o); });
    });
  }
  function dlgQuoteSend() {
    var o0 = orderById(quote.orderId); if (o0 && !o0.track_key && DS.syncStatus && DS.syncStatus().mode === 'sheet' && !dlgQuoteSend._tried) { dlgQuoteSend._tried = true; withTrackKey(o0, function () { dlgQuoteSend(); }); return; }
    dlgQuoteSend._tried = false;
    var c = qCalc(), o = orderById(quote.orderId), s = DS.getSettings();
    var tmp = JSON.parse(JSON.stringify(o));
    tmp.items.forEach(function (it) { var q = quote.lines[it.line_id]; if (q) { it.final_price = q.price; it.cost_price = q.cost; } });
    tmp.shipping_fee = quote.shipping; tmp.pay_deadline = DS.isoWIB(Date.now() + quote.hours * HR);
    var text = L.quoteText(tmp).replace(tmp.pay_deadline, fmtDT(tmp.pay_deadline) + ' WIB');
    var warn = c.anyLoss ? note('bad', 'alert', '<b>Ada item dijual tanpa untung / rugi.</b> Tetap boleh dikirim; dicatat di riwayat.') : '';
    waModal({ title: 'Kirim harga final ke ' + custName(o).replace(' (CONTOH)', '') + '?', text: text, url: L.waLink(o.customer.wa, text), sentLabel: 'Sudah terkirim',
      note: warn + 'Total ditagih ' + rp(c.jual + quote.shipping) + ', batas bayar ' + quote.hours + ' jam dari sekarang.', textHtml: esc(text),
      onSent: function () {
        var lines = Object.keys(quote.lines).map(function (k) { var q = quote.lines[k]; return { line_id: k, pick: q.pick, margin_type: q.type, margin_value: q.value, final_price: q.price }; });
        var r = A.sendQuote(quote.orderId, { lines: lines, shipping: quote.shipping, hours: quote.hours });
        if (r.ok) { var id = quote.orderId; quote = null; go('pesanan/' + id); toast('Harga final terkirim. Pesanan menunggu transfer customer.'); }
        else toast(r.error, 'err');
        return r.ok;
      } });
  }
  function shipInfo(o) {
    var sh = o.shipment; if (!sh) return '';
    if (L.isSelfShip(sh)) return 'Metode: <b>Diantar David sendiri</b>' + (sh.note ? ', ' + esc(sh.note) : '');
    return 'Metode: <b>Kurir</b> ' + esc(sh.courier) + ', resi <span class="mono">' + esc(sh.resi) + '</span>';
  }
  function dlgShip(id) {
    var ov = openModal({ title: 'Kirim pesanan ' + id + ' ke customer', body:
      '<div class="field" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="f" id="sh-m-l" style="margin:0">Cara kirim</span><span class="seg" role="group" aria-labelledby="sh-m-l"><button type="button" data-shm="courier" aria-pressed="true">Kurir</button><button type="button" data-shm="self" aria-pressed="false">Diantar David sendiri</button></span></div>' +
      '<div id="sh-cr"><div class="field"><label class="f" for="sh-c">Kurir</label><input id="sh-c" class="input" placeholder="Contoh: JNE, J&amp;T, Gojek"></div><div class="field"><label class="f" for="sh-r">Nomor resi</label><input id="sh-r" class="input"></div></div>' +
      '<div id="sh-sf" style="display:none"><div class="field"><label class="f" for="sh-n">Perkiraan tiba / catatan (opsional)</label><input id="sh-n" class="input" maxlength="120" placeholder="Contoh: Besok sore"></div></div>' +
      '<div class="field"><label class="f" for="sh-f">Ongkir aktual (opsional)</label><div class="rp"><input id="sh-f" class="input num" inputmode="numeric"></div></div>',
      actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Simpan', fn: function (ov) { return doShip(ov, id, false); } }, { label: 'Simpan & buka WA', fn: function (ov) { return doShip(ov, id, true); } }] });
    $$('[data-shm]', ov).forEach(function (b) { b.addEventListener('click', function () {
      var m = b.getAttribute('data-shm');
      var er = $('.errmsg', ov); if (er) er.remove();
      $$('[data-shm]', ov).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      $('#sh-cr', ov).style.display = m === 'self' ? 'none' : ''; $('#sh-sf', ov).style.display = m === 'self' ? '' : 'none';
    }); });
  }
  function doShip(ov, id, wa) {
    var self = $('[data-shm="self"]', ov).getAttribute('aria-pressed') === 'true';
    var r = A.ship(id, { method: self ? 'self' : 'courier', courier: $('#sh-c', ov).value, resi: $('#sh-r', ov).value, note: $('#sh-n', ov).value, actual_fee: $('#sh-f', ov).value ? digits($('#sh-f', ov).value) : '' });
    if (!r.ok) { fieldErr(ov, r.error); return false; }
    var o = orderById(id); if (wa) waOpen(L.waLink(o.customer.wa, L.shipText(o)));
    afterAction(r, (self ? 'Pesanan ditandai diantar David.' : 'Pesanan dikirim. Resi dicatat.'));
  }
  function dlgCancel(id) {
    var o = orderById(id), paid = o.payment && o.payment.status === 'verified';
    openModal({ title: 'Batalkan pesanan ' + id + '?', body: '<p>Customer perlu diberi tahu lewat WhatsApp. PO yang sudah terkirim tidak ikut dibatalkan otomatis di sisi distributor' + (paid ? '. <b>Pesanan sudah lunas — dibuat catatan refund ' + rp(L.totals(o).total) + '.</b>' : '.') + '</p><div class="field"><label class="f" for="cn-r">Alasan (wajib)</label><input id="cn-r" class="input"></div>',
      actions: [{ label: 'Tidak jadi', kind: 'sec' }, { label: 'Batalkan pesanan', kind: 'fill-danger', fn: function (ov) { var r = A.cancel(id, $('#cn-r', ov).value); if (!r.ok) { fieldErr(ov, r.error); return false; } afterAction(r, 'Pesanan dibatalkan.' + (r.confirmed_pos.length ? ' Hubungi distributor untuk ' + r.confirmed_pos.join(', ') + '.' : '')); } }] });
  }

  // ---------- event delegasi ----------
  var ACT = {
    'filter': function (el) { ordersFilter = el.getAttribute('data-v'); ordersGroup = ''; ordersIds = null; render(); },
    'orders-ids': function (el) { ordersIds = (el.getAttribute('data-ids') || '').split(',').filter(Boolean); ordersFilter = 'semua'; ordersGroup = ''; },
    'open-group': function (el) { ordersIds = null; ordersFilter = 'tindakan'; ordersGroup = el.getAttribute('data-g') || ''; },
    'clear-group': function () { ordersGroup = ''; render(); },
    'bp': function (el) { bPeriod.kind = el.getAttribute('data-v'); if (bPeriod.kind !== 'pick') bPeriod.ym = ''; render(); },
    'bp-month': function (el) { bPeriod.ym = el.value; render(); },
    'bp-retry': function () { render(); },
    'brand-toggle': function (el) {
      var id = el.getAttribute('data-id'), name = el.getAttribute('data-name'), on = el.getAttribute('aria-checked') === 'true';
      if (!DS.setBrandVisible) { toast('Pengaturan brand belum tersedia.', 'err'); return; }
      if (!on) { setBrand(id, name, true, 0); return; }
      var C = window.DS_CATALOG, n = C && C.products ? C.products.filter(function (p) { return p.brand === name; }).length : 0;
      var act = L.brandStats(getData().orders, C && C.products, makeBrandOf())[name], active = act ? act.activeOrders : 0;
      if (!n) { setBrand(id, name, false, 0); return; }
      openModal({ title: 'Sembunyikan ' + name + '?', body: '<p><b>' + n + ' produk</b> ' + esc(name) + ' tidak akan terlihat customer di toko.</p><p class="muted">' + (active ? active + ' pesanan aktif berisi ' + esc(name) + ' tetap bisa diproses sampai selesai.' : 'Tidak ada pesanan aktif yang berisi brand ini.') + ' Produk dan pesanannya tetap terlihat di dashboard.</p>',
        actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Sembunyikan', kind: 'fill-danger', fn: function () { setBrand(id, name, false, n); } }] });
    },
    'open-order': function (el, e) { if (e.target.closest('a')) return; go('pesanan/' + el.getAttribute('data-id')); },
    'open-po': function (el, e) { if (e.target.closest('a')) return; go('po/' + el.getAttribute('data-id')); },
    'clear-local': function () { openModal({ title: 'Hapus data lokal browser ini?', body: '<p>Semua pesanan dan PO yang tersimpan <b>di browser ini</b> dihapus. Google Sheet tidak tersentuh. Pengaturan tidak diubah. Tidak bisa diurungkan.</p>', actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Hapus data lokal', kind: 'fill-danger', fn: function () { DS.clearLocal(); wiz = null; quote = null; bPeriod = { kind: 'month', ym: '' }; ordersGroup = ''; toast('Data lokal browser ini dihapus.'); go('beranda'); render(); } }] }); },
    'copy': function (el) { copyText(el.getAttribute('data-v')); },
    'start-wiz': function () { wiz = null; },
    'start-quote': function () { quote = null; },
    'wiz-exit': function () { wiz = null; }, 'quote-exit': function () { quote = null; },
    're-po': function (el) { wiz = null; go('pesanan/' + el.getAttribute('data-id') + '/po'); },
    'wiz-toggle': function (el) { var k = el.getAttribute('data-key'); if (el.checked) wiz.sel[k] = wiz.sel[k] || ''; else delete wiz.sel[k]; render(); },
    'wiz-all': function () { var d = getData(), o = orderById(wiz.orderId); L.eligibleUnits(o, d.pos).forEach(function (u) { wiz.sel[u.key] = wiz.sel[u.key] || ''; }); render(); },
    'wiz-back': function () { wiz.step--; render(); },
    'wiz-next': function () {
      if (wiz.step === 2 && Object.keys(wiz.sel).some(function (k) { return !wiz.sel[k]; })) { $('#wiz-err').innerHTML = note('bad', 'alert', 'Pilih distributor untuk semua item dulu.'); return; }
      if (Object.keys(wiz.sel).length) { wiz.step++; render(); }
    },
    'wiz-dist': function (el) { wiz.sel[el.getAttribute('data-key')] = el.value; },
    'wiz-all-dist': function (el) { if (!el.value) return; Object.keys(wiz.sel).forEach(function (k) { wiz.sel[k] = el.value; }); render(); },
    'wiz-create': function () {
      var assigns = Object.keys(wiz.sel).map(function (k) { return { key: k, distId: wiz.sel[k] }; }), id = wiz.orderId;
      var r = A.createPOs(id, assigns);
      if (!r.ok) { toast(r.error, 'err'); return; }
      wiz = null; go('pesanan/' + id); toast(r.po_ids.length + ' PO draf dibuat: ' + r.po_ids.join(', ') + '. Kirim lewat tombol "Kirim via WA".');
    },
    'send-po': function (el) { dlgSendPo(el.getAttribute('data-po')); },
    'send-po-again': function (el) { dlgSendPo(el.getAttribute('data-po')); },
    'reply': function (el) { dlgReply(el.getAttribute('data-po')); },
    'move': function (el) { dlgMove(el.getAttribute('data-po'), el.getAttribute('data-key')); },
    'confirm-po': function (el) { dlgConfirmPo(el.getAttribute('data-po')); },
    'receive': function (el) {
      var po = el.getAttribute('data-po'), key = el.getAttribute('data-key');
      var inp = document.getElementById('rcv-' + po + '-' + key);
      afterAction(A.receive(po, key, inp ? inp.value : 0), 'Penerimaan dicatat.');
    },
    'mark-unavail': function (el) { afterAction(A.markUnavailable(el.getAttribute('data-id'), el.getAttribute('data-line')), 'Item ditandai tidak tersedia.'); },
    'decline': function (el) { var id = el.getAttribute('data-id'), ln = el.getAttribute('data-line'); openModal({ title: 'Customer menolak item ini?', body: '<p>Item tidak akan ditagih.</p>', actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Ya, tidak ditagih', kind: 'danger', fn: function () { afterAction(A.declineItem(id, ln), 'Item tidak ditagih.'); } }] }); },
    'alt': function (el) {
      var id = el.getAttribute('data-id'), ln = el.getAttribute('data-line');
      openModal({ title: 'Tawarkan produk alternatif', body: '<p class="muted small">Item diganti produk alternatif dan perlu PO baru ke distributor.</p><div class="field"><label class="f" for="a-n">Nama produk (dengan brand)</label><input id="a-n" class="input"></div><div class="field"><label class="f" for="a-v">Varian</label><input id="a-v" class="input" placeholder="Contoh: 2.1 mm · Merah"></div><div class="field"><label class="f" for="a-p">Harga estimasi</label><div class="rp"><input id="a-p" class="input num" inputmode="numeric"></div></div>',
        actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Simpan alternatif', fn: function (ov) { var r = A.offerAlternative(id, ln, { name: $('#a-n', ov).value, variant: $('#a-v', ov).value, est_price: digits($('#a-p', ov).value) }); if (!r.ok) { fieldErr(ov, r.error); return false; } afterAction(r, 'Alternatif disimpan. Buat PO untuk item ini.'); } }] });
    },
    'restore-po': function (el) { afterAction(A.restorePo(el.getAttribute('data-id')), 'PO dipulihkan. Pesanan bisa dilanjutkan (konfirmasi beli ke distributor).'); },
    'lb-open': function (el) { openLightbox(el.getAttribute('data-id')); },
    'lb-close': function () { closeLightbox(); },
    'lb-zoom': function (el) { el.classList.toggle('zoomed'); },
    'proof-retry': function (el) { delete proofCache[el.getAttribute('data-file')]; hydrateProofs(); },
    'verify-ok': function (el) { var id = el.getAttribute('data-id'); var o = orderById(id), t = L.totals(o);
      openModal({ title: 'Terima pembayaran?', body: '<p>Total tagihan <b>' + rp(t.total) + '</b>, ' + (o.payment.amount == null ? 'nominal tidak diisi customer' : 'nominal diklaim ' + rp(o.payment.amount)) + '. Pesanan menjadi Lunas.</p>' + (o.payment.amount != null && o.payment.amount !== t.total ? note('bad', 'alert', 'Nominal tidak sama — periksa mutasi rekening.') : ''), actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Terima pembayaran', fn: function () { var r = A.verifyPayment(id, true); afterAction(r, 'Pembayaran diterima. Pesanan Lunas — konfirmasi beli ke distributor.'); } }] }); },
    'verify-no': function (el) { var id = el.getAttribute('data-id'); openModal({ title: 'Tolak bukti transfer?', body: '<div class="field"><label class="f" for="vn-r">Alasan (dilihat customer)</label><input id="vn-r" class="input"></div>', actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Tolak bukti', kind: 'danger', fn: function (ov) { var r = A.verifyPayment(id, false, $('#vn-r', ov).value); if (!r.ok) { fieldErr(ov, r.error); return false; } afterAction(r, 'Bukti ditolak. Customer bisa unggah ulang.'); } }] }); },
    'extend': function (el) { afterAction(A.extendDeadline(el.getAttribute('data-id'), 24), 'Batas bayar diperpanjang 24 jam.'); },
    'pull': function (el) { var id = el.getAttribute('data-id'); openModal({ title: 'Tarik harga final?', body: '<p>Pesanan kembali ke "Menunggu balasan distributor" untuk dicek ulang. Customer akan melihat statusnya berubah.</p>', actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Tarik harga final', fn: function () { afterAction(A.pullQuote(id), 'Harga final ditarik.'); } }] }); },
    'sim-proof': function (el) { afterAction(A.simulateProof(el.getAttribute('data-id')), 'Simulasi: bukti transfer masuk.'); },
    'show-quote-wa': function (el) { withTrackKey(orderById(el.getAttribute('data-id')), function (o) { var text = L.quoteText(o); waModal({ title: 'Kirim ulang harga final', text: text, url: L.waLink(o.customer.wa, text), sentLabel: 'Sudah terkirim', textHtml: esc(text), onSent: function () { toast('Dicatat: harga final dikirim ulang.'); return true; } }); }); },
    'assembly': function (el) { A.toggleAssembly(el.getAttribute('data-id'), el.getAttribute('data-line'), el.checked); },
    'ship': function (el) { dlgShip(el.getAttribute('data-id')); },
    'ship-wa': function (el) { var o = orderById(el.getAttribute('data-id')), t = L.shipText(o); waModal({ title: 'Kirim resi ke customer', text: t, url: L.waLink(o.customer.wa, t), sentLabel: 'Sudah terkirim', textHtml: esc(t), onSent: function () { toast('Dicatat: resi dikirim ke customer.'); return true; } }); },
    'complete': function (el) { afterAction(A.complete(el.getAttribute('data-id')), 'Pesanan selesai.'); },
    'cancel': function (el) { dlgCancel(el.getAttribute('data-id')); },
    'refund-done': function (el) { afterAction(A.refundDone(el.getAttribute('data-id')), 'Refund ditandai sudah ditransfer.'); },
    'quote-send': function () {
      var c = qCalc();
      var bad = Object.keys(quote.lines).filter(function (k) { return !(quote.lines[k].price > 0); });
      if (bad.length) { $('#q-err').innerHTML = note('bad', 'alert', 'Isi harga jual semua item (angka lebih dari 0).'); return; }
      dlgQuoteSend();
    },
    'edit-dist': function (el) {
      var id = el.getAttribute('data-id'), x = DS.getDistributors().filter(function (d) { return d.id === id; })[0];
      openModal({ title: 'Ubah ' + x.name, body: '<div class="field"><label class="f" for="d-w">Nomor WhatsApp (format 62…)</label><input id="d-w" class="input" inputmode="tel" value="' + esc(x.wa) + '"></div><div class="field"><label class="f" for="d-n">Catatan</label><input id="d-n" class="input" value="' + esc(x.note) + '"></div>',
        actions: [{ label: 'Batal', kind: 'sec' }, { label: 'Simpan', fn: function (ov) { var w = $('#d-w', ov).value.replace(/\D/g, ''); if (w.length < 10) { fieldErr(ov, 'Nomor WA minimal 10 angka.'); return false; } var s = DS.getSettings(); s.distributors[id] = { wa: w, note: $('#d-n', ov).value }; DS.saveSettings(s); toast('Distributor disimpan.'); render(); } }] });
    },
    'save-settings': function () {
      var s = DS.getSettings();
      $$('[data-m]').forEach(function (i) { s.margins[i.getAttribute('data-m')] = decimal(i.value); });
      s.address = $('#s-addr').value.trim(); s.david_wa = $('#s-wa').value.replace(/\D/g, ''); s.store_hours = $('#s-hours').value.trim();
      s.bank = { bank: $('#s-bank').value, no: $('#s-rek').value, name: $('#s-an').value }; s.pay_hours = digits($('#s-hrs').value) || 24;
      DS.saveSettings(s); toast('Pengaturan disimpan. Harga pesanan yang sudah dikirim tidak berubah.');
    }
  };
  document.addEventListener('click', function (e) {
    if (e.target.closest('#modal-root')) return;
    var el = e.target.closest('[data-act]'); if (!el) return;
    var k = el.getAttribute('data-act');
    if (el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type === 'checkbox' && k !== 'wiz-toggle' && k !== 'assembly')) return;
    if (el.tagName === 'INPUT' && el.type === 'checkbox') return; // ditangani 'change'
    if (el.disabled) return;
    if (ACT[k]) ACT[k](el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-act]'); if (el && (el.tagName === 'SELECT' || el.type === 'checkbox') && ACT[el.getAttribute('data-act')]) ACT[el.getAttribute('data-act')](el, e);
    var q = e.target.closest('[data-q]');
    if (q && q.tagName === 'SELECT' && quote) { // ganti distributor
      var ln = q.getAttribute('data-line'), ql = quote.lines[ln], o = orderById(quote.orderId), it = o.items.filter(function (x) { return x.line_id === ln; })[0], d = getData();
      ql.pick = q.value; var c = L.costOf(d.pos, o, it, ql.pick); ql.cost = c.cost;
      ql.price = L.priceFrom(ql.cost, ql.type, ql.value, ql.extra); var pi = $('[data-q="price"][data-line="' + ln + '"]'); if (pi) pi.value = num(ql.price); qCalc();
    }
  });
  document.addEventListener('input', function (e) {
    var el = e.target, q = el.closest && el.closest('[data-q]');
    if (q && q.tagName === 'INPUT' && quote) onQuoteInput(q);
    var di = el.getAttribute && el.getAttribute('data-input');
    if (di === 'orders-q') { ordersQuery = el.value; var pos = el.selectionStart; render(); var n = $('#q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* abaikan */ } } }
    if (di === 'cat-q') { catQuery = el.value; var p2 = el.selectionStart; render(); var n2 = $('#cq'); if (n2) { n2.focus(); try { n2.setSelectionRange(p2, p2); } catch (x) { /* abaikan */ } } }
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-q="mtype"]'); if (!b || !quote) return;
    var ln = b.getAttribute('data-line'), q = quote.lines[ln], t = b.getAttribute('data-v');
    if (q.type === t) return;
    q.type = t; q.value = L.marginFrom(q.cost, q.price, t, q.extra);
    $$('[data-q="mtype"][data-line="' + ln + '"]').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-v') === t); });
    var mi = $('[data-q="mval"][data-line="' + ln + '"]'); mi.value = t === 'rp' ? num(q.value) : String(q.value).replace('.', ',');
    qCalc();
  });
  window.addEventListener('hashchange', function () { render(); window.scrollTo(0, 0); });

  function boot() { render(); }
  function softRender() { // data/sumber berubah: jangan merusak isian yang sedang diketik atau dialog yang terbuka
    var a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && $('#main').contains(a);
    if (modalStack.length || typing) { renderSide(route()[0] || 'beranda'); return; }
    render();
  }
  window.addEventListener('ds:data', softRender);
  window.addEventListener('ds:sync', softRender);
  window.addEventListener('ds:stale', function (e) { toast((e.detail && e.detail.message) || 'Perubahan ditolak karena data sudah berubah di tempat lain.', 'err'); });
  if (typeof DS.ready === 'function') DS.ready(boot); else boot();
  window.DSAdmin = { render: render, A: A, L: L };
})();
