'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Planned Start', label: 'Planned Start', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Planned End', label: 'Planned End', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Completed Qty', label: 'Completed Qty' },
  { key: 'Scrap Qty', label: 'Scrap Qty' },
]

const formFields = [
  { name: 'Planned Start', label: 'Planned Start', type: 'date' as const },
  { name: 'Planned End', label: 'Planned End', type: 'date' as const },
  { name: 'Actual Start', label: 'Actual Start', type: 'date' as const },
  { name: 'Actual End', label: 'Actual End', type: 'date' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Pending', 'In Progress', 'Completed', 'Skipped'] },
  { name: 'Completed Qty', label: 'Completed Qty', type: 'number' as const },
  { name: 'Scrap Qty', label: 'Scrap Qty', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function ProdOpsPage() {
  return <CrudPage tableName={TABLES.PRODUCTION_ORDER_OPS} title="Production Operations" columns={columns} formFields={formFields} />
}
