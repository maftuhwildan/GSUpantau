# Prompt Agent Implementasi Refinement UI Operator

Salin prompt berikut ke percakapan agent implementasi yang baru.

---

Kerjakan refinement UI Operator pada repository Poultry Receiving Counter System ini.

Sebelum mengubah kode, baca `AGENTS.md`, lalu baca seluruh dokumen wajib dalam urutan yang
ditentukan di sana. Setelah itu baca penuh `docs/OPERATOR_UI_REFINEMENT.md`; dokumen tersebut
adalah spesifikasi decision-complete dan menjadi sumber kebenaran untuk task ini.

Aturan Git:

1. Pastikan baseline adalah commit `8b3d5b3`.
2. Buat dan pindah ke branch baru `codex/operator-ui-refinement` sebelum mengubah kode.
3. Jangan restore, stage, commit, atau mengubah empat penghapusan mockup unstaged berikut:
   - `docs/ui-mockups/poultry-receiving-admin-dashboard-v1.png`;
   - `docs/ui-mockups/poultry-receiving-dashboard-v1.png`;
   - `docs/ui-mockups/poultry-receiving-operator-dashboard-v1.png`;
   - `docs/ui-mockups/poultry-receiving-supervisor-dashboard-v1.png`.
4. Jangan menyertakan perubahan pengguna yang tidak berkaitan ke commit.

Implementasikan hanya scope berikut:

- Dashboard Operator action-first dengan assigned line sebagai konteks non-interaktif.
- Hero sesi aktif atau idle state yang dapat memulai waiting truck pertama melalui
  `StartCountingDialog`.
- Preview waiting maksimal lima dengan total sebenarnya dari `waitingQueueCount`.
- Assigned/unassigned sebagai angka dan alert tanpa donut chart.
- Antrean Surat Jalan dengan panel `COUNTING` terpisah dari daftar `WAITING`.
- Sesi Aktif yang menampilkan `MEMUAT` selama load awal, badge assigned line untuk Operator,
  selector fallback bila Admin memperoleh lebih dari satu line, serta route empty state
  `/receiving-queue`.
- Aktivitas Sensor dengan filter tipe event dan assignment sesuai interaksi yang ditentukan.
- Tipe TypeScript eksplisit untuk data Dashboard Operator dan event sensor.
- Perluasan backward-compatible `GET /api/dashboard/operator` dengan
  `waitingQueueCount`.
- Validasi enum pada query `event_type` dan `assignment_status` di
  `GET /api/sensor-events`.
- Test API dan invariant komposisi UI yang tercantum pada dokumen spesifikasi.

Guardrail:

- Jangan mengubah Admin Dashboard, backend counting, autentikasi, schema, migration,
  endpoint mutasi, atau design system dasar.
- Jangan mengubah cara perhitungan actual. Actual hanya berasal dari immutable
  `sensor_events` dengan `DETECTION + PRODUCTION + ASSIGNED`.
- Pertahankan line scoping dan authorization backend.
- Pertahankan `CountingConsole` shared, sticky finish mobile, dan seluruh dialog konfirmasi.
- Operator tidak boleh melihat cancel session.
- Gunakan Bahasa Indonesia dan semantic token/shadcn yang sudah ada.
- Jangan mengulang perubahan global sidebar, typography, top header, atau `PageHeader` yang
  sudah ada di baseline.

Kerjakan sampai implementasi dan test selesai. Jalankan:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
git diff --check
```

Jangan membuka atau mengakses browser, jangan melakukan review visual, dan jangan mengambil
screenshot. Review tampilan pada 360, 390, 768, 1024, dan 1440 px akan dilakukan secara
manual oleh pengguna. Tetap implementasikan class responsif dan target sentuh sesuai
acceptance criteria, tetapi jangan mengklaim QA visual telah lulus.

Sebelum selesai, periksa diff dan status Git. Pastikan empat penghapusan mockup milik
pengguna tetap unstaged dan tidak ikut commit. Buat commit fokus untuk implementasi ini,
lalu laporkan branch, commit, file yang berubah, hasil validasi otomatis, blocker teknis,
serta area tampilan yang perlu diperiksa pengguna saat review manual.

---
