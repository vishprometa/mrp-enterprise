import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { UomClient } from './UomClient';

export default async function UomPage() {
  const units = await fetchAllRecords(TABLES.UNITS_OF_MEASURE).catch(() => []);
  return <UomClient units={units} />;
}
