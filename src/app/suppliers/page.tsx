'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Supplier Code', label: 'Supplier Code' },
  { key: 'Company Name', label: 'Company Name' },
  { key: 'Contact Person', label: 'Contact Person' },
  { key: 'Email', label: 'Email' },
  { key: 'Phone', label: 'Phone' },
  { key: 'Payment Terms', label: 'Payment Terms' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Supplier Code', label: 'Supplier Code', type: 'text', required: true },
  { name: 'Company Name', label: 'Company Name', type: 'text', required: true },
  { name: 'Contact Person', label: 'Contact Person', type: 'text' },
  { name: 'Email', label: 'Email', type: 'text' },
  { name: 'Phone', label: 'Phone', type: 'text' },
  { name: 'Address', label: 'Address', type: 'text' },
  { name: 'City', label: 'City', type: 'text' },
  { name: 'Country', label: 'Country', type: 'text' },
  {
    name: 'Payment Terms',
    label: 'Payment Terms',
    type: 'select',
    options: ['Net 30', 'Net 45', 'Net 60', 'COD'],
  },
  { name: 'Rating Score', label: 'Rating Score', type: 'number' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    options: ['Active', 'Inactive'],
  },
]

export default function SuppliersPage() {
  return <CrudPage tableName={TABLES.SUPPLIERS} title="Suppliers" columns={columns} formFields={formFields} />
}
