'use client'

import { CrudPage } from '@/components/CrudPage'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Line Number', label: 'Line Number' },
  { key: 'Quantity', label: 'Quantity' },
  { key: 'Scrap Percent', label: 'Scrap Percent' },
  { key: 'Position', label: 'Position' },
  { key: 'Notes', label: 'Notes' },
]

const formFields = [
  { name: 'Line Number', label: 'Line Number', type: 'number' as const, required: true },
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Scrap Percent', label: 'Scrap Percent', type: 'number' as const },
  { name: 'Position', label: 'Position', type: 'text' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function BOMlinesPage() {
  return <CrudPage tableName={TABLES.BOM_LINES} title="BOM Lines" columns={columns} formFields={formFields} />
}
