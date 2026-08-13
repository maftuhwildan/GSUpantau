# Refinement UI Operator

## Status Dokumen

Dokumen ini adalah spesifikasi decision-complete untuk agent implementasi berikutnya.
Dokumen ini hanya merencanakan perubahan; implementasi tidak termasuk dalam perubahan
dokumentasi ini.

Baseline implementasi adalah commit `8b3d5b3` pada branch
`codex/admin-dashboard-executive-redesign`. Agent implementasi wajib membuat branch baru
`codex/operator-ui-refinement` dari baseline tersebut sebelum mengubah kode.

## Tujuan

Refinement ini membuat halaman Operator lebih berorientasi pada tindakan lapangan tanpa
mengubah aturan bisnis counting. Operator harus dapat memahami kondisi line, melihat truck
yang sedang atau akan dihitung, memulai counting melalui konfirmasi, dan menelusuri aktivitas
sensor dengan lebih cepat.

Halaman yang termasuk scope:

- `/dashboard`;
- `/receiving-queue`;
- `/active-session`;
- `/sensor-activity`;
- API baca dan tipe yang secara langsung diperlukan oleh empat halaman tersebut.

## Guardrail Wajib

- Pertahankan dua role MVP: `OPERATOR` dan `ADMIN`.
- Jangan mengubah backend counting, autentikasi, schema, migration, atau endpoint mutasi.
- Actual tetap hanya berasal dari event immutable dengan kombinasi
  `DETECTION + PRODUCTION + ASSIGNED`.
- Jangan menambahkan cara untuk mengedit actual secara manual.
- Pertahankan authorization dan line scoping di backend.
- Pertahankan `CountingConsole`, `StartCountingDialog`, dan `FinishCountingDialog` sebagai
  komponen/alur bersama Admin dan Operator.
- Operator tidak boleh melihat atau menjalankan cancel session.
- Start dan finish tetap wajib melalui dialog konfirmasi.
- Gunakan Bahasa Indonesia pada copy Operator.
- Gunakan primitive shadcn, semantic token, dan lucide-react yang sudah tersedia.
- Jangan menjalankan ulang preset shadcn atau mengubah design system dasar.
- Jangan mengubah Admin Dashboard.
- Dark mode tidak termasuk scope.

## Baseline Visual yang Tidak Boleh Diulang

Perubahan global berikut sudah tersedia pada commit baseline dan otomatis berlaku untuk
Operator:

- sidebar frosted/glass beserta treatment hover dan menu aktif;
- pemetaan bobot konten `normal -> light`, `medium -> normal`, dan
  `semibold -> medium`;
- breadcrumb desktop dan judul halaman mobile pada top header;
- `PageHeader` compact tanpa padding ganda.

Agent implementasi tidak perlu menulis ulang atau membatalkan foundation tersebut.

Empat file mockup berikut sedang terhapus secara unstaged sebagai perubahan milik pengguna.
Jangan restore, stage, commit, atau menghapus ulang file-file tersebut:

- `docs/ui-mockups/poultry-receiving-admin-dashboard-v1.png`;
- `docs/ui-mockups/poultry-receiving-dashboard-v1.png`;
- `docs/ui-mockups/poultry-receiving-operator-dashboard-v1.png`;
- `docs/ui-mockups/poultry-receiving-supervisor-dashboard-v1.png`.

## Arah Desain yang Dikunci

- Dashboard Operator berfokus pada tindakan operasional, bukan ringkasan executive Admin.
- Assigned dan unassigned ditampilkan sebagai angka serta alert, tanpa donut chart.
- Operator melihat assigned line sebagai konteks non-interaktif.
- Halaman antrean memisahkan receiving `COUNTING` dari daftar `WAITING`.
- Dashboard dapat memulai truck pertama melalui `StartCountingDialog`.
- Aktivitas Sensor memiliki filter tipe event dan assignment.

## Dashboard Operator

### Header

- Gunakan judul tetap `Dashboard Operator`.
- Nama dan kode assigned line ditampilkan sebagai badge atau konteks pendamping, bukan
  digabungkan ke judul.
