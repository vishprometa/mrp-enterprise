'use client'

import { CrudPage } from '@/components/CrudPage'
import { StatusBadge } from '@/components/StatusBadge'
import { TABLES } from '@/lib/tables'

const columns = [
  { key: 'SO Number', label: 'SO Number' },
  { key: 'Order Date', label: 'Order Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Required Date', label: 'Required Date', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Total Amount', label: 'Total Amount', render: (v: any) => v != null ? '$' + Number(v).toLocaleString() : '—' },
  { key: 'Priority', label: 'Priority', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
]

const formFields = [
  { name: 'SO Number', label: 'SO Number', type: 'text' as const, required: true },
  { name: 'Order Date', label: 'Order Date', type: 'date' as const, required: true },
  { name: 'Required Date', label: 'Required Date', type: 'date' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Draft', 'Confirmed', 'In Production', 'Ready to Ship', 'Shipped', 'Delivered', 'Cancelled'] },
  { name: 'Total Amount', label: 'Total Amount', type: 'number' as const },
  { name: 'Priority', label: 'Priority', type: 'select' as const, options: ['High', 'Medium', 'Low', 'Urgent'] },
  { name: 'Shipping Method', label: 'Shipping Method', type: 'select' as const, options: ['Ground', 'Air', 'Sea', 'Express'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
]

export default function SalesOrdersPage() {
  return <CrudPage tableName={TABLES.SALES_ORDERS} title="Sales Orders" columns={columns} formFields={formFields} />
}
