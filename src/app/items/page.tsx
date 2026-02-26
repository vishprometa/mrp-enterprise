import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { ItemsClient } from './ItemsClient';

export default async function ItemsPage() {
  const [items, inventory] = await Promise.all([
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
    fetchAllRecords(TABLES.INVENTORY).catch(() => []),
  ]);
  return <ItemsClient items={items} inventory={inventory} />;
}
