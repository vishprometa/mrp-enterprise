'use client'

import { CrudPage } from '@/components/CrudPage'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Quantity', label: 'Quantity' },
  { key: 'Scrap Pct', label: 'Scrap Pct' },
  { key: 'Position', label: 'Position' },
]

const formFields = [
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Scrap Pct', label: 'Scrap Pct', type: 'number' as const },
  { name: 'Position', label: 'Position', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function BOMlinesPage() {
  return <CrudPage tableName={TABLES.BOM_LINES} title="BOM Lines" columns={columns} formFields={formFields} />
}
