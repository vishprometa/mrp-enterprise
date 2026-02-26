'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/StatusBadge';

interface Props {
  stats: Record<string, number>;
  recentProdOrders: any[];
  recentSalesOrders: any[];
  recentPurchaseOrders: any[];
}

const STAT_CARDS = [
  { key: 'Items', label: 'Total Items', icon: '📦', href: '/items', color: '#3b82f6' },
  { key: 'Purchase Orders', label: 'Purchase Orders', icon: '🛒', href: '/purchase-orders', color: '#8b5cf6' },
  { key: 'Sales Orders', label: 'Sales Orders', icon: '🧾', href: '/sales-orders', color: '#10b981' },
  { key: 'Production Orders', label: 'Production Orders', icon: '🔨', href: '/production-orders', color: '#f59e0b' },
  { key: 'Inventory', label: 'Inventory Records', icon: '📦', href: '/inventory', color: '#06b6d4' },
  { key: 'Suppliers', label: 'Suppliers', icon: '🚛', href: '/suppliers', color: '#ec4899' },
  { key: 'Customers', label: 'Customers', icon: '👥', href: '/customers', color: '#84cc16' },
  { key: 'Quality Inspections', label: 'Quality Inspections', icon: '✅', href: '/inspections', color: '#f97316' },
];

export function DashboardClient({ stats, recentProdOrders, recentSalesOrders, recentPurchaseOrders }: Props) {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Dashboard</h1>
        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>Enterprise Material Requirements Planning</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {STAT_CARDS.map((card) => (
          <Link key={card.key} href={card.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ transition: 'box-shadow 0.2s', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="card-stat">
                  <span className="label">{card.label}</span>
                  <span className="value" style={{ color: card.color }}>{stats[card.key] ?? 0}</span>
                </div>
                <span style={{ fontSize: 32 }}>{card.icon}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <RecentTable title="Recent Production Orders" data={recentProdOrders} href="/production-orders" nameKey="PO Number" statusKey="Status" dateKey="Planned Start" />
        <RecentTable title="Recent Sales Orders" data={recentSalesOrders} href="/sales-orders" nameKey="SO Number" statusKey="Status" dateKey="Order Date" />
        <RecentTable title="Recent Purchase Orders" data={recentPurchaseOrders} href="/purchase-orders" nameKey="PO Number" statusKey="Status" dateKey="Order Date" />
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/mrp" className="btn btn-primary" style={{ textDecoration: 'none', justifyContent: 'center' }}>Run MRP Simulation</Link>
            <Link href="/items" className="btn btn-secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>Manage Items</Link>
            <Link href="/bom" className="btn btn-secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>Bill of Materials</Link>
            <Link href="/inventory" className="btn btn-secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>Check Inventory</Link>
            <Link href="/forecasts" className="btn btn-secondary" style={{ textDecoration: 'none', justifyContent: 'center' }}>Demand Forecasts</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentTable({ title, data, href, nameKey, statusKey, dateKey }: { title: string; data: any[]; href: string; nameKey: string; statusKey: string; dateKey: string }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 12px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h3>
        <Link href={href} style={{ fontSize: 13, color: '#3b82f6', textDecoration: 'none' }}>View all</Link>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>ID</th><th>Date</th><th>Status</th></tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No records yet</td></tr>
          ) : data.map((row, i) => (
            <tr key={row.id || i}>
              <td style={{ fontWeight: 500 }}>{row[nameKey] || '—'}</td>
              <td style={{ color: '#64748b', fontSize: 13 }}>{row[dateKey] ? new Date(row[dateKey]).toLocaleDateString() : '—'}</td>
              <td><StatusBadge value={row[statusKey]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
