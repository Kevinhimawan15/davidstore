/* DavidStore prototipe — katalog CONTOH.
   Sumber: docs/RISET-PRODUK.md §5 (49 dari 50 baris; #50 Sanwei Barrier tidak dimasukkan karena
   harga Indonesia [?]). Harga = estimasi. Status harga: S = ada sumber, L = S-lemah, P = perkiraan.
   Pemetaan brand -> distributor BELUM diketahui (PRD Q-F), jadi distributor_id = null. */
(function () {
  var COLORS = { Hitam: 'black', Merah: 'red', Biru: 'blue', Hijau: 'green', Pink: 'pink', Ungu: 'purple' };

  var distributors = [
    { id: 'daya-prima', name: 'Daya Prima', wa: '6280000000001' },
    { id: 'donic', name: 'Donic', wa: '6280000000002' },
    { id: 'andro', name: 'Andro', wa: '6280000000003' },
    { id: 'stiga', name: 'Stiga', wa: '6280000000004' },
    { id: 'sinar-surya', name: 'Sinar Surya', wa: '6280000000005' }
  ];

  var categories = [
    { id: 'blade', name: 'Blade', prefix: 'BL' },
    { id: 'karet', name: 'Karet', prefix: 'KR' },
    { id: 'bet-jadi', name: 'Bet Jadi', prefix: 'BJ' },
    { id: 'bola', name: 'Bola', prefix: 'BO' },
    { id: 'meja', name: 'Meja', prefix: 'MJ' },
    { id: 'net', name: 'Net & Tiang', prefix: 'NT' },
    { id: 'tas', name: 'Tas & Cover', prefix: 'TS' },
    { id: 'sepatu', name: 'Sepatu', prefix: 'SP' },
    { id: 'aksesoris', name: 'Aksesoris', prefix: 'AK' },
    { id: 'latihan', name: 'Alat Latihan', prefix: 'AL' }
  ];

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  var RUBBER_COLORS = ['Hitam', 'Merah', 'Biru'];
  var THICK = ['1.8', '2.0', 'Max'];
  var catIdx = {};
  categories.forEach(function (c) { catIdx[c.id] = c; });

  /* Peta SKU -> berkas foto (relatif ke prototype/). Diisi skrip dari assets/products/manifest.json.
     Foto referensi dari sumber publik, wajib diganti sebelum produksi (PRD ADM-15). */
  var IMAGES = {
    /*IMAGES:BEGIN*/
    'BL-01': 'assets/products/BL-01.jpg',
    'BL-02': 'assets/products/BL-02.jpg',
    'BL-03': 'assets/products/BL-03.jpg',
    'BL-04': 'assets/products/BL-04.jpg',
    'BL-06': 'assets/products/BL-06.jpg',
    'BL-07': 'assets/products/BL-07.jpg',
    'BL-08': 'assets/products/BL-08.jpg',
    'BL-09': 'assets/products/BL-09.jpg',
    'BL-10': 'assets/products/BL-10.jpg',
    'BL-11': 'assets/products/BL-11.jpg',
    'BL-12': 'assets/products/BL-12.jpg',
    'BL-13': 'assets/products/BL-13.jpg',
    'BL-14': 'assets/products/BL-14.jpg',
    'BL-16': 'assets/products/BL-16.jpg',
    'BL-17': 'assets/products/BL-17.jpg',
    'KR-18': 'assets/products/KR-18.jpg',
    'KR-19': 'assets/products/KR-19.jpg',
    'KR-20': 'assets/products/KR-20.jpg',
    'KR-21': 'assets/products/KR-21.jpg',
    'KR-22': 'assets/products/KR-22.jpg',
    'KR-23': 'assets/products/KR-23.jpg',
    'KR-24': 'assets/products/KR-24.jpg',
    'KR-25': 'assets/products/KR-25.jpg',
    'KR-26': 'assets/products/KR-26.jpg',
    'KR-27': 'assets/products/KR-27.jpg',
    'KR-28': 'assets/products/KR-28.jpg',
    'BJ-30': 'assets/products/BJ-30.jpg',
    'BJ-31': 'assets/products/BJ-31.jpg',
    'BO-32': 'assets/products/BO-32.jpg',
    'BO-33': 'assets/products/BO-33.jpg',
    'BO-34': 'assets/products/BO-34.jpg',
    'BO-35': 'assets/products/BO-35.jpg',
    'BO-36': 'assets/products/BO-36.jpg',
    'MJ-37': 'assets/products/MJ-37.png',
    'MJ-38': 'assets/products/MJ-38.jpg',
    'NT-39': 'assets/products/NT-39.jpg',
    'NT-40': 'assets/products/NT-40.jpg',
    'SP-44': 'assets/products/SP-44.jpg',
    'AK-45': 'assets/products/AK-45.jpg',
    'AK-46': 'assets/products/AK-46.jpg',
    'AL-49': 'assets/products/AL-49.jpg',
    /*IMAGES:END*/
  };
  window.DS_IMAGES = IMAGES;

  var products = [];
  /* P(no riset, kategori, brand, nama, harga, opsi) */
  function P(no, cat, brand, name, price, o) {
    o = o || {};
    var options = [];
    if (cat === 'blade') options.push({ key: 'handle', label: 'Handle', type: 'seg', values: o.handles || ['FL', 'ST', 'AN'] });
    if (cat === 'karet') {
      options.push({ key: 'thickness', label: 'Ketebalan sponge (mm)', type: 'seg', values: o.thick || THICK });
      options.push({ key: 'color', label: 'Warna', type: 'swatch', values: o.colors || RUBBER_COLORS });
    }
    if (o.isi) options.push({ key: 'isi', label: 'Isi per pak (bola)', type: 'seg', values: o.isi });
    if (o.sizes) options.push({ key: 'size', label: 'Ukuran (EU)', type: 'seg', values: o.sizes });
    if (o.wid) options.push({ key: 'width', label: 'Lebar (mm)', type: 'seg', values: o.wid });
    products.push({
      sku: catIdx[cat].prefix + '-' + (no < 10 ? '0' : '') + no,
      slug: slug(brand + ' ' + name),
      ref: no,
      category: cat,
      brand: brand,
      name: name,
      image: IMAGES[catIdx[cat].prefix + '-' + (no < 10 ? '0' : '') + no] || null, // path foto relatif dari prototype/, atau null
      price: price,              // estimasi, rupiah bulat (batas bawah bila berupa rentang)
      price_to: o.to || null,    // batas atas rentang (bila ada)
      price_from: !!o.from,      // "mulai dari"
      price_status: o.ps || 'S', // S | L | P
      avail: 'via_konfirmasi',
      speed: o.speed || null,    // OFF | ALL | DEF (spesifikasi [U], belum diverifikasi)
      type: o.type || null,      // jenis karet
      options: options,
      spec: o.spec || [],
      note: o.note || ''
    });
  }

  /* ---- Blade ---- */
  P(1, 'blade', 'Butterfly', 'Viscaria', 2815000, { to: 4417000, ps: 'L', speed: 'OFF', spec: [['Komposisi', '5 kayu + 2 Arylate-Carbon'], ['Kelas', 'OFF'], ['Berat', '±86–90 g']] });
  P(2, 'blade', 'Butterfly', 'Viscaria CS (penhold)', 2749000, { ps: 'L', handles: ['CS'], spec: [['Tipe', 'Penhold Cina'], ['Catatan', 'Varian pasar Jepang']] });
  P(3, 'blade', 'Stiga', 'Cybershape (Wood)', 3700000, { speed: 'OFF', spec: [['Kepala', 'Heksagonal'], ['Kelas', 'OFF']] });
  P(4, 'blade', 'Stiga', 'Cybershape Carbon CWT Truls Edition', 4950000, { handles: ['FL'], spec: [['Komposisi', 'Karbon'], ['Handle', 'FL']] });
  P(5, 'blade', 'Stiga', 'Clipper CR WRB Penhold', 1100000, { speed: 'OFF', handles: ['CS'], spec: [['Komposisi', '7 ply kayu'], ['Kelas', 'OFF'], ['Tipe', 'Penhold']] });
  P(6, 'blade', 'Stiga', 'Allround CR WRB', 700000, { to: 1000000, ps: 'P', speed: 'ALL', spec: [['Komposisi', '5 ply kayu'], ['Kelas', 'ALL']] });
  P(7, 'blade', 'Donic', 'Ovtcharov True Carbon', 1400000, { speed: 'OFF', spec: [['Komposisi', '5 kayu + 2 karbon'], ['Kelas', 'OFF'], ['Berat', '84–90 g (sumber berbeda-beda)']] });
  P(8, 'blade', 'Donic', 'Carbotec 7000', 1622000, { ps: 'L', speed: 'OFF', spec: [['Komposisi', 'Karbon'], ['Kelas', 'OFF']] });
  P(9, 'blade', 'Andro', 'Treiber CO S', 1250000, { speed: 'OFF', spec: [['Kelas', 'OFF']] });
  P(10, 'blade', 'Andro', 'Treiber FI OFF', 1573000, { speed: 'OFF', spec: [['Kelas', 'OFF']] });
  P(11, 'blade', 'Andro', 'Novacell OFF S', 700000, { speed: 'OFF', spec: [['Kelas', 'OFF']] });
  P(12, 'blade', 'Yasaka', 'Ma Lin Carbon', 1012500, { handles: ['FL', 'ST'], spec: [['Komposisi', '5 kayu + 2 karbon'], ['Sertifikasi', 'JTTA']] });
  P(13, 'blade', 'Yasaka', 'Ma Lin Extra Offensive', 900000, { to: 1200000, ps: 'P', speed: 'OFF', spec: [['Komposisi', '5 ply kayu'], ['Kelas', 'OFF']] });
  P(14, 'blade', 'DHS', 'Hurricane 506X', 1100000, { speed: 'OFF', handles: ['FL'], spec: [['Kelas', 'OFF'], ['Handle', 'FL']] });
  P(15, 'blade', 'Yinhe', '970XX KLC', 750000, { spec: [['Komposisi', 'Kevlar-carbon']] });
  P(16, 'blade', 'Yinhe', 'T-11S', 390000, { spec: [['Komposisi', 'Karbon']] });
  P(17, 'blade', 'Gewo', 'Talent OFF', 500000, { speed: 'OFF', handles: ['FL'], spec: [['Kelas', 'OFF'], ['Handle', 'FL']] });

  /* ---- Karet ---- */
  P(18, 'karet', 'Butterfly', 'Tenergy 05 / 05 FX', 975000, { type: 'Inverted', colors: ['Hitam', 'Merah'], spec: [['Tipe', 'Inverted tensor'], ['Sponge', '1.7 / 1.9 / 2.1']] });
  P(19, 'karet', 'Butterfly', 'Dignics 09C', 1150000, { to: 1400000, ps: 'P', type: 'Inverted', spec: [['Tipe', 'Inverted, topsheet agak lengket']] });
  P(20, 'karet', 'Donic', 'Bluefire JP01 (Turbo)', 755000, { to: 980000, type: 'Inverted', spec: [['Tipe', 'Inverted tensor'], ['Sponge', 'Max']] });
  P(21, 'karet', 'Donic', 'Bluefire M1', 800000, { to: 1000000, ps: 'P', type: 'Inverted', spec: [['Tipe', 'Inverted tensor, OFF'], ['Catatan', 'Sedikit lebih lunak dari M1 Turbo']] });
  P(22, 'karet', 'Andro', 'Rasanter R47', 800000, { to: 950000, ps: 'P', type: 'Inverted', spec: [['Tipe', 'Inverted tensor'], ['Kekerasan sponge', '47°'], ['Karakter', 'Spin tinggi']] });
  P(23, 'karet', 'Stiga', 'DNA Platinum M', 810000, { type: 'Inverted', spec: [['Tipe', 'Inverted'], ['Sponge', 'MAX+ 2.3 mm']] });
  P(24, 'karet', 'Xiom', 'Vega Pro', 490000, { type: 'Inverted', spec: [['Tipe', 'Inverted tensor']] });
  P(25, 'karet', 'DHS', 'Hurricane 3 Neo', 400000, { to: 550000, ps: 'P', type: 'Inverted', spec: [['Tipe', 'Inverted tacky Cina'], ['Kekerasan sponge', '37 / 39 / 40°'], ['Versi', 'Komersial / provincial / national']] });
  P(26, 'karet', '729 Friendship', 'Battle Taichi', 290000, { type: 'Inverted', colors: ['Hitam'], spec: [['Tipe', 'Inverted'], ['Kekerasan sponge', '37 / 39°']] });
  P(27, 'karet', 'Gewo', 'Nexxus EL Pro 53 SuperSelect', 750000, { type: 'Inverted', colors: ['Hitam'], spec: [['Tipe', 'Inverted'], ['Kekerasan sponge', '53°'], ['Sponge', 'Max']] });
  P(28, 'karet', 'Yinhe', 'Mercury II', 50000, { type: 'Inverted', colors: ['Hitam', 'Merah'], spec: [['Tipe', 'Inverted, soft/medium'], ['Sponge', '1.2–2.2 mm']] });
  P(29, 'karet', 'Sunflex', 'DR Freeze', 248900, { type: 'Anti-spin', colors: ['Hitam', 'Merah'], spec: [['Tipe', 'Anti-spin']] });

  /* ---- Bet jadi ---- */
  P(30, 'bet-jadi', 'Butterfly', 'Timo Boll 3000', 305000, { ps: 'L', spec: [['Tipe', 'Bet rekreasi siap pakai']] });
  P(31, 'bet-jadi', 'Butterfly', 'Timo Boll 2000', 250000, { spec: [['Tipe', 'Bet rekreasi siap pakai']] });

  /* ---- Bola ---- */
  P(32, 'bola', 'DHS', 'DJ40+ WTT 3-Star', 90000, { from: true, spec: [['Bintang', '3'], ['Standar', 'ITTF, 40+ ABS'], ['Isi', '6']] });
  P(33, 'bola', 'Donic', 'P40+ 3-Star', 35000, { from: true, isi: ['3', '6', '12'], spec: [['Bintang', '3'], ['Standar', 'ITTF approved'], ['Catatan', 'Isi per pak pada sumber tidak jelas']] });
  P(34, 'bola', 'Yinhe', 'H40+ 3-Star', 55000, { from: true, isi: ['3', '6', '12'], spec: [['Bintang', '3'], ['Standar', 'ITTF approved'], ['Catatan', 'Isi per pak pada sumber tidak jelas']] });
  P(35, 'bola', 'Nittaku', 'Premium 40+ 3-Star', 250000, { to: 320000, ps: 'P', spec: [['Bintang', '3'], ['Standar', 'ITTF'], ['Isi', '6']] });
  P(36, 'bola', 'Gewo', 'Training Club 40+', 280000, { spec: [['Jenis', 'Latihan (bukan 3-star)'], ['Isi', '72']] });

  /* ---- Meja, net, tas, sepatu, aksesoris, latihan ---- */
  P(37, 'meja', 'Sanwei', 'TA-08 Indoor', 7854000, { spec: [['Ukuran', '274 × 152,5 × 76 cm'], ['Roda', '8 roda 75 mm, dapat dikunci']] });
  P(38, 'meja', 'Sanwei', 'TA-06 Rouge Indoor', 4383000, { spec: [['Penggunaan', 'Indoor'], ['Catatan', 'Harga sebelum diskon pada sumber: 4.870.000']] });
  P(39, 'net', 'DHS', 'P104', 396000, { spec: [['Seri', 'Classic'], ['Tiang', 'Logam']] });
  P(40, 'net', 'DHS', 'P106', 375250, { spec: [] });
  P(41, 'net', 'Giant Dragon', '9819T', 169000, { spec: [] });
  P(42, 'tas', 'Joola', 'Tas medium', 650000, { spec: [] });
  P(43, 'tas', 'Butterfly', 'Cover bet dengan saku bola', 19000, { spec: [['Tipe', 'Single']] });
  P(44, 'sepatu', 'Butterfly', 'Lezoline Nine', 1350000, { sizes: ['38', '39', '40', '41', '42', '43', '44', '45'], spec: [['Warna', 'White Gold / White Dark Blue']] });
  P(45, 'aksesoris', 'Butterfly', 'Free Chack II (lem)', 90000, { spec: [['Volume', '20 ml'], ['Jenis', 'Berbasis air']] });
  P(46, 'aksesoris', 'DHS', 'Lem No.15', 135000, { spec: [['Volume', '50 ml']] });
  P(47, 'aksesoris', 'Andro', 'Edge tape Rasanter', 8000, { wid: ['10', '12'], spec: [['Lebar', '10 / 12 mm']] });
  P(48, 'aksesoris', 'Yinhe', 'Rubber Clean Sponge', 31000, { spec: [['Fungsi', 'Pembersih karet']] });
  P(49, 'latihan', 'Huipang', 'S6 Pro (robot)', 4725000, { to: 5199000, spec: [['Kapasitas', '100 bola'], ['Kecepatan', '4–40 m/s'], ['Mode servis', '9'], ['Perlengkapan', 'Jaring penangkap bola']] });

  var brandNames = [];
  products.forEach(function (p) { if (brandNames.indexOf(p.brand) < 0) brandNames.push(p.brand); });
  brandNames.sort();
  var brands = brandNames.map(function (n) { return { id: slug(n), name: n, distributor_id: null }; });

  window.DS_CATALOG = {
    sample: true,
    brands: brands,
    categories: categories,
    distributors: distributors,
    colors: COLORS,
    assembly_fee: 20000, // CONTOH: biaya rakit belum diketahui (PRD Q-H)
    products: products
  };
})();
