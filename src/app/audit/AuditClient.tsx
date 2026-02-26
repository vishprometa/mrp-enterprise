'use client';

import { useState, useMemo } from 'react';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
type Severity = 'Info' | 'Warning' | 'Error' | 'Critical';

interface AuditRecord {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  actionClass: string;
  page: string;
  device: string;
  severity: Severity;
  system: string;
}

/* ─────────────────────────────────────────────
   Mock Data Generators
   ───────────────────────────────────────────── */
const USERS = [
  'registrar.lee',
  'student.worker',
  'sarah.finance',
  'librarian.patel',
  'prof.smith',
  'admin.jones',
  'dean.martinez',
  'it.support',
  'hr.wilson',
  'campus.ops',
  'grad.chen',
  'facilities.mgr',
];

const ACTIONS: { label: string; cssClass: string }[] = [
  { label: 'Page View', cssClass: 'page-view' },
  { label: 'Login', cssClass: 'login' },
  { label: '2FA Verified', cssClass: 'tfa-verified' },
  { label: 'Session Refresh', cssClass: 'session-refresh' },
  { label: 'Form Submit', cssClass: 'form-submit' },
  { label: 'Search', cssClass: 'search' },
  { label: 'Logout', cssClass: 'logout' },
  { label: 'Create', cssClass: 'create' },
  { label: 'Update', cssClass: 'update' },
  { label: 'Delete', cssClass: 'delete' },
];

const PAGES = [
  '/courses',
  '/grades',
  '/settings',
  '/reports',
  '/admin/audit',
  '/dashboard',
  '/departments',
  '/students',
  '/library/catalog',
  '/finance/ledger',
  '/hr/payroll',
  '/registrar/enrollment',
];

const DEVICES = [
  'Firefox 123 / Windows',
  'Safari 17 / macOS',
  'Chrome 122 / Android',
  'Edge 122 / Windows',
  'Chrome 122 / macOS',
  'Safari 17 / iOS',
  'Firefox 123 / Linux',
  'Chrome 122 / Windows',
];

const SYSTEMS = ['SIS', 'CRM', 'IAM', 'FIS', 'RIS', 'Integration Hub'];

const SEVERITIES: Severity[] = ['Info', 'Info', 'Info', 'Info', 'Info', 'Warning', 'Warning', 'Error', 'Critical'];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateAuditRecords(count: number): AuditRecord[] {
  const rand = seededRandom(42);
  const records: AuditRecord[] = [];
  const baseDate = new Date(2026, 1, 25, 23, 59, 59);

  for (let i = 0; i < count; i++) {
    const action = ACTIONS[Math.floor(rand() * ACTIONS.length)];
    const offsetMinutes = Math.floor(rand() * 60 * 24 * 3);
    const ts = new Date(baseDate.getTime() - offsetMinutes * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${pad(ts.getMonth() + 1)}/${pad(ts.getDate())}/${ts.getFullYear()}, ${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;

    records.push({
      id: `USR-${String(i + 1).padStart(5, '0')}`,
      timestamp,
      user: USERS[Math.floor(rand() * USERS.length)],
      action: action.label,
      actionClass: action.cssClass,
      page: PAGES[Math.floor(rand() * PAGES.length)],
      device: DEVICES[Math.floor(rand() * DEVICES.length)],
      severity: SEVERITIES[Math.floor(rand() * SEVERITIES.length)],
      system: SYSTEMS[Math.floor(rand() * SYSTEMS.length)],
    });
  }
  return records;
}

function generateHeatmapData(): number[][] {
  const rand = seededRandom(99);
  return Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => Math.floor(rand() * 14))
  );
}

/* ─────────────────────────────────────────────
   Sparkline SVG
   ───────────────────────────────────────────── */
