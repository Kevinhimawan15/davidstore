# Kontrak data prototipe — DavidStore

Prototipe HTML statis, tanpa backend. Dua halaman berbagi data lewat `localStorage`, supaya demo end-to-end bisa dicoba:
order dibuat di `marketplace/index.html` → muncul di `dashboard/index.html` → status yang diubah David terlihat di halaman "Lacak Pesanan" marketplace.

> Catatan: `localStorage` hanya berbagi bila keduanya dibuka dari origin yang sama. Jalankan dengan
> `cd prototype && python3 -m http.server 8080` lalu buka `http://localhost:8080/marketplace/` dan `/dashboard/`.

## Berkas bersama

- `prototype/shared/config.js` — `window.DS_PUBLIC = { catalogUrl }`. URL Web App Apps Script **publik** (bukan rahasia; tanpa token hanya bisa baca katalog publik, membuat/melacak pesanan). Dimuat sebelum `catalog.js`.
- `prototype/shared/catalog.js` — **struktur kosong** `window.DS_CATALOG = { brands:[], categories:[], distributors:[], products:[], incomplete:[], colors, assembly_fee:null }`. **Tidak ada produk/brand/kategori/distributor contoh** (aturan keras repo #1). Isinya diisi `sync.js` dari Google Sheet. Sheet kosong = katalog kosong.
- `prototype/shared/store.js` — helper `DS.getOrders()`, `DS.saveOrders(arr)`, `DS.updateOrder(id, patch)`, `DS.formatRupiah(n)`, `DS.newOrderId()`, plus brand (lihat bawah). **Satu-satunya jalur tulis** ke key di bawah (INF-01): app tidak boleh menulis `localStorage` sendiri, supaya sinkron ke sheet tidak terlewat.
- `prototype/shared/sync.js` — INF-01. Sinkron ke Google Sheet lewat `prototype/gsheet/Code.gs`. Urutan skrip wajib: `config.js` → `catalog.js` → `store.js` → `sync.js` → (`logic.js`) → `app.js`. Rancangan: ADR-003.

## Key localStorage

| Key | Isi |
|---|---|
| `ds_orders_v1` | `Order[]` (JSON) |
| `ds_pos_v1` | `PurchaseOrder[]` (JSON) |
| `ds_settings_v1` | pengaturan dashboard (margin, alamat, rekening, override WA distributor) |
| `ds_brands_v1` | `[{id, name, visible}]`. Brand yang tidak ada di array = `visible: true`. Berlaku juga di mode lokal |
| `ds_config_v1` | `{url, token}` Apps Script. Ada = mode sheet; kosong = mode lokal |
| `ds_sync_v1` | `{queue:[{tab,id,v}], base, sig, last_pull_at, last_sync, last_error}` — internal sync.js |
| `ds_catalog_v1` | cache `DS_CATALOG` hasil tarik sheet (mode sheet) |
| `ds_catalog_pub_v1` | cache katalog publik (`op=catalog`, tanpa token) |
| `ds_local_dropped_v1` | cadangan order/PO lokal yang tidak ikut ke sheet saat pindah ke mode sheet |

Semua akses dibungkus `try/catch`; kalau storage tidak tersedia, halaman tetap jalan dengan data seed di memori.

## Sumber katalog (tanpa data contoh)

1. **Mode sheet ber-token** (`ds_config_v1`): semua tab master dari sheet (`pull`). Dashboard menulis brand/pengaturan balik.
2. **Tanpa token tapi `DS_PUBLIC.catalogUrl` ada**: `GET ?op=catalog`, **hanya baca**, tidak ada tulis master. Hanya `categories`, `brands` (visible), `products` (is_active). Cache lokal `ds_catalog_pub_v1` dipakai bila jaringan gagal.
3. **Tidak ada keduanya**: katalog kosong.

Baris `products` dinilai di `buildCatalog`. Tidak layak (kolom kurang/salah) → TIDAK masuk `products`, dicatat di `DS_CATALOG.incomplete = [{sku, name, missing:[kolom]}]` (Dashboard Katalog menampilkan "data belum lengkap: <kolom>"). Aturan: `sku` wajib dan unik; `name`; `price` angka rupiah > 0 (`1.250.000`, `Rp 1.250.000`; "abc"/kosong/0 ditolak); `brand_id` harus ada di `brands`; `category` harus ada di `categories`; kategori `blade` butuh `handles`; `karet` butuh `thicknesses` dan `colors`. `slug` kosong = dibuat dari brand + nama. Pilihan varian hanya dari kolom sheet (tanpa nilai bawaan). `assembly_fee` dari `settings` (kosong = `null` = "[?] dikonfirmasi David").

## Jalur pesanan publik (tanpa token)

```
DS.pub.enabled()                       -> bool (DS_PUBLIC.catalogUrl ada)
DS.pub.createOrder(payload)            -> Promise<{ok, id, wa, order}|{ok:false, error, message, network?}>   (POST order_create)
DS.pub.track(id, wa)                   -> Promise<{ok, order}|{ok:false,...}>                                  (GET order_track)
DS.pub.action(id, wa, action, extra)   -> Promise<{ok, order}|...>   action: item_decision{line_id,decision} | cancel | payment_proof{proof_name,amount}
```
Kegagalan jaringan mengembalikan `{ok:false, network:true}`; **tidak pernah** menyimpan pesanan lokal diam-diam. `payload.client_ref` dipakai ulang saat "Coba lagi" supaya server tidak menggandakan pesanan. Server membuat ID, status, riwayat; harga diambil ulang dari tab `products`. Versi customer (`order`) tidak memuat cost_price, margin, distributor_id, PO, catatan internal. Bukti bayar: hanya `proof_name` + `amount`; file tidak diunggah.

## Tambahan rilis 1 (ringkas)

- `DS.pub.track(id, wa, k)` dan `DS.pub.action(id, wa, k, action, extra)`: `k` = `track_key` (32 hex) dari server; tanpa itu Lacak dan aksi ditolak. `createOrder` mengembalikan `track_key`. Tautan Lacak: `#/lacak?id=&wa=&k=`.
- `payment_proof` menerima `file_b64` (JPEG/PNG ≤ 1 MB setelah dikecilkan, PDF ≤ 5 MB), disimpan di Google Drive pribadi; json pesanan menyimpan `payment.proof_file_id/proof_mime/proof_name/amount/uploaded_at`. Admin: `DS.sync.proofGet(orderId)` (POST, token di badan).
- Op admin (`ping`, `pull`, `upsert`, `setup`, `proof_get`, `track_key_ensure`) hanya POST.
- `DS_CATALOG.store = {address, wa, hours}` dari `op=catalog` (kunci settings publik: `assembly_fee`, `address`, `david_wa`, `store_hours`). Kosong = baris disembunyikan di toko.
- Sinkron: kirim (`flush`) dan tarik (`pull`) diserialkan (`exclusive`) supaya data sheet lama tidak menimpa perubahan lokal. `A.restorePo(poId)` memulihkan PO yang terbatal otomatis; `L.inconsistency(order, pos)` mendeteksi pesanan Lunas tanpa PO aktif.

## API INF-01 (store.js + sync.js)

```
DS.getBrands()                -> [{id, name, visible}]  (DS_CATALOG.brands + ds_brands_v1)
DS.setBrandVisible(id, bool)  -> simpan ds_brands_v1 (+ antrian sync). id boleh id atau nama brand
DS.isBrandVisible(nameOrId)   -> bool; tidak dikenal = true
DS.getCatalog({publicOnly})   -> DS_CATALOG; publicOnly membuang produk is_active=false dan brand tersembunyi
DS.getDistributors()          -> dari DS_CATALOG.distributors (tab distributors); kosong = []
DS.clearLocal()               -> hapus pesanan/PO yang tersimpan di browser ini (mode lokal saja; bukan "reset demo")
DS.ready(cb)                  -> cb dipanggil setelah pull awal selesai/gagal/timeout 10 dtk (langsung bila tanpa sumber)
DS.syncStatus()               -> {mode:'local'|'sheet', state, pending, lastSync, error, catalog:'sheet'|'public'|'none', catalogError}
DS.sync.renderSettings(el)    -> UI Pengaturan sumber data
DS.sync.badgeHtml()           -> HTML badge status (pasang ulang saat 'ds:sync')
DS.sync.now({silent}) / pull() / pullPublic() / flush() / testConnection(cfg?) / setupSheet() / saveConfig({url,token}) / disconnect()
Event window: 'ds:sync' (detail=syncStatus) · 'ds:data' {changed:[tab]} (data ditarik ulang: render ulang)
              'ds:stale' {tab,id,kind:'stale'|'invalid',message} (perubahan ditolak; tampilkan toast)
              'ds:idremap' {from,to} (id order/PO lokal diganti server karena bentrok)
```

- Dashboard (mode sheet) menarik otomatis tiap 45 dtk saat tab terlihat (`now({silent:true})`: tanpa perubahan tidak memicu render ulang), supaya pesanan baru dari toko publik muncul.
- `updated_at` ada di `Order` dan `PurchaseOrder`. Mode lokal: diisi `isoWIB()` saat record berubah. Mode sheet: dicap server (milidetik, WIB); klien tidak mengubahnya. Cek versi: perubahan yang dasar versinya sudah usang ditolak (`stale`), versi sheet dimuat.
- **Tidak ada lagi seed/demo**: `seedIfEmpty`, `resetDemo`, `buildDemoData`, `seedSalesSamples` dihapus. Tombol sheet "Siapkan tab sheet" (`op:'setup'`) hanya membuat tab + header.
- Pesanan lama tetap terbaca meski produknya sudah tidak ada di katalog (pesanan menyimpan salinan nama/harga). Di toko, baris keranjang yang produknya tidak ada lagi ditandai "Tidak lagi dijual" dan checkout diblokir.
- Uang selalu integer (di sheet: teks `2815000`; `2.815.000` ketikan David dibaca benar).

## Skema

```js
Order = {
  id: "DS-20261108-0001",          // DS-yyyymmdd-xxxx
  created_at: "2026-11-08T10:15:00+07:00",
  status: "placed",                // order_status
  customer: { name, wa, address, city, note },
  items: [OrderItem],
  shipping_fee: null,              // diisi David saat quoted
  pay_deadline: null,              // ISO, saat quoted (+24 jam)
  payment: { status: "none" },     // none | pending_verification | verified | rejected ; proof_name?
  shipment: null,                  // { courier, resi }
  history: [{ at, status, by, note }]
}

OrderItem = {
  line_id: "L1",
  kind: "product" | "rakitan",
  sku, brand, name, variant,       // variant: "2.0mm · Merah" / "FL"
  qty: 1,
  est_price: 1250000,              // harga katalog (estimasi), integer rupiah
  cost_price: null,                // harga modal dari balasan distributor (khusus Dashboard)
  margin_type: null,               // 'pct' | 'rp' — margin ditentukan David per item (K4)
  margin_value: null,
  final_price: null,               // harga jual = modal + margin, dibulatkan ke atas Rp1.000
  item_status: "pending",          // item_status
  distributor_id: null,
  components: null                 // untuk rakitan: { blade:{sku,name}, fh:{sku,name,thickness,color}, bh:{...}, assembly_fee }
}

PurchaseOrder = {
  id: "PO-20261108-0001",
  updated_at: "...",               // Order juga punya updated_at (lihat API INF-01)
  order_id, distributor_id,
  status: "draft",                 // po_status
  items: [{ line_id, sku, name, variant, qty, cost_price: null, available: null, eta: null, received_qty: 0 }],
  created_at, sent_at, responded_at
}
```

## Enum (dari `docs/PRD.md` §8 — jangan diubah)

- `order_status`: placed · sourcing · quoted · paid · fulfilling · received · shipped · completed · cancelled · expired
- `po_status`: draft · sent · responded · rejected · confirmed · fulfilled · cancelled
- `item_status`: pending · available · unavailable · alternative_offered · accepted · declined · received · shipped · cancelled

Label Bahasa Indonesia untuk tiap status: pakai tabel di `docs/PRD.md` §8 dan warna di `docs/DESIGN.md`.

## Distributor

Dari tab `distributors` di sheet. Setelah `resetMasterTabs` (sekali): 5 baris nama (`daya-prima` Daya Prima · `donic` Donic · `andro` Andro · `stiga` Stiga · `sinar-surya` Sinar Surya; nama dari Kevin), kolom `wa` **kosong** (tampil "[?]" di Dashboard sampai David mengisi). Pemetaan brand → distributor belum diketahui (PRD Q-F); David memilih distributor manual saat membuat PO.
