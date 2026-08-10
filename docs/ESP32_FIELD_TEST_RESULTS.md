# Hasil Field Test ESP32

Dokumen ini adalah lembar bukti pelaksanaan field test untuk kontrak [ESP32_PROTOCOL.md](./ESP32_PROTOCOL.md).

Status keseluruhan: **BELUM DIUJI**

Tidak ada hasil yang boleh ditandai LULUS tanpa perangkat fisik, bukti request/response, dan pembanding counter manual.

Pengujian ESP32 tanpa sensor dicatat terpisah di [ESP32_SIMULATION_RESULTS.md](./ESP32_SIMULATION_RESULTS.md). Status `LULUS SIMULASI` tidak mengubah hasil atau keputusan field test fisik dalam dokumen ini.

## Identitas Pelaksanaan

| Data | Nilai |
|---|---|
| Test execution ID | Belum diisi |
| Tanggal/waktu | Belum diisi |
| Site/lokasi | Belum diisi |
| Penguji | Belum diisi |
| Operator | Belum diisi |
| Reviewer/sign-off | Belum diisi |
| Device code | Belum diisi |
| Line code | Belum diisi |
| Firmware version | Belum diisi |
| Firmware commit/hash | Belum diisi |
| Backend commit/hash | Belum diisi |
| Model/revisi ESP32 | Belum diisi |
| Sensor/revisi rangkaian | Belum diisi |
| Queue capacity (event) | Belum diisi |
| Laju detection maksimum uji | Belum diisi |
| Jaringan/AP | Belum diisi |
| Sumber daya/UPS | Belum diisi |
| Degraded threshold | Belum diisi |
| Offline threshold | Belum diisi |

## Ringkasan Skenario

Gunakan status: `BELUM DIUJI`, `LULUS`, `GAGAL`, atau `TERHALANG`.

| ID | Skenario | Status | Evidence | Catatan |
|---|---|---|---|---|
| FT-01 | Normal counting | BELUM DIUJI | — | — |
| FT-02 | Wi-Fi putus lalu kembali | BELUM DIUJI | — | — |
| FT-03 | API timeout/ACK hilang | BELUM DIUJI | — | — |
| FT-04 | Duplicate retry eksplisit | BELUM DIUJI | — | — |
| FT-05 | ESP32 restart | BELUM DIUJI | — | — |
| FT-06 | Server restart | BELUM DIUJI | — | — |
| FT-07 | Finish bersamaan dengan detection | BELUM DIUJI | — | — |
| FT-08 | Heartbeat berhenti | BELUM DIUJI | — | — |
| FT-09 | Truck A ke Truck B | BELUM DIUJI | — | — |
| FT-10 | Demo pilot end-to-end | BELUM DIUJI | — | — |

## Catatan Pengukuran per Run

Tambahkan satu baris untuk setiap run. Jangan menimpa run gagal; append run perbaikan sebagai bukti historis.

| Test ID | Run | Boot ID awal/akhir | Sequence awal/akhir | Trigger manual | Actual server | Assigned | Unassigned | Duplicate | Queue puncak/akhir | Selisih actual-manual | Status | Evidence/catatan |
|---|---:|---|---|---:|---:|---:|---:|---:|---|---:|---|---|
| — | — | — | — | — | — | — | — | — | — | — | BELUM DIUJI | — |

Rumus pembanding:

```text
selisih = actual server - counter manual
persentase selisih = (selisih / counter manual) * 100%
```

Jika counter manual nol, persentase tidak dihitung.

## Bukti Minimum per Skenario

- timestamp mulai dan selesai;
- device code dan line code;
- firmware dan backend commit/hash;
- `boot_id` serta rentang sequence;
- payload event contoh dan respons ACK;
- actual sebelum/sesudah;
- jumlah assigned, unassigned, dan duplicate;
- queue depth puncak dan akhir;
- screenshot UI atau log ter-redaksi;
- pembanding counter manual;
- nama penguji dan reviewer.

Secret device, cookie session, database URL, dan credential lain wajib disensor dari evidence.

## Defect dan Tindak Lanjut

| Defect ID | Test ID | Severity | Deskripsi | Dampak count | Owner | Status | Retest |
|---|---|---|---|---|---|---|---|
| — | — | — | Belum ada hasil uji | — | — | OPEN | — |

## Keputusan Pilot

| Pemeriksaan | Nilai |
|---|---|
| Semua FT-01..FT-10 lulus | BELUM |
| Tidak ada duplicate actual | BELUM DIBUKTIKAN |
| Reboot boot ID/sequence benar | BELUM DIBUKTIKAN |
| Queue reconnect tepat satu kali | BELUM DIBUKTIKAN |
| Kapasitas queue memadai | BELUM DIBUKTIKAN |
| Selisih manual diterima process owner | BELUM |
| Demo tanpa DB/manual actual edit | BELUM DIBUKTIKAN |
| Keputusan | **NO-GO — BELUM DIUJI** |

## Sign-off

| Peran | Nama | Keputusan | Tanggal | Catatan |
|---|---|---|---|---|
| Firmware engineer | — | — | — | — |
| Backend/reviewer | — | — | — | — |
| Operator/site representative | — | — | — | — |
| Process owner | — | — | — | — |
