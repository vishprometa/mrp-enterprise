'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Inspection Date', label: 'Inspection Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Type', label: 'Type', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Inspector', label: 'Inspector' },
  { key: 'Overall Score', label: 'Overall Score' },
]

const formFields = [
  { name: 'Inspection Date', label: 'Inspection Date', type: 'date' as const, required: true },
  { name: 'Type', label: 'Type', type: 'select' as const, options: ['Incoming', 'In-Process', 'Final', 'Routine'] },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Pending', 'In Progress', 'Passed', 'Failed', 'On Hold'] },
  { name: 'Inspector', label: 'Inspector', type: 'text' as const },
  { name: 'Overall Score', label: 'Overall Score', type: 'number' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function InspectionsPage() {
  return <CrudPage tableName={TABLES.QUALITY_INSPECTIONS} title="Quality Inspections" columns={columns} formFields={formFields} />
}
