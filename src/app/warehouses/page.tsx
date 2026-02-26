import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { WarehousesClient } from './WarehousesClient';

export default async function WarehousesPage() {
  const data = await fetchAllRecords(TABLES.WAREHOUSES).catch(() => []);
  return <WarehousesClient data={data} />;
}
