# Menyambungkan prototipe ke Google Sheet (INF-01)

Sekali saja, sekitar 10 menit. **Hanya data CONTOH**: siapa pun yang punya URL + token bisa membaca dan menulis seluruh sheet.

1. Buka sheet yang sudah disiapkan: https://docs.google.com/spreadsheets/d/1l9mTF9C15Fym5i2E1OcO1eS4bhRI2bgwSxYbrS2Amd0/edit (masih kosong; tab dibuat otomatis, tidak perlu membuat tab manual). Bagikan hanya ke David.
2. Menu **Extensions > Apps Script**. Hapus isi `Code.gs`, tempel seluruh isi `prototype/gsheet/Code.gs`. Simpan (ikon disket).
3. Ikon roda (**Project Settings**) > **Script Properties** > **Add script property**: nama `DS_TOKEN`, nilai = kata acak panjang. Catat di tempat pribadi, jangan di chat atau repo. Simpan.
4. **Deploy > New deployment** > ikon roda > **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy, izinkan akses (Advanced > Go to project), lalu salin URL yang berakhiran **/exec**.
5. Jalankan prototipe: `cd prototype && python3 -m http.server 8080`, buka `http://localhost:8080/dashboard/#/pengaturan`. Isi URL + token, klik **Tes koneksi** (harus "Terhubung ... 0 produk, 0 order"), lalu **Simpan dan hubungkan**.
6. Klik **Isi sheet dengan data contoh**. Tab `settings`, `brands`, `categories`, `distributors`, `products`, `orders`, `purchase_orders`, `order_items`, `po_items` terbuat sendiri dan terisi (49 produk, 9 order). Tombol ini ditolak bila sheet sudah berisi, jadi tidak bisa menimpa.
7. Buka `http://localhost:8080/marketplace/`: badge harus "Sumber data: Google Sheet".

## Yang boleh disunting di sheet
- Tab `products`, `brands` (kolom `visible`: FALSE menyembunyikan brand), `categories`, `distributors`, `settings`: boleh diedit langsung (harga boleh `2.815.000`). Tampil di aplikasi setelah halaman kembali difokuskan atau tombol **Tarik ulang**.
- Produk baru: isi baris baru di `products`; `brand_id` harus sama dengan `id` di tab `brands`.
- Foto produk: kolom `image` berisi URL https atau path seperti `assets/products/BL-01.jpg`.
- Tab `orders`, `purchase_orders`, `order_items`, `po_items`: **jangan diedit**. Kolom ringkasan diturunkan dari kolom `json` dan ditimpa saat disimpan; kebenarannya di Dashboard.

## Setiap kali `Code.gs` diubah
Tempel ulang, lalu **Deploy > Manage deployments > pensil > Version: New version > Deploy**. Tanpa ini URL /exec tetap menjalankan kode lama. URL tidak berubah.

## Bila URL atau token bocor
Buat deployment baru (URL berubah) dan ganti `DS_TOKEN`.

## Batas yang perlu diketahui
- Satu order = satu unit konflik. Bila dua perangkat mengubah order yang sama, yang kedua ditolak (muncul pesan) dan versi sheet dimuat.
- Order/PO yang dibuat di mode lokal tidak dipindah ke sheet; salinannya disimpan di browser (key `ds_local_dropped_v1`).
- Sinkron ini hanya untuk prototipe; app sungguhan memakai Supabase.

## Catatan risiko: token di query string GET
Apps Script `doGet` tidak bisa membaca header, jadi tarik data dan Tes koneksi mengirim token lewat query (`?op=...&token=...`). Akibatnya token bisa tercatat di log Google, riwayat browser, dan proxy/log jaringan mana pun yang melihat URL. Penulisan (POST) membawa token di badan, bukan di URL. Batasan yang dipakai: hanya data CONTOH, URL hanya `https://script.google.com/...` (skema lain ditolak di aplikasi), dan token diganti bila dicurigai bocor (lihat bagian di atas). Jangan pakai untuk data nyata; app sungguhan memakai Supabase dengan autentikasi di header.
