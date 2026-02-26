'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Routing Code', label: 'Routing Code' },
  { key: 'Name', label: 'Name' },
  { key: 'Version', label: 'Version' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Routing Code', label: 'Routing Code', type: 'text' as const, required: true },
  { name: 'Name', label: 'Name', type: 'text' as const, required: true },
  { name: 'Version', label: 'Version', type: 'text' as const },
  {
    name: 'Status',
    label: 'Status',
    type: 'select' as const,
    options: ['Draft', 'Active', 'Obsolete'],
  },
]

export default function RoutingsPage() {
  return <CrudPage tableName={TABLES.ROUTINGS} title="Routings" columns={columns} formFields={formFields} />
}
