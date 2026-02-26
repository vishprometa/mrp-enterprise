'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'BOM Code', label: 'BOM Code' },
  { key: 'Name', label: 'Name' },
  { key: 'Version', label: 'Version' },
  { key: 'Effective Date', label: 'Effective Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Expiry Date', label: 'Expiry Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'BOM Code', label: 'BOM Code', type: 'text' as const, required: true },
  { name: 'Name', label: 'Name', type: 'text' as const, required: true },
  { name: 'Version', label: 'Version', type: 'text' as const },
  { name: 'Effective Date', label: 'Effective Date', type: 'date' as const },
  { name: 'Expiry Date', label: 'Expiry Date', type: 'date' as const },
  {
    name: 'Status',
    label: 'Status',
    type: 'select' as const,
    options: ['Draft', 'Active', 'Obsolete'],
  },
]

export default function BOMPage() {
  return <CrudPage tableName={TABLES.BILL_OF_MATERIALS} title="Bill of Materials" columns={columns} formFields={formFields} />
}
