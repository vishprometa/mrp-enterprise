'use client';

import { CrudPage } from '@/components/CrudPage';
import { StatusBadge } from '@/components/StatusBadge';
import { TABLES } from '@/lib/tables';

const columns = [
  { key: 'Check Name', label: 'Check Name' },
  { key: 'Specification', label: 'Specification' },
  { key: 'Min Value', label: 'Min Value' },
  { key: 'Max Value', label: 'Max Value' },
  { key: 'Actual Value', label: 'Actual Value' },
  { key: 'Result', label: 'Result', render: (v: any) => <StatusBadge value={v} /> },
];

const formFields = [
  { name: 'Check Name', label: 'Check Name', type: 'text' as const, required: true },
  { name: 'Specification', label: 'Specification', type: 'text' as const },
  { name: 'Min Value', label: 'Min Value', type: 'number' as const },
  { name: 'Max Value', label: 'Max Value', type: 'number' as const },
  { name: 'Actual Value', label: 'Actual Value', type: 'number' as const },
  { name: 'Result', label: 'Result', type: 'select' as const, options: ['Pass', 'Fail'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

export default function CheckItemsPage() {
  return (
    <CrudPage
      tableName={TABLES.QUALITY_CHECK_ITEMS}
      title="Quality Check Items"
      columns={columns}
      formFields={formFields}
    />
  );
}
