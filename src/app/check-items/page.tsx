import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { CheckItemsClient } from './CheckItemsClient';

export default async function CheckItemsPage() {
  const checkItems = await fetchAllRecords(TABLES.QUALITY_CHECK_ITEMS).catch(() => []);
  return <CheckItemsClient checkItems={checkItems} />;
}
