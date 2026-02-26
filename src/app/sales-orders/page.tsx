import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { SalesOrdersClient } from './SalesOrdersClient';

export default async function SalesOrdersPage() {
  const [orders, customers] = await Promise.all([
    fetchAllRecords(TABLES.SALES_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.CUSTOMERS).catch(() => []),
  ]);
  return <SalesOrdersClient orders={orders} customers={customers} />;
}