function Sparkline({ data, color, width = 90, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="kpi-sparkline">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────── */
const TABS = [
  { label: 'User Activity', count: 90 },
  { label: 'Agent Activity', count: 88 },
  { label: 'API Requests', count: 100 },
  { label: 'CRUD Operations', count: 80 },
  { label: 'Field Changes', count: 70 },
  { label: 'App Versions', count: 8 },
];

const SEVERITY_FILTERS: Severity[] = ['Info', 'Warning', 'Error', 'Critical'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ALL_RECORDS = generateAuditRecords(90);
const HEATMAP = generateHeatmapData();
const PAGE_SIZE = 25;

/* ─────────────────────────────────────────────
   Heatmap color
   ───────────────────────────────────────────── */
function heatmapColor(value: number): string {
  if (value === 0) return '#1a1a2e';
  if (value <= 2) return '#065f46';
  if (value <= 4) return '#059669';
  if (value <= 7) return '#10b981';
  if (value <= 10) return '#34d399';
  return '#dc2626';
}

/* ─────────────────────────────────────────────
   Severity badge class
   ───────────────────────────────────────────── */
function severityBadgeClass(s: Severity): string {
  switch (s) {
    case 'Info':
      return 'badge badge-info';
    case 'Warning':
      return 'badge badge-draft';
    case 'Error':
      return 'badge badge-danger';
    case 'Critical':
      return 'badge badge-danger';
    default:
      return 'badge';
  }
}

/* ═════════════════════════════════════════════
   Component
   ═════════════════════════════════════════════ */
export function AuditClient() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Set<Severity>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [systemFilter, setSystemFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  /* ── Filtered records ── */
  const filteredRecords = useMemo(() => {
    let result = ALL_RECORDS;

    if (activeFilters.size > 0) {
      result = result.filter((r) => activeFilters.has(r.severity));
    }

    if (systemFilter !== 'All') {
      result = result.filter((r) => r.system === systemFilter);
    }

    if (searchQuery.trim()) {
      try {
        const regex = new RegExp(searchQuery.trim(), 'i');
        result = result.filter(
          (r) =>
            regex.test(r.id) ||
            regex.test(r.user) ||
            regex.test(r.action) ||
            regex.test(r.page) ||
            regex.test(r.device) ||
            regex.test(r.system) ||
            regex.test(r.severity)
        );
      } catch {
        const q = searchQuery.trim().toLowerCase();
        result = result.filter(
          (r) =>
            r.id.toLowerCase().includes(q) ||
            r.user.toLowerCase().includes(q) ||
            r.action.toLowerCase().includes(q) ||
            r.page.toLowerCase().includes(q) ||
            r.device.toLowerCase().includes(q) ||
            r.system.toLowerCase().includes(q) ||
            r.severity.toLowerCase().includes(q)
        );
      }
    }

    return result;
  }, [activeFilters, searchQuery, systemFilter]);

  const pagedRecords = filteredRecords.slice(0, PAGE_SIZE);
  const totalFiltered = filteredRecords.length;

  /* ── Toggle helpers ── */
  function toggleFilter(sev: Severity) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedRows.size === pagedRecords.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pagedRecords.map((r) => r.id)));
    }
  }

  /* ── Export stubs ── */
  function exportCSV() {
    const header = 'ID,Timestamp,User,Action,Page,Device,Severity,System';
    const rows = filteredRecords.map(
      (r) => `${r.id},${r.timestamp},${r.user},${r.action},${r.page},${r.device},${r.severity},${r.system}`
    );
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(filteredRecords, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audit-log.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Sparkline data ── */
  const sparkEvents = [28, 32, 26, 38, 45, 40, 35, 42, 48, 44, 39, 42];
  const sparkUsers = [8, 9, 10, 11, 10, 12, 12, 11, 13, 12, 12, 12];
  const sparkApi = [22, 28, 31, 30, 34, 36, 33, 38, 35, 37, 34, 35.7];
  const sparkErrors = [3, 2, 5, 4, 3, 6, 2, 4, 5, 3, 4, 3];

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Console</h1>
          <p className="page-subtitle">Real-time activity monitoring and security event log</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="export-btn" onClick={exportCSV}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
            </svg>
            CSV
          </button>
          <button className="export-btn" onClick={exportJSON}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
            </svg>
            JSON
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Events</div>
          <div className="kpi-value">420</div>
          <div className="kpi-trend up">+12.3% vs last week</div>
          <Sparkline data={sparkEvents} color="#10b981" />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Users</div>
          <div className="kpi-value">12</div>
          <div className="kpi-trend up">+2 new this week</div>
          <Sparkline data={sparkUsers} color="#6366f1" />
        </div>
        <div className="kpi-card">
          <div className="kpi-label">API Req / Hour</div>
          <div className="kpi-value">35.7</div>
          <div className="kpi-trend neutral">Stable</div>
          <Sparkline data={sparkApi} color="#f59e0b" />
        </div>
        <div className="kpi-card">
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Errors &amp; Critical
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#ef4444',
                display: 'inline-block',
                boxShadow: '0 0 6px #ef4444',
              }}
            />
          </div>
          <div className="kpi-value" style={{ color: '#f87171' }}>
            23
          </div>
          <div className="kpi-trend down">+4 since yesterday</div>
          <Sparkline data={sparkErrors} color="#ef4444" />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs-bar">
        {TABS.map((tab, idx) => (
          <button
            key={tab.label}
            className={`tab-btn${activeTab === idx ? ' active' : ''}`}
            onClick={() => setActiveTab(idx)}
          >
            {tab.label}
            <span className="tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ── Activity Heatmap ── */}
      <div className="card" style={{ marginBottom: 20, padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            Activity Heatmap &mdash; 7 Day
          </h3>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Hourly event density</span>
        </div>

        {/* Hour labels header row */}
        <div className="heatmap">
          <div className="heatmap-row">
            <span className="heatmap-label" />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="heatmap-hour">
                {String(h).padStart(2, '0')}
              </span>
            ))}
          </div>

          {DAYS.map((day, di) => (
            <div key={day} className="heatmap-row">
              <span className="heatmap-label">{day}</span>
              {HEATMAP[di].map((val, hi) => (
                <div
                  key={hi}
                  className="heatmap-cell"
                  style={{ background: heatmapColor(val) }}
                  title={`${day} ${String(hi).padStart(2, '0')}:00 — ${val} events`}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 10,
            justifyContent: 'flex-end',
          }}
        >
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Less</span>
          {['#1a1a2e', '#065f46', '#059669', '#10b981', '#34d399', '#dc2626'].map((c) => (
            <div
              key={c}
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                background: c,
              }}
            />
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>More</span>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="filter-bar">
        <div className="search-bar" style={{ flex: '0 0 300px' }}>
          <span className="search-icon">&#128269;</span>
          <input
            className="input"
            placeholder="Search logs... (regex supported)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {SEVERITY_FILTERS.map((sev) => (
          <button
            key={sev}
            className={`filter-pill${activeFilters.has(sev) ? ' active' : ''}`}
            onClick={() => toggleFilter(sev)}
          >
            {sev}
          </button>
        ))}

        <select
          className="input"
          style={{ width: 180, flex: 'none' }}
          value={systemFilter}
          onChange={(e) => setSystemFilter(e.target.value)}
        >
          <option value="All">SYSTEM: All Systems</option>
          {SYSTEMS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="input"
          style={{ width: 150, flex: 'none' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">STATUS: All</option>
          <option value="Active">Active</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* ── Results Count ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          padding: '0 4px',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          Showing 1-{Math.min(PAGE_SIZE, totalFiltered)} of {totalFiltered} results
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={selectAll}
          style={{ fontSize: 12 }}
        >
          {selectedRows.size === pagedRecords.length && pagedRecords.length > 0
            ? 'Deselect All'
            : 'Select All'}
        </button>
      </div>

      {/* ── Log Table ── */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  checked={selectedRows.size === pagedRecords.length && pagedRecords.length > 0}
                  onChange={selectAll}
                  style={{ accentColor: '#6366f1' }}
                />
              </th>
              <th>ID</th>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Page / Resource</th>
              <th>Device</th>
              <th>Severity</th>
              <th>System</th>
            </tr>
          </thead>
          <tbody>
            {pagedRecords.map((rec) => (
              <tr key={rec.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedRows.has(rec.id)}
                    onChange={() => toggleRow(rec.id)}
                    style={{ accentColor: '#6366f1' }}
                  />
                </td>
                <td>
                  <span className="mono-text">{rec.id}</span>
                </td>
                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-dim)' }}>
                  {rec.timestamp}
                </td>
                <td style={{ fontWeight: 500, color: 'var(--text)' }}>{rec.user}</td>
                <td>
                  <span className={`audit-action ${rec.actionClass}`}>{rec.action}</span>
                </td>
                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{rec.page}</td>
                <td style={{ fontSize: 12 }}>{rec.device}</td>
                <td>
                  <span className={severityBadgeClass(rec.severity)}>
                    {rec.severity === 'Critical' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#ef4444',
                            display: 'inline-block',
                            animation: 'pulse 1.5s infinite',
                          }}
                        />
                        {rec.severity}
                      </span>
                    ) : (
                      rec.severity
                    )}
                  </span>
                </td>
                <td>
                  <span className="badge badge-purple" style={{ fontSize: 10 }}>
                    {rec.system}
                  </span>
                </td>
              </tr>
            ))}

            {pagedRecords.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-state">
                  No audit records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination hint ── */}
      <div className="pagination" style={{ marginTop: 16 }}>
        <span className="pagination-info">
          Page 1 of {Math.ceil(totalFiltered / PAGE_SIZE)} &middot; {totalFiltered} total records
        </span>
      </div>

      {/* ── Inline keyframes for pulse animation ── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
