# UI/UX Operational Hardening

## Status Dokumen

Dokumen ini merupakan spesifikasi decision-complete untuk tahap pematangan UI/UX setelah
refinement Dashboard Admin dan seluruh halaman Operator. Dokumen ini hanya mendefinisikan
rencana implementasi; perubahan dokumentasi ini tidak mengimplementasikan kode aplikasi.

Baseline implementasi adalah commit `b5da8eb` pada branch
`codex/operator-ui-refinement`. Agent implementasi wajib membuat branch baru
`codex/ui-ux-operational-hardening` dari baseline tersebut.

## Tujuan

Tahap ini tidak melakukan redesign besar. Tujuannya adalah membuat aplikasi lebih mudah
dipercaya dan digunakan dalam kondisi operasional RPA melalui:

- status koneksi realtime yang terlihat dan tidak tertukar dengan kesehatan sensor;
- hierarchy Dashboard Operator yang lebih fokus;
- visual progress yang tetap benar ketika actual melebihi manifest;
- copy Bahasa Indonesia yang konsisten dan bebas mojibake;
- pengalaman Aktivitas Sensor yang usable pada mobile;
- feedback sukses/gagal yang konsisten setelah mutasi;
- keterbacaan dan aksesibilitas untuk penggunaan lapangan;
- filter penting yang bertahan setelah reload dan navigasi.

## Scope

Perubahan mencakup pola lintas aplikasi dan halaman berikut:

- shell/header terautentikasi;
- provider WebSocket/realtime;
- Dashboard Operator;
- Sesi Aktif dan shared counting flow;
- Aktivitas Sensor Operator dan Admin;
- halaman Admin yang memiliki filter penting: Surat Jalan, Laporan Operasional, Audit Trail,
  dan Aktivitas Sensor;
- feedback mutasi utama pada receiving, counting, master data, line/perangkat, pengguna,
  dan pengaturan;
- helper, tipe, semantic composition, dan test yang diperlukan.

## Di Luar Scope

- redesign sidebar, top header, atau design system dasar;
- dark mode;
- perubahan schema dan migration;
- perubahan autentikasi atau role;
- perubahan endpoint mutasi dan aturan bisnis counting;
- notifikasi push, email, atau notification center;
- command palette dan keyboard shortcut baru;
- perubahan formula laporan;
- implementasi pagination baru;
- akses browser, screenshot, dan review visual oleh agent.

Review visual akhir akan dilakukan manual oleh pengguna.

## Guardrail Produk dan Engineering

- Actual hanya berasal dari immutable `sensor_events` dengan kombinasi
  `DETECTION + PRODUCTION + ASSIGNED`.
- Jangan menyediakan edit actual secara langsung.
- Pertahankan authorization dan line scoping di backend.
- Pertahankan transaksi audit atomic dan broadcast setelah commit.
- Pertahankan SOP Truck A selesai sebelum Truck B dimulai.
- Start dan finish tetap wajib melalui dialog konfirmasi.
- `CountingConsole` tetap shared antara Admin dan Operator.
- Operator tidak boleh melihat atau menjalankan cancel session.
- Gunakan Tailwind CSS 4, semantic token, shadcn/ui, dan lucide-react yang sudah ada.
- Jangan menggunakan utility warna palette langsung pada kode aplikasi.
- Jangan menjalankan ulang preset shadcn atau mengganti base primitive.
- Pertahankan font remap global yang telah disetujui pengguna. Penguatan bobot hanya boleh
  dilakukan pada angka, status, dan aksi operasional yang kritis.
- Pertahankan target sentuh minimal 44 px pada mobile.
- UI copy harus menggunakan Bahasa Indonesia. Enum backend tidak diubah.

## Kondisi Git yang Harus Dipertahankan

Agent implementasi harus memeriksa `git status` sebelum bekerja. Jangan restore, stage,
commit, atau mengubah empat penghapusan mockup milik pengguna:

- `docs/ui-mockups/poultry-receiving-admin-dashboard-v1.png`;
- `docs/ui-mockups/poultry-receiving-dashboard-v1.png`;
- `docs/ui-mockups/poultry-receiving-operator-dashboard-v1.png`;
- `docs/ui-mockups/poultry-receiving-supervisor-dashboard-v1.png`.

Dokumen handoff yang sudah berada di working tree juga bukan bagian commit implementasi
kecuali pengguna meminta secara eksplisit. Agent harus stage file implementasi satu per satu
dan tidak memakai `git add -A` atau `git add .`.

