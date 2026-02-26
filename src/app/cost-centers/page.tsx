import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { CostCentersClient } from './CostCentersClient';

export default async function CostCentersPage() {
  const data = await fetchAllRecords(TABLES.COST_CENTERS).catch(() => []);
  return <CostCentersClient data={data} />;
}
