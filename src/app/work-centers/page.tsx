'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Work Center Code', label: 'Work Center Code' },
  { key: 'Name', label: 'Name' },
  { key: 'Department', label: 'Department' },
  { key: 'Hourly Rate', label: 'Hourly Rate' },
  { key: 'Capacity Per Day', label: 'Capacity Per Day' },
  { key: 'Efficiency Percent', label: 'Efficiency Percent' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Work Center Code', label: 'Work Center Code', type: 'text', required: true },
  { name: 'Name', label: 'Name', type: 'text', required: true },
  { name: 'Department', label: 'Department', type: 'text' },
  { name: 'Hourly Rate', label: 'Hourly Rate', type: 'number' },
  { name: 'Capacity Per Day', label: 'Capacity Per Day', type: 'number' },
  { name: 'Efficiency Percent', label: 'Efficiency Percent', type: 'number' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    options: ['Active', 'Inactive'],
  },
]

export default function WorkCentersPage() {
  return <CrudPage tableName={TABLES.WORK_CENTERS} title="Work Centers" columns={columns} formFields={formFields} />
}
