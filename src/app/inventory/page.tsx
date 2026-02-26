'use client'

import { CrudPage } from '@/components/CrudPage'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Quantity On Hand', label: 'Quantity On Hand' },
  { key: 'Quantity Reserved', label: 'Quantity Reserved' },
  { key: 'Quantity Available', label: 'Quantity Available' },
  { key: 'Lot Number', label: 'Lot Number' },
  { key: 'Expiry Date', label: 'Expiry Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Location', label: 'Location' },
]

const formFields = [
  { name: 'Quantity On Hand', label: 'Quantity On Hand', type: 'number' as const, required: true },
  { name: 'Quantity Reserved', label: 'Quantity Reserved', type: 'number' as const },
  { name: 'Quantity Available', label: 'Quantity Available', type: 'number' as const },
  { name: 'Lot Number', label: 'Lot Number', type: 'text' as const },
  { name: 'Expiry Date', label: 'Expiry Date', type: 'date' as const },
  { name: 'Location', label: 'Location', type: 'text' as const },
]

export default function InventoryPage() {
  return <CrudPage tableName={TABLES.INVENTORY} title="Inventory" columns={columns} formFields={formFields} />
}
