'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Code', label: 'Code' },
  { key: 'Department', label: 'Department' },
  { key: 'Budget', label: 'Budget' },
  { key: 'Actual Cost', label: 'Actual Cost' },
  { key: 'Variance', label: 'Variance' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Code', label: 'Code', type: 'text' as const, required: true },
  { name: 'Description', label: 'Description', type: 'textarea' as const },
  { name: 'Department', label: 'Department', type: 'text' as const },
  { name: 'Budget', label: 'Budget', type: 'number' as const },
  { name: 'Actual Cost', label: 'Actual Cost', type: 'number' as const },
  { name: 'Variance', label: 'Variance', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Active', 'Inactive', 'Under Review'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function CostCentersPage() {
  return <CrudPage tableName={TABLES.COST_CENTERS} title="Cost Centers" columns={columns} formFields={formFields} />
}
