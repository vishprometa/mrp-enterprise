'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Code', label: 'Code' },
  { key: 'Name', label: 'Name' },
  { key: 'Department', label: 'Department' },
  { key: 'Budget', label: 'Budget' },
  { key: 'Actual Cost', label: 'Actual Cost' },
  { key: 'Variance', label: 'Variance' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Code', label: 'Code', type: 'text', required: true },
  { name: 'Name', label: 'Name', type: 'text', required: true },
  { name: 'Department', label: 'Department', type: 'text' },
  { name: 'Budget', label: 'Budget', type: 'number' },
  { name: 'Actual Cost', label: 'Actual Cost', type: 'number' },
  { name: 'Variance', label: 'Variance', type: 'number' },
  { name: 'Manager', label: 'Manager', type: 'text' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    options: ['Active', 'Inactive'],
  },
]

export default function CostCentersPage() {
  return <CrudPage tableName={TABLES.COST_CENTERS} title="Cost Centers" columns={columns} formFields={formFields} />
}
