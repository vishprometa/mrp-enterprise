'use client';

import { useState, useMemo } from 'react';
import { createRecord, updateRecord, deleteRecord } from '@/lib/actions';
import { TABLES } from '@/lib/tables';
import { Modal } from '@/components/Modal';
import { RecordForm } from '@/components/RecordForm';
import { StatusBadge } from '@/components/StatusBadge';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, Legend, ComposedChart,
} from 'recharts';

/* ================================================================
   Constants
   ================================================================ */

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];
const METHOD_COLORS: Record<string, string> = {
  'Moving Average': '#6366f1',
  'Exponential Smoothing': '#8b5cf6',
  'Regression': '#06b6d4',
  'Manual': '#f59e0b',
  'AI-Based': '#10b981',
};

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};

const GRID_STROKE = 'rgba(255,255,255,0.04)';
const AXIS_TICK = { fill: '#64748b', fontSize: 11 };
const PAGE_SIZE = 25;
const PERIOD_TABS = ['All', 'Weekly', 'Monthly', 'Quarterly', 'Annual'] as const;

type SortDir = 'asc' | 'desc' | null;

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

interface Props {
  forecasts: Record<string, any>[];
  items: Record<string, any>[];
  salesOrders: Record<string, any>[];
}

/* ================================================================
   Helpers
   ================================================================ */

function sel(v: any): string {
  return Array.isArray(v) ? v[0] : String(v ?? '');
}

function num(v: any): number {
  return Number(v ?? 0);
}

function fmtMonth(d: string): string {
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  } catch { return ''; }
}

function fmtQtr(d: string): string {
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const q = Math.ceil((dt.getMonth() + 1) / 3);
    return `Q${q} ${dt.getFullYear()}`;
  } catch { return ''; }
}

function movingAvg(data: { x: number; y: number }[], window: number): { x: number; y: number }[] {
  return data.map((point, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    const avg = slice.reduce((s, p) => s + p.y, 0) / slice.length;
    return { x: point.x, y: Math.round(avg) };
  });
}

/* ================================================================
   Table Columns
   ================================================================ */

