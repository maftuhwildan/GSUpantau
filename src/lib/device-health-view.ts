export interface DeviceHealthViewFields {
  deviceCode: string;
  status: string;
  lastHeartbeatAt: string | null;
  firmwareVersion?: string | null;
  wifiRssi?: number | null;
}

export interface DeviceHealthViewUpdate extends DeviceHealthViewFields {}

export function applyDeviceHealthViewUpdate<
  TDevice extends DeviceHealthViewFields,
  TLine extends { devices: TDevice[] },
>(lines: TLine[], update: DeviceHealthViewUpdate): TLine[] {
  return lines.map((line) => {
    let changed = false;
    const nextDevices = line.devices.map((device) => {
      if (device.deviceCode !== update.deviceCode) return device;

      changed = true;
      return {
        ...device,
        status: update.status,
        lastHeartbeatAt: update.lastHeartbeatAt,
        ...(update.firmwareVersion !== undefined
          ? { firmwareVersion: update.firmwareVersion }
          : {}),
        ...(update.wifiRssi !== undefined ? { wifiRssi: update.wifiRssi } : {}),
      } as TDevice;
    });

    return changed ? ({ ...line, devices: nextDevices } as TLine) : line;
  });
}
