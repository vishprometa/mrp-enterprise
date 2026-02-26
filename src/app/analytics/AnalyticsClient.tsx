'use client';

import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
  LineChart, Line,
} from 'recharts';

// ── Types ────────────────────────────────────────

interface Props {
  stats: Record<string, number>;
  items: Record<string, any>[];
  inventory: Record<string, any>[];
  prodOrders: Record<string, any>[];
  purchaseOrders: Record<string, any>[];
  salesOrders: Record<string, any>[];
  capacityPlans: Record<string, any>[];
  costCenters: Record<string, any>[];
  qualityInspections: Record<string, any>[];
}

// ── Constants ────────────────────────────────────

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
const BAR_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];
const GRID_STROKE = 'rgba(255,255,255,0.04)';
const AXIS_TICK = { fill: '#64748b', fontSize: 11 };
const LEGEND_STYLE = { wrapperStyle: { color: '#94a3b8', fontSize: 12 } };

// ── Helpers ──────────────────────────────────────

function groupBy(records: Record<string, any>[], field: string): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const key = String(r[field] ?? 'Unknown');
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function formatMonth(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  } catch {
    return 'Unknown';
  }
}

function groupByMonth(records: Record<string, any>[], dateField: string): { month: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const raw = r[dateField];
    if (!raw) continue;
    const month = formatMonth(String(raw));
    if (month === 'Unknown') continue;
    counts[month] = (counts[month] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
}

// ── Custom Tooltip ─────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow-lg)' }}>
      {label && <p style={{ color: 'var(--text-muted)', margin: '0 0 4px', fontSize: 12 }}>{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: 'var(--text)', margin: '2px 0', fontSize: 12 }}>
          <span style={{ color: entry.color || entry.fill, marginRight: 6 }}>{'\u25CF'}</span>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────

export function AnalyticsClient({ stats, items, inventory, prodOrders, purchaseOrders, salesOrders, capacityPlans, costCenters, qualityInspections }: Props) {

  const itemsByType = groupBy(items, 'Item Type');
  const prodByStatus = groupBy(prodOrders, 'Status');

  const itemIdToName = new Map(items.map(i => [i.id, i['Item Name'] || i['Name'] || i['Item ID'] || 'Unknown']));
  const inventoryLevels = [...inventory]
    .filter(r => r['Qty On Hand'] != null && Number(r['Qty On Hand']) > 0)
    .sort((a, b) => Number(b['Qty On Hand'] || 0) - Number(a['Qty On Hand'] || 0))
    .slice(0, 10)
    .map(r => {
      const itemRef = r['Item'] || r['Item Name'];
      let name = typeof itemRef === 'string' ? (itemIdToName.get(itemRef) || itemRef) : String(itemRef ?? 'Unknown');
      if (name.length > 18) name = name.substring(0, 16) + '...';
      return { name, qty: Number(r['Qty On Hand'] || 0) };
    });

  const poByStatus = groupBy(purchaseOrders, 'Status');

  const capacityData = capacityPlans
    .filter(r => r['Plan Date'] && r['Utilization Pct'] != null)
    .map(r => ({
      date: new Date(r['Plan Date']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      utilization: Number(r['Utilization Pct'] || 0),
      sortKey: new Date(r['Plan Date']).getTime(),
    }))
    .sort((a, b) => a.sortKey - b.sortKey);

  const budgetVsActual = costCenters
    .filter(r => (r['Budget'] != null || r['Actual Cost'] != null))
    .map(r => {
      let name = r['Cost Center Name'] || r['Name'] || r['Code'] || 'Unknown';
      if (name.length > 14) name = name.substring(0, 12) + '...';
      return { name, budget: Number(r['Budget'] || 0), actual: Number(r['Actual Cost'] || 0) };
    });

  const salesByMonth = groupByMonth(salesOrders, 'Order Date');

  // Quality Score Distribution — computed from REAL quality inspections data
  const qualityDistribution = useMemo(() => {
    const buckets = [
      { range: '90-100', min: 90, max: 100, count: 0 },
      { range: '80-89', min: 80, max: 89, count: 0 },
      { range: '70-79', min: 70, max: 79, count: 0 },
      { range: '60-69', min: 60, max: 69, count: 0 },
      { range: 'Below 60', min: 0, max: 59, count: 0 },
    ];
    for (const insp of qualityInspections) {
      const score = Number(insp['Overall Score'] ?? -1);
      if (score < 0) continue;
      for (const b of buckets) {
        if (score >= b.min && score <= b.max) { b.count++; break; }
      }
    }
    return buckets.map(b => ({ range: b.range, count: b.count }));
  }, [qualityInspections]);

  const kpiItems = [
    { label: 'Items', value: stats['Items'] ?? items.length, color: '#6366f1' },
    { label: 'Production Orders', value: stats['Production Orders'] ?? prodOrders.length, color: '#8b5cf6' },
    { label: 'Purchase Orders', value: stats['Purchase Orders'] ?? purchaseOrders.length, color: '#06b6d4' },
    { label: 'Sales Orders', value: stats['Sales Orders'] ?? salesOrders.length, color: '#10b981' },
    { label: 'Inventory Records', value: stats['Inventory'] ?? inventory.length, color: '#f59e0b' },
    { label: 'Suppliers', value: stats['Suppliers'] ?? 0, color: '#ec4899' },
    { label: 'Customers', value: stats['Customers'] ?? 0, color: '#14b8a6' },
    { label: 'Quality Inspections', value: stats['Quality Inspections'] ?? qualityInspections.length, color: '#ef4444' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Data insights across all modules &mdash; all data from live API</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {kpiItems.map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-value" style={{ color: k.color }}>{k.value.toLocaleString()}</div>
            <div className="kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="chart-card">
          <h3>Items by Category</h3>
          {itemsByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={itemsByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={2} stroke="none">
                  {itemsByType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend {...LEGEND_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No item data available</div>}
        </div>

        <div className="chart-card">
          <h3>Production Order Status</h3>
          {prodByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={prodByStatus} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]} barSize={20}>
                  {prodByStatus.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No production order data</div>}
        </div>

        <div className="chart-card">
          <h3>Inventory Levels (Top 10)</h3>
          {inventoryLevels.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={inventoryLevels} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={55} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="qty" name="Qty On Hand" fill="#06b6d4" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No inventory data</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="chart-card">
          <h3>Purchase Orders by Status</h3>
          {poByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={poByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={2} stroke="none">
                  {poByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend {...LEGEND_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No purchase order data</div>}
        </div>

        <div className="chart-card">
          <h3>Capacity Utilization</h3>
          {capacityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={capacityData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradUtilization" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={GRID_STROKE} />
                <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="utilization" name="Utilization %" stroke="#8b5cf6" fill="url(#gradUtilization)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No capacity plan data</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div className="chart-card">
          <h3>Budget vs Actual Cost</h3>
          {budgetVsActual.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={budgetVsActual} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={45} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend {...LEGEND_STYLE} />
                <Bar dataKey="budget" name="Budget" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={16} />
                <Bar dataKey="actual" name="Actual" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No cost center data</div>}
        </div>

        <div className="chart-card">
          <h3>Sales Order Trends</h3>
          {salesByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={salesByMonth} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid stroke={GRID_STROKE} />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="count" name="Orders" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No sales order data</div>}
        </div>

        <div className="chart-card">
          <h3>Quality Score Distribution</h3>
          {qualityInspections.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={qualityDistribution} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="range" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Inspections" radius={[4, 4, 0, 0]} barSize={28}>
                  {qualityDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No quality inspection data</div>}
        </div>
      </div>
    </div>
  );
}