const columns: Column[] = [
  { key: 'Forecast Date', label: 'Date', sortable: true, render: (v: any) => v ? new Date(v).toLocaleDateString() : '\u2014' },
  { key: 'Item', label: 'Item', sortable: true, render: (v: any) => v ? String(v) : '\u2014' },
  { key: 'Period', label: 'Period', sortable: true, render: (v: any) => <StatusBadge value={v} /> },
  { key: 'Quantity', label: 'Quantity', sortable: true, render: (v: any) => v != null ? Number(v).toLocaleString() : '\u2014' },
  { key: 'Confidence Pct', label: 'Confidence', sortable: true, render: (v: any) => {
    if (v == null) return '\u2014';
    const n = Number(v);
    const color = n >= 80 ? '#10b981' : n >= 60 ? '#f59e0b' : '#ef4444';
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 48, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', display: 'inline-block', position: 'relative', overflow: 'hidden' }}>
          <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(n, 100)}%`, background: color, borderRadius: 3 }} />
        </span>
        <span style={{ color, fontWeight: 600, fontSize: 12 }}>{n}%</span>
      </span>
    );
  }},
  { key: 'Method', label: 'Method', sortable: true, render: (v: any) => {
    const s = sel(v);
    if (!s || s === 'undefined') return '\u2014';
    const isAI = s === 'AI-Based';
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px',
        borderRadius: 12, fontSize: 12, fontWeight: 600,
        background: isAI ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.08)',
        color: isAI ? '#10b981' : 'var(--text-dim)',
      }}>
        {isAI && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
        {s}
      </span>
    );
  }},
];

const formFields = [
  { name: 'Forecast Date', label: 'Forecast Date', type: 'date' as const, required: true },
  { name: 'Period', label: 'Period', type: 'select' as const, options: ['Weekly', 'Monthly', 'Quarterly', 'Annual'] },
  { name: 'Quantity', label: 'Quantity', type: 'number' as const, required: true },
  { name: 'Confidence Pct', label: 'Confidence Pct', type: 'number' as const },
  { name: 'Method', label: 'Method', type: 'select' as const, options: ['Moving Average', 'Exponential Smoothing', 'Regression', 'Manual', 'AI-Based'] },
  { name: 'Notes', label: 'Notes', type: 'textarea' as const },
];

/* ================================================================
   Component
   ================================================================ */

export function ForecastsClient({ forecasts: initialData, items, salesOrders }: Props) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [periodTab, setPeriodTab] = useState<string>('All');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  // Build item lookup
  const itemMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of items) {
      m.set(it.id, it['Item Name'] || it['Name'] || 'Unknown');
    }
    return m;
  }, [items]);

  /* ── KPI Stats ─────────────────────────────── */
  const stats = useMemo(() => {
    let totalConfidence = 0;
    let confCount = 0;
    let totalQty = 0;
    let aiCount = 0;
    const periods = new Set<string>();
    const methods = new Set<string>();
    for (const r of data) {
      const c = num(r['Confidence Pct']);
      if (c > 0) { totalConfidence += c; confCount++; }
      totalQty += num(r['Quantity']);
      const p = sel(r.Period);
      if (p && p !== 'undefined') periods.add(p);
      const m = sel(r.Method);
      if (m && m !== 'undefined') {
        methods.add(m);
        if (m === 'AI-Based') aiCount++;
      }
    }
    return {
      total: data.length,
      avgConfidence: confCount > 0 ? (totalConfidence / confCount).toFixed(1) : '0',
      forecastVolume: totalQty,
      methods: methods.size,
      periods: periods.size,
      aiCount,
    };
  }, [data]);

  /* ── Chart 1: Confidence Band ────────────────── */
  const confidenceBandData = useMemo(() => {
    const sorted = [...data]
      .filter(r => r['Forecast Date'])
      .sort((a, b) => new Date(a['Forecast Date']).getTime() - new Date(b['Forecast Date']).getTime());

    return sorted.map(r => {
      const qty = num(r['Quantity']);
      const conf = num(r['Confidence Pct']) / 100;
      const margin = qty * (1 - Math.max(conf, 0.1));
      return {
        date: new Date(r['Forecast Date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sortKey: new Date(r['Forecast Date']).getTime(),
        forecast: qty,
        upper: Math.round(qty + margin * 0.5),
        lower: Math.max(0, Math.round(qty - margin * 0.5)),
        band: [Math.max(0, Math.round(qty - margin * 0.5)), Math.round(qty + margin * 0.5)],
      };
    });
  }, [data]);

  /* ── Chart 2: Method Comparison ──────────────── */
  const methodComparison = useMemo(() => {
    const buckets: Record<string, { totalConf: number; count: number; totalQty: number }> = {};
    for (const r of data) {
      const m = sel(r.Method);
      if (!m || m === 'undefined') continue;
      if (!buckets[m]) buckets[m] = { totalConf: 0, count: 0, totalQty: 0 };
      buckets[m].totalConf += num(r['Confidence Pct']);
      buckets[m].totalQty += num(r['Quantity']);
      buckets[m].count++;
    }
    return Object.entries(buckets)
      .map(([method, b]) => ({
        method,
        avgConfidence: Math.round(b.totalConf / b.count),
        avgQty: Math.round(b.totalQty / b.count),
        count: b.count,
        fill: METHOD_COLORS[method] || '#64748b',
      }))
      .sort((a, b) => b.avgConfidence - a.avgConfidence);
  }, [data]);

  /* ── Chart 3: Forecast Accuracy Tracker ──────── */
  const accuracyData = useMemo(() => {
    // Aggregate forecast qty by month
    const forecastByMonth: Record<string, number> = {};
    for (const r of data) {
      const d = r['Forecast Date'];
      if (!d) continue;
      const m = fmtMonth(String(d));
      if (!m) continue;
      forecastByMonth[m] = (forecastByMonth[m] || 0) + num(r['Quantity']);
    }

    // Aggregate actual sales qty by month (use total amount as proxy for qty)
    const actualByMonth: Record<string, number> = {};
    for (const so of salesOrders) {
      const d = so['Order Date'];
      if (!d) continue;
      const m = fmtMonth(String(d));
      if (!m) continue;
      actualByMonth[m] = (actualByMonth[m] || 0) + num(so['Total Amount']);
    }

    const allMonths = new Set([...Object.keys(forecastByMonth), ...Object.keys(actualByMonth)]);
    return [...allMonths]
      .map(month => {
        const forecast = forecastByMonth[month] || 0;
        const actual = actualByMonth[month] || 0;
        const accuracy = forecast > 0 ? Math.min(100, Math.round((1 - Math.abs(forecast - actual) / forecast) * 100)) : 0;
        return { month, forecast, actual, accuracy: Math.max(0, accuracy), sortKey: new Date(month).getTime() };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [data, salesOrders]);

  /* ── Chart 4: Period Heatmap ─────────────────── */
  const heatmapData = useMemo(() => {
    const confBuckets = ['High (80-100%)', 'Medium (60-79%)', 'Low (0-59%)'];
    const periodTypes = ['Weekly', 'Monthly', 'Quarterly', 'Annual'];
    const grid: Record<string, Record<string, number>> = {};
    for (const b of confBuckets) grid[b] = {};

    for (const r of data) {
      const p = sel(r.Period);
      if (!p || !periodTypes.includes(p)) continue;
      const conf = num(r['Confidence Pct']);
      const bucket = conf >= 80 ? confBuckets[0] : conf >= 60 ? confBuckets[1] : confBuckets[2];
      grid[bucket][p] = (grid[bucket][p] || 0) + num(r['Quantity']);
    }

    return { confBuckets, periodTypes, grid };
  }, [data]);

  /* ── Chart 5: Demand Pattern with Moving Avg ─── */
  const demandPattern = useMemo(() => {
    const sorted = [...data]
      .filter(r => r['Forecast Date'])
      .sort((a, b) => new Date(a['Forecast Date']).getTime() - new Date(b['Forecast Date']).getTime());

    const raw = sorted.map((r, i) => ({
      date: new Date(r['Forecast Date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      qty: num(r['Quantity']),
      idx: i,
    }));

    const points = raw.map(r => ({ x: r.idx, y: r.qty }));
    const ma = movingAvg(points, 5);

    return raw.map((r, i) => ({
      date: r.date,
      quantity: r.qty,
      movingAvg: ma[i]?.y ?? 0,
    }));
  }, [data]);

  /* ── Filtered + Sorted + Paginated Table ─────── */
  const filtered = useMemo(() => {
    let result = [...data];

    // Period tab filter
    if (periodTab !== 'All') {
      result = result.filter(r => sel(r.Period) === periodTab);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortCol && sortDir) {
      result.sort((a, b) => {
        let va = a[sortCol];
        let vb = b[sortCol];
        if (Array.isArray(va)) va = va[0];
        if (Array.isArray(vb)) vb = vb[0];
        if (va == null) return 1;
        if (vb == null) return -1;
        const na = Number(va);
        const nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) return sortDir === 'asc' ? na - nb : nb - na;
        return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
    }

    return result;
  }, [data, search, periodTab, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortCol(null);
    } else {
      setSortCol(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  /* ── CRUD ────────────────────────────────────── */
  const handleCreate = async (values: Record<string, any>) => {
    await createRecord(TABLES.DEMAND_FORECASTS, values);
    setModalMode(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleUpdate = async (values: Record<string, any>) => {
    if (!selected) return;
    await updateRecord(TABLES.DEMAND_FORECASTS, selected.id, values);
    setModalMode(null);
    setSelected(null);
    if (typeof window !== 'undefined') window.location.reload();
  };

  const handleDelete = async () => {
    if (!selected) return;
    await deleteRecord(TABLES.DEMAND_FORECASTS, selected.id);
    setData((prev) => prev.filter((r) => r.id !== selected.id));
    setModalMode(null);
    setSelected(null);
  };

  /* ── Heatmap cell color ──────────────────────── */
  const heatmapColor = (value: number, maxValue: number) => {
    if (value === 0 || maxValue === 0) return 'rgba(255,255,255,0.02)';
    const intensity = Math.min(value / maxValue, 1);
    return `rgba(99, 102, 241, ${0.1 + intensity * 0.6})`;
  };

  const heatmapMax = useMemo(() => {
    let max = 0;
    for (const bucket of Object.values(heatmapData.grid)) {
      for (const val of Object.values(bucket)) {
        if (val > max) max = val;
      }
    }
    return max;
  }, [heatmapData]);

  /* ── Render ──────────────────────────────────── */
  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Demand Forecasts</h1>
          <p className="page-subtitle">Forecast analytics, accuracy tracking, and demand pattern analysis</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setModalMode('create'); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New Forecast
        </button>
      </div>

      {/* 6 KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Forecasts', value: stats.total.toLocaleString(), color: '#6366f1', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
          { label: 'Avg Confidence', value: `${stats.avgConfidence}%`, color: '#10b981', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Forecast Volume', value: stats.forecastVolume.toLocaleString(), color: '#8b5cf6', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
          { label: 'Methods Used', value: stats.methods.toString(), color: '#06b6d4', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
          { label: 'Periods Covered', value: stats.periods.toString(), color: '#f59e0b', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
          { label: 'AI-Based', value: stats.aiCount.toString(), color: '#ec4899', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
        ].map(kpi => (
          <div key={kpi.label} className="stat-mini" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 10, right: 10, opacity: 0.15 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={kpi.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={kpi.icon} /></svg>
            </div>
            <div className="value" style={{ color: kpi.color, fontSize: 22 }}>{kpi.value}</div>
            <div className="label">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Confidence Band + Method Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="chart-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Confidence Band Chart
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Forecast quantity with confidence range</span>
          </h3>
          {confidenceBandData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={confidenceBandData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={55} />
                <Tooltip {...CHART_TOOLTIP} />
                <Area type="monotone" dataKey="band" stroke="none" fill="url(#bandGrad)" fillOpacity={1} name="Confidence Band" />
                <Line type="monotone" dataKey="forecast" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5, stroke: '#6366f1', fill: '#fff' }} name="Forecast Qty" />
                <Line type="monotone" dataKey="upper" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Upper Bound" />
                <Line type="monotone" dataKey="lower" stroke="#6366f1" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Lower Bound" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No forecast data with dates</div>}
        </div>

        <div className="chart-card">
          <h3>Method Comparison</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-4px 0 12px' }}>Avg confidence by forecasting method</p>
          {methodComparison.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={methodComparison} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                <YAxis type="category" dataKey="method" tick={AXIS_TICK} axisLine={false} tickLine={false} width={120} />
                <Tooltip {...CHART_TOOLTIP} formatter={(v: any) => [`${v}%`, 'Avg Confidence']} />
                <Bar dataKey="avgConfidence" name="Avg Confidence" radius={[0, 6, 6, 0]} barSize={22}>
                  {methodComparison.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No method data</div>}
        </div>
      </div>

      {/* Row 2: Accuracy Tracker + Period Heatmap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="chart-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Forecast Accuracy Tracker
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Forecasted vs actual (sales orders)</span>
          </h3>
          {accuracyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={accuracyData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis yAxisId="qty" tick={AXIS_TICK} axisLine={false} tickLine={false} width={55} />
                <YAxis yAxisId="pct" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" width={45} />
                <Tooltip {...CHART_TOOLTIP} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
                <Bar yAxisId="qty" dataKey="forecast" name="Forecast" fill="#6366f1" radius={[3, 3, 0, 0]} barSize={14} opacity={0.7} />
                <Bar yAxisId="qty" dataKey="actual" name="Actual (Sales)" fill="#10b981" radius={[3, 3, 0, 0]} barSize={14} opacity={0.7} />
                <Line yAxisId="pct" type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No comparison data available</div>}
        </div>

        <div className="chart-card">
          <h3>Period Heatmap</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-4px 0 12px' }}>Quantity by period type and confidence level</p>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 4 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, padding: '6px 10px' }}></th>
                  {heatmapData.periodTypes.map(p => (
                    <th key={p} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, padding: '6px 10px' }}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.confBuckets.map(bucket => (
                  <tr key={bucket}>
                    <td style={{ fontSize: 11, color: 'var(--text-dim)', padding: '6px 10px', whiteSpace: 'nowrap' }}>{bucket}</td>
                    {heatmapData.periodTypes.map(p => {
                      const val = heatmapData.grid[bucket][p] || 0;
                      return (
                        <td key={p} style={{
                          textAlign: 'center', padding: '12px 10px', borderRadius: 6,
                          background: heatmapColor(val, heatmapMax),
                          color: val > 0 ? 'var(--text)' : 'var(--text-muted)',
                          fontSize: 13, fontWeight: val > 0 ? 700 : 400,
                          transition: 'background 0.2s',
                        }}>
                          {val > 0 ? val.toLocaleString() : '\u2014'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: Demand Pattern */}
      <div className="chart-card" style={{ marginBottom: 20 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Demand Pattern Analysis
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Forecast quantity trend with 5-point moving average</span>
        </h3>
        {demandPattern.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={demandPattern} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={55} />
              <Tooltip {...CHART_TOOLTIP} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
              <Area type="monotone" dataKey="quantity" name="Forecast Qty" stroke="#8b5cf6" fill="url(#demandGrad)" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 2 }} />
              <Line type="monotone" dataKey="movingAvg" name="Moving Avg (5)" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="6 3" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <div className="empty-state">No demand data</div>}
      </div>

      {/* Table with Period Filter Tabs */}
      <div className="table-container">
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            All Forecasts <span style={{ fontWeight: 500, color: 'var(--text-dim)', fontSize: 12 }}>({filtered.length})</span>
          </h3>

          {/* Period Tabs */}
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2 }}>
            {PERIOD_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => { setPeriodTab(tab); setPage(1); }}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: periodTab === tab ? 'var(--accent)' : 'transparent',
                  color: periodTab === tab ? '#fff' : 'var(--text-dim)',
                  transition: 'all 0.15s',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="search-bar" style={{ marginLeft: 'auto' }}>
            <span className="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </span>
            <input className="input" placeholder="Search forecasts..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 240 }} />
          </div>
        </div>

        {pageData.length === 0 ? (
          <div className="empty-state">No forecasts found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    onClick={c.sortable ? () => handleSort(c.key) : undefined}
                    style={{ cursor: c.sortable ? 'pointer' : 'default', userSelect: 'none' }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.label}
                      {c.sortable && sortCol === c.key && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ opacity: 0.6, transform: sortDir === 'desc' ? 'rotate(180deg)' : 'none' }}>
                          <path d="M5 2l4 6H1z" />
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((row) => (
                <tr key={row.id} onClick={() => { setSelected(row); setModalMode('view'); }} style={{ cursor: 'pointer' }}>
                  {columns.map((c) => (
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

      {/* Modals */}
      <Modal open={modalMode === 'create'} onClose={() => setModalMode(null)} title="New Forecast">
        <RecordForm fields={formFields} onSubmit={handleCreate} onCancel={() => setModalMode(null)} submitLabel="Create" />
      </Modal>

      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setSelected(null); }} title="Edit Forecast">
        {selected && <RecordForm fields={formFields} initialValues={selected} onSubmit={handleUpdate} onCancel={() => { setModalMode(null); setSelected(null); }} submitLabel="Update" />}
      </Modal>

      <Modal open={modalMode === 'view' && !!selected} onClose={() => { setModalMode(null); setSelected(null); }} title="Forecast Details">
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
