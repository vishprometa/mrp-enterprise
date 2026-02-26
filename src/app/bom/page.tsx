import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { BOMClient } from './BOMClient';

export default async function BOMPage() {
  const data = await fetchAllRecords(TABLES.BILL_OF_MATERIALS).catch(() => []);
  return <BOMClient data={data} />;
}
