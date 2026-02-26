'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Code', label: 'Code' },
  { key: 'Department', label: 'Department', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Capacity Per Hour', label: 'Capacity Per Hour' },
  { key: 'Cost Per Hour', label: 'Cost Per Hour' },
  { key: 'Efficiency Pct', label: 'Efficiency Pct' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Code', label: 'Code', type: 'text', required: true },
  { name: 'Description', label: 'Description', type: 'textarea' },
  {
    name: 'Department',
    label: 'Department',
    type: 'select',
    options: ['Machining', 'Assembly', 'Welding', 'Painting', 'Testing', 'Packaging'],
  },
  { name: 'Capacity Per Hour', label: 'Capacity Per Hour', type: 'number' },
  { name: 'Cost Per Hour', label: 'Cost Per Hour', type: 'number' },
  { name: 'Efficiency Pct', label: 'Efficiency Pct', type: 'number' },
  { name: 'Setup Time Mins', label: 'Setup Time Mins', type: 'number' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    options: ['Active', 'Inactive', 'Under Maintenance'],
  },
  {
    name: 'Shift Pattern',
    label: 'Shift Pattern',
    type: 'select',
    options: ['Single', 'Double', 'Triple', 'Continuous'],
  },
  { name: 'Notes', label: 'Notes', type: 'textarea' },
]

export default function WorkCentersPage() {
  return <CrudPage tableName={TABLES.WORK_CENTERS} title="Work Centers" columns={columns} formFields={formFields} />
}