## 1. Kepercayaan terhadap Realtime

### Masalah

UI saat ini menampilkan kesehatan sensor, tetapi tidak menjelaskan apakah browser sedang
menerima update WebSocket atau menggunakan polling fallback. Status sensor dan status
transport data merupakan dua hal berbeda dan tidak boleh digabung.

### Kontrak State Realtime

Perluas context pada `ws-provider` dengan state eksplisit:

```ts
type RealtimeConnectionState = 'CONNECTING' | 'LIVE' | 'POLLING';

type WebSocketContextType = {
  lastMessage: LocalRealtimeMessage | null;
  isConnected: boolean;
  connectionState: RealtimeConnectionState;
  lastRealtimeActivityAt: string | null;
};
```

Aturan state:

- awal mount: `CONNECTING`;
- WebSocket `open`: `LIVE`;
- setiap pesan WebSocket valid memperbarui `lastRealtimeActivityAt`;
- WebSocket tertutup/error dan fallback polling aktif: `POLLING`;
- reconnect yang berhasil kembali menjadi `LIVE`;
- `lastRealtimeActivityAt` menggunakan waktu browser saat koneksi terbuka atau pesan valid
  diterima; jangan menggunakannya sebagai timestamp bisnis sensor.

`realtime.poll` tetap merupakan notifikasi agar halaman melakukan authoritative refetch.
Jangan menjadikan pesan WebSocket sebagai sumber data bisnis.

### Indikator pada Header

Tambahkan indikator transport realtime yang terpisah dari badge kesehatan perangkat:

- `LIVE`: label `Data langsung`, tone success, ikon connection/radio;
- `POLLING`: label `Mode cadangan`, tone warning, ikon refresh/cloud-off;
- `CONNECTING`: label `Menyambungkan`, tone neutral, ikon dengan animasi
  `motion-safe`.

Perilaku responsif:

- desktop menampilkan ikon dan label;
- mobile menampilkan ikon compact dengan accessible label dan Tooltip;
- indikator tidak boleh membuat header overflow pada 360 px;
- badge kesehatan sensor tetap tersedia dan tidak diganti indikator realtime.

Tooltip atau accessible description harus menjelaskan:

- `Data langsung`: pembaruan diterima melalui WebSocket;
- `Mode cadangan`: aplikasi tetap memperbarui data melalui polling;
- `Menyambungkan`: koneksi realtime sedang dibangun.

Jangan menampilkan toast setiap reconnect/poll karena akan menciptakan notification fatigue.

### Waktu Pembaruan Data Halaman

Pada Dashboard Operator dan Sesi Aktif, catat waktu keberhasilan fetch authoritative
terakhir pada state halaman. Tampilkan teks sekunder:

```text
Diperbarui HH.mm.ss
```

Aturan:

- waktu hanya berubah setelah response HTTP sukses;
- jangan memperbarui label hanya karena pesan WebSocket masuk;
- kegagalan refetch mempertahankan waktu sukses terakhir;
- label memakai locale `id-ID` dan timezone tampilan existing.

## 2. Penyederhanaan Dashboard Operator

### Hierarchy yang Dikunci

Ketika sesi aktif, urutan perhatian harus menjadi:

1. hasil sensor realtime;
2. identitas truk dan Surat Jalan;
3. manifest dan selisih berjalan;
4. kondisi sensor serta pembaruan data;
5. tombol `Buka Sesi Aktif`;
6. antrean dan ringkasan deteksi sebagai informasi sekunder.

### Hero Sesi Aktif

Ubah empat KPI setara di dalam hero menjadi satu composition operasional:

- hasil sensor menjadi angka paling besar;
- manifest dan selisih menjadi dua metrik pendamping;
- identitas truk, Surat Jalan, supplier, dan assigned line tetap terlihat di header hero;
- status sensor menjadi badge compact dengan alert hanya bila bermasalah;
- tombol utama tetap `Buka Sesi Aktif` dan menuju shared `CountingConsole`;
- jangan menambahkan tombol finish langsung pada Dashboard agar konfirmasi operasional tetap
  terpusat di Sesi Aktif.

Hindari `KpiCard` bertingkat di dalam Card hero bila informasi yang sama dapat disusun
dengan grid sederhana. Jangan menghapus `KpiCard` dari Admin Dashboard.

