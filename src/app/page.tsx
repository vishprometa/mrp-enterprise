import { fetchDashboardStats, fetchRecords, fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const [stats, recentProdOrders, recentSOs, recentPOs, inventoryData, items] = await Promise.all([
    fetchDashboardStats(),
    fetchRecords(TABLES.PRODUCTION_ORDERS, 1, 8).catch(() => ({ data: [] })),
    fetchRecords(TABLES.SALES_ORDERS, 1, 8).catch(() => ({ data: [] })),
    fetchRecords(TABLES.PURCHASE_ORDERS, 1, 8).catch(() => ({ data: [] })),
    fetchAllRecords(TABLES.INVENTORY).catch(() => []),
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
  ]);

  return (
    <DashboardClient
      stats={stats}
      recentProdOrders={recentProdOrders.data || []}
      recentSalesOrders={recentSOs.data || []}
      recentPurchaseOrders={recentPOs.data || []}
      inventoryData={inventoryData}
      items={items}
    />
  );
}
