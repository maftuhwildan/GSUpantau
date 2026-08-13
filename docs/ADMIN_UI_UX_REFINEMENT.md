# Admin UI/UX Refinement

## Status Dokumen

Dokumen ini merupakan spesifikasi decision-complete untuk refinement seluruh pengalaman
Admin. Dokumen ini hanya mendefinisikan rencana implementasi bagi agent lain; pembuatan
dokumen tidak mengubah kode aplikasi.

Audit dilakukan terhadap struktur, komponen, state, copy, dan perilaku responsif yang
terlihat dari source pada baseline commit `f8f796e`. Runtime browser lokal tidak dapat
dimulai karena kegagalan penulisan asset kernel pada environment agent. Karena itu,
dokumen ini tidak mengklaim hasil review visual aktual. Review visual akhir tetap dilakukan
manual oleh pengguna.

Agent implementasi wajib membuat branch baru:

```text
codex/admin-ui-ux-refinement
```

dari baseline commit:

```text
f8f796e
```

## Penilaian Saat Ini

Foundation UI Admin sudah kuat dan tidak membutuhkan redesign besar. Sidebar, top header,
PageHeader compact, semantic token, komponen shadcn, hierarchy umum, serta chart utama
sudah konsisten. Kekurangan utama berada pada lapisan usability:

- Dashboard Admin masih padat dan memberi bobot visual yang hampir sama pada informasi
  kritis, kondisi sehat, dan informasi sekunder.
- Sejumlah halaman tabel belum memiliki representasi mobile yang nyaman dipindai.
- Copy masih bercampur Bahasa Indonesia dan Inggris.
- Beberapa aksi sensitif atau destruktif belum memakai dialog konfirmasi yang konsisten.
- Master Data terlalu panjang karena tiga domain ditumpuk dalam satu halaman.
- Audit Trail menyajikan perubahan sebagai JSON mentah sebelum ringkasan yang mudah dibaca.
- Pengaturan belum membedakan muat ulang data dengan membatalkan perubahan lokal.
- Ukuran beberapa tombol ikon di mobile belum memenuhi target sentuh 44 px.

Target tahap ini adalah menjadikan UI Admin lebih mudah dipindai, lebih aman ketika
melakukan mutasi, dan lebih nyaman di mobile tanpa mengubah design system atau alur bisnis.

## Scope

Refinement mencakup:

- Dashboard Admin;
- Penghitungan;
- Surat Jalan;
- Aktivitas Sensor Admin;
- Laporan Operasional;
- Audit Trail;
- Master Data;
- Jalur & Perangkat;
- Kelola Pengguna;
- Pengaturan Sistem;
- helper presentasi, tipe TypeScript, dialog, serta test yang dibutuhkan oleh perubahan
  tersebut.

## Di Luar Scope

- Dashboard dan halaman Operator;
- sidebar, top header, PageHeader, dan design system dasar;
- dark mode;
- perubahan schema atau migration;
- perubahan autentikasi, role, session, dan authorization;
- perubahan API kecuali penyesuaian client yang memakai kontrak existing;
- perubahan formula actual, laporan, atau lifecycle counting;
- pagination baru;
- perubahan chart Manifest versus Actual menjadi jenis chart lain;
- browser automation, screenshot, dan pernyataan bahwa QA visual telah lulus.

## Guardrail Produk dan Engineering

- Actual hanya berasal dari immutable `sensor_events` dengan kombinasi
  `DETECTION + PRODUCTION + ASSIGNED`.
- Actual tidak boleh dapat diedit langsung.
- Pertahankan authorization dan line scoping pada backend.
- Pertahankan transaksi audit atomic dan broadcast setelah commit.
- Pertahankan SOP Truck A selesai sebelum Truck B dimulai.
- Start, finish, cancel session, publish, dan aksi sensitif tetap melalui konfirmasi.
- `CountingConsole` tetap shared antara Admin dan Operator.
- Jangan mengubah perilaku Operator sebagai efek samping refinement Admin.
- Gunakan Tailwind CSS 4, semantic token, shadcn/ui, dan lucide-react existing.
- Jangan menambahkan utility warna palette langsung pada kode aplikasi.
- Jangan menjalankan ulang preset shadcn atau mengganti base primitive.
- Pertahankan remap bobot font global yang telah disetujui pengguna.
- Gunakan target sentuh minimal 44 x 44 px pada mobile.
- Copy utama menggunakan Bahasa Indonesia; enum backend tetap tidak berubah.
- Jangan pernah menampilkan credential, password, secret, cookie, atau `DATABASE_URL` pada
  toast, log, dokumentasi, maupun dialog selain one-time secret yang memang sudah ada.

