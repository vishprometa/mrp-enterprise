'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'Plan Name', label: 'Plan Name' },
  { key: 'Period Start', label: 'Period Start', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Period End', label: 'Period End', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Planned Hours', label: 'Planned Hours' },
  { key: 'Available Hours', label: 'Available Hours' },
  { key: 'Utilization Percent', label: 'Utilization Percent' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'Plan Name', label: 'Plan Name', type: 'text' as const, required: true },
  { name: 'Period Start', label: 'Period Start', type: 'date' as const, required: true },
  { name: 'Period End', label: 'Period End', type: 'date' as const, required: true },
  { name: 'Planned Hours', label: 'Planned Hours', type: 'number' as const },
  { name: 'Available Hours', label: 'Available Hours', type: 'number' as const },
  { name: 'Utilization Percent', label: 'Utilization Percent', type: 'number' as const },
  {
    name: 'Status',
    label: 'Status',
    type: 'select' as const,
    options: ['Draft', 'Active', 'Approved'],
  },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function CapacityPage() {
  return <CrudPage tableName={TABLES.CAPACITY_PLANS} title="Capacity Plans" columns={columns} formFields={formFields} />
}
