# Status Proyek dan Handoff Agent

Terakhir diperbarui: 11 Agustus 2026.

## Milestone Saat Ini

- Implementasi software Batch 1 sampai Batch 21 telah selesai dikerjakan.
- Kontrak firmware dan backend berada di `docs/ESP32_PROTOCOL.md`.
- Firmware simulator ESP32-S3 tanpa sensor tersedia di `firmware/esp32-s3-simulator`.
- ESP32-S3 DevKitC-1/WROOM fisik sudah berhasil di-flash, terhubung ke backend lokal,
  mengirim heartbeat, dan mengirim detection TEST maupun PRODUCTION.
- Detection TEST tidak menambah actual. Detection PRODUCTION pada sesi aktif menjadi
  ASSIGNED dan menambah actual dari immutable `sensor_events`.
- Event tanpa sesi aktif tetap menjadi UNASSIGNED dan terlihat realtime di UI Admin.
- Ringkasan status line memilih perangkat operasional paling sehat. Perangkat ONLINE
  mewakili line ketika perangkat lama pada line yang sama berada dalam MAINTENANCE.

## Batas Status Selesai

Status Batch 1 sampai Batch 21 selesai berarti implementasi software, kontrak protocol,
test otomatis, deployment guard, dokumentasi pilot, dan firmware simulator telah tersedia.
Status ini bukan kelulusan pilot hardware lengkap.

- Sensor fisik belum tersedia dan belum diuji.
- FT-01 sampai FT-10 tetap `BELUM DIUJI` dan keputusan pilot tetap `NO-GO`.
- Akurasi sensor, wiring, level tegangan, noise, debounce nyata, posisi pemasangan,
  missed detection, double-trigger, dan performa terhadap ayam berjalan belum terverifikasi.
- Event yang masih berada di RAM queue dapat hilang jika daya ESP32 terputus.
- Skenario reconnect queue, dropped ACK, power loss, finish boundary, Truck A ke Truck B,
  serta queue overflow masih harus dijalankan dan dicatat secara formal.

Lihat `docs/ESP32_SIMULATION_RESULTS.md` untuk observasi simulasi tanpa sensor dan
`docs/ESP32_FIELD_TEST_RESULTS.md` untuk status field test fisik.

## Konteks Operasional ESP32

- Gunakan device khusus yang dibuat dari halaman Admin; jangan gunakan secret seed.
- Credential lokal berada di `firmware/esp32-s3-simulator/include/secrets.h` dan wajib
  tetap diabaikan Git.
- Laptop dan ESP32 harus berada pada Wi-Fi yang sama dan firmware memakai IPv4 LAN laptop.
- Tailscale exit node pada laptop pernah memblokir akses LAN. Nonaktifkan exit node saat
  melakukan pengujian lokal bila ESP32 atau ponsel tidak dapat mencapai backend.
- Default firmware adalah mode TEST. Mode PRODUCTION harus dipilih eksplisit dan hanya
  digunakan pada receiving uji yang memang sedang aktif.

## Checkpoint UI Saat Ini

Rombak UI responsif berada pada branch `codex/ui-shadcn-overhaul`. Baseline preset dan
Tailwind CSS 4 berada pada commit `e282e19`, sedangkan penyelesaian semantic token,
komponen, dan chart berada pada commit `44ded26`.

Foundation UI yang sudah selesai dan harus dipakai sebagai titik awal:

- Tailwind CSS 4 dan full preset shadcn `b50LzhLQA` (Maia, Mist, Rose, Figtree,
  Lucide, Radix) telah menjadi foundation design system;
- sidebar desktop dapat diciutkan ke ikon dan menyimpan state melalui cookie;
- sidebar mobile menjadi off-canvas dan menutup setelah navigasi;
- navigasi Admin dikelompokkan berdasarkan Operasional, Data & Perangkat,
  Administrasi, dan Analitik, sedangkan Operator hanya menerima menu operasional;
- form dan dialog utama memakai primitive shadcn/Radix resmi;
- antrean receiving memakai kartu pada mobile dan tabel lokal pada desktop;
- counting aktif memiliki action bar finish yang sticky pada mobile dan tetap wajib
  melalui dialog konfirmasi/SOP yang sama;
- light mode adalah pengalaman resmi tahap ini; dark mode belum menjadi target QA.

Penyelesaian migrasi visual shadcn dan semantic token juga telah diterapkan:

- utility warna palette langsung telah dihapus dari kode aplikasi dan dijaga oleh
  regression test; nilai warna konkret hanya didefinisikan pada token tema;
- token perangkat memetakan ONLINE ke success, DEGRADED ke warning, OFFLINE ke
  destructive, dan UNKNOWN ke muted, terpisah dari warna brand Rose;
- token metrik manifest, actual, assigned, dan unassigned dipakai oleh KPI dan chart;
- receiving memakai Date Picker terkendali, sedangkan Reports dan Audit Trail memakai
  Date Range Picker dengan date-only `YYYY-MM-DD` yang aman dari pergeseran timezone;
- pemilih line memakai Toggle Group, filter master data memakai Select, serta tabel queue
  dan users memakai Table shadcn tanpa menghilangkan kartu mobile;
