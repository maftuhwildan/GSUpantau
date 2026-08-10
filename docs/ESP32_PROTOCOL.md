# Kontrak Firmware ESP32 dan Pilot

Dokumen ini adalah kontrak integrasi firmware untuk Poultry Receiving Counter System. Kontrak ini membekukan perilaku firmware pilot tanpa mengubah aturan counting backend.

Status dokumen: **siap untuk implementasi firmware, menunggu field test fisik**  
Versi protokol: **1.0**  
Tanggal: **2026-08-10**

## 1. Prinsip yang Tidak Boleh Dilanggar

1. Actual count hanya berasal dari immutable `sensor_events` dengan:
   - `event_type = DETECTION`;
   - `event_mode = PRODUCTION`;
   - `assignment_status = ASSIGNED`.
2. Firmware tidak pernah mengirim atau mengubah actual count secara langsung.
3. Setiap MCU boot membuat satu UUID v4 baru sebagai `boot_id`.
4. `boot_id` disimpan di RAM dan tidak berubah selama boot tersebut.
5. Semua event yang dikirim melalui `/api/device/events` memakai satu sequence stream bersama untuk boot yang sama.
6. Retry mengirim identitas dan payload event yang sama persis sampai server memberi ACK.
7. Queue event yang belum mendapat ACK disimpan di RAM dan diproses FIFO.
8. Timestamp tidak pernah dipakai sebagai uniqueness key.
9. Assignment ke receiving ditentukan backend saat event diproses, bukan dari `device_time`.
10. Event yang diproses tanpa session aktif menjadi `UNASSIGNED` dan tidak boleh dipindahkan diam-diam oleh firmware.

## 2. Provisioning Perangkat

Sebelum firmware dipasang, Admin harus membuat perangkat pada halaman Line & Perangkat. Firmware menerima tiga nilai provisioning:

| Nilai | Contoh | Aturan |
|---|---|---|
| Base URL | `https://counter.example.com` | URL aplikasi tanpa trailing slash |
| Device code | `ESP32-LINE-01` | Harus sama dengan perangkat yang terdaftar |
| Device secret | nilai acak saat create/rotate | Rahasia; hanya ditampilkan sekali oleh aplikasi |

Line tidak dipilih bebas oleh firmware. Backend mengambil line yang terikat pada device dan menolak `line_id` yang tidak cocok.

Gunakan header berikut pada seluruh Device API:

```http
Authorization: Bearer <device-secret>
Content-Type: application/json
```

Firmware tidak boleh:

- menulis secret ke log serial pada build pilot/production;
- memasukkan secret ke `diagnostic_payload`;
- memakai secret default simulator;
- terus melakukan retry cepat setelah `401`, `404 DEVICE_UNREGISTERED`, atau `400 DEVICE_LINE_MISMATCH`.

Rotasi credential langsung membatalkan secret lama. Secret baru harus diprovision ulang ke perangkat.

## 3. Siklus Boot dan Sequence

### 3.1 Inisialisasi setiap MCU boot

Urutan wajib:

1. Buat UUID v4 baru dan simpan sebagai `boot_id` di RAM.
2. Buat queue event kosong di RAM.
3. Set `next_sequence = 0`.
4. Sambungkan jaringan, sinkronkan jam, dan ambil konfigurasi device.
5. Buat event `DEVICE_RESTART` dengan sequence `0`.
6. Naikkan `next_sequence` menjadi `1`.
7. Mulai menerima detection hanya setelah identitas, credential, dan waktu valid siap.

Contoh state awal:

```text
boot_id       = UUIDv4()
next_sequence = 0
queue         = []

enqueue(DEVICE_RESTART, sequence=next_sequence)
next_sequence = 1
```

Reboot baru selalu menghasilkan namespace baru:

```text
Boot A: boot_id=A, sequence=0,1,2,3,...
Boot B: boot_id=B, sequence=0,1,2,3,...
```

Sequence boleh kembali ke nol hanya jika `boot_id` berubah karena MCU benar-benar boot ulang. Wi-Fi reconnect, API timeout, server restart, dan retry tidak boleh membuat `boot_id` baru atau mengembalikan sequence ke nol.