## Kondisi Git yang Harus Dipertahankan

Sebelum bekerja, agent wajib menjalankan `git status` dan membedakan perubahan baseline,
perubahan pengguna, serta perubahan implementasinya sendiri.

Jangan restore, stage, commit, atau mengubah empat penghapusan mockup milik pengguna:

- `docs/ui-mockups/poultry-receiving-admin-dashboard-v1.png`;
- `docs/ui-mockups/poultry-receiving-dashboard-v1.png`;
- `docs/ui-mockups/poultry-receiving-operator-dashboard-v1.png`;
- `docs/ui-mockups/poultry-receiving-supervisor-dashboard-v1.png`.

Dokumen handoff yang sudah modified atau untracked juga bukan bagian commit implementasi
kecuali pengguna meminta secara eksplisit. Stage file implementasi satu per satu. Jangan
memakai `git add .` atau `git add -A`.

## 1. Dashboard Admin

### Arah Hierarchy

Pertahankan struktur utama dan chart yang sudah ada. Urutan perhatian dikunci menjadi:

1. kondisi yang membutuhkan tindakan: perangkat bermasalah, deteksi tanpa sesi, dan review;
2. ringkasan operasional hari ini;
3. jalur yang sedang menghitung;
4. analitik Manifest versus Hasil sensor;
5. jalur idle dan aktivitas terbaru.

Jangan menambahkan hero baru atau mengulang judul halaman di dalam konten.

### Alert yang Membutuhkan Tindakan

- `Deteksi tanpa sesi` dan `Perlu ditinjau` hanya menjadi alert besar ketika nilainya lebih
  dari nol.
- Ketika keduanya nol, ganti area tersebut dengan satu status sehat compact, bukan dua Card
  besar bernilai nol.
- Perangkat `OFFLINE`, `DEGRADED`, stale, `MAINTENANCE`, atau `UNREGISTERED` harus terlihat
  melalui badge teks dan alert semantic.
- Kondisi sehat tidak memerlukan alert hijau berukuran besar.
- Setiap alert memiliki tujuan tindakan yang jelas, misalnya menuju Aktivitas Sensor atau
  Jalur & Perangkat dengan filter/konteks yang relevan bila route existing mendukungnya.

### Status Operasional Jalur

- Ubah judul menjadi `Status Operasional Jalur`.
- Urutkan jalur yang sedang menghitung sebelum jalur idle.
- Jalur aktif mempertahankan detail truk, Surat Jalan, manifest, hasil sensor, selisih,
  progress, heartbeat, serta deteksi terakhir.
- Jalur idle menjadi ringkasan compact: status kesiapan, kondisi perangkat, jumlah antrean,
  dan aksi membuka Penghitungan. Jangan menampilkan placeholder metrik sesi yang tidak ada.
- Pertahankan layout Status Jalur dan Analitik berdampingan pada desktop sesuai keputusan
  desain sebelumnya; stack secara natural pada layar lebih sempit.
- Gunakan helper `getCountingProgressPresentation` yang sudah ada. Jangan menghitung progress
  baru dengan `Math.min(100, ...)` untuk label karena overcount harus tetap terlihat sebagai
  nilai di atas 100%, sementara lebar bar boleh dibatasi 100%.
- Animasi status hanya memakai variant `motion-safe`.

### Ringkasan Operasional dan Analitik

- Pertahankan empat metrik utama: Total Manifest, Hasil sensor selesai, Truk selesai, dan
  Selisih akhir.
- Gunakan istilah `Hasil sensor`, bukan `Actual`, pada copy utama.
- Pertahankan chart composed existing: Manifest berupa batang; Hasil sensor berupa area
  gradient dan garis yang dirender di atas batang.
- Pertahankan periode 7 hari, 30 hari, dan rentang khusus. Simpan periode aktif pada URL agar
  reload dan navigasi kembali merekonstruksi tampilan yang sama.
- Nilai default tidak perlu ditulis ke URL; rentang khusus tetap menggunakan kontrak
  date-only `YYYY-MM-DD`.
- Jangan mengubah formula, aggregation, timezone, atau endpoint analitik.

### Aktivitas Terbaru

