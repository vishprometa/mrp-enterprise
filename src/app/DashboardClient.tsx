'use client';

import { useMemo } from 'react';
import Link from 'next/link';
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
  { key: 'Items', label: 'Total Items', href: '/items', color: '#6366f1' },
  { key: 'Purchase Orders', label: 'Purchase Orders', href: '/purchase-orders', color: '#8b5cf6' },
  { key: 'Sales Orders', label: 'Sales Orders', href: '/sales-orders', color: '#10b981' },
  { key: 'Production Orders', label: 'Production Orders', href: '/production-orders', color: '#f59e0b' },
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

const QUICK_ACTIONS = [
  { href: '/mrp', label: 'Run MRP Simulation', icon: 'M5 3l14 9-14 9V3z' },
  { href: '/items', label: 'Manage Items', icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z' },
  { href: '/bom', label: 'Bill of Materials', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' },
  { href: '/inventory', label: 'Check Inventory', icon: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16' },
  { href: '/bom-explosion', label: 'BOM Explosion', icon: 'M22 12l-4 0-3 9-6-18-3 9-4 0' },
  { href: '/production-orders', label: 'Production Orders', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
];

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

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
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow-lg)' }}>
      {label && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ fontSize: 13, fontWeight: 600, color: entry.color || 'var(--text)' }}>
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
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: entry.payload?.fill || 'var(--text)' }}>
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

  const statusData = useMemo(() => countStatuses(recentProdOrders), [recentProdOrders]);

  const inventoryChartData = useMemo(() => {
    return inventoryData
      .map((inv) => {
        const qty = Number(inv['Qty On Hand'] ?? inv['Quantity On Hand'] ?? 0);
        const itemRef = inv['Item'];
        const itemId = Array.isArray(itemRef) ? itemRef[0] : itemRef;
        const itemName = (itemId && itemMap[itemId]) || inv['Item Name'] || 'Unknown';
        const shortName = itemName.length > 14 ? itemName.slice(0, 12) + '..' : itemName;
        return { name: shortName, fullName: itemName, qty };
      })
      .filter((d) => d.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [inventoryData, itemMap]);

  // Compute real stats
  const totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);
  const lowStockCount = useMemo(() =>
    inventoryData.filter(inv => {
      const qty = Number(inv['Qty On Hand'] ?? 0);
      const reserved = Number(inv['Qty Reserved'] ?? 0);
      return (qty - reserved) <= 0 && qty > 0;
    }).length
  , [inventoryData]);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Command Center</h1>
          <p className="page-subtitle">
            Enterprise MRP Overview &mdash; {totalRecords.toLocaleString()} total records across all modules
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

      {/* KPI Cards (real data only) */}
      <div className="kpi-grid">
        {KPI_CARDS.map((card) => {
          const count = stats[card.key] ?? 0;
          return (
            <Link key={card.key} href={card.href} className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="kpi-label">{card.label}</div>
              <div className="kpi-value" style={{ marginTop: 6, color: card.color }}>{count.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                View all &rarr;
              </div>
            </Link>
          );
        })}
      </div>

      {/* Extra KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Inventory Records</div>
          <div className="kpi-value" style={{ marginTop: 6, color: '#06b6d4' }}>{(stats['Inventory'] ?? inventoryData.length).toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Suppliers</div>
          <div className="kpi-value" style={{ marginTop: 6, color: '#ec4899' }}>{(stats['Suppliers'] ?? 0).toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Customers</div>
          <div className="kpi-value" style={{ marginTop: 6, color: '#14b8a6' }}>{(stats['Customers'] ?? 0).toLocaleString()}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Low Stock Alerts
            {lowStockCount > 0 && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 6px #ef4444' }} />
            )}
          </div>
          <div className="kpi-value" style={{ marginTop: 6, color: lowStockCount > 0 ? '#ef4444' : '#10b981' }}>{lowStockCount}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="dashboard-grid" style={{ marginBottom: 16 }}>
        {/* Pie: Status Distribution */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Production Status Distribution
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Current production order breakdown
          </p>
          {statusData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No production orders</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" stroke="none">
                  {statusData.map((entry, idx) => (
                    <Cell key={entry.name} fill={PIE_COLORS[entry.name] || PIE_FALLBACK_COLORS[idx % PIE_FALLBACK_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value: string) => (
                  <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>{value}</span>
                )} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar: Inventory by Item */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Inventory by Item
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Top items by quantity on hand
          </p>
          {inventoryChartData.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No inventory data</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={inventoryChartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval={0} angle={-35} textAnchor="end" height={50} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                <Bar dataKey="qty" name="Qty On Hand" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  {inventoryChartData.map((_, idx) => (
                    <Cell key={idx} fill={idx === 0 ? '#6366f1' : idx === 1 ? '#818cf8' : '#4f46e5'} fillOpacity={1 - idx * 0.06} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Activity Tables */}
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

      <div className="dashboard-grid" style={{ marginBottom: 16 }}>
        <RecentTable
          title="Recent Purchase Orders"
          data={recentPurchaseOrders}
          href="/purchase-orders"
          columns={[
            { key: 'PO Number', label: 'PO Number' },
            { key: 'Order Date', label: 'Order Date', type: 'date' },
            { key: 'Status', label: 'Status', type: 'status' },
          ]}
        />

        {/* Quick Actions */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }}>
            Quick Actions
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.href} href={action.href} className="quick-action-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={action.icon} />
                </svg>
                {action.label}
              </Link>
            ))}
          </div>
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

function RecentTable({ title, data, href, columns }: { title: string; data: any[]; href: string; columns: ColumnDef[] }) {
  return (
    <div className="table-container">
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
        <Link href={href} className="section-link">View all &rarr;</Link>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => <th key={col.key}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="empty-state" style={{ padding: 24 }}>No records yet</div>
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map((col) => {
                  if (col.type === 'status') return <td key={col.key}><StatusBadge value={row[col.key]} /></td>;
                  if (col.type === 'date') {
                    const raw = row[col.key];
                    return <td key={col.key} style={{ color: 'var(--text-muted)', fontSize: 13 }}>{raw ? new Date(raw).toLocaleDateString() : '\u2014'}</td>;
                  }
                  return <td key={col.key} style={{ fontWeight: 600, color: 'var(--text)' }}>{row[col.key] || '\u2014'}</td>;
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
