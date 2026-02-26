'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'BOM Code', label: 'BOM Code' },
  { key: 'Version', label: 'Version' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Effective Date', label: 'Effective Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Expiry Date', label: 'Expiry Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Yield Pct', label: 'Yield Pct' },
]

const formFields = [
  { name: 'BOM Code', label: 'BOM Code', type: 'text' as const, required: true },
  { name: 'Version', label: 'Version', type: 'number' as const },
  {
    name: 'Status',
    label: 'Status',
    type: 'select' as const,
    options: ['Draft', 'Active', 'Obsolete', 'Under Review'],
  },
  { name: 'Effective Date', label: 'Effective Date', type: 'date' as const },
  { name: 'Expiry Date', label: 'Expiry Date', type: 'date' as const },
  { name: 'Yield Pct', label: 'Yield Pct', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function BOMPage() {
  return <CrudPage tableName={TABLES.BILL_OF_MATERIALS} title="Bill of Materials" columns={columns} formFields={formFields} />
}