### Pengurangan Noise

- Hapus alert SOP permanen dari bagian bawah Dashboard Operator.
- SOP lengkap tetap tersedia pada `CountingConsole` dan dialog finish.
- Alert unassigned hanya muncul bila jumlahnya lebih dari nol.
- Kondisi sensor normal cukup badge; alert hanya untuk `DEGRADED`, `OFFLINE`, stale,
  `MAINTENANCE`, atau `UNREGISTERED`.
- Jangan tampilkan alert hijau untuk kondisi normal.
- Idle state, preview antrean, dan `StartCountingDialog` tetap dipertahankan.

### Dashboard Sekunder

- Preview antrean tetap maksimal lima dan memakai `waitingQueueCount` sebagai total.
- Ringkasan deteksi tetap berupa angka, tanpa donut chart.
- Pada layar sempit, dua metrik deteksi boleh menjadi satu kolom agar label tidak terjepit.

## 3. Progress dan Selisih yang Benar saat Overcount

### Helper Presentasi

Ekstrak helper presentasi murni agar aturan mudah diuji:

```ts
type CountingProgressPresentation = {
  rawPercent: number | null;
  barPercent: number;
  state: 'NO_TARGET' | 'BELOW' | 'MATCHED' | 'OVER';
  differenceLabel: string;
  progressLabel: string;
};
```

Aturan:

- manifest `<= 0`: `NO_TARGET`, `rawPercent: null`, label `Target tidak tersedia`;
- actual di bawah manifest: `BELOW`, label selisih `Kurang N ekor`;
- actual sama dengan manifest: `MATCHED`, label `Sesuai manifest`;
- actual melebihi manifest: `OVER`, label `Lebih N ekor`;
- `rawPercent` tidak dibatasi 100;
- `barPercent` hanya untuk CSS width dan dibatasi `0..100`;
- persentase ditampilkan dengan pembulatan konsisten, maksimal satu angka desimal bila
  diperlukan;
- actual tidak pernah menyebabkan auto-finish.

### Visual

- `BELOW`: tone info/primary, karena kekurangan selama sesi aktif belum tentu anomali;
- `MATCHED`: tone success;
- `OVER`: tone warning dengan label eksplisit, misalnya `105% · Lebih 250 ekor`;
- `NO_TARGET`: tone neutral;
- warna tidak boleh menjadi satu-satunya pembeda state.

Gunakan helper yang sama pada Dashboard Operator dan area progress shared counting jika
area tersebut menampilkan progress. Jangan mengubah formula difference backend.

## 4. Standardisasi Bahasa dan Encoding

### Kamus UI

Gunakan istilah berikut pada copy yang dilihat pengguna:

| Istilah teknis | Copy UI utama |
| --- | --- |
| Truck | Truk |
| Line | Jalur |
| Receiving | Penerimaan |
| Counting | Penghitungan |
| Actual / Actual Sensor | Hasil sensor |
| Assigned | Terhubung sesi |
| Unassigned | Tanpa sesi |
| WAITING | Menunggu |
| COUNTING | Sedang dihitung |
| COMPLETED | Selesai |
| CANCELLED | Dibatalkan |
| DRAFT | Draf |
| Device | Perangkat |
| Device Restart | Mulai ulang perangkat |
| Refresh | Muat ulang |
| Realtime | Langsung |
| IDLE | Siap |

Aturan penggunaan:

- Enum backend, query parameter, type union, log developer, dan kontrak API tidak diubah.
- Pada halaman diagnostik Admin, enum teknis boleh ditampilkan sebagai teks sekunder dalam
  tanda kurung bila membantu troubleshooting.
- Nomor Surat Jalan tetap dapat disingkat `No. SJ` hanya pada ruang sempit.
- `Manifest`, `sensor`, `supplier`, dan `heartbeat` dianggap istilah operasional yang boleh
  dipertahankan.
- Gunakan kapitalisasi sentence case, bukan seluruh kata kapital, kecuali menampilkan enum
  teknis sebagai detail.

### Mojibake

- Cari karakter rusak seperti `â`, `Ã`, atau `�` di `src/app`, `src/components`, dan
  `src/lib` yang menghasilkan UI copy.
- Ganti separator rusak `â€¢` dengan `·` atau struktur elemen terpisah.
- Simpan source dalam UTF-8.
- Jangan melakukan rewrite massal pada dokumen historis atau migration.
- Tambahkan regression test yang gagal bila mojibake umum muncul pada source UI.

