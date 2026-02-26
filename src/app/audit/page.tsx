import { fetchRecords, fetchDashboardStats } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { AuditClient } from './AuditClient';

export default async function AuditPage() {
  const [stats, poData, soData, prodData, inspData, invTxData] = await Promise.all([
    fetchDashboardStats(),
    fetchRecords(TABLES.PURCHASE_ORDERS, 1, 50).catch(() => ({ data: [] })),
    fetchRecords(TABLES.SALES_ORDERS, 1, 50).catch(() => ({ data: [] })),
    fetchRecords(TABLES.PRODUCTION_ORDERS, 1, 50).catch(() => ({ data: [] })),
    fetchRecords(TABLES.QUALITY_INSPECTIONS, 1, 50).catch(() => ({ data: [] })),
    fetchRecords(TABLES.INVENTORY_TRANSACTIONS, 1, 50).catch(() => ({ data: [] })),
  ]);

  return (
    <AuditClient
      stats={stats}
      purchaseOrders={poData.data || []}
      salesOrders={soData.data || []}
      productionOrders={prodData.data || []}
      qualityInspections={inspData.data || []}
      inventoryTransactions={invTxData.data || []}
    />
  );
}
