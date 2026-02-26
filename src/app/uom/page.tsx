'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Symbol', label: 'Symbol' },
  { key: 'Category', label: 'Category', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Base Unit', label: 'Base Unit' },
  { key: 'Conversion Factor', label: 'Conversion Factor' },
]

const formFields = [
  { name: 'Symbol', label: 'Symbol', type: 'text', required: true },
  {
    name: 'Category',
    label: 'Category',
    type: 'select',
    options: ['Weight', 'Length', 'Volume', 'Count', 'Time', 'Area'],
  },
  { name: 'Base Unit', label: 'Base Unit', type: 'text' },
  { name: 'Conversion Factor', label: 'Conversion Factor', type: 'number' },
  { name: 'Notes', label: 'Notes', type: 'textarea' },
]

export default function UomPage() {
  return <CrudPage tableName={TABLES.UNITS_OF_MEASURE} title="Units of Measure" columns={columns} formFields={formFields} />
}
