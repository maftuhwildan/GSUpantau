# Prompt Agent UI/UX Operational Hardening

Salin prompt berikut ke conversation agent implementasi yang baru.

---

Implementasikan tahap UI/UX Operational Hardening pada repository Poultry Receiving Counter
System ini.

Sebelum mengubah kode:

1. Baca `AGENTS.md`.
2. Baca seluruh dokumen wajib dalam urutan yang ditentukan `AGENTS.md`.
3. Baca penuh `docs/UI_UX_OPERATIONAL_HARDENING.md`.

`docs/UI_UX_OPERATIONAL_HARDENING.md` adalah spesifikasi decision-complete dan sumber
kebenaran untuk task ini. Jangan meminta keputusan desain yang sudah dikunci di dalamnya.

Aturan Git:

1. Gunakan commit `b5da8eb` sebagai baseline.
2. Buat dan pindah ke branch baru `codex/ui-ux-operational-hardening` sebelum mengubah kode.
3. Periksa working tree dan pertahankan perubahan milik pengguna.
4. Jangan restore, stage, commit, atau mengubah empat penghapusan mockup berikut:
   - `docs/ui-mockups/poultry-receiving-admin-dashboard-v1.png`;
   - `docs/ui-mockups/poultry-receiving-dashboard-v1.png`;
   - `docs/ui-mockups/poultry-receiving-operator-dashboard-v1.png`;
   - `docs/ui-mockups/poultry-receiving-supervisor-dashboard-v1.png`.
5. Dokumen handoff yang sudah untracked/modified juga bukan bagian commit implementasi.
6. Stage file implementasi secara eksplisit. Jangan gunakan `git add -A` atau `git add .`.

Implementasikan seluruh workstream dalam dokumen:

- indikator transport realtime dan waktu pembaruan authoritative terakhir;
- penyederhanaan hierarchy Dashboard Operator;
- progress yang tetap informatif ketika hasil sensor melebihi 100% manifest;
- standardisasi istilah Bahasa Indonesia dan perbaikan seluruh mojibake dalam source UI;
- kartu mobile serta progressive disclosure pada Aktivitas Sensor Operator dan Admin;
- official shadcn Sonner dan feedback mutasi utama yang konsisten;
- keterbacaan, target sentuh, motion-safe, aria-live, dan accessibility operasional;
- persistensi filter canonical melalui URL pada halaman yang ditentukan;
- unit/regression test untuk seluruh logika dan invariant penting.

Guardrail utama:

- Jangan mengubah schema, migration, autentikasi, role, endpoint mutasi, atau formula actual.
- Actual tetap hanya berasal dari immutable `sensor_events` dengan
  `DETECTION + PRODUCTION + ASSIGNED`.
- Pertahankan authorization dan line scoping backend.
- Pertahankan shared `CountingConsole`, sticky finish mobile, dan dialog konfirmasi start/
  finish.
- Operator tidak boleh memperoleh cancel session.
- Jangan mengubah Admin Dashboard di luar pola lintas aplikasi yang secara eksplisit masuk
  scope.
- Pertahankan semantic token dan jangan menambahkan utility warna palette langsung.
- Jangan menjalankan ulang preset shadcn atau mengganti design system dasar.
- Jangan mengirim credential, secret, cookie, atau URL database ke toast, log, dokumentasi,
  screenshot, atau commit.

Jalankan validasi spesifik selama pengerjaan, kemudian jalankan semuanya:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
git diff --check
```

Jangan membuka atau mengakses browser, jangan memakai browser automation, jangan melakukan
review visual, dan jangan mengambil screenshot. Pengguna akan melakukan review manual pada
360, 390, 768, 1024, dan 1440 px. Jangan mengklaim QA visual telah lulus.

Sebelum selesai:

- periksa seluruh diff dan `git status`;
- pastikan perubahan di luar scope dan perubahan pengguna tidak ikut commit;
- buat satu atau beberapa commit fokus pada branch baru;
- laporkan branch, commit, file utama, dependency baru, hasil validasi otomatis, blocker,
  dan area yang perlu diperiksa pengguna saat review manual;
- konfirmasi bahwa browser dan screenshot tidak digunakan.

---
