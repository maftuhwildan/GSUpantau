export interface AdminDashboardTrendItem {
  date: string;
  manifestCount: number;
  actualCount: number;
  completedReceivingCount: number;
}

export interface AdminDashboardRecentReceiving {
  id: string;
  receivingNumber: string;
  deliveryNoteNumber: string;
  receivingDate: string;
  licensePlateSnapshot: string;
  supplierNameSnapshot: string;
  line: { id: string; name: string; lineCode: string | null } | null;
  status: string;
  reconciliationStatus: string;
  manifestCount: number;
  actualCount: number | null;
  differenceCount: number | null;
  differencePercent: number | null;
  updatedAt: string;
}

export interface AdminDashboardLineOverview {
  line: {
    id: string;
    lineCode: string;
    name: string;
    status: string;
  };
  device: {
    id?: string;
    deviceCode?: string;
    status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE' | 'UNREGISTERED' | 'UNKNOWN';
    lastHeartbeatAt?: string | null;
    wifiRssi?: number | null;
    firmwareVersion?: string | null;
  } | null;
  activeSession: {
    id: string;
    receivingId: string;
    lineId: string;
    status: string;
    startedAt: string;
    actualCount: number;
    receiving?: {
      deliveryNoteNumber: string;
      licensePlateSnapshot: string;
      manifestCount: number;
    } | null;
  } | null;
  waitingQueueCount: number;
  lastDetectionAt: string | null;
}

export interface AdminDashboardRecentAuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorRole: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface AdminDashboardData {
  totalManifestToday: number;
  actualCompletedToday: number;
  finalDifferenceCount: number;
  finalDifferencePercent: number;
  completedReceivingCount: number;
  activeLinesCount: number;
  waitingQueueCount: number;
  reviewRequiredCount: number;
  unassignedDetectionsToday: number;
  linesOverview: AdminDashboardLineOverview[];
  trend: AdminDashboardTrendItem[];
  recentReceivings: AdminDashboardRecentReceiving[];
  recentAuditLogs: AdminDashboardRecentAuditLog[];
}
