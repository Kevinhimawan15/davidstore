# Menyambungkan prototipe ke Google Sheet (INF-01)

Sheet ini adalah **sumber katalog** (produk, brand, kategori, distributor) dan **tempat pesanan masuk**. Tidak ada data contoh di aplikasi. Cara mengisi data: `PANDUAN-ISI-DATA.md`.

Ada dua jenis akses ke Web App yang sama:
- **Tanpa token (publik, dipakai toko di github.io):** membaca katalog publik (`?op=catalog`), membuat pesanan baru, melacak pesanan (nomor pesanan + WhatsApp harus cocok), dan aksi customer yang sah (terima/tolak barang, batal sebelum bayar, kirim nama berkas bukti bayar). Semua divalidasi server; harga selalu diambil ulang dari tab `products`. URL ini bukan rahasia.
- **Dengan token (admin: Dashboard Kevin/David):** baca dan tulis seluruh sheet. Token = rahasia.

## Pemasangan pertama (sekali, sekitar 10 menit)

1. Buka sheet: https://docs.google.com/spreadsheets/d/1l9mTF9C15Fym5i2E1OcO1eS4bhRI2bgwSxYbrS2Amd0/edit . Bagikan hanya ke David.
2. **Extensions > Apps Script**. Hapus isi `Code.gs`, tempel seluruh isi `prototype/gsheet/Code.gs`. Simpan (ikon disket).
3. Roda (**Project Settings**) > **Script Properties** > **Add script property**: nama `DS_TOKEN`, nilai = kata acak **minimal 32 karakter**. Catat di tempat pribadi, jangan di chat atau repo. (Pengaturan Dashboard memberi peringatan bila token lebih pendek.)
4. **Deploy > New deployment** > roda > **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy, izinkan akses, salin URL berakhiran **/exec**.
5. Dashboard: `cd prototype && python3 -m http.server 8080`, buka `http://localhost:8080/dashboard/#/pengaturan`. Isi URL + token, **Tes koneksi**, lalu **Simpan dan hubungkan**.
6. Klik **Siapkan tab sheet** (membuat tab + judul kolom saja; tidak menulis data, tidak menimpa apa pun).

## Memperbarui deployment yang sudah ada (URL TETAP SAMA)

Dipakai setiap kali `Code.gs` di repo berubah, termasuk untuk pembaruan ini (jalur publik katalog dan pesanan **baru jalan setelah langkah ini**):

1. Apps Script > hapus isi `Code.gs`, tempel seluruh isi `prototype/gsheet/Code.gs`, simpan.
2. **Deploy > Manage deployments** > ikon pensil pada deployment yang aktif > **Version: New version** > **Deploy**.
3. URL `/exec` **tidak berubah**. (Tanpa langkah ini URL tetap menjalankan kode lama.)
   - **Izin baru:** versi ini memakai **Google Drive** (menyimpan foto bukti transfer di folder pribadi "DStore — Bukti Transfer") dan **Email** (satu peringatan per hari ke pemilik script bila batas pesanan tercapai). Saat Deploy, Google meminta **Authorize** lagi: klik Review permissions > pilih akun Anda > Advanced > Go to project > Allow. Tanpa ini unggah bukti dan email peringatan gagal.
4. **Sekali saja**, untuk membuang data contoh lama dari tab master: pilih fungsi `resetMasterTabs` di dropdown editor, klik **Run**, izinkan bila diminta. Hasilnya muncul di **Execution log**:
   - `brands`, `products`, `categories`: baris data dikosongkan (judul kolom tetap).
   - `distributors`: tersisa 5 nama (Daya Prima, Donic, Andro, Stiga, Sinar Surya), kolom `wa` kosong.
   - `settings`: baris `assembly_fee` ditandai "CONTOH" dari data awal dihapus (nilai yang David isi sendiri tidak disentuh).
   - Pesanan (`orders`, `purchase_orders`, `order_items`, `po_items`) **tidak disentuh**. Pesanan contoh lama masih ada di sana; hapus barisnya manual di sheet bila tidak diperlukan.
   - Fungsi menolak dijalankan kedua kali (supaya data asli David tidak terhapus tak sengaja). Untuk memaksa, hapus properti `DS_MASTER_RESET_DONE` di Script Properties.
5. Isi data asli di sheet (lihat `PANDUAN-ISI-DATA.md`), lalu Dashboard > Pengaturan > **Tarik ulang**.

## Yang boleh disunting di sheet
- Tab `products`, `brands`, `categories`, `distributors`, `settings`: boleh diedit langsung (harga boleh `2.815.000`).
- Tab `orders`, `purchase_orders`, `order_items`, `po_items`: **jangan diedit**. Kolom ringkasan diturunkan dari kolom `json` dan ditimpa saat disimpan; kebenarannya di Dashboard.

## Bukti transfer (foto)
- Customer mengunggah foto (dikecilkan otomatis di browser, maks. sisi 1600 px, JPEG) atau PDF (maks. 5 MB) dari halaman Lacak. Server memeriksa **isi berkas** (JPEG/PNG/PDF, bukan label dari klien), batas 1 MB untuk foto, maks. **3 unggahan per pesanan** (yang baru menggantikan; semua tercatat di riwayat).
- Berkas disimpan di Google Drive milik pemasang script, folder **"DStore — Bukti Transfer"**, nama `<nomor pesanan>-<waktu>.<jpg|png|pdf>`, **privat** (tidak pernah dibagikan). Hanya Dashboard ber-token yang bisa membukanya (`proof_get`); tidak ada jalur publik.
- Dashboard menampilkan fotonya langsung di kartu "Bukti transfer" (gambar `data:` dari server, PDF hanya diunduh; tidak ada iframe/blob), dengan perbandingan Nominal diklaim vs Total tagihan.

