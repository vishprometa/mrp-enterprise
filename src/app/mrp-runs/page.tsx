import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { MrpRunsClient } from './MrpRunsClient';

export default async function MrpRunsPage() {
  const data = await fetchAllRecords(TABLES.MRP_RUNS).catch(() => []);
  return <MrpRunsClient data={data} />;
}
