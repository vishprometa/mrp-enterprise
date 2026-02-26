import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { ProdOpsClient } from './ProdOpsClient';

export default async function ProdOpsPage() {
  const operations = await fetchAllRecords(TABLES.PRODUCTION_ORDER_OPS).catch(() => []);
  return <ProdOpsClient operations={operations} />;
}
