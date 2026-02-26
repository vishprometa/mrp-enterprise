import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { ForecastsClient } from './ForecastsClient';

export default async function ForecastsPage() {
  const data = await fetchAllRecords(TABLES.DEMAND_FORECASTS).catch(() => []);
  return <ForecastsClient data={data} />;
}
