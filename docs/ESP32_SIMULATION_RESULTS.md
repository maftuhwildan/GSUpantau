# Hasil Simulasi ESP32 Tanpa Sensor

Dokumen ini mencatat pengujian integrasi menggunakan ESP32-S3 fisik dengan input detection buatan dari Serial, tombol BOOT, atau auto-burst. Hasil di sini tidak menggantikan field test sensor pada [ESP32_FIELD_TEST_RESULTS.md](./ESP32_FIELD_TEST_RESULTS.md).

Status keseluruhan: **INTEGRASI DASAR BERHASIL - SKENARIO FORMAL BELUM LENGKAP**

## Milestone Integrasi Dasar 11 Agustus 2026

ESP32-S3 fisik berhasil di-flash dengan firmware simulator dan terhubung ke backend lokal
tanpa sensor. Observasi interaktif yang sudah terlihat pada Serial Monitor dan UI Admin:

- config perangkat diterima dan firmware masuk state `READY`;
- `DEVICE_RESTART` sequence nol diterima dengan ACK;
- heartbeat diterima dan perangkat tampil `ONLINE`;
- detection mode `TEST` diterima realtime tanpa menambah actual produksi;
- detection tanpa sesi aktif menjadi `UNASSIGNED`;
- detection mode `PRODUCTION` saat sesi aktif menjadi `ASSIGNED` dan menambah actual;
- sequence detection terlihat berurutan pada log perangkat dan UI;
- RAM queue kembali nol setelah ACK pada pengujian dasar.

Ini adalah bukti bahwa jalur integrasi ESP32, Wi-Fi, API backend, ACK dasar, heartbeat,
dan realtime UI dapat digunakan tanpa sensor. Ini belum merupakan eksekusi formal seluruh
ST-01 sampai ST-10 karena reconnect queue, dropped ACK, power loss, finish boundary,
Truck A ke Truck B, serta overflow belum dicatat dengan evidence lengkap.

## Identitas Pelaksanaan

| Data | Nilai |
|---|---|
| Test execution ID | SIM-ESP32S3-20260811-BASIC |
| Tanggal/waktu | 11 Agustus 2026, pengujian interaktif |
| Penguji | Pengembang lokal |
| Device code | ESP32-S3-TEST-01 |
| Line code | LINE-01 |
| Board | ESP32-S3 DevKitC-1/WROOM |
| Firmware version | 0.1.0-sim |
| Firmware commit/hash | Commit milestone proyek ini; catat hash eksplisit pada run formal |
| Backend commit/hash | Commit milestone proyek ini; catat hash eksplisit pada run formal |
| Base URL | Disensor; catat hanya lokal/deployment |
| Queue capacity | 256 event, belum divalidasi soak test |
| Jaringan/AP | Wi-Fi lokal; Tailscale exit node harus nonaktif agar LAN dapat diakses |

Jangan mencatat Wi-Fi password, device secret, session cookie, `DATABASE_URL`, atau credential lain dalam evidence.

## Ringkasan Skenario

Gunakan status `BELUM DIJALANKAN`, `LULUS SIMULASI`, `GAGAL`, atau `TERHALANG`.

| ID | Skenario simulasi | Status | Evidence | Catatan |
|---|---|---|---|---|
| ST-01 | Boot ID baru dan sequence nol | BELUM DIJALANKAN | - | - |
| ST-02 | Normal counting 20 trigger Serial | BELUM DIJALANKAN | - | - |
| ST-03 | Network off, RAM queue, reconnect | BELUM DIJALANKAN | - | - |
| ST-04 | ACK diabaikan dan duplicate retry | BELUM DIJALANKAN | - | - |
| ST-05 | MCU reboot dan kehilangan queue RAM | BELUM DIJALANKAN | - | - |
| ST-06 | Server berhenti lalu kembali | BELUM DIJALANKAN | - | - |
| ST-07 | Finish berdekatan dengan detection | BELUM DIJALANKAN | - | - |
| ST-08 | Heartbeat DEGRADED/OFFLINE/ONLINE | BELUM DIJALANKAN | - | - |
| ST-09 | SOP Truck A ke Truck B dengan queue nol | BELUM DIJALANKAN | - | - |
| ST-10 | Burst, kapasitas queue, dan overflow fault | BELUM DIJALANKAN | - | - |

## Catatan per Run

Tambahkan satu baris per run dan jangan menimpa hasil gagal.

| Test ID | Run | Boot ID awal/akhir | Sequence awal/akhir | Trigger manual | Actual server | Assigned | Unassigned | Duplicate | Queue puncak/akhir | Mode | Status | Evidence/catatan |
|---|---:|---|---|---:|---:|---:|---:|---:|---|---|---|---|
| - | - | - | - | - | - | - | - | - | - | - | BELUM DIJALANKAN | - |

## Keputusan

Kelulusan seluruh skenario di dokumen ini hanya membuktikan integrasi firmware simulator, jaringan, dan backend. Keputusan pilot tetap **NO-GO - BELUM DIUJI FISIK** sampai seluruh FT-01 sampai FT-10 pada dokumen field test lulus menggunakan sensor lengkap dan counter manual independen.