- Dashboard Admin menampilkan chart Manifest versus Actual untuk sesi aktif, Dashboard
  Operator menampilkan donut Assigned versus Unassigned, dan Reports menampilkan maksimal
  12 penerimaan terbaru pada chart tanpa membatasi tabel maupun CSV;
- status, error, empty state, dan loading telah diseragamkan dengan `StatusBadge`, `Alert`,
  `ErrorState`, `EmptyState`, dan `Skeleton`.

Dependensi UI tambahan yang sudah terkunci pada checkpoint ini adalah `date-fns@4.4.0`,
`react-day-picker@10.0.1`, dan `recharts@3.8.0`. Jangan menjalankan ulang full preset atau
mengganti base primitive karena dapat menimpa penyesuaian aplikasi yang sudah diverifikasi.

File foundation yang perlu diperiksa sebelum mengubah visual:

- `src/app/globals.css` untuk semantic theme token;
- `src/components/ui/date-picker.tsx` dan `src/lib/ui-date.ts` untuk kontrak date-only;
- `src/components/ui/chart.tsx` dan `src/lib/chart-data.ts` untuk foundation chart;
- `src/components/ui/states.tsx` untuk pola loading, empty, dan error;
- `src/components/layout/DashboardShell.tsx` dan `src/components/layout/navigation.ts`
  untuk shell, perilaku sidebar responsif, serta menu berbasis role;
- `src/components/receiving/counting-console.tsx` untuk alur counting bersama Admin dan
  Operator.

## Fokus Perubahan UI Berikutnya

Tahap berikutnya adalah memperbaiki bagian UI yang secara visual atau komposisi masih
kurang sesuai. Ini adalah tahap refinement atas foundation yang sudah stabil, bukan migrasi
design system baru. Perubahan boleh mencakup hierarchy, spacing, density, ukuran komponen,
susunan section, treatment tabel/kartu/chart, copy visual, dan perilaku responsif.

Rombak Dashboard Admin bergaya executive spacious telah disetujui untuk implementasi.
Spesifikasi decision-complete, kontrak data, acceptance criteria, referensi visual, dan
strategi branch tersedia di [`ADMIN_DASHBOARD_REDESIGN.md`](./ADMIN_DASHBOARD_REDESIGN.md).
Kerjakan Dashboard Admin terlebih dahulu; Dashboard Operator tetap di luar scope tahap ini.

Guardrail untuk agent berikutnya:

- tetap gunakan Tailwind CSS 4, semantic token, dan primitive/composition shadcn yang sudah
  ada; jangan mengembalikan utility warna palette langsung atau kontrol native;
- pertahankan interface shell, route, Bahasa Indonesia, role-based navigation, kartu queue
  mobile, sticky Finish, dialog konfirmasi, dan target sentuh minimal 44 px;
- pertahankan controlled form, validasi Zod, kontrak date-only `YYYY-MM-DD`, serta batas
  chart Reports maksimal 12 item tanpa membatasi tabel dan CSV;
- lakukan perubahan visual per halaman atau per pola agar diff mudah ditinjau; ambil
  screenshot sebelum/sesudah pada breakpoint yang relevan;
- dark mode masih di luar cakupan. QA visual halaman terautentikasi secara end-to-end tetap
  perlu dilakukan saat database development dan akun uji aktif.

Perubahan UI berikutnya tidak boleh menyentuh invariant backend berikut:

- actual hanya berasal dari event DETECTION + PRODUCTION + ASSIGNED;
- actual tidak dapat diedit manual;
- authorization dan line scoping tetap ditegakkan di backend;
- transaksi audit tetap atomic dan broadcast dilakukan setelah commit;
- idempotency `event_id` dan `(device_id, boot_id, sequence)` tidak boleh berubah;
- finish/session boundary dan SOP Truck A ke Truck B tidak boleh dilonggarkan;
- batas batch config, settings, dan ingestion tetap maksimum 100.

## Validasi Milestone

- `npm run lint`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 281 test termasuk regression test line dengan device MAINTENANCE +
  ONLINE, grouping/visibility navigasi berdasarkan role, date-only/range, dataset chart,
  serta larangan palette utility dan kontrol native pada kode aplikasi.
- Firmware PlatformIO target `esp32-s3-devkitc-1`: berhasil dibangun dan di-upload.
- `npm run build`: PASS, termasuk compile, typecheck, page collection, dan 43 static pages.
- QA publik 360 px: landing/login tidak memiliki horizontal overflow dan target sentuh
  aksi utama minimal 44 px. QA halaman terautentikasi di seluruh breakpoint masih perlu
  diulang saat PostgreSQL development tersedia.
- QA komponen visual aktual pada 360, 390, 768, 1024, dan 1440 px: tidak ada horizontal
  overflow, kontrol baru memiliki target sentuh minimal 44 px, Calendar menampilkan satu
  bulan pada mobile dan dua bulan pada desktop, serta chart tetap responsif.

Jangan menulis Wi-Fi password, device secret, session cookie, `DATABASE_URL`, atau
credential lain ke dokumentasi, issue, screenshot publik, maupun commit.
