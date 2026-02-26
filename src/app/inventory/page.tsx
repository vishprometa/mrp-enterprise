'use client'

import { CrudPage } from '@/components/CrudPage'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Qty On Hand', label: 'Qty On Hand' },
  { key: 'Qty Reserved', label: 'Qty Reserved' },
  { key: 'Qty Available', label: 'Qty Available' },
  { key: 'Lot Number', label: 'Lot Number' },
  { key: 'Expiry Date', label: 'Expiry Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Bin Location', label: 'Bin Location' },
]

const formFields = [
  { name: 'Qty On Hand', label: 'Qty On Hand', type: 'number' as const, required: true },
  { name: 'Qty Reserved', label: 'Qty Reserved', type: 'number' as const },
  { name: 'Qty Available', label: 'Qty Available', type: 'number' as const },
  { name: 'Lot Number', label: 'Lot Number', type: 'text' as const },
  { name: 'Expiry Date', label: 'Expiry Date', type: 'date' as const },
  { name: 'Last Count Date', label: 'Last Count Date', type: 'date' as const },
  { name: 'Bin Location', label: 'Bin Location', type: 'text' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function InventoryPage() {
  return <CrudPage tableName={TABLES.INVENTORY} title="Inventory" columns={columns} formFields={formFields} />
}
