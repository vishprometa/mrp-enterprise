import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { RoutingOpsClient } from './RoutingOpsClient';

export default async function RoutingOpsPage() {
  const operations = await fetchAllRecords(TABLES.ROUTING_OPERATIONS).catch(() => []);
  return <RoutingOpsClient operations={operations} />;
}
