import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { BomExplosionClient } from './BomExplosionClient';

export default async function BomExplosionPage() {
  const [boms, bomLines, items] = await Promise.all([
    fetchAllRecords(TABLES.BILL_OF_MATERIALS).catch(() => []),
    fetchAllRecords(TABLES.BOM_LINES).catch(() => []),
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
  ]);
  return <BomExplosionClient boms={boms} bomLines={bomLines} items={items} />;
}
