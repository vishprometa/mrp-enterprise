'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'PO Number', label: 'PO Number' },
  { key: 'Order Date', label: 'Order Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Expected Delivery', label: 'Expected Delivery', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Total Amount', label: 'Total Amount', render: (v: any) => v != null ? '$' + Number(v).toLocaleString() : '—' },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'PO Number', label: 'PO Number', type: 'text' as const, required: true },
  { name: 'Order Date', label: 'Order Date', type: 'date' as const, required: true },
  { name: 'Expected Delivery', label: 'Expected Delivery', type: 'date' as const },
  { name: 'Total Amount', label: 'Total Amount', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Draft', 'Submitted', 'Approved', 'Received', 'Cancelled'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function PurchaseOrdersPage() {
  return <CrudPage tableName={TABLES.PURCHASE_ORDERS} title="Purchase Orders" columns={columns} formFields={formFields} />
}
