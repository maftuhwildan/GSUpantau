# Poultry Receiving Counter System (GSU Pantau)

Sistem Penghitung Penerimaan Ayam Rumah Potong Ayam (RPA) berbasis Next.js App Router, Tailwind CSS, shadcn/ui, TypeScript, dan WebSocket.

Dokumentasi integrasi perangkat dan pilot:

- [Status Proyek dan Handoff Agent](docs/PROJECT_STATUS.md)
- [Kontrak Firmware ESP32](docs/ESP32_PROTOCOL.md)
- [Simulator ESP32-S3 Tanpa Sensor](firmware/esp32-s3-simulator/README.md)
- [Lembar Hasil Simulasi ESP32](docs/ESP32_SIMULATION_RESULTS.md)
- [Lembar Hasil Field Test ESP32](docs/ESP32_FIELD_TEST_RESULTS.md)

## Fitur Batch 1 (UI Foundation & Scaffold)

- **Scaffold Next.js App Router** dengan TypeScript strict.
- **Sistem Desain & Tema Tokens** (Workspace putih/abu terang, aksi utama ungu, sidebar gradient ungu ke pink ke oranye).
- **Komponen Shared Layout**: `DashboardShell`, `Sidebar`, `Header`.
- **Route Groups**:
  - `(auth)` -> Login placeholder dengan petunjuk akun dev.
  - `(operator)` -> Dashboard, Antrean Receiving, Console Sesi Aktif, Aktivitas Sensor.
  - `(admin)` -> Dashboard Admin, Counting, Surat Jalan (Receiving), Aktivitas Sensor, Master Data, Line & Perangkat, Kelola Pengguna, Pengaturan, Laporan, Audit Trail.
- **Copy UI**: Sepenuhnya menggunakan Bahasa Indonesia operasional RPA.

## Akun Pengembang (Development Credentials)

> **Catatan Security:** Kredensial berikut khusus lingkungan pengembangan lokal (*non-production*).

- **OPERATOR**
  - Email: `operator@local.test`
  - Password: `password`
  - Akses: Dashboard Operator, Antrean Receiving, Sesi Aktif, Aktivitas Sensor.

- **ADMIN**
  - Email: `admin@local.test`
  - Password: `password`
  - Akses: Seluruh fitur sistem termasuk Input Surat Jalan, Master Data, Line/Perangkat, Pengguna, Pengaturan, dan Audit Trail.

## Cara Menjalankan Aplikasi

### Arsitektur Database Development

PostgreSQL development berjalan melalui Docker Compose di VPS. Laptop pengembang menjalankan aplikasi Next.js secara lokal dan mengakses database melalui jaringan privat Tailscale. PostgreSQL tidak perlu diinstal atau dinyalakan di laptop.

Gunakan database dan user yang terpisah dari staging maupun production. Port PostgreSQL `5432` hanya boleh dapat diakses melalui Tailscale, bukan internet publik.

### 1. Hubungkan Tailscale dan Siapkan Environment

Salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL` menggunakan hostname MagicDNS atau IP Tailscale VPS:

```env
DATABASE_URL=postgres://poultry_dev:PASSWORD@NAMA-VPS-TAILSCALE:5432/poultry_receiving_dev
DATABASE_TEST_URL=postgres://poultry_dev:PASSWORD@NAMA-VPS-TAILSCALE:5432/poultry_receiving_test
SESSION_SECRET=ganti-dengan-secret-minimal-32-karakter
APP_URL=http://localhost:3000
SITE_TIMEZONE=Asia/Jakarta
NODE_ENV=development
```

Periksa koneksi dari PowerShell:

```powershell
Test-NetConnection NAMA-VPS-TAILSCALE -Port 5432
```

Jangan commit file `.env` atau kredensial database asli.

### 2. Install Dependensi

```bash
npm install
```

### 3. Jalankan Migration

```bash
npm run db:migrate
```

Migration Drizzle hanya menjalankan migration yang belum tercatat. Buat backup terlebih dahulu jika database sudah berisi data operasional.

Jalankan seed hanya pada database development khusus jika memang diperlukan:

```bash
npm run db:seed
```

Jangan menjalankan seed atau automated test dengan `DATABASE_URL` production. Pengujian integrasi PostgreSQL menggunakan `DATABASE_TEST_URL` yang dilindungi oleh safety guard database ending with `_test`.

### 4. Jalankan Mode Pengembang

```bash
npm run dev
```

Aplikasi akan berjalan pada [http://localhost:3000](http://localhost:3000).

### 5. Perintah Validasi

```bash
# Pengujian Integrasi Real PostgreSQL (Batch 20)
npm run test:pg

# Validasi Linter
npm run lint

# Validasi Tipe Data TypeScript
npm run typecheck

# Jalankan test PGlite
npm test

# Build Produksi Next.js
npm run build
```