- Status line harus memakai badge dengan teks, bukan warna saja.

### Sesi Aktif sebagai Hero

Jika ada sesi aktif, jadikan sesi tersebut section paling dominan. Tampilkan:

- plat truck;
- nomor Surat Jalan;
- supplier;
- status sensor;
- manifest;
- actual realtime;
- selisih sementara;
- progress terhadap manifest;
- waktu deteksi terakhir;
- tombol `Buka Sesi Aktif` menuju `/active-session`.

Progress hanya bersifat informasi. Mencapai manifest tidak boleh menyelesaikan sesi secara
otomatis. Jika manifest tidak valid atau nol, progress harus aman dan tidak menghasilkan
pembagian nol.

Status perangkat `DEGRADED`, `OFFLINE`, stale, `MAINTENANCE`, atau belum terdaftar harus
terlihat melalui badge teks dan alert semantic. Jangan mengandalkan warna saja.

### Kondisi Idle

Jika tidak ada sesi aktif:

- tampilkan bahwa assigned line siap digunakan;
- tampilkan truck urutan pertama dari waiting queue jika tersedia;
- tampilkan plat, Surat Jalan, supplier, manifest, dan posisi antrean truck tersebut;
- tombol `Mulai Penghitungan` wajib membuka `StartCountingDialog` untuk item pertama;
- jangan langsung memanggil endpoint start atau melewati konfirmasi;
- jika antrean kosong, tampilkan empty state dan tautan menuju `/receiving-queue`.

### Preview Antrean

- `waitingQueue` tetap merupakan preview maksimal lima item.
- Tampilkan total antrean sebenarnya dari `waitingQueueCount`, bukan panjang preview.
- Urutkan berdasarkan `queue_position`, kemudian `created_at` sesuai kontrak produk.
- Sediakan tautan menuju `/receiving-queue`.

### Ringkasan Deteksi Hari Ini

- Hapus donut chart.
- Tampilkan dua metrik angka: `Assigned` dan `Unassigned`.
- Statistik tetap scoped ke assigned line dan batas hari `SITE_TIMEZONE`.
- Jika `unassignedDetections > 0`, tampilkan alert yang menjelaskan risiko batas truck dan
  tautan menuju `/sensor-activity`.
- Jika tidak ada deteksi, tampilkan empty state ringkas tanpa area chart kosong.

### Tipe Data

- Hilangkan `any` dari data utama dashboard dan error handling.
- Tambahkan tipe `OperatorDashboardData` dengan nested type eksplisit untuk line, device,
  active session, receiving, dan waiting item.
- Tipe harus mengikuti response API aktual dan boleh menggunakan string union untuk status
  yang sudah stabil.

## Antrean Surat Jalan

### Struktur

- Ambil receiving yang sudah line-scoped oleh backend.
- Pisahkan item `COUNTING` dari item `WAITING` di client atau melalui query baca existing.
- Tampilkan maksimal satu receiving `COUNTING` sebagai panel konteks di atas.
- Tampilkan hanya `WAITING` pada daftar antrean di bawah, diurutkan berdasarkan posisi.
- Jangan menampilkan item draft, completed, atau cancelled pada halaman Operator ini.

### Panel Counting

Panel konteks harus menampilkan minimal:

- label `Sedang Dihitung`;
- plat truck;
- nomor Surat Jalan;
- supplier;
- manifest;
- assigned line;
- tombol `Buka Sesi` menuju `/active-session`.

Panel ini bukan salinan penuh `CountingConsole`.

### Daftar Waiting

- Gunakan pola kartu mobile dan tabel desktop yang sudah ada.
- Pertahankan target sentuh minimal 44 px pada mobile.
- Gunakan label `Menunggu` dan tombol `Mulai Penghitungan`.
- Tombol start tetap membuka `StartCountingDialog`.
- Pertahankan authorization dan line scoping.
- Banner batas wewenang cukup berupa informasi sekunder yang ringkas, bukan elemen visual
  paling dominan.

## Sesi Aktif

