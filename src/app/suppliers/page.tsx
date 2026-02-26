import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { SuppliersClient } from './SuppliersClient';

export default async function SuppliersPage() {
  const suppliers = await fetchAllRecords(TABLES.SUPPLIERS).catch(() => []);
  return <SuppliersClient suppliers={suppliers} />;
}
