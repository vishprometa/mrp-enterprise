import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { MrpRecsClient } from './MrpRecsClient';

export default async function MrpRecsPage() {
  const data = await fetchAllRecords(TABLES.MRP_RECOMMENDATIONS).catch(() => []);
  return <MrpRecsClient data={data} />;
}