- `Penerimaan Terbaru` memakai kartu pada mobile dan tabel pada `md` ke atas.
- `Audit Terbaru` memakai label hasil format dari helper audit, bukan enum mentah.
- Informasi utama mobile: waktu, Surat Jalan/aksi, jalur/aktor, status, dan nilai penting.
- Metadata teknis boleh tetap `text-xs`; label status dan tindakan minimal `text-sm`.

## 2. Penghitungan Admin

- Pertahankan semua jalur tampil langsung dan layout dua kolom pada desktop. Jangan mengganti
  halaman menjadi tabs atau selector satu jalur karena pengguna sudah memilih model dua
  jalur simultan.
- Pertahankan shared `CountingConsole`, cancel session khusus Admin, sticky finish mobile,
  realtime refetch, polling fallback, dan seluruh dialog konfirmasi.
- Selama request belum selesai, tampilkan `Memuat`; jangan menampilkan status idle palsu.
- Gunakan label UI `Sedang dihitung`, `Siap`, `Jalur`, `Truk`, dan `Penghitungan`.
- Enum teknis boleh menjadi informasi sekunder bila membantu diagnosis.
- Jangan mengubah layout 2+1 internal `CountingConsole` atau lifecycle start/finish/cancel.

## 3. Surat Jalan

### Pencarian dan Filter

- Pisahkan nilai input pencarian lokal dari nilai query yang sudah dikomit.
- Terapkan debounce 300 ms sebelum memperbarui URL dan refetch.
- Perubahan status tetap langsung memperbarui URL.
- Reset menghapus parameter filter halaman dan mempertahankan query asing.
- Jangan memanggil `router.replace` atau API pada setiap render atau pada nilai filter yang
  identik.

### Konfirmasi Publish

- Hapus pemakaian native `window.confirm`/`confirm` untuk publish.
- Buat composition dialog shadcn `PublishReceivingDialog`.
- Dialog menampilkan No. Surat Jalan, plat/truk, supplier, manifest, dan jalur tujuan.
- Tombol konfirmasi menggunakan label progres dan disabled selama request untuk mencegah
  double-submit.
- Error validasi atau server terlihat di dialog; success memakai toast existing.
- Pertahankan `StartCountingDialog`, authorization, status transition, dan API existing.

### Presentasi

- Pertahankan kartu mobile dan tabel desktop existing.
- Gunakan `Muat ulang`, bukan `Refresh`.
- Status utama: `Draf`, `Menunggu`, `Sedang dihitung`, `Selesai`, dan `Dibatalkan`.

## 4. Aktivitas Sensor Admin

- Pertahankan filter URL, interlock tipe event/assignment, realtime refetch, kartu mobile,
  tabel desktop, dan detail teknis existing.
- Ganti `any` pada data utama dengan tipe eksplisit, minimal untuk event, jalur, perangkat,
  assignment, session context, dan payload response.
- Gunakan `unknown` serta type guard untuk payload WebSocket/error yang belum dipercaya.
- Copy utama menggunakan `Deteksi`, `Heartbeat`, `Mulai ulang perangkat`, `Terhubung sesi`,
  dan `Tanpa sesi`.
- Line/perangkat/sequence/boot ID tetap tersedia untuk diagnosis Admin, tetapi data teknis
  tidak boleh mengalahkan waktu, tipe event, dan status assignment pada kartu mobile.
- Jangan mengubah filter API atau mengurangi field diagnostik.

## 5. Laporan Operasional

- Pertahankan KPI, formula laporan, chart, CSV, date-only filter, dan batas chart maksimal
  12 penerimaan tanpa membatasi tabel atau CSV.
- Pertahankan filter aktif ketika export CSV.
- Tambahkan kartu penerimaan selesai pada mobile dan pertahankan tabel pada `md` ke atas.
- Kartu mobile menampilkan tanggal selesai, No. Surat Jalan, jalur, manifest, hasil sensor,
  dan selisih.
- Gunakan tabular numerals dan label selisih eksplisit `Kurang`, `Sesuai`, atau `Lebih`;
  warna tidak boleh menjadi satu-satunya pembeda.
- Pertahankan tinggi kontrol Rentang Tanggal dan Jalur yang sudah disejajarkan.
- Jangan mengubah semantics chart hanya demi konsistensi visual dengan Dashboard.

## 6. Audit Trail

### List Responsif

- Tambahkan kartu audit pada mobile dan pertahankan tabel pada `md` ke atas.
- Ringkasan kartu: waktu, aksi terformat, entitas terformat, aktor, dan identifier objek.
- Gunakan `formatAuditActionLabel` dan `formatAuditEntityLabel` secara konsisten di tabel,
  kartu, filter, dan dialog detail.