### 3.2 Satu stream untuk seluruh event

Semua `event_type` yang dimasukkan ke `/api/device/events` memakai counter yang sama:

```text
sequence 0 -> DEVICE_RESTART
sequence 1 -> DETECTION
sequence 2 -> DETECTION
sequence 3 -> HEARTBEAT (jika firmware memilih merekam heartbeat sebagai event)
sequence 4 -> DETECTION
```

Jangan mempunyai counter terpisah untuk detection, restart, atau heartbeat event. Alokasi sequence dan enqueue harus diserialkan dalam satu task/critical section agar dua interrupt tidak mendapatkan sequence yang sama.

Nilai sequence yang diterima backend adalah integer `0..2147483647`. Firmware tidak boleh wrap ke nol pada boot yang sama. Jika batas tercapai, masuk ke fault state dan lakukan controlled restart sehingga boot berikutnya memiliki `boot_id` baru.

## 4. Waktu Perangkat

`device_time` wajib berupa ISO-8601 valid dengan timezone. Format UTC paling sederhana untuk firmware:

```text
2026-08-10T16:25:42.381Z
```

Aturan waktu:

- sinkronkan waktu melalui SNTP sebelum production counting dimulai;
- tangkap `device_time` satu kali ketika event dibuat;
- simpan string timestamp itu bersama event di queue;
- jangan mengganti timestamp saat retry;
- jangan memakai timestamp sebagai `event_id` atau uniqueness key;
- jangan membuat timestamp palsu jika jam belum valid.

`device_time` adalah metadata audit/diagnostik. `received_at` server adalah waktu otoritatif untuk statistik, urutan penerimaan, dan batas session. Karena itu queued event boleh memiliki `device_time` lama tetapi tetap ditentukan assignment-nya berdasarkan session yang aktif ketika backend memproses event tersebut.

## 5. Event Queue di RAM

Setiap item queue minimal menyimpan payload final berikut:

```text
event_id
boot_id
sequence
event_type
device_time
event_mode
atribut diagnostik tambahan jika ada
```

Aturan queue:

1. Queue bersifat FIFO; kirim event tertua lebih dahulu.
2. Event dibuat lengkap sebelum dimasukkan ke queue.
3. Setelah enqueue, identitas dan payload event menjadi immutable.
4. Event baru boleh dihapus setelah ACK valid dari server.
5. Timeout, koneksi putus, respons tidak valid, dan HTTP non-2xx bukan ACK.
6. Jangan renumber, merge, atau membuat ulang event yang gagal terkirim.
7. Kirim maksimal `batch_upload_max_events` dari konfigurasi, dengan hard ceiling 100.
8. Jika queue penuh, jangan drop event diam-diam. Aktifkan indikator fault, hentikan penerimaan flow secara operasional, dan laporkan overflow pada heartbeat berikutnya.

Kapasitas queue RAM ditentukan tim firmware berdasarkan RAM nyata dan hasil soak test. Sebelum pilot, kapasitas harus didokumentasikan sebagai jumlah event dan estimasi durasi buffer pada laju detection tertinggi.

Diagnostic heartbeat yang disarankan:

```json
{
  "free_heap": 118320,
  "uptime_seconds": 7200,
  "queue_depth": 4,
  "queue_capacity": 512,
  "oldest_event_age_ms": 3200,
  "last_acked_sequence": 87,
  "clock_synced": true,
  "sensor_fault": false,
  "queue_overflow_count": 0
}
```

## 6. Device API

### 6.1 Mengambil konfigurasi

Panggil saat boot setelah jaringan tersedia, dan ulangi setelah reconnect panjang:

```http
GET /api/device/config?device_id=ESP32-LINE-01&line_id=LINE-01
Authorization: Bearer <device-secret>
```

Respons sukses:

```json
{
  "device_id": "ESP32-LINE-01",
  "line_id": "LINE-01",
  "server_time": "2026-08-10T16:25:00.000Z",
  "heartbeat_interval_seconds": 10,
  "batch_upload_max_events": 100
}
```

