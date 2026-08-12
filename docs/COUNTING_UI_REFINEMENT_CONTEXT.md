# Context Pack: Konsistensi UI shadcn

Dokumen ini adalah sumber konteks untuk agent yang mengerjakan harmonisasi UI seluruh
aplikasi, dengan counting dan form Surat Jalan sebagai fokus utama. Baca `AGENTS.md` dan seluruh dokumen wajib yang disebutkan di sana sebelum
mengubah kode. Jika terdapat perbedaan antara dokumen ini dan aturan produk/backend,
aturan produk/backend tetap menjadi sumber kebenaran.

## Tujuan

Merapikan pengalaman Admin dan Operator agar konsisten dengan primitive, composition,
dan semantic token shadcn yang sudah diterapkan. Perubahan ini hanya
refinement visual dan komposisi. API, data flow, realtime, authorization, serta aturan
start/finish/cancel session tidak boleh berubah.

Hasil yang diinginkan:

- tampilan bersih, ringan, dan konsisten dengan halaman shadcn lain;
- counter tetap menjadi fokus utama dan mudah dibaca oleh petugas operasional;
- warning penting tetap terlihat tanpa membuat hampir seluruh kartu terasa berbahaya;
- layout desktop tetap efisien, sedangkan mobile tetap aman dan mudah dioperasikan;
- pengalaman Admin dan Operator tetap memakai `CountingConsole` yang sama.

## Diagnosis Tampilan Saat Ini

Masalah bukan konflik compiler antara Tailwind CSS dan shadcn. `CountingConsole` masih
membawa komposisi visual lama yang menimpa primitive dan token baru, antara lain:

- header dan panel SOP memakai `bg-foreground`, yang pada preset baru menjadi hampir
  hitam;
- blok actual dan tombol finish sama-sama memakai primary rose pekat;
- `shadow-lg`, ring primary, border merah, warning, dan destructive state muncul
  bersamaan sehingga hierarchy visual tidak jelas;
- SOP dibuat sebagai panel gelap khusus, bukan memakai pola `Alert` yang sudah
  diseragamkan;
- status COUNTING, variance, SOP, offline sensor, dan finish action bersaing menjadi
  pusat perhatian;
- terdapat separator encoding rusak `â€¢` pada metadata Surat Jalan dan Line.

Screenshot awal memperlihatkan kartu besar dengan header hitam, actual berwarna rose
solid, variance kuning, panel SOP hitam, alert sensor merah, dan tombol finish rose
solid. Kombinasi tersebut terlihat seperti dua design system yang bertumpuk. Dokumen
ini mendeskripsikan masalah itu secara lengkap dan tidak bergantung pada file screenshot
temporary.

## Keputusan Desain yang Sudah Dikunci

- Arah visual: **shadcn bersih**.
- Layout desktop: **2+1 kolom**.
  - Dua kolom utama untuk counter, variance, SOP, sensor warning, dan finish action.
  - Satu kolom samping untuk detail receiving dan log deteksi terbaru.
- Layout tablet/mobile: turun menjadi satu kolom tanpa horizontal overflow.
- Cakupan: seluruh alur counting, termasuk shared console, wrapper halaman Admin dan
  Operator, line selector, state loading/error/empty, serta dialog finish/cancel.
- Light mode adalah target QA resmi. Jangan memperluas pekerjaan menjadi dark-mode QA.
- Brand rose dipakai secara terbatas untuk identitas/aksi utama. Colored panel tidak
  dipakai untuk metric; warna hanya menjadi petunjuk ringan pada ikon, badge, dan swatch.
- `Alert` hanya memakai variant resmi `default` dan `destructive`. SOP serta informasi
  non-error memakai default dengan warna semantic hanya pada ikon.
- Chart memakai palette shadcn `--chart-1`, `--chart-2`, dan `--chart-3`, bukan token
  `metric-*`.

## Area Kode Utama

Area utama yang harus diaudit:

- `src/components/receiving/counting-console.tsx`
- `src/app/(admin)/admin/counting/page.tsx`
- `src/app/(operator)/active-session/page.tsx`
- `src/components/receiving/receiving-form-dialog.tsx`
- halaman dashboard, report, queue, sensor, settings, users, audit, master data,
  lines/devices, login, landing, dan simulator
- test UI terkait di `src/test/` jika guard regresi baru memang diperlukan

Gunakan, tetapi jangan tulis ulang atau mengganti base primitive berikut:

- `src/components/ui/card.tsx`
- `src/components/ui/alert.tsx` hanya untuk membatasi variant ke `default` dan `destructive`
- `src/components/ui/button.tsx`
- `src/components/ui/status-badge.tsx`
- `src/components/ui/states.tsx`

Tambahkan primitive `Collapsible` resmi melalui dependency Radix yang sudah tersedia.
Jangan mengubah preset atau global theme token; token `metric-*` boleh tetap didefinisikan
untuk kompatibilitas, tetapi tidak boleh menjadi palette chart.

