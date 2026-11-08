/* DavidStore Marketplace — prototipe SPA (hash routing). Tanpa library.
   Data: DS_CATALOG (diisi sync.js dari Google Sheet; tidak ada produk contoh). Order ditulis ke localStorage `ds_orders_v1` sesuai prototype/KONTRAK-DATA.md. */
(function () {
  'use strict';
  var CAT = window.DS_CATALOG;
  // Nomor/alamat/jam toko datang dari Pengaturan Dashboard (tab settings) lewat katalog publik; kosong = disembunyikan.
  function store() { return (window.DS_CATALOG && DS_CATALOG.store) || {}; }
  function davidWa() { var d = String(store().wa || '').replace(/\D/g, ''); if (d.indexOf('0') === 0) d = '62' + d.slice(1); else if (d.indexOf('8') === 0) d = '62' + d; return /^628\d{7,12}$/.test(d) ? d : ''; }
  function davidLink(text) { var n = davidWa(); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text) : ''; } // '' = tidak ada nomor: tautan disembunyikan (hideNoWa)
  function hideNoWa(root) { $$('a[href=""]', root).forEach(function (a) { a.style.display = 'none'; }); }
  var KEY_ORDERS = 'ds_orders_v1';
  var KEY_CART = 'ds_cart_v1'; // milik marketplace saja, bukan bagian kontrak
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ util */
  function qa(v) { return String(v == null ? '' : v).replace(/["\\]/g, '\\$&'); } // nilai di dalam selector atribut
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var rpFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  function rupiah(n) { return rpFmt.format(n); }
  function num(n) { return Number(n).toLocaleString('id-ID'); }
  function priceHtml(n) { return '<span class="rp">Rp</span>&nbsp;' + num(n); }
  /* ---- ADM-21: brand tersembunyi ---- */
  function brandVisible(name) {
    if (window.DS && typeof DS.isBrandVisible === 'function') return DS.isBrandVisible(name);
    try {
      var a = JSON.parse(localStorage.getItem('ds_brands_v1')); if (!Array.isArray(a)) return true;
      var slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      for (var i = 0; i < a.length; i++) if (a[i] && (a[i].id === slug || String(a[i].name).toLowerCase() === String(name).toLowerCase())) return a[i].visible !== false;
    } catch (e) { }
    return true;
  }
  function prodVisible(p) { return !!p && p.is_active !== false && brandVisible(p.brand); }
  function vprods() {
    if (window.DS && typeof DS.getCatalog === 'function') { try { return DS.getCatalog({ publicOnly: true }).products; } catch (e) { } }
    return CAT.products.filter(prodVisible);
  } // hanya yang boleh tampil
  function lineHidden(l) {
    // produk yang sudah tidak ada di katalog (mis. keranjang lama) dianggap tidak lagi dijual
    if (l.kind === 'rakitan' && l.components) return ['blade', 'fh', 'bh'].some(function (k) { var c = l.components[k], p = c && byId(c.sku); return c ? (!p || !prodVisible(p)) : false; });
    var p = byId(l.sku); return !p || !prodVisible(p);
  }
  function hiddenCount() { return cart.filter(lineHidden).length; }
  /* ---- foto produk (ADM-15) ---- */
  function imgOf(p) { return p ? (p.image || (window.DS_IMAGES || {})[p.sku] || null) : null; }
  window.__dsPhFallback = function (img) {
    var par = img.parentNode, cat = img.getAttribute('data-cat') || 'aksesoris';
    img.insertAdjacentHTML('afterend', ph(cat)); img.remove();
    if (par && par.classList && (par.classList.contains('card__img') || par.classList.contains('pd__img')) && !par.querySelector('.foto')) par.insertAdjacentHTML('beforeend', '<span class="foto">Foto segera</span>');
    if (par && par.classList) par.classList.add('no-photo');
  };
  function photo(p) {
    var src = imgOf(p);
    if (!src) return ph(p.category);
    return '<img src="' + (/^(https?:)?\/\//.test(src) ? '' : '../') + esc(src) + '" loading="lazy" alt="' + esc(p.brand + ' ' + p.name) + '" data-cat="' + esc(p.category) + '" onerror="__dsPhFallback(this)">';
  }
  function catOfSku(sku) { var p = byId(sku); return p ? p.category : ''; }
  function byId(id) { return CAT.products.filter(function (p) { return p.sku === id; })[0]; }
  function bySlug(s) { return CAT.products.filter(function (p) { return p.slug === s; })[0]; }
  function catName(id) { var c = CAT.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.name : id; }
  function fmtDate(iso) { return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(iso)); }
  function fmtTime(iso) { return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(iso)); }
  function jakartaIso(d) { return new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 19) + '+07:00'; }
  function waLink(num_, text) { return 'https://wa.me/' + num_ + '?text=' + encodeURIComponent(text); }
  function normWa(s) { var d = String(s || '').replace(/\D/g, ''); if (d.indexOf('62') === 0) return d; if (d.indexOf('0') === 0) return '62' + d.slice(1); if (d.indexOf('8') === 0) return '62' + d; return d; }
  function validWa(s) { var n = normWa(s); return /^628\d{8,12}$/.test(n); }
  function colorVar(c) { var k = CAT.colors[c]; return k ? 'var(--swatch-' + k + ')' : 'var(--n-300)'; }
  function colorCls(c) { return 'sw-' + (CAT.colors[c] || 'black'); }

  /* ------------------------------------------------------------ ikon (gaya Lucide, stroke 1.75) */
  var IC = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>', right: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    left: '<path d="M19 12H5M12 19l-7-7 7-7"/>', down: '<path d="m6 9 6 6 6-6"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    wa: '<path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 20l1.3-5.2A8.4 8.4 0 1 1 21 11.5z"/>',
    filter: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    flip: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.7a1 1 0 0 0-.2-.6l-3-3.7a1 1 0 0 0-.8-.4H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>', xc: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>'
  };
  function ico(n, cls) { return '<svg class="' + (cls || 'ico') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; }

  /* ------------------------------------------------------------ gambar placeholder (siluet per kategori, buatan sendiri) */
  var PH = {
    blade: '<circle cx="60" cy="46" r="30"/><path d="M51 75l-3 28q0 6 6 6h12q6 0 6-6l-3-28"/>',
    karet: '<rect x="20" y="32" width="80" height="58" rx="12"/><path d="M20 46h80"/><circle cx="60" cy="68" r="8"/>',
    'bet-jadi': '<circle cx="60" cy="46" r="30"/><circle cx="60" cy="46" r="23"/><path d="M52 76l-2 28q0 6 6 6h8q6 0 6-6l-2-28"/>',
    bola: '<circle cx="60" cy="60" r="28"/><path d="M42 50q18 -10 36 0"/>',
    meja: '<path d="M18 52l14-16h66l-10 16z"/><path d="M26 52v38M80 52v38M18 52h70"/><path d="M60 36v16"/>',
    net: '<path d="M26 92V40M94 92V40M26 46h68M26 58h68M26 70h68M44 46v24M60 46v24M76 46v24"/>',
    tas: '<rect x="24" y="44" width="72" height="50" rx="10"/><path d="M44 44v-8a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v8M24 64h72"/>',
    sepatu: '<path d="M22 84v-24l22-6 14 12 34 8q10 3 10 10v0H22z"/><path d="M22 84h80"/>',
    aksesoris: '<rect x="42" y="50" width="36" height="46" rx="8"/><path d="M52 50v-12h16v12M42 70h36"/>',
    latihan: '<rect x="32" y="48" width="56" height="44" rx="8"/><circle cx="60" cy="38" r="10"/><path d="M48 92v8M72 92v8"/>',
    rakit: '<circle cx="60" cy="46" r="30"/><path d="M51 75l-3 28q0 6 6 6h12q6 0 6-6l-3-28"/><path d="M40 40q20 -14 40 0"/>'
  };
  function ph(cat, color) {
    var fill = color ? '<circle cx="60" cy="60" r="0" fill="' + colorVar(color) + '"/>' : '';
    var inner = PH[cat] || PH.aksesoris;
    if (cat === 'karet' && color) inner = '<rect x="20" y="32" width="80" height="58" rx="12" fill="' + colorVar(color) + '" fill-opacity=".85"/><path d="M20 46h80"/>';
    return '<svg viewBox="0 0 120 120" fill="none" stroke="var(--n-500)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + fill + '</svg>';
  }

  /* bet: satu sisi (dua lapis karet untuk crossfade) */
  function betFace(side, color) {
    var f = colorVar(color);
    return '<svg viewBox="0 0 150 210" aria-hidden="true">' +
      '<path d="M62 120 L88 120 L93 188 Q75 206 57 188 Z" fill="var(--wood-dark)" stroke="var(--brand-900)" stroke-width="2"/>' +
      '<circle cx="75" cy="72" r="64" fill="var(--wood)" stroke="var(--brand-900)" stroke-width="2"/>' +
      '<g class="rb" data-side="' + side + '"><circle class="rb-a" cx="75" cy="72" r="57" fill="' + f + '"/><circle class="rb-b" cx="75" cy="72" r="57" fill="' + f + '"/></g>' +
      '<path d="M40 50q35 -26 70 0" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="5" stroke-linecap="round"/></svg>';
  }
  function betMini(c1, c2) {
    return '<svg viewBox="0 0 150 210" aria-hidden="true"><path d="M62 120 L88 120 L93 188 Q75 206 57 188 Z" fill="var(--wood-dark)"/><circle cx="75" cy="72" r="64" fill="var(--wood)"/><path d="M75 15a57 57 0 0 1 0 114z" fill="' + colorVar(c2) + '"/><path d="M75 15a57 57 0 0 0 0 114z" fill="' + colorVar(c1) + '"/></svg>';
  }

  /* ------------------------------------------------------------ storage */
  var mem = { orders: [], cart: [] };
  function readJson(key, memKey) {
    try { var v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : []; } catch (e) { return mem[memKey].slice(); }
  }
  function writeJson(key, memKey, arr) {
    mem[memKey] = arr.slice();
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) { /* storage tidak tersedia: tetap jalan di memori */ }
  }
  function getOrders() { if (window.DS && typeof DS.getOrders === 'function') { try { return DS.getOrders(); } catch (e) { } } return readJson(KEY_ORDERS, 'orders'); }
  function saveOrders(a) { if (window.DS && typeof DS.saveOrders === 'function') { try { DS.saveOrders(a); return; } catch (e) { } } writeJson(KEY_ORDERS, 'orders', a); }
  var cart = readJson(KEY_CART, 'cart');
  function saveCart() { writeJson(KEY_CART, 'cart', cart); updateBadge(); }
  function cartCount() { return cart.reduce(function (s, l) { return s + l.qty; }, 0); }
  function cartSubtotal() { return cart.reduce(function (s, l) { return s + l.qty * l.est_price; }, 0); }

  /* ---- jalur pesanan publik (server Google Sheet, tanpa token) ---- */
  function pubOn() { return !!(window.DS && DS.pub && DS.pub.enabled()); }
  var lastCreated = null; // pesanan yang baru dibuat (versi customer, dari server)
  function rememberLast(o, k) { try { sessionStorage.setItem('ds_last_order', JSON.stringify({ id: o.id, wa: o.customer.wa, k: k })); } catch (e) { } }
  function trackLink(id, wa, k) { return '#/lacak?id=' + encodeURIComponent(id) + '&wa=' + encodeURIComponent(wa) + '&k=' + encodeURIComponent(k || ''); }
  function readLast() { try { return JSON.parse(sessionStorage.getItem('ds_last_order')); } catch (e) { return null; } }
  var SAVED_BADGE = '<span class="badge badge--ok" data-saved>' + '✓ Pesanan tersimpan di server</span>';

  function newOrderId(orders) {
    var d = jakartaIso(new Date()).slice(0, 10).replace(/-/g, '');
    var pre = 'DS-' + d + '-', max = 0;
    orders.forEach(function (o) { if (o.id && o.id.indexOf(pre) === 0) { var n = parseInt(o.id.slice(pre.length), 10) || 0; if (n < 8000) max = Math.max(max, n); } }); // 8000+ = nomor data contoh
    return pre + String(max + 1).padStart(4, '0');
  }

  /* ------------------------------------------------------------ toast */
  function toast(msg, o) {
    o = o || {};
    var box = $('#toasts');
    box.classList.toggle('has-bar', !!$('.buybar'));
    var t = document.createElement('div');
    t.className = 'toast' + (o.err ? ' toast--err' : '');
    t.innerHTML = ico(o.err ? 'alert' : 'check') + '<span>' + esc(msg) + '</span>' +
      (o.href ? '<a href="' + o.href + '">' + esc(o.label) + '</a>' : '') + (o.fn ? '<button class="t-act" type="button">' + esc(o.label) + '</button>' : '');
    if (o.fn) $('.t-act', t).addEventListener('click', function () { o.fn(); dismiss(); });
    box.appendChild(t);
    function dismiss() { if (!t.parentNode) return; t.classList.add('out'); setTimeout(function () { t.remove(); }, 180); }
    if (!o.err) setTimeout(dismiss, 4000); else t.addEventListener('click', dismiss);
  }

  /* ------------------------------------------------------------ lapisan (drawer, sheet, modal) */
  var openEl = null, lastTrigger = null;
  function setInert(on) { ['shell', 'app', 'footer'].forEach(function (id) { var e = document.getElementById(id); if (e) { if (on) e.setAttribute('inert', ''); else e.removeAttribute('inert'); } }); }
  function openLayer(el, trigger) {
    if (openEl) closeLayer(true);
    lastTrigger = trigger || document.activeElement; openEl = el;
    el.classList.add('is-open'); $('#scrim').classList.add('is-open'); setInert(true);
    var h = $('[data-focus]', el); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  }
  function closeLayer(keepFocus) {
    if (!openEl) return;
    openEl.classList.remove('is-open'); $('#scrim').classList.remove('is-open'); setInert(false);
    var t = lastTrigger; openEl = null;
    if (!keepFocus && t && t.focus) t.focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLayer(); });

  function confirmBox(title, body, okLabel, danger) {
    return new Promise(function (res) {
      var m = $('#modal');
      m.innerHTML = '<h3 data-focus>' + esc(title) + '</h3><p class="hint">' + esc(body) + '</p><div class="row"><button class="btn btn--secondary" data-a="no" type="button">Batal</button><button class="btn' + (danger ? ' btn--danger' : '') + '" data-a="ok" type="button">' + esc(okLabel) + '</button></div>';
      function done(v) { m.removeEventListener('click', h); closeLayer(); res(v); }
      function h(e) { var b = e.target.closest('[data-a]'); if (b) done(b.dataset.a === 'ok'); }
      m.addEventListener('click', h);
      openLayer(m);
    });
  }

  /* ------------------------------------------------------------ shell */
  // NAV dari tab categories (urut sort, maks 6, hanya yang punya produk tampil) + "Bet Rakitan" bila ada blade dan karet
  function navItems() {
    var all = vprods(), cats = CAT.categories.filter(function (c) { return all.some(function (p) { return p.category === c.id; }); }).slice(0, 6).map(function (c) { return [c.id, c.name]; });
    var hasB = all.some(function (p) { return p.category === 'blade'; }), hasK = all.some(function (p) { return p.category === 'karet'; });
    if (hasB && hasK) cats.splice(Math.min(2, cats.length), 0, ['rakit', 'Bet Rakitan']);
    return cats;
  }
  function navHref(id) { return id === 'rakit' ? '#/rakit' : '#/katalog/' + id; }

  function renderShell() {
    $('#shell').innerHTML =
      '<header class="site-header" id="hdr"><div class="container site-header__in">' +
      '<button class="icon-btn menu-btn" id="btnMenu" aria-label="Buka menu" type="button">' + ico('menu') + '</button>' +
      '<a class="logo" href="#/" aria-label="DStore, ke beranda"><img class="logo__img logo__img--solid" src="../assets/logo/logo.svg" alt="DStore" height="28"><img class="logo__img logo__img--clear" src="../assets/logo/logo-inverse.svg" alt="" aria-hidden="true" height="28"></a>' +
      '<nav class="nav" id="mainNav" aria-label="Kategori"></nav>' +
      '<form class="search-inline" id="searchInline" role="search"><label class="sr-only" for="qi">Cari produk</label>' + ico('search') + '<input id="qi" type="search" placeholder="Cari blade, karet, brand…" autocomplete="off"></form>' +
      '<button class="icon-btn search-btn" id="btnSearch" aria-label="Cari" type="button">' + ico('search') + '</button>' +
      '<button class="icon-btn" id="btnCart" type="button" aria-label="Keranjang">' + ico('bag') + '<span class="cart-badge" id="badge" hidden aria-live="polite">0</span></button>' +
      '</div></header>';
    $('#footer').innerHTML =
      '<footer class="site-footer"><div class="container"><div><a class="flogo" href="#/"><img src="../assets/logo/logo-inverse.svg" alt="DStore" height="28"></a><p>Peralatan tenis meja. Harga estimasi dikonfirmasi setelah cek ketersediaan ke distributor.</p></div>' +
      '<div><h4>Belanja</h4><div id="footCats"></div><div><a href="#/rakit">Rakit Bet</a></div></div>' +
      '<div><h4>Bantuan</h4><div><a href="#/lacak">Lacak Pesanan</a></div><div id="footWa"></div></div>' +
      '<div id="footStore"></div></div><div class="container site-footer__sync" id="syncBadge"></div></footer>';
    drawSyncBadge();
    drawShellLists();
    $('#overlays').innerHTML =
      '<div class="scrim" id="scrim"></div>' +
      '<aside class="drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-labelledby="cartTitle"></aside>' +
      '<aside class="drawer menu-drawer" id="menuDrawer" role="dialog" aria-modal="true" aria-label="Menu"><div class="drawer__head"><h2 data-focus>Menu</h2><button class="icon-btn" data-close aria-label="Tutup menu" type="button">' + ico('x') + '</button></div><div class="drawer__body">' +
      '<span id="menuNav"></span><a href="#/lacak">Lacak Pesanan</a></div></aside>' +
      '<div class="search-pop" id="searchPop" role="dialog" aria-modal="true" aria-label="Cari produk"><form id="searchForm"><input id="qm" type="search" placeholder="Cari blade, karet, brand…" aria-label="Cari produk" autocomplete="off"><button class="btn" type="submit">Cari</button><button class="icon-btn" type="button" id="searchClose" aria-label="Tutup pencarian">' + ico('x') + '</button></form>' +
      '<p class="eyebrow" style="margin-top:20px">Kategori populer</p><div class="chips" id="popChips"></div></div>' +
      '<aside class="sheet" id="filterSheet" role="dialog" aria-modal="true" aria-label="Filter"></aside>' +
      '<div class="modal" id="modal" role="dialog" aria-modal="true"></div>';
    var s = document.createElement('div'); s.id = 'sentinel'; s.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:40px;pointer-events:none'; document.body.appendChild(s);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { solid = !en[0].isIntersecting; applyHeader(); }).observe(s);

    $('#scrim').addEventListener('click', function () { closeLayer(); });
    $('#btnCart').addEventListener('click', function (e) { renderCart(); openLayer($('#cartDrawer'), e.currentTarget); });
    $('#btnMenu').addEventListener('click', function (e) { openLayer($('#menuDrawer'), e.currentTarget); });
    $('#menuDrawer').addEventListener('click', function (e) { if (e.target.closest('a') || e.target.closest('[data-close]')) closeLayer(true); });
    $('#btnSearch').addEventListener('click', function () { var p = $('#searchPop'); lastTrigger = $('#btnSearch'); p.classList.add('is-open'); setTimeout(function () { $('#qm').focus(); }, 50); });
    $('#searchClose').addEventListener('click', function () { $('#searchPop').classList.remove('is-open'); $('#btnSearch').focus(); });
    $('#searchPop').addEventListener('click', function (e) { if (e.target.closest('a')) $('#searchPop').classList.remove('is-open'); });
    $('#searchForm').addEventListener('submit', function (e) { e.preventDefault(); $('#searchPop').classList.remove('is-open'); goSearch($('#qm').value); });
    $('#searchInline').addEventListener('submit', function (e) { e.preventDefault(); goSearch($('#qi').value); });
    drawNav();
    updateBadge();
  }
  function markNav() {
    var r = parseHash(), v = r.segs[0] || '';
    $$('.nav a').forEach(function (a) { var on = (a.dataset.nav === r.segs[1] && v === 'katalog') || (a.dataset.nav === 'rakit' && v === 'rakit') || (a.dataset.nav === 'lacak' && v === 'lacak'); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  function drawNav() { // header + menu mobile dibangun dari katalog; kosong = hanya "Lacak Pesanan"
    var items = navItems(), nav = $('#mainNav'), mn = $('#menuNav');
    if (nav) nav.innerHTML = items.map(function (n) { return '<a href="' + esc(navHref(n[0])) + '" data-nav="' + esc(n[0]) + '">' + esc(n[1]) + '</a>'; }).join('') + '<a href="#/lacak" data-nav="lacak">Lacak Pesanan</a>';
    if (mn) mn.innerHTML = items.map(function (n) { return '<a href="' + esc(navHref(n[0])) + '">' + esc(n[1]) + '</a>'; }).join('') + (items.length ? '<a href="#/katalog">Semua produk</a>' : '');
    markNav();
  }
  function drawStore() { // kolom Toko + tautan WhatsApp di footer; baris kosong tidak ditampilkan
    var st = store(), wa = davidWa(), rows = '';
    if (st.address) rows += '<p>Alamat: ' + esc(st.address) + '</p>';
    if (st.hours) rows += '<p>Jam operasional: ' + esc(st.hours) + '</p>';
    if (wa) rows += '<p>WA: <a href="' + esc(davidLink('Halo David, saya mau tanya.')) + '" target="_blank" rel="noopener">+' + esc(wa) + '</a></p>';
    var fs = $('#footStore'); if (fs) { fs.innerHTML = rows ? '<h4>Toko</h4>' + rows : ''; fs.style.display = rows ? '' : 'none'; }
    var fw = $('#footWa'); if (fw) fw.innerHTML = wa ? '<a href="' + esc(davidLink('Halo David, saya mau tanya.')) + '" target="_blank" rel="noopener">WhatsApp David</a>' : '';
  }
  function drawShellLists() {
    drawNav(); drawStore(); // daftar kategori di footer dan kolom cari: hanya kategori yang punya produk tampil
    var cats = CAT.categories.filter(function (c) { return vprods().some(function (p) { return p.category === c.id; }); });
    var f = $('#footCats'); if (f) f.innerHTML = cats.slice(0, 5).map(function (c) { return '<div><a href="#/katalog/' + esc(c.id) + '">' + esc(c.name) + '</a></div>'; }).join('');
    var pc = $('#popChips'); if (pc) pc.innerHTML = cats.slice(0, 4).map(function (c) { return '<a class="chip" href="#/katalog/' + esc(c.id) + '">' + esc(c.name) + '</a>'; }).join('');
  }
  function emptyCatalogHtml(back) {
    return '<div class="empty">' + ico('info') + '<p><b>Katalog sedang disiapkan</b></p><p class="hint">Produk akan tampil di sini setelah David selesai mengisinya. Silakan kembali lagi nanti.</p>' + (back ? '<a class="btn btn--secondary" href="#/">Ke beranda</a>' : '') + '</div>';
  }
  function drawSyncBadge() { var b = $('#syncBadge'); if (b && window.DS && DS.sync && typeof DS.sync.badgeHtml === 'function') { try { b.innerHTML = DS.sync.badgeHtml(); } catch (e) { } } }
  function goSearch(q) { q = String(q || '').trim(); location.hash = '#/katalog' + (q ? '?q=' + encodeURIComponent(q) : ''); }
  var solid = false, isHome = false;
  function applyHeader() { var h = $('#hdr'); if (h) h.classList.toggle('is-clear', isHome && !solid); }
  function updateBadge() {
    var b = $('#badge'); if (!b) return; var n = cartCount();
    b.textContent = n; b.hidden = n === 0; $('#btnCart').setAttribute('aria-label', 'Keranjang, ' + n + ' barang');
  }
  function bumpBadge() { var b = $('#badge'); if (!b) return; b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }

  /* ------------------------------------------------------------ keranjang */
  function lineKey(l) { return l.kind + '|' + l.sku + '|' + l.variant; }
  function addToCart(line) {
    var k = lineKey(line), ex = cart.filter(function (l) { return lineKey(l) === k; })[0];
    if (ex) ex.qty += line.qty; else cart.push(line);
    saveCart();
  }
  function lineImg(l) { var p = l.kind === 'rakitan' ? null : byId(l.sku); return l.kind === 'rakitan' ? ph('rakit') : (p ? photo(p) : ph('aksesoris')); }
  function renderCart() {
    var d = $('#cartDrawer');
    var body;
    if (!cart.length) {
      body = '<div class="empty">' + ico('bag') + '<p>Keranjang Anda masih kosong.</p><a class="btn btn--secondary" href="#/katalog/karet" data-close>Lihat Karet</a></div>';
    } else {
      body = cart.map(function (l, i) {
        return '<div class="cl"><div class="cl__img">' + lineImg(l) + '</div><div><div class="cl__name">' + esc(l.brand === 'Rakitan' ? l.name : l.brand + ' ' + l.name) + '</div>' + (lineHidden(l) ? '<div class="cl__gone">' + ico('alert') + 'Tidak lagi dijual. Hapus dari keranjang.</div>' : '') +
          (l.kind === 'rakitan' ? '<ul class="cl__sub"><li>Blade: ' + esc(l.components.blade.name) + ' · ' + esc(l.components.blade.handle) + '</li><li>Karet FH: ' + esc(l.components.fh.name) + ' · ' + esc(l.components.fh.color) + ' ' + esc(l.components.fh.thickness) + '</li><li>Karet BH: ' + esc(l.components.bh.name) + ' · ' + esc(l.components.bh.color) + ' ' + esc(l.components.bh.thickness) + '</li><li>Jasa rakit + lem</li></ul>' : (l.variant ? '<div class="cl__var">' + esc(l.variant) + '</div>' : '')) +
          '<div class="cl__row"><div class="qty"><button type="button" data-q="-1" data-i="' + i + '" aria-label="Kurangi jumlah">' + ico('minus') + '</button><output aria-live="polite">' + l.qty + '</output><button type="button" data-q="1" data-i="' + i + '" aria-label="Tambah jumlah">' + ico('plus') + '</button></div>' +
          '<div style="text-align:right"><div class="num" style="font-weight:700">' + rupiah(l.qty * l.est_price) + '</div><div class="hint" style="font-size:12px">estimasi</div></div>' +
          '<button class="icon-btn" data-del="' + i + '" aria-label="Hapus ' + esc(l.name) + '" type="button">' + ico('trash') + '</button></div></div></div>';
      }).join('');
    }
    d.innerHTML = '<div class="drawer__head"><h2 id="cartTitle" data-focus>Keranjang</h2><button class="icon-btn" data-close aria-label="Tutup keranjang" type="button">' + ico('x') + '</button></div><div class="drawer__body">' + body + '</div>' +
      (cart.length ? '<div class="drawer__foot"><div class="sumrow"><span>Subtotal estimasi</span><b class="num">' + rupiah(cartSubtotal()) + '</b></div><div class="sumrow hint"><span>Ongkir</span><span>dihitung setelah konfirmasi</span></div>' +
        '<p class="hint">Harga dan ketersediaan final dikonfirmasi lewat WhatsApp sebelum Anda membayar. Barang dikirim dari toko David setelah tiba dari distributor.</p>' +
        (hiddenCount() ? '<div class="note note--bad">' + ico('alert') + '<span>' + hiddenCount() + ' barang tidak lagi dijual. Hapus dulu sebelum checkout.</span></div><button class="btn btn--block" type="button" aria-disabled="true" disabled>Checkout ' + ico('right', 'ico arrow') + '</button>' : '<a class="btn btn--block" href="#/checkout" data-close>Checkout ' + ico('right', 'ico arrow') + '</a>') + '</div>' : '');
  }
  document.addEventListener('click', function (e) {
    var d = $('#cartDrawer');
    if (d && d.contains(e.target)) {
      var q = e.target.closest('[data-q]'), del = e.target.closest('[data-del]'), cl = e.target.closest('[data-close]');
      if (q) { var l = cart[+q.dataset.i]; l.qty = Math.max(1, Math.min(99, l.qty + (+q.dataset.q))); saveCart(); renderCart(); var again = $('[data-q="' + q.dataset.q + '"][data-i="' + q.dataset.i + '"]', d); if (again) again.focus(); }
      else if (del) { var removed = cart.splice(+del.dataset.del, 1)[0]; var idx = +del.dataset.del; saveCart(); renderCart(); toast('Barang dihapus.', { label: 'Urungkan', fn: function () { cart.splice(idx, 0, removed); saveCart(); if (openEl === d) renderCart(); } }); }
      else if (cl) closeLayer(true);
    }
    var cp = e.target.closest('[data-copy]');
    if (cp) { var t = cp.dataset.copy; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Disalin: ' + t); }, function () { toast('Tidak bisa menyalin otomatis. Salin manual: ' + t); }); }
  });

  /* fly-to-cart (M4) */
  function flyToCart(srcEl, cat) {
    var cartBtn = $('#btnCart');
    if (reduced || !srcEl || !cartBtn || !srcEl.animate) { bumpBadge(); return; }
    var a = srcEl.getBoundingClientRect(), b = cartBtn.getBoundingClientRect();
    if (!b.width || b.bottom < 0) { bumpBadge(); return; }
    var el = document.createElement('div'); el.className = 'fly'; el.innerHTML = ph(cat); document.body.appendChild(el);
    var x0 = a.left + a.width / 2 - 24, y0 = a.top + a.height / 2 - 24, x1 = b.left + b.width / 2 - 24, y1 = b.top + b.height / 2 - 24;
    var an = el.animate([
      { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1)', opacity: 1 },
      { transform: 'translate(' + ((x0 + x1) / 2) + 'px,' + (Math.min(y0, y1) - 60) + 'px) scale(.7)', opacity: 1, offset: .5 },
      { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.3)', opacity: .6 }
    ], { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)' });
    an.finished.then(function () { el.remove(); bumpBadge(); }, function () { el.remove(); bumpBadge(); });
  }

  /* ------------------------------------------------------------ kartu & helper tampilan */
  function specLine(p) {
    if (p.category === 'blade') return [p.speed, p.options[0].values.join('/')].filter(Boolean).join(' · ');
    if (p.category === 'karet') return [p.type, p.spec[1] ? p.spec[1][1] : ''].filter(Boolean).join(' · ');
    return p.spec.length ? p.spec[0][1] : '';
  }
  function priceNote(p) { return p.price_status === 'P' ? 'perkiraan kasar' : 'estimasi'; }
  function card(p, i, feat) {
    var mulai = (p.price_to || p.price_from) ? '<small>mulai </small>' : '';
    return '<a class="card' + (feat ? ' card--feat' : '') + '" href="#/produk/' + p.slug + '" data-reveal style="--i:' + Math.min(i || 0, 8) + '" title="' + esc(p.brand + ' ' + p.name) + '">' +
      '<div class="card__img">' + photo(p) + '<span class="chip-av">Via konfirmasi</span>' + (imgOf(p) ? '' : '<span class="foto">Foto segera</span>') + '</div>' +
      '<div class="card__body"><div class="card__brand">' + esc(p.brand) + '</div><div class="card__name">' + esc(p.name) + '</div><div class="card__spec">' + esc(specLine(p)) + '</div>' +
      '<div class="card__price">' + mulai + priceHtml(p.price) + '</div><div class="card__est">' + priceNote(p) + ' · harga final dikonfirmasi</div></div></a>';
  }
  function initReveal(root) {
    var els = $$('[data-reveal]', root);
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }); }, { threshold: .15 }) : null;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!io || r.top < innerHeight) el.classList.add('is-in'); else io.observe(el);
    });
  }

  /* ------------------------------------------------------------ router */
  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var parts = h.split('?'), segs = parts[0].split('/').filter(Boolean);
    return { segs: segs, q: new URLSearchParams(parts[1] || '') };
  }
  var cleanup = null;
  function route() {
    closeLayer(true);
    if (cleanup) { cleanup(); cleanup = null; }
    var old = $('#app'), app = old.cloneNode(false); old.replaceWith(app); // buang listener halaman sebelumnya
    var r = parseHash(), v = r.segs[0] || '';
    isHome = v === '';
    applyHeader();
    $$('.nav a').forEach(function (a) { var on = (a.dataset.nav === r.segs[1] && v === 'katalog') || (a.dataset.nav === 'rakit' && v === 'rakit') || (a.dataset.nav === 'lacak' && v === 'lacak'); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    var views = { '': viewHome, katalog: viewCatalog, produk: viewProduct, rakit: viewRakit, checkout: viewCheckout, sukses: viewSuccess, lacak: viewTrack };
    app.innerHTML = '';
    (views[v] || viewNotFound)(app, r);
    if (!app.firstElementChild) viewNotFound(app, r);
    app.firstElementChild.classList.add('view-in');
    hideNoWa(app);
    initReveal(app);
    window.scrollTo(0, 0);
    document.title = (document.title.split(' — ')[0] === 'DStore' ? '' : '') + 'DStore — Peralatan Tenis Meja';
  }
  function navigate(hash, replace) {
    if (replace) { history.replaceState(null, '', hash); route2(); } else location.hash = hash;
  }
  var keepScroll = false;
  function route2() { var y = window.scrollY; route(); window.scrollTo(0, y); }
  function viewNotFound(app) { app.innerHTML = '<div class="container page"><div class="empty">' + ico('alert') + '<p>Halaman tidak ditemukan.</p><a class="btn" href="#/">Ke beranda</a></div></div>'; }

  /* ------------------------------------------------------------ BERANDA */
  function viewHome(app) {
    var seen = false; try { seen = sessionStorage.getItem('ds_hero_seen') === '1'; sessionStorage.setItem('ds_hero_seen', '1'); } catch (e) { }
    var all = vprods(), empty = !all.length;
    function has(cat) { return all.some(function (p) { return p.category === cat; }); }
    var seenB = {}, brandNames = [];
    all.forEach(function (p) { if (!seenB[p.brand]) { seenB[p.brand] = 1; brandNames.push(p.brand); } });
    brandNames.sort();
    var brandsHtml = brandNames.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('');
    var tiles = [
      ['karet', 'Karet', 'tile--a tile--big', 'Inverted, anti-spin, tensor'], ['blade', 'Blade', 'tile--b tile--tall', 'Kayu & karbon'],
      ['rakit', 'Bet Rakitan', 'tile--c', 'Blade + 2 karet'], ['bola', 'Bola', 'tile--d', '3-star & latihan'],
      ['meja', 'Meja & Net', 'tile--e', 'Meja, net, tiang'], ['tas', 'Tas & Cover', 'tile--b', ''], ['sepatu', 'Sepatu', 'tile--c', ''], ['latihan', 'Robot & Latihan', 'tile--d', '']
    ].filter(function (t) { return t[0] === 'rakit' ? (has('blade') && has('karet')) : has(t[0]); });
    var canRakit = has('blade') && has('karet');
    var feat = all.slice(-5).reverse(); // produk terbaru = lima baris terakhir di sheet
    var karet = all.filter(function (p) { return p.category === 'karet'; }).slice(0, 10);
    var blade = all.filter(function (p) { return p.category === 'blade'; }).slice(0, 10);
    var steps = [['Pesan', 'Pilih produk, harga yang tampil adalah estimasi.'], ['David cek ketersediaan', 'Pesanan diteruskan ke distributor.'], ['Harga final via WhatsApp', 'Anda terima harga final + ongkir.'], ['Transfer', 'Transfer ke rekening David, unggah bukti.'], ['Dikirim', 'Barang tiba di David, lalu dikirim ke Anda.']];
    app.innerHTML =
      '<section class="hero' + (seen ? ' no-anim' : '') + '"><div class="hero__court"></div><div class="container hero__in">' +
      '<div><h1 class="display"><span class="ln" style="--k:0"><span style="--k:0">Alat tenis meja</span></span><span class="ln"><span style="--k:1">pilihan pemain</span></span><span class="ln"><span style="--k:2">klub.</span></span></h1>' +
      '<p class="hero__lead">Blade dan karet dari brand yang dipakai di klub. Harga estimasi dulu, David cek ketersediaan, baru harga final.</p>' +
      '<div class="hero__cta">' + (empty ? '' : '<a class="btn btn--light" href="#/' + (canRakit ? 'rakit' : 'katalog') + '">' + (canRakit ? 'Rakit Bet Sendiri ' : 'Lihat katalog ') + ico('right', 'ico arrow') + '</a>' + (has('karet') ? '<a class="btn btn--text" style="color:#fff" href="#/katalog/karet">Lihat semua karet</a>' : '')) + '</div></div>' +
      '<div class="hero__art"><svg class="trail" viewBox="0 0 480 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path class="hero__ballpath" d="M20 250 C 120 20, 300 10, 440 200"/><circle class="hero__ball" r="10" cx="0" cy="0"/></svg>' +
      '<div class="bet" role="img" aria-label="Bet tenis meja, sisi merah dan hitam">' + betMini('Merah', 'Hitam') + '</div></div></div></section>' +
      (brandsHtml ? '<div class="marquee" aria-label="Brand yang tersedia"><div class="marquee__track"><div class="marquee__set">' + brandsHtml + '</div><div class="marquee__set" aria-hidden="true">' + brandsHtml + '</div></div></div>' : '') +
      (empty ? '<section class="section"><div class="container">' + emptyCatalogHtml(false) + '</div></section>' : '') +
      (tiles.length ? '<section class="section"><div class="container"><div class="section__head"><h2>Belanja per kategori</h2></div><div class="bento">' +
      tiles.map(function (t, i) { return '<a class="tile ' + t[2] + '" href="' + navHref(t[0]) + '" data-reveal style="--i:' + i + '"><div class="art"><svg viewBox="0 0 120 120" stroke-linecap="round" stroke-linejoin="round">' + (PH[t[0] === 'rakit' ? 'rakit' : t[0]]) + '</svg></div><h3>' + t[1] + '</h3>' + (t[3] ? '<small>' + t[3] + '</small>' : '') + '</a>'; }).join('') +
      '</div></div></section>' : '') +
      '<section class="section" style="padding-top:0"><div class="container"><div class="section__head"><h2>Cara pesan di DStore</h2></div><div class="steps">' +
      steps.map(function (s, i) { return '<div class="step" data-reveal style="--i:' + i + '"><b>' + (i + 1) + '</b><div><h3>' + s[0] + '</h3><p>' + s[1] + '</p></div></div>'; }).join('') + '</div>' +
      '<p class="hint" style="margin-top:16px">David tidak menyimpan stok. Setiap pesanan dicek dulu ke distributor, jadi Anda tidak membayar sebelum ketersediaan jelas.</p></div></section>' +
      (feat.length ? '<section class="section" style="padding-top:0"><div class="container"><div class="section__head"><h2>Produk terbaru</h2><a class="btn btn--text" href="#/katalog">Lihat semua</a></div><div class="feat-grid">' +
      feat.map(function (p, i) { return card(p, i, i === 0); }).join('') + '</div></div></section>' : '') +
      (karet.length ? '<section class="section" style="padding-top:0"><div class="container"><div class="section__head"><h2>Karet</h2><a class="btn btn--text" href="#/katalog/karet">Lihat semua</a></div><div class="carousel">' + karet.map(function (p, i) { return card(p, i); }).join('') + '</div></div></section>' : '') +
      (canRakit ? '<section class="section" style="padding-top:0"><div class="container"><div class="banner" data-reveal><div><h2>Rakit bet sendiri</h2><p>Pilih blade, karet forehand, dan karet backhand. Kami rakit dan sistem mengecek aturan warna ITTF.</p><a class="btn btn--light" href="#/rakit">Mulai Merakit ' + ico('right', 'ico arrow') + '</a></div>' +
      '<div class="banner__art" aria-hidden="true"><svg viewBox="0 0 120 120" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">' + PH.karet + '</svg><svg viewBox="0 0 120 120" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">' + PH.blade + '</svg><svg viewBox="0 0 120 120" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">' + PH.karet + '</svg></div></div></div></section>' : '') +
      (blade.length ? '<section class="section" style="padding-top:0"><div class="container"><div class="section__head"><h2>Blade</h2><a class="btn btn--text" href="#/katalog/blade">Lihat semua</a></div><div class="carousel">' + blade.map(function (p, i) { return card(p, i); }).join('') + '</div></div></section>' : '');
  }

  /* ------------------------------------------------------------ KATALOG */
  var PAGE = 24;
  function lev(a, b) { var m = [], i, j; for (i = 0; i <= a.length; i++) m[i] = [i]; for (j = 1; j <= b.length; j++) m[0][j] = j; for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return m[a.length][b.length]; }
  function csv(q, k) { var v = q.get(k); return v ? v.split(',').filter(Boolean) : []; }
  function readFilters(r) {
    var q = r.q;
    return { cat: r.segs[1] || '', q: (q.get('q') || '').trim(), brand: csv(q, 'brand'), min: q.get('min') || '', max: q.get('max') || '', th: csv(q, 'th'), col: csv(q, 'col'), type: csv(q, 'type'), speed: csv(q, 'speed'), handle: csv(q, 'handle'), size: csv(q, 'size'), sort: q.get('sort') || '', n: parseInt(q.get('n'), 10) || 1 };
  }
  function filterHash(f) {
    var ps = [];
    ['q', 'min', 'max', 'sort'].forEach(function (k) { if (f[k]) ps.push(k + '=' + encodeURIComponent(f[k])); });
    ['brand', 'th', 'col', 'type', 'speed', 'handle', 'size'].forEach(function (k) { if (f[k].length) ps.push(k + '=' + encodeURIComponent(f[k].join(','))); });
    if (f.n > 1) ps.push('n=' + f.n);
    return '#/katalog' + (f.cat ? '/' + f.cat : '') + (ps.length ? '?' + ps.join('&') : '');
  }
  function optVals(p, key) { var o = p.options.filter(function (x) { return x.key === key; })[0]; return o ? o.values : []; }
  function applyFilters(f) {
    var toks = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    var min = parseInt(f.min, 10), max = parseInt(f.max, 10);
    return vprods().filter(function (p) {
      if (f.cat && p.category !== f.cat) return false;
      if (toks.length) { var hay = (p.brand + ' ' + p.name + ' ' + catName(p.category)).toLowerCase(); if (!toks.every(function (t) { return hay.indexOf(t) >= 0; })) return false; }
      if (f.brand.length && f.brand.indexOf(p.brand) < 0) return false;
      if (!isNaN(min) && p.price < min) return false;
      if (!isNaN(max) && p.price > max) return false;
      if (f.th.length && !f.th.some(function (v) { return optVals(p, 'thickness').indexOf(v) >= 0; })) return false;
      if (f.col.length && !f.col.some(function (v) { return optVals(p, 'color').indexOf(v) >= 0; })) return false;
      if (f.type.length && f.type.indexOf(p.type) < 0) return false;
      if (f.speed.length && f.speed.indexOf(p.speed) < 0) return false;
      if (f.handle.length && !f.handle.some(function (v) { return optVals(p, 'handle').indexOf(v) >= 0; })) return false;
      if (f.size.length && !f.size.some(function (v) { return optVals(p, 'size').indexOf(v) >= 0; })) return false;
      return true;
    });
  }
  function sortList(list, s) {
    var a = list.slice();
    if (s === 'asc') a.sort(function (x, y) { return x.price - y.price; });
    else if (s === 'desc') a.sort(function (x, y) { return y.price - x.price; });
    else if (s === 'az') a.sort(function (x, y) { return (x.brand + x.name).localeCompare(y.brand + y.name); });
    return a;
  }
  function facet(title, key, vals, f) {
    if (!vals.length) return '';
    return '<div class="fgroup"><fieldset><legend>' + title + '</legend>' + vals.map(function (v) {
      return '<label class="check"><input type="checkbox" data-f="' + key + '" value="' + esc(v) + '"' + (f[key].indexOf(v) >= 0 ? ' checked' : '') + '> ' + esc(v) + '</label>';
    }).join('') + '</fieldset></div>';
  }
  function filtersHtml(f) {
    var base = vprods().filter(function (p) { return !f.cat || p.category === f.cat; });
    var brands = []; base.forEach(function (p) { if (brands.indexOf(p.brand) < 0) brands.push(p.brand); }); brands.sort();
    var h = facet('Brand', 'brand', brands, f);
    h += '<div class="fgroup"><div class="fg-title">Harga estimasi (Rp)</div><div class="price-in"><div class="field"><label class="sr-only" for="fmin">Harga minimum</label><input class="input" id="fmin" data-f="min" inputmode="numeric" placeholder="Min" value="' + esc(f.min) + '"></div><div class="field"><label class="sr-only" for="fmax">Harga maksimum</label><input class="input" id="fmax" data-f="max" inputmode="numeric" placeholder="Maks" value="' + esc(f.max) + '"></div></div></div>';
    if (f.cat === 'blade') { h += facet('Kecepatan', 'speed', ['OFF', 'ALL', 'DEF'], f) + facet('Handle', 'handle', ['FL', 'ST', 'AN', 'CS'], f); }
    if (f.cat === 'karet') { h += facet('Ketebalan sponge (mm)', 'th', THICK_ALL, f) + facet('Warna', 'col', ['Hitam', 'Merah', 'Biru'], f) + facet('Tipe', 'type', ['Inverted', 'Anti-spin'], f); }
    if (f.cat === 'sepatu') h += facet('Ukuran (EU)', 'size', ['38', '39', '40', '41', '42', '43', '44', '45'], f);
    return h;
  }
  var THICK_ALL = ['1.8', '2.0', 'Max'];
  var FLABEL = { brand: '', th: 'mm', col: '', type: '', speed: '', handle: '', size: 'EU ' };

  function viewCatalog(app, r) {
    if (!vprods().length) { app.innerHTML = '<div class="container page">' + emptyCatalogHtml(true) + '</div>'; return; }
    var f = readFilters(r), list = sortList(applyFilters(f), f.sort), total = list.length;
    var title = f.cat ? catName(f.cat) : (f.q ? 'Hasil pencarian' : 'Semua produk');
    var chips = [];
    ['brand', 'th', 'col', 'type', 'speed', 'handle', 'size'].forEach(function (k) { f[k].forEach(function (v) { chips.push('<button class="chip chip--x" type="button" data-rm="' + k + '" data-v="' + esc(v) + '">' + (k === 'size' ? 'EU ' : '') + esc(v) + (k === 'th' ? ' mm' : '') + ico('x') + '<span class="sr-only"> hapus filter</span></button>'); }); });
    if (f.min || f.max) chips.push('<button class="chip chip--x" type="button" data-rm="price">Rp ' + esc(f.min || '0') + '–' + esc(f.max || '∞') + ico('x') + '<span class="sr-only"> hapus filter</span></button>');
    if (f.q) chips.push('<button class="chip chip--x" type="button" data-rm="q">"' + esc(f.q) + '"' + ico('x') + '<span class="sr-only"> hapus pencarian</span></button>');
    var shown = list.slice(0, PAGE * f.n);
    var sortSel = '<label class="sr-only" for="sort">Urutkan</label><select class="select" id="sort"><option value="">Urutkan: Relevan</option><option value="asc"' + (f.sort === 'asc' ? ' selected' : '') + '>Harga terendah</option><option value="desc"' + (f.sort === 'desc' ? ' selected' : '') + '>Harga tertinggi</option><option value="az"' + (f.sort === 'az' ? ' selected' : '') + '>Nama A–Z</option></select>';
    app.innerHTML = '<div class="container page"><div class="cat-head"><div><h1 class="page__title">' + esc(title) + '</h1><p class="hint num" id="cnt">' + total + ' produk · harga adalah estimasi</p></div>' +
      '<div class="toolbar"><button class="btn btn--secondary btn--sm filter-btn" id="btnFilter" type="button">' + ico('filter') + 'Filter' + (chips.length ? ' (' + chips.length + ')' : '') + '</button>' + sortSel + '</div></div>' +
      (f.cat ? '' : '<div class="active-chips">' + CAT.categories.map(function (c) { return '<a class="chip" href="#/katalog/' + esc(c.id) + '">' + esc(c.name) + '</a>'; }).join('') + '</div>') +
      '<div class="catalog"><aside class="filters" id="filters" aria-label="Filter">' + filtersHtml(f) + '</aside><div><div class="active-chips" id="chips">' + chips.join('') + (chips.length ? '<button class="btn btn--text" type="button" data-rm="all">Hapus semua</button>' : '') + '</div><div class="grid-wrap" id="gw">' + gridHtml(shown, total, f) + '</div></div></div></div>';

    function go(nf, quiet) {
      var gw = $('#gw'); if (gw) gw.classList.add('is-loading');
      setTimeout(function () { navigate(filterHash(nf), true); }, reduced ? 0 : 120);
    }
    function collect(root) {
      var nf = readFilters(parseHash()); // dasar: URL saat ini
      ['brand', 'th', 'col', 'type', 'speed', 'handle', 'size'].forEach(function (k) { nf[k] = $$('[data-f="' + k + '"]:checked', root).map(function (x) { return x.value; }); });
      nf.min = ($('[data-f="min"]', root) || {}).value || ''; nf.max = ($('[data-f="max"]', root) || {}).value || '';
      nf.min = nf.min.replace(/\D/g, ''); nf.max = nf.max.replace(/\D/g, ''); nf.n = 1; return nf;
    }
    var side = $('#filters');
    side.addEventListener('change', function () { go(collect(side)); });
    $('#sort').addEventListener('change', function (e) { var nf = readFilters(parseHash()); nf.sort = e.target.value; nf.n = 1; go(nf); });
    $('#chips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]'); if (!b) return;
      var nf = readFilters(parseHash()), k = b.dataset.rm;
      if (k === 'all') { nf = { cat: nf.cat, q: '', brand: [], min: '', max: '', th: [], col: [], type: [], speed: [], handle: [], size: [], sort: nf.sort, n: 1 }; }
      else if (k === 'price') { nf.min = ''; nf.max = ''; } else if (k === 'q') nf.q = '';
      else nf[k] = nf[k].filter(function (x) { return x !== b.dataset.v; });
      nf.n = 1; go(nf);
    });
    app.addEventListener('click', function (e) {
      var m = e.target.closest('[data-more]'); if (m) { var nf = readFilters(parseHash()); nf.n++; navigate(filterHash(nf), true); }
      var cl = e.target.closest('[data-clear]'); if (cl) go({ cat: f.cat, q: '', brand: [], min: '', max: '', th: [], col: [], type: [], speed: [], handle: [], size: [], sort: '', n: 1 });
    });
    $('#btnFilter').addEventListener('click', function (e) { openFilterSheet(f, e.currentTarget, collect); });
  }
  function gridHtml(shown, total, f) {
    if (!total) {
      var sug = ''; if (f.q) { var words = {}; vprods().forEach(function (p) { (p.brand + ' ' + p.name).toLowerCase().split(/[^a-z0-9]+/).forEach(function (w) { if (w.length > 3) words[w] = p.name; }); }); var best = null, bd = 3; Object.keys(words).forEach(function (w) { var d = lev(f.q.toLowerCase(), w); if (d < bd) { bd = d; best = w; } }); if (best) sug = ' Mungkin maksud Anda <a href="#/katalog?q=' + encodeURIComponent(best) + '"><b>' + esc(best.charAt(0).toUpperCase() + best.slice(1)) + '</b></a>?'; }
      return '<div class="empty">' + ico('search') + '<p>' + (f.q ? 'Tidak ada hasil untuk "' + esc(f.q) + '".' + sug : 'Tidak ada produk yang cocok dengan filter ini.') + '</p><button class="btn btn--secondary" type="button" data-clear>Hapus semua filter</button></div>';
    }
    return '<div class="grid grid--4 fade-in">' + shown.map(function (p, i) { return card(p, i); }).join('') + '</div>' +
      (shown.length < total ? '<div style="text-align:center;margin-top:32px"><button class="btn btn--secondary" type="button" data-more>Muat ' + Math.min(PAGE, total - shown.length) + ' lagi</button><p class="hint" style="margin-top:8px">Menampilkan ' + shown.length + ' dari ' + total + '</p></div>' : '');
  }
  function openFilterSheet(f, trigger, collect) {
    var sh = $('#filterSheet');
    sh.innerHTML = '<div class="drawer__head"><h2 data-focus>Filter</h2><button class="icon-btn" data-close aria-label="Tutup filter" type="button">' + ico('x') + '</button></div><div class="drawer__body" id="fsBody">' + filtersHtml(f) + '</div><div class="drawer__foot"><button class="btn btn--block" type="button" id="fsApply"></button></div>';
    function cnt() { var nf = collect(sh); nf.q = f.q; nf.cat = f.cat; $('#fsApply').textContent = 'Tampilkan ' + applyFilters(nf).length + ' produk'; return nf; }
    sh.onchange = cnt; sh.oninput = cnt; cnt();
    sh.onclick = function (e) { if (e.target.closest('[data-close]')) closeLayer(); if (e.target.closest('#fsApply')) { var nf = cnt(); nf.sort = readFilters(parseHash()).sort; closeLayer(true); navigate(filterHash(nf), true); } };
    openLayer(sh, trigger);
  }

  /* ------------------------------------------------------------ DETAIL PRODUK */
  function variantLabel(p, sel) {
    var parts = [];
    p.options.forEach(function (o) {
      var v = sel[o.key]; if (!v) return;
      if (o.key === 'thickness') parts.push(v === 'Max' ? 'Max' : v + 'mm');
      else if (o.key === 'isi') parts.push('isi ' + v);
      else if (o.key === 'size') parts.push('EU ' + v);
      else if (o.key === 'width') parts.push(v + ' mm');
      else parts.push(v);
    });
    return parts.join(' · ');
  }
  function viewProduct(app, r) {
    var p = bySlug(r.segs[1]);
    if (!p) { viewNotFound(app); return; }
    if (!prodVisible(p)) { app.innerHTML = '<div class="container page"><div class="empty">' + ico('info') + '<p><b>Produk ini sedang tidak dijual.</b></p><a class="btn" href="#/katalog">Lihat katalog</a></div></div>'; return; }
    var sel = {}, qty = 1;
    p.options.forEach(function (o) { if (o.values.length === 1) sel[o.key] = o.values[0]; });
    var rakit = (p.category === 'blade' || p.category === 'karet');
    app.innerHTML = '<div class="container page has-buybar"><a class="crumb" href="#/katalog/' + p.category + '">' + ico('left') + ' ' + catName(p.category) + '</a>' +
      '<div class="pd"><div><div class="pd__img" id="pdImg">' + photo(p) + (imgOf(p) ? '' : '<span class="foto">Foto segera</span>') + '</div>' + (imgOf(p) ? '<p class="hint pd__ref">Foto referensi</p>' : '') + '</div>' +
      '<div class="pd__info"><div class="eyebrow">' + esc(p.brand) + '</div><h1>' + esc(p.name) + '</h1>' +
      '<div class="pd__price num">' + ((p.price_to || p.price_from) ? '<small style="font-family:var(--font-sans);font-size:14px;font-weight:500;color:var(--text-muted)">mulai </small>' : '') + priceHtml(p.price) + '</div>' +
      '<div class="pd__est">' + (p.price_status === 'P' ? 'Perkiraan kasar, belum ada harga pasti di Indonesia. ' : 'Harga estimasi. ') + 'Harga final dikonfirmasi setelah cek ketersediaan ke distributor.' + (p.price_to ? ' Kisaran di pasar sampai ' + rupiah(p.price_to) + '.' : '') + '</div>' +
      '<p style="margin-top:12px"><span class="badge badge--info">' + ico('info') + 'Via konfirmasi</span> <span class="hint">dicek setelah Anda memesan</span></p>' +
      '<div id="opts"></div><div id="buy"></div>' +
      '<div style="margin-top:24px">' + (p.spec.length ? '<h2 style="font-size:16px;margin-bottom:4px">Spesifikasi</h2><table class="spec">' + p.spec.map(function (s) { return '<tr><th>' + esc(s[0]) + '</th><td>' + esc(s[1]) + '</td></tr>'; }).join('') + '</table><p class="hint" style="margin:6px 0 16px;font-size:13px">Spesifikasi dari riset awal, belum diverifikasi ke brand.</p>' : '') +
      '<details class="acc"><summary>Deskripsi' + ico('down') + '</summary><div class="acc__body">' + esc(p.brand + ' ' + p.name + ' — ' + catName(p.category) + '. ' + (p.note || 'Deskripsi lengkap menyusul dari David.')) + '</div></details>' +
      '<details class="acc"><summary>Cara pesan' + ico('down') + '</summary><div class="acc__body">Pesan tanpa bayar dulu. David cek ketersediaan ke distributor, mengirim harga final lewat WhatsApp, Anda transfer, lalu barang dikirim setelah tiba di David.</div></details>' +
      (rakit ? '<details class="acc"><summary>Pakai di Rakit Bet' + ico('down') + '</summary><div class="acc__body">Gabungkan dengan blade dan karet lain. <a href="#/rakit?' + (p.category === 'blade' ? 'blade=' : 'fh=') + p.sku + '">Rakit bet dengan ' + esc(p.name) + '</a></div></details>' : '') +
      '</div><p style="margin-top:16px"><a class="btn btn--text" target="_blank" rel="noopener" href="' + davidLink('Halo David, saya tanya produk ' + p.brand + ' ' + p.name + ' (' + p.sku + ').') + '">' + ico('wa') + 'Tanya David</a></p></div></div></div>';

    function missing() { return p.options.filter(function (o) { return !sel[o.key]; })[0]; }
    function draw() {
      var oh = '';
      p.options.forEach(function (o) {
        oh += '<fieldset class="optgroup"><legend>' + esc(o.label) + (o.key === 'handle' ? ' <button class="icon-btn" type="button" style="width:28px;height:28px;vertical-align:middle" data-tip="FL = flared (melebar di ujung) · ST = straight (lurus) · AN = anatomic · CS = penhold Cina" aria-label="Arti handle">' + ico('info') + '</button>' : '') + '</legend>';
        if (o.type === 'swatch') oh += '<div class="swatches">' + o.values.map(function (v) { return '<button class="sw" type="button" data-k="' + o.key + '" data-v="' + esc(v) + '" aria-pressed="' + (sel[o.key] === v) + '"><i class="' + colorCls(v) + '"></i>' + v + '</button>'; }).join('') + '</div>';
        else oh += '<div class="seg">' + o.values.map(function (v) { return '<button type="button" data-k="' + o.key + '" data-v="' + esc(v) + '" aria-pressed="' + (sel[o.key] === v) + '">' + esc(v) + '</button>'; }).join('') + '</div>';
        oh += '</fieldset>';
      });
      oh += '<fieldset class="optgroup"><legend>Jumlah</legend><div class="qty"><button type="button" data-qty="-1" aria-label="Kurangi">' + ico('minus') + '</button><output>' + qty + '</output><button type="button" data-qty="1" aria-label="Tambah">' + ico('plus') + '</button></div></fieldset>';
      $('#opts').innerHTML = oh;
      var miss = missing();
      $('#buy').innerHTML = '<div class="buybar buybar--inline">' + (miss ? '<div class="buybar__help" role="status">Pilih ' + esc(miss.label.replace(/ \(.*\)/, '').toLowerCase()) + ' dulu</div>' : '') +
        '<div class="buybar__total num">' + rupiah(p.price * qty) + '<small>estimasi</small></div><button class="btn" id="btnAdd" type="button"' + (miss ? ' aria-disabled="true"' : '') + '>' + ico('bag') + '<span>Tambah ke Keranjang</span></button></div>';
    }
    draw();
    app.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]');
      if (b && $('#opts').contains(b)) { var k = b.dataset.k; sel[k] = sel[k] === b.dataset.v ? sel[k] : b.dataset.v; draw(); var again = $('[data-k="' + qa(k) + '"][data-v="' + qa(sel[k]) + '"]'); if (again) again.focus(); return; }
      var q = e.target.closest('[data-qty]'); if (q) { qty = Math.max(1, Math.min(99, qty + (+q.dataset.qty))); draw(); $('[data-qty="' + q.dataset.qty + '"]').focus(); return; }
      var tip = e.target.closest('[data-tip]'); if (tip) { toast(tip.dataset.tip); return; }
      var add = e.target.closest('#btnAdd');
      if (add) {
        var miss = missing();
        if (miss) { toast('Pilih ' + miss.label.replace(/ \(.*\)/, '').toLowerCase() + ' dulu.', { err: true }); return; }
        addToCart({ line_id: '', key: '', kind: 'product', sku: p.sku, brand: p.brand, name: p.name, variant: variantLabel(p, sel), qty: qty, est_price: p.price, components: null });
        flyToCart($('#pdImg'), p.category);
        var lab = $('span', add); lab.textContent = 'Ditambahkan'; add.classList.add('added');
        setTimeout(function () { if (add.isConnected) { lab.textContent = 'Tambah ke Keranjang'; add.classList.remove('added'); } }, 1500);
        toast('Ditambahkan ke keranjang.', { href: '#/checkout', label: 'Checkout' });
      }
    });
    var h = function (e) { if (e.target.closest && e.target.closest('#btnAdd')) { } };
    cleanup = function () { document.removeEventListener('click', h); };
    // pada layar kecil bar beli menempel di bawah
    $('#buy .buybar').classList.remove('buybar--inline'); if (matchMedia('(min-width:1024px)').matches) $('#buy .buybar').classList.add('buybar--inline');
  }

  /* ------------------------------------------------------------ RAKIT BET */
  var R, rkStep;
  var FLAG = 'Aturan ITTF: satu sisi hitam, sisi lain merah/biru/hijau/pink/ungu.';
  function colorAllowed(side, c) {
    var other = R[side === 'fh' ? 'bh' : 'fh'].color;
    if (!other) return true;
    if (other === 'Hitam') return c !== 'Hitam';
    return c === 'Hitam';
  }
  function rakitTotal() {
    var t = CAT.assembly_fee || 0, b = R.blade.sku && byId(R.blade.sku), f = R.fh.sku && byId(R.fh.sku), h = R.bh.sku && byId(R.bh.sku);
    return t + (b ? b.price : 0) + (f ? f.price : 0) + (h ? h.price : 0);
  }
  function rakitDone(step) {
    if (step === 1) return !!(R.blade.sku && R.blade.handle);
    if (step === 2) return !!(R.fh.sku && R.fh.thickness && R.fh.color);
    if (step === 3) return !!(R.bh.sku && R.bh.thickness && R.bh.color);
    return false;
  }
  function rakitValid() {
    var a = R.fh.color, b = R.bh.color;
    return !!(a && b && a !== b && (a === 'Hitam' || b === 'Hitam'));
  }
  function viewRakit(app, r) {
    if (!vprods().some(function (p) { return p.category === 'blade'; }) || !vprods().some(function (p) { return p.category === 'karet'; })) {
      app.innerHTML = '<div class="container page"><a class="crumb" href="#/">' + ico('left') + ' Beranda</a>' + emptyCatalogHtml(true) + '</div>'; return;
    }
    R = { blade: {}, fh: {}, bh: {} }; rkStep = 1;
    var qb = r.q.get('blade'), qf = r.q.get('fh');
    if (qb && prodVisible(byId(qb))) { R.blade.sku = qb; var o = optVals(byId(qb), 'handle'); if (o.length === 1) R.blade.handle = o[0]; rkStep = 2; }
    if (qf && prodVisible(byId(qf))) { R.fh.sku = qf; rkStep = R.blade.sku ? 2 : 1; }
    var lastTotal = null, filt = { blade: '', karet: '' };
    app.innerHTML = '<div class="container page has-buybar"><a class="crumb" href="#/">' + ico('left') + ' Beranda</a><h1 class="page__title" style="margin-bottom:16px">Rakit Bet</h1><div class="rk">' +
      '<div class="rk__left"><div class="rk__stage"><button class="flip" id="flip" type="button" aria-label="Balik bet: lihat sisi backhand"><div class="flip__in"><div class="flip__face">' + betFace('fh', null) + '</div><div class="flip__face back">' + betFace('bh', null) + '</div></div></button>' +
      '<div class="rk__labels" id="rkLabels"></div><div class="rk__hint">' + ico('flip') + 'Ketuk bet untuk membalik sisi</div></div><div class="rk__price" id="rkPrice"></div></div>' +
      '<div><div class="rk-steps" id="rkSteps"></div><div id="rkMain"></div></div></div></div>' +
      '<div class="buybar" id="rkBar"></div>';

    function setRubber(side, color) {
      var g = $('.rb[data-side="' + side + '"]'), usingB = g.classList.contains('show-b');
      var next = $(usingB ? '.rb-a' : '.rb-b', g); next.setAttribute('fill', colorVar(color)); g.classList.toggle('show-b');
    }
    function preview() {
      ['fh', 'bh'].forEach(function (s) { var g = $('.rb[data-side="' + s + '"]'); var want = colorVar(R[s].color); var cur = $(g.classList.contains('show-b') ? '.rb-b' : '.rb-a', g).getAttribute('fill'); if (cur !== want) setRubber(s, R[s].color); });
      function nm(side, lab) { var p = R[side].sku && byId(R[side].sku); return p ? '<span class="nm" data-k="' + side + p.sku + (R[side].color || '') + '"><i style="background:' + colorVar(R[side].color) + '"></i>' + lab + ': ' + esc(p.name) + '</span>' : '<span><i style="background:transparent"></i>' + lab + ': belum dipilih</span>'; }
      var lab = $('#rkLabels'), html = nm('fh', 'FH') + nm('bh', 'BH'), prev = lab.dataset.h;
      if (prev !== html) { lab.innerHTML = html; lab.dataset.h = html; }
      var rows = '', b = R.blade.sku && byId(R.blade.sku), f = R.fh.sku && byId(R.fh.sku), h = R.bh.sku && byId(R.bh.sku);
      function row(l, v) { return '<div class="sumrow"><span>' + l + '</span><span>' + (v == null ? '<span class="hint">—</span>' : num(v)) + '</span></div>'; }
      rows += row('Blade ' + (b ? esc(b.name) + (R.blade.handle ? ' · ' + R.blade.handle : '') : ''), b ? b.price : null);
      rows += row('Karet FH ' + (f ? esc(f.name) + ' · ' + esc(R.fh.color || '?') + ' ' + esc(R.fh.thickness || '') : ''), f ? f.price : null);
      rows += row('Karet BH ' + (h ? esc(h.name) + ' · ' + esc(R.bh.color || '?') + ' ' + esc(R.bh.thickness || '') : ''), h ? h.price : null);
      rows += CAT.assembly_fee == null ? '<div class="sumrow"><span>Perakitan + lem + sealing</span><span class="hint">[?] dikonfirmasi David</span></div>' : row('Perakitan + lem + sealing', CAT.assembly_fee);
      var t = rakitTotal(), changed = lastTotal !== null && lastTotal !== t; lastTotal = t;
      $('#rkPrice').innerHTML = rows + '<div class="sumrow total"><span>Total estimasi (Rp)</span><span class="num"><span class="roll"><span class="' + (changed ? 'roll__v' : '') + '">' + num(t) + '</span></span></span></div><p class="hint" style="font-size:13px">Harga estimasi' + (CAT.assembly_fee == null ? ', belum termasuk biaya rakit' : '') + '. Final dikonfirmasi setelah cek ketersediaan.</p>';
    }
    function stepsBar() {
      var names = ['Blade', 'Karet FH', 'Karet BH', 'Perakitan'];
      $('#rkSteps').innerHTML = names.map(function (n, i) {
        var s = i + 1, done = s < 4 && rakitDone(s);
        return '<button type="button" data-step="' + s + '"' + (s === rkStep ? ' aria-current="step"' : '') + ' class="' + (done ? 'done' : '') + '"><span class="n">' + (done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : s) + '</span>' + n + '</button>';
      }).join('');
    }
    function listHtml(cat, side) {
      var items = vprods().filter(function (p) { return p.category === cat; });
      var fv = filt[cat];
      if (fv) items = items.filter(function (p) { return cat === 'karet' ? p.type === fv : p.speed === fv; });
      var cur = side === 'blade' ? R.blade.sku : R[side].sku;
      var selOpts = cat === 'karet' ? ['', 'Inverted', 'Anti-spin'] : ['', 'OFF', 'ALL'];
      return '<div class="field" style="margin-bottom:12px"><label for="qf">Filter cepat: ' + (cat === 'karet' ? 'tipe' : 'kecepatan') + '</label><select class="select" id="qf" data-cat="' + cat + '">' + selOpts.map(function (v) { return '<option value="' + v + '"' + (fv === v ? ' selected' : '') + '>' + (v || 'Semua') + '</option>'; }).join('') + '</select></div>' +
        '<div class="plist">' + items.map(function (p) {
          return '<button class="prow" type="button" data-pick="' + esc(p.sku) + '" aria-pressed="' + (cur === p.sku) + '"><span class="prow__img">' + photo(p) + '</span><span><b>' + esc(p.brand + ' ' + p.name) + '</b><small>' + esc(specLine(p)) + '</small></span><span class="p">' + ((p.price_to || p.price_from) ? '<small style="font-weight:500;color:var(--text-muted)">mulai </small>' : '') + num(p.price) + '</span></button>';
        }).join('') + '</div>';
    }
    function optsFor(side) {
      var s = R[side], p = s.sku && byId(s.sku); if (!p) return '';
      var h = '';
      if (side === 'blade') {
        h += '<fieldset class="optgroup"><legend>Handle</legend><div class="seg">' + optVals(p, 'handle').map(function (v) { return '<button type="button" data-o="handle" data-v="' + esc(v) + '" aria-pressed="' + (s.handle === v) + '">' + esc(v) + '</button>'; }).join('') + '</div></fieldset>';
      } else {
        h += '<fieldset class="optgroup"><legend>Ketebalan sponge (mm)</legend><div class="seg">' + optVals(p, 'thickness').map(function (v) { return '<button type="button" data-o="thickness" data-v="' + esc(v) + '" aria-pressed="' + (s.thickness === v) + '">' + esc(v) + '</button>'; }).join('') + '</div></fieldset>';
        h += '<fieldset class="optgroup"><legend>Warna</legend><div class="swatches">' + optVals(p, 'color').map(function (v) { var ok = colorAllowed(side, v); return '<button class="sw" type="button" data-o="color" data-v="' + esc(v) + '" aria-pressed="' + (s.color === v) + '"' + (ok ? '' : ' aria-disabled="true"') + '><i class="' + colorCls(v) + '"></i>' + v + '</button>'; }).join('') + '</div>' +
          '<p class="hint" style="margin-top:8px">' + FLAG + '</p></fieldset>';
        var other = R[side === 'fh' ? 'bh' : 'fh'].color;
        if (other && optVals(p, 'color').every(function (c) { return !colorAllowed(side, c); })) h += '<div class="note note--bad" style="margin-top:8px">' + ico('alert') + '<span>Karet ini tidak punya warna yang sesuai dengan sisi lain (' + esc(other) + '). Pilih karet lain atau ubah warna sisi lain.</span></div>';
      }
      return h;
    }
    function main() {
      var h = '';
      if (rkStep === 1) h = '<h2 style="font-size:20px;margin-bottom:12px">Pilih blade</h2>' + listHtml('blade', 'blade') + optsFor('blade');
      else if (rkStep === 2) h = '<h2 style="font-size:20px;margin-bottom:12px">Pilih karet forehand (FH)</h2>' + listHtml('karet', 'fh') + optsFor('fh');
      else if (rkStep === 3) h = '<h2 style="font-size:20px;margin-bottom:12px">Pilih karet backhand (BH)</h2>' + listHtml('karet', 'bh') + optsFor('bh');
      else {
        var ok = rakitValid();
        h = '<h2 style="font-size:20px;margin-bottom:12px">Perakitan</h2>' +
          '<div class="note ' + (ok ? 'note--ok' : 'note--bad') + '">' + ico(ok ? 'check' : 'alert') + '<span>' + (ok ? 'Kombinasi warna sesuai aturan ITTF: ' + esc(R.fh.color) + ' (FH) dan ' + esc(R.bh.color) + ' (BH).' : 'Warna belum sah. ' + FLAG) + '</span></div>' +
          '<p class="hint" style="margin-top:12px">Ketiga komponen masuk keranjang sebagai satu baris. Biaya rakit ditentukan David. Jika salah satu komponen tidak tersedia, seluruh rakitan ditandai tidak tersedia sampai David menawarkan pengganti.</p>';
      }
      $('#rkMain').innerHTML = h;
      var bar = $('#rkBar'), canNext, label, help = '';
      if (rkStep < 4) {
        canNext = rakitDone(rkStep);
        label = 'Lanjut';
        if (!canNext) { var s = rkStep === 1 ? R.blade : R[rkStep === 2 ? 'fh' : 'bh']; help = !s.sku ? 'Pilih ' + (rkStep === 1 ? 'blade' : 'karet') + ' dulu' : (rkStep === 1 ? 'Pilih handle dulu' : !s.thickness ? 'Pilih ketebalan dulu' : 'Pilih warna dulu'); }
      } else { canNext = rakitDone(1) && rakitDone(2) && rakitDone(3) && rakitValid(); label = 'Tambah ke Keranjang'; if (!canNext) help = !rakitValid() && R.fh.color && R.bh.color ? FLAG : 'Lengkapi blade dan kedua karet dulu'; }
      bar.innerHTML = (help ? '<div class="buybar__help" role="status">' + esc(help.length > 60 ? 'Warna belum sah' : help) + '</div>' : '') + '<div class="buybar__total num">' + rupiah(rakitTotal()) + '<small>total estimasi</small></div><button class="btn" id="rkNext" type="button"' + (canNext ? '' : ' aria-disabled="true"') + '><span>' + label + '</span>' + (rkStep < 4 ? ico('right', 'ico arrow') : ico('bag')) + '</button>';
      stepsBar(); preview();
    }
    main();

    app.addEventListener('change', function (e) { if (e.target.id === 'qf') { filt[e.target.dataset.cat] = e.target.value; main(); $('#qf').focus(); } });
    app.addEventListener('click', function (e) {
      var st = e.target.closest('[data-step]'); if (st) { rkStep = +st.dataset.step; main(); return; }
      if (e.target.closest('#flip')) { var fl = $('#flip'); fl.classList.toggle('is-back'); fl.setAttribute('aria-label', fl.classList.contains('is-back') ? 'Balik bet: lihat sisi forehand' : 'Balik bet: lihat sisi backhand'); return; }
      var pk = e.target.closest('[data-pick]');
      if (pk) {
        var side = rkStep === 1 ? 'blade' : (rkStep === 2 ? 'fh' : 'bh'), p = byId(pk.dataset.pick), s = R[side];
        if (s.sku !== p.sku) {
          s.sku = p.sku;
          if (side === 'blade') { s.handle = optVals(p, 'handle').length === 1 ? optVals(p, 'handle')[0] : undefined; }
          else { s.thickness = undefined; if (optVals(p, 'color').indexOf(s.color) < 0) s.color = undefined; }
        }
        if (side !== 'blade' && s.color && !colorAllowed(side, s.color)) { s.color = undefined; toast(FLAG); }
        main(); var again = $('[data-pick="' + esc(p.sku) + '"]'); if (again) again.focus(); return;
      }
      var op = e.target.closest('[data-o]');
      if (op) {
        var sd = rkStep === 1 ? 'blade' : (rkStep === 2 ? 'fh' : 'bh'), k = op.dataset.o, v = op.dataset.v;
        if (k === 'color' && op.getAttribute('aria-disabled') === 'true') { toast('Pilihan itu tidak boleh. ' + FLAG, { err: true }); return; }
        R[sd][k] = v; main(); var a2 = $('[data-o="' + k + '"][data-v="' + esc(v) + '"]'); if (a2) a2.focus(); return;
      }
      var nx = e.target.closest('#rkNext');
      if (nx) {
        if (nx.getAttribute('aria-disabled') === 'true') { toast(rkStep === 4 && R.fh.color && R.bh.color && !rakitValid() ? FLAG : 'Lengkapi pilihan di langkah ini dulu.', { err: true }); return; }
        if (rkStep < 4) { rkStep++; main(); window.scrollTo({ top: 0 }); return; }
        var b = byId(R.blade.sku), f = byId(R.fh.sku), h2 = byId(R.bh.sku);
        var line = {
          line_id: '', key: '', kind: 'rakitan', sku: 'RAKIT-' + b.sku + '-' + f.sku + '-' + h2.sku, brand: 'Rakitan', name: 'Bet Rakitan ' + b.name,
          variant: R.blade.handle + ' · FH ' + R.fh.color + ' ' + variantLabel(f, { thickness: R.fh.thickness }) + ' · BH ' + R.bh.color + ' ' + variantLabel(h2, { thickness: R.bh.thickness }),
          qty: 1, est_price: rakitTotal(),
          components: { blade: { sku: b.sku, category: 'blade', name: b.brand + ' ' + b.name, handle: R.blade.handle, price: b.price }, fh: { sku: f.sku, category: 'karet', name: f.brand + ' ' + f.name, thickness: R.fh.thickness, color: R.fh.color, price: f.price }, bh: { sku: h2.sku, category: 'karet', name: h2.brand + ' ' + h2.name, thickness: R.bh.thickness, color: R.bh.color, price: h2.price }, assembly_fee: CAT.assembly_fee }
        };
        addToCart(line); flyToCart($('#flip'), 'rakit'); toast('Bet rakitan masuk keranjang.', { href: '#/checkout', label: 'Checkout' });
      }
    });
  }

  /* ------------------------------------------------------------ CHECKOUT */
  function viewCheckout(app) {
    if (!cart.length) { app.innerHTML = '<div class="container page"><div class="empty">' + ico('bag') + '<p>Keranjang Anda masih kosong.</p><a class="btn" href="#/katalog/karet">Lihat Karet</a></div></div>'; return; }
    var lines = cart.map(function (l) { return '<div class="sumrow" style="padding:6px 0;font-size:14px"><span>' + (lineHidden(l) ? '<b class="cl__gone">Tidak lagi dijual</b><br>' : '') + l.qty + '× ' + esc(l.brand === 'Rakitan' ? l.name : l.brand + ' ' + l.name) + (l.variant ? '<br><span class="hint" style="font-size:13px">' + esc(l.variant) + '</span>' : '') + '</span><span class="num">' + num(l.qty * l.est_price) + '</span></div>'; }).join('');
    function fld(id, label, extra) { return '<div class="field"><label for="' + id + '">' + label + '</label>' + extra + '<div class="err" id="e-' + id + '" hidden></div></div>'; }
    app.innerHTML = '<div class="container page"><a class="crumb" href="#/">' + ico('left') + ' Lanjut belanja</a><h1 class="page__title" style="margin-bottom:16px">Checkout</h1><div class="co">' +
      '<form id="coForm" novalidate><div class="panel"><h2>Data penerima</h2><div class="form-grid">' +
      fld('name', 'Nama lengkap', '<input class="input" id="name" autocomplete="name">') +
      fld('wa', 'Nomor WhatsApp', '<input class="input" id="wa" type="tel" inputmode="tel" autocomplete="tel" placeholder="0812 3456 7890"><span class="hint">Harga final dikirim ke nomor ini.</span>') +
      fld('address', 'Alamat lengkap', '<textarea class="input" id="address" autocomplete="street-address"></textarea>') +
      '<div class="form-grid two">' + fld('city', 'Kota', '<input class="input" id="city" autocomplete="address-level2">') + '</div>' +
      fld('note', 'Catatan (opsional)', '<textarea class="input" id="note" placeholder="Mis. warna cadangan bila kosong"></textarea>') +
      '<div style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden" aria-hidden="true"><label>Jangan diisi <input id="hp" name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '</div></div><div class="panel" style="margin-top:16px"><h2>Pengiriman</h2><p class="hint">Kurir dan ongkir ditentukan David setelah harga final. Barang dikirim dari toko David setelah tiba dari distributor.</p></div>' +
      '<div class="note note--warn" style="margin-top:16px">' + ico('info') + '<span>Tidak ada pembayaran di langkah ini. Anda baru diminta transfer setelah harga final disetujui.</span></div></form>' +
      '<aside class="co__sum"><div class="panel"><h2>Ringkasan</h2>' + lines + '<div class="sumrow total" style="margin-top:8px"><span>Total estimasi</span><span class="num">' + rupiah(cartSubtotal()) + '</span></div>' +
      '<p class="hint" style="margin:8px 0 16px">Ongkir dihitung setelah konfirmasi. Harga final dikonfirmasi setelah cek ketersediaan ke distributor.</p><button class="btn btn--block" id="coSend" type="submit" form="coForm">Kirim Pesanan</button></div></aside></div></div>';

    var form = $('#coForm');
    function blockHidden() {
      var n = hiddenCount(), btn = $('#coSend'), box = $('#coBlock');
      if (n && !box) { form.insertAdjacentHTML('afterbegin', '<div class="note note--bad" id="coBlock" role="alert" style="margin-bottom:16px">' + ico('alert') + '<span>' + n + ' barang di keranjang tidak lagi dijual. Hapus dulu dari keranjang sebelum mengirim pesanan.</span></div>'); }
      if (!n && box) box.remove();
      if (btn) { btn.setAttribute('aria-disabled', n ? 'true' : 'false'); }
      return n;
    }
    blockHidden(); window.__dsCoBlock = blockHidden;
    function setErr(id, msg) { var e = $('#e-' + id), i = $('#' + id); if (msg) { e.hidden = false; e.innerHTML = ico('alert') + '<span>' + esc(msg) + '</span>'; i.classList.add('is-err'); i.setAttribute('aria-describedby', 'e-' + id); } else { e.hidden = true; i.classList.remove('is-err'); i.removeAttribute('aria-describedby'); } return !msg; }
    function validate() {
      var ok = true, first = null;
      function chk(id, msg) { var v = $('#' + id).value.trim(); var good = setErr(id, v ? '' : msg); if (!good && !first) first = id; ok = ok && good; }
      chk('name', 'Isi nama penerima.');
      var wav = $('#wa').value.trim(); var gw = setErr('wa', !wav ? 'Isi nomor WhatsApp.' : (validWa(wav) ? '' : 'Nomor WhatsApp tidak valid. Contoh: 0812 3456 7890')); if (!gw && !first) first = 'wa'; ok = ok && gw;
      chk('address', 'Isi alamat lengkap, termasuk kecamatan dan kode pos.'); chk('city', 'Isi kota.');
      if (first) $('#' + first).focus();
      return ok;
    }
    var clientRef = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); // dipakai ulang saat "Coba lagi": server tidak menggandakan pesanan
    function showSendErr(msg, retry) {
      var old = $('#coErr'); if (old) old.remove();
      form.insertAdjacentHTML('afterbegin', '<div class="note note--bad" id="coErr" role="alert" style="margin-bottom:16px">' + ico('alert') + '<span>' + esc(msg) + ' Keranjang Anda tidak dikosongkan.' + (retry ? ' <button class="btn btn--secondary btn--sm" type="button" id="coRetry">Coba lagi</button>' : '') + '</span></div>');
      var rb = $('#coRetry'); if (rb) rb.addEventListener('click', function () { form.dispatchEvent(new Event('submit', { cancelable: true })); });
    }
    function sendPublic(btn) {
      var payload = {
        name: $('#name').value.trim(), wa: normWa($('#wa').value), address: $('#address').value.trim(), city: $('#city').value.trim(), note: $('#note').value.trim(),
        hp: ($('#hp') || {}).value || '', client_ref: clientRef,
        items: cart.map(function (l) {
          if (l.kind === 'rakitan' && l.components) { var c = l.components; return { kind: 'rakitan', qty: l.qty, components: { blade: { sku: c.blade.sku, handle: c.blade.handle }, fh: { sku: c.fh.sku, thickness: c.fh.thickness, color: c.fh.color }, bh: { sku: c.bh.sku, thickness: c.bh.thickness, color: c.bh.color } } }; }
          return { kind: 'product', sku: l.sku, variant: l.variant, qty: l.qty };
        })
      };
      DS.pub.createOrder(payload).then(function (res) {
        if (!form.isConnected) return;
        if (!res.ok) { btn.disabled = false; btn.style.width = ''; btn.textContent = 'Kirim Pesanan'; showSendErr(res.network ? 'Pesanan BELUM terkirim. ' + res.message : res.message, !!res.network); toast(res.network ? 'Pesanan belum terkirim.' : 'Pesanan ditolak.', { err: true }); return; }
        $$('.toast--err').forEach(function (t) { t.remove(); }); // buang pesan gagal sebelumnya
        lastCreated = res.order; rememberLast(res.order, res.track_key);
        cart = []; saveCart();
        setTimeout(function () { location.hash = '#/sukses/' + res.id; }, 300); // kode dari SERVER
      });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (blockHidden()) { toast('Ada barang yang tidak lagi dijual. Hapus dari keranjang dulu.', { err: true }); return; }
      if (!validate()) return;
      var btn = $('#coSend'); if (btn.disabled) return; btn.disabled = true; btn.style.width = btn.offsetWidth + 'px'; btn.textContent = 'Mengirim…';
      var oe = $('#coErr'); if (oe) oe.remove();
      if (pubOn()) { sendPublic(btn); return; }
      var orders = getOrders(), now = new Date(), id = newOrderId(orders), iso = jakartaIso(now);
      var order = {
        id: id, created_at: iso, status: 'placed',
        customer: { name: $('#name').value.trim(), wa: normWa($('#wa').value), address: $('#address').value.trim(), city: $('#city').value.trim(), note: $('#note').value.trim() },
        items: cart.map(function (l, i) { return { line_id: 'L' + (i + 1), kind: l.kind, sku: l.sku, category: l.kind === 'rakitan' ? 'bet_rakitan' : (l.category || catOfSku(l.sku)), brand: l.brand, name: l.name, variant: l.variant, qty: l.qty, est_price: l.est_price, final_price: null, item_status: 'pending', distributor_id: null, components: l.components || null }; }),
        shipping_fee: null, pay_deadline: null, payment: { status: 'none' }, shipment: null,
        history: [{ at: iso, status: 'placed', by: 'customer', note: 'Pesanan diajukan' }]
      };
      orders.push(order); saveOrders(orders);
      cart = []; saveCart();
      setTimeout(function () { location.hash = '#/sukses/' + id; }, 300);
    });
    form.addEventListener('input', function (e) { if (e.target.classList.contains('is-err')) setErr(e.target.id, ''); });
  }

  /* ------------------------------------------------------------ STEPPER & status */
  var STEPS = [
    ['placed', 'Pesanan masuk', 'Pesanan Anda sudah kami terima. Berikutnya David mengecek ketersediaan ke distributor.'],
    ['sourcing', 'Cek ketersediaan', 'Kami menunggu balasan distributor. Kabar berikutnya dikirim lewat WhatsApp.'],
    ['quoted', 'Menunggu konfirmasi & bayar', 'Harga final sudah siap. Periksa, lalu transfer sebelum batas waktu.'],
    ['paid', 'Lunas', 'Pembayaran terverifikasi. David segera memesan barang ke distributor.'],
    ['fulfilling', 'Diproses', 'Barang sedang dipesan dan dikirim distributor ke David.'],
    ['received', 'Barang di David', 'Barang sudah di David dan disiapkan (dirakit bila bet rakitan) sebelum dikirim.'],
    ['shipped', 'Dikirim', 'Pesanan dalam perjalanan ke alamat Anda.'],
    ['completed', 'Selesai', 'Pesanan selesai. Terima kasih.']
  ];
  var BADGE = { placed: 'info', sourcing: 'wait', quoted: 'wait', paid: 'info', fulfilling: 'info', received: 'info', shipped: 'info', completed: 'ok', cancelled: 'bad', expired: 'neutral' };
  function stepIdx(o) {
    var i = STEPS.map(function (s) { return s[0]; }).indexOf(o.status);
    if (i >= 0) return i;
    var h = (o.history || []).map(function (x) { return x.status; }).filter(function (s) { return STEPS.some(function (t) { return t[0] === s; }); });
    return h.length ? STEPS.map(function (s) { return s[0]; }).indexOf(h[h.length - 1]) : 0;
  }
  function stepperHtml(o) {
    var cur = stepIdx(o), dead = o.status === 'cancelled' || o.status === 'expired';
    var html = '<ol class="stepper">' + STEPS.map(function (s, i) {
      var cls = i < cur ? 'done' : (i === cur ? (dead ? 'done' : (o.status === 'completed' ? 'done' : 'now')) : '');
      var hist = (o.history || []).filter(function (x) { return x.status === s[0]; }).pop();
      var extra = '';
      if (i === cur && !dead) {
        extra = '<div class="stp__now">' + esc(s[2]) + '</div>';
        if (s[0] === 'shipped' && o.shipment) extra += '<div class="stp__now">' + (o.shipment.resi ? esc(o.shipment.courier || '') + ' · resi <span class="mono">' + esc(o.shipment.resi) + '</span> <button class="btn btn--text" type="button" data-copy="' + esc(o.shipment.resi) + '">' + ico('copy') + 'Salin</button>' : esc(o.shipment.courier || '')) + '</div>';
        if (s[0] === 'completed') extra = '<div class="stp__now">Pesanan selesai — diterima ' + fmtDate(hist ? hist.at : o.updated_at) + '</div>';
        if (s[0] === 'received') extra += '<div class="stp__now">Status: barang sudah di David.</div>';
      }
      return '<li class="stp ' + cls + '" style="--k:' + i + '"' + (cls === 'now' ? ' aria-current="step"' : '') + '><span class="stp__dot">' + (cls === 'done' || cls === 'now' ? ico('check') : '') + '</span><div class="stp__label">' + s[1] + '</div>' + (hist ? '<div class="stp__time num">' + fmtDate(hist.at) + ' · ' + fmtTime(hist.at) + '</div>' : '') + extra + '</li>';
    }).join('') + '</ol>';
    if (dead) {
      var reason = ((o.history || []).filter(function (x) { return x.status === o.status; }).pop() || {}).note;
      html += '<div class="note note--bad" style="margin-top:8px">' + ico('xc') + '<span>' + (o.status === 'cancelled' ? 'Pesanan dibatalkan' : 'Batas bayar lewat, pesanan kedaluwarsa') + (reason ? ': ' + esc(reason) : '') + '. <a href="' + davidLink('Halo David, soal pesanan ' + o.id) + '" target="_blank" rel="noopener">Hubungi David via WhatsApp</a></span></div>';
    }
    return html;
  }

  /* ------------------------------------------------------------ SUKSES */
  function viewSuccess(app, r) {
    var id = r.segs[1];
    if (pubOn()) {
      if (lastCreated && lastCreated.id === id) { drawSuccess(app, lastCreated, true); return; }
      var ref = readLast();
      if (!ref || ref.id !== id) { viewNotFound(app); return; }
      app.innerHTML = '<div class="container page"><p class="hint" role="status">Memuat pesanan…</p></div>';
      DS.pub.track(ref.id, ref.wa, ref.k).then(function (res) {
        if (!app.isConnected) return;
        if (res.ok) drawSuccess(app, res.order, true);
        else app.innerHTML = '<div class="container page"><div class="empty">' + ico('info') + '<p>Pesanan <b>' + esc(id) + '</b> sudah dibuat. ' + esc(res.network ? res.message : 'Rinciannya belum bisa dimuat.') + '</p><a class="btn" href="' + trackLink(id, ref.wa, ref.k) + '">Lacak Pesanan</a></div></div>';
      });
      return;
    }
    var o = getOrders().filter(function (x) { return x.id === id; })[0];
    if (!o) { viewNotFound(app); return; }
    drawSuccess(app, o, false);
  }
  function drawSuccess(app, o, server) {
    app.innerHTML = '<div class="container page"><div class="center-col"><div class="ok-badge">' + ico('check') + '</div><h1 class="page__title">Pesanan terkirim</h1>' +
      '<div><div class="eyebrow">Nomor pesanan</div><div class="ordno">' + esc(o.id) + ' <button class="btn btn--secondary btn--sm" type="button" data-copy="' + esc(o.id) + '">' + ico('copy') + 'Salin</button></div></div>' +
      '<p>Pesanan ' + esc(o.id) + ' sudah kami terima. Kami cek ketersediaannya ke distributor dulu. Kabar selanjutnya dan harga final kami kirim lewat WhatsApp ke ' + esc(o.customer.wa) + '. Belum ada pembayaran yang perlu dilakukan.</p>' +
      '<div class="panel" style="width:100%">' + stepperHtml(o) + '</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn" href="' + (server && readLast() && readLast().id === o.id ? trackLink(o.id, o.customer.wa, readLast().k) : '#/lacak?id=' + encodeURIComponent(o.id) + '&wa=' + encodeURIComponent(o.customer.wa)) + '">Lacak Pesanan ' + ico('right', 'ico arrow') + '</a><a class="btn btn--secondary" href="#/">Kembali belanja</a></div>' +
      '<p class="hint">' + (server ? SAVED_BADGE + '<br>' : '') + 'Simpan nomor pesanan dan nomor WhatsApp Anda untuk melacak pesanan.</p></div></div>';
  }

  /* ------------------------------------------------------------ LACAK PESANAN */
  var ITEM_BADGE = {
    pending: ['neutral', 'Belum dicek'], available: ['ok', 'Tersedia'], unavailable: ['bad', 'Tidak tersedia'], alternative_offered: ['partial', 'Ada produk pengganti'],
    accepted: ['ok', 'Anda setujui'], declined: ['neutral', 'Anda tolak'], received: ['info', 'Barang di David'], shipped: ['info', 'Dikirim'], cancelled: ['bad', 'Dibatalkan']
  };
  function itemUnit(it) {
    if (it.alternative && it.item_status === 'accepted' && typeof it.alternative.price === 'number') return it.alternative.price;
    return it.final_price != null ? it.final_price : it.est_price;
  }
  function itemCounts(it) { return ['unavailable', 'declined', 'cancelled', 'alternative_offered'].indexOf(it.item_status) < 0; }
  function orderTotals(o) {
    var est = 0, fin = 0;
    o.items.forEach(function (it) { if (itemCounts(it)) { est += it.est_price * it.qty; fin += itemUnit(it) * it.qty; } });
    return { est: est, fin: fin, ship: o.shipping_fee || 0, total: fin + (o.shipping_fee || 0) };
  }
  function viewTrack(app, r) {
    var qid = r.q.get('id') || '', qwa = r.q.get('wa') || '', qk = r.q.get('k') || '';
    var cur = null, pub = pubOn();
    var NOKEY = 'Untuk keamanan, buka tautan Lacak dari WhatsApp atau dari halaman sukses pesanan. Pesanan tidak bisa dibuka hanya dengan nomor pesanan dan WhatsApp.';
    var NF = 'Pesanan tidak ditemukan. Periksa nomor pesanan dan nomor WhatsApp yang Anda pakai saat memesan.';
    app.innerHTML = '<div class="container page"><h1 class="page__title" style="margin-bottom:16px">Lacak Pesanan</h1><div class="trk" id="trk"></div></div>';
    // pencarian: server (mode publik) atau penyimpanan lokal. -> Promise<{ok, order|message, network}>
    function lookup(id, wa) {
      if (pub) return qk ? DS.pub.track(String(id).trim(), wa, qk) : Promise.resolve({ ok: false, message: NOKEY });
      var o = find(id, wa); return Promise.resolve(o ? { ok: true, order: o } : { ok: false, message: NF });
    }
    // aksi customer (mode publik: divalidasi server). okMsg = toast bila berhasil
    function act(action, extra, okMsg) {
      return DS.pub.action(cur.id, cur.customer.wa, qk, action, extra).then(function (res) {
        if (!res.ok) { toast(res.message || 'Aksi gagal.', { err: true }); return; }
        cur = res.order; showResult(); if (okMsg) toast(okMsg);
        return true;
      });
    }
    /* ---- unggah bukti (mode publik): foto dikecilkan dulu (sisi terpanjang 1600px, JPEG ~0.8), PDF apa adanya ---- */
    function fileToB64(blob) {
      return new Promise(function (res, rej) { var rd = new FileReader(); rd.onload = function () { res(String(rd.result).split(',')[1] || ''); }; rd.onerror = function () { rej(new Error('Berkas tidak bisa dibaca')); }; rd.readAsDataURL(blob); });
    }
    function shrinkImage(file) { // -> Promise<Blob JPEG <= ~900 KB>
      return new Promise(function (res, rej) {
        var url = URL.createObjectURL(file), img = new Image();
        img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Foto tidak bisa dibuka. Coba foto lain atau PDF.')); };
        img.onload = function () {
          URL.revokeObjectURL(url);
          var scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), q = 0.8, tries = 0;
          (function pass() {
            var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
            var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
            c.toBlob(function (b) {
              if (!b) { rej(new Error('Foto gagal dikecilkan')); return; }
              if (b.size > 900 * 1024 && tries < 6) { tries++; if (q > 0.5) q -= 0.15; else scale *= 0.75; pass(); return; }
              res(b);
            }, 'image/jpeg', q);
          })();
        };
        img.src = url;
      });
    }
    function find(id, wa) {
      return getOrders().filter(function (o) { return o.id.toUpperCase() === String(id).trim().toUpperCase() && normWa(o.customer && o.customer.wa) === normWa(wa); })[0];
    }
    function linkFormHtml(err) {
      return '<form class="panel" id="tf" novalidate style="max-width:520px"><div class="form-grid"><p>Buka tautan Lacak yang dikirim David lewat WhatsApp atau yang tampil di halaman sukses pesanan. Atau tempel tautannya di sini.</p>' +
        '<div class="field"><label for="tlink">Tautan Lacak</label><input class="input" id="tlink" placeholder="https://…/marketplace/#/lacak?id=…&amp;k=…" autocomplete="off"></div>' +
        (err ? '<div class="err" role="alert">' + ico('alert') + '<span>' + esc(err) + '</span></div>' : '') +
        '<button class="btn" type="submit">Buka Pesanan ' + ico('right', 'ico arrow') + '</button></div></form>';
    }
    function formHtml(err) {
      if (pub) return linkFormHtml(err);
      return '<form class="panel" id="tf" novalidate style="max-width:520px"><div class="form-grid"><div class="field"><label for="tid">Nomor pesanan</label><input class="input mono" id="tid" placeholder="DS-20261108-0001" autocomplete="off" value="' + esc(qid) + '"></div>' +
        '<div class="field"><label for="twa">Nomor WhatsApp saat memesan</label><input class="input" id="twa" type="tel" inputmode="tel" placeholder="0812 3456 7890" value="' + esc(qwa) + '"></div>' +
        (err ? '<div class="err" role="alert">' + ico('alert') + '<span>' + esc(err) + '</span></div>' : '') +
        '<button class="btn" type="submit">Lacak Pesanan ' + ico('right', 'ico arrow') + '</button></div></form>';
    }
    function showForm(err) {
      var t = $('#trk'); t.className = 'trk'; t.innerHTML = formHtml(err);
      if (pub) {
        $('#tf').addEventListener('submit', function (e) {
          e.preventDefault();
          var v = $('#tlink').value, i = v.indexOf('#/lacak?'), q = new URLSearchParams(i >= 0 ? v.slice(i + 8) : '');
          if (!q.get('id') || !q.get('k')) { showForm(NOKEY); return; }
          location.hash = '#/lacak?' + q.toString();
        });
        return;
      }
      $('#tf').addEventListener('submit', function (e) {
        e.preventDefault(); qid = $('#tid').value; qwa = $('#twa').value;
        var sb = $('#tf button[type="submit"]'); sb.disabled = true;
        lookup(qid, qwa).then(function (res) {
          if (!res.ok) { showForm(res.message || NF); $('#tid').focus(); return; }
          cur = res.order; showResult();
        });
      });
    }
    function liHtml(o, it, quoted) {
      var b = ITEM_BADGE[it.item_status] || ['neutral', it.item_status];
      var unit = itemUnit(it), changed = it.final_price != null && it.final_price !== it.est_price;
      var diff = changed ? it.final_price - it.est_price : 0;
      var priceCell = it.item_status === 'unavailable' ? '<span class="hint">tidak ditagih</span>' : (changed ? '<s>' + rupiah(it.est_price * it.qty) + ' (estimasi)</s>' + rupiah(unit * it.qty) + ' <span class="' + (diff > 0 ? 'diff-up' : 'diff-down') + '">' + (diff > 0 ? '+' : '−') + rupiah(Math.abs(diff)).replace(/ /g, ' ') + '/unit</span>' : rupiah(it.est_price * it.qty) + '<br><span class="hint" style="font-size:12px">estimasi</span>');
      var acts = '';
      if (it.item_status === 'unavailable') acts = '<div class="note note--bad" style="width:100%">' + ico('xc') + '<span>Maaf, barang ini tidak tersedia di distributor. Barang ini tidak ditagih. <a href="' + davidLink('Halo David, soal pesanan ' + o.id + ': ' + it.name) + '" target="_blank" rel="noopener">Tanya David</a></span></div>';
      if (it.item_status === 'alternative_offered') {
        var alt = it.alternative; acts = '<div class="note note--warn" style="width:100%">' + ico('info') + '<span>David menawarkan pengganti' + (alt ? ': <b>' + esc(alt.name || '') + '</b>' + (alt.variant ? ' · ' + esc(alt.variant) : '') + (typeof alt.price === 'number' ? ' · ' + rupiah(alt.price) : '') : '. Rincian pengganti dikirim lewat WhatsApp') + '.</span></div>' +
          (o.status === 'quoted' ? '<button class="btn btn--sm" type="button" data-dec="accepted" data-l="' + esc(it.line_id) + '">Terima pengganti</button><button class="btn btn--secondary btn--sm" type="button" data-dec="declined" data-l="' + esc(it.line_id) + '">Tolak</button>' : '');
      }
      if (o.status === 'quoted' && ['available', 'accepted'].indexOf(it.item_status) >= 0) acts = '<button class="btn btn--text" type="button" data-dec="declined" data-l="' + esc(it.line_id) + '">Tolak barang ini</button>';
      if (o.status === 'quoted' && it.item_status === 'declined') acts = '<button class="btn btn--text" type="button" data-dec="available" data-l="' + esc(it.line_id) + '">Batalkan penolakan</button>';
      return '<div class="li' + (['declined', 'unavailable', 'cancelled'].indexOf(it.item_status) >= 0 ? ' is-off' : '') + '"><div><div class="li__name">' + it.qty + '× ' + esc(it.kind === 'rakitan' ? it.name : it.brand + ' ' + it.name) + '</div><div class="li__var">' + esc(it.variant || '') + '</div><div style="margin-top:6px"><span class="badge badge--' + b[0] + '">' + b[1] + '</span></div></div><div class="li__price num">' + priceCell + '</div>' + (acts ? '<div class="li__acts">' + acts + '</div>' : '') + '</div>';
    }
    function quoteCard(o) {
      var t = orderTotals(o), diff = t.fin - t.est, pay = o.payment || { status: 'none' }, deadline = o.pay_deadline;
      var bk = o.bank || (window.DS && DS.getSettings && DS.getSettings().bank) || { bank: '[?]', name: '[?]', no: '[?]' }; // mode publik: dari server (tab settings)
      var h = '<div class="qcard"><h3>Harga final siap</h3>';
      h += '<div class="sumrow"><span>Barang (estimasi awal ' + rupiah(t.est).replace(/ /g, ' ') + ')</span><span class="num">' + rupiah(t.fin) + '</span></div>';
      if (diff) h += '<div class="sumrow hint"><span>Selisih dari estimasi</span><span class="' + (diff > 0 ? 'diff-up' : 'diff-down') + '">' + (diff > 0 ? '+' : '−') + rupiah(Math.abs(diff)).replace(/ /g, ' ') + '</span></div>';
      h += '<div class="sumrow"><span>Ongkir</span><span class="num">' + (o.shipping_fee != null ? rupiah(o.shipping_fee) : '<span class="hint">belum diisi</span>') + '</span></div><div class="sumrow total"><span>Total bayar</span><span class="num">' + rupiah(t.total) + '</span></div>';
      if (deadline) h += '<div class="note note--warn">' + ico('clock') + '<span>Bayar sebelum <b>' + fmtDate(deadline) + ' · ' + fmtTime(deadline) + '</b>. Lewat batas, pesanan kedaluwarsa.</span></div>';
      h += '<div><div class="eyebrow" style="margin-bottom:6px">Transfer ke</div><div class="copyrow"><span>' + esc(bk.bank || '[?]') + ' · a.n. ' + esc(bk.name || '[?]') + '<br><span class="mono">' + esc(bk.no || '[?]') + '</span></span><button class="btn btn--secondary btn--sm" type="button" data-copy="' + esc(bk.no || '') + '">' + ico('copy') + 'Salin Nomor Rekening</button></div>' +
        '<div class="copyrow" style="margin-top:8px"><span>Nominal persis<br><span class="mono">' + t.total + '</span></span><button class="btn btn--secondary btn--sm" type="button" data-copy="' + t.total + '">' + ico('copy') + 'Salin</button></div></div>';
      if (pay.status === 'pending_verification') h += '<div class="note note--ok">' + ico('check') + '<span>Bukti transfer diterima (<span class="mono">' + esc(pay.proof_name || '') + '</span>). Menunggu verifikasi David.</span></div>';
      if (pay.status === 'rejected') h += '<div class="note note--bad">' + ico('alert') + '<span>Bukti transfer ditolak' + (pay.reject_reason ? ': ' + esc(pay.reject_reason) : '') + '. Silakan unggah ulang.</span></div>';
      h += '<input type="file" id="proof" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" hidden><div class="field"><label for="proofAmt">Nominal yang ditransfer (Rp)</label><input class="input" id="proofAmt" type="text" inputmode="numeric" autocomplete="off" value="' + t.total + '"></div><button class="btn" type="button" id="btnProof">' + ico('upload') + (pay.status === 'pending_verification' ? 'Ganti Bukti Transfer' : 'Unggah Bukti Transfer') + '</button><div id="proofPrev" hidden></div><div class="err" id="proofErr" hidden></div>' + (pub ? '<p class="hint">Foto dikecilkan otomatis sebelum dikirim. Format JPG, PNG, atau PDF (maks. 5 MB).</p>' : '') +
        '<a class="btn btn--secondary" target="_blank" rel="noopener" href="' + davidLink('Halo David, saya tanya soal pesanan ' + o.id) + '">' + ico('wa') + 'Tanya via WhatsApp</a>';
      return h + '</div>';
    }
    function showResult() {
      var o = cur, t = $('#trk'); t.className = 'trk trk--res';
      var statusLabel = ({ cancelled: 'Dibatalkan', expired: 'Batas bayar lewat' }[o.status]) || (STEPS.filter(function (s) { return s[0] === o.status; })[0] || [0, o.status])[1];
      var canCancel = ['placed', 'sourcing', 'quoted'].indexOf(o.status) >= 0 && (!o.payment || o.payment.status !== 'pending_verification');
      t.innerHTML = '<div><div class="panel"><div class="eyebrow">Pesanan</div><div class="ordno" style="font-size:20px">' + esc(o.id) + '</div><div style="margin:10px 0 4px"><span class="badge badge--lg badge--' + (BADGE[o.status] || 'neutral') + '">' + esc(statusLabel) + '</span></div><div class="hint">Dibuat ' + fmtDate(o.created_at) + ' · ' + fmtTime(o.created_at) + '</div>' + (pub ? '<div style="margin-top:8px">' + SAVED_BADGE + '</div>' : '') + '</div>' +
        '<div class="panel" style="margin-top:16px">' + stepperHtml(o) + '</div></div>' +
        '<div style="display:grid;gap:16px;align-content:start">' + (o.status === 'quoted' ? quoteCard(o) : '') +
        '<div class="panel"><h2>Barang</h2>' + o.items.map(function (it) { return liHtml(o, it); }).join('') + '<p class="hint" style="margin-top:12px">' + (o.status === 'placed' || o.status === 'sourcing' ? 'Harga adalah estimasi. Harga final dikonfirmasi setelah cek ketersediaan ke distributor.' : '') + '</p></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--secondary btn--sm" type="button" id="btnOther">Lacak pesanan lain</button>' + (pub ? '<button class="btn btn--secondary btn--sm" type="button" id="btnRefresh">Perbarui status</button>' : '') + (canCancel ? '<button class="btn btn--danger btn--sm" type="button" id="btnCancel">Batalkan pesanan</button>' : '') + '</div></div>';
      $('#btnOther').addEventListener('click', function () { qid = ''; qwa = ''; cur = null; showForm(); });
      var br = $('#btnRefresh'); if (br) br.addEventListener('click', function () {
        br.disabled = true;
        lookup(cur.id, cur.customer.wa).then(function (res) { if (res.ok) { cur = res.order; showResult(); toast('Status diperbarui.'); } else { br.disabled = false; toast(res.message || 'Gagal memperbarui.', { err: true }); } });
      });
      var bc = $('#btnCancel'); if (bc) bc.addEventListener('click', function () {
        confirmBox('Batalkan pesanan ' + o.id + '?', 'Pesanan belum dibayar, jadi tidak ada uang yang perlu dikembalikan. Tindakan ini tidak bisa diurungkan.', 'Batalkan Pesanan', true).then(function (ok) {
          if (!ok) return;
          if (pub) { act('cancel', {}, 'Pesanan dibatalkan.'); return; }
          update(function (x) { x.status = 'cancelled'; x.history.push({ at: jakartaIso(new Date()), status: 'cancelled', by: 'customer', note: 'Dibatalkan oleh customer' }); }); toast('Pesanan dibatalkan.');
        });
      });
      var bp = $('#btnProof'); if (bp) {
        var fi = $('#proof'), amtEl = $('#proofAmt'); bp.addEventListener('click', function () {
          var er0 = $('#proofErr'), amt0 = parseInt(String(amtEl.value).replace(/\D/g, ''), 10);
          if (!amt0 || amt0 <= 0) { er0.hidden = false; er0.innerHTML = ico('alert') + '<span>Isi nominal yang ditransfer (lebih dari 0).</span>'; amtEl.focus(); return; }
          er0.hidden = true; fi.click();
        });
        fi.addEventListener('change', function () {
          var f = fi.files[0], er = $('#proofErr'); if (!f) return;
          var okType = /\.(jpe?g|png|pdf)$/i.test(f.name), isPdf = /\.pdf$/i.test(f.name), okSize = f.size <= (pub && !isPdf ? 25 : 5) * 1024 * 1024;
          if (!okType || !okSize) { er.hidden = false; er.innerHTML = ico('alert') + '<span>' + (!okType ? 'Format harus jpg, png, atau pdf.' : (pub && !isPdf ? 'Foto terlalu besar (maks. 25 MB).' : 'Ukuran PDF maksimal 5 MB.')) + '</span>'; fi.value = ''; return; }
          var amt = parseInt(String(amtEl.value).replace(/\D/g, ''), 10);
          if (!amt || amt <= 0) { er.hidden = false; er.innerHTML = ico('alert') + '<span>Isi nominal yang ditransfer (lebih dari 0).</span>'; fi.value = ''; return; }
          er.hidden = true;
          if (pub) {
            var prev = $('#proofPrev'); prev.hidden = false; prev.innerHTML = '<p class="hint" role="status">Menyiapkan berkas…</p>';
            (isPdf ? Promise.resolve(f) : shrinkImage(f)).then(function (blob) {
              return fileToB64(blob).then(function (b64) { return { blob: blob, b64: b64 }; });
            }).then(function (p) {
              var kb = Math.round(p.blob.size / 1024), url = isPdf ? null : URL.createObjectURL(p.blob);
              prev.innerHTML = '<div class="proofprev">' + (isPdf ? '<div class="proofprev__pdf">' + ico('copy') + 'PDF</div>' : '<img src="' + url + '" alt="Pratinjau bukti transfer">') + '<div><b>' + esc(f.name) + '</b><div class="hint">' + kb + ' KB' + (isPdf ? '' : ' (sudah dikecilkan)') + ' · nominal Rp ' + num(amt) + '</div>' +
                '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" type="button" id="proofSend">Kirim bukti</button><button class="btn btn--secondary" type="button" id="proofCancel">Batal</button></div></div></div>';
              $('#proofCancel').addEventListener('click', function () { prev.hidden = true; prev.innerHTML = ''; fi.value = ''; if (url) URL.revokeObjectURL(url); });
              $('#proofSend').addEventListener('click', function () {
                var sb = $('#proofSend'); sb.disabled = true; $('#proofCancel').disabled = true; sb.textContent = 'Mengunggah… ' + kb + ' KB'; er.hidden = true;
                act('payment_proof', { proof_name: f.name, amount: amt, file_b64: p.b64 }, 'Bukti transfer terunggah. Menunggu verifikasi David.').then(function (okk) {
                  if (okk) return;
                  sb.disabled = false; $('#proofCancel').disabled = false; sb.textContent = 'Coba kirim lagi';
                  er.hidden = false; er.innerHTML = ico('alert') + '<span>Bukti BELUM terunggah (lihat pesan merah). Coba lagi, atau kirim fotonya lewat WhatsApp ke David.</span>';
                });
              });
            }, function (e2) { prev.innerHTML = ''; prev.hidden = true; er.hidden = false; er.innerHTML = ico('alert') + '<span>' + esc(e2 && e2.message || 'Berkas gagal diproses') + '</span>'; fi.value = ''; });
            return;
          }
          update(function (x) { x.payment = { status: 'pending_verification', proof_name: f.name, amount: amt }; }); toast('Bukti transfer diterima. Menunggu verifikasi David.');
        });
      }
    }
    function update(fn) {
      var all = getOrders(), i = all.map(function (x) { return x.id; }).indexOf(cur.id); if (i < 0) return;
      fn(all[i]); saveOrders(all); cur = all[i]; showResult();
    }
    $('#trk').addEventListener('click', function (e) {
      var d = e.target.closest('[data-dec]'); if (!d || !cur) return;
      if (pub) { act('item_decision', { line_id: d.dataset.l, decision: d.dataset.dec }, 'Total dihitung ulang.'); return; }
      update(function (x) { x.items.forEach(function (it) { if (it.line_id === d.dataset.l) it.item_status = d.dataset.dec; }); });
      toast('Total dihitung ulang.');
    });
    window.__dsTrackRemap = function (from, to) { if (cur && cur.id === from) { qid = to; var o = getOrders().filter(function (x) { return x.id === to; })[0]; if (o) { cur = o; showResult(); toast('Nomor pesanan diperbarui menjadi ' + to + '.'); } } };
    function onStorage(e) { if (e.key === KEY_ORDERS && cur && $('#trk .trk--res, #trk.trk--res')) { var o = find(cur.id, qwa); if (o) { cur = o; showResult(); } } }
    window.addEventListener('storage', onStorage);
    cleanup = function () { window.removeEventListener('storage', onStorage); };

    if (qid && qwa && pub && !qk) { // tautan lama (dibuat sebelum kunci Lacak ada): jangan tampilkan data, arahkan minta tautan baru
      var reqLink = davidLink('Halo David, saya minta tautan Lacak baru untuk pesanan ' + qid + '.');
      $('#trk').innerHTML = '<div class="panel" style="max-width:520px"><div class="note note--warn">' + ico('info') + '<span>Tautan ini versi lama. Minta tautan baru ke David.</span></div>' +
        (reqLink ? '<p style="margin-top:16px"><a class="btn" id="reqNew" target="_blank" rel="noopener" href="' + esc(reqLink) + '">' + ico('wa') + 'Minta tautan via WhatsApp</a></p>' : '') + '</div>';
      return;
    }
    if (qid && qwa) {
      $('#trk').innerHTML = '<p class="hint" role="status">Memuat pesanan…</p>';
      lookup(qid, qwa).then(function (res) { if (!app.isConnected) return; if (res.ok) { cur = res.order; showResult(); } else showForm(res.message || NF); });
      return;
    }
    showForm();
  }

  /* ------------------------------------------------------------ mulai */
  var started = false;
  function rerender() {
    if (!started) return;
    var v = parseHash().segs[0] || '';
    drawSyncBadge(); drawShellLists();
    if (openEl && openEl.id === 'cartDrawer') renderCart();
    if (v === 'checkout') { if (window.__dsCoBlock) window.__dsCoBlock(); return; } // jangan buang isian formulir
    if (v === 'rakit' || v === 'lacak' || v === 'sukses') return; // jangan buang isian pengguna
    route2();
  }
  function start() {
    if (started) return; started = true;
    renderShell();
    try { new MutationObserver(function () { hideNoWa(document); }).observe(document.body, { childList: true, subtree: true }); } catch (e) { } // tautan WA tanpa nomor selalu disembunyikan
    window.addEventListener('hashchange', route);
    route();
    window.addEventListener('storage', function (e) { if (!e.key || e.key === 'ds_brands_v1') rerender(); });
    window.addEventListener('ds:data', rerender);
    window.addEventListener('ds:stale', function (e) { var d = (e && e.detail) || {}; toast(d.message || 'Data berubah di tempat lain. Muat ulang halaman bila perlu.', { err: true }); });
    window.addEventListener('ds:idremap', function (e) {
      var d = (e && e.detail) || {}; if (!d.from || !d.to) return;
      var h = location.hash;
      if (h.indexOf(d.from) >= 0) { history.replaceState(null, '', h.split(d.from).join(d.to)); route2(); }
      else if (parseHash().segs[0] === 'lacak' && window.__dsTrackRemap) window.__dsTrackRemap(d.from, d.to);
    });
    window.DS_MKT = { route: route, visibleCount: function () { return vprods().length; } }; // untuk uji
  }
  if (window.DS && typeof DS.ready === 'function') {
    DS.ready(start);
    setTimeout(start, 12000); // cadangan bila sinkron tak kunjung siap
  } else start();
})();
