'use client'

import { CrudPage } from '@/components/CrudPage'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Code', label: 'Code' },
  { key: 'Name', label: 'Name' },
  { key: 'Category', label: 'Category' },
  { key: 'Conversion Factor', label: 'Conversion Factor' },
  { key: 'Base Unit', label: 'Base Unit' },
]

const formFields = [
  { name: 'Code', label: 'Code', type: 'text', required: true },
  { name: 'Name', label: 'Name', type: 'text', required: true },
  {
    name: 'Category',
    label: 'Category',
    type: 'select',
    options: ['Weight', 'Length', 'Volume', 'Count', 'Time'],
  },
  { name: 'Conversion Factor', label: 'Conversion Factor', type: 'number' },
  { name: 'Base Unit', label: 'Base Unit', type: 'text' },
]

export default function UomPage() {
  return <CrudPage tableName={TABLES.UNITS_OF_MEASURE} title="Units of Measure" columns={columns} formFields={formFields} />
}