## Spesifikasi Visual dan Komposisi

### 1. Wrapper halaman Admin dan Operator

- Gunakan Card atau komposisi shadcn netral untuk judul halaman dan line selector.
- Hilangkan styling lokal yang berlebihan atau bertentangan dengan primitive.
- Pertahankan judul, deskripsi operasional, role badge Admin, status Operator, dan
  kemampuan mengganti line.
- Line selector harus tetap controlled, berbasis `ToggleGroup`, dan mudah disentuh pada
  mobile.
- Loading, error, dan empty state tetap memakai komponen state yang sudah tersedia.

### 2. Header CountingConsole

- Gunakan permukaan card netral, bukan header hitam.
- Tampilkan ikon truk, nomor polisi, nomor Surat Jalan, line, dan badge COUNTING dengan
  hierarchy yang jelas.
- Badge COUNTING tetap memakai tone warning dan teks; animasi hanya boleh halus dan
  tidak menjadi distraksi utama.
- Aksi `Batal Sesi` hanya muncul untuk Admin dan memakai semantic destructive treatment
  yang sesuai, tanpa bersaing dengan aksi finish.
- Perbaiki separator `â€¢` menjadi karakter separator yang valid, misalnya `•`.

### 3. Metric Manifest dan Actual

- Pertahankan dua area metric berdampingan mulai breakpoint yang memadai, di dalam satu
  Card standar dan dipisahkan oleh grid/`Separator`.
- Manifest dan actual tidak memakai tinted box. Warna semantic hanya boleh muncul pada
  ikon atau indikator kecil; angka memakai `font-semibold tabular-nums`.
- Pertahankan label, satuan ekor, status menunggu deteksi, dan waktu deteksi terakhir.
- Jangan mengubah cara nilai actual, difference, atau percentage diperoleh.

### 4. Variance

- Buat variance menjadi summary row netral yang ringkas.
- Pertahankan tanda positif/negatif, satuan ekor, percentage nullable, dan label bahwa
  sesi belum selesai.
- Jangan menambahkan auto-finish atau interpretasi bisnis baru berdasarkan nilai
  variance.

### 5. SOP dan status sensor

- Ganti panel SOP gelap khusus dengan primitive `Alert` default dan ikon warning.
- Teks SOP wajib tetap eksplisit:
  `Pastikan truck ini sudah habis dan proses line sudah berhenti sebelum menyelesaikan counting.`
- Pertahankan penjelasan bahwa deteksi setelah finish menjadi `UNASSIGNED`.
- Sensor OFFLINE/STALE tetap conditional dan memakai `Alert` destructive.
- SOP dan sensor warning harus terbaca sebagai dua jenis risiko yang berbeda, bukan dua
  panel dekoratif dengan bobot visual sama.

### 6. Finish action

- Tombol `Selesaikan Counting` tetap menjadi primary action dan tidak boleh dihapus atau
  dipindahkan ke lokasi yang sulit ditemukan.
- Desktop menampilkan action di `CardFooter`, rata kanan, dan tidak full-width.
- Mobile mempertahankan action bar sticky, safe-area bottom, backdrop, dan target sentuh
  minimal 44 px.
- Jangan menaruh cancel bersebelahan sebagai aksi primer yang setara dengan finish.

### 7. Detail receiving dan log deteksi

- Pertahankan kolom kanan pada desktop dan urutkan di bawah area utama pada layar kecil.
- Detail receiving tetap menampilkan supplier, supir, Surat Jalan, waktu mulai, status
  device, dan heartbeat terakhir.
- Log deteksi tetap realtime, mempertahankan sequence dan waktu, serta memiliki empty
  state yang tenang.
- Gunakan divider, muted surface, Badge, dan typography dari design system; hindari
  shadow atau border yang tidak diperlukan.

### 8. Dialog finish dan cancel

- Gunakan `Dialog`, `Alert`, `Button`, `Label`, dan `Textarea` yang sudah ada.
- Dialog finish tetap memuat identitas truck/Surat Jalan, manifest, actual, selisih,
  warning sensor bila relevan, catatan SOP, dan konfirmasi eksplisit.
- Dialog cancel tetap Admin-only, wajib meminta alasan, dan mengembalikan receiving ke
  `WAITING` sesuai perilaku existing.
- Gunakan variant Button resmi. Jangan membuat solid destructive button melalui override
  class jika primitive sudah menyediakan semantic variant yang tepat.
- Jangan mengubah endpoint, payload, callback, validasi, atau error handling.

## Semantic Token dan Konvensi UI

Gunakan token yang sudah tersedia, termasuk:

