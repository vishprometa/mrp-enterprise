'use client';

const STATUS_MAP: Record<string, string> = {
  Active: 'badge-active',
  Completed: 'badge-active',
  Passed: 'badge-active',
  Pass: 'badge-active',
  Received: 'badge-active',
  Delivered: 'badge-active',
  Approved: 'badge-active',
  Executed: 'badge-active',
  Draft: 'badge-draft',
  Planned: 'badge-draft',
  Pending: 'badge-draft',
  'Pending Approval': 'badge-draft',
  Running: 'badge-info',
  'In Progress': 'badge-info',
  'In Production': 'badge-info',
  Submitted: 'badge-info',
  Confirmed: 'badge-info',
  Released: 'badge-info',
  'Ready to Ship': 'badge-info',
  Shipped: 'badge-info',
  Inactive: 'badge-inactive',
  Obsolete: 'badge-inactive',
  Dismissed: 'badge-inactive',
  Skipped: 'badge-inactive',
  Cancelled: 'badge-danger',
  Failed: 'badge-danger',
  Fail: 'badge-danger',
  Blocked: 'badge-danger',
  Warning: 'badge-purple',
  'Conditional Pass': 'badge-purple',
  'Partially Received': 'badge-purple',
  High: 'badge-danger',
  Critical: 'badge-danger',
  Medium: 'badge-draft',
  Low: 'badge-info',
  Purchase: 'badge-info',
  Production: 'badge-purple',
  Transfer: 'badge-active',
};

export function StatusBadge({ value }: { value: any }) {
  const str = Array.isArray(value) ? value[0] : String(value ?? '');
  if (!str) return null;
  const cls = STATUS_MAP[str] || 'badge-inactive';
  return <span className={`badge ${cls}`}>{str}</span>;
}
