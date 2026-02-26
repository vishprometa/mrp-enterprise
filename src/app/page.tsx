import { fetchDashboardStats, fetchAllRecords, fetchRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { DashboardClient } from './DashboardClient';

export default async function DashboardPage() {
  const [
    stats,
    items,
    inventory,
    salesOrders,
    purchaseOrders,
    productionOrders,
    soLines,
    poLines,
    qualityInspections,
    suppliers,
    capacityPlans,
    demandForecasts,
  ] = await Promise.all([
    fetchDashboardStats(),
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
    fetchAllRecords(TABLES.INVENTORY).catch(() => []),
    fetchAllRecords(TABLES.SALES_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.PURCHASE_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.PRODUCTION_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.SALES_ORDER_LINES).catch(() => []),
    fetchAllRecords(TABLES.PURCHASE_ORDER_LINES).catch(() => []),
    fetchAllRecords(TABLES.QUALITY_INSPECTIONS).catch(() => []),
    fetchAllRecords(TABLES.SUPPLIERS).catch(() => []),
    fetchAllRecords(TABLES.CAPACITY_PLANS).catch(() => []),
    fetchAllRecords(TABLES.DEMAND_FORECASTS).catch(() => []),
  ]);

  return (
    <DashboardClient
      stats={stats}
      items={items}
      inventory={inventory}
      salesOrders={salesOrders}
      purchaseOrders={purchaseOrders}
      productionOrders={productionOrders}
      soLines={soLines}
      poLines={poLines}
      qualityInspections={qualityInspections}
      suppliers={suppliers}
      capacityPlans={capacityPlans}
      demandForecasts={demandForecasts}
    />
  );
}
