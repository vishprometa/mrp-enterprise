import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { AnalyticsClient } from './AnalyticsClient';

export default async function AnalyticsPage() {
  const [
    items,
    suppliers,
    customers,
    inventory,
    prodOrders,
    purchaseOrders,
    salesOrders,
    salesOrderLines,
    purchaseOrderLines,
    qualityInspections,
    capacityPlans,
    costCenters,
    demandForecasts,
    billOfMaterials,
    bomLines,
  ] = await Promise.all([
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
    fetchAllRecords(TABLES.SUPPLIERS).catch(() => []),
    fetchAllRecords(TABLES.CUSTOMERS).catch(() => []),
    fetchAllRecords(TABLES.INVENTORY).catch(() => []),
    fetchAllRecords(TABLES.PRODUCTION_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.PURCHASE_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.SALES_ORDERS).catch(() => []),
    fetchAllRecords(TABLES.SALES_ORDER_LINES).catch(() => []),
    fetchAllRecords(TABLES.PURCHASE_ORDER_LINES).catch(() => []),
    fetchAllRecords(TABLES.QUALITY_INSPECTIONS).catch(() => []),
    fetchAllRecords(TABLES.CAPACITY_PLANS).catch(() => []),
    fetchAllRecords(TABLES.COST_CENTERS).catch(() => []),
    fetchAllRecords(TABLES.DEMAND_FORECASTS).catch(() => []),
    fetchAllRecords(TABLES.BILL_OF_MATERIALS).catch(() => []),
    fetchAllRecords(TABLES.BOM_LINES).catch(() => []),
  ]);

  return (
    <AnalyticsClient
      items={items}
      suppliers={suppliers}
      customers={customers}
      inventory={inventory}
      prodOrders={prodOrders}
      purchaseOrders={purchaseOrders}
      salesOrders={salesOrders}
      salesOrderLines={salesOrderLines}
      purchaseOrderLines={purchaseOrderLines}
      qualityInspections={qualityInspections}
      capacityPlans={capacityPlans}
      costCenters={costCenters}
      demandForecasts={demandForecasts}
      billOfMaterials={billOfMaterials}
      bomLines={bomLines}
    />
  );
}
