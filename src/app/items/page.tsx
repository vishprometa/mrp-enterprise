'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'SKU', label: 'SKU' },
  { key: 'Item Type', label: 'Item Type', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Category', label: 'Category', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Unit of Measure', label: 'Unit of Measure' },
  { key: 'Standard Cost', label: 'Standard Cost' },
  { key: 'Safety Stock', label: 'Safety Stock' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'SKU', label: 'SKU', type: 'text', required: true },
  { name: 'Description', label: 'Description', type: 'textarea' },
  {
    name: 'Item Type',
    label: 'Item Type',
    type: 'select',
    options: ['Raw Material', 'Semi-Finished', 'Finished Good', 'Consumable'],
  },
  {
    name: 'Category',
    label: 'Category',
    type: 'select',
    options: ['Metal', 'Plastic', 'Electronic', 'Chemical', 'Mechanical'],
  },
  { name: 'Unit of Measure', label: 'Unit of Measure', type: 'text' },
  { name: 'Lead Time Days', label: 'Lead Time Days', type: 'number' },
  { name: 'Safety Stock', label: 'Safety Stock', type: 'number' },
  { name: 'Reorder Point', label: 'Reorder Point', type: 'number' },
  { name: 'Standard Cost', label: 'Standard Cost', type: 'number' },
  { name: 'Weight', label: 'Weight', type: 'number' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    options: ['Active', 'Inactive', 'Pending Approval', 'Obsolete'],
  },
  { name: 'Min Order Qty', label: 'Min Order Qty', type: 'number' },
  { name: 'Max Order Qty', label: 'Max Order Qty', type: 'number' },
  { name: 'Shelf Life Days', label: 'Shelf Life Days', type: 'number' },
  { name: 'Storage Conditions', label: 'Storage Conditions', type: 'text' },
  { name: 'Notes', label: 'Notes', type: 'textarea' },
]

export default function ItemsPage() {
  return <CrudPage tableName={TABLES.ITEMS} title="Items" columns={columns} formFields={formFields} />
}
