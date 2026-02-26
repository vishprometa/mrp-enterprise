'use client';

import { useState, useMemo } from 'react';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

interface Props {
  stats: Record<string, number>;
  purchaseOrders: any[];
  salesOrders: any[];
  productionOrders: any[];
  qualityInspections: any[];
  inventoryTransactions: any[];
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  sortKey: number;
  module: string;
  moduleColor: string;
  reference: string;
  status: string;
  detail: string;
}

const MODULE_COLORS: Record<string, string> = {
  'Purchasing': '#8b5cf6',
  'Sales': '#10b981',
  'Production': '#f59e0b',
  'Quality': '#06b6d4',
  'Inventory': '#ec4899',
};

const STATUS_COLORS: Record<string, string> = {
  'Draft': '#64748b',
  'Planned': '#f59e0b',
  'Pending': '#f59e0b',
  'Active': '#10b981',
  'Approved': '#10b981',
  'Released': '#3b82f6',
  'In Progress': '#3b82f6',
  'In Production': '#3b82f6',
  'Completed': '#6366f1',
  'Passed': '#10b981',
  'Failed': '#ef4444',
  'Cancelled': '#ef4444',
  'Received': '#10b981',
  'Shipped': '#06b6d4',
};

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function resolveStatus(val: any): string {
  if (Array.isArray(val)) return val[0] || 'Unknown';
  return String(val ?? 'Unknown');
}

function parseDate(val: any): { display: string; sortKey: number } {
  if (!val) return { display: '\u2014', sortKey: 0 };
  const d = new Date(val);
  if (isNaN(d.getTime())) return { display: String(val), sortKey: 0 };
  return {
    display: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    sortKey: d.getTime(),
  };
}

/* ═════════════════════════════════════════════
   Component
   ═════════════════════════════════════════════ */

