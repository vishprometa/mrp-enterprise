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
  { key: 'Items', label: 'Total Items', icon: '\u{1F4E6}', href: '/items', color: '#6366f1' },
  { key: 'Purchase Orders', label: 'Purchase Orders', icon: '\u{1F6D2}', href: '/purchase-orders', color: '#8b5cf6' },
  { key: 'Sales Orders', label: 'Sales Orders', icon: '\u{1F9FE}', href: '/sales-orders', color: '#10b981' },
  { key: 'Production Orders', label: 'Production Orders', icon: '\u{1F528}', href: '/production-orders', color: '#f59e0b' },
  { key: 'Inventory', label: 'Inventory Records', icon: '\u{1F4CB}', href: '/inventory', color: '#06b6d4' },
  { key: 'Suppliers', label: 'Suppliers', icon: '\u{1F69B}', href: '/suppliers', color: '#ec4899' },
  { key: 'Customers', label: 'Customers', icon: '\u{1F465}', href: '/customers', color: '#84cc16' },
  { key: 'Quality Inspections', label: 'Quality Checks', icon: '\u{2705}', href: '/inspections', color: '#f97316' },
];

export function DashboardClient({ stats, recentProdOrders, recentSalesOrders, recentPurchaseOrders }: Props) {
  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Enterprise Material Requirements Planning</p>
        </div>
        <Link href="/mrp" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Run MRP Simulation
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {STAT_CARDS.map((card) => (
          <Link key={card.key} href={card.href} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-value" style={{ color: card.color }}>{stats[card.key] ?? 0}</div>
                <div className="stat-label">{card.label}</div>
              </div>
              <span className="stat-icon">{card.icon}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Tables Grid */}
      <div className="dashboard-grid">
        <RecentTable
          title="Recent Production Orders"
          data={recentProdOrders}
          href="/production-orders"
          nameKey="WO Number"
          statusKey="Status"
          dateKey="Start Date"
        />
        <RecentTable
          title="Recent Sales Orders"
          data={recentSalesOrders}
          href="/sales-orders"
          nameKey="SO Number"
          statusKey="Status"
          dateKey="Order Date"
        />
        <RecentTable
          title="Recent Purchase Orders"
          data={recentPurchaseOrders}
          href="/purchase-orders"
          nameKey="PO Number"
          statusKey="Status"
          dateKey="Order Date"
        />
        <div className="card">
          <h3 className="section-title" style={{ marginBottom: 16 }}>Quick Actions</h3>
          <div className="quick-actions">
            <Link href="/mrp" className="quick-action-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Run MRP Simulation
            </Link>
            <Link href="/items" className="quick-action-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              Manage Items
            </Link>
            <Link href="/bom" className="quick-action-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Bill of Materials
            </Link>
            <Link href="/inventory" className="quick-action-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              Check Inventory
            </Link>
            <Link href="/forecasts" className="quick-action-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Demand Forecasts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentTable({ title, data, href, nameKey, statusKey, dateKey }: { title: string; data: any[]; href: string; nameKey: string; statusKey: string; dateKey: string }) {
  return (
    <div className="table-container">
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
        <Link href={href} className="section-link">View all &rarr;</Link>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>ID</th><th>Date</th><th>Status</th></tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={3}>
                <div className="empty-state" style={{ padding: 24 }}>No records yet</div>
              </td>
            </tr>
          ) : data.map((row, i) => (
            <tr key={row.id || i}>
              <td style={{ fontWeight: 600, color: 'var(--text)' }}>{row[nameKey] || '\u2014'}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{row[dateKey] ? new Date(row[dateKey]).toLocaleDateString() : '\u2014'}</td>
              <td><StatusBadge value={row[statusKey]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
