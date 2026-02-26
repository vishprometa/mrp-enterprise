'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Line Number', label: 'Line Number' },
  { key: 'Quantity', label: 'Quantity' },
  { key: 'Unit Price', label: 'Unit Price', render: (v: any) => v != null ? '$' + Number(v).toLocaleString() : '—' },
  { key: 'Line Total', label: 'Line Total', render: (v: any) => v != null ? '$' + Number(v).toLocaleString() : '—' },
  { key: 'Received Quantity', label: 'Received Quantity' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Line Number', label: 'Line Number', type: 'number' as const, required: true },
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Unit Price', label: 'Unit Price', type: 'number' as const, required: true },
  { name: 'Line Total', label: 'Line Total', type: 'number' as const },
  { name: 'Received Quantity', label: 'Received Quantity', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Pending', 'Partially Received', 'Received', 'Cancelled'] },
]

export default function POLinesPage() {
  return <CrudPage tableName={TABLES.PURCHASE_ORDER_LINES} title="Purchase Order Lines" columns={columns} formFields={formFields} />
}