export function AuditClient({ stats, purchaseOrders, salesOrders, productionOrders, qualityInspections, inventoryTransactions }: Props) {
  const [moduleFilter, setModuleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Build activity entries from real data
  const allActivity = useMemo(() => {
    const entries: ActivityEntry[] = [];

    for (const po of purchaseOrders) {
      const d = parseDate(po['Order Date']);
      entries.push({
        id: po.id || `po-${entries.length}`,
        timestamp: d.display,
        sortKey: d.sortKey,
        module: 'Purchasing',
        moduleColor: MODULE_COLORS['Purchasing'],
        reference: po['PO Number'] || '\u2014',
        status: resolveStatus(po['Status']),
        detail: `Amount: $${Number(po['Total Amount'] || 0).toLocaleString()} | Priority: ${resolveStatus(po['Priority'])}`,
      });
    }

    for (const so of salesOrders) {
      const d = parseDate(so['Order Date']);
      entries.push({
        id: so.id || `so-${entries.length}`,
        timestamp: d.display,
        sortKey: d.sortKey,
        module: 'Sales',
        moduleColor: MODULE_COLORS['Sales'],
        reference: so['SO Number'] || '\u2014',
        status: resolveStatus(so['Status']),
        detail: `Amount: $${Number(so['Total Amount'] || 0).toLocaleString()} | Shipping: ${resolveStatus(so['Shipping Method'])}`,
      });
    }

    for (const wo of productionOrders) {
      const d = parseDate(wo['Start Date']);
      entries.push({
        id: wo.id || `wo-${entries.length}`,
        timestamp: d.display,
        sortKey: d.sortKey,
        module: 'Production',
        moduleColor: MODULE_COLORS['Production'],
        reference: wo['WO Number'] || '\u2014',
        status: resolveStatus(wo['Status']),
        detail: `Planned: ${wo['Planned Qty'] || 0} | Completed: ${wo['Completed Qty'] || 0} | Scrap: ${wo['Scrap Qty'] || 0}`,
      });
    }

    for (const insp of qualityInspections) {
      const d = parseDate(insp['Inspection Date']);
      entries.push({
        id: insp.id || `qi-${entries.length}`,
        timestamp: d.display,
        sortKey: d.sortKey,
        module: 'Quality',
        moduleColor: MODULE_COLORS['Quality'],
        reference: `Score: ${insp['Overall Score'] ?? '\u2014'}`,
        status: resolveStatus(insp['Status']),
        detail: `Type: ${resolveStatus(insp['Type'])} | Inspector: ${insp['Inspector'] || '\u2014'}`,
      });
    }

    for (const tx of inventoryTransactions) {
      const d = parseDate(tx['Transaction Date']);
      entries.push({
        id: tx.id || `tx-${entries.length}`,
        timestamp: d.display,
        sortKey: d.sortKey,
        module: 'Inventory',
        moduleColor: MODULE_COLORS['Inventory'],
        reference: tx['Reference Number'] || '\u2014',
        status: resolveStatus(tx['Type']),
        detail: `Qty: ${tx['Quantity'] || 0} | Cost: $${Number(tx['Total Cost'] || 0).toLocaleString()}`,
      });
    }

    return entries.sort((a, b) => b.sortKey - a.sortKey);
  }, [purchaseOrders, salesOrders, productionOrders, qualityInspections, inventoryTransactions]);

  const modules = useMemo(() => ['All', ...Object.keys(MODULE_COLORS)], []);
  const statuses = useMemo(() => {
    const set = new Set(allActivity.map(a => a.status));
    return ['All', ...Array.from(set).sort()];
  }, [allActivity]);

  const filtered = useMemo(() => {
    let result = allActivity;
    if (moduleFilter !== 'All') result = result.filter(a => a.module === moduleFilter);
    if (statusFilter !== 'All') result = result.filter(a => a.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.reference.toLowerCase().includes(q) ||
        a.module.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q) ||
        a.detail.toLowerCase().includes(q) ||
        a.timestamp.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allActivity, moduleFilter, statusFilter, searchQuery]);

  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of allActivity) counts[a.module] = (counts[a.module] || 0) + 1;
    return counts;
  }, [allActivity]);

  const totalRecords = allActivity.length;

  function exportCSV() {
    const header = 'Timestamp,Module,Reference,Status,Detail';
    const rows = filtered.map(a => `"${a.timestamp}","${a.module}","${a.reference}","${a.status}","${a.detail}"`);
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'activity-log.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Log</h1>
          <p className="page-subtitle">Real-time activity across all modules &mdash; {totalRecords} records from live API</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="export-btn" onClick={exportCSV}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Activity</div>
          <div className="kpi-value">{totalRecords}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Across all modules</div>
        </div>
        {Object.entries(MODULE_COLORS).map(([mod, color]) => (
          <div key={mod} className="kpi-card">
            <div className="kpi-label">{mod}</div>
            <div className="kpi-value" style={{ color }}>{moduleCounts[mod] || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Records</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-bar" style={{ flex: '0 0 300px' }}>
          <span className="search-icon">&#128269;</span>
          <input className="input" placeholder="Search activity..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        {modules.map((mod) => (
          <button key={mod} className={`filter-pill${moduleFilter === mod ? ' active' : ''}`} onClick={() => setModuleFilter(mod)}>
            {mod} {mod !== 'All' && <span style={{ opacity: 0.6 }}>({moduleCounts[mod] || 0})</span>}
          </button>
        ))}
        <select className="input" style={{ width: 180, flex: 'none' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {statuses.map(s => <option key={s} value={s}>{s === 'All' ? 'STATUS: All' : s}</option>)}
        </select>
      </div>

      {/* Results Count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 4px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Showing {Math.min(filtered.length, 50)} of {filtered.length} records</span>
      </div>

      {/* Activity Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Module</th>
              <th>Reference</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No activity records found.</td></tr>
            ) : (
              filtered.slice(0, 50).map((entry) => (
                <tr key={entry.id}>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{entry.timestamp}</td>
                  <td><span className="badge" style={{ background: `${entry.moduleColor}18`, color: entry.moduleColor }}>{entry.module}</span></td>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}><span className="mono-text">{entry.reference}</span></td>
                  <td><span className="badge" style={{ background: `${STATUS_COLORS[entry.status] || '#64748b'}18`, color: STATUS_COLORS[entry.status] || '#64748b' }}>{entry.status}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 400 }}>{entry.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 50 && (
        <div className="pagination" style={{ marginTop: 16 }}>
          <span className="pagination-info">Showing first 50 of {filtered.length} records</span>
        </div>
      )}
    </>
  );
}
