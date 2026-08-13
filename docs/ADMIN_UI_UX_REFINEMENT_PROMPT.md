# Prompt Agent Admin UI/UX Refinement

Salin prompt berikut ke conversation agent implementasi yang baru.

---

Implementasikan tahap Admin UI/UX Refinement pada repository Poultry Receiving Counter
System ini.

Sebelum mengubah kode:

1. Baca `AGENTS.md`.
2. Baca seluruh dokumen wajib dalam urutan yang ditentukan `AGENTS.md`.
3. Baca penuh `docs/ADMIN_UI_UX_REFINEMENT.md`.

`docs/ADMIN_UI_UX_REFINEMENT.md` adalah spesifikasi decision-complete dan sumber kebenaran
untuk task ini. Jangan meminta keputusan desain yang sudah dikunci di dalamnya dan jangan
memperluas scope.

Aturan Git:

1. Gunakan commit `f8f796e` sebagai baseline.
2. Buat dan pindah ke branch baru `codex/admin-ui-ux-refinement` sebelum mengubah kode.
3. Periksa working tree dan pertahankan semua perubahan milik pengguna.
4. Jangan restore, stage, commit, atau mengubah empat penghapusan mockup berikut:
   - `docs/ui-mockups/poultry-receiving-admin-dashboard-v1.png`;
   - `docs/ui-mockups/poultry-receiving-dashboard-v1.png`;
   - `docs/ui-mockups/poultry-receiving-operator-dashboard-v1.png`;
   - `docs/ui-mockups/poultry-receiving-supervisor-dashboard-v1.png`.
5. Dokumen handoff yang sudah modified atau untracked bukan bagian commit implementasi.
6. Stage file implementasi secara eksplisit. Jangan gunakan `git add .` atau `git add -A`.

Implementasikan seluruh workstream dalam dokumen:

- sederhanakan hierarchy Dashboard Admin dengan jalur aktif sebagai prioritas dan kondisi
  sehat yang compact;
- pertahankan chart Manifest bar + Hasil sensor area/line serta layout Status/Analitik;
- pertahankan semua jalur pada grid dua kolom halaman Penghitungan;
- debounce pencarian Surat Jalan dan ganti native confirm publish dengan dialog shadcn;
- tambah type safety pada Aktivitas Sensor Admin;
- tambah mobile cards pada seluruh halaman data Admin yang ditentukan;
- ubah Master Data menjadi Tabs yang URL-persistent;
- buat Audit Detail mudah dibaca dengan field diff, raw JSON collapsible, dan redaction;
- pisahkan Edit Pengguna dari Reset Kata Sandi;
- tambah dirty-state, konfirmasi discard, dan sticky mobile save pada Pengaturan;
- standardisasi Bahasa Indonesia, density, target sentuh, motion-safe, dan accessibility;
- tambah seluruh unit/regression test yang dipersyaratkan.

Guardrail utama:

- Jangan mengubah schema, migration, autentikasi, role, endpoint, formula actual, formula
  laporan, atau lifecycle counting.
- Actual tetap hanya berasal dari immutable `sensor_events` dengan
  `DETECTION + PRODUCTION + ASSIGNED`.
- Pertahankan authorization dan line scoping backend.
- Pertahankan shared `CountingConsole`, sticky finish mobile, seluruh confirmation flow,
  serta tampilan dua jalur Admin.
- Jangan mengubah Dashboard atau flow Operator.
- Jangan mengganti chart Dashboard dengan chart lain dan jangan mengubah urutan layer area/
  garis Hasil sensor di atas batang Manifest.
- Pertahankan semantic token; jangan menambah utility warna palette langsung.
- Jangan menjalankan ulang preset shadcn atau mengganti design system dasar.
- Jangan mengirim credential, password, secret, cookie, atau URL database ke toast, log,
  dokumentasi, maupun commit.

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
  serta area yang perlu diperiksa pengguna secara manual;
- konfirmasi bahwa browser dan screenshot tidak digunakan.

---