### Assigned Line

- Selama pengambilan data awal, tampilkan status `MEMUAT`; jangan merender `IDLE` lebih dulu.
- Untuk Operator yang menerima tepat satu line dari `/api/lines`, ganti Toggle Group dengan
  badge atau informasi line non-interaktif.
- Jika route ini dibuka oleh Admin dan `/api/lines` mengembalikan lebih dari satu line,
  pertahankan selector sebagai fallback.
- Jika tidak ada line, tampilkan error/empty state yang menjelaskan bahwa line belum
  ditugaskan; jangan memulai polling tanpa target.

### Console

- Pertahankan `CountingConsole` shared dalam layout penuh 2+1.
- Pertahankan action finish yang sticky pada mobile.
- Gunakan `isAdmin={false}` pada alur Operator agar cancel session tidak muncul.
- Pertahankan polling fallback dan refetch berbasis WebSocket.
- Perbaiki tautan empty state menjadi `/receiving-queue`.

## Aktivitas Sensor

### Filter Toolbar

Tambahkan dua Select berbasis shadcn:

1. Tipe event:
   - `Semua`;
   - `Deteksi` (`DETECTION`);
   - `Heartbeat` (`HEARTBEAT`);
   - `Device Restart` (`DEVICE_RESTART`).
2. Assignment:
   - `Semua`;
   - `Assigned` (`ASSIGNED`);
   - `Unassigned` (`UNASSIGNED`).

Perilaku yang wajib:

- line tidak dapat dipilih dan tetap dipaksa backend ke assigned line Operator;
- memilih `Assigned` atau `Unassigned` otomatis menetapkan tipe event ke `DETECTION`;
- memilih `HEARTBEAT` atau `DEVICE_RESTART` mereset assignment ke `Semua` dan
  menonaktifkan kontrol assignment;
- tombol `Reset Filter` mengembalikan kedua filter ke `Semua`;
- perubahan filter langsung melakukan refetch dengan query parameter existing;
- refetch akibat event WebSocket tetap memakai filter aktif, tidak mereset state filter;
- request yang datang lebih lama tidak boleh menimpa hasil filter terbaru bila terjadi
  race sederhana; gunakan abort/cancellation bila pola existing membutuhkannya.

### Daftar Event dan State

- Gunakan tipe TypeScript eksplisit untuk sensor event.
- Tampilkan waktu operasional berdasarkan server timestamp yang tersedia; utamakan
  `receivedAt` untuk urutan/aktivitas operasional.
- Tampilkan label event dalam Bahasa Indonesia tanpa mengubah enum API.
- Tampilkan loading, error dengan retry, dan empty state.
- Empty state harus menjelaskan filter aktif, misalnya tidak ada event Deteksi Unassigned.
- Pertahankan batas maksimum 100 event.

## API dan Kontrak Tipe

### `GET /api/dashboard/operator`

Perluas response secara backward-compatible:

```ts
type OperatorDashboardData = {
  line: OperatorLine;
  device: OperatorDevice | null;
  activeSession: OperatorActiveSession | null;
  waitingQueue: OperatorWaitingItem[];
  waitingQueueCount: number;
  assignedDetections: number;
  unassignedDetections: number;
};
```

- `waitingQueue` tetap maksimal lima item.
- `waitingQueueCount` menghitung seluruh receiving `WAITING` yang dapat diakses pada line
  tersebut dengan scope yang sama seperti preview.
- Query count dan preview harus memakai kondisi line yang identik.
- Jangan mengubah field response yang sudah ada.

### `GET /api/sensor-events`

- Tetap gunakan query parameter `event_type` dan `assignment_status`.
- Validasi `event_type` hanya menerima `DETECTION`, `HEARTBEAT`, atau `DEVICE_RESTART`.
- Validasi `assignment_status` hanya menerima `ASSIGNED` atau `UNASSIGNED`.
- Query enum tidak valid harus mengembalikan error validasi `400`, bukan internal error.
- Pertahankan pembatasan Operator ke assigned line walaupun client mengirim `line_id`.
- Jangan menambah endpoint baru.

