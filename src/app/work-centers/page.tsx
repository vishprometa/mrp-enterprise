import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { WorkCentersClient } from './WorkCentersClient';

export default async function WorkCentersPage() {
  const data = await fetchAllRecords(TABLES.WORK_CENTERS).catch(() => []);
  return <WorkCentersClient data={data} />;
}
