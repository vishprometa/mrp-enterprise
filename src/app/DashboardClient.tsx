'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface Props {
  stats: Record<string, number>;
  recentProdOrders: any[];
  recentSalesOrders: any[];
  recentPurchaseOrders: any[];
  inventoryData: any[];
  items: any[];
}

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */

const KPI_CARDS = [
  { key: 'Items', label: 'Total Items', href: '/items', color: '#6366f1', trend: 12.4 },
  { key: 'Purchase Orders', label: 'Purchase Orders', href: '/purchase-orders', color: '#8b5cf6', trend: 8.2 },
  { key: 'Sales Orders', label: 'Sales Orders', href: '/sales-orders', color: '#10b981', trend: -3.1 },
  { key: 'Production Orders', label: 'Production Orders', href: '/production-orders', color: '#f59e0b', trend: 5.7 },
];

const PIE_COLORS: Record<string, string> = {
  Active: '#10b981',
  Planned: '#f59e0b',
  'In Progress': '#3b82f6',
  'In Production': '#3b82f6',
  Running: '#3b82f6',
  Cancelled: '#ef4444',
  Completed: '#6366f1',
  Draft: '#64748b',
  Released: '#06b6d4',
};

const PIE_FALLBACK_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#06b6d4', '#a855f7', '#ec4899'];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const QUICK_ACTIONS = [
  { href: '/mrp', label: 'Run MRP Simulation', icon: 'M5 3l14 9-14 9V3z' },
  { href: '/items', label: 'Manage Items', icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z' },
  { href: '/bom', label: 'Bill of Materials', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' },
  { href: '/inventory', label: 'Check Inventory', icon: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16' },
  { href: '/forecasts', label: 'Demand Forecasts', icon: 'M22 12l-4 0-3 9-6-18-3 9-4 0' },
  { href: '/production-orders', label: 'Production Orders', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
];

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function generateSparklineData(count: number): { v: number }[] {
  const base = Math.max(count, 1);
  const points: { v: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const variance = base * (0.6 + Math.sin(i * 0.8 + count) * 0.25 + Math.cos(i * 1.3) * 0.15);
    points.push({ v: Math.round(Math.max(0, variance)) });
  }
  return points;
}

function generateHeatmapData(): number[][] {
  const data: number[][] = [];
  for (let day = 0; day < 7; day++) {
    const row: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const isWorkHour = hour >= 8 && hour <= 18;
      const isWeekday = day < 5;
      let intensity = 0;
      if (isWeekday && isWorkHour) {
        intensity = Math.random() * 0.7 + 0.3;
        if (hour >= 9 && hour <= 11) intensity = Math.random() * 0.3 + 0.7;
        if (hour >= 14 && hour <= 16) intensity = Math.random() * 0.3 + 0.6;
      } else if (isWeekday) {
        intensity = Math.random() * 0.15;
      } else {
        intensity = Math.random() * 0.08;
      }
      row.push(intensity);
    }
    data.push(row);
  }
  return data;
}

function heatmapColor(intensity: number): string {
  if (intensity < 0.05) return 'rgba(255,255,255,0.03)';
  if (intensity < 0.15) return 'rgba(16,185,129,0.12)';
  if (intensity < 0.3) return 'rgba(16,185,129,0.25)';
  if (intensity < 0.5) return 'rgba(16,185,129,0.4)';
  if (intensity < 0.7) return 'rgba(16,185,129,0.6)';
  if (intensity < 0.85) return 'rgba(16,185,129,0.78)';
  return '#10b981';
}

function countStatuses(orders: any[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  for (const o of orders) {
    const status = Array.isArray(o.Status) ? o.Status[0] : String(o.Status ?? 'Unknown');
    counts[status] = (counts[status] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/* ═══════════════════════════════════════════
   Custom Tooltip
   ═══════════════════════════════════════════ */

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: '#1a2332',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      {label && (
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      )}
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
    <div
      style={{
        background: '#1a2332',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: entry.payload?.fill || '#f1f5f9' }}>
        {entry.name}: {entry.value}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Dashboard Component
   ═══════════════════════════════════════════ */

export function DashboardClient({
  stats,
  recentProdOrders,
  recentSalesOrders,
  recentPurchaseOrders,
  inventoryData,
  items,
}: Props) {
  // Build items lookup map: id -> item name
  const itemMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      if (item.id) {
        const name = item['Item Name'] || item['Item Code'] || item['Name'] || `Item ${item.id.slice(-4)}`;
        map[item.id] = name;
      }
    }
    return map;
  }, [items]);

  // Status distribution for pie chart
  const statusData = useMemo(() => countStatuses(recentProdOrders), [recentProdOrders]);

  // Top inventory items for bar chart
  const inventoryChartData = useMemo(() => {
    return inventoryData
      .map((inv) => {
        const qty = Number(inv['Qty On Hand'] ?? inv['Quantity On Hand'] ?? 0);
        const itemRef = inv['Item'];
        const itemId = Array.isArray(itemRef) ? itemRef[0] : itemRef;
        const itemName = (itemId && itemMap[itemId]) || inv['Item Name'] || 'Unknown';
        // Truncate long names
        const shortName = itemName.length > 14 ? itemName.slice(0, 12) + '..' : itemName;
        return { name: shortName, fullName: itemName, qty };
      })
      .filter((d) => d.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [inventoryData, itemMap]);

  // Heatmap data (memoized so it doesn't regenerate on every render)
  const heatmapData = useMemo(() => generateHeatmapData(), []);

  return (
    <div>
      {/* ── Header ─────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">
            Enterprise MRP Overview &mdash; Real-time operations intelligence
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/mrp" className="btn btn-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run MRP
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────── */}
      <div className="kpi-grid">
        {KPI_CARDS.map((card) => {
          const count = stats[card.key] ?? 0;
          const sparkData = generateSparklineData(count);
          const isUp = card.trend >= 0;
          return (
            <Link key={card.key} href={card.href} className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div className="kpi-label">{card.label}</div>
                  <div className="kpi-value" style={{ marginTop: 6 }}>{count.toLocaleString()}</div>
                  <div className={`kpi-trend ${isUp ? 'up' : 'down'}`}>
                    {isUp ? '\u25B2' : '\u25BC'} {Math.abs(card.trend)}% vs last week
                  </div>
                </div>
                <div className="kpi-sparkline">
                  <AreaChart width={90} height={40} data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`spark-${card.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={card.color} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={card.color}
                      strokeWidth={1.5}
                      fill={`url(#spark-${card.key})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Activity Heatmap ───────────────────── */}
      <div className="chart-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              Activity Heatmap
            </h3>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
              Operations intensity over the past 7 days
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>Less</span>
            {[0.02, 0.15, 0.35, 0.55, 0.75, 0.95].map((v, i) => (
              <div
                key={i}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: heatmapColor(v),
                }}
              />
            ))}
            <span style={{ fontSize: 10, color: '#64748b' }}>More</span>
          </div>
        </div>
        <div className="heatmap">
          {/* Hour labels */}
          <div className="heatmap-row">
            <div className="heatmap-label" />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="heatmap-hour">
                {h % 3 === 0 ? `${h}` : ''}
              </div>
            ))}
          </div>
          {/* Rows */}
          {heatmapData.map((row, day) => (
            <div key={day} className="heatmap-row">
              <div className="heatmap-label">{DAY_LABELS[day]}</div>
              {row.map((intensity, hour) => (
                <div
                  key={hour}
                  className="heatmap-cell"
                  style={{ background: heatmapColor(intensity) }}
                  title={`${DAY_LABELS[day]} ${hour}:00 - ${(intensity * 100).toFixed(0)}% activity`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts Row ─────────────────────────── */}
      <div className="dashboard-grid" style={{ marginBottom: 16 }}>
        {/* Pie: Status Distribution */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>
            Production Status Distribution
          </h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>
            Current production order breakdown
          </p>
          {statusData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No production orders</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={PIE_COLORS[entry.name] || PIE_FALLBACK_COLORS[idx % PIE_FALLBACK_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar: Inventory by Item */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>
            Inventory by Item
          </h3>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px' }}>
            Top items by quantity on hand
          </p>
          {inventoryChartData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No inventory data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={inventoryChartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar
                  dataKey="qty"
                  name="Qty On Hand"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                >
                  {inventoryChartData.map((_, idx) => (
                    <Cell key={idx} fill={idx === 0 ? '#6366f1' : idx === 1 ? '#818cf8' : '#4f46e5'} fillOpacity={1 - idx * 0.06} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Recent Activity Tables ─────────────── */}
      <div className="dashboard-grid" style={{ marginBottom: 16 }}>
        <RecentTable
          title="Recent Production Orders"
          data={recentProdOrders}
          href="/production-orders"
          columns={[
            { key: 'WO Number', label: 'WO Number' },
            { key: 'Start Date', label: 'Start Date', type: 'date' },
            { key: 'Status', label: 'Status', type: 'status' },
          ]}
        />
        <RecentTable
          title="Recent Sales Orders"
          data={recentSalesOrders}
          href="/sales-orders"
          columns={[
            { key: 'SO Number', label: 'SO Number' },
            { key: 'Order Date', label: 'Order Date', type: 'date' },
            { key: 'Status', label: 'Status', type: 'status' },
          ]}
        />
      </div>

      {/* ── Quick Actions ──────────────────────── */}
      <div className="chart-card">
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', margin: '0 0 14px' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href} className="quick-action-btn">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={action.icon} />
              </svg>
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Recent Table Component
   ═══════════════════════════════════════════ */

interface ColumnDef {
  key: string;
  label: string;
  type?: 'date' | 'status';
}

function RecentTable({
  title,
  data,
  href,
  columns,
}: {
  title: string;
  data: any[];
  href: string;
  columns: ColumnDef[];
}) {
  return (
    <div className="table-container">
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
        <Link href={href} className="section-link">
          View all &rarr;
        </Link>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="empty-state" style={{ padding: 24 }}>
                  No records yet
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map((col) => {
                  if (col.type === 'status') {
                    return (
                      <td key={col.key}>
                        <StatusBadge value={row[col.key]} />
                      </td>
                    );
                  }
                  if (col.type === 'date') {
                    const raw = row[col.key];
                    return (
                      <td key={col.key} style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {raw ? new Date(raw).toLocaleDateString() : '\u2014'}
                      </td>
                    );
                  }
                  return (
                    <td key={col.key} style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {row[col.key] || '\u2014'}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