## 5. Aktivitas Sensor Mobile dan Progressive Disclosure

### Operator Mobile

Pada breakpoint di bawah `md`, ganti tabel horizontal Aktivitas Sensor Operator menjadi
daftar kartu. Setiap kartu menampilkan informasi utama:

- waktu server/diterima;
- label tipe event dalam Bahasa Indonesia;
- status assignment untuk event deteksi;
- kode perangkat.

Informasi teknis berikut disembunyikan dari ringkasan dan tersedia melalui
`Collapsible` shadcn yang sudah ada:

- device time;
- sequence;
- boot ID;
- ID sesi atau Surat Jalan bila tersedia.

Trigger detail menggunakan label `Lihat detail`/`Tutup detail`, memiliki target sentuh
44 px, `aria-expanded`, dan fokus yang jelas.

### Desktop dan Admin

- Pada `md` ke atas, pertahankan tabel teknis.
- Terapkan pola kartu mobile yang sama pada Aktivitas Sensor Admin, tetapi Admin tetap dapat
  melihat line, perangkat, sequence, boot ID, mode, dan konteks sesi dalam detail.
- Jangan mengurangi field API atau kemampuan troubleshooting Admin.
- Empty, loading, error, filter, dan realtime refetch tetap bekerja pada kedua representasi.

### Urutan dan Waktu

- Urutan aktivitas operasional tetap berdasarkan timestamp yang dikembalikan API.
- Gunakan `receivedAt` sebagai waktu utama.
- Device time hanya informasi diagnostik sekunder.

## 6. Feedback Mutasi yang Konsisten

### Foundation Toast

Tambahkan official shadcn Sonner pattern:

- dependency `sonner` bila belum tersedia;
- `src/components/ui/sonner.tsx` mengikuti primitive shadcn dan semantic token;
- satu `<Toaster />` pada root layout;
- jangan membuat sistem toast custom kedua.

### Aturan Feedback

- Tampilkan toast success hanya setelah server mengonfirmasi mutasi berhasil.
- Error validasi field tetap inline di form/dialog.
- Error jaringan atau server ditampilkan inline pada konteks aksi dan boleh disertai satu
  toast error ringkas; jangan menampilkan pesan yang sama berkali-kali.
- Jangan tampilkan toast untuk fetch background, heartbeat, polling, dan setiap event sensor.
- Jangan menampilkan toast sukses sebelum response selesai.
- Semua tombol mutasi harus disabled ketika submit dan memakai teks progres, bukan hanya
  spinner tanpa label.

### Mutasi yang Wajib Dicakup

Terapkan feedback success pada alur berikut yang sudah ada:

- membuat, mengubah, menerbitkan, dan membatalkan Surat Jalan;
- memulai dan menyelesaikan penghitungan;
- cancel session Admin bila flow tersebut sudah tersedia;
- membuat, mengubah, mengaktifkan, atau menonaktifkan master data;
- membuat/mengubah jalur dan perangkat serta rotasi credential;
- membuat/mengubah pengguna dan reset password;
- menyimpan pengaturan sistem.

Contoh copy:

- `Penghitungan berhasil dimulai.`
- `Penghitungan selesai: hasil sensor 4.985 dari manifest 5.000 ekor.`
- `Surat Jalan berhasil diterbitkan ke antrean.`
- `Pengaturan sistem berhasil disimpan.`

Credential plaintext tidak boleh masuk ke toast. Dialog one-time secret tetap menjadi satu-
satunya tempat menampilkan credential baru.

## 7. Keterbacaan dan Aksesibilitas Operasional

### Typography

- Pertahankan remap font global yang telah disetujui.
- Angka hasil sensor utama memakai heading kuat dan tabular numerals.
- Label aksi dan status kritis minimal setara `text-sm` pada mobile.
- `text-xs` hanya untuk metadata atau helper, bukan satu-satunya label tindakan.
- Teks muted dengan opacity rendah tidak boleh memuat informasi keselamatan atau status
  kritis.

### Motion dan Live Updates

- Bungkus animasi pulse/spin dekoratif dengan `motion-safe:` dan sediakan state statis.
- Tambahkan region `aria-live="polite"` pada actual counter dan status koneksi yang berubah.
- Jangan menggunakan `aria-live` pada seluruh tabel event karena akan membanjiri screen
  reader.
