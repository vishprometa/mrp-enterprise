'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Warehouse Code', label: 'Warehouse Code' },
  { key: 'Name', label: 'Name' },
  { key: 'Location', label: 'Location' },
  { key: 'City', label: 'City' },
  { key: 'Country', label: 'Country' },
  { key: 'Capacity', label: 'Capacity' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Warehouse Code', label: 'Warehouse Code', type: 'text', required: true },
  { name: 'Name', label: 'Name', type: 'text', required: true },
  { name: 'Location', label: 'Location', type: 'text' },
  { name: 'City', label: 'City', type: 'text' },
  { name: 'Country', label: 'Country', type: 'text' },
  { name: 'Capacity', label: 'Capacity', type: 'number' },
  { name: 'Manager', label: 'Manager', type: 'text' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    options: ['Active', 'Inactive'],
  },
]

export default function WarehousesPage() {
  return <CrudPage tableName={TABLES.WAREHOUSES} title="Warehouses" columns={columns} formFields={formFields} />
}
