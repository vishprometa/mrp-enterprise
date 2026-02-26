'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Type', label: 'Type', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Recommended Date', label: 'Recommended Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Quantity', label: 'Quantity' },
  { key: 'Priority', label: 'Priority', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Reason', label: 'Reason' },
]

const formFields = [
  { name: 'Type', label: 'Type', type: 'select' as const, options: ['Purchase', 'Production', 'Transfer', 'Reschedule'] },
  { name: 'Recommended Date', label: 'Recommended Date', type: 'date' as const, required: true },
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Priority', label: 'Priority', type: 'select' as const, options: ['Critical', 'High', 'Medium', 'Low'] },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Pending', 'Approved', 'Executed', 'Dismissed', 'Deferred'] },
  { name: 'Reason', label: 'Reason', type: 'text' as const },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function MrpRecsPage() {
  return <CrudPage tableName={TABLES.MRP_RECOMMENDATIONS} title="MRP Recommendations" columns={columns} formFields={formFields} />
}
