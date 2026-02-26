'use client';

const STATUS_MAP: Record<string, string> = {
  // Green - Success states
  Active: 'badge-active',
  Completed: 'badge-active',
  Passed: 'badge-active',
  Pass: 'badge-active',
  Received: 'badge-active',
  Delivered: 'badge-active',
  Approved: 'badge-active',
  Executed: 'badge-active',
  Transfer: 'badge-active',
  // Yellow - Pending states
  Draft: 'badge-draft',
  Planned: 'badge-draft',
  Pending: 'badge-draft',
  'Pending Approval': 'badge-draft',
  Medium: 'badge-draft',
  // Blue - In Progress states
  Running: 'badge-info',
  'In Progress': 'badge-info',
  'In Production': 'badge-info',
  Submitted: 'badge-info',
  Confirmed: 'badge-info',
  Released: 'badge-info',
  'Ready to Ship': 'badge-info',
  Shipped: 'badge-info',
  Low: 'badge-info',
  Purchase: 'badge-info',
  // Gray - Inactive states
  Inactive: 'badge-inactive',
  Obsolete: 'badge-inactive',
  Dismissed: 'badge-inactive',
  Skipped: 'badge-inactive',
  None: 'badge-inactive',
  // Red - Critical states
  Cancelled: 'badge-danger',
  Failed: 'badge-danger',
  Fail: 'badge-danger',
  Blocked: 'badge-danger',
  High: 'badge-danger',
  Critical: 'badge-danger',
  // Purple - Special states
  Warning: 'badge-purple',
  'Conditional Pass': 'badge-purple',
  'Partially Received': 'badge-purple',
  Production: 'badge-purple',
  'Under Review': 'badge-purple',
};

export function StatusBadge({ value }: { value: any }) {
  const str = Array.isArray(value) ? value[0] : String(value ?? '');
  if (!str || str === 'undefined' || str === 'null') return null;
  const cls = STATUS_MAP[str] || 'badge-inactive';
  return <span className={`badge ${cls}`}>{str}</span>;
}
