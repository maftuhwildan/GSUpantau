import MasterDataClient from '@/components/master-data/MasterDataClient';

export const metadata = {
  title: 'Master Data | GSU Pantau',
  description: 'Kelola data referensi Truck, Supir, dan Supplier.',
};

export default function AdminMasterDataPage() {
  return <MasterDataClient />;
}
