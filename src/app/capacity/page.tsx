import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { CapacityClient } from './CapacityClient';

export default async function CapacityPage() {
  const [capacityPlans, workCenters] = await Promise.all([
    fetchAllRecords(TABLES.CAPACITY_PLANS).catch(() => []),
    fetchAllRecords(TABLES.WORK_CENTERS).catch(() => []),
  ]);

  return (
    <CapacityClient
      capacityPlans={capacityPlans}
      workCenters={workCenters}
    />
  );
}