### Detail Perubahan

- Di dalam dialog, tampilkan ringkasan perubahan yang dapat dibaca manusia sebelum JSON.
- Untuk object before/after, hitung union key lalu tampilkan daftar atau tabel:
  `Field`, `Sebelum`, `Sesudah`.
- Field yang nilainya sama tidak perlu masuk ringkasan perubahan.
- Array/object nested boleh diformat ringkas; sediakan raw JSON sebagai fallback.
- Pindahkan raw JSON ke shadcn `Collapsible` berlabel `Lihat data mentah`.
- Nilai kosong menggunakan tanda `—`, bukan string `null` yang dominan.
- Tambahkan client-side redaction guard untuk key yang mengandung `password`, `secret`,
  `token`, `credential`, `cookie`, atau padanan sensitif lain. Jangan mengasumsikan respons
  API selalu sudah aman.
- Jangan mengubah sifat immutable audit log, endpoint, filter, atau limit existing.

## 7. Master Data

### Struktur Halaman

- Ganti tiga section panjang yang ditumpuk menjadi shadcn Tabs:
  `Truk`, `Supir`, dan `Supplier`.
- Tab aktif disimpan pada query `section=trucks|drivers|suppliers` menggunakan
  `router.replace`.
- Nilai tidak valid kembali ke `trucks`; nilai default tidak perlu ditulis ke URL.
- Setiap tab mempertahankan search, aksi tambah, loading, error, empty state, serta dialog
  domainnya sendiri.
- Berpindah tab tidak boleh menghapus state form yang sedang tersimpan di server atau
  memodifikasi data.

### Responsif dan Maintainability

- Gunakan kartu mobile dan tabel desktop untuk ketiga domain.
- Kartu menampilkan identifier utama, informasi kontak/plat, status aktif, dan menu aksi.
- Target sentuh aksi mobile minimal 44 px.
- `MasterDataClient` boleh dipecah menjadi komponen per domain agar perubahan dapat dirawat,
  tetapi hindari abstraction generik yang menyembunyikan perbedaan field dan aturan bisnis.
- Pertahankan API, snapshot historis, validasi, serta mekanisme aktif/nonaktif existing.

## 8. Jalur & Perangkat

- Pertahankan Card per jalur dan tabel perangkat pada desktop.
- Pada mobile, ubah daftar perangkat menjadi kartu; jangan mengandalkan scroll horizontal.
- Header Card jalur harus dapat wrap tanpa menimpa status dan aksi.
- Tombol ikon edit/tambah/rotasi/aktif-nonaktif minimal 44 x 44 px pada mobile dan memiliki
  `aria-label`; desktop boleh tetap compact.
- Status utama menggunakan `Online`, `Peringatan`, `Offline`, `Perawatan`, dan
  `Belum terdaftar` dengan enum teknis sebagai detail bila dibutuhkan.
- Pertahankan one-time secret dialog serta rotasi credential. Secret baru hanya boleh muncul
  pada dialog tersebut, tidak pada toast, log, atau summary card.
- Jangan mengubah API, model perangkat, heartbeat rules, atau ingestion.

## 9. Kelola Pengguna

### List Responsif

- Tambahkan kartu pengguna pada mobile dan pertahankan tabel desktop.
- Kartu menampilkan nama, username, role, status aktif, dan menu aksi.
- Tetap tampilkan proteksi terhadap deactivation diri sendiri dan Admin aktif terakhir.

### Pisahkan Edit dan Reset Kata Sandi

- Ganti dialog gabungan `Edit Pengguna & Reset Password` menjadi dua alur:
  `Edit Pengguna` dan `Reset Kata Sandi`.
- Dialog Edit hanya berisi field profil, role, dan status yang memang dapat diubah.
- Dialog Reset berisi kata sandi baru dan konfirmasi kata sandi.
- Terapkan minimum 12 karakter dan validasi kedua input harus sama sebelum submit.
- Dialog Reset harus menjelaskan bahwa sesi/credential terdampak sesuai perilaku backend
  existing; jangan mengarang invalidasi session bila API tidak melakukannya.
- Keduanya boleh menggunakan endpoint existing dengan payload yang sesuai. Jangan membuat
  endpoint baru bila tidak diperlukan.
- Tombol submit disabled saat request, error inline, dan toast success tanpa menyertakan
  password.
