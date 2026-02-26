'use client';

import { useState, useMemo, useCallback } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

/* ================================================================
   Constants
   ================================================================ */

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};
const AXIS_TICK = { fill: '#64748b', fontSize: 11 };
const GRID_STROKE = 'rgba(255,255,255,0.04)';
const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Passed', 'Failed', 'Conditional'] as const;
const TYPE_OPTIONS = ['Incoming', 'In-Process', 'Final', 'Random'] as const;

const STATUS_COLORS: Record<string, string> = {
  Passed: '#10b981',
  Approved: '#10b981',
  Failed: '#ef4444',
  Pending: '#f59e0b',
  'In Progress': '#3b82f6',
  Conditional: '#a855f7',
};

const TYPE_COLORS: Record<string, string> = {
  Incoming: '#6366f1',
  'In-Process': '#f97316',
  Final: '#10b981',
  Random: '#06b6d4',
};

const SCORE_BAR_CLASSES: Record<string, string> = {
  high: 'green',
  mid: 'yellow',
  low: 'red',
};

const formFields = [
  { name: 'Inspection Date', label: 'Inspection Date', type: 'date', required: true },
  { name: 'Type', label: 'Type', type: 'select', options: ['Incoming', 'In-Process', 'Final', 'Random'] },
  { name: 'Status', label: 'Status', type: 'select', options: ['Pending', 'In Progress', 'Passed', 'Failed', 'Conditional'] },
  { name: 'Inspector', label: 'Inspector', type: 'text' },
  { name: 'Overall Score', label: 'Overall Score (0-100)', type: 'number' },
  { name: 'Notes', label: 'Notes', type: 'textarea' },
];

/* ================================================================
   Helpers
   ================================================================ */

function getField(rec: any, key: string): string {
  const val = rec[key];
  if (val == null) return '';
  if (Array.isArray(val)) return val[0] ?? '';
  return String(val);
}

function getNumField(rec: any, key: string): number {
  const val = rec[key];
  if (val == null) return 0;
  return Number(val) || 0;
}

function scoreBarClass(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

function formatDate(val: any): string {
  if (!val) return '\u2014';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ================================================================
   Tooltips
   ================================================================ */

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...CHART_TOOLTIP.contentStyle, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      {label && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ fontSize: 13, fontWeight: 600, color: entry.color || '#f1f5f9' }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div style={{ ...CHART_TOOLTIP.contentStyle, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: entry.payload?.fill || '#f1f5f9' }}>
        {entry.name}: {entry.value}
      </div>
    </div>
  );
}

/* ================================================================
   Main Component
   ================================================================ */

interface Props {
  inspections: any[];
  items: any[];
}