## Foto serah terima (ADM-24)
- Pesanan **Dikirim** tidak selesai sendiri. Di Dashboard, David klik **Selesaikan pesanan**, wajib unggah foto (JPG/PNG/PDF; foto dikecilkan otomatis, maks. 1 MB; PDF maks. 5 MB), boleh isi nama penerima (maks. 80) dan catatan (maks. 200).
- Server (`delivery_proof_upload`, hanya ber-token) memeriksa isi berkas, menyimpannya **privat** di folder Drive yang sama dengan bukti transfer ("DStore — Bukti Transfer"), nama `ST-<nomor pesanan>-<waktu>.<jpg|png|pdf>`, lalu **server sendiri** mengubah status ke Selesai. Simpan biasa dari Dashboard tidak bisa membuat status Selesai tanpa foto (ditolak `delivery_proof_required`).
- Dashboard menampilkan fotonya di kartu "Serah terima" (`delivery_proof_get`). Customer di halaman Lacak hanya melihat "Pesanan selesai — diterima <tanggal>"; foto, nama penerima, dan catatan tidak pernah keluar ke publik.
- **Memasang pembaruan ini:** Apps Script > ganti isi `Code.gs` dengan `prototype/gsheet/Code.gs` > simpan > **Deploy > Manage deployments** > ikon pensil > **Version: New version** > **Deploy**. URL `/exec` tetap. Izin Drive sudah ada dari versi sebelumnya, jadi biasanya tidak diminta lagi; bila diminta, klik **Authorize**. Tanpa langkah ini tombol Selesaikan di Dashboard yang terhubung ke Sheet ditolak server (`unknown_op`).

## Pemulihan PO terbatal (bug lama)
Bila pesanan Lunas/Diproses menampilkan peringatan merah "Data PO tidak konsisten" dan PO berstatus Dibatalkan, klik **Pulihkan PO** di detail pesanan. PO kembali ke Dibalas dan item terpilih dipulihkan dari Harga Distributor yang tercatat di pesanan. Akar masalah (tarikan dan kirim berjalan bersamaan sehingga data sheet lama menimpa perubahan lokal) sudah diperbaiki di `shared/sync.js`.

## Keamanan jalur publik
- Katalog publik hanya berisi: `categories`, `brands` (visible), `products` (is_active) dengan daftar kolom tetap. **Tidak pernah**: `distributors`, `settings`, `orders`, PO, `distributor_id`, kolom biaya/margin.
- Pesanan baru: ID, status, riwayat dibuat server; harga diambil ulang dari sheet (harga kiriman klien diabaikan); batas sekitar 30 pesanan per 10 menit untuk semua dan 3 per 10 menit per nomor WhatsApp (memakai CacheService; best-effort, bukan jaminan keras). Honeypot ikut ditolak.
- Lacak dan aksi customer butuh **tiga hal cocok sekaligus**: nomor pesanan + WhatsApp + **kunci Lacak (`track_key`)** acak 32 karakter yang dibuat server saat pesanan masuk dan hanya ada di tautan Lacak (halaman sukses, teks WA harga final). Salah satu salah menghasilkan jawaban yang sama ("tidak ditemukan"). Nomor pesanan + WhatsApp saja **tidak** cukup, jadi menebak nomor urut tidak berguna. Pesanan lama tanpa kunci: Dashboard membuatkannya otomatis saat Anda mengirim harga final. Penahanan percobaan gagal (10 per nomor per 10 menit) hanya menolak tebakan yang salah; pemilik dengan tautan benar selalu lolos.
- Nilai teks dari publik yang diawali `=`, `+`, `-`, `@`, tab, atau CR diberi awalan `'` sebelum masuk sheet supaya tidak pernah menjadi rumus Sheet.
- Pesan kesalahan teknis server tidak dikirim ke publik (hanya "terjadi gangguan"); detailnya ada di Executions Apps Script.
- Terima/tolak "harga final": tidak ada tombol terpisah. Persetujuan = kirim bukti bayar; customer dapat menolak barang per baris atau membatalkan pesanan sebelum bayar.

## Bila URL atau token bocor
Token bocor: ganti `DS_TOKEN`. URL admin tidak bisa dipisah dari URL publik (satu deployment). Bila perlu mencabut URL: buat deployment baru (URL berubah) dan perbarui `shared/config.js` serta Pengaturan Dashboard.

## Batas yang perlu diketahui
- Satu order = satu unit konflik. Bila dua perangkat mengubah order yang sama, yang kedua ditolak (muncul pesan) dan versi sheet dimuat.
- Order/PO yang dibuat di mode lokal (tanpa sheet) tidak dipindah ke sheet; salinannya disimpan di browser (key `ds_local_dropped_v1`).
- Dashboard menarik data otomatis tiap sekitar 45 detik saat tab terlihat, jadi pesanan baru dari toko muncul sendiri.
- Kuota Google Apps Script (jumlah panggilan harian) berlaku; katalog di-cache 60 detik di server dan di browser.
- Sinkron ini untuk prototipe; app sungguhan memakai Supabase.

## Token admin
Semua op admin lewat POST dengan token di badan (tidak di URL, tidak masuk log URL). Token disimpan di `localStorage` browser Dashboard pada origin yang sama dengan toko staging; jangan memasang situs lain di origin yang sama. Gunakan `DS_TOKEN` acak minimal 32 karakter dan ganti bila dicurigai bocor. Untuk data nyata skala besar, app sungguhan memakai Supabase dengan autentikasi di header.