- `primary` untuk brand dan primary action;
- `chart-1` untuk Manifest/Assigned, `chart-2` untuk Actual, dan `chart-3` untuk Unassigned;
- `success`, `warning`, dan `info` hanya sebagai accent semantic ringan;
- `warning` untuk COUNTING, variance, dan SOP;
- `destructive`/`device-offline` untuk sensor offline atau aksi pembatalan;
- `muted`, `border`, `card`, dan `foreground` untuk struktur netral.

Dilarang memakai utility palette langsung seperti `bg-red-500`, `text-green-600`,
`border-rose-200`, `bg-black`, atau `text-white`. Jangan menjalankan ulang full shadcn
preset, mengganti primitive dasar, atau menambah token tema untuk menyelesaikan styling
lokal ini.

## Invariant yang Tidak Boleh Berubah

- Actual count hanya berasal dari event `DETECTION + PRODUCTION + ASSIGNED` pada
  immutable `sensor_events`.
- Actual count tidak dapat diedit manual.
- Admin dan Operator tetap melalui backend authorization; menyembunyikan tombol bukan
  pengganti authorization.
- `CountingConsole` tetap shared untuk kedua role.
- Polling fallback dan WebSocket notification tetap berjalan seperti sekarang.
- Start, finish, cancel, audit transaction, dan broadcast-after-commit tidak berubah.
- Finish boundary dan SOP Truck A ke Truck B tidak dilonggarkan.
- Deteksi di luar sesi aktif tetap `UNASSIGNED`.
- Admin tetap dapat finish/cancel sesuai permission; Operator tidak memperoleh cancel.

## Di Luar Cakupan

- Perubahan API, database schema, migration, seed, domain service, atau device protocol.
- Perubahan kalkulasi manifest, actual, difference, atau percentage.
- Dark mode, design-system migration baru, atau penggantian preset shadcn.
- QR, physical button, hardware batch switch, pause counting, dan Supervisor role.
- Commit, push, branch reset, atau perubahan Git history.

## Acceptance Criteria

- Counting Admin dan Operator terlihat sebagai bagian dari design system shadcn yang
  sama dengan halaman lain.
- Tidak ada header/SOP hitam atau blok primary solid yang saling bersaing.
- Manifest dan actual tetap mudah dibandingkan tanpa colored panel; actual menjadi
  fokus melalui hierarchy angka tanpa mengorbankan keterbacaan.
- SOP, sensor offline, dan finish action memiliki prioritas visual berbeda dan jelas.
- Layout 2+1 kolom bekerja pada desktop dan menjadi satu kolom pada layar kecil.
- Tidak ada horizontal overflow pada 360, 390, 768, 1024, dan 1440 px.
- Sticky finish mobile tetap terlihat, tidak menutupi konten penting, dan memiliki target
  sentuh minimal 44 px.
- State sensor ONLINE serta OFFLINE/STALE, log kosong/berisi, dan error API tetap dapat
  ditampilkan.
- Admin melihat cancel session; Operator tidak.
- UI copy tetap Bahasa Indonesia dan separator encoding sudah benar.
- Tidak ada perubahan perilaku API, realtime, authorization, atau business invariant.

## Matriks QA

Lakukan pemeriksaan visual dan fungsional berikut bila environment tersedia:

| Skenario | Admin | Operator | Mobile | Desktop |
| --- | --- | --- | --- | --- |
| Sesi aktif, actual 0, belum ada deteksi | Ya | Ya | Ya | Ya |
| Sesi aktif dengan recent detections | Ya | Ya | Ya | Ya |
| Sensor ONLINE | Ya | Ya | Ya | Ya |
| Sensor OFFLINE/STALE | Ya | Ya | Ya | Ya |
| Variance negatif, nol, dan positif | Ya | Ya | Ya | Ya |
| Finish dialog | Ya | Ya | Ya | Ya |
| Cancel dialog | Ya | Tidak | Ya | Ya |
| Loading, error, dan line tanpa sesi | Ya | Ya | Ya | Ya |

Ambil screenshot sebelum dan sesudah pada breakpoint yang relevan. Jika database,
server, atau akun uji tidak tersedia, jangan membuat credential atau data palsu; catat
QA yang terhalang secara eksplisit.

## Validasi Teknis

Jalankan dari root repository:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Pada Windows, gunakan `npm.cmd` untuk perintah yang sama jika execution policy memblokir
`npm.ps1`. Laporkan setiap command yang tidak dapat dijalankan beserta alasan aktualnya.

## Kondisi Git pada Saat Handoff

Pada saat context pack ini dibuat, `docs/PROJECT_STATUS.md` memiliki perubahan lokal yang
sudah ada sebelum pekerjaan refinement. Anggap perubahan tersebut milik pengguna:

- jangan menghapus, menimpa, memformat ulang, atau memasukkannya ke scope;
- periksa ulang `git status` sebelum bekerja karena kondisi dapat berubah;
- jaga semua perubahan lain yang tidak terkait.
