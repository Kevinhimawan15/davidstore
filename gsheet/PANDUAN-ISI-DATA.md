# Panduan mengisi data di Google Sheet — DavidStore

Untuk David dan Kevin. Tidak perlu bisa coding. Semua katalog toko (produk, brand, kategori) dan daftar distributor **diisi langsung di Google Sheet**. Tidak ada lagi data contoh di aplikasi: sheet kosong = toko menampilkan "Katalog sedang disiapkan".

Semua nilai di tabel di bawah bertanda **CONTOH FORMAT** hanya untuk menunjukkan cara menulis. Itu bukan produk, brand, atau harga sungguhan. Jangan disalin apa adanya.

## Urutan mengisi (penting)

1. `categories` (kategori) lebih dulu
2. `brands` (merek)
3. `distributors` (pemasok)
4. `products` (produk), paling akhir, karena merujuk ke kategori dan brand

Alasannya: kolom `category` dan `brand_id` di `products` harus sama persis dengan `id` di `categories` dan `brands`. Kalau tidak sama, produknya **tidak tampil di toko** dan Dashboard > Katalog menandainya "data belum lengkap: ...".

## Aturan umum

- Baris 1 adalah judul kolom. **Jangan diubah, dipindah, atau dihapus.**
- Satu baris = satu data. Jangan ada baris kosong di tengah.
- `id` ditulis huruf kecil, tanpa spasi, pakai tanda hubung. Contoh format: `merk-contoh`. `id` jangan diganti setelah dipakai.
- `visible` dan `is_active`: tulis `TRUE` atau `FALSE`. **Kosong dianggap TRUE** (tampil). Ketik `FALSE` untuk menyembunyikan.
- Kolom `updated_at` terisi sendiri. Jangan diisi.
- Perubahan tampil di toko dalam sekitar 1 menit (toko menyimpan salinan singkat). Di Dashboard: klik **Tarik ulang** di Pengaturan atau tunggu tarik otomatis (sekitar 45 detik).
- Tab `orders`, `purchase_orders`, `order_items`, `po_items`: **jangan diedit**. Itu pesanan; kebenarannya ada di Dashboard.

## Tab `categories`

| Kolom | Wajib? | Isi | CONTOH FORMAT |
|---|---|---|---|
| `id` | wajib | huruf kecil, tanpa spasi | `blade`, `karet`, `bola` |
| `name` | wajib | nama yang tampil di toko | `Blade` |
| `prefix` | opsional | singkatan untuk SKU | `BL` |
| `sort` | opsional | angka urutan tampil (kecil dulu) | `1` |

**Dua id khusus:** `blade` dan `karet` dipakai fitur **Rakit Bet** di toko. Pakai persis id itu untuk kategori blade dan karet. Kategori lain bebas.

## Tab `brands`

| Kolom | Wajib? | Isi | CONTOH FORMAT |
|---|---|---|---|
| `id` | wajib | huruf kecil, tanpa spasi | `merk-contoh` |
| `name` | wajib | nama brand yang tampil | `Merk Contoh` |
| `visible` | opsional | `TRUE` tampil, `FALSE` brand dan semua produknya disembunyikan dari toko | `TRUE` |
| `distributor_id` | opsional | id dari tab `distributors` (hanya untuk Dashboard, tidak pernah dikirim ke publik) | `daya-prima` |
| `sort` | opsional | urutan | `1` |

## Tab `distributors`

Sudah berisi 5 nama (Daya Prima, Donic, Andro, Stiga, Sinar Surya) setelah `resetMasterTabs` dijalankan. Kolom `wa` masih kosong dan tampil **[?]** di Dashboard sampai diisi.

| Kolom | Wajib? | Isi | CONTOH FORMAT |
|---|---|---|---|
| `id` | wajib | huruf kecil, tanpa spasi | `daya-prima` |
| `name` | wajib | nama distributor | `Daya Prima` |
| `wa` | opsional (isi sebelum kirim PO) | nomor WhatsApp, diawali 62, tanpa spasi atau tanda | `6281234567890` (CONTOH FORMAT) |
| `note` | opsional | catatan internal | `bayar H+7` (CONTOH FORMAT) |

Tab ini **tidak pernah** dikirim ke pengunjung toko.

## Tab `products`

