import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { WorkCentersClient } from './WorkCentersClient';

export default async function WorkCentersPage() {
  const [workCenters, routingOps, capacityPlans] = await Promise.all([
    fetchAllRecords(TABLES.WORK_CENTERS).catch(() => []),
    fetchAllRecords(TABLES.ROUTING_OPERATIONS).catch(() => []),
    fetchAllRecords(TABLES.CAPACITY_PLANS).catch(() => []),
  ]);

  return (
    <WorkCentersClient
      workCenters={workCenters}
      routingOps={routingOps}
      capacityPlans={capacityPlans}
    />
  );
}