export function QualityClient({ inspections: initialInspections, items }: Props) {
  const [inspections, setInspections] = useState(initialInspections);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  /* ── Item lookup map ───────────────────────── */
  const itemMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      if (item.id) {
        const name = item['Item Name'] || item['Name'] || item['Item Code'] || `Item ${item.id.slice(-4)}`;
        map[item.id] = name;
      }
    }
    return map;
  }, [items]);

  function resolveItem(rec: any): string {
    const ref = rec['Item'];
    const id = Array.isArray(ref) ? ref[0] : ref;
    if (id && itemMap[id]) return itemMap[id];
    return '';
  }

  /* ── KPI computations ──────────────────────── */

  const totalInspections = inspections.length;

  const passRate = useMemo(() => {
    if (inspections.length === 0) return 0;
    const passed = inspections.filter((i) => {
      const s = getField(i, 'Status');
      return s === 'Passed' || s === 'Approved';
    }).length;
    return (passed / inspections.length) * 100;
  }, [inspections]);

  const avgScore = useMemo(() => {
    const scores = inspections.map((i) => getNumField(i, 'Overall Score')).filter((s) => s > 0);
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [inspections]);

  const criticalIssues = useMemo(
    () => inspections.filter((i) => getField(i, 'Status') === 'Failed').length,
    [inspections],
  );

  /* ── Chart data ────────────────────────────── */

  // Pass rate donut: two slices
  const passRateDonut = useMemo(() => {
    return [
      { name: 'Passed', value: passRate },
      { name: 'Other', value: 100 - passRate },
    ];
  }, [passRate]);

  // Score distribution buckets
  const scoreDist = useMemo(() => {
    const buckets = [
      { range: '0-20', min: 0, max: 20, count: 0 },
      { range: '20-40', min: 20, max: 40, count: 0 },
      { range: '40-60', min: 40, max: 60, count: 0 },
      { range: '60-80', min: 60, max: 80, count: 0 },
      { range: '80-100', min: 80, max: 100, count: 0 },
    ];
    inspections.forEach((insp) => {
      const score = getNumField(insp, 'Overall Score');
      if (score <= 0) return;
      for (const b of buckets) {
        if (score > b.min && score <= b.max) { b.count++; break; }
        if (b.min === 0 && score === 0) { b.count++; break; }
      }
    });
    return buckets.map((b) => ({ name: b.range, count: b.count }));
  }, [inspections]);

  // Type distribution
  const typeDist = useMemo(() => {
    const counts: Record<string, number> = {};
    inspections.forEach((i) => {
      const t = getField(i, 'Type') || 'Unknown';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [inspections]);

  // Trend data: scores over time
  const trendData = useMemo(() => {
    return [...inspections]
      .filter((i) => getField(i, 'Inspection Date') && getNumField(i, 'Overall Score') > 0)
      .sort((a, b) => {
        const da = new Date(getField(a, 'Inspection Date')).getTime();
        const db = new Date(getField(b, 'Inspection Date')).getTime();
        return da - db;
      })
      .map((i) => ({
        date: formatDate(getField(i, 'Inspection Date')),
        score: getNumField(i, 'Overall Score'),
        status: getField(i, 'Status'),
      }));
  }, [inspections]);

  /* ── Filtered & sorted list ────────────────── */

  const filtered = useMemo(() => {
    return [...inspections]
      .filter((i) => {
        if (statusFilter !== 'All' && getField(i, 'Status') !== statusFilter) return false;
        if (typeFilter !== 'All' && getField(i, 'Type') !== typeFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          const inspector = (getField(i, 'Inspector') || '').toLowerCase();
          const item = resolveItem(i).toLowerCase();
          const type = (getField(i, 'Type') || '').toLowerCase();
          const notes = (getField(i, 'Notes') || '').toLowerCase();
          if (!inspector.includes(q) && !item.includes(q) && !type.includes(q) && !notes.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = new Date(getField(a, 'Inspection Date')).getTime() || 0;
        const db = new Date(getField(b, 'Inspection Date')).getTime() || 0;
        return db - da; // most recent first
      });
  }, [inspections, statusFilter, typeFilter, search]);

  /* ── CRUD ──────────────────────────────────── */

  const handleCreate = useCallback(async (values: Record<string, any>) => {
    const rec = await createRecord(TABLES.QUALITY_INSPECTIONS, values);
    setInspections((prev) => [rec, ...prev]);
    setModalMode(null);
  }, []);

  const handleUpdate = useCallback(async (values: Record<string, any>) => {
    if (!selectedInspection) return;
    const updated = await updateRecord(TABLES.QUALITY_INSPECTIONS, selectedInspection.id, values);
    setInspections((prev) => prev.map((i) => (i.id === selectedInspection.id ? { ...i, ...updated } : i)));
    setModalMode(null);
    setSelectedInspection(null);
  }, [selectedInspection]);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      await deleteRecord(TABLES.QUALITY_INSPECTIONS, id);
      setInspections((prev) => prev.filter((i) => i.id !== id));
      if (modalMode === 'detail') {
        setModalMode(null);
        setSelectedInspection(null);
      }
    } finally {
      setDeleting(null);
    }
  }, [modalMode]);

  const openDetail = (i: any) => {
    setSelectedInspection(i);
    setModalMode('detail');
  };

  const openEdit = (i: any) => {
    setSelectedInspection(i);
    setModalMode('edit');
  };

  /* ── Status counts for filter pills ────────── */
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: inspections.length };
    STATUS_OPTIONS.forEach((st) => {
      counts[st] = inspections.filter((i) => getField(i, 'Status') === st).length;
    });
    return counts;
  }, [inspections]);

  /* ── Render ────────────────────────────────── */

  return (
    <div>
      {/* ── Header ───────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quality Dashboard</h1>
          <p className="page-subtitle">
            Inspection analytics &amp; quality control &mdash; {totalInspections} inspections tracked
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelectedInspection(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Inspection
        </button>
      </div>

      {/* ── KPI Row ──────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Inspections</div>
          <div className="kpi-value">{totalInspections}</div>
          <div className="kpi-trend neutral">All time records</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pass Rate</div>
          <div className="kpi-value" style={{ color: passRate >= 80 ? '#10b981' : passRate >= 60 ? '#f59e0b' : '#ef4444' }}>
            {passRate.toFixed(1)}%
          </div>
          <div className="progress-bar lg" style={{ marginTop: 8 }}>
            <div
              className={`progress-bar-fill ${scoreBarClass(passRate)}`}
              style={{ width: `${passRate}%` }}
            />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Average Score</div>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{avgScore.toFixed(1)}</div>
          <div className="progress-bar lg" style={{ marginTop: 8 }}>
            <div
              className={`progress-bar-fill ${scoreBarClass(avgScore)}`}
              style={{ width: `${avgScore}%` }}
            />
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Critical Issues</div>
          <div className="kpi-value" style={{ color: criticalIssues > 0 ? '#ef4444' : '#10b981' }}>
            {criticalIssues}
          </div>
          <div className={`kpi-trend ${criticalIssues > 0 ? 'down' : 'up'}`}>
            {criticalIssues > 0 ? 'Failed inspections need attention' : 'No failures recorded'}
          </div>
        </div>
      </div>

      {/* ── Charts Row (3 columns) ───────── */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {/* Pass Rate Gauge (donut) */}
        <div className="chart-card" style={{ position: 'relative' }}>
          <h3>Overall Pass Rate</h3>
          {totalInspections === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No inspections</div>
          ) : (
            <div style={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={passRateDonut}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={90}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="rgba(255,255,255,0.06)" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Center text */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {passRate.toFixed(0)}%
                </div>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                  Pass Rate
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Score Distribution */}
        <div className="chart-card">
          <h3>Score Distribution</h3>
          {totalInspections === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreDist} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar dataKey="count" name="Inspections" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {scoreDist.map((entry, idx) => {
                    const fillColors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#6366f1'];
                    return <Cell key={idx} fill={fillColors[idx]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Type Distribution Pie */}
        <div className="chart-card">
          <h3>Inspections by Type</h3>
          {typeDist.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={typeDist}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {typeDist.map((entry, idx) => (
                      <Cell key={entry.name} fill={TYPE_COLORS[entry.name] || COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 4 }}>
                {typeDist.map((entry, idx) => (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[entry.name] || COLORS[idx % COLORS.length] }} />
                    <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Trend Section (full width) ───── */}
      {trendData.length > 1 && (
        <div className="chart-card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h3 style={{ margin: 0 }}>Inspection Scores Over Time</h3>
            <span style={{ fontSize: 11, color: '#64748b' }}>{trendData.length} inspections</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={AXIS_TICK} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<DarkTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                name="Score"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#scoreGradient)"
                dot={{ r: 3, fill: '#6366f1', stroke: '#1a2332', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#818cf8', stroke: '#1a2332', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Filters ──────────────────────── */}
      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 320 }}>
          <span className="search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </span>
          <input
            className="input"
            placeholder="Search inspections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status pills */}
        {(['All', ...STATUS_OPTIONS] as const).map((st) => (
          <button
            key={st}
            className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
            onClick={() => setStatusFilter(st)}
          >
            {st}
            {statusCounts[st] != null && <span style={{ marginLeft: 4, opacity: 0.6 }}>({statusCounts[st]})</span>}
          </button>
        ))}

        {/* Type filter dropdown */}
        <select
          className="input"
          style={{ width: 'auto', minWidth: 130 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="All">All Types</option>
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* ── Inspection Cards List ────────── */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128270;</div>
          <p>No inspections found</p>
        </div>
      ) : (
        <div className="alert-list">
          {filtered.map((insp) => {
            const date = getField(insp, 'Inspection Date');
            const type = getField(insp, 'Type');
            const status = getField(insp, 'Status');
            const score = getNumField(insp, 'Overall Score');
            const inspector = getField(insp, 'Inspector');
            const itemName = resolveItem(insp);
            const prodOrder = getField(insp, 'Production Order');
            const scoreCls = scoreBarClass(score);

            // Determine border class for alert-item
            let borderClass = 'info';
            if (status === 'Passed' || status === 'Approved') borderClass = 'success';
            else if (status === 'Failed') borderClass = 'critical';
            else if (status === 'Conditional') borderClass = 'warning';

            return (
              <div
                key={insp.id}
                className={`alert-item ${borderClass}`}
                style={{ cursor: 'pointer', padding: '14px 18px' }}
                onClick={() => openDetail(insp)}
              >
                {/* Left: Date */}
                <div style={{ minWidth: 90, flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{formatDate(date)}</div>
                  {inspector && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{inspector}</div>}
                </div>

                {/* Item name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {itemName || 'General Inspection'}
                  </div>
                  {prodOrder && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>
                      PO: <span className="mono-text">{Array.isArray(prodOrder) ? prodOrder[0]?.slice(-6) : String(prodOrder).slice(-6)}</span>
                    </div>
                  )}
                </div>

                {/* Type badge */}
                <div style={{ flexShrink: 0 }}>
                  {type && (
                    <span className="tag" style={{ background: (TYPE_COLORS[type] || '#6366f1') + '1a', color: TYPE_COLORS[type] || '#6366f1' }}>
                      {type}
                    </span>
                  )}
                </div>

                {/* Score bar */}
                <div style={{ minWidth: 120, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div
                        className={`progress-bar-fill ${scoreCls}`}
                        style={{ width: `${Math.min(score, 100)}%` }}
                      />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', minWidth: 28, textAlign: 'right' }}>
                      {score}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div style={{ flexShrink: 0 }}>
                  <StatusBadge value={status} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(insp)} title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(insp.id)}
                    disabled={deleting === insp.id}
                    title="Delete"
                    style={{ color: 'var(--danger)' }}
                  >
                    {deleting === insp.id ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ─────────────────── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Inspection">
        <RecordForm
          fields={formFields}
          onSubmit={handleCreate}
          onCancel={() => setModalMode(null)}
          submitLabel="Create Inspection"
        />
      </Modal>

      {/* ── Edit Modal ───────────────────── */}
      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelectedInspection(null); }} title="Edit Inspection">
        {selectedInspection && (
          <RecordForm
            fields={formFields}
            initialValues={selectedInspection}
            onSubmit={handleUpdate}
            onCancel={() => { setModalMode(null); setSelectedInspection(null); }}
            submitLabel="Save Changes"
          />
        )}
      </Modal>

      {/* ── Detail Modal ─────────────────── */}
      <Modal
        open={modalMode === 'detail'}
        onClose={() => { setModalMode(null); setSelectedInspection(null); }}
        title="Inspection Details"
      >
        {selectedInspection && (() => {
          const score = getNumField(selectedInspection, 'Overall Score');
          const status = getField(selectedInspection, 'Status');
          const itemName = resolveItem(selectedInspection);

          return (
            <div>
              {/* Header with score gauge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                    {itemName || 'General Inspection'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {formatDate(getField(selectedInspection, 'Inspection Date'))}
                  </div>
                </div>
                <StatusBadge value={status} />
              </div>

              {/* Score display */}
              <div style={{
                background: 'var(--bg-sunken)',
                borderRadius: 'var(--radius-lg)',
                padding: '20px 24px',
                marginBottom: 20,
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 42,
                  fontWeight: 800,
                  color: score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}>
                  {score}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>
                  Overall Score
                </div>
                <div className="progress-bar lg" style={{ marginTop: 12, maxWidth: 300, margin: '12px auto 0' }}>
                  <div
                    className={`progress-bar-fill ${scoreBarClass(score)}`}
                    style={{ width: `${Math.min(score, 100)}%` }}
                  />
                </div>
              </div>

              {/* Detail grid */}
              <div className="detail-grid">
                {getField(selectedInspection, 'Type') && (
                  <div>
                    <div className="detail-field-label">Type</div>
                    <div className="detail-field-value">
                      <span className="tag" style={{
                        background: (TYPE_COLORS[getField(selectedInspection, 'Type')] || '#6366f1') + '1a',
                        color: TYPE_COLORS[getField(selectedInspection, 'Type')] || '#6366f1',
                      }}>
                        {getField(selectedInspection, 'Type')}
                      </span>
                    </div>
                  </div>
                )}
                {getField(selectedInspection, 'Inspector') && (
                  <div>
                    <div className="detail-field-label">Inspector</div>
                    <div className="detail-field-value">{getField(selectedInspection, 'Inspector')}</div>
                  </div>
                )}
                {itemName && (
                  <div>
                    <div className="detail-field-label">Item</div>
                    <div className="detail-field-value">{itemName}</div>
                  </div>
                )}
                {getField(selectedInspection, 'Production Order') && (
                  <div>
                    <div className="detail-field-label">Production Order</div>
                    <div className="detail-field-value mono-text">
                      {(() => {
                        const po = selectedInspection['Production Order'];
                        return Array.isArray(po) ? po[0]?.slice(-8) : String(po).slice(-8);
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              {getField(selectedInspection, 'Notes') && (
                <div style={{ marginTop: 16 }}>
                  <div className="detail-field-label">Notes</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
                    {getField(selectedInspection, 'Notes')}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="form-actions" style={{ marginTop: 20 }}>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(selectedInspection.id)}
                  disabled={deleting === selectedInspection.id}
                >
                  {deleting === selectedInspection.id ? 'Deleting...' : 'Delete'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => openEdit(selectedInspection)}>
                  Edit Inspection
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
