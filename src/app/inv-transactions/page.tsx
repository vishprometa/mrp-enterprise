import { fetchAllRecords } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { InvTransactionsClient } from './InvTransactionsClient';

export default async function InvTransactionsPage() {
  const transactions = await fetchAllRecords(TABLES.INVENTORY_TRANSACTIONS).catch(() => []);
  return <InvTransactionsClient transactions={transactions} />;
}