Firmware wajib memakai nilai batch yang lebih kecil antara respons server dan hard ceiling 100. Nilai aman bawaan saat config sementara tidak tersedia adalah heartbeat 10 detik dan batch 100, tetapi firmware tetap harus melanjutkan retry config dengan backoff.

### 6.2 Mengirim event

Endpoint:

```http
POST /api/device/events
```

Payload:

```json
{
  "device_id": "ESP32-LINE-01",
  "line_id": "LINE-01",
  "events": [
    {
      "event_id": "ESP32-LINE-01:550e8400-e29b-41d4-a716-446655440000:1",
      "boot_id": "550e8400-e29b-41d4-a716-446655440000",
      "sequence": 1,
      "event_type": "DETECTION",
      "device_time": "2026-08-10T16:25:42.381Z",
      "event_mode": "PRODUCTION"
    }
  ]
}
```

Kontrak field:

| Field | Aturan |
|---|---|
| `device_id` | Device code atau UUID terdaftar; firmware gunakan device code |
| `line_id` | Line code yang diprovision dan harus cocok dengan device |
| `events` | 1 sampai nilai config, tidak pernah lebih dari 100 |
| `event_id` | String unik global, panjang 1–100 |
| `boot_id` | UUID v4 boot saat ini, panjang 36 |
| `sequence` | Integer `0..2147483647`, satu stream per boot |
| `event_type` | `DETECTION`, `HEARTBEAT`, atau `DEVICE_RESTART` |
| `device_time` | ISO-8601 valid dengan timezone |
| `event_mode` | `PRODUCTION`, `TEST`, atau `MAINTENANCE` |

Format `event_id` wajib untuk firmware pilot:

```text
<device_code>:<boot_id>:<sequence>
```

Dengan batas device code 50 karakter, UUID 36 karakter, dan sequence maksimum 10 digit, format ini tetap berada dalam batas 100 karakter.

`event_mode` pada build pilot normal harus `PRODUCTION`. `TEST` hanya untuk prosedur pengujian yang disengaja dan tidak menambah KPI. Jangan menggunakan `MAINTENANCE` untuk mengganti actual.

### 6.3 Respons dan ACK

Contoh respons sukses:

```json
{
  "accepted": 1,
  "duplicates": 0,
  "rejected": 0,
  "events": [
    {
      "event_id": "ESP32-LINE-01:550e8400-e29b-41d4-a716-446655440000:1",
      "boot_id": "550e8400-e29b-41d4-a716-446655440000",
      "sequence": 1,
      "status": "ACCEPTED",
      "assignment_status": "ASSIGNED",
      "session_id": "uuid"
    }
  ]
}
```

Sebuah event mendapat ACK hanya jika:

1. HTTP status `200`;
2. body JSON valid;
3. terdapat item response dengan `event_id`, `boot_id`, dan `sequence` yang sama;
4. `status` adalah `ACCEPTED` atau `DUPLICATE`.

`DUPLICATE` adalah ACK sukses: server sudah menyimpan event yang sama atau identitas `(device_id, boot_id, sequence)` sudah pernah diterima. Menghapus item queue setelah ACK `DUPLICATE` tidak menambah actual dua kali.

Jika satu batch gagal karena storage error, backend mengembalikan `500 INTERNAL_ERROR` dan transaksi storage dibatalkan. Firmware harus mengirim ulang seluruh item yang belum ACK dengan payload yang sama. Jangan menganggap `accepted` parsial tanpa respons `200` yang valid.

### 6.4 Heartbeat kesehatan

Untuk pilot v1, kirim status kesehatan melalui:

```http
POST /api/device/heartbeat
```

Payload:

```json
{
  "device_id": "ESP32-LINE-01",
  "line_id": "LINE-01",
  "firmware_version": "1.0.0",
  "wifi_rssi": -61,
  "diagnostic_payload": {
    "free_heap": 118320,
    "uptime_seconds": 7200,
    "queue_depth": 0,
    "queue_capacity": 512,
    "last_acked_sequence": 87,
    "clock_synced": true,
    "queue_overflow_count": 0
  }
}
```