- Loading container penting menggunakan label yang dapat dibaca dan `aria-busy` bila
  relevan.

### Control dan Focus

- Semua aksi mobile minimal 44 x 44 px.
- Icon-only button wajib memiliki `aria-label`.
- Collapsible detail sensor harus dapat dioperasikan keyboard.
- Focus ring shadcn tidak boleh dihapus.
- Badge selalu menyertakan teks; warna hanya memperkuat makna.

## 8. Persistensi Filter melalui URL

### Halaman yang Dicakup

Sinkronkan filter penting ke query string pada:

- `/admin/receiving`;
- `/admin/reports`;
- `/admin/audit-trail`;
- `/admin/sensor-activity`;
- `/sensor-activity`.

### Aturan Sinkronisasi

- Saat mount, state filter dibaca dari `useSearchParams`.
- Perubahan filter menulis query menggunakan `router.replace` agar tidak membuat history
  entry untuk setiap pilihan.
- Navigasi ke halaman lain lalu kembali mempertahankan filter melalui URL.
- Reload dan bookmark menghasilkan tampilan filter yang sama.
- Nilai default tidak perlu ditulis ke URL.
- Reset menghapus hanya parameter filter yang dimiliki halaman dan mempertahankan parameter
  lain yang tidak dikenali.
- Search text menggunakan debounce 300 ms sebelum refetch dan URL update.
- Date range tetap memakai kontrak date-only `YYYY-MM-DD` dan helper existing.
- Nilai enum atau tanggal tidak valid kembali ke default aman dan tidak menyebabkan crash.
- Filter Operator Sensor tetap line-scoped oleh backend; jangan menambahkan selector line.
- Interlock event type dan assignment pada Operator Sensor tetap berlaku ketika state
  berasal dari URL.

### Parameter Canonical

Gunakan nama API existing sebagai query UI bila tersedia:

- `status`;
- `line_id`;
- `date_from`;
- `date_to`;
- `search`;
- `event_type`;
- `assignment_status`;
- `action`;
- `entity_type`;
- `actor_id`.

Jangan menambah alias baru bila nama canonical sudah tersedia.

## 9. Severity dan Presentation Rules

Gunakan severity secara konsisten:

- danger: sensor offline pada proses aktif, error mutasi, atau kondisi yang dapat membuat
  counting tidak dipercaya;
- warning: degraded/stale, unassigned detection, overcount, atau fallback polling;
- neutral/info: SOP, loading, belum ada data, maintenance terencana;
- success: aksi baru selesai atau kondisi normal yang perlu dikonfirmasi secara singkat.

Aturan tambahan:

- Jangan menampilkan alert besar untuk semua kondisi normal.
- Jangan menggunakan success untuk selisih nol pada sesi yang belum selesai sebagai tanda
  bahwa sesi boleh otomatis ditutup.
- Status `Jalur ACTIVE` dan `IDLE` tidak boleh tampil sebagai dua label yang tampak
  bertentangan. Presentasikan sebagai:
  - `Kondisi jalur: Siap digunakan`;
  - `Sesi penghitungan: Tidak aktif`;
  - `Sensor: Online`.

## Urutan Implementasi

1. Verifikasi baseline, buat branch, dan lindungi perubahan working tree pengguna.
2. Tambahkan regression test mojibake dan helper progress beserta unit test.
3. Perluas state WebSocket dan tambahkan indikator realtime pada header.
4. Tambahkan waktu fetch sukses terakhir pada Dashboard Operator dan Sesi Aktif.
5. Sederhanakan hero Dashboard Operator dan terapkan progress overcount.
6. Standardisasi copy/terminologi pada seluruh halaman dalam scope.
7. Buat kartu mobile dan collapsible detail Aktivitas Sensor Operator/Admin.
8. Tambahkan foundation Sonner dan feedback mutasi utama.
9. Sinkronkan filter halaman yang ditentukan dengan URL.
10. Terapkan accessibility/readability pass dan severity rules.
11. Jalankan test spesifik, lalu validasi penuh.
12. Serahkan implementasi untuk review visual manual pengguna.

## Test Wajib

Tambahkan test yang membuktikan:

### Realtime

- helper/reducer koneksi berpindah `CONNECTING -> LIVE -> POLLING -> LIVE` secara benar;
- aktivitas valid memperbarui timestamp context;
- fallback polling tetap menghasilkan trigger refetch existing;
- indikator realtime terpisah dari kesehatan sensor.

