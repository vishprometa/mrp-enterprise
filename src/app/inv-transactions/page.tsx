'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Transaction Date', label: 'Transaction Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Type', label: 'Type', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Quantity', label: 'Quantity' },
  { key: 'Reference Number', label: 'Reference Number' },
  { key: 'Unit Cost', label: 'Unit Cost', render: (v: any) => v != null ? '$' + Number(v).toLocaleString() : '—' },
  { key: 'Total Cost', label: 'Total Cost', render: (v: any) => v != null ? '$' + Number(v).toLocaleString() : '—' },
]

const formFields = [
  { name: 'Transaction Date', label: 'Transaction Date', type: 'date' as const, required: true },
  { name: 'Type', label: 'Type', type: 'select' as const, options: ['Receipt', 'Issue', 'Transfer', 'Adjustment', 'Return'] },
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Reference Number', label: 'Reference Number', type: 'text' as const },
  { name: 'Unit Cost', label: 'Unit Cost', type: 'number' as const },
  { name: 'Total Cost', label: 'Total Cost', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function InvTransactionsPage() {
  return <CrudPage tableName={TABLES.INVENTORY_TRANSACTIONS} title="Inventory Transactions" columns={columns} formFields={formFields} />
}
