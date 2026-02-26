'use client';

import { CrudPage } from '@/components/CrudPage';
import { StatusBadge } from '@/components/StatusBadge';
import { TABLES } from '@/lib/tables';

const columns = [
  { key: 'PO Number', label: 'PO Number' },
  { key: 'Planned Start', label: 'Planned Start', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Planned End', label: 'Planned End', render: (v: any) => v ? new Date(v).toLocaleDateString() : '—' },
  { key: 'Planned Quantity', label: 'Planned Quantity' },
  { key: 'Actual Quantity', label: 'Actual Quantity' },
  { key: 'Priority', label: 'Priority', render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Status', label: 'Status', render: (v: any) => <StatusBadge value={v} /> },
];

const formFields = [
  { name: 'PO Number', label: 'PO Number', type: 'text' as const, required: true },
  { name: 'Planned Start', label: 'Planned Start', type: 'date' as const, required: true },
  { name: 'Planned End', label: 'Planned End', type: 'date' as const },
  { name: 'Actual Start', label: 'Actual Start', type: 'date' as const },
  { name: 'Actual End', label: 'Actual End', type: 'date' as const },
  { name: 'Planned Quantity', label: 'Planned Quantity', type: 'number' as const, required: true },
  { name: 'Actual Quantity', label: 'Actual Quantity', type: 'number' as const },
  { name: 'Priority', label: 'Priority', type: 'select' as const, options: ['High', 'Medium', 'Low'] },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Planned', 'Released', 'In Progress', 'Completed', 'Cancelled'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

export default function ProductionOrdersPage() {
  return (
    <CrudPage
      tableName={TABLES.PRODUCTION_ORDERS}
      title="Production Orders"
      columns={columns}
      formFields={formFields}
    />
  );
}
