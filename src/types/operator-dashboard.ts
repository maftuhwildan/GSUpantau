export interface OperatorLine {
  id: string;
  lineCode: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
}

export interface OperatorDevice {
  id: string;
  deviceCode: string;
  lineId: string;
  name: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MAINTENANCE' | 'UNREGISTERED';
  lastHeartbeatAt: string | Date | null;
  firmwareVersion?: string | null;
  wifiRssi?: number | null;
}

export interface OperatorReceivingDetail {
  id: string;
  receivingNumber: string;
  deliveryNoteNumber: string;
  manifestCount: number;
  licensePlateSnapshot: string;
  supplierNameSnapshot: string;
  driverNameSnapshot?: string | null;
  status: 'DRAFT' | 'WAITING' | 'COUNTING' | 'COMPLETED' | 'CANCELLED';
  truck?: { id: string; licensePlate: string } | null;
  driver?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
}

export interface OperatorActiveSession {
  id: string;
  receivingId: string;
  lineId: string;
  status: 'COUNTING' | 'COMPLETED' | 'CANCELLED';
  startedAt: string | Date;
  actualCount: number;
  lastDetection: string | Date | null;
  receiving?: OperatorReceivingDetail | null;
}

export interface OperatorWaitingItem {
  id: string;
  receivingNumber: string;
  deliveryNoteNumber: string;
  receivingDate: string;
  queuePosition: number;
  manifestCount: number;
  status: 'DRAFT' | 'WAITING' | 'COUNTING' | 'COMPLETED' | 'CANCELLED';
  licensePlateSnapshot: string;
  supplierNameSnapshot: string;
  createdAt: string | Date;
}

export interface OperatorDashboardData {
  line: OperatorLine | null;
  device: OperatorDevice | null;
  activeSession: OperatorActiveSession | null;
  waitingQueue: OperatorWaitingItem[];
  waitingQueueCount: number;
  assignedDetections: number;
  unassignedDetections: number;
}

export interface SensorEventItem {
  id: string;
  eventId: string;
  bootId: string;
  deviceId: string;
  lineId: string;
  sequence: number;
  eventType: 'DETECTION' | 'HEARTBEAT' | 'DEVICE_RESTART';
  deviceTime: string | Date;
  receivedAt: string | Date;
  sessionId: string | null;
  assignmentStatus: 'ASSIGNED' | 'UNASSIGNED';
  eventMode: 'PRODUCTION' | 'TEST' | 'MAINTENANCE';
  device?: {
    id: string;
    deviceCode: string;
    name: string;
  } | null;
  line?: {
    id: string;
    lineCode: string;
    name: string;
  } | null;
  session?: {
    id: string;
    receiving?: {
      id: string;
      deliveryNoteNumber: string;
      licensePlateSnapshot: string;
    } | null;
  } | null;
}
