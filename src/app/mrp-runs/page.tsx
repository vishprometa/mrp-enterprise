'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Run Date', label: 'Run Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Planning Horizon Days', label: 'Planning Horizon Days' },
  { key: 'Total Recommendations', label: 'Total Recommendations' },
]

const formFields = [
  { name: 'Run Date', label: 'Run Date', type: 'date' as const, required: true },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Planned', 'Running', 'Completed', 'Failed'] },
  { name: 'Planning Horizon Days', label: 'Planning Horizon Days', type: 'number' as const },
  { name: 'Include Safety Stock', label: 'Include Safety Stock', type: 'checkbox' as const },
  { name: 'Include Forecasts', label: 'Include Forecasts', type: 'checkbox' as const },
  { name: 'Total Recommendations', label: 'Total Recommendations', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function MrpRunsPage() {
  return <CrudPage tableName={TABLES.MRP_RUNS} title="MRP Runs" columns={columns} formFields={formFields} />
}
