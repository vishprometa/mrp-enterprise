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

/* ===================================================================
   Types
   =================================================================== */

interface Props {
  stats: Record<string, number>;
  items: any[];
  inventory: any[];
  salesOrders: any[];
  purchaseOrders: any[];
  productionOrders: any[];
  soLines: any[];
  poLines: any[];
  qualityInspections: any[];
  suppliers: any[];
  capacityPlans: any[];
  demandForecasts: any[];
}

/* ===================================================================
   Constants
   =================================================================== */

const COLORS = ['#6366f1', '#f97316', '#10b981', '#06b6d4', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

const DARK_TOOLTIP_STYLE = {
  background: '#1a2332',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '8px 12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
};

const STATUS_COLORS: Record<string, string> = {
  Active: '#10b981',
  Planned: '#f59e0b',
  'In Progress': '#3b82f6',
  'In Production': '#3b82f6',
  Running: '#3b82f6',
  Cancelled: '#ef4444',
  Completed: '#6366f1',
  Draft: '#64748b',
  Released: '#06b6d4',
  Submitted: '#06b6d4',
  Confirmed: '#06b6d4',
  Shipped: '#14b8a6',
  Delivered: '#10b981',
  Received: '#10b981',
  Approved: '#10b981',
  Pending: '#f59e0b',
  Closed: '#64748b',
};

const QUICK_ACTIONS = [
  { href: '/mrp', label: 'Run MRP Simulation', icon: 'M5 3l14 9-14 9V3z', color: '#6366f1' },
  { href: '/items', label: 'Manage Items', icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z', color: '#f97316' },
  { href: '/bom', label: 'Bill of Materials', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', color: '#10b981' },
  { href: '/inventory', label: 'Check Inventory', icon: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16', color: '#06b6d4' },
  { href: '/bom-explosion', label: 'BOM Explosion', icon: 'M22 12l-4 0-3 9-6-18-3 9-4 0', color: '#f59e0b' },
  { href: '/production-orders', label: 'Production Orders', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', color: '#a855f7' },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', color: '#ec4899' },
  { href: '/sales-orders', label: 'Sales Orders', icon: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2', color: '#14b8a6' },
];

/* ===================================================================
   Helpers
   =================================================================== */

function getStatus(row: any): string {
  const v = row?.Status ?? row?.status;
  return Array.isArray(v) ? v[0] : String(v ?? 'Unknown');
}

function getNumeric(row: any, ...keys: string[]): number {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && v !== '') return Number(v) || 0;
  }
  return 0;
}

function resolveRef(val: any): string | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] : String(val);
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function countByStatus(rows: any[]): { name: string; value: number }[] {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const s = getStatus(r);
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/* ===================================================================
   Tooltip Components
   =================================================================== */

function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={DARK_TOOLTIP_STYLE}>
      {label && <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</div>}
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
    <div style={DARK_TOOLTIP_STYLE}>
      <div style={{ fontSize: 13, fontWeight: 600, color: entry.payload?.fill || '#f1f5f9' }}>
        {entry.name}: {entry.value}
      </div>
    </div>
  );
}

/* ===================================================================
   Dashboard Component
   =================================================================== */

export function DashboardClient({
  stats,
  items,
  inventory,
  salesOrders,
  purchaseOrders,
  productionOrders,
  soLines,
  poLines,
  qualityInspections,
  suppliers,
  capacityPlans,
  demandForecasts,
}: Props) {

  // --- Item Map (id -> item row) ---
  const itemMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const item of items) {
      if (item.id) map[item.id] = item;
    }
    return map;
  }, [items]);

  // --- Executive KPIs ---
  const totalItems = stats['Items'] ?? items.length;
  const activePO = purchaseOrders.length;
  const activeSO = salesOrders.length;
  const activeProd = productionOrders.length;
  const activeOrders = activePO + activeSO + activeProd;

  const inventoryValue = useMemo(() => {
    let total = 0;
    for (const inv of inventory) {
      const qty = getNumeric(inv, 'Qty On Hand', 'Quantity On Hand');
      const itemRef = resolveRef(inv['Item']);
      const item = itemRef ? itemMap[itemRef] : null;
      const cost = item ? getNumeric(item, 'Standard Cost', 'Unit Cost', 'Cost') : 0;
      total += qty * cost;
    }
    return total;
  }, [inventory, itemMap]);

  const qualityScore = useMemo(() => {
    if (!qualityInspections.length) return null;
    let sum = 0;
    let count = 0;
    for (const qi of qualityInspections) {
      const score = getNumeric(qi, 'Inspection Score', 'Score', 'Rating', 'Overall Score');
      if (score > 0) { sum += score; count++; }
    }
    return count > 0 ? sum / count : null;
  }, [qualityInspections]);

  const productionEfficiency = useMemo(() => {
    if (!productionOrders.length) return null;
    const completed = productionOrders.filter(o => {
      const s = getStatus(o);
      return s === 'Completed' || s === 'Closed';
    }).length;
    return (completed / productionOrders.length) * 100;
  }, [productionOrders]);

  // --- ABC Classification (Pareto) ---
  const abcAnalysis = useMemo(() => {
    const itemValues: { id: string; name: string; value: number }[] = [];
    for (const item of items) {
      const cost = getNumeric(item, 'Standard Cost', 'Unit Cost', 'Cost');
      // Cross-reference demand forecasts for estimated demand, fallback to 1
      const demandMatch = demandForecasts.find(df => {
        const ref = resolveRef(df['Item']);
        return ref === item.id;
      });
      const demand = demandMatch ? getNumeric(demandMatch, 'Forecast Quantity', 'Forecasted Qty', 'Quantity') : 1;
      const totalValue = cost * (demand || 1);
      itemValues.push({
        id: item.id,
        name: item['Item Name'] || item['Item Code'] || item['Name'] || 'Unknown',
        value: totalValue,
      });
    }
    itemValues.sort((a, b) => b.value - a.value);
    const totalValue = itemValues.reduce((s, i) => s + i.value, 0);
    if (totalValue === 0) return { A: [], B: [], C: [], totalValue: 0 };

    let cumulative = 0;
    const A: typeof itemValues = [];
    const B: typeof itemValues = [];
    const C: typeof itemValues = [];
    for (const item of itemValues) {
      cumulative += item.value;
      const pct = cumulative / totalValue;
      if (pct <= 0.80) A.push(item);
      else if (pct <= 0.95) B.push(item);
      else C.push(item);
    }
    return { A, B, C, totalValue };
  }, [items, demandForecasts]);

  // --- Stockout Risk ---
  const stockoutRisk = useMemo(() => {
    const atRisk: { sku: string; qty: number; reorder: number }[] = [];
    for (const inv of inventory) {
      const qty = getNumeric(inv, 'Qty On Hand', 'Quantity On Hand');
      const reorderPoint = getNumeric(inv, 'Reorder Point', 'Min Stock', 'Safety Stock');
      if (reorderPoint > 0 && qty < reorderPoint) {
        const itemRef = resolveRef(inv['Item']);
        const item = itemRef ? itemMap[itemRef] : null;
        const sku = item?.['Item Code'] || item?.['SKU'] || item?.['Item Name'] || 'Unknown';
        atRisk.push({ sku, qty, reorder: reorderPoint });
      }
    }
    atRisk.sort((a, b) => (a.qty / a.reorder) - (b.qty / b.reorder));
    return atRisk;
  }, [inventory, itemMap]);

  // --- Order Fulfillment Rate ---
  const fulfillmentRate = useMemo(() => {
    if (!soLines.length) return null;
    const fulfilled = soLines.filter(line => {
      const s = getStatus(line);
      return s === 'Shipped' || s === 'Delivered' || s === 'Completed' || s === 'Closed';
    }).length;
    return (fulfilled / soLines.length) * 100;
  }, [soLines]);

  // --- Charts: Orders by Status (stacked) ---
  const ordersByStatusChart = useMemo(() => {
    const allStatuses = new Set<string>();
    const soCounts: Record<string, number> = {};
    const poCounts: Record<string, number> = {};
    const prodCounts: Record<string, number> = {};

    for (const o of salesOrders) { const s = getStatus(o); allStatuses.add(s); soCounts[s] = (soCounts[s] || 0) + 1; }
    for (const o of purchaseOrders) { const s = getStatus(o); allStatuses.add(s); poCounts[s] = (poCounts[s] || 0) + 1; }
    for (const o of productionOrders) { const s = getStatus(o); allStatuses.add(s); prodCounts[s] = (prodCounts[s] || 0) + 1; }

    const statuses = Array.from(allStatuses).sort();
    return statuses.map(s => ({
      status: s,
      'Sales Orders': soCounts[s] || 0,
      'Purchase Orders': poCounts[s] || 0,
      'Production': prodCounts[s] || 0,
    }));
  }, [salesOrders, purchaseOrders, productionOrders]);

  // --- Charts: Inventory by Item Type ---
  const inventoryByType = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    for (const item of items) {
      const type = Array.isArray(item['Item Type']) ? item['Item Type'][0] : String(item['Item Type'] ?? item['Type'] ?? 'Uncategorized');
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    return Object.entries(typeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  // --- Recent tables ---
  const recentProd = productionOrders.slice(0, 5);
  const recentPO = purchaseOrders.slice(0, 5);

  // --- Quality color ---
  const qualityColor = qualityScore === null ? '#64748b' : qualityScore >= 90 ? '#10b981' : qualityScore >= 70 ? '#f59e0b' : '#ef4444';
  const efficiencyColor = productionEfficiency === null ? '#64748b' : productionEfficiency >= 80 ? '#10b981' : productionEfficiency >= 50 ? '#f59e0b' : '#ef4444';
  const fulfillmentColor = fulfillmentRate === null ? '#64748b' : fulfillmentRate >= 90 ? '#10b981' : fulfillmentRate >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      {/* Header */}
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

      {/* ============================================================
         Section 1: Executive KPIs (5 columns)
         ============================================================ */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {/* Total Items */}
        <Link href="/items" className="kpi-card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="kpi-value" style={{ color: '#6366f1' }}>{totalItems.toLocaleString()}</div>
          <div className="kpi-label">Total Items</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>View all &rarr;</div>
        </Link>

        {/* Active Orders (combined) */}
        <div className="kpi-card" style={{ position: 'relative' }}>
          <div className="kpi-value" style={{ color: '#f97316' }}>{activeOrders.toLocaleString()}</div>
          <div className="kpi-label">Active Orders</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, display: 'flex', gap: 8 }}>
            <span>PO: {activePO}</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>SO: {activeSO}</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>Prod: {activeProd}</span>
          </div>
        </div>

        {/* Inventory Value */}
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: '#10b981' }}>{formatCurrency(inventoryValue)}</div>
          <div className="kpi-label">Inventory Value</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
            {inventory.length} SKUs tracked
          </div>
        </div>

        {/* Quality Score */}
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: qualityColor }}>
            {qualityScore !== null ? qualityScore.toFixed(1) + '%' : '--'}
          </div>
          <div className="kpi-label">Quality Score</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
            {qualityInspections.length} inspections
          </div>
        </div>

        {/* Production Efficiency */}
        <div className="kpi-card">
          <div className="kpi-value" style={{ color: efficiencyColor }}>
            {productionEfficiency !== null ? productionEfficiency.toFixed(1) + '%' : '--'}
          </div>
          <div className="kpi-label">Production Efficiency</div>
          <div style={{ marginTop: 8 }}>
            <div className="progress-bar">
              <div
                className={`progress-bar-fill ${productionEfficiency !== null && productionEfficiency >= 80 ? 'green' : productionEfficiency !== null && productionEfficiency >= 50 ? 'yellow' : 'red'}`}
                style={{ width: `${productionEfficiency ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
         Section 2: Smart Insights (computed frontend-only)
         ============================================================ */}
      <div style={{ marginBottom: 24 }}>
        <div className="section-header" style={{ padding: '0 0 12px' }}>
          <h3 className="section-title" style={{ fontSize: 15 }}>Smart Insights</h3>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Computed in real-time</span>
        </div>

        <div className="grid-3">
          {/* Card 1: ABC Classification */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>ABC Classification</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Pareto analysis by value</div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20V10M18 20V4M6 20v-4" />
                </svg>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, background: 'rgba(99,102,241,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1' }}>{abcAnalysis.A.length}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>A Items</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(249,115,22,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#f97316' }}>{abcAnalysis.B.length}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.04em' }}>B Items</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(100,116,139,0.08)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#94a3b8' }}>{abcAnalysis.C.length}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>C Items</div>
              </div>
            </div>

            {/* Stacked proportion bar */}
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 8 }}>
              {abcAnalysis.totalValue > 0 && (
                <>
                  <div style={{ width: `${(abcAnalysis.A.reduce((s, i) => s + i.value, 0) / abcAnalysis.totalValue) * 100}%`, background: 'linear-gradient(90deg, #4f46e5, #6366f1)' }} />
                  <div style={{ width: `${(abcAnalysis.B.reduce((s, i) => s + i.value, 0) / abcAnalysis.totalValue) * 100}%`, background: 'linear-gradient(90deg, #ea580c, #f97316)' }} />
                  <div style={{ width: `${(abcAnalysis.C.reduce((s, i) => s + i.value, 0) / abcAnalysis.totalValue) * 100}%`, background: 'linear-gradient(90deg, #64748b, #94a3b8)' }} />
                </>
              )}
              {abcAnalysis.totalValue === 0 && (
                <div style={{ width: '100%', background: 'var(--bg-elevated)' }} />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
              <span>80% value</span>
              <span>15% value</span>
              <span>5% value</span>
            </div>
          </div>

          {/* Card 2: Stockout Risk Score */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Stockout Risk</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Items below reorder point</div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: stockoutRisk.length > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stockoutRisk.length > 0 ? '#ef4444' : '#10b981'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
                </svg>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', color: stockoutRisk.length > 0 ? '#ef4444' : '#10b981' }}>
                {stockoutRisk.length}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                {stockoutRisk.length === 1 ? 'item at risk' : 'items at risk'}
              </span>
            </div>

            {stockoutRisk.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {stockoutRisk.slice(0, 3).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.1)' }}>
                    <span className="mono-text" style={{ fontSize: 11, background: 'transparent', padding: 0 }}>{item.sku}</span>
                    <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                      {item.qty} / {item.reorder}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                All items above reorder levels
              </div>
            )}
          </div>

          {/* Card 3: Order Fulfillment Rate */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Order Fulfillment</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>SO lines shipped or delivered</div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(6,182,212,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.03em', color: fulfillmentColor }}>
                {fulfillmentRate !== null ? fulfillmentRate.toFixed(1) : '--'}
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: fulfillmentColor }}>%</span>
            </div>

            <div className="progress-bar lg" style={{ marginBottom: 8 }}>
              <div
                className={`progress-bar-fill ${fulfillmentRate !== null && fulfillmentRate >= 90 ? 'green' : fulfillmentRate !== null && fulfillmentRate >= 70 ? 'yellow' : 'red'}`}
                style={{ width: `${fulfillmentRate ?? 0}%` }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)' }}>
              <span>
                {soLines.filter(l => { const s = getStatus(l); return s === 'Shipped' || s === 'Delivered' || s === 'Completed' || s === 'Closed'; }).length} fulfilled
              </span>
              <span>{soLines.length} total lines</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
         Section 3: Charts (grid-2)
         ============================================================ */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Bar Chart: Orders by Status (stacked) */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Orders by Status
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            PO, SO, and Production orders by current status
          </p>
          {ordersByStatusChart.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No orders data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ordersByStatusChart} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <XAxis
                  dataKey="status"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                  allowDecimals={false}
                />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Legend
                  verticalAlign="top"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>{value}</span>
                  )}
                />
                <Bar dataKey="Sales Orders" stackId="orders" fill="#6366f1" radius={[0, 0, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Purchase Orders" stackId="orders" fill="#f97316" radius={[0, 0, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Production" stackId="orders" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart: Inventory by Item Type */}
        <div className="chart-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Inventory by Item Type
          </h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Distribution of items across categories
          </p>
          {inventoryByType.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>No item data</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={inventoryByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {inventoryByType.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
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
      </div>

      {/* ============================================================
         Section 4: Activity Streams (grid-2)
         ============================================================ */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <RecentTable
          title="Recent Production Orders"
          data={recentProd}
          href="/production-orders"
          columns={[
            { key: 'WO Number', label: 'WO Number' },
            { key: 'Start Date', label: 'Start Date', type: 'date' },
            { key: 'End Date', label: 'End Date', type: 'date' },
            { key: 'Status', label: 'Status', type: 'status' },
          ]}
        />
        <RecentTable
          title="Recent Purchase Orders"
          data={recentPO}
          href="/purchase-orders"
          columns={[
            { key: 'PO Number', label: 'PO Number' },
            { key: 'Order Date', label: 'Order Date', type: 'date' },
            { key: 'Status', label: 'Status', type: 'status' },
          ]}
        />
      </div>

      {/* ============================================================
         Section 5: Quick Actions
         ============================================================ */}
      <div style={{ marginBottom: 24 }}>
        <div className="section-header" style={{ padding: '0 0 12px' }}>
          <h3 className="section-title" style={{ fontSize: 15 }}>Quick Actions</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.href} href={action.href} className="quick-action-btn" style={{ justifyContent: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `${action.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={action.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={action.icon} />
                </svg>
              </div>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   Recent Table Sub-component
   =================================================================== */

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
