/* Dashboard David — logic.js
   Aturan domain (state machine PRD §8, aturan bisnis §9). Tanpa DOM, bisa diuji di Node.
   Setiap aksi: baca data segar dari DS, ubah, simpan, kembalikan {ok:true,...} atau {ok:false,error}. */
(function (root) {
  'use strict';
  var DS = root.DS;
  var HR = 3600e3;

  var BILLABLE = ['available', 'alternative_offered', 'accepted', 'received', 'shipped'];
  var CANCELLABLE = ['placed', 'sourcing', 'quoted', 'paid', 'fulfilling', 'received'];
  var STICKY = ['accepted', 'declined', 'received', 'shipped', 'cancelled'];

  function ms(iso) { var t = Date.parse(iso || ''); return isNaN(t) ? 0 : t; }
  function nowIso() { return DS.isoWIB(); }
  function fail(e) { return { ok: false, error: e }; }
  function isBillable(it) { return BILLABLE.indexOf(it.item_status) >= 0; }
  function roundUp1000(x) { return Math.ceil(x / 1000 - 1e-9) * 1000; }

  function load() { return { orders: DS.getOrders(), pos: DS.getPOs() }; }
  function save(d) { DS.saveOrders(d.orders); DS.savePOs(d.pos); }
  function findOrder(d, id) { return d.orders.filter(function (o) { return o.id === id; })[0]; }
  function findPo(d, id) { return d.pos.filter(function (p) { return p.id === id; })[0]; }
  function addHist(o, note, status) { o.history.push({ at: nowIso(), status: status || o.status, by: 'david', note: note || '' }); }
  function posOf(d, orderId) { return d.pos.filter(function (p) { return p.order_id === orderId; }); }

  // ---------- unit (item produk = 1 unit; bet rakitan = 3 komponen) ----------
  function unitsOf(item) {
    if (item.kind === 'rakitan' && item.components) {
      var c = item.components, u = [];
      if (c.blade) u.push({ key: item.line_id + ':blade', line_id: item.line_id, component: 'blade', sku: c.blade.sku, name: c.blade.name, variant: c.blade.handle || '', qty: item.qty, label: 'Blade' });
      if (c.fh) u.push({ key: item.line_id + ':fh', line_id: item.line_id, component: 'fh', sku: c.fh.sku, name: c.fh.name, variant: [c.fh.thickness, c.fh.color].filter(Boolean).join(' · '), qty: item.qty, label: 'Karet FH (forehand)' });
      if (c.bh) u.push({ key: item.line_id + ':bh', line_id: item.line_id, component: 'bh', sku: c.bh.sku, name: c.bh.name, variant: [c.bh.thickness, c.bh.color].filter(Boolean).join(' · '), qty: item.qty, label: 'Karet BH (backhand)' });
      return u;
    }
    return [{ key: item.line_id, line_id: item.line_id, component: null, sku: item.sku,
      name: (item.brand ? item.brand + ' ' : '') + item.name, variant: item.variant || '', qty: item.qty, label: '' }];
  }
  function unitKey(pi) { return pi.line_id + (pi.component ? ':' + pi.component : ''); }
  function entriesFor(pos, orderId, key) {
    var r = [];
    pos.forEach(function (p) {
      if (p.order_id !== orderId || p.status === 'cancelled') return;
      p.items.forEach(function (pi) { if (!pi.superseded && unitKey(pi) === key) r.push({ po: p, pi: pi }); });
    });
    return r;
  }
  // nopo | draft | waiting | available | unavailable
  function unitState(pos, orderId, unit) {
    var es = entriesFor(pos, orderId, unit.key);
    if (es.some(function (e) { return e.pi.available === true; })) return 'available';
    var open = es.filter(function (e) { return e.pi.available == null; });
    if (open.some(function (e) { return e.po.status === 'sent'; })) return 'waiting';
    if (open.length) return 'draft';
    return es.length ? 'unavailable' : 'nopo';
  }

  function recompute(d, order) {
    order.items.forEach(function (it) {
      if (it.manual || STICKY.indexOf(it.item_status) >= 0) return;
      var st = unitsOf(it).map(function (u) { return unitState(d.pos, order.id, u); });
      var next;
      if (st.every(function (s) { return s === 'available'; })) next = it.alt ? 'alternative_offered' : 'available';
      else if (st.some(function (s) { return s === 'nopo' || s === 'draft' || s === 'waiting'; })) next = 'pending';
      else next = 'unavailable';
      it.item_status = next;
    });
  }

  // item yang masih bisa dimasukkan PO baru
  function eligibleUnits(order, pos) {
    var r = [];
    order.items.forEach(function (it) {
      if (STICKY.indexOf(it.item_status) >= 0) return;
      unitsOf(it).forEach(function (u) {
        var s = unitState(pos, order.id, u);
        if (s === 'nopo' || s === 'unavailable') r.push(u);
      });
    });
    return r;
  }
  function itemPoState(order, pos, item) { // untuk kolom "PO" di tabel item
    return unitsOf(item).map(function (u) {
      var es = entriesFor(pos, order.id, u.key);
      return { unit: u, state: unitState(pos, order.id, u), pos: es.map(function (e) { return e.po; }) };
    });
  }

  // ---------- margin & harga ----------
  function categoryOf(item) {
    if (item.kind === 'rakitan') return 'bet_rakitan';
    var c = String(item.category || '').toLowerCase();
    if (!c && item.sku && root.DS_CATALOG && Array.isArray(root.DS_CATALOG.products)) { // item lama dari marketplace tanpa category
      var cp = root.DS_CATALOG.products.filter(function (p) { return p.sku === item.sku; })[0];
      if (cp) c = String(cp.category || '').toLowerCase();
    }
    c = c.replace(/-/g, '_');
    var keys = DS.CATEGORIES.map(function (x) { return x[0]; });
    if (keys.indexOf(c) >= 0) return c;
    var map = [['blade', 'blade'], ['karet', 'karet'], ['rubber', 'karet'], ['bola', 'bola'], ['meja', 'meja'], ['net', 'net'],
      ['tas', 'tas'], ['sepatu', 'sepatu'], ['apparel', 'apparel'], ['aksesori', 'aksesoris'], ['alat', 'alat_latihan'], ['latihan', 'alat_latihan'], ['bet', 'bet_jadi']];
    for (var i = 0; i < map.length; i++) if (c.indexOf(map[i][0]) >= 0) return map[i][1];
    return 'lainnya';
  }
  function assemblyFee(item) { return item.kind === 'rakitan' && item.components ? Number(item.components.assembly_fee) || 0 : 0; }
  // harga jual dari modal + margin. pct dibulatkan ke atas Rp1.000; rp = modal + margin persis.
  function priceFrom(cost, type, value, extra) {
    value = Number(value) || 0; extra = extra || 0;
    if (type === 'rp') return Math.round(cost + value) + extra;
    var marginRp = Math.round(cost * value / 100); // hitung margin dalam rupiah bulat dulu (hindari float 110000.00000000001)
    return Math.ceil((cost + marginRp) / 1000) * 1000 + extra;
  }
  // margin dari harga jual (hitung balik)
  function marginFrom(cost, price, type, extra) {
    var rp = Math.round(price - cost - (extra || 0));
    if (type === 'rp') return rp;
    return cost > 0 ? Math.round(rp / cost * 1000) / 10 : 0;
  }
  // modal per unit item dari balasan PO. pick = distributor_id terpilih (item produk)
  function costOf(pos, order, item, pick) {
    var parts = [], cost = 0, missing = false;
    unitsOf(item).forEach(function (u) {
      var offers = entriesFor(pos, order.id, u.key).filter(function (e) { return e.pi.available === true && e.pi.cost_price != null; });
      var o = null;
      if (item.kind !== 'rakitan' && pick) o = offers.filter(function (e) { return e.po.distributor_id === pick; })[0];
      if (!o) o = offers.slice().sort(function (a, b) { return a.pi.cost_price - b.pi.cost_price; })[0];
      if (!o) { missing = true; return; }
      parts.push({ unit: u, po: o.po, pi: o.pi }); cost += o.pi.cost_price;
    });
    return { cost: cost, parts: parts, missing: missing };
  }
  function offersOf(pos, order, item) { // pilihan distributor (item produk)
    var u = unitsOf(item)[0];
    return entriesFor(pos, order.id, u.key).filter(function (e) { return e.pi.available === true; });
  }
  function totals(order) {
    var modal = 0, jual = 0;
    order.items.forEach(function (it) {
      if (!isBillable(it) || it.final_price == null) return;
      jual += it.final_price * it.qty;
      modal += (it.cost_price || 0) * it.qty;
    });
    var ongkir = Number(order.shipping_fee) || 0, untung = jual - modal;
    return { modal: modal, jual: jual, untung: untung, pct: modal > 0 ? untung / modal * 100 : 0, ongkir: ongkir, total: jual + ongkir };
  }
  function quoteReady(order, pos) {
    if (!order.items.length) return { ok: false, reason: 'Pesanan tidak punya item.' };
    var pending = order.items.filter(function (i) { return i.item_status === 'pending'; });
    if (pending.length) return { ok: false, reason: pending.length + ' item belum ada jawaban distributor.' };
    if (!order.items.some(isBillable)) return { ok: false, reason: 'Semua item tidak tersedia — batalkan pesanan.' };
    return { ok: true, reason: '' };
  }

  // ---------- aksi ----------
  var A = {};

  A.createPOs = function (orderId, assigns) {
    var d = load(), o = findOrder(d, orderId);
    if (!o) return fail('Pesanan tidak ditemukan.');
    if (['placed', 'sourcing'].indexOf(o.status) < 0) return fail('PO baru hanya bisa dibuat saat pesanan Baru atau Cek ketersediaan.');
    if (!assigns || !assigns.length) return fail('Pilih minimal satu item.');
    var elig = eligibleUnits(o, d.pos), made = [];
    for (var i = 0; i < assigns.length; i++) {
      if (!assigns[i].distId) return fail('Pilih distributor untuk semua item yang dicentang.');
    }
    var cache = {};
    for (i = 0; i < assigns.length; i++) {
      var a = assigns[i];
      var u = elig.filter(function (x) { return x.key === a.key; })[0];
      if (!u) return fail('Item ' + a.key + ' tidak bisa dibuatkan PO (sudah punya PO aktif).');
      var po = cache[a.distId] || d.pos.filter(function (p) { return p.order_id === o.id && p.distributor_id === a.distId && p.status === 'draft'; })[0];
      if (!po) {
        var existing = d.pos.concat(made);
        var id = (function () { var tmp = DS.newPoId(), n = parseInt(tmp.slice(-4), 10); while (existing.some(function (p) { return p.id === tmp; })) { n++; tmp = tmp.slice(0, -4) + ('0000' + n).slice(-4); } return tmp; })();
        po = { id: id, order_id: o.id, distributor_id: a.distId, status: 'draft', created_at: nowIso(), sent_at: null, responded_at: null, items: [], responses: [] };
        d.pos.push(po); made.push(po);
      }
      cache[a.distId] = po;
      po.items.push({ line_id: u.line_id, component: u.component, sku: u.sku, name: u.name, variant: u.variant, qty: u.qty,
        cost_price: null, available: null, eta: null, received_qty: 0 });
      var it = o.items.filter(function (x) { return x.line_id === u.line_id; })[0];
      if (it.manual) { it.manual = false; it.item_status = 'pending'; }
    }
    recompute(d, o);
    addHist(o, 'PO draf dibuat: ' + Object.keys(cache).map(function (k) { return cache[k].id + ' (' + DS.distributorName(k) + ')'; }).join(', '));
    save(d);
    return { ok: true, po_ids: Object.keys(cache).map(function (k) { return cache[k].id; }) };
  };

  A.movePoItem = function (poId, key, toDist) {
    var d = load(), po = findPo(d, poId);
    if (!po || po.status !== 'draft') return fail('Item hanya bisa dipindah selagi PO masih draf.');
    if (!toDist || toDist === po.distributor_id) return fail('Pilih distributor lain.');
    var idx = -1;
    po.items.forEach(function (pi, i) { if (unitKey(pi) === key) idx = i; });
    if (idx < 0) return fail('Item tidak ada di PO ini.');
    var pi = po.items.splice(idx, 1)[0];
    var target = d.pos.filter(function (p) { return p.order_id === po.order_id && p.distributor_id === toDist && p.status === 'draft'; })[0];
    if (!target) {
      var n = 0; d.pos.forEach(function (p) { if (p.id.slice(0, -4) === po.id.slice(0, -4)) n = Math.max(n, parseInt(p.id.slice(-4), 10)); });
      target = { id: po.id.slice(0, -4) + ('0000' + (n + 1)).slice(-4), order_id: po.order_id, distributor_id: toDist, status: 'draft', created_at: nowIso(), sent_at: null, responded_at: null, items: [], responses: [] };
      d.pos.push(target);
    }
    target.items.push(pi);
    if (!po.items.length) po.status = 'cancelled';
    var o = findOrder(d, po.order_id); addHist(o, pi.name + ' dipindah dari ' + po.id + ' ke ' + DS.distributorName(toDist));
    save(d); return { ok: true, po_id: target.id };
  };

  A.markPoSent = function (poId) {
    var d = load(), po = findPo(d, poId);
    if (!po) return fail('PO tidak ditemukan.');
    if (po.status !== 'draft') return fail('PO ini bukan draf.');
    if (!po.distributor_id) return fail('Pilih distributor dulu.');
    var o = findOrder(d, po.order_id);
    po.status = 'sent'; po.sent_at = nowIso();
    if (o.status === 'placed') { o.status = 'sourcing'; }
    recompute(d, o);
    addHist(o, po.id + ' terkirim ke ' + DS.distributorName(po.distributor_id) + ' via WhatsApp', o.status);
    save(d); return { ok: true };
  };

  // rows: [{key, available:true|false, cost, eta, note}]
  A.recordReply = function (poId, rows) {
    var d = load(), po = findPo(d, poId);
    if (!po) return fail('PO tidak ditemukan.');
    if (['sent', 'responded', 'rejected'].indexOf(po.status) < 0) return fail('Balasan hanya bisa dicatat untuk PO yang sudah terkirim.');
    var o = findOrder(d, po.order_id);
    if (['placed', 'sourcing'].indexOf(o.status) < 0) return fail('Tarik harga final dulu (pesanan sudah ' + o.status + ') sebelum mengubah balasan.');
    var at = nowIso(), n = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.available === null || r.available === undefined) continue;
      var pi = po.items.filter(function (x) { return unitKey(x) === r.key && !x.superseded; })[0];
      if (!pi) return fail('Item tidak ada di PO.');
      var cost = r.available ? Math.round(Number(r.cost)) : null;
      if (r.available && !(cost > 0)) return fail('Isi harga modal (angka > 0) untuk ' + pi.name + '.');
      pi.available = !!r.available; pi.cost_price = cost; pi.eta = r.available ? (r.eta || null) : null; pi.note = r.note || '';
      po.responses.push({ at: at, line_id: pi.line_id, component: pi.component, available: pi.available, cost_price: cost, eta: pi.eta, note: pi.note });
      n++;
    }
    if (!n) return fail('Belum ada item yang dijawab.');
    var live = po.items.filter(function (x) { return !x.superseded; });
    if (live.every(function (x) { return x.available !== null; })) {
      po.status = live.some(function (x) { return x.available === true; }) ? 'responded' : 'rejected';
      po.responded_at = at;
    } else po.status = 'sent';
    recompute(d, o);
    addHist(o, 'Balasan ' + DS.distributorName(po.distributor_id) + ' dicatat di ' + po.id + ' (' + n + ' item)');
    save(d); return { ok: true, status: po.status };
  };

  A.markUnavailable = function (orderId, lineId) {
    var d = load(), o = findOrder(d, orderId);
    if (!o || ['placed', 'sourcing'].indexOf(o.status) < 0) return fail('Tidak bisa diubah pada status ini.');
    var it = o.items.filter(function (x) { return x.line_id === lineId; })[0];
    if (!it) return fail('Item tidak ditemukan.');
    it.item_status = 'unavailable'; it.manual = true;
    addHist(o, it.name + ' ditandai tidak tersedia');
    save(d); return { ok: true };
  };

  A.offerAlternative = function (orderId, lineId, alt) {
    var d = load(), o = findOrder(d, orderId);
    if (!o || ['placed', 'sourcing'].indexOf(o.status) < 0) return fail('Tidak bisa diubah pada status ini.');
    var it = o.items.filter(function (x) { return x.line_id === lineId; })[0];
    if (!it || it.kind === 'rakitan') return fail('Alternatif hanya untuk item produk biasa.');
    if (!alt || !String(alt.name || '').trim()) return fail('Isi nama produk alternatif.');
    var price = Math.round(Number(alt.est_price)); if (!(price > 0)) return fail('Isi harga estimasi alternatif.');
    d.pos.forEach(function (p) { if (p.order_id === o.id) p.items.forEach(function (pi) { if (pi.line_id === lineId) pi.superseded = true; }); });
    it.original = it.original || { brand: it.brand, name: it.name, variant: it.variant, est_price: it.est_price, sku: it.sku };
    it.brand = alt.brand || ''; it.name = alt.name.trim(); it.variant = alt.variant || ''; it.est_price = price; it.sku = alt.sku || 'ALT';
    it.alt = true; it.manual = false; it.item_status = 'pending'; it.distributor_id = null;
    addHist(o, 'Alternatif untuk ' + it.original.name + ': ' + it.name + ' (perlu PO baru)');
    recompute(d, o); save(d); return { ok: true };
  };

  A.declineItem = function (orderId, lineId) {
    var d = load(), o = findOrder(d, orderId);
    if (!o || ['sourcing', 'quoted'].indexOf(o.status) < 0) return fail('Tidak bisa diubah pada status ini.');
    var it = o.items.filter(function (x) { return x.line_id === lineId; })[0];
    if (!it) return fail('Item tidak ditemukan.');
    it.item_status = 'declined'; it.manual = true;
    addHist(o, it.name + ': customer menolak / tidak dilanjutkan');
    save(d); return { ok: true };
  };

  // form: { lines:[{line_id, pick, margin_type, margin_value, final_price}], shipping, hours }
  A.sendQuote = function (orderId, form) {
    var d = load(), o = findOrder(d, orderId);
    if (!o) return fail('Pesanan tidak ditemukan.');
    if (o.status !== 'sourcing') return fail('Harga final hanya bisa disusun saat status Cek ketersediaan.');
    var rd = quoteReady(o, d.pos);
    if (!rd.ok) return fail(rd.reason);
    var shipping = Math.round(Number(form.shipping) || 0);
    if (shipping < 0) return fail('Ongkir tidak boleh negatif.');
    var hours = Number(form.hours) || 24;
    var res = [];
    for (var i = 0; i < o.items.length; i++) {
      var it = o.items[i];
      if (!isBillable(it)) continue;
      var ln = (form.lines || []).filter(function (x) { return x.line_id === it.line_id; })[0];
      if (!ln) return fail('Harga untuk ' + it.name + ' belum diisi.');
      var price = Math.round(Number(ln.final_price));
      if (!(price > 0)) return fail('Isi harga jual untuk ' + it.name + '.');
      var c = costOf(d.pos, o, it, ln.pick);
      if (c.missing) return fail('Modal ' + it.name + ' belum ada dari balasan distributor.');
      res.push({ it: it, ln: ln, price: price, c: c });
    }
    var warnRugi = [];
    res.forEach(function (r) {
      var it = r.it;
      // reset pilihan lama, set pilihan baru
      d.pos.forEach(function (p) { if (p.order_id === o.id) p.items.forEach(function (pi) { if (pi.line_id === it.line_id) pi.chosen = false; }); });
      r.c.parts.forEach(function (p) { p.pi.chosen = true; });
      it.cost_price = r.c.cost; it.final_price = r.price;
      it.margin_type = r.ln.margin_type === 'rp' ? 'rp' : 'pct';
      it.margin_value = marginFrom(r.c.cost, r.price, it.margin_type, assemblyFee(it));
      it.distributor_id = it.kind === 'rakitan' ? null : r.c.parts[0].po.distributor_id;
      if (r.price - r.c.cost - assemblyFee(it) <= 0) warnRugi.push(it.name);
    });
    o.shipping_fee = shipping;
    o.pay_deadline = DS.isoWIB(Date.now() + hours * HR);
    o.status = 'quoted';
    var t = totals(o);
    addHist(o, 'Harga final dikirim: barang ' + DS.formatRupiah(t.jual) + ' + ongkir ' + DS.formatRupiah(t.ongkir) + ' = ' + DS.formatRupiah(t.total) +
      ', untung ' + DS.formatRupiah(t.untung) + (warnRugi.length ? ' | JUAL RUGI: ' + warnRugi.join(', ') : ''));
    save(d); return { ok: true, total: t.total, rugi: warnRugi };
  };

  A.pullQuote = function (orderId) {
    var d = load(), o = findOrder(d, orderId);
    if (!o || o.status !== 'quoted') return fail('Hanya pesanan Menunggu konfirmasi & bayar yang bisa ditarik.');
    o.status = 'sourcing'; o.pay_deadline = null;
    if (o.payment.status === 'pending_verification') o.payment = { status: 'none' };
    addHist(o, 'Harga final ditarik untuk dicek ulang', 'sourcing');
    save(d); return { ok: true };
  };

  A.extendDeadline = function (orderId, hours) {
    var d = load(), o = findOrder(d, orderId);
    if (!o || o.status !== 'quoted') return fail('Hanya untuk pesanan yang menunggu bayar.');
    var base = Math.max(Date.now(), ms(o.pay_deadline));
    o.pay_deadline = DS.isoWIB(base + (Number(hours) || 24) * HR);
    addHist(o, 'Batas bayar diperpanjang ' + (Number(hours) || 24) + ' jam');
    save(d); return { ok: true };
  };

  // alat demo: customer unggah bukti (di produk sungguhan dilakukan marketplace)
  A.simulateProof = function (orderId) {
    var d = load(), o = findOrder(d, orderId);
    if (!o || o.status !== 'quoted') return fail('Hanya untuk pesanan Menunggu konfirmasi & bayar.');
    o.payment = { status: 'pending_verification', proof_name: 'bukti-transfer-simulasi.jpg', amount: totals(o).total, at: nowIso() };
    addHist(o, 'Customer mengunggah bukti transfer (simulasi)');
    save(d); return { ok: true };
  };

  A.verifyPayment = function (orderId, accept, reason) {
    var d = load(), o = findOrder(d, orderId);
    if (!o || o.status !== 'quoted') return fail('Verifikasi hanya untuk pesanan Menunggu konfirmasi & bayar.');
    if (o.payment.status !== 'pending_verification') return fail('Belum ada bukti bayar yang menunggu.');
    if (!accept) {
      if (!String(reason || '').trim()) return fail('Isi alasan penolakan supaya customer tahu.');
      o.payment = Object.assign({}, o.payment, { status: 'rejected', reason: reason.trim() });
      addHist(o, 'Bukti bayar ditolak: ' + reason.trim());
      save(d); return { ok: true };
    }
    o.payment = Object.assign({}, o.payment, { status: 'verified', verified_at: nowIso() });
    o.items.forEach(function (it) { if (it.item_status === 'available' || it.item_status === 'alternative_offered') it.item_status = 'accepted'; });
    o.status = 'paid';
    posOf(d, o.id).forEach(function (p) {
      if (['draft', 'sent', 'responded', 'rejected'].indexOf(p.status) >= 0 && !p.items.some(function (pi) { return pi.chosen; })) p.status = 'cancelled';
    });
    var t = totals(o), warn = o.payment.amount != null && o.payment.amount !== t.total;
    addHist(o, 'Bukti transfer diterima' + (warn ? ' (nominal klaim ' + DS.formatRupiah(o.payment.amount) + ' ≠ total ' + DS.formatRupiah(t.total) + ')' : ''));
    save(d); return { ok: true, mismatch: warn };
  };

  A.confirmPo = function (poId) {
    var d = load(), po = findPo(d, poId);
    if (!po) return fail('PO tidak ditemukan.');
    var o = findOrder(d, po.order_id);
    if (['paid', 'fulfilling'].indexOf(o.status) < 0) return fail('PO hanya bisa dikonfirmasi setelah pesanan lunas.');
    if (po.status !== 'responded') return fail('PO harus berstatus Dibalas.');
    if (!po.items.some(function (pi) { return pi.chosen; })) return fail('Tidak ada item terpilih di PO ini.');
    po.status = 'confirmed';
    if (o.status === 'paid') o.status = 'fulfilling';
    addHist(o, po.id + ' dikonfirmasi beli ke ' + DS.distributorName(po.distributor_id));
    save(d); return { ok: true };
  };

  A.receive = function (poId, key, qty) {
    var d = load(), po = findPo(d, poId);
    if (!po) return fail('PO tidak ditemukan.');
    var o = findOrder(d, po.order_id);
    if (o.status !== 'fulfilling') return fail('Penerimaan hanya saat pesanan Diproses.');
    if (po.status !== 'confirmed') return fail('PO belum dikonfirmasi ke distributor.');
    var pi = po.items.filter(function (x) { return unitKey(x) === key && x.chosen; })[0];
    if (!pi) return fail('Item tidak ada di PO ini.');
    qty = Math.round(Number(qty));
    if (isNaN(qty) || qty < 0 || qty > pi.qty) return fail('Jumlah diterima harus 0 sampai ' + pi.qty + '.');
    pi.received_qty = qty;
    var chosen = po.items.filter(function (x) { return x.chosen; });
    if (chosen.every(function (x) { return x.received_qty >= x.qty; })) po.status = 'fulfilled';
    o.items.forEach(function (it) {
      if (!isBillable(it) || it.item_status === 'shipped') return;
      var mine = [];
      d.pos.forEach(function (p) { if (p.order_id === o.id) p.items.forEach(function (x) { if (x.line_id === it.line_id && x.chosen) mine.push(x); }); });
      if (mine.length && mine.every(function (x) { return x.received_qty >= x.qty; })) it.item_status = 'received';
    });
    addHist(o, 'Diterima ' + qty + ' dari ' + pi.qty + ': ' + pi.name + ' (' + po.id + ')');
    var billable = o.items.filter(isBillable);
    if (billable.length && billable.every(function (it) { return it.item_status === 'received'; })) {
      o.status = 'received'; addHist(o, 'Semua barang sudah diterima David', 'received');
    }
    save(d); return { ok: true, order_status: o.status, po_status: po.status };
  };

  A.toggleAssembly = function (orderId, lineId, on) {
    var d = load(), o = findOrder(d, orderId);
    if (!o) return fail('Pesanan tidak ditemukan.');
    o.assembly = o.assembly || {}; o.assembly[lineId] = !!on;
    save(d); return { ok: true };
  };

  A.ship = function (orderId, f) {
    var d = load(), o = findOrder(d, orderId);
    if (!o || o.status !== 'received') return fail('Kirim hanya dari status Barang di David.');
    if (!String(f.courier || '').trim()) return fail('Isi nama kurir.');
    if (!String(f.resi || '').trim()) return fail('Isi nomor resi.');
    var need = o.items.filter(function (it) { return it.kind === 'rakitan' && isBillable(it); });
    for (var i = 0; i < need.length; i++) if (!(o.assembly && o.assembly[need[i].line_id])) return fail('Centang dulu bahwa bet rakitan sudah dirakit.');
    o.shipment = { courier: f.courier.trim(), resi: f.resi.trim() };
    if (f.actual_fee !== '' && f.actual_fee != null && !isNaN(Number(f.actual_fee))) o.shipment.actual_fee = Math.round(Number(f.actual_fee));
    o.items.forEach(function (it) { if (it.item_status === 'received') it.item_status = 'shipped'; });
    o.status = 'shipped';
    addHist(o, 'Dikirim via ' + o.shipment.courier + ', resi ' + o.shipment.resi);
    save(d); return { ok: true };
  };

  A.complete = function (orderId) {
    var d = load(), o = findOrder(d, orderId);
    if (!o || o.status !== 'shipped') return fail('Hanya pesanan Dikirim yang bisa diselesaikan.');
    o.status = 'completed'; addHist(o, 'Customer konfirmasi terima (simulasi)');
    save(d); return { ok: true };
  };

  A.cancel = function (orderId, reason) {
    var d = load(), o = findOrder(d, orderId);
    if (!o) return fail('Pesanan tidak ditemukan.');
    if (CANCELLABLE.indexOf(o.status) < 0) return fail('Pesanan berstatus ' + o.status + ' tidak bisa dibatalkan.');
    if (!String(reason || '').trim()) return fail('Alasan pembatalan wajib diisi.');
    var wasPaid = o.payment && o.payment.status === 'verified';
    var t = totals(o);
    var confirmedPos = [];
    posOf(d, o.id).forEach(function (p) {
      if (p.status === 'confirmed') confirmedPos.push(p.id);
      if (['draft', 'sent', 'responded', 'rejected'].indexOf(p.status) >= 0) p.status = 'cancelled';
    });
    o.items.forEach(function (it) { if (it.item_status !== 'received') it.item_status = 'cancelled'; });
    o.status = 'cancelled'; o.cancel_reason = reason.trim();
    if (wasPaid) o.refund = { amount: t.total, status: 'perlu_ditransfer' };
    addHist(o, 'Dibatalkan: ' + reason.trim() + (wasPaid ? ' | Refund ' + DS.formatRupiah(t.total) + ' perlu ditransfer' : '') +
      (confirmedPos.length ? ' | PO sudah dikonfirmasi (' + confirmedPos.join(', ') + '): hubungi distributor' : ''));
    save(d); return { ok: true, refund: wasPaid ? t.total : 0, confirmed_pos: confirmedPos };
  };

  A.refundDone = function (orderId) {
    var d = load(), o = findOrder(d, orderId);
    if (!o || !o.refund) return fail('Tidak ada catatan refund.');
    o.refund.status = 'sudah_ditransfer'; addHist(o, 'Refund ' + DS.formatRupiah(o.refund.amount) + ' sudah ditransfer');
    save(d); return { ok: true };
  };

  // quoted yang lewat batas bayar tanpa bukti -> expired (ADM-09)
  A.sweepExpired = function () {
    var d = load(), n = 0;
    d.orders.forEach(function (o) {
      if (o.status === 'quoted' && o.pay_deadline && ms(o.pay_deadline) < Date.now() &&
        ['pending_verification', 'verified'].indexOf(o.payment.status) < 0) {
        o.status = 'expired'; addHist(o, 'Batas bayar lewat tanpa bukti');
        posOf(d, o.id).forEach(function (p) { if (['draft', 'sent', 'responded', 'rejected'].indexOf(p.status) >= 0) p.status = 'cancelled'; });
        n++;
      }
    });
    if (n) save(d);
    return n;
  };

  // ---------- teks WhatsApp ----------
  function waLink(number, text) { return 'https://wa.me/' + String(number || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(text); }
  function dist(id) { return DS.getDistributors().filter(function (x) { return x.id === id; })[0] || { id: id, name: id, wa: '' }; }
  function poText(po) { // tidak memuat data customer (R7)
    var s = DS.getSettings();
    var lines = ['Halo ' + dist(po.distributor_id).name + ', saya David (DavidStore). Mohon cek ketersediaan dan harga:', '', 'Kode PO: ' + po.id, ''];
    po.items.filter(function (x) { return !x.superseded; }).forEach(function (pi, i) {
      lines.push((i + 1) + '. ' + pi.name + (pi.variant ? ' — ' + pi.variant : '') + ' × ' + pi.qty);
    });
    lines.push('', 'Alamat kirim: ' + s.address, '', 'Mohon balas per item: ada/tidak, harga per unit, dan estimasi tiba. Terima kasih.');
    return lines.join('\n');
  }
  function poConfirmText(po, order) {
    var s = DS.getSettings();
    var items = po.items.filter(function (x) { return x.chosen; });
    var lines = [po.id + ' dikonfirmasi. Mohon kirim ke:', s.address, ''];
    items.forEach(function (pi, i) {
      lines.push((i + 1) + '. ' + pi.name + (pi.variant ? ' — ' + pi.variant : '') + ' × ' + pi.qty + ' @ ' + DS.formatRupiah(pi.cost_price));
    });
    lines.push('', 'Terima kasih, ' + dist(po.distributor_id).name + '.');
    return lines.join('\n');
  }
  function statusLink(order) {
    var base = 'https://davidstore.example/marketplace/index.html';
    try { if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) base = new URL('../marketplace/index.html', location.href).href; } catch (e) {}
    return base + '#/lacak?id=' + encodeURIComponent(order.id) + '&wa=' + encodeURIComponent((order.customer && order.customer.wa) || '');
  }
  function quoteText(order) {
    var t = totals(order), s = DS.getSettings();
    var lines = ['Halo ' + order.customer.name.replace(/ \(CONTOH\)/, '') + ', harga final pesanan ' + order.id + ' dari DavidStore:', ''];
    order.items.filter(isBillable).forEach(function (it, i) {
      lines.push((i + 1) + '. ' + (it.brand ? it.brand + ' ' : '') + it.name + (it.variant ? ' — ' + it.variant : '') + ' × ' + it.qty + ' = ' + DS.formatRupiah(it.final_price * it.qty));
    });
    var gone = order.items.filter(function (it) { return !isBillable(it); });
    if (gone.length) lines.push('', 'Tidak tersedia: ' + gone.map(function (g) { return g.name; }).join(', '));
    lines.push('', 'Ongkir: ' + DS.formatRupiah(t.ongkir), 'Total: ' + DS.formatRupiah(t.total));
    lines.push('', 'Transfer ke ' + s.bank.bank + ' ' + s.bank.no + ' a.n. ' + s.bank.name, 'Batas bayar: ' + (order.pay_deadline || '(diisi saat dikirim)'));
    lines.push('', 'Lihat & unggah bukti: ' + statusLink(order));
    return lines.join('\n');
  }
  function shipText(order) {
    return 'Halo ' + order.customer.name.replace(/ \(CONTOH\)/, '') + ', pesanan ' + order.id + ' sudah dikirim via ' + order.shipment.courier + ', resi ' + order.shipment.resi + '. Terima kasih sudah belanja di DavidStore.';
  }

  // ---------- "Perlu tindakan" (ADM-02): tiap pesanan aktif tepat satu baris ----------
  function lastAt(o) { var h = o.history && o.history.length ? o.history[o.history.length - 1].at : o.created_at; return ms(h) || ms(o.created_at); }
  function actionFor(order, pos) {
    var mine = pos.filter(function (p) { return p.order_id === order.id; });
    var now = Date.now(), since = lastAt(order), st = order.status;
    if (['completed', 'cancelled', 'expired'].indexOf(st) >= 0) return null;
    var r = function (kind, text, s, group) { return { kind: kind, text: text, since: s || since, group: group }; };
    if (st === 'placed') return r('action', 'Pesanan baru — belum dibuat PO', ms(order.created_at), 'baru');
    if (st === 'sourcing') {
      if (eligibleUnits(order, pos).some(function (u) { return unitState(pos, order.id, u) === 'nopo'; }))
        return r('action', 'Ada item belum punya PO', since, 'baru');
      var late = mine.filter(function (p) { return p.status === 'sent' && now - ms(p.sent_at) > 24 * HR; });
      if (late.length) return r('action', late.length + ' PO belum dibalas lebih dari 24 jam', Math.min.apply(null, late.map(function (p) { return ms(p.sent_at); })), 'po');
      var drafts = mine.filter(function (p) { return p.status === 'draft'; });
      if (drafts.length) return r('action', drafts.length + ' PO masih draf — kirim via WA', Math.min.apply(null, drafts.map(function (p) { return ms(p.created_at); })), 'po');
      if (order.items.some(function (i) { return i.item_status === 'unavailable'; }) && !order.items.some(function (i) { return i.item_status === 'pending'; }))
        return r('action', 'Ada item tidak tersedia — cari distributor lain / alternatif', since, 'po');
      if (quoteReady(order, pos).ok) return r('action', 'Semua item terjawab — susun harga final', since, 'harga');
      return r('wait', 'Menunggu balasan distributor', Math.min.apply(null, mine.filter(function (p) { return p.status === 'sent'; }).map(function (p) { return ms(p.sent_at); }).concat([since])), 'tunggu');
    }
    if (st === 'quoted') {
      if (order.payment.status === 'pending_verification') return r('action', 'Bukti bayar menunggu verifikasi', ms(order.payment.at) || since, 'bayar');
      return r('wait', 'Menunggu transfer customer' + (order.payment.status === 'rejected' ? ' (bukti ditolak, menunggu unggah ulang)' : ''), since, 'tunggu');
    }
    if (st === 'paid') return r('action', 'Lunas — konfirmasi beli ke distributor', since, 'konfirmasi');
    if (st === 'fulfilling') {
      if (mine.some(function (p) { return p.status === 'responded' && p.items.some(function (pi) { return pi.chosen; }); }))
        return r('action', 'Ada PO lunas belum dikonfirmasi ke distributor', since, 'konfirmasi');
      return r('wait', 'Menunggu barang dari distributor', since, 'tunggu');
    }
    if (st === 'received') return r('action', 'Barang siap dikirim ke customer', since, 'kirim');
    if (st === 'shipped') return r('wait', 'Dikirim — menunggu customer menerima', since, 'tunggu');
    return null;
  }

  // ======================================================================
  // Beranda penjualan (ADM-22, PRD §7.4) — fungsi murni: tanpa DOM, tanpa DS, bisa diuji di Node.
  // Semua batas hari memakai WIB (Asia/Jakarta). Uang = bilangan bulat rupiah.
  // Field pesanan yang dibaca: status, created_at, history[{at,status}], payment.verified_at, refund.amount,
  // shipping_fee, items[{kind,sku,brand,name,qty,final_price,cost_price,item_status,distributor_id,refunded,components}].
  // `item.refunded = true` = item itu direfund sebagian (R4); tidak ikut omzet.
  // ======================================================================
  var COUNTED = ['paid', 'fulfilling', 'received', 'shipped', 'completed'];   // status pesanan terhitung
  var ACCEPTED = ['accepted', 'received', 'shipped'];                         // status item terhitung
  var ACTIVE = ['placed', 'sourcing', 'quoted', 'paid', 'fulfilling', 'received', 'shipped'];
  var DAY = 24 * HR, WIB_OFF = 7 * HR;
  var ACTION_GROUPS = ['baru', 'po', 'harga', 'bayar', 'konfirmasi', 'kirim'];
  var MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function wibParts(t) { var d = new Date(t + WIB_OFF); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }; }
  function wibStart(y, m, d) { return Date.UTC(y, m, d) - WIB_OFF; }   // 00:00 WIB; Date.UTC merapikan bulan/hari di luar rentang
  function daysIn(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function round1(x) { return Math.round(x * 10) / 10; }
  function histFirst(o, status) {
    var h = o.history || [];
    for (var i = 0; i < h.length; i++) if (h[i].status === status) { var t = ms(h[i].at); if (t) return t; }
    return null;
  }
  function histLast(o, status) {
    var h = o.history || [], r = null;
    for (var i = 0; i < h.length; i++) if (h[i].status === status) { var t = ms(h[i].at); if (t) r = t; }
    return r;
  }
  function paidAt(o) { return histFirst(o, 'paid') || (o.payment && ms(o.payment.verified_at)) || null; }
  function reachedPaid(o) {
    return histFirst(o, 'paid') != null || COUNTED.indexOf(o.status) >= 0 || (o.status === 'cancelled' && !!o.payment && o.payment.status === 'verified');
  }
  function reachedQuoted(o) { return histFirst(o, 'quoted') != null || reachedPaid(o) || o.status === 'quoted' || o.status === 'expired'; }

  // rentang periode + pembanding. period: {kind:'today'|'7d'|'month'|'pick', ym:'YYYY-MM'}
  function periodRange(period, now) {
    var kind = (period && period.kind) || 'month', p = wibParts(now), r;
    if (kind === 'pick') {
      var mm = /^(\d{4})-(\d{2})$/.exec(String(period.ym || ''));
      if (!mm || +mm[2] < 1 || +mm[2] > 12) kind = 'month';
      else {
        var y = +mm[1], m = +mm[2] - 1, s = wibStart(y, m, 1), e = wibStart(y, m + 1, 1) - 1;
        r = { kind: 'pick', label: MONTHS_ID[m] + ' ' + y, start: s, end: e, cmpStart: wibStart(y, m - 1, 1), cmpEnd: s - 1,
          cmpLabel: MONTHS_ID[(m + 11) % 12] + ' ' + (m === 0 ? y - 1 : y) + ' penuh' };
      }
    }
    if (kind === 'today') {
      var t0 = wibStart(p.y, p.m, p.d);
      r = { kind: 'today', label: 'Hari ini', start: t0, end: now, cmpStart: t0 - DAY, cmpEnd: now - DAY, cmpLabel: 'kemarin pada jam yang sama' };
    } else if (kind === '7d') {
      var s7 = wibStart(p.y, p.m, p.d - 6);
      r = { kind: '7d', label: '7 hari terakhir', start: s7, end: now, cmpStart: s7 - 7 * DAY, cmpEnd: now - 7 * DAY, cmpLabel: '7 hari sebelumnya' };
    } else if (kind === 'month') {
      var s1 = wibStart(p.y, p.m, 1), dim = daysIn(p.y, p.m - 1), cs = wibStart(p.y, p.m - 1, 1), ce;
      if (p.d > dim) ce = s1 - 1;                                         // 31 Mar vs Feb: dipotong di akhir bulan lalu
      else ce = wibStart(p.y, p.m - 1, p.d) + (now - wibStart(p.y, p.m, p.d)); // tanggal & jam yang sama
      r = { kind: 'month', label: 'Bulan ini', start: s1, end: now, cmpStart: cs, cmpEnd: ce, cmpLabel: 'bulan lalu, tanggal 1 sampai tanggal yang sama' };
    }
    r.effEnd = Math.min(r.end, now);
    return r;
  }

  function firstRecordAt(orders) {
    var f = null;
    orders.forEach(function (o) { var t = ms(o.created_at); if (t && (f === null || t < f)) f = t; });
    return f;
  }

  // modal per unit item: PO confirmed/fulfilled (item terpilih) lebih dulu, lalu item.cost_price. null = tidak diketahui (BUKAN 0).
  function chosenEntry(pos, orderId, unit) {
    for (var i = 0; i < pos.length; i++) {
      var p = pos[i];
      if (p.order_id !== orderId || (p.status !== 'confirmed' && p.status !== 'fulfilled')) continue;
      for (var j = 0; j < p.items.length; j++) {
        var pi = p.items[j];
        if (!pi.superseded && pi.chosen && pi.cost_price > 0 && unitKey(pi) === unit.key) return { po: p, pi: pi };
      }
    }
    return null;
  }
  function costParts(o, it, pos) {
    var parts = [], miss = 0, sum = 0;
    unitsOf(it).forEach(function (u) {
      var e = chosenEntry(pos, o.id, u);
      if (e) { parts.push({ unit: u, cost: e.pi.cost_price, dist: e.po.distributor_id, po: e.po.id }); sum += e.pi.cost_price; }
      else { parts.push({ unit: u, cost: null, dist: null, po: null }); miss++; }
    });
    if (!miss) return { cost: sum, parts: parts };
    if (it.cost_price > 0) {
      if (parts.length === 1) { parts[0].cost = it.cost_price; parts[0].dist = parts[0].dist || it.distributor_id || null; }
      return { cost: Number(it.cost_price), parts: parts };
    }
    return { cost: null, parts: parts };
  }
  function firstWord(name) { return String(name || '').trim().split(/\s+/)[0] || '—'; }

  // satu item -> bagian per komponen (bet rakitan: omzet/modal dibagi menurut porsi modal komponen; modal tak lengkap: dibagi rata)
  function splitParts(it, cp, omzet, modal, brandOf) {
    var n = cp.parts.length, sumCost = 0, known = true;
    cp.parts.forEach(function (p) { if (p.cost == null) known = false; else sumCost += p.cost; });
    known = known && sumCost > 0;
    var out = [], oLeft = omzet, mLeft = modal;
    cp.parts.forEach(function (p, i) {
      var share = known ? p.cost / sumCost : 1 / n, last = i === n - 1;
      var po = last ? oLeft : Math.round(omzet * share); oLeft -= po;
      var pm = null;
      if (modal != null) { pm = last ? mLeft : Math.round(modal * share); mLeft -= pm; }
      out.push({ sku: p.unit.sku || p.unit.name, name: p.unit.name, brand: (it.kind !== 'rakitan' && it.brand) || brandOf(p.unit.sku, p.unit.name),
        dist: p.dist || (n === 1 ? it.distributor_id || null : null), qty: p.unit.qty, omzet: po, modal: pm, profit: pm == null ? null : po - pm });
    });
    return out;
  }

  // semua pesanan terhitung (status) berikut baris item-nya; belum disaring periode
  function salesLines(orders, pos, brandOf) {
    var lines = [], counted = [], undated = [], refunds = [], noPrice = [];
    orders.forEach(function (o) {
      if (COUNTED.indexOf(o.status) < 0) return;
      var pa = paidAt(o);
      if (!pa) { undated.push(o.id); return; }
      counted.push({ o: o, paidAt: pa });
      (o.items || []).forEach(function (it) {
        var qty = Number(it.qty) || 0;
        if (it.refunded) { refunds.push({ orderId: o.id, paidAt: pa, amount: (Number(it.final_price) || 0) * qty }); return; }
        if (ACCEPTED.indexOf(it.item_status) < 0) return;
        if (!(it.final_price >= 0) || it.final_price == null) { noPrice.push(o.id); return; }
        var cp = costParts(o, it, pos), omzet = it.final_price * qty, modal = cp.cost == null ? null : cp.cost * qty;
        lines.push({ orderId: o.id, paidAt: pa, qty: qty, omzet: omzet, modal: modal, profit: modal == null ? null : omzet - modal,
          parts: splitParts(it, cp, omzet, modal, brandOf) });
      });
    });
    return { lines: lines, counted: counted, undated: undated, refunds: refunds, noPrice: noPrice, pos: pos };
  }

  function sortRows(map) {
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.omzet - a.omzet || String(a.name).localeCompare(String(b.name)); });
  }
  function aggregate(all, start, end, isVisible) {
    function inR(t) { return t >= start && t <= end; }
    var ords = all.counted.filter(function (c) { return inR(c.paidAt); }), ids = {};
    ords.forEach(function (c) { ids[c.o.id] = true; });
    var lines = all.lines.filter(function (l) { return inR(l.paidAt); });
    var omzet = 0, profit = 0, base = 0, missItems = 0, missOrders = {}, prod = {}, brand = {}, dist = {};
    lines.forEach(function (l) {
      omzet += l.omzet;
      if (l.modal == null) { missItems++; missOrders[l.orderId] = true; } else { profit += l.profit; base += l.omzet; }
      l.parts.forEach(function (p) {
        var a = prod[p.sku] = prod[p.sku] || { key: p.sku, name: p.name, brand: p.brand, qty: 0, omzet: 0, profit: 0, incomplete: false };
        var b = brand[p.brand] = brand[p.brand] || { key: p.brand, name: p.brand, qty: 0, omzet: 0, profit: 0, incomplete: false, hidden: isVisible ? isVisible(p.brand) === false : false };
        var d = dist[p.dist || '?'] = dist[p.dist || '?'] || { key: p.dist || '?', name: p.dist || '?', pos: 0, modal: 0, omzet: 0, profit: 0, incomplete: false };
        [a, b, d].forEach(function (x) {
          x.omzet += p.omzet;
          if (p.profit == null) x.incomplete = true; else x.profit += p.profit;
        });
        a.qty += p.qty; b.qty += p.qty;
        if (p.modal != null) d.modal += p.modal;
      });
    });
    var poSeen = {};
    all.pos.forEach(function (po) {
      if (!ids[po.order_id] || (po.status !== 'confirmed' && po.status !== 'fulfilled') || poSeen[po.id]) return;
      if (!po.items.some(function (pi) { return pi.chosen; })) return;
      poSeen[po.id] = true;
      var d = dist[po.distributor_id] = dist[po.distributor_id] || { key: po.distributor_id, name: po.distributor_id, pos: 0, modal: 0, omzet: 0, profit: 0, incomplete: false };
      d.pos++;
    });
    var refundItems = 0, refundAmount = 0;
    all.refunds.forEach(function (r) { if (inR(r.paidAt)) { refundItems++; refundAmount += r.amount; } });
    var n = ords.length;
    return {
      orderCount: n, omzet: omzet, profit: profit, profitBase: base,
      margin: base > 0 ? round1(profit / base * 100) : null,
      avg: n > 0 ? Math.round(omzet / n) : null,
      missingCostItems: missItems, missingCostOrders: Object.keys(missOrders),
      refundItems: refundItems, refundAmount: refundAmount,
      products: sortRows(prod), brands: sortRows(brand), dists: sortRows(dist), orderIds: Object.keys(ids)
    };
  }

  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function pctOf(n, of) { return of > 0 ? round1(n / of * 100) : null; }

  // B6–B10, tanggal basis: dibuat (B6–B8), pertama quoted (B9), masuk batal/kedaluwarsa (B10)
  function funnelFor(orders, start, end) {
    function inR(t) { return t != null && t >= start && t <= end; }
    var cohort = orders.filter(function (o) { return inR(ms(o.created_at)); });
    var paid = cohort.filter(reachedPaid);
    var running = cohort.filter(function (o) { return !reachedPaid(o) && ACTIVE.indexOf(o.status) >= 0; });
    var quoted = cohort.filter(reachedQuoted), qPaid = quoted.filter(reachedPaid);
    var qRunning = quoted.filter(function (o) { return !reachedPaid(o) && ACTIVE.indexOf(o.status) >= 0; });
    var hrs = [];
    orders.forEach(function (o) { var q = histFirst(o, 'quoted'), c = ms(o.created_at); if (inR(q) && c) hrs.push((q - c) / HR); });
    var canB = 0, canA = 0, refund = 0, exp = 0;
    orders.forEach(function (o) {
      if (o.status === 'cancelled' && inR(histLast(o, 'cancelled'))) {
        if (reachedPaid(o)) {
          canA++;
          refund += o.refund && o.refund.amount != null ? Number(o.refund.amount) :
            (o.items || []).reduce(function (s, it) { return s + (Number(it.final_price) || 0) * (Number(it.qty) || 0); }, 0) + (Number(o.shipping_fee) || 0);
        } else canB++;
      }
      if (o.status === 'expired' && inR(histLast(o, 'expired'))) exp++;
    });
    return {
      b6: cohort.length,
      b7: { n: paid.length, of: cohort.length, pct: pctOf(paid.length, cohort.length), running: running.length },
      b8: { n: qPaid.length, of: quoted.length, pct: pctOf(qPaid.length, quoted.length), running: qRunning.length },
      b9: { n: hrs.length, median: median(hrs), late: hrs.filter(function (h) { return h > 24; }).length },
      b10: { cancelledBeforePaid: canB, cancelledAfterPaid: canA, refundTotal: refund, expired: exp }
    };
  }

  // omzet per hari WIB (untuk grafik); hanya hari dalam rentang
  function dailySeries(all, start, end) {
    var out = [], d0 = wibParts(start), t = wibStart(d0.y, d0.m, d0.d);
    while (t <= end && out.length < 400) { out.push({ start: t, omzet: 0 }); t += DAY; }
    all.lines.forEach(function (l) {
      if (l.paidAt < start || l.paidAt > end) return;
      var i = Math.floor((l.paidAt - out[0].start) / DAY); if (out[i]) out[i].omzet += l.omzet;
    });
    return out;
  }

  // pembanding satu angka. prev.orderCount menentukan arti "0": tidak ada penjualan vs nol sungguhan
  function compareVal(cur, prev, prevOrders, isPoint) {
    if (cur == null || prev == null) return { state: 'na' };
    if (prevOrders === 0) return { state: 'noSales' };
    var diff = isPoint ? round1(cur - prev) : cur - prev;
    if (prev === 0 || isPoint) return { state: 'ok', diff: diff, pct: null };
    return { state: 'ok', diff: diff, pct: round1(diff / Math.abs(prev) * 100) };
  }

  function computeSalesSummary(orders, pos, period, now, opts) {
    opts = opts || {}; orders = orders || []; pos = pos || [];
    var brandOf = opts.brandOf || function (sku, name) { return firstWord(name); };
    var range = periodRange(period, now), first = firstRecordAt(orders);
    var all = salesLines(orders, pos, brandOf);
    var cur = aggregate(all, range.start, range.effEnd, opts.isBrandVisible);
    var prev = aggregate(all, range.cmpStart, range.cmpEnd, opts.isBrandVisible);
    var fn = funnelFor(orders, range.start, range.effEnd);
    var act = actionSummary(orders, pos);
    return {
      range: range, since: first,
      noData: first == null || range.effEnd < first,        // periode sebelum pencatatan pertama: "belum ada data", bukan nol
      prevNoData: first == null || range.cmpEnd < first,
      cur: cur, prev: prev,
      compare: {
        omzet: compareVal(cur.omzet, prev.omzet, prev.orderCount),
        profit: compareVal(cur.profit, prev.profit, prev.orderCount),
        margin: compareVal(cur.margin, prev.margin, prev.orderCount, true),
        orders: compareVal(cur.orderCount, prev.orderCount, prev.orderCount),
        avg: compareVal(cur.avg, prev.avg, prev.orderCount)
      },
      funnel: fn,
      daily: dailySeries(all, range.start, range.effEnd),
      undatedPaid: all.undated.length, noPriceItems: all.noPrice.length,
      activeNow: orders.filter(function (o) { return ACTIVE.indexOf(o.status) >= 0; }).length,
      waiting: act.waiting, needAction: act.total
    };
  }

  // ringkasan "Perlu tindakan" (ADM-02): satu sumber untuk Beranda, tab Pesanan, dan lencana sidebar
  function actionSummary(orders, pos) {
    var by = {}, total = 0, waiting = 0;
    (orders || []).forEach(function (o) {
      var a = actionFor(o, pos || []);
      if (!a) return;
      if (a.kind !== 'action') { waiting++; return; }
      total++;
      var g = by[a.group] = by[a.group] || { group: a.group, n: 0, oldest: Infinity };
      g.n++; if (a.since < g.oldest) g.oldest = a.since;
    });
    return { total: total, waiting: waiting, groups: ACTION_GROUPS.filter(function (k) { return by[k]; }).map(function (k) { return by[k]; }) };
  }

  // brand -> {products, activeOrders} (ADM-21). products = [{brand}] dari katalog; resolver untuk komponen bet rakitan
  function brandStats(orders, products, brandOf) {
    brandOf = brandOf || function (sku, name) { return firstWord(name); };
    var st = {};
    function get(b) { return st[b] = st[b] || { products: 0, activeOrders: 0 }; }
    (products || []).forEach(function (p) { get(p.brand).products++; });
    (orders || []).forEach(function (o) {
      if (ACTIVE.indexOf(o.status) < 0) return;
      var seen = {};
      (o.items || []).forEach(function (it) {
        unitsOf(it).forEach(function (u) { seen[(it.kind !== 'rakitan' && it.brand) || brandOf(u.sku, u.name)] = true; });
      });
      Object.keys(seen).forEach(function (b) { get(b).activeOrders++; });
    });
    return st;
  }

  root.DSLogic = {
    computeSalesSummary: computeSalesSummary, periodRange: periodRange, actionSummary: actionSummary, brandStats: brandStats,
    ACTIVE: ACTIVE, COUNTED: COUNTED, ACTION_GROUPS: ACTION_GROUPS, MONTHS_ID: MONTHS_ID, wibParts: wibParts, firstWord: firstWord,
    BILLABLE: BILLABLE, CANCELLABLE: CANCELLABLE,
    A: A, unitsOf: unitsOf, entriesFor: entriesFor, unitState: unitState, eligibleUnits: eligibleUnits, itemPoState: itemPoState,
    categoryOf: categoryOf, assemblyFee: assemblyFee, priceFrom: priceFrom, marginFrom: marginFrom, roundUp1000: roundUp1000,
    costOf: costOf, offersOf: offersOf, totals: totals, quoteReady: quoteReady, isBillable: isBillable,
    waLink: waLink, poText: poText, poConfirmText: poConfirmText, quoteText: quoteText, shipText: shipText, statusLink: statusLink,
    actionFor: actionFor, unitKey: unitKey, ms: ms, dist: dist, load: load
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DSLogic;
})(typeof window !== 'undefined' ? window : globalThis);
