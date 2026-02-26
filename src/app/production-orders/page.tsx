import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { ProductionOrdersClient } from './ProductionOrdersClient';

export default async function ProductionOrdersPage() {
  const [orders, items, operations] = await Promise.all([
    fetchAllRecords(TABLES.PRODUCTION_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
    fetchAllRecords(TABLES.PRODUCTION_ORDER_OPS).catch(() => []),
  ]);
  return <ProductionOrdersClient orders={orders} items={items} operations={operations} />;
}
