'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Quantity', label: 'Quantity' },
  { key: 'Unit Price', label: 'Unit Price', render: (v: any) => v != null ? '$' + Number(v).toLocaleString() : '—' },
  { key: 'Total Price', label: 'Total Price', render: (v: any) => v != null ? '$' + Number(v).toLocaleString() : '—' },
  { key: 'Received Qty', label: 'Received Qty' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Unit Price', label: 'Unit Price', type: 'number' as const, required: true },
  { name: 'Total Price', label: 'Total Price', type: 'number' as const },
  { name: 'Received Qty', label: 'Received Qty', type: 'number' as const },
  {
    name: 'Status',
    label: 'Status',
    type: 'select' as const,
    options: ['Pending', 'Partially Received', 'Received', 'Cancelled'],
  },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function POLinesPage() {
  return <CrudPage tableName={TABLES.PURCHASE_ORDER_LINES} title="Purchase Order Lines" columns={columns} formFields={formFields} />
}
