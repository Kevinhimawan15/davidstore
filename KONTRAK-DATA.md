# Kontrak data prototipe — DavidStore

Prototipe HTML statis, tanpa backend. Dua halaman berbagi data lewat `localStorage`, supaya demo end-to-end bisa dicoba:
order dibuat di `marketplace/index.html` → muncul di `dashboard/index.html` → status yang diubah David terlihat di halaman "Lacak Pesanan" marketplace.

> Catatan: `localStorage` hanya berbagi bila keduanya dibuka dari origin yang sama. Jalankan dengan
> `cd prototype && python3 -m http.server 8080` lalu buka `http://localhost:8080/marketplace/` dan `/dashboard/`.

## Berkas bersama

- `prototype/shared/catalog.js` — **ditulis dev marketplace**. Mendefinisikan `window.DS_CATALOG = { brands, categories, distributors, products }`. Produk diambil dari `docs/RISET-PRODUK.md` (bukan dikarang). Dashboard boleh membacanya; kalau belum ada, dashboard memakai data dari order saja.
- `prototype/shared/store.js` — helper `DS.getOrders()`, `DS.saveOrders(arr)`, `DS.updateOrder(id, patch)`, `DS.formatRupiah(n)`, `DS.newOrderId()`, plus brand (lihat bawah). **Satu-satunya jalur tulis** ke key di bawah (INF-01): app tidak boleh menulis `localStorage` sendiri, supaya sinkron ke sheet tidak terlewat.
- `prototype/shared/sync.js` — INF-01. Sinkron ke Google Sheet lewat `prototype/gsheet/Code.gs`. Urutan skrip wajib: `catalog.js` → `store.js` → `sync.js` → (`logic.js`) → `app.js`. Rancangan: ADR-003.

## Key localStorage

| Key | Isi |
|---|---|
| `ds_orders_v1` | `Order[]` (JSON) |
| `ds_pos_v1` | `PurchaseOrder[]` (JSON) |
| `ds_settings_v1` | pengaturan dashboard (margin, alamat, rekening, override WA distributor) |
| `ds_brands_v1` | `[{id, name, visible}]`. Brand yang tidak ada di array = `visible: true`. Berlaku juga di mode lokal |
| `ds_config_v1` | `{url, token}` Apps Script. Ada = mode sheet; kosong = mode lokal |
| `ds_sync_v1` | `{queue:[{tab,id,v}], base, sig, last_pull_at, last_sync, last_error}` — internal sync.js |
| `ds_catalog_v1` | cache `DS_CATALOG` hasil tarik sheet (mode sheet saja) |
| `ds_local_dropped_v1` | cadangan order/PO lokal yang tidak ikut ke sheet saat pindah ke mode sheet |

Semua akses dibungkus `try/catch`; kalau storage tidak tersedia, halaman tetap jalan dengan data seed di memori.

## API INF-01 (store.js + sync.js)

```
DS.getBrands()                -> [{id, name, visible}]  (DS_CATALOG.brands + ds_brands_v1)
DS.setBrandVisible(id, bool)  -> simpan ds_brands_v1 (+ antrian sync). id boleh id atau nama brand
DS.isBrandVisible(nameOrId)   -> bool; tidak dikenal = true
DS.getCatalog({publicOnly})   -> DS_CATALOG; publicOnly membuang produk is_active=false dan brand tersembunyi
DS.ready(cb)                  -> cb dipanggil setelah pull awal selesai/gagal/timeout 10 dtk (langsung bila mode lokal)
DS.syncStatus()               -> {mode:'local'|'sheet', state:'idle'|'syncing'|'error'|'offline', pending, lastSync, error}
DS.sync.renderSettings(el)    -> UI Pengaturan sumber data
DS.sync.badgeHtml()           -> HTML badge status (pasang ulang saat 'ds:sync')
DS.sync.now() / pull() / flush() / testConnection(cfg?) / seedSheet() / saveConfig({url,token}) / disconnect()
Event window: 'ds:sync' (detail=syncStatus) · 'ds:data' {changed:[tab]} (data ditarik ulang: render ulang)
              'ds:stale' {tab,id,kind:'stale'|'invalid',message} (perubahan ditolak; tampilkan toast)
              'ds:idremap' {from,to} (id order/PO lokal diganti server karena bentrok)
```

- `updated_at` ada di `Order` dan `PurchaseOrder`. Mode lokal: diisi `isoWIB()` saat record berubah. Mode sheet: dicap server (milidetik, WIB); klien tidak mengubahnya. Cek versi: perubahan yang dasar versinya sudah usang ditolak (`stale`), versi sheet dimuat.
- Mode sheet: `seedIfEmpty()` dan `resetDemo()` tidak melakukan apa pun (return false). Produk di `DS_CATALOG` bisa punya `is_active:false` dan `image` (URL atau path relatif); pakai `DS.getCatalog({publicOnly:true})` untuk tampilan customer.
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

## Distributor (id tetap)

`daya-prima` Daya Prima · `donic` Donic · `andro` Andro · `stiga` Stiga · `sinar-surya` Sinar Surya
Nomor WA distributor di prototipe = placeholder `628000000000x`. Pemetaan brand → distributor belum diketahui (PRD Q-F); di prototipe David memilih distributor manual.