### Progress

- manifest nol menghasilkan `NO_TARGET` tanpa pembagian nol;
- actual lebih kecil menghasilkan `BELOW` dan `Kurang N ekor`;
- actual sama menghasilkan `MATCHED`;
- actual lebih besar menghasilkan raw percent di atas 100, bar tetap maksimal 100, dan
  label `Lebih N ekor`;
- helper tidak mengubah atau memicu lifecycle session.

### Copy dan Encoding

- source UI dalam scope tidak mengandung `â`, `Ã`, atau `�`;
- mapping status UI menghasilkan label Bahasa Indonesia yang dikunci;
- enum API tetap tidak berubah.

### Filter URL

- parser menggunakan default untuk query kosong/tidak valid;
- serializer menghilangkan nilai default;
- reset mempertahankan query asing;
- date-only tetap `YYYY-MM-DD`;
- interlock `assignment_status` memaksa `event_type=DETECTION`;
- event non-detection menghapus assignment;
- fetch dibangun dari filter URL aktif.

### Komposisi UI

- Operator Sensor memiliki kartu mobile dan tabel desktop;
- detail teknis tetap tersedia melalui Collapsible;
- tindakan start/finish tetap melalui dialog;
- Operator tidak memperoleh cancel session;
- toast tidak dipicu oleh polling atau event sensor background;
- root hanya memasang satu Toaster.

Gunakan unit test/helper test untuk logika dan source-level regression test bila project
belum memiliki browser component test. Jangan mengganti test suite menjadi snapshot besar
yang rapuh.

## Acceptance Criteria Otomatis

- Lint, typecheck, seluruh test, build, dan `git diff --check` lulus.
- Tidak ada perubahan schema/migration atau formula actual.
- Tidak ada mojibake pada source UI yang diperiksa.
- Progress overcount menampilkan nilai di atas 100 dan label selisih eksplisit.
- Header membedakan kesehatan perangkat dengan transport realtime.
- Polling fallback tetap berfungsi dan tidak menghasilkan toast berulang.
- Dashboard Operator lebih fokus pada hasil sensor tanpa menghilangkan antrean, unassigned,
  atau akses ke Sesi Aktif.
- Aktivitas Sensor usable secara struktural di mobile tanpa menghilangkan data teknis.
- Feedback success mencakup seluruh mutasi utama tanpa membocorkan credential.
- Filter halaman dalam scope dapat direkonstruksi dari URL.
- Tidak ada regresi pada role, authorization, start/finish confirmation, sticky finish,
  shared `CountingConsole`, reports, dan audit.
- Empat penghapusan mockup serta dokumen handoff di working tree tidak ikut commit.

## Validasi Wajib

Jalankan dari root repository:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
git diff --check
```

Agent tidak boleh membuka browser, mengakses UI melalui browser automation, mengambil
screenshot, atau menyatakan QA visual lulus. Review visual dilakukan manual oleh pengguna.

## Checklist Review Manual untuk Pengguna

Bagian ini bukan tugas agent implementasi. Setelah agent menyerahkan hasil, pengguna dapat
memeriksa:

- header tidak overflow pada 360, 390, 768, 1024, dan 1440 px;
- indikator `Data langsung`, `Mode cadangan`, dan `Menyambungkan` mudah dibedakan;
- angka hasil sensor menjadi fokus utama Dashboard Operator;
- overcount terlihat jelas dan tidak tampak berhenti di 100%;
- kartu sensor mobile mudah dipindai dan detail dapat dibuka;
- toast tidak menutupi sticky finish atau tombol penting;
- teks light tetap terbaca pada perangkat dan kondisi pencahayaan operasional;
- filter tetap sama setelah reload, pindah halaman, dan kembali;
- tidak ada copy Inggris yang mengganggu atau karakter encoding rusak.

## Handoff Akhir Agent Implementasi

Laporan akhir harus mencantumkan:

- branch dan baseline;
- commit implementasi;
- ringkasan perubahan per workstream;
- file baru dan file utama yang diubah;
- dependency yang ditambahkan;
- hasil setiap validasi otomatis;
- blocker teknis yang tersisa;
- area yang perlu diperiksa pengguna dalam review manual;
- konfirmasi bahwa agent tidak membuka browser atau mengambil screenshot;
- konfirmasi bahwa perubahan working tree milik pengguna tidak ikut commit.
