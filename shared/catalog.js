/* DavidStore prototipe — katalog KOSONG (struktur saja).
   Tidak ada produk, brand, kategori, atau distributor di berkas ini. Isinya datang dari Google Sheet
   (tab products/brands/categories/distributors) lewat sync.js; lihat prototype/gsheet/PANDUAN-ISI-DATA.md.
   Sheet kosong = katalog kosong, bukan data contoh. Aturan keras repo #1: jangan mengarang data produk/harga. */
(function () {
  // Konstanta tampilan (bukan data produk): nama warna karet -> kunci token CSS --swatch-*
  var COLORS = { Hitam: 'black', Merah: 'red', Biru: 'blue', Hijau: 'green', Pink: 'pink', Ungu: 'purple' };

  window.DS_IMAGES = {};
  window.DS_CATALOG = {
    sample: false,
    brands: [],
    categories: [],
    distributors: [],
    colors: COLORS,
    store: { address: '', wa: '', hours: '' }, // dari settings (address, david_wa, store_hours); kosong = disembunyikan di toko
    assembly_fee: null, // dari tab settings (id assembly_fee); null = "[?] dikonfirmasi David"
    products: [],
    incomplete: []      // baris products yang ditolak (data belum lengkap): [{sku, name, missing:[kolom]}]
  };
})();
