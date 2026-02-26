'use client';

import { useState, useMemo } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine, Cell,
} from 'recharts';

/* ================================================================
   Constants
   ================================================================ */

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};

const PAGE_SIZE = 25;

type UtilFilter = 'All' | 'Normal' | 'High' | 'Critical';
type SortDir = 'asc' | 'desc';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

const tableColumns: Column[] = [
  { key: 'Plan Date', label: 'Plan Date', sortable: true, render: (v: any) => v ? new Date(v).toLocaleDateString() : '\u2014' },
  { key: 'Work Center', label: 'Work Center', sortable: true, render: (v: any, row: any) => row._wcName || (v ? String(v) : '\u2014') },
  { key: 'Planned Hours', label: 'Planned Hrs', sortable: true, render: (v: any) => v != null ? Number(v).toLocaleString() : '\u2014' },
  { key: 'Available Hours', label: 'Avail Hrs', sortable: true, render: (v: any) => v != null ? Number(v).toLocaleString() : '\u2014' },
  { key: 'Utilization Pct', label: 'Util %', sortable: true, render: (v: any) => {
    if (v == null) return '\u2014';
    const n = Number(v);
    const color = n >= 95 ? '#dc2626' : n >= 90 ? '#ef4444' : n >= 75 ? '#f59e0b' : '#10b981';
    return <span style={{ color, fontWeight: 600 }}>{n}%</span>;
  }},
  { key: 'Overtime Hours', label: 'OT Hrs', sortable: true, render: (v: any) => {
    if (v == null || Number(v) === 0) return '\u2014';
    return <span style={{ color: '#f97316', fontWeight: 600 }}>{Number(v).toLocaleString()}</span>;
  }},
  { key: '_gap', label: 'Gap', sortable: false, render: (_: any, row: any) => {
    const gap = Number(row['Available Hours'] ?? 0) - Number(row['Planned Hours'] ?? 0);
    const color = gap < 0 ? '#ef4444' : gap === 0 ? '#f59e0b' : '#10b981';
    return <span style={{ color, fontWeight: 600 }}>{gap >= 0 ? '+' : ''}{gap.toFixed(1)}</span>;
  }},
];

const formFields = [
  { name: 'Plan Date', label: 'Plan Date', type: 'date' as const, required: true },
  { name: 'Planned Hours', label: 'Planned Hours', type: 'number' as const },
  { name: 'Available Hours', label: 'Available Hours', type: 'number' as const },
  { name: 'Utilization Pct', label: 'Utilization Pct', type: 'number' as const },
  { name: 'Overtime Hours', label: 'Overtime Hours', type: 'number' as const },
];

/* ================================================================
   Helpers
   ================================================================ */

function getNum(row: any, key: string): number {
  return Number(row[key] ?? 0);
}

function getVal(row: any, key: string): string {
  const v = row[key];
  return Array.isArray(v) ? v[0] ?? '' : String(v ?? '');
}

function utilColor(n: number): string {
  if (n >= 95) return '#dc2626';
  if (n >= 90) return '#ef4444';
  if (n >= 75) return '#f59e0b';
  return '#10b981';
}

function utilBg(n: number): string {
  if (n >= 95) return 'rgba(220,38,38,0.25)';
  if (n >= 90) return 'rgba(239,68,68,0.2)';
  if (n >= 75) return 'rgba(245,158,11,0.15)';
  return 'rgba(16,185,129,0.12)';
}

/* ================================================================
   Component
   ================================================================ */

interface Props {
  capacityPlans: Record<string, any>[];
  workCenters: Record<string, any>[];
}

