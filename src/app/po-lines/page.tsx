import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { PoLinesClient } from './PoLinesClient';

export default async function PoLinesPage() {
  const poLines = await fetchAllRecords(TABLES.PURCHASE_ORDER_LINES).catch(() => []);
  return <PoLinesClient poLines={poLines} />;
}
