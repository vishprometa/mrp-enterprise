import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { QualityClient } from './QualityClient';

export default async function InspectionsPage() {
  const [inspections, items] = await Promise.all([
    fetchAllRecords(TABLES.QUALITY_INSPECTIONS).catch(() => []),
    fetchAllRecords(TABLES.ITEMS).catch(() => []),
  ]);
  return <QualityClient inspections={inspections} items={items} />;
}
