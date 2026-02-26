import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { InventoryClient } from './InventoryClient';

export default async function InventoryPage() {
  const [inventory, items, warehouses] = await Promise.all([
    fetchAllRecords(TABLES.INVENTORY).catch(() => []),
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
    fetchAllRecords(TABLES.WAREHOUSES).catch(() => []),
  ]);
  return <InventoryClient inventory={inventory} items={items} warehouses={warehouses} />;
}
