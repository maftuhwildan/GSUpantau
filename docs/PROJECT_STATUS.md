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

## Fokus Berikutnya

Tahap berikutnya yang direncanakan adalah perbaikan UI dan UX. Perubahan tersebut harus
mempertahankan invariant backend berikut:

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
- `npm test`: PASS, termasuk regression test line dengan device MAINTENANCE + ONLINE.
- Firmware PlatformIO target `esp32-s3-devkitc-1`: berhasil dibangun dan di-upload.
- `npm run build`: compile dan typecheck PASS; page collection terakhir tidak diselesaikan
  karena dev server aktif memakai `.next`. Jalankan ulang setelah dev server dihentikan.

Jangan menulis Wi-Fi password, device secret, session cookie, `DATABASE_URL`, atau
credential lain ke dokumentasi, issue, screenshot publik, maupun commit.
