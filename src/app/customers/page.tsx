'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Code', label: 'Code' },
  { key: 'Contact Person', label: 'Contact Person' },
  { key: 'Email', label: 'Email' },
  { key: 'Phone', label: 'Phone' },
  { key: 'Country', label: 'Country' },
  { key: 'Credit Limit', label: 'Credit Limit' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Code', label: 'Code', type: 'text', required: true },
  { name: 'Contact Person', label: 'Contact Person', type: 'text', required: true },
  { name: 'Email', label: 'Email', type: 'text' },
  { name: 'Phone', label: 'Phone', type: 'text' },
  { name: 'Address', label: 'Address', type: 'textarea' },
  { name: 'City', label: 'City', type: 'text' },
  { name: 'Country', label: 'Country', type: 'text' },
  {
    name: 'Payment Terms',
    label: 'Payment Terms',
    type: 'select',
    options: ['Net 30', 'Net 45', 'Net 60', 'Immediate'],
  },
  { name: 'Credit Limit', label: 'Credit Limit', type: 'number' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    options: ['Active', 'Inactive', 'On Hold'],
  },
  { name: 'Tax ID', label: 'Tax ID', type: 'text' },
  {
    name: 'Currency',
    label: 'Currency',
    type: 'select',
    options: ['USD', 'EUR', 'GBP', 'JPY'],
  },
  { name: 'Notes', label: 'Notes', type: 'textarea' },
]

export default function CustomersPage() {
  return <CrudPage tableName={TABLES.CUSTOMERS} title="Customers" columns={columns} formFields={formFields} />
}
