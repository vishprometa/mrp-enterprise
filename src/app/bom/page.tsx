import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { BOMClient } from './BOMClient';

export default async function BOMPage() {
  const [boms, bomLines, items] = await Promise.all([
    fetchAllRecords(TABLES.BILL_OF_MATERIALS).catch(() => []),
    fetchAllRecords(TABLES.BOM_LINES).catch(() => []),
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
  ]);
  return <BOMClient boms={boms} bomLines={bomLines} items={items} />;
}