Respons sukses:

```json
{
  "status": "OK",
  "server_time": "2026-08-10T16:26:00.000Z",
  "device_status": "ONLINE",
  "last_heartbeat_at": "2026-08-10T16:26:00.000Z",
  "firmware_version": "1.0.0",
  "wifi_rssi": -61
}
```

Heartbeat endpoint adalah latest-health update, bukan event count, sehingga request ini tidak memakai `event_id`, `boot_id`, atau sequence. Tidak perlu menyimpan setiap heartbeat yang terlewat ke immutable event queue. Saat heartbeat gagal, retry dengan exponential backoff dan kirim snapshot diagnostik terbaru.

Backend juga menerima `HEARTBEAT` sebagai `event_type` di `/api/device/events`. Jika varian firmware memilih membuat heartbeat event, event tersebut wajib masuk ke sequence stream yang sama dan queue idempotent. Untuk pilot v1 jangan mengirim heartbeat yang sama ke kedua endpoint hanya untuk memperbarui status; gunakan `/api/device/heartbeat` agar firmware version, RSSI, dan diagnostic payload tersimpan.

## 7. Retry dan Reconnect

Gunakan exponential backoff dengan jitter untuk config, heartbeat, dan upload event:

```text
1s -> 2s -> 4s -> 8s -> 16s -> 32s -> maksimum 60s
jitter: 0% sampai 20%
```

Reset backoff setelah respons sukses yang valid. Hanya boleh ada satu upload worker untuk queue agar dua request tidak mengirim head queue secara tidak terkoordinasi.

Perlakuan respons:

| Kondisi | Tindakan firmware |
|---|---|
| Timeout, DNS/TLS error, koneksi putus | Simpan queue, retry payload yang sama dengan backoff |
| `500 INTERNAL_ERROR` | Simpan seluruh event tanpa ACK, retry batch |
| `200` + `ACCEPTED` | Hapus event yang cocok dari queue |
| `200` + `DUPLICATE` | Hapus event yang cocok dari queue |
| `200` tetapi body/identity tidak cocok | Anggap tanpa ACK; jangan hapus |
| `400 VALIDATION_ERROR` | Masuk protocol fault; jangan mutasi/drop event; laporkan untuk perbaikan firmware |
| `400 DEVICE_LINE_MISMATCH` | Hentikan retry cepat; provisioning line salah |
| `401 UNAUTHORIZED` | Hentikan retry cepat; credential perlu diprovision ulang |
| `404 DEVICE_UNREGISTERED` | Hentikan retry cepat; device belum terdaftar |

Retry sebuah event harus mempertahankan seluruh payload, termasuk `event_id`, `boot_id`, `sequence`, `device_time`, `event_type`, dan `event_mode`. Mengubah salah satunya membuat retry tidak lagi merepresentasikan event fisik yang sama.

## 8. Batas Session dan Pergantian Truk

Firmware tidak menentukan receiving mana yang aktif. Backend melakukan assignment saat memegang lock line yang sama dengan start, finish, dan cancel session.

Konsekuensi deterministik:

- event yang commit sebelum finish masuk hasil final session;
- event yang diproses setelah finish menjadi `UNASSIGNED`;
- `device_time` yang lebih lama tidak memaksa event masuk ke session yang sudah selesai;
- queued event Truck A yang baru dikirim setelah Truck B dimulai dapat ter-assign ke session yang aktif saat itu.

Karena queue berada di perangkat, pergantian Truck A ke Truck B wajib mengikuti SOP ini:

1. Hentikan aliran ayam melewati sensor.
2. Pastikan jaringan dan device berstatus ONLINE.
3. Tunggu `queue_depth = 0` dan seluruh detection telah mendapat ACK.
4. Cocokkan counter UI dengan counter manual lapangan.
5. Finish Truck A dan tunggu konfirmasi sukses.
6. Pastikan tidak ada ayam melewati sensor di antara session.
7. Start Truck B dan tunggu session aktif tampil.
8. Baru lanjutkan aliran ayam.

