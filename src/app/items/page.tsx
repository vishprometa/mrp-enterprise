'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Item Code', label: 'Item Code' },
  { key: 'Item Name', label: 'Item Name' },
  { key: 'Category', label: 'Category' },
  { key: 'Unit Price', label: 'Unit Price' },
  { key: 'Reorder Level', label: 'Reorder Level' },
  { key: 'Safety Stock', label: 'Safety Stock' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Item Code', label: 'Item Code', type: 'text', required: true },
  { name: 'Item Name', label: 'Item Name', type: 'text', required: true },
  {
    name: 'Category',
    label: 'Category',
    type: 'select',
    options: ['Raw Material', 'Finished Good', 'Semi-Finished', 'Consumable', 'Spare Part'],
  },
  { name: 'Unit Price', label: 'Unit Price', type: 'number' },
  { name: 'Reorder Level', label: 'Reorder Level', type: 'number' },
  { name: 'Reorder Quantity', label: 'Reorder Quantity', type: 'number' },
  { name: 'Lead Time Days', label: 'Lead Time Days', type: 'number' },
  { name: 'Safety Stock', label: 'Safety Stock', type: 'number' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    options: ['Active', 'Inactive', 'Obsolete'],
  },
  { name: 'Description', label: 'Description', type: 'textarea' },
]

export default function ItemsPage() {
  return <CrudPage tableName={TABLES.ITEMS} title="Items" columns={columns} formFields={formFields} />
}