## Urutan Implementasi yang Disarankan

1. Buat branch dan verifikasi working tree/penghapusan mockup.
2. Tambahkan tipe `OperatorDashboardData`.
3. Perluas API Dashboard Operator dengan `waitingQueueCount` beserta test.
4. Tambahkan validasi enum Sensor Events beserta test filter/scoping.
5. Refinement Dashboard Operator.
6. Pisahkan panel `COUNTING` dan list `WAITING` pada antrean.
7. Perbaiki loading dan konteks assigned line pada Sesi Aktif.
8. Tambahkan filter dan state Aktivitas Sensor.
9. Jalankan validasi spesifik, lalu semua validasi wajib.
10. Serahkan hasil implementasi kepada pengguna untuk review visual manual.

## Test Wajib

Tambahkan atau sesuaikan test yang membuktikan:

- Operator Dashboard tetap scoped ke assigned line dan menolak line lain.
- `waitingQueueCount` sama dengan total antrean ketika jumlahnya lebih dari lima, sedangkan
  `waitingQueue` tetap berisi maksimal lima item.
- statistik assigned/unassigned memakai `received_at` dan batas hari `SITE_TIMEZONE`.
- query sensor memfilter event type.
- query sensor memfilter assignment status.
- kombinasi event type `DETECTION` dan assignment bekerja.
- enum filter sensor yang tidak valid ditolak dengan status `400`.
- Operator tetap tidak dapat membaca sensor event line lain.
- source UI Dashboard memanggil `StartCountingDialog`, bukan endpoint start secara langsung.
- source UI Sesi Aktif tidak memakai route `/operator/receiving-queue` dan tidak menampilkan
  status idle ketika loading awal.

Test source-level boleh digunakan untuk invariant komposisi UI yang tidak memiliki setup
browser, tetapi perilaku API harus diuji melalui route handler.

## Acceptance Criteria

- Dashboard tetap scoped ke assigned line dan menolak line lain.
- `waitingQueueCount` benar ketika antrean lebih dari lima.
- Start dari Dashboard selalu melalui dialog konfirmasi.
- Loading Sesi Aktif tidak menampilkan status idle palsu.
- Queue memisahkan satu sesi counting dari waiting queue.
- Filter sensor bekerja sendiri-sendiri dan gabungan, tetap line-scoped, serta bertahan saat
  realtime refresh.
- Assigned/unassigned Dashboard memakai batas hari `SITE_TIMEZONE`.
- Device offline, degraded, stale, maintenance, atau belum terdaftar memiliki badge teks
  dan alert yang dapat dipahami tanpa mengandalkan warna.
- Tidak ada overflow pada lebar 360, 390, 768, 1024, dan 1440 px.
- Target sentuh aksi mobile minimal 44 px.
- Copy Operator menggunakan Bahasa Indonesia dan tidak mengandung separator encoding rusak.
- Admin flow dan shared `CountingConsole` tidak mengalami regresi.

## Validasi

Jalankan dari root repository:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
git diff --check
```

Agent implementasi tidak perlu membuka browser, menjalankan review visual, atau mengambil
screenshot. Review tampilan pada breakpoint 360, 390, 768, 1024, dan 1440 px akan dilakukan
secara manual oleh pengguna setelah implementasi diserahkan.

Agent tetap harus menjaga class responsif dan target sentuh sesuai acceptance criteria,
tetapi tidak boleh menyatakan hasil QA visual sebagai lulus karena review tersebut berada
di luar scope agent.

## Handoff Akhir Agent Implementasi

Laporan akhir harus mencantumkan:

- branch dan baseline yang dipakai;
- ringkasan perubahan per halaman;
- file API/tipe/test yang berubah;
- hasil setiap perintah validasi;
- hasil seluruh validasi otomatis;
- catatan area tampilan yang perlu diperiksa pengguna saat review manual;
- blocker yang belum selesai;
- konfirmasi bahwa empat penghapusan mockup milik pengguna tidak disentuh atau ikut commit.
