'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Code', label: 'Code' },
  { key: 'City', label: 'City' },
  { key: 'Country', label: 'Country' },
  { key: 'Type', label: 'Type', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Capacity', label: 'Capacity' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Manager', label: 'Manager' },
]

const formFields = [
  { name: 'Code', label: 'Code', type: 'text', required: true },
  { name: 'Address', label: 'Address', type: 'textarea' },
  { name: 'City', label: 'City', type: 'text' },
  { name: 'Country', label: 'Country', type: 'text' },
  {
    name: 'Type',
    label: 'Type',
    type: 'select',
    options: ['Raw Materials', 'WIP', 'Finished Goods', 'Distribution', 'Returns'],
  },
  { name: 'Capacity', label: 'Capacity', type: 'number' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    options: ['Active', 'Inactive', 'Under Maintenance'],
  },
  { name: 'Manager', label: 'Manager', type: 'text' },
  { name: 'Notes', label: 'Notes', type: 'textarea' },
]

export default function WarehousesPage() {
  return <CrudPage tableName={TABLES.WAREHOUSES} title="Warehouses" columns={columns} formFields={formFields} />
}
