import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { RoutingsClient } from './RoutingsClient';

export default async function RoutingsPage() {
  const data = await fetchAllRecords(TABLES.ROUTINGS).catch(() => []);
  return <RoutingsClient data={data} />;
}
