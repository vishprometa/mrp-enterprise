import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { BomLinesClient } from './BomLinesClient';

export default async function BomLinesPage() {
  const bomLines = await fetchAllRecords(TABLES.BOM_LINES).catch(() => []);
  return <BomLinesClient bomLines={bomLines} />;
}
