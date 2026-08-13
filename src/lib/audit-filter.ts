const AUDIT_ENTITY_ALIASES: Record<string, string[]> = {
  user: ["user", "USER"],
  receiving: ["receiving"],
  receiving_sessions: ["receiving_sessions", "receiving_session"],
  line: ["line"],
  device: ["device"],
  truck: ["truck"],
  driver: ["driver"],
  supplier: ["supplier"],
  settings: ["settings", "app_settings"],
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  RECEIVING_CREATE: "Buat Surat Jalan",
  RECEIVING_UPDATE: "Ubah Surat Jalan",
  MANIFEST_REVISION: "Revisi Manifest",
  RECEIVING_PUBLISH: "Terbitkan Surat Jalan",
  RECEIVING_CANCEL: "Batalkan Surat Jalan",
  SESSION_START: "Mulai Penghitungan",
  SESSION_FINISH: "Selesaikan Penghitungan",
  SESSION_CANCEL: "Batalkan Penghitungan",
  CREATE_USER: "Buat Pengguna",
  UPDATE_USER: "Ubah Pengguna",
  RESET_PASSWORD: "Reset Password",
  CREATE_LINE: "Buat Line",
  UPDATE_LINE: "Ubah Line",
  REGISTER_DEVICE: "Daftarkan Perangkat",
  UPDATE_DEVICE: "Ubah Perangkat",
  ROTATE_DEVICE_CREDENTIAL: "Rotasi Kredensial Perangkat",
  CREATE_TRUCK: "Buat Truck",
  UPDATE_TRUCK: "Ubah Truck",
  CREATE_DRIVER: "Buat Supir",
  UPDATE_DRIVER: "Ubah Supir",
  CREATE_SUPPLIER: "Buat Supplier",
  UPDATE_SUPPLIER: "Ubah Supplier",
  UPDATE_SETTINGS: "Ubah Pengaturan",
}

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  user: "Pengguna",
  receiving: "Surat Jalan",
  receiving_sessions: "Sesi Penghitungan",
  line: "Line",
  device: "Perangkat",
  truck: "Truck",
  driver: "Supir",
  supplier: "Supplier",
  settings: "Pengaturan",
}

export function canonicalizeAuditEntityType(entityType: string): string {
  const normalized = entityType.trim()

  for (const [canonical, aliases] of Object.entries(AUDIT_ENTITY_ALIASES)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalized.toLowerCase())) {
      return canonical
    }
  }

  return normalized
}

export function getAuditEntityAliases(entityType: string): string[] {
  const canonical = canonicalizeAuditEntityType(entityType)
  return AUDIT_ENTITY_ALIASES[canonical] ?? [entityType]
}

export function formatAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function formatAuditEntityLabel(entityType: string): string {
  const canonical = canonicalizeAuditEntityType(entityType)
  return AUDIT_ENTITY_LABELS[canonical] ?? canonical
}
