import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { CapacityClient } from './CapacityClient';

export default async function CapacityPage() {
  const data = await fetchAllRecords(TABLES.CAPACITY_PLANS).catch(() => []);
  return <CapacityClient data={data} />;
}
