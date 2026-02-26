import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { SoLinesClient } from './SoLinesClient';

export default async function SoLinesPage() {
  const soLines = await fetchAllRecords(TABLES.SALES_ORDER_LINES).catch(() => []);
  return <SoLinesClient soLines={soLines} />;
}
