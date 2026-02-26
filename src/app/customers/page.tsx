import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { CustomersClient } from './CustomersClient';

export default async function CustomersPage() {
  const [customers, salesOrders, soLines] = await Promise.all([
    fetchAllRecords(TABLES.CUSTOMERS).catch(() => []),
    fetchAllRecords(TABLES.SALES_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.SALES_ORDER_LINES).catch(() => []),
  ]);
  return <CustomersClient customers={customers} salesOrders={salesOrders} soLines={soLines} />;
}
