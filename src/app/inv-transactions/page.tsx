'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Transaction Type', label: 'Transaction Type', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Quantity', label: 'Quantity' },
  { key: 'Reference Number', label: 'Reference Number' },
  { key: 'Transaction Date', label: 'Transaction Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
]

const formFields = [
  { name: 'Transaction Type', label: 'Transaction Type', type: 'select' as const, options: ['Receipt', 'Issue', 'Transfer', 'Adjustment'], required: true },
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Reference Number', label: 'Reference Number', type: 'text' as const },
  { name: 'Transaction Date', label: 'Transaction Date', type: 'date' as const, required: true },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function InvTransactionsPage() {
  return <CrudPage tableName={TABLES.INVENTORY_TRANSACTIONS} title="Inventory Transactions" columns={columns} formFields={formFields} />
}
