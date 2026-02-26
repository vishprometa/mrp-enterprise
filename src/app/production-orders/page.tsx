'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'WO Number', label: 'WO Number' },
  { key: 'Start Date', label: 'Start Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'End Date', label: 'End Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Planned Qty', label: 'Planned Qty' },
  { key: 'Completed Qty', label: 'Completed Qty' },
  { key: 'Priority', label: 'Priority', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'WO Number', label: 'WO Number', type: 'text' as const, required: true },
  { name: 'Start Date', label: 'Start Date', type: 'date' as const, required: true },
  { name: 'End Date', label: 'End Date', type: 'date' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Planned', 'Released', 'In Progress', 'Completed', 'Cancelled'] },
  { name: 'Priority', label: 'Priority', type: 'select' as const, options: ['High', 'Medium', 'Low', 'Urgent'] },
  { name: 'Planned Qty', label: 'Planned Qty', type: 'number' as const, required: true },
  { name: 'Completed Qty', label: 'Completed Qty', type: 'number' as const },
  { name: 'Scrap Qty', label: 'Scrap Qty', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function ProductionOrdersPage() {
  return <CrudPage tableName={TABLES.PRODUCTION_ORDERS} title="Production Orders" columns={columns} formFields={formFields} />
}
