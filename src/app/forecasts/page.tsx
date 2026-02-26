import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { ForecastsClient } from './ForecastsClient';

export default async function ForecastsPage() {
  const [forecasts, items, salesOrders] = await Promise.all([
    fetchAllRecords(TABLES.DEMAND_FORECASTS).catch(() => []),
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
    fetchAllRecords(TABLES.SALES_ORDERS).catch(() => []),
  ]);
  return <ForecastsClient forecasts={forecasts} items={items} salesOrders={salesOrders} />;
}
