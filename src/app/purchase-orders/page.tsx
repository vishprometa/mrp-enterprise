import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { PurchaseOrdersClient } from './PurchaseOrdersClient';

export default async function PurchaseOrdersPage() {
  const [orders, suppliers] = await Promise.all([
    fetchAllRecords(TABLES.PURCHASE_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.SUPPLIERS).catch(() => []),
  ]);
  return <PurchaseOrdersClient orders={orders} suppliers={suppliers} />;
}
