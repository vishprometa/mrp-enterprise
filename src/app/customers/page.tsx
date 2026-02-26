import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { CustomersClient } from './CustomersClient';

export default async function CustomersPage() {
  const data = await fetchAllRecords(TABLES.CUSTOMERS).catch(() => []);
  return <CustomersClient data={data} />;
}