Jika queue tidak dapat dikosongkan, jangan melanjutkan pergantian truk. Bila operasi terpaksa diteruskan, event terlambat akan mengikuti aturan assignment backend dan selisih harus masuk proses review; actual tidak boleh diedit langsung.

## 9. Kegagalan Listrik dan Batas Sistem

Kontrak MVP sengaja tidak menulis flash untuk setiap detection karena umur tulis dan keterbatasan ESP32. Dampaknya harus diterima secara eksplisit:

- event RAM yang belum mendapat ACK hilang jika daya MCU mati;
- event yang sudah mendapat ACK tetap aman di PostgreSQL dan retry tidak menggandakannya;
- sequence gap tidak boleh diubah menjadi count tambahan;
- backend tidak dapat mengambil “count terakhir” dari sequence karena sequence adalah identitas/idempotency, bukan total actual;
- `device_time` tidak dapat digunakan untuk merekonstruksi event yang tidak pernah diterima;
- ayam yang melewati sensor ketika ESP32, sensor, jaringan buffer, dan server path seluruhnya tidak mampu mencatat tidak dapat direkonstruksi oleh software.

Mitigasi operasional pilot:

- gunakan catu daya stabil/UPS sesuai kebutuhan site;
- hentikan flow ketika device offline, clock invalid, queue penuh, atau sensor fault;
- tunggu queue kosong sebelum finish dan pergantian truk;
- catat pembanding counter manual selama pilot;
- investigasi selisih melalui reconciliation dan audit, tanpa mengedit actual.

## 10. State Machine Minimum Firmware

```text
BOOT
  -> buat boot_id + sequence 0
  -> init queue
  -> sinkron waktu + config + auth
  -> enqueue DEVICE_RESTART
  -> READY

READY
  -> detection: enqueue immutable event
  -> upload worker: kirim FIFO batch
  -> heartbeat worker: kirim health snapshot
  -> network gagal: DEGRADED_LOCAL + backoff
  -> queue penuh / clock invalid / sensor fault: FAULT

DEGRADED_LOCAL
  -> event tetap masuk RAM selama kapasitas tersedia
  -> reconnect dengan backoff
  -> ACK event tertunda
  -> queue kosong: READY

FAULT
  -> hentikan flow secara operasional
  -> jangan drop atau mengarang event
  -> tunggu intervensi/restart terkontrol
```

## 11. Checklist Implementasi Firmware

- [ ] UUID v4 baru dibuat tepat sekali pada setiap MCU boot.
- [ ] `boot_id` tidak berubah saat reconnect atau retry.
- [ ] `DEVICE_RESTART` memakai sequence 0.
- [ ] Satu allocator sequence dipakai semua event `/api/device/events`.
- [ ] Detection ISR tidak melakukan HTTP dan tidak mengalokasikan sequence secara race-prone.
- [ ] Payload event disimpan immutable di RAM sampai ACK.
- [ ] `ACCEPTED` dan `DUPLICATE` diperlakukan sebagai ACK.
- [ ] HTTP error/timeout tidak menghapus queue.
- [ ] Upload FIFO dan maksimum mengikuti config, tidak lebih dari 100.
- [ ] Backoff memiliki batas maksimum dan jitter.
- [ ] Clock harus valid sebelum production flow.
- [ ] Heartbeat mengirim firmware, RSSI, queue depth, capacity, dan fault diagnostics.
- [ ] Queue overflow terlihat sebagai fault dan tidak silent.
- [ ] Secret tidak pernah muncul di log atau diagnostic payload.
- [ ] Build pilot mencatat firmware version/commit untuk evidence field test.

## 12. Field Test Wajib

Hasil aktual dicatat di [ESP32_FIELD_TEST_RESULTS.md](./ESP32_FIELD_TEST_RESULTS.md). Semua test wajib memakai counter manual independen sebagai pembanding.

### FT-01 — Normal counting

1. Pastikan queue kosong dan device ONLINE.
2. Start receiving dengan manifest yang diketahui.
3. Lewatkan minimal 20 trigger fisik sambil menghitung manual.
4. Tunggu queue kosong, lalu finish.
5. Pastikan actual sama dengan jumlah event unik yang diterima dan tidak ada edit manual.

