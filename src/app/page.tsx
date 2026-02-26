import { fetchDashboardStats, fetchRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const [stats, recentPOs, recentSOs, recentProdOrders] = await Promise.all([
    fetchDashboardStats(),
    fetchRecords(TABLES.PRODUCTION_ORDERS, 1, 5).catch(() => ({ data: [] })),
    fetchRecords(TABLES.SALES_ORDERS, 1, 5).catch(() => ({ data: [] })),
    fetchRecords(TABLES.PURCHASE_ORDERS, 1, 5).catch(() => ({ data: [] })),
  ]);

  return (
    <DashboardClient
      stats={stats}
      recentProdOrders={recentPOs.data || []}
      recentSalesOrders={recentSOs.data || []}
      recentPurchaseOrders={recentProdOrders.data || []}
    />
  );
}