| Kolom | Wajib? | Isi | CONTOH FORMAT |
|---|---|---|---|
| `sku` | **wajib**, tidak boleh kembar | kode unik produk | `BL-001` |
| `name` | **wajib** | nama produk | `Nama Produk Contoh` |
| `category` | **wajib** | harus sama dengan `id` di tab `categories` | `blade` |
| `brand_id` | **wajib** | harus sama dengan `id` di tab `brands` | `merk-contoh` |
| `price` | **wajib** | harga estimasi, rupiah utuh. **Harga jual ke customer — sudah termasuk untung/margin David**, bukan harga modal/distributor. Boleh `1.250.000`, `1250000`, atau `Rp 1.250.000`. Tidak boleh kosong, nol, atau teks seperti "dua juta" | `1.250.000` |
| `slug` | opsional | alamat halaman. Kosong = dibuat otomatis dari brand + nama | `merk-contoh-nama-produk-contoh` |
| `price_to` | opsional | batas atas kisaran harga (angka) | `1.500.000` |
| `price_from` | opsional | `TRUE` = toko menulis "mulai ..." | `FALSE` |
| `price_status` | opsional | `S` ada sumber, `L` sumber lemah, `P` perkiraan kasar (toko menulis "perkiraan kasar") | `S` |
| `speed` | opsional (blade) | `OFF`, `ALL`, atau `DEF`; dipakai filter | `OFF` |
| `type` | opsional (karet) | `Inverted` atau `Anti-spin`; dipakai filter | `Inverted` |
| `note` | opsional | deskripsi singkat yang tampil di halaman produk | `catatan contoh` |
| `handles` | **wajib untuk kategori `blade`** | pilihan handle, dipisah koma | `FL, ST` |
| `thicknesses` | **wajib untuk kategori `karet`** | pilihan ketebalan sponge, dipisah koma | `1.8, 2.0, Max` |
| `colors` | **wajib untuk kategori `karet`** | pilihan warna, dipisah koma. Nama yang dikenal: Hitam, Merah, Biru, Hijau, Pink, Ungu | `Hitam, Merah` |
| `isi` | opsional (bola) | isi per pak, dipisah koma | `3, 6, 12` |
| `sizes` | opsional (sepatu) | ukuran, dipisah koma | `40, 41, 42` |
| `widths` | opsional (edge tape) | lebar mm, dipisah koma | `10, 12` |
| `spec` | opsional | spesifikasi: `Judul: isi; Judul: isi` | `Berat: 85 g; Kelas: OFF` |
| `image` | opsional | alamat gambar, lihat bagian foto | `https://contoh.invalid/foto.jpg` |
| `is_active` | opsional | `FALSE` = produk disembunyikan dari toko | `TRUE` |

Kolom `ref` boleh dibiarkan kosong (catatan internal; tidak dikirim ke publik).

Kenapa `handles`, `thicknesses`, `colors` wajib: aplikasi **tidak mengarang** pilihan varian. Pilihan yang muncul di toko dan di Rakit Bet persis yang Anda tulis. Kalau kosong untuk blade/karet, produknya ditandai belum lengkap.

## Foto produk (kolom `image`)

- Yang **didukung dan teruji**: alamat gambar langsung berawalan `https://` yang bisa dibuka siapa pun tanpa login dan berujung gambar (mis. `.jpg`, `.png`, `.webp`). Kalau gambar gagal dimuat, toko menampilkan "Foto segera" (tidak error).
- **Google Drive: belum didukung dan belum diuji.** Tautan berbagi Drive (`drive.google.com/file/d/.../view`) adalah halaman, bukan gambar, jadi tidak akan tampil. Jangan dipakai sampai ada dukungannya.
- Kosongkan kolom bila belum ada foto.
- Kalau memakai foto dari internet: pastikan Anda berhak memakainya (foto produk brand biasanya berhak cipta).

## Cek hasil

1. Buka Dashboard > **Katalog**. Baris yang salah tampil di bagian atas dengan keterangan **"data belum lengkap: price, brand_id"** (nama kolom yang bermasalah). Perbaiki barisnya di sheet, lalu Tarik ulang.
2. Buka toko. Produk yang lengkap dan `is_active` TRUE tampil. Produk yang tidak tampil: lihat langkah 1.
3. Dashboard > **Brand**: sakelar tampil/sembunyi per brand (juga mengubah kolom `visible`).

## Tab `settings` (opsional, untuk Dashboard dan toko)

Dua kolom: `id` dan `value`. Beberapa `id` yang dipakai:

| `id` | Isi | Catatan |
|---|---|---|
| `assembly_fee` | biaya rakit bet (angka) | Kosong atau tidak ada = toko menulis **[?] dikonfirmasi David**. `0` = gratis |
| `bank_name`, `bank_no`, `bank_holder` | rekening transfer | Dibaca customer hanya setelah harga final dikirim |
| `david_wa`, `address`, `pay_hours` | WA David, alamat, batas jam bayar | |
| `margin.<kategori>` | margin default (%) | untuk Dashboard |

Catatan: toko publik (tanpa token) **tidak** membaca tab `settings`. Biaya rakit baru tampil di toko publik bila nanti ditambahkan ke daftar yang dibuka (belum). Untuk saat ini toko publik menulis "[?] dikonfirmasi David" untuk biaya rakit dan server memakai nilai `assembly_fee` saat menghitung estimasi pesanan rakitan.
