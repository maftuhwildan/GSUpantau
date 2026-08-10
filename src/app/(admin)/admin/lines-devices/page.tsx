import LinesDevicesClient from '@/components/master-data/LinesDevicesClient';

export const metadata = {
  title: 'Line & Perangkat | GSU Pantau',
  description: 'Kelola jalur counting dan perangkat ESP32.',
};

export default function AdminLinesDevicesPage() {
  return <LinesDevicesClient />;
}