- Copy utama memakai `Pengguna`, `Peran`, `Aktif`, `Nonaktif`, dan `Reset Kata Sandi`.

## 10. Pengaturan Sistem

### Dirty State

- Simpan snapshot setting terakhir yang berhasil di-fetch.
- Hitung dirty state dari nilai form terhadap snapshot tersebut.
- Tombol simpan disabled ketika data belum berubah, loading, atau submitting.
- Setelah save sukses, response/final form menjadi snapshot baru dan dirty state kembali
  false.

### Muat Ulang dan Batalkan Perubahan

- Ketika form bersih, aksi sekunder berlabel `Muat Ulang` dan melakukan refetch.
- Ketika form dirty, aksi sekunder berlabel `Batalkan Perubahan`.
- `Batalkan Perubahan` wajib membuka dialog shadcn sebelum mengembalikan form ke snapshot.
- Jangan memakai native confirm.
- Error fetch/save tetap terlihat inline; save sukses memakai toast existing.

### Mobile

- Tambahkan action bar simpan sticky di mobile agar aksi tetap tersedia setelah scroll
  panjang.
- Pastikan bar tidak menutupi field terakhir dan aman terhadap mobile safe area.
- Desktop mempertahankan action pada PageHeader.
- Jangan mengubah setting key, batas validasi, atau efek backend setting.

## 11. Copy, Density, dan Accessibility Lintas Halaman

Gunakan kamus utama berikut tanpa mengubah enum/API:

| Istilah saat ini | Copy UI utama |
| --- | --- |
| Truck | Truk |
| Line | Jalur |
| Receiving | Penerimaan |
| Counting | Penghitungan |
| Actual | Hasil sensor |
| Refresh | Muat ulang |
| DRAFT | Draf |
| WAITING | Menunggu |
| COUNTING | Sedang dihitung |
| COMPLETED | Selesai |
| CANCELLED | Dibatalkan |
| IDLE | Siap |

Aturan lintas halaman:

- `text-xs` hanya untuk metadata dan helper. Label aksi/status kritis minimal `text-sm` pada
  mobile.
- Angka operasional menggunakan tabular numerals.
- Icon-only button wajib memiliki accessible name.
- Focus ring shadcn tidak boleh dihapus.
- Animasi pulse/spin dekoratif menggunakan `motion-safe`.
- Badge selalu memiliki teks; warna hanya memperkuat makna.
- Loading, error, empty state, dan toast menggunakan foundation existing.
- Jangan menambahkan alert besar untuk kondisi normal.
- Jangan mengulang judul halaman sebagai heading konten tanpa fungsi hierarchy yang jelas.

## Urutan Implementasi

1. Verifikasi baseline, buat branch baru, dan lindungi perubahan working tree pengguna.
2. Tambahkan helper/mapping copy dan test source-level yang dibutuhkan.
3. Refine Dashboard Admin tanpa mengubah chart atau formula data.
4. Perbaiki debounce search dan konfirmasi publish Surat Jalan.
5. Tambahkan tipe eksplisit pada Aktivitas Sensor Admin.
6. Tambahkan kartu mobile untuk Dashboard activity, Reports, Audit, Users, Master Data, dan
   Jalur & Perangkat.
7. Ubah Master Data menjadi Tabs yang URL-persistent.
8. Perbaiki detail Audit Trail dengan field diff, Collapsible raw JSON, dan redaction.
9. Pisahkan edit pengguna dan reset kata sandi.
10. Tambahkan dirty-state, discard confirmation, dan sticky mobile action Pengaturan.
11. Lakukan pass copy, ukuran target sentuh, typography, motion, dan accessibility.
12. Jalankan test spesifik lalu seluruh validasi otomatis.
13. Serahkan hasil untuk review visual manual pengguna.

## Test Wajib

Tambahkan atau perbarui test yang membuktikan:

### Dashboard dan Presentasi

- jalur aktif diurutkan sebelum jalur idle;
- alert tindakan tidak dirender sebagai Card besar ketika nilainya nol;
- progress overcount memakai helper existing dan label tetap di atas 100%;
- chart tetap berupa Manifest bar serta Hasil sensor area/line;
- periode analitik dapat direkonstruksi dari URL;
- label audit terbaru tidak menampilkan enum mentah sebagai copy utama.

### Surat Jalan

