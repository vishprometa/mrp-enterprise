import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { MrpSimulation } from './MrpSimulation';

export default async function MrpPage() {
  const [items, boms, bomLines, inventory, salesOrderLines, productionOrders] = await Promise.all([
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
    fetchAllRecords(TABLES.BILL_OF_MATERIALS).catch(() => []),
    fetchAllRecords(TABLES.BOM_LINES).catch(() => []),
    fetchAllRecords(TABLES.INVENTORY).catch(() => []),
    fetchAllRecords(TABLES.SALES_ORDER_LINES).catch(() => []),
    fetchAllRecords(TABLES.PRODUCTION_ORDERS).catch(() => []),
  ]);

  return (
    <MrpSimulation
      items={items}
      boms={boms}
      bomLines={bomLines}
      inventory={inventory}
      salesOrderLines={salesOrderLines}
      productionOrders={productionOrders}
    />
  );
}
