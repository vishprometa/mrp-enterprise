import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { ItemsClient } from './ItemsClient';

export default async function ItemsPage() {
  const items = await fetchAllRecords(TABLES.ITEMS).catch(() => []);
  return <ItemsClient items={items} />;
}