- pencarian baru mengubah query/fetch setelah debounce 300 ms;
- nilai identik tidak menyebabkan replace/fetch loop;
- publish tidak memakai native `confirm`;
- dialog publish memerlukan konfirmasi dan mencegah double-submit;
- `StartCountingDialog` dan status transition tetap bekerja.

### Responsif dan Mobile Cards

- Dashboard recent receiving, Reports, Audit, Master Data, Jalur & Perangkat, dan Users
  memiliki mobile cards serta desktop tables;
- detail teknis tidak hilang dari representasi desktop atau progressive disclosure;
- aksi mobile yang ditambahkan memenuhi target 44 px dan icon-only memiliki `aria-label`.

### Audit dan Keamanan

- field yang berubah dipisahkan dari field yang sama;
- null/undefined diformat aman;
- raw JSON tersedia melalui Collapsible;
- key sensitif disamarkan pada summary dan raw view;
- helper label action/entity dipakai konsisten.

### Pengguna dan Pengaturan

- dialog Edit tidak memuat field password;
- reset memerlukan minimum 12 karakter dan konfirmasi cocok;
- guard Admin aktif terakhir dan self-deactivation tidak mengalami regresi;
- dirty state Pengaturan benar sebelum/sesudah edit, save, reload, dan discard;
- discard dirty form selalu melalui dialog, bukan native confirm;
- tombol Save disabled saat clean dan selama submit.

Gunakan unit/helper/source-level regression test yang sesuai dengan test foundation project.
Jangan membuat snapshot besar yang rapuh dan jangan menambahkan browser test.

## Acceptance Criteria Otomatis

- Lint, typecheck, seluruh test, build, dan `git diff --check` lulus.
- Tidak ada perubahan schema, migration, autentikasi, formula actual, atau kontrak bisnis
  counting.
- Shared `CountingConsole` dan seluruh flow Operator tidak mengalami regresi.
- Dashboard mempertahankan komposisi chart existing dan layout dua kolom Status/Analitik.
- Penghitungan tetap menampilkan semua jalur dalam grid dua kolom desktop.
- Search Surat Jalan tidak mengirim request untuk setiap karakter.
- Tidak ada native `confirm` pada flow yang diubah.
- Halaman data utama Admin dapat digunakan secara struktural tanpa tabel horizontal pada
  mobile.
- Master Data memakai tab yang dapat direkonstruksi dari URL.
- Audit Detail mengutamakan perubahan yang terbaca dan tidak mengekspos field sensitif.
- Edit Pengguna dan Reset Kata Sandi merupakan dua alur terpisah.
- Pengaturan melindungi perubahan belum disimpan.
- Copy utama konsisten dalam Bahasa Indonesia.
- Perubahan working tree milik pengguna tidak ikut commit.

## Validasi Wajib

Jalankan dari root repository:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
git diff --check
```

Agent implementasi tidak boleh membuka browser, memakai browser automation, mengambil
screenshot, atau menyatakan QA visual telah lulus. Review visual dilakukan manual oleh
pengguna.

## Checklist Review Manual untuk Pengguna

Setelah implementasi diserahkan, pengguna dapat memeriksa pada 360, 390, 768, 1024, dan
1440 px:

- Dashboard lebih cepat dipindai dan alert normal tidak mendominasi halaman;
- Status Jalur dan Analitik tetap berdampingan pada desktop;
- garis serta gradient Hasil sensor tetap terlihat di atas batang Manifest;
- jalur aktif lebih menonjol daripada jalur idle;
- semua kartu mobile mudah dipindai tanpa horizontal overflow;
- Tabs Master Data terasa lebih cepat daripada tiga section panjang;
- dialog Publish, Reset Kata Sandi, dan Batalkan Perubahan jelas serta tidak ambigu;
- perubahan Audit mudah dibaca tanpa harus membuka JSON;
- sticky action Pengaturan tidak menutup field atau toast;
- copy Bahasa Indonesia, ukuran font, target sentuh, focus, dan kontras terasa konsisten.

## Handoff Akhir Agent Implementasi

Laporan akhir agent harus mencantumkan:

- baseline, nama branch, dan commit implementasi;
- ringkasan perubahan per halaman;
- file baru dan file utama yang diubah;
- dependency baru, bila ada;
- hasil setiap validasi otomatis;
- blocker teknis yang tersisa;
- area yang perlu diperiksa pengguna secara manual;
- konfirmasi bahwa browser dan screenshot tidak digunakan;
- konfirmasi bahwa perubahan working tree pengguna tidak ikut commit.
