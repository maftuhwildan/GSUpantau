# Poultry Receiving Counter System (GSU Pantau)

Sistem Penghitung Penerimaan Ayam Rumah Potong Ayam (RPA) berbasis Next.js App Router, Tailwind CSS, shadcn/ui, TypeScript, dan WebSocket.

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

### 1. Install Dependensi

```bash
npm install
```

### 2. Jalankan Mode Pengembang (Development)

```bash
npm run dev
```

Aplikasi akan berjalan pada [http://localhost:3000](http://localhost:3000).

### 3. Perintah Validasi

```bash
# Validasi Linter
npm run lint

# Validasi Tipe Data TypeScript
npm run typecheck

# Build Produksi Next.js
npm run build
```