### FT-02 — Wi-Fi putus lalu kembali

1. Start session dan kirim beberapa detection online.
2. Putuskan Wi-Fi tanpa reboot ESP32.
3. Buat beberapa detection dan catat `queue_depth`.
4. Sambungkan Wi-Fi.
5. Pastikan boot ID tetap, queued event diterima tepat satu kali, dan queue kembali nol.

### FT-03 — API timeout setelah request terkirim

1. Buat satu detection.
2. Simulasikan respons ACK hilang/timeout sehingga firmware tidak tahu hasil request pertama.
3. Biarkan firmware retry payload identik.
4. Pastikan respons retry `DUPLICATE` atau event hanya tersimpan satu kali dan actual bertambah satu.

### FT-04 — Duplicate retry eksplisit

1. Rekam payload detection yang sudah diterima.
2. Kirim ulang payload yang sama.
3. Pastikan `duplicates` bertambah, actual tidak berubah, dan firmware menerima ACK.

### FT-05 — ESP32 restart

1. Rekam `boot_id` dan sequence boot A.
2. Restart ESP32.
3. Pastikan boot B mempunyai UUID baru dan `DEVICE_RESTART` sequence 0.
4. Detection berikutnya memakai stream boot B dan diterima.
5. Catat bahwa item RAM boot A yang belum ACK memang tidak dapat dipulihkan.

### FT-06 — Server restart

1. Buat session aktif dan pastikan firmware normal.
2. Hentikan aplikasi/server sementara, tetapi biarkan ESP32 dan sensor aktif.
3. Buat detection hingga tersimpan di queue RAM.
4. Jalankan server kembali.
5. Pastikan reconnect/backoff bekerja dan seluruh queued event diterima tepat satu kali.

### FT-07 — Finish bersamaan dengan detection

1. Koordinasikan detection tepat di sekitar request finish.
2. Verifikasi event yang commit sebelum finish berada pada final actual.
3. Verifikasi event yang diproses setelah finish menjadi `UNASSIGNED`.
4. Pastikan tidak ada event assigned yang hilang dari reconciliation.

### FT-08 — Heartbeat berhenti

1. Hentikan heartbeat tanpa mengubah status lewat database.
2. Tunggu melewati degraded threshold lalu offline threshold.
3. Pastikan UI berubah DEGRADED lalu OFFLINE.
4. Aktifkan heartbeat dan pastikan status kembali ONLINE.

### FT-09 — Pergantian Truck A ke Truck B

1. Count Truck A.
2. Hentikan flow dan tunggu queue nol.
3. Finish Truck A.
4. Start Truck B.
5. Lanjutkan detection.
6. Pastikan event dan actual kedua truck terpisah, tanpa pindah data manual.

### FT-10 — Demo pilot end-to-end

1. Admin membuat/publish receiving melalui UI.
2. Operator/Admin start counting.
3. Jalankan detection, retry, dan pantau realtime.
4. Finish melalui UI.
5. Buka detail, report, reconciliation, dan audit.
6. Pastikan seluruh alur selesai tanpa akses database dan tanpa mengedit actual.

## 13. Kriteria Go/No-Go Pilot

Pilot dinyatakan **GO** hanya jika:

- seluruh FT-01 sampai FT-10 berstatus LULUS;
- tidak ada event ganda pada retry;
- reboot selalu menghasilkan boot ID baru dan sequence nol;
- queue reconnect terbukti terkirim tepat satu kali;
- batas finish dan pergantian truk dipahami operator;
- kapasitas RAM dan laju maksimum sudah diuji;
- perbedaan terhadap counter manual dicatat dan disetujui pemilik proses;
- tidak ada secret default atau secret yang bocor ke log;
- demo selesai tanpa database access atau manual actual editing.

Jika salah satu invariant identitas, idempotency, assignment boundary, atau queue overflow gagal, status pilot adalah **NO-GO** sampai firmware/backend terkait diperbaiki dan test diulang.
