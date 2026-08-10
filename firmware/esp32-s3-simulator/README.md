# ESP32-S3 Sensor Simulator

Firmware ini menjalankan kontrak perangkat GSUpantau pada ESP32-S3 DevKitC-1/WROOM tanpa sensor. Detection dapat dipicu melalui Serial, tombol BOOT GPIO0, atau auto-burst. Tombol hanya menggantikan pulsa sensor untuk pengujian dan tidak mengontrol start, finish, atau pergantian truck.

Hasil pengujian firmware ini harus dicatat sebagai simulasi ESP32 tanpa sensor di `docs/ESP32_SIMULATION_RESULTS.md`. Pengujian ini tidak mengubah status field test fisik di `docs/ESP32_FIELD_TEST_RESULTS.md`.

## Prasyarat

- ESP32-S3 DevKitC-1/WROOM dan kabel USB data.
- PlatformIO Core atau ekstensi PlatformIO IDE.
- Laptop dan ESP32 berada pada jaringan Wi-Fi yang sama.
- Backend berjalan pada laptop dan dapat diakses melalui IPv4 LAN laptop.
- Line aktif serta device khusus pengujian sudah dibuat melalui halaman Admin.
- Device secret baru dari proses registrasi atau rotasi credential. Jangan gunakan secret seed atau simulator web.

Backend development sudah bind ke `0.0.0.0`. Jalankan dari root repository:

```powershell
npm run dev
```

Cari IPv4 LAN laptop, misalnya dengan:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' }
```

Pastikan Windows Firewall mengizinkan koneksi TCP ke port `3000` hanya dari jaringan lokal yang dipercaya.

## Provisioning Lokal

Salin `include/secrets.example.h` menjadi `include/secrets.h`, lalu isi:

- SSID dan password Wi-Fi;
- `BASE_URL` berupa `http://<IPv4-laptop>:3000` tanpa trailing slash;
- device code yang terdaftar;
- line code yang terikat pada device tersebut;
- one-time device secret dari halaman Admin.

`include/secrets.h` diabaikan Git. Firmware tidak mencetak secret ke Serial atau heartbeat. Build akan berhenti pada state FAULT jika placeholder masih digunakan.

## Build dan Flash

Jalankan dari direktori ini:

```powershell
pio run
pio run --target upload
pio device monitor
```

Monitor Serial menggunakan baud `115200`. Jika upload gagal karena port sedang dipakai, tutup monitor Serial lalu ulangi upload. Target default adalah `esp32-s3-devkitc-1`; konfigurasi saat ini memakai UART USB board agar log aplikasi terlihat pada COM port yang sama.

## Siklus Boot

Setiap boot firmware:

1. membuat UUID v4 baru sebagai `boot_id`;
2. mengosongkan RAM queue dan mengatur sequence ke nol;
3. menyambungkan Wi-Fi, mengambil config, dan menyinkronkan waktu;
4. membuat `DEVICE_RESTART` dengan sequence nol;
5. masuk READY dengan mode awal `TEST`.

Firmware tidak menerima detection sebelum waktu valid. Reconnect, timeout, dan retry tidak mengganti boot ID atau mereset sequence. Event RAM yang belum mendapat ACK hilang jika ESP32 mati atau reboot.

## Perintah Serial

| Perintah | Perilaku |
|---|---|
| `detect` | Enqueue satu `DETECTION` |
| `detect 20` | Enqueue 20 detection terkontrol |
| `burst 100 50` | Enqueue 100 detection dengan interval 50 ms |
| `mode test` | Event berikutnya memakai mode `TEST` dan tidak menambah KPI actual |
| `mode production` | Event berikutnya memakai mode `PRODUCTION`; gunakan hanya pada receiving uji |
| `network off` | Putus Wi-Fi tanpa reboot; event baru tetap masuk RAM queue |
| `network on` | Aktifkan reconnect dan upload FIFO |
| `heartbeat off` | Hentikan heartbeat untuk uji DEGRADED/OFFLINE |
| `heartbeat on` | Aktifkan kembali heartbeat |
| `drop_ack once` | Abaikan satu ACK valid dan kirim ulang body batch yang identik |
| `status` | Tampilkan boot ID, sequence, queue, mode, jaringan, dan fault tanpa secret |
| `reboot` | Controlled MCU reboot |
| `help` | Tampilkan daftar perintah |

Satu tekan tombol BOOT GPIO0 setara dengan `detect`. Debounce dilakukan di loop firmware. Jangan menahan tombol saat reset karena GPIO0 juga menentukan boot mode ESP32-S3.

## Perilaku Queue dan ACK

- Queue berkapasitas awal 256 event dan hanya berada di RAM.
- Event menyimpan `event_id`, `boot_id`, sequence, waktu, type, mode, dan JSON final saat enqueue.
- Satu batch in-flight dibekukan sehingga retry memakai body yang sama meskipun event baru masuk queue.
- Event hanya dihapus setelah HTTP 200 berisi identity yang cocok serta status `ACCEPTED` atau `DUPLICATE` untuk seluruh item batch.
- Timeout, HTTP 500, JSON tidak valid, dan ACK tidak cocok mempertahankan queue.
- HTTP 400, 401, atau 404 masuk protocol/provisioning fault dan menghentikan retry cepat.
- Batch upload mengikuti nilai config dengan hard ceiling 100.
- Queue penuh menghentikan trigger baru, menaikkan `queue_overflow_count`, dan tetap mengirim heartbeat/upload yang masih memungkinkan. Reboot terkontrol diperlukan setelah queue kosong dan penyebab diperiksa.

## Urutan Uji Awal

1. Jalankan backend dan pastikan device pengujian terdaftar pada line yang benar.
2. Flash firmware, buka Serial, dan tunggu `STATE READY` serta heartbeat `OK`.
3. Jalankan `status`; catat boot ID, sequence, firmware revision, dan queue.
4. Tetap pada mode TEST, jalankan `detect 20`, lalu pastikan queue kembali nol.
5. Start receiving uji, jalankan `mode production`, lalu `detect 20` dan bandingkan actual dengan counter manual.
6. Jalankan uji reconnect memakai `network off`, beberapa detection, `status`, lalu `network on`.
7. Jalankan duplicate retry dengan `drop_ack once` sebelum detection berikutnya.
8. Jalankan uji status perangkat memakai `heartbeat off` dan `heartbeat on`.
9. Sebelum finish atau berpindah Truck A ke Truck B, pastikan `queue=0`, cocokkan counter, lalu ikuti SOP pada `docs/ESP32_PROTOCOL.md`.

## Batas Simulasi

Firmware ini belum memverifikasi sensor, wiring, level tegangan, noise, debounce sensor nyata, posisi pemasangan, missed detection, double-trigger, atau laju ayam di line. FT-01 sampai FT-10 tetap berstatus BELUM DIUJI sampai perangkat lengkap diuji dengan trigger fisik dan counter manual independen.
