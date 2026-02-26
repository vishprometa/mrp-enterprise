'use client';

import { useState, useMemo } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ScatterChart, Scatter, ZAxis, Cell, Legend, ReferenceLine,
} from 'recharts';

/* ================================================================
   Constants
   ================================================================ */

const DEPARTMENTS = ['Machining', 'Assembly', 'Welding', 'Painting', 'Packaging', 'Testing'] as const;

const DEPT_COLORS: Record<string, string> = {
  Machining: '#6366f1',
  Assembly: '#10b981',
  Welding: '#f97316',
  Painting: '#06b6d4',
  Packaging: '#f59e0b',
  Testing: '#a855f7',
};

const SHIFT_COLORS: Record<string, string> = {
  Single: '#6366f1',
  Double: '#10b981',
  Triple: '#f97316',
  Continuous: '#06b6d4',
};

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};

const PAGE_SIZE = 25;

type SortKey = string;
type SortDir = 'asc' | 'desc';

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

const tableColumns: Column[] = [
  { key: 'Code', label: 'Code', sortable: true },
  { key: 'Description', label: 'Description', sortable: true },
  { key: 'Department', label: 'Department', sortable: true, render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Capacity Per Hour', label: 'Cap/Hr', sortable: true, render: (v: any) => v != null ? Number(v).toLocaleString() : '\u2014' },
  { key: 'Cost Per Hour', label: 'Cost/Hr', sortable: true, render: (v: any) => v != null ? `$${Number(v).toFixed(2)}` : '\u2014' },
  { key: 'Efficiency Pct', label: 'Efficiency %', sortable: true, render: (v: any) => {
    if (v == null) return '\u2014';
    const n = Number(v);
    const color = n >= 85 ? '#10b981' : n >= 70 ? '#f59e0b' : '#ef4444';
    return <span style={{ color, fontWeight: 600 }}>{n}%</span>;
  }},
  { key: 'Setup Time Mins', label: 'Setup (min)', sortable: true, render: (v: any) => v != null ? Number(v).toLocaleString() : '\u2014' },
  { key: 'Status', label: 'Status', sortable: true, render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Shift Pattern', label: 'Shift', sortable: true, render: (v: any) => <StatusBadge value={v} /> },
];

const formFields = [
  { name: 'Code', label: 'Code', type: 'text' as const, required: true },
  { name: 'Description', label: 'Description', type: 'textarea' as const },
  { name: 'Department', label: 'Department', type: 'select' as const, options: [...DEPARTMENTS] },
  { name: 'Capacity Per Hour', label: 'Capacity Per Hour', type: 'number' as const },
  { name: 'Cost Per Hour', label: 'Cost Per Hour', type: 'number' as const },
  { name: 'Efficiency Pct', label: 'Efficiency Pct', type: 'number' as const },
  { name: 'Setup Time Mins', label: 'Setup Time Mins', type: 'number' as const },
  { name: 'Status', label: 'Status', type: 'select' as const, options: ['Active', 'Inactive', 'Under Maintenance'] },
  { name: 'Shift Pattern', label: 'Shift Pattern', type: 'select' as const, options: ['Single', 'Double', 'Triple', 'Continuous'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ================================================================
   Helpers
   ================================================================ */

function getVal(row: any, key: string): string {
  const v = row[key];
  return Array.isArray(v) ? v[0] ?? '' : String(v ?? '');
}

function getNum(row: any, key: string): number {
  return Number(row[key] ?? 0);
}

function tierColor(value: number, thresholds: [number, number] = [70, 85]): string {
  if (value >= thresholds[1]) return '#10b981';
  if (value >= thresholds[0]) return '#f59e0b';
  return '#ef4444';
}

function tierBg(value: number, thresholds: [number, number] = [70, 85]): string {
  if (value >= thresholds[1]) return 'rgba(16,185,129,0.12)';
  if (value >= thresholds[0]) return 'rgba(245,158,11,0.12)';
  return 'rgba(239,68,68,0.12)';
}

/* ================================================================
   Component
   ================================================================ */

interface Props {
  workCenters: Record<string, any>[];
  routingOps: Record<string, any>[];
  capacityPlans: Record<string, any>[];
}

export function WorkCentersClient({ workCenters: initialData, routingOps, capacityPlans }: Props) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [sortKey, setSortKey] = useState<SortKey>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  /* ----------------------------------------------------------------
     1. KPI Stats
     ---------------------------------------------------------------- */
  const stats = useMemo(() => {
    let active = 0;
    let maintenance = 0;
    let totalEff = 0;
    let effCount = 0;
    let totalCapacity = 0;
    let totalCost = 0;
    let costCount = 0;

    for (const r of data) {
      const s = getVal(r, 'Status');
      if (s === 'Active') active++;
      if (s === 'Under Maintenance') maintenance++;
      const eff = getNum(r, 'Efficiency Pct');
      if (eff > 0) { totalEff += eff; effCount++; }
      totalCapacity += getNum(r, 'Capacity Per Hour');
      const cost = getNum(r, 'Cost Per Hour');
      if (cost > 0) { totalCost += cost; costCount++; }
    }

    return {
      total: data.length,
      active,
      avgEfficiency: effCount > 0 ? (totalEff / effCount).toFixed(1) : '0',
      totalCapacity,
      avgCost: costCount > 0 ? (totalCost / costCount).toFixed(2) : '0',
      maintenance,
    };
  }, [data]);

  /* ----------------------------------------------------------------
     2. Department Dashboard
     ---------------------------------------------------------------- */
  const deptDashboard = useMemo(() => {
    const map: Record<string, { count: number; effSum: number; effCount: number; totalCap: number; active: number; inactive: number; maintenance: number }> = {};
    for (const dept of DEPARTMENTS) {
      map[dept] = { count: 0, effSum: 0, effCount: 0, totalCap: 0, active: 0, inactive: 0, maintenance: 0 };
    }
    for (const r of data) {
      const dept = getVal(r, 'Department');
      if (!map[dept]) continue;
      map[dept].count++;
      const eff = getNum(r, 'Efficiency Pct');
      if (eff > 0) { map[dept].effSum += eff; map[dept].effCount++; }
      map[dept].totalCap += getNum(r, 'Capacity Per Hour');
      const s = getVal(r, 'Status');
      if (s === 'Active') map[dept].active++;
      else if (s === 'Under Maintenance') map[dept].maintenance++;
      else map[dept].inactive++;
    }
    return DEPARTMENTS.map(dept => {
      const d = map[dept];
      return {
        dept,
        count: d.count,
        avgEff: d.effCount > 0 ? Math.round(d.effSum / d.effCount) : 0,
        totalCap: d.totalCap,
        active: d.active,
        inactive: d.inactive,
        maintenance: d.maintenance,
      };
    });
  }, [data]);

  /* ----------------------------------------------------------------
     3. Efficiency Heatmap
     ---------------------------------------------------------------- */
  const heatmapData = useMemo(() => {
    return data
      .filter(r => getVal(r, 'Status') === 'Active')
      .map(r => ({
        code: getVal(r, 'Code'),
        efficiency: getNum(r, 'Efficiency Pct'),
        capacity: getNum(r, 'Capacity Per Hour'),
        cost: getNum(r, 'Cost Per Hour'),
      }))
      .sort((a, b) => b.efficiency - a.efficiency);
  }, [data]);

  /* ----------------------------------------------------------------
     4. Shift Pattern Analysis
     ---------------------------------------------------------------- */
  const shiftChart = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const dept of DEPARTMENTS) {
      map[dept] = { Single: 0, Double: 0, Triple: 0, Continuous: 0 };
    }
    for (const r of data) {
      const dept = getVal(r, 'Department');
      const shift = getVal(r, 'Shift Pattern');
      if (map[dept] && map[dept][shift] !== undefined) {
        map[dept][shift]++;
      }
    }
    return DEPARTMENTS.map(dept => ({
      name: dept,
      ...map[dept],
    }));
  }, [data]);

  /* ----------------------------------------------------------------
     5. Work Center Utilization (from capacity plans)
     ---------------------------------------------------------------- */
  const utilizationBars = useMemo(() => {
    // Build a map: work center ID -> utilization values
    const wcMap: Record<string, { name: string; utilValues: number[] }> = {};
    for (const wc of data) {
      wcMap[wc.id] = { name: getVal(wc, 'Code'), utilValues: [] };
    }
    for (const plan of capacityPlans) {
      // Capacity plans may reference work centers via "Work Center" field
      const wcRef = plan['Work Center'];
      const wcId = Array.isArray(wcRef) ? wcRef[0] : wcRef;
      if (wcId && wcMap[wcId]) {
        const util = getNum(plan, 'Utilization Pct');
        if (util > 0) wcMap[wcId].utilValues.push(util);
      }
    }
    return Object.entries(wcMap)
      .map(([id, { name, utilValues }]) => ({
        id,
        name,
        avgUtil: utilValues.length > 0 ? Math.round(utilValues.reduce((a, b) => a + b, 0) / utilValues.length) : 0,
        planCount: utilValues.length,
      }))
      .filter(w => w.avgUtil > 0)
      .sort((a, b) => b.avgUtil - a.avgUtil);
  }, [data, capacityPlans]);

  /* ----------------------------------------------------------------
     6. Cost vs Efficiency scatter data
     ---------------------------------------------------------------- */
  const costEfficiency = useMemo(() => {
    return data
      .filter(r => getNum(r, 'Cost Per Hour') > 0 && getNum(r, 'Efficiency Pct') > 0)
      .map(r => ({
        name: getVal(r, 'Code'),
        cost: getNum(r, 'Cost Per Hour'),
        efficiency: getNum(r, 'Efficiency Pct'),
        capacity: getNum(r, 'Capacity Per Hour'),
        dept: getVal(r, 'Department'),
      }));
  }, [data]);

  /* ----------------------------------------------------------------
     Filtered + Sorted + Paginated Table
     ---------------------------------------------------------------- */
  const filtered = useMemo(() => {
    let result = data;
    if (deptFilter !== 'All') {
      result = result.filter(r => getVal(r, 'Department') === deptFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aV = a[sortKey];
        const bV = b[sortKey];
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
  }, [data, deptFilter, search, sortKey, sortDir]);

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
    await createRecord(TABLES.WORK_CENTERS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.WORK_CENTERS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.WORK_CENTERS, selected.id);
    setData(prev => prev.filter(r => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  /* ----------------------------------------------------------------
     Render
     ---------------------------------------------------------------- */
  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Work Centers</h1>
          <p className="page-subtitle">Manufacturing resource management &mdash; capacity, efficiency, and cost intelligence</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Work Center
        </button>
      </div>

      {/* ── 1. KPI Row (6 cards) ── */}
      <div className="stat-row">
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#6366f1' }}>{stats.total}</div>
          <div className="kpi-label">Total Work Centers</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#10b981' }}>{stats.active}</div>
          <div className="kpi-label">Active</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: tierColor(parseFloat(stats.avgEfficiency)) }}>{stats.avgEfficiency}%</div>
          <div className="kpi-label">Avg Efficiency</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#06b6d4' }}>{stats.totalCapacity.toLocaleString()}</div>
          <div className="kpi-label">Total Capacity/Hr</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#f59e0b' }}>${stats.avgCost}</div>
          <div className="kpi-label">Avg Cost/Hr</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: stats.maintenance > 0 ? '#ef4444' : 'var(--text-muted)' }}>{stats.maintenance}</div>
          <div className="kpi-label">Under Maintenance</div>
        </div>
      </div>

      {/* ── 2. Department Dashboard ── */}
      <div className="chart-card" style={{ marginBottom: 20 }}>
        <h3>Department Dashboard</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
          {deptDashboard.map(d => {
            const color = DEPT_COLORS[d.dept] || '#6366f1';
            return (
              <div key={d.dept} style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '14px 16px',
                borderLeft: `3px solid ${color}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{d.dept}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 6 }}>
                    {d.count} WC{d.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Avg Efficiency</div>
                    <div style={{ fontWeight: 700, color: tierColor(d.avgEff), fontSize: 15 }}>{d.avgEff}%</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Total Cap/Hr</div>
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>{d.totalCap.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {d.active > 0 && <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{d.active} Active</span>}
                  {d.inactive > 0 && <span style={{ fontSize: 10, background: 'rgba(100,116,139,0.15)', color: '#94a3b8', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{d.inactive} Inactive</span>}
                  {d.maintenance > 0 && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{d.maintenance} Maint.</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Efficiency Heatmap ── */}
      {heatmapData.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3>Efficiency Heatmap</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 12px' }}>Active work centers &mdash; cells colored by performance tier</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Work Center</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Efficiency %</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Capacity/Hr</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Cost/Hr</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.map(r => (
                  <tr key={r.code}>
                    <td style={{ padding: '6px 12px', fontWeight: 600, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{r.code}</td>
                    <td style={{
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: tierColor(r.efficiency),
                      background: tierBg(r.efficiency),
                      borderBottom: '1px solid var(--border)',
                    }}>{r.efficiency}%</td>
                    <td style={{
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: r.capacity >= 100 ? '#10b981' : r.capacity >= 50 ? '#f59e0b' : '#ef4444',
                      background: r.capacity >= 100 ? 'rgba(16,185,129,0.12)' : r.capacity >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                      borderBottom: '1px solid var(--border)',
                    }}>{r.capacity.toLocaleString()}</td>
                    <td style={{
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: r.cost <= 50 ? '#10b981' : r.cost <= 100 ? '#f59e0b' : '#ef4444',
                      background: r.cost <= 50 ? 'rgba(16,185,129,0.12)' : r.cost <= 100 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                      borderBottom: '1px solid var(--border)',
                    }}>${r.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Charts Row: Shift Analysis + Cost Analysis side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* ── 4. Shift Pattern Analysis ── */}
        <div className="chart-card">
          <h3>Shift Pattern Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={shiftChart} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Single" stackId="shift" fill={SHIFT_COLORS.Single} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Double" stackId="shift" fill={SHIFT_COLORS.Double} />
              <Bar dataKey="Triple" stackId="shift" fill={SHIFT_COLORS.Triple} />
              <Bar dataKey="Continuous" stackId="shift" fill={SHIFT_COLORS.Continuous} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── 6. Cost vs Efficiency ── */}
        <div className="chart-card">
          <h3>Cost vs Efficiency Analysis</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 8px' }}>Best value = high efficiency, low cost (bottom-right)</p>
          {costEfficiency.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  type="number" dataKey="efficiency" name="Efficiency"
                  tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                  unit="%" domain={[0, 100]}
                  label={{ value: 'Efficiency %', position: 'bottom', offset: -2, style: { fill: '#64748b', fontSize: 10 } }}
                />
                <YAxis
                  type="number" dataKey="cost" name="Cost/Hr"
                  tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                  unit="$"
                  label={{ value: 'Cost/Hr ($)', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 10 } }}
                />
                <ZAxis type="number" dataKey="capacity" range={[40, 200]} name="Capacity" />
                <Tooltip
                  {...CHART_TOOLTIP}
                  formatter={(value: any, name?: string) => {
                    if (name === 'Efficiency') return [`${value}%`, name];
                    if (name === 'Cost/Hr') return [`$${value}`, name];
                    return [value, name ?? ''];
                  }}
                  labelFormatter={(_, payload) => {
                    if (payload && payload.length > 0) {
                      const p = payload[0]?.payload;
                      return p?.name || '';
                    }
                    return '';
                  }}
                />
                <Scatter data={costEfficiency} name="Work Centers">
                  {costEfficiency.map((entry, i) => (
                    <Cell key={i} fill={DEPT_COLORS[entry.dept] || '#6366f1'} fillOpacity={0.85} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No cost/efficiency data available
            </div>
          )}
        </div>
      </div>

      {/* ── 5. Work Center Utilization Bars ── */}
      {utilizationBars.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 20 }}>
          <h3>Work Center Utilization</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 12px' }}>Average utilization from linked capacity plans</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {utilizationBars.map(w => (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 120, fontSize: 12, fontWeight: 600, color: 'var(--text)', textAlign: 'right', flexShrink: 0 }}>
                  {w.name}
                </div>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, height: 22, overflow: 'hidden', position: 'relative', border: '1px solid var(--border)' }}>
                  <div style={{
                    width: `${Math.min(w.avgUtil, 100)}%`,
                    height: '100%',
                    background: w.avgUtil >= 90 ? 'linear-gradient(90deg, #ef4444, #dc2626)' : w.avgUtil >= 75 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #10b981, #059669)',
                    borderRadius: 5,
                    transition: 'width 0.5s ease',
                  }} />
                  <span style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--text)',
                  }}>{w.avgUtil}%</span>
                </div>
                <div style={{ width: 60, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {w.planCount} plan{w.planCount !== 1 ? 's' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 7. Enhanced Table with Department Tabs ── */}
      <div className="table-container">
        <div className="toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              All Work Centers <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="search-bar">
              <span className="search-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              </span>
              <input className="input" placeholder="Search work centers..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ width: 240 }} />
            </div>
          </div>
        </div>

        {/* Department filter tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '0 16px 12px', flexWrap: 'wrap' }}>
          {['All', ...DEPARTMENTS].map(dept => (
            <button
              key={dept}
              onClick={() => { setDeptFilter(dept); setPage(1); }}
              style={{
                padding: '5px 14px',
                fontSize: 11,
                fontWeight: deptFilter === dept ? 700 : 500,
                borderRadius: 6,
                border: '1px solid',
                borderColor: deptFilter === dept ? 'var(--accent)' : 'var(--border)',
                background: deptFilter === dept ? 'var(--accent)' : 'transparent',
                color: deptFilter === dept ? '#fff' : 'var(--text-dim)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {dept}
            </button>
          ))}
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No work centers found</div>
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

      {/* ── 8. CRUD Modals ── */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Work Center">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Work Center">
        {selected && <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />}
      </Modal>

      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="Work Center Details">
        {selected && (
          <div>
            <div className="detail-grid" style={{ marginBottom: 24 }}>
              {Object.entries(selected).filter(([k]) => !['id', 'createdAt', 'updatedAt', 'createdBy'].includes(k)).map(([key, val]) => (
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
