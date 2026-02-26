import { fetchAllRecords, fetchDashboardStats } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { AnalyticsClient } from './AnalyticsClient';

export default async function AnalyticsPage() {
  const [stats, items, inventory, prodOrders, purchaseOrders, salesOrders, capacityPlans, costCenters] = await Promise.all([
    fetchDashboardStats(),
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
    fetchAllRecords(TABLES.INVENTORY).catch(() => []),
    fetchAllRecords(TABLES.PRODUCTION_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.PURCHASE_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.SALES_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.CAPACITY_PLANS).catch(() => []),
    fetchAllRecords(TABLES.COST_CENTERS).catch(() => []),
  ]);
  return <AnalyticsClient stats={stats} items={items} inventory={inventory} prodOrders={prodOrders} purchaseOrders={purchaseOrders} salesOrders={salesOrders} capacityPlans={capacityPlans} costCenters={costCenters} />;
}
