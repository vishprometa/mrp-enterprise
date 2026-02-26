'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Check Name', label: 'Check Name' },
  { key: 'Parameter', label: 'Parameter' },
  { key: 'Target Value', label: 'Target Value' },
  { key: 'Actual Value', label: 'Actual Value' },
  { key: 'Tolerance', label: 'Tolerance' },
  { key: 'Result', label: 'Result', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Check Name', label: 'Check Name', type: 'text' as const, required: true },
  { name: 'Parameter', label: 'Parameter', type: 'text' as const },
  { name: 'Target Value', label: 'Target Value', type: 'text' as const },
  { name: 'Actual Value', label: 'Actual Value', type: 'text' as const },
  { name: 'Tolerance', label: 'Tolerance', type: 'text' as const },
  { name: 'Result', label: 'Result', type: 'select' as const, options: ['Pass', 'Fail', 'Conditional', 'Not Tested'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function CheckItemsPage() {
  return <CrudPage tableName={TABLES.QUALITY_CHECK_ITEMS} title="Quality Check Items" columns={columns} formFields={formFields} />
}