export function CapacityClient({ capacityPlans: initialData, workCenters }: Props) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [utilFilter, setUtilFilter] = useState<UtilFilter>('All');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // Build work center lookup
  const wcLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const wc of workCenters) {
      map[wc.id] = getVal(wc, 'Code') || getVal(wc, 'Description') || wc.id;
    }
    return map;
  }, [workCenters]);

  // Enrich data with work center names
  const enrichedData: (Record<string, any>)[] = useMemo(() => {
    return data.map(r => {
      const wcRef = r['Work Center'];
      const wcId = Array.isArray(wcRef) ? wcRef[0] : wcRef;
      return { ...r, _wcName: wcId && wcLookup[wcId] ? wcLookup[wcId] : '' };
    });
  }, [data, wcLookup]);

  /* ----------------------------------------------------------------
     1. KPI Stats
     ---------------------------------------------------------------- */
  const stats = useMemo(() => {
    let totalUtil = 0;
    let utilCount = 0;
    let totalOT = 0;
    let above90 = 0;
    let totalPlanned = 0;
    let totalAvailable = 0;

    for (const r of data) {
      const u = getNum(r, 'Utilization Pct');
      if (u > 0) { totalUtil += u; utilCount++; }
      if (u >= 90) above90++;
      totalOT += getNum(r, 'Overtime Hours');
      totalPlanned += getNum(r, 'Planned Hours');
      totalAvailable += getNum(r, 'Available Hours');
    }

    return {
      total: data.length,
      avgUtil: utilCount > 0 ? (totalUtil / utilCount).toFixed(1) : '0',
      totalOT,
      above90,
      capacityGap: totalAvailable - totalPlanned,
    };
  }, [data]);

  /* ----------------------------------------------------------------
     2. Utilization Heatmap Calendar
     ---------------------------------------------------------------- */
  const calendarData = useMemo(() => {
    // Group plans by date, compute avg utilization per day
    const dayMap: Record<string, { date: Date; utilSum: number; count: number }> = {};
    for (const r of data) {
      const d = r['Plan Date'];
      if (!d) continue;
      const dateObj = new Date(d);
      const key = dateObj.toISOString().slice(0, 10);
      if (!dayMap[key]) dayMap[key] = { date: dateObj, utilSum: 0, count: 0 };
      const u = getNum(r, 'Utilization Pct');
      if (u > 0) {
        dayMap[key].utilSum += u;
        dayMap[key].count++;
      }
    }

    const days = Object.entries(dayMap)
      .map(([key, { date, utilSum, count }]) => ({
        key,
        date,
        avgUtil: count > 0 ? Math.round(utilSum / count) : 0,
        dayOfWeek: date.getDay(),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (days.length === 0) return [];

    // Group into weeks
    const weeks: { weekLabel: string; days: typeof days }[] = [];
    let currentWeek: typeof days = [];
    let currentWeekStart = '';

    for (const day of days) {
      const weekStart = new Date(day.date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const wKey = weekStart.toISOString().slice(0, 10);

      if (wKey !== currentWeekStart) {
        if (currentWeek.length > 0) {
          weeks.push({ weekLabel: currentWeekStart, days: currentWeek });
        }
        currentWeek = [];
        currentWeekStart = wKey;
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) {
      weeks.push({ weekLabel: currentWeekStart, days: currentWeek });
    }

    return weeks;
  }, [data]);

  /* ----------------------------------------------------------------
     3. Overtime Trend
     ---------------------------------------------------------------- */
  const overtimeTrend = useMemo(() => {
    const sorted = [...data]
      .filter(r => r['Plan Date'])
      .sort((a, b) => new Date(a['Plan Date']).getTime() - new Date(b['Plan Date']).getTime());

    // Aggregate by date
    const dateMap: Record<string, number> = {};
    for (const r of sorted) {
      const key = new Date(r['Plan Date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateMap[key] = (dateMap[key] || 0) + getNum(r, 'Overtime Hours');
    }

    const entries = Object.entries(dateMap).map(([date, hours]) => ({ date, overtime: hours }));
    const totalOT = entries.reduce((s, e) => s + e.overtime, 0);
    const avgOT = entries.length > 0 ? totalOT / entries.length : 0;

    return { entries: entries.slice(-30), avgOT };
  }, [data]);

  /* ----------------------------------------------------------------
     4. Capacity Load Balance
     ---------------------------------------------------------------- */
  const loadBalance = useMemo(() => {
    const sorted = [...data]
      .filter(r => r['Plan Date'])
      .sort((a, b) => new Date(a['Plan Date']).getTime() - new Date(b['Plan Date']).getTime());

    // Aggregate by date
    const dateMap: Record<string, { planned: number; available: number }> = {};
    for (const r of sorted) {
      const key = new Date(r['Plan Date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!dateMap[key]) dateMap[key] = { planned: 0, available: 0 };
      dateMap[key].planned += getNum(r, 'Planned Hours');
      dateMap[key].available += getNum(r, 'Available Hours');
    }

    return Object.entries(dateMap)
      .map(([date, v]) => ({
        date,
        planned: Number(v.planned.toFixed(1)),
        available: Number(v.available.toFixed(1)),
        overloaded: v.planned > v.available,
      }))
      .slice(-20);
  }, [data]);

  /* ----------------------------------------------------------------
     5. Bottleneck Detector
     ---------------------------------------------------------------- */
  const bottlenecks = useMemo(() => {
    return enrichedData
      .filter(r => getNum(r, 'Utilization Pct') >= 95)
      .map(r => ({
        id: r.id,
        date: r['Plan Date'] ? new Date(r['Plan Date']).toLocaleDateString() : 'N/A',
        util: getNum(r, 'Utilization Pct'),
        planned: getNum(r, 'Planned Hours'),
        available: getNum(r, 'Available Hours'),
        overtime: getNum(r, 'Overtime Hours'),
        wcName: r._wcName || 'Unassigned',
      }))
      .sort((a, b) => b.util - a.util)
      .slice(0, 8);
  }, [enrichedData]);

  /* ----------------------------------------------------------------
     6. Filtered + Sorted + Paginated Table
     ---------------------------------------------------------------- */
  const filtered = useMemo(() => {
    let result = enrichedData;

    // Utilization filter
    if (utilFilter !== 'All') {
      result = result.filter(r => {
        const u = getNum(r, 'Utilization Pct');
        if (utilFilter === 'Normal') return u < 75;
        if (utilFilter === 'High') return u >= 75 && u < 90;
        if (utilFilter === 'Critical') return u >= 90;
        return true;
      });
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aV = sortKey === '_gap' ? (getNum(a, 'Available Hours') - getNum(a, 'Planned Hours')) : a[sortKey];
        const bV = sortKey === '_gap' ? (getNum(b, 'Available Hours') - getNum(b, 'Planned Hours')) : b[sortKey];
        const aNum = Number(aV);
        const bNum = Number(bV);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
        }
        const aStr = String(aV ?? '').toLowerCase();
        const bStr = String(bV ?? '').toLowerCase();
        return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return result;
  }, [enrichedData, utilFilter, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  /* ----------------------------------------------------------------
     CRUD handlers
     ---------------------------------------------------------------- */
  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.CAPACITY_PLANS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.CAPACITY_PLANS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.CAPACITY_PLANS, selected.id);
    setData(prev => prev.filter(r => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  /* ----------------------------------------------------------------
     Render
     ---------------------------------------------------------------- */
  const UTIL_TABS: { label: string; value: UtilFilter; color: string }[] = [
    { label: 'All', value: 'All', color: 'var(--text-dim)' },
    { label: 'Normal (<75%)', value: 'Normal', color: '#10b981' },
    { label: 'High (75-90%)', value: 'High', color: '#f59e0b' },
    { label: 'Critical (90%+)', value: 'Critical', color: '#ef4444' },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Capacity Planning</h1>
          <p className="page-subtitle">Utilization monitoring, overtime tracking, and bottleneck detection</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Plan
        </button>
      </div>

      {/* ── 1. KPI Row (5 cards) ── */}
      <div className="stat-row">
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#6366f1' }}>{stats.total}</div>
          <div className="kpi-label">Total Plans</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: utilColor(parseFloat(stats.avgUtil)) }}>{stats.avgUtil}%</div>
          <div className="kpi-label">Avg Utilization</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: stats.totalOT > 0 ? '#f97316' : 'var(--text-muted)' }}>{stats.totalOT.toLocaleString()}</div>
          <div className="kpi-label">Total Overtime Hrs</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: stats.above90 > 0 ? '#ef4444' : '#10b981' }}>{stats.above90}</div>
          <div className="kpi-label">Plans Above 90%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: stats.capacityGap >= 0 ? '#10b981' : '#ef4444' }}>
            {stats.capacityGap >= 0 ? '+' : ''}{stats.capacityGap.toFixed(1)}
          </div>
          <div className="kpi-label">Capacity Gap (hrs)</div>
        </div>
      </div>

      {/* ── 2. Utilization Heatmap Calendar ── */}
      {calendarData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3>Utilization Heatmap</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 8px' }}>
            Daily average utilization &mdash;
            <span style={{ color: '#10b981' }}> green &lt;75%</span>
            <span style={{ color: '#f59e0b' }}> yellow 75-90%</span>
            <span style={{ color: '#ef4444' }}> red &gt;90%</span>
          </p>
          <div style={{ display: 'flex', gap: 2, fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, paddingLeft: 64 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ width: 36, textAlign: 'center' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowX: 'auto' }}>
            {calendarData.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <div style={{ width: 60, fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', paddingRight: 4, flexShrink: 0 }}>
                  {new Date(week.weekLabel).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const dayEntry = week.days.find(d => d.dayOfWeek === dayIdx);
                  if (!dayEntry) {
                    return <div key={dayIdx} style={{ width: 36, height: 36, borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', opacity: 0.3 }} />;
                  }
                  return (
                    <div
                      key={dayIdx}
                      title={`${dayEntry.key}: ${dayEntry.avgUtil}% avg utilization`}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 4,
                        background: utilBg(dayEntry.avgUtil),
                        border: `1px solid ${utilColor(dayEntry.avgUtil)}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 700,
                        color: utilColor(dayEntry.avgUtil),
                        cursor: 'default',
                      }}
                    >
                      {dayEntry.avgUtil}%
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Charts Row: Overtime Trend + Load Balance side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* ── 3. Overtime Trend ── */}
        <div className="chart-card">
          <h3>Overtime Trend</h3>
          {overtimeTrend.entries.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={overtimeTrend.entries} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="otGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip {...CHART_TOOLTIP} formatter={(value: any) => [`${value} hrs`, 'Overtime']} />
                <ReferenceLine y={overtimeTrend.avgOT} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Avg: ${overtimeTrend.avgOT.toFixed(1)}`, position: 'right', style: { fill: '#94a3b8', fontSize: 10 } }} />
                <Area type="monotone" dataKey="overtime" stroke="#f97316" strokeWidth={2} fill="url(#otGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No overtime data available
            </div>
          )}
        </div>

        {/* ── 4. Capacity Load Balance ── */}
        <div className="chart-card">
          <h3>Capacity Load Balance</h3>
          {loadBalance.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={loadBalance} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip {...CHART_TOOLTIP} formatter={(value: any, name?: string) => [`${value} hrs`, name === 'planned' ? 'Planned' : 'Available']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="available" name="Available" fill="#10b981" fillOpacity={0.3} stroke="#10b981" strokeWidth={1} radius={[2, 2, 0, 0]} />
                <Bar dataKey="planned" name="Planned" radius={[2, 2, 0, 0]}>
                  {loadBalance.map((entry, i) => (
                    <Cell key={i} fill={entry.overloaded ? '#ef4444' : '#6366f1'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No load balance data available
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Bottleneck Detector ── */}
      {bottlenecks.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
            Bottleneck Detector
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>{bottlenecks.length} critical plan{bottlenecks.length !== 1 ? 's' : ''}</span>
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 12px' }}>Plans with utilization at or above 95%</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {bottlenecks.map(b => (
              <div key={b.id} style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10,
                padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{b.wcName}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>{b.util}%</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Date</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{b.date}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Overtime</div>
                    <div style={{ fontWeight: 600, color: b.overtime > 0 ? '#f97316' : 'var(--text)' }}>{b.overtime > 0 ? `${b.overtime} hrs` : 'None'}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Planned</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{b.planned} hrs</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Available</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{b.available} hrs</div>
                  </div>
                </div>
                {/* Mini utilization bar */}
                <div style={{ marginTop: 8, background: 'var(--bg)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(b.util, 100)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #ef4444, #dc2626)',
                    borderRadius: 4,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 6. Enhanced Table ── */}
      <div className="table-container">
        <div className="toolbar">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All Capacity Plans <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="search-bar">
              <span className="search-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              </span>
              <input className="input" placeholder="Search plans..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 240 }} />
            </div>
          </div>
        </div>

        {/* Utilization filter tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '0 16px 12px', flexWrap: 'wrap' }}>
          {UTIL_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => { setUtilFilter(tab.value); setPage(1); }}
              style={{
                padding: '5px 14px',
                fontSize: 11,
                fontWeight: utilFilter === tab.value ? 700 : 500,
                borderRadius: 6,
                border: '1px solid',
                borderColor: utilFilter === tab.value ? tab.color : 'var(--border)',
                background: utilFilter === tab.value ? `${tab.color}18` : 'transparent',
                color: utilFilter === tab.value ? tab.color : 'var(--text-dim)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No capacity plans found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {tableColumns.map(c => (
                  <th
                    key={c.key}
                    onClick={() => c.sortable && handleSort(c.key)}
                    style={{ cursor: c.sortable ? 'pointer' : 'default', userSelect: 'none' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.label}
                      {c.sortable && sortKey === c.key && (
                        <span style={{ fontSize: 10, opacity: 0.7 }}>{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map(row => (
                <tr key={row.id} onClick={() => { setSelected(row); setModalMode('view'); }} style={{ cursor: 'pointer' }}>
                  {tableColumns.map(c => (
                    <td key={c.key}>{c.render ? c.render(row[c.key], row) : String(row[c.key] ?? '\u2014')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="pagination-info">Page {page} of {totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}

      {/* ── 7. CRUD Modals ── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Capacity Plan">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Capacity Plan">
        {selected && <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />}
      </Modal>

      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="Capacity Plan Details">
        {selected && (
          <div>
            <div className="detail-grid" style={{ marginBottom: 24 }}>
              {Object.entries(selected).filter(([k]) => !['id', 'createdAt', 'updatedAt', 'createdBy', '_wcName'].includes(k)).map(([key, val]) => (
                <div key={key}>
                  <div className="detail-field-label">{key}</div>
                  <div className="detail-field-value">{val == null || val === '' ? '\u2014' : String(val)}</div>
                </div>
              ))}
            </div>
            <div className="form-actions" style={{ marginTop: 0, paddingTop: 16 }}>
              <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
              <button className="btn btn-primary btn-sm" onClick={() => setModalMode('edit')}>Edit</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
