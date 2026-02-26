'use client';

import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
  LineChart, Line,
  ComposedChart,
} from 'recharts';

/* ================================================================
   Types
   ================================================================ */

interface Props {
  items: Record<string, any>[];
  suppliers: Record<string, any>[];
  customers: Record<string, any>[];
  inventory: Record<string, any>[];
  prodOrders: Record<string, any>[];
  purchaseOrders: Record<string, any>[];
  salesOrders: Record<string, any>[];
  salesOrderLines: Record<string, any>[];
  purchaseOrderLines: Record<string, any>[];
  qualityInspections: Record<string, any>[];
  capacityPlans: Record<string, any>[];
  costCenters: Record<string, any>[];
  demandForecasts: Record<string, any>[];
  billOfMaterials: Record<string, any>[];
  bomLines: Record<string, any>[];
}

/* ================================================================
   Constants
   ================================================================ */

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#a855f7'];
const GRID_STROKE = 'rgba(255,255,255,0.04)';
const AXIS_TICK = { fill: '#64748b', fontSize: 11 };

/* ================================================================
   Helpers
   ================================================================ */

function num(v: any): number {
  return Number(v ?? 0);
}

function sel(v: any): string {
  return Array.isArray(v) ? v[0] : String(v ?? '');
}

function fmtMonth(d: string): string {
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  } catch { return ''; }
}

function fmtCurrency(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function fmtNumber(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

function pct(v: number, total: number): number {
  return total > 0 ? Math.round((v / total) * 100) : 0;
}

/* ================================================================
   Custom Tooltip
   ================================================================ */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
      {label && <p style={{ color: '#94a3b8', margin: '0 0 4px', fontSize: 12 }}>{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: '#f1f5f9', margin: '2px 0', fontSize: 12 }}>
          <span style={{ color: entry.color || entry.fill, marginRight: 6 }}>{'\u25CF'}</span>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

/* ================================================================
   Gauge Component
   ================================================================ */

function GaugeChart({ value, size = 180, strokeWidth = 14 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // half circle
  const progress = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (progress / 100) * circumference;
  const color = progress >= 75 ? '#10b981' : progress >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
      {/* Background arc */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Progress arc */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      {/* Score text */}
      <text x={size / 2} y={size / 2 - 5} textAnchor="middle" fill={color} fontSize="32" fontWeight="800">{progress}</text>
      <text x={size / 2} y={size / 2 + 18} textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="500">/ 100</text>
    </svg>
  );
}

/* ================================================================
   Component
   ================================================================ */

export function AnalyticsClient({
  items, suppliers, customers, inventory, prodOrders, purchaseOrders,
  salesOrders, salesOrderLines, purchaseOrderLines, qualityInspections,
  capacityPlans, costCenters, demandForecasts, billOfMaterials, bomLines,
}: Props) {

  /* ── 1. Executive KPIs ──────────────────────── */
  const kpis = useMemo(() => {
    const totalRevenue = salesOrders.reduce((s, r) => s + num(r['Total Amount']), 0);
    const totalSpend = purchaseOrders.reduce((s, r) => s + num(r['Total Amount']), 0);
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalSpend) / totalRevenue) * 100 : 0;

    const inventoryValue = inventory.reduce((s, r) => {
      const qty = num(r['Qty On Hand']);
      const cost = num(r['Unit Cost'] || r['Cost']);
      return s + qty * cost;
    }, 0);

    // Production efficiency: completed / total
    const totalProd = prodOrders.length;
    const completedProd = prodOrders.filter(r => {
      const s = sel(r['Status']);
      return s === 'Completed' || s === 'Delivered' || s === 'Shipped';
    }).length;
    const prodEfficiency = totalProd > 0 ? (completedProd / totalProd) * 100 : 0;

    // Quality score: avg of Overall Score
    const qualScores = qualityInspections.map(r => num(r['Overall Score'])).filter(v => v > 0);
    const qualityScore = qualScores.length > 0 ? qualScores.reduce((a, b) => a + b, 0) / qualScores.length : 0;

    // Capacity utilization: avg
    const capUtils = capacityPlans.map(r => num(r['Utilization Pct'])).filter(v => v > 0);
    const capacityUtil = capUtils.length > 0 ? capUtils.reduce((a, b) => a + b, 0) / capUtils.length : 0;

    // Forecast accuracy
    const forecastByMonth: Record<string, number> = {};
    for (const r of demandForecasts) {
      const d = r['Forecast Date'];
      if (!d) continue;
      const m = fmtMonth(String(d));
      if (m) forecastByMonth[m] = (forecastByMonth[m] || 0) + num(r['Quantity']);
    }
    const actualByMonth: Record<string, number> = {};
    for (const r of salesOrders) {
      const d = r['Order Date'];
      if (!d) continue;
      const m = fmtMonth(String(d));
      if (m) actualByMonth[m] = (actualByMonth[m] || 0) + num(r['Total Amount']);
    }
    let accSum = 0;
    let accCount = 0;
    for (const m of Object.keys(forecastByMonth)) {
      if (actualByMonth[m]) {
        const fc = forecastByMonth[m];
        const ac = actualByMonth[m];
        accSum += Math.max(0, 1 - Math.abs(fc - ac) / Math.max(fc, 1));
        accCount++;
      }
    }
    const forecastAccuracy = accCount > 0 ? (accSum / accCount) * 100 : 0;

    return { totalRevenue, totalSpend, grossMargin, inventoryValue, prodEfficiency, qualityScore, capacityUtil, forecastAccuracy };
  }, [salesOrders, purchaseOrders, inventory, prodOrders, qualityInspections, capacityPlans, demandForecasts]);

  /* ── 2. Revenue vs Spend Trend ──────────────── */
  const revSpendTrend = useMemo(() => {
    const months: Record<string, { revenue: number; spend: number }> = {};
    for (const r of salesOrders) {
      const d = r['Order Date'];
      if (!d) continue;
      const m = fmtMonth(String(d));
      if (!m) continue;
      if (!months[m]) months[m] = { revenue: 0, spend: 0 };
      months[m].revenue += num(r['Total Amount']);
    }
    for (const r of purchaseOrders) {
      const d = r['Order Date'];
      if (!d) continue;
      const m = fmtMonth(String(d));
      if (!m) continue;
      if (!months[m]) months[m] = { revenue: 0, spend: 0 };
      months[m].spend += num(r['Total Amount']);
    }
    return Object.entries(months)
      .map(([month, vals]) => ({ month, ...vals, margin: vals.revenue - vals.spend, sortKey: new Date(month).getTime() }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [salesOrders, purchaseOrders]);

  /* ── 3. Supply Chain Health Score ────────────── */
  const healthScore = useMemo(() => {
    // Inventory turnover: sales / avg inventory value (0-25 points)
    const totalSales = salesOrders.reduce((s, r) => s + num(r['Total Amount']), 0);
    const invValue = kpis.inventoryValue || 1;
    const turnoverRatio = totalSales / invValue;
    const turnoverScore = Math.min(25, Math.round(turnoverRatio * 5));

    // On-time delivery: completed+delivered / total orders (0-25 points)
    const allOrders = [...salesOrders, ...purchaseOrders];
    const onTimeStatuses = ['Completed', 'Delivered', 'Shipped', 'Received'];
    const onTimeCount = allOrders.filter(r => onTimeStatuses.includes(sel(r['Status']))).length;
    const deliveryRate = allOrders.length > 0 ? onTimeCount / allOrders.length : 0;
    const deliveryScore = Math.round(deliveryRate * 25);

    // Quality pass rate (0-25 points)
    const passed = qualityInspections.filter(r => {
      const result = sel(r['Result'] || r['Status']);
      return result === 'Passed' || result === 'Pass';
    }).length;
    const qualRate = qualityInspections.length > 0 ? passed / qualityInspections.length : 0;
    const qualScore = Math.round(qualRate * 25);

    // Capacity utilization balance: penalize both under and over (0-25 points)
    const avgUtil = kpis.capacityUtil;
    const utilBalance = avgUtil > 0 ? Math.max(0, 25 - Math.abs(avgUtil - 75) * 0.5) : 0;
    const utilScore = Math.round(utilBalance);

    const total = Math.min(100, turnoverScore + deliveryScore + qualScore + utilScore);

    return {
      total,
      breakdown: [
        { label: 'Inventory Turnover', score: turnoverScore, max: 25, color: '#6366f1' },
        { label: 'Delivery Rate', score: deliveryScore, max: 25, color: '#10b981' },
        { label: 'Quality Pass Rate', score: qualScore, max: 25, color: '#06b6d4' },
        { label: 'Capacity Balance', score: utilScore, max: 25, color: '#f59e0b' },
      ],
    };
  }, [salesOrders, purchaseOrders, qualityInspections, kpis]);

  /* ── 4. Top Items Analysis ──────────────────── */
  const topItems = useMemo(() => {
    const itemIdToName = new Map(items.map(i => [i.id, i['Item Name'] || i['Name'] || 'Unknown']));

    // Revenue by item from SO lines
    const revenueByItem: Record<string, number> = {};
    for (const line of salesOrderLines) {
      const itemRef = line['Item'] || line['Item Name'] || '';
      const name = typeof itemRef === 'string' ? (itemIdToName.get(itemRef) || itemRef) : String(itemRef);
      revenueByItem[name] = (revenueByItem[name] || 0) + num(line['Line Total'] || line['Total'] || line['Amount']);
    }

    // Cost by item from PO lines
    const costByItem: Record<string, number> = {};
    for (const line of purchaseOrderLines) {
      const itemRef = line['Item'] || line['Item Name'] || '';
      const name = typeof itemRef === 'string' ? (itemIdToName.get(itemRef) || itemRef) : String(itemRef);
      costByItem[name] = (costByItem[name] || 0) + num(line['Line Total'] || line['Total'] || line['Amount']);
    }

    // Inventory value by item
    const invByItem: Record<string, number> = {};
    for (const r of inventory) {
      const itemRef = r['Item'] || r['Item Name'] || '';
      const name = typeof itemRef === 'string' ? (itemIdToName.get(itemRef) || itemRef) : String(itemRef);
      invByItem[name] = (invByItem[name] || 0) + num(r['Qty On Hand']) * num(r['Unit Cost'] || r['Cost']);
    }

    const allItems = new Set([...Object.keys(revenueByItem), ...Object.keys(costByItem), ...Object.keys(invByItem)]);
    return [...allItems]
      .map(name => ({
        name: name.length > 20 ? name.substring(0, 18) + '...' : name,
        revenue: revenueByItem[name] || 0,
        cost: costByItem[name] || 0,
        inventoryValue: invByItem[name] || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [items, salesOrderLines, purchaseOrderLines, inventory]);

  /* ── 5. Supplier Performance Matrix ─────────── */
  const supplierPerf = useMemo(() => {
    const supplierIdToName = new Map(suppliers.map(s => [s.id, s['Supplier Name'] || s['Name'] || 'Unknown']));

    const perfMap: Record<string, { name: string; orderCount: number; totalSpend: number; deliveredCount: number }> = {};
    for (const po of purchaseOrders) {
      const supRef = po['Supplier'] || po['Supplier Name'] || '';
      const supId = typeof supRef === 'string' ? supRef : String(supRef);
      const name = supplierIdToName.get(supId) || supId;
      if (!name || name === 'Unknown' || name === 'undefined') continue;

      if (!perfMap[name]) perfMap[name] = { name, orderCount: 0, totalSpend: 0, deliveredCount: 0 };
      perfMap[name].orderCount++;
      perfMap[name].totalSpend += num(po['Total Amount']);
      const status = sel(po['Status']);
      if (['Completed', 'Delivered', 'Received'].includes(status)) perfMap[name].deliveredCount++;
    }

    return Object.values(perfMap)
      .map(s => ({
        ...s,
        name: s.name.length > 20 ? s.name.substring(0, 18) + '...' : s.name,
        avgOrderValue: s.orderCount > 0 ? Math.round(s.totalSpend / s.orderCount) : 0,
        deliveryRate: s.orderCount > 0 ? Math.round((s.deliveredCount / s.orderCount) * 100) : 0,
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 8);
  }, [suppliers, purchaseOrders]);

  /* ── 6. Production Pipeline ─────────────────── */
  const pipeline = useMemo(() => {
    const stages = ['Planned', 'In Progress', 'Completed', 'Shipped'];
    const stageMap: Record<string, string> = {
      'Planned': 'Planned', 'Draft': 'Planned', 'Pending': 'Planned',
      'In Progress': 'In Progress', 'In Production': 'In Progress', 'Running': 'In Progress', 'Released': 'In Progress',
      'Completed': 'Completed', 'Delivered': 'Completed',
      'Shipped': 'Shipped', 'Ready to Ship': 'Shipped',
    };
    const counts: Record<string, number> = { Planned: 0, 'In Progress': 0, Completed: 0, Shipped: 0 };
    for (const r of prodOrders) {
      const raw = sel(r['Status']);
      const mapped = stageMap[raw] || 'Planned';
      counts[mapped]++;
    }
    const stageColors = ['#6366f1', '#f59e0b', '#10b981', '#06b6d4'];
    const total = prodOrders.length || 1;
    return stages.map((stage, i) => ({
      stage,
      count: counts[stage],
      pct: pct(counts[stage], total),
      color: stageColors[i],
    }));
  }, [prodOrders]);

  /* ── 7. Cost Breakdown Waterfall ─────────────── */
  const costBreakdown = useMemo(() => {
    // Material costs from BOM lines
    const materialCost = bomLines.reduce((s, r) => s + num(r['Line Cost'] || r['Cost'] || r['Amount']), 0);

    // Labor from cost centers (labor-related)
    const laborCost = costCenters
      .filter(r => {
        const name = (r['Cost Center Name'] || r['Name'] || '').toLowerCase();
        return name.includes('labor') || name.includes('wages') || name.includes('workforce');
      })
      .reduce((s, r) => s + num(r['Actual Cost'] || r['Budget']), 0);

    // Overhead from other cost centers
    const overheadCost = costCenters
      .filter(r => {
        const name = (r['Cost Center Name'] || r['Name'] || '').toLowerCase();
        return !name.includes('labor') && !name.includes('wages') && !name.includes('workforce');
      })
      .reduce((s, r) => s + num(r['Actual Cost'] || r['Budget']), 0);

    // Scrap estimate from quality failures
    const failedInsp = qualityInspections.filter(r => {
      const result = sel(r['Result'] || r['Status']);
      return result === 'Failed' || result === 'Fail';
    }).length;
    const scrapEstimate = failedInsp * (materialCost > 0 ? materialCost / Math.max(bomLines.length, 1) : 500);

    return [
      { name: 'Material', value: Math.round(materialCost), color: '#6366f1' },
      { name: 'Labor', value: Math.round(laborCost), color: '#10b981' },
      { name: 'Overhead', value: Math.round(overheadCost), color: '#f59e0b' },
      { name: 'Scrap Loss', value: Math.round(scrapEstimate), color: '#ef4444' },
    ];
  }, [bomLines, costCenters, qualityInspections]);

  /* ── 8. Alerts & Recommendations ────────────── */
  const alerts = useMemo(() => {
    const result: { type: 'critical' | 'warning' | 'info'; title: string; description: string; icon: string }[] = [];

    // Low stock items
    const lowStock = inventory.filter(r => {
      const qty = num(r['Qty On Hand']);
      const reorder = num(r['Reorder Point'] || r['Reorder Level'] || r['Min Qty']);
      return reorder > 0 && qty <= reorder && qty >= 0;
    });
    if (lowStock.length > 0) {
      result.push({
        type: 'critical',
        title: `${lowStock.length} Item${lowStock.length > 1 ? 's' : ''} Below Reorder Point`,
        description: `Inventory levels critically low. Immediate replenishment needed to avoid stockouts.`,
        icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      });
    }

    // Overdue orders
    const now = Date.now();
    const overdueOrders = [...salesOrders, ...purchaseOrders].filter(r => {
      const status = sel(r['Status']);
      if (['Completed', 'Delivered', 'Received', 'Shipped', 'Cancelled'].includes(status)) return false;
      const expected = r['Expected Date'] || r['Delivery Date'] || r['Due Date'];
      if (!expected) return false;
      return new Date(expected).getTime() < now;
    });
    if (overdueOrders.length > 0) {
      result.push({
        type: 'warning',
        title: `${overdueOrders.length} Overdue Order${overdueOrders.length > 1 ? 's' : ''}`,
        description: `Orders past their expected delivery date require immediate attention.`,
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      });
    }

    // Quality failures
    const failures = qualityInspections.filter(r => {
      const result = sel(r['Result'] || r['Status']);
      return result === 'Failed' || result === 'Fail';
    });
    if (failures.length > 0) {
      result.push({
        type: 'warning',
        title: `${failures.length} Quality Inspection Failure${failures.length > 1 ? 's' : ''}`,
        description: `Failed inspections detected. Review quality control processes and affected batches.`,
        icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      });
    }

    // Capacity overloads
    const overloaded = capacityPlans.filter(r => num(r['Utilization Pct']) > 90);
    if (overloaded.length > 0) {
      result.push({
        type: 'info',
        title: `${overloaded.length} Capacity Overload${overloaded.length > 1 ? 's' : ''}`,
        description: `Work centers running above 90% utilization. Consider rebalancing or adding shifts.`,
        icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      });
    }

    // Positive: strong margin
    if (kpis.grossMargin > 30) {
      result.push({
        type: 'info',
        title: 'Healthy Gross Margin',
        description: `Gross margin at ${kpis.grossMargin.toFixed(1)}% indicates strong pricing and cost management.`,
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      });
    }

    return result;
  }, [inventory, salesOrders, purchaseOrders, qualityInspections, capacityPlans, kpis]);

  /* ── Render ──────────────────────────────────── */
  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">Real-time analytics across all operations &mdash; revenue, supply chain, quality, and production</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 12, fontWeight: 600, color: '#10b981' }}>
            {'\u25CF'} Live Data
          </span>
        </div>
      </div>

      {/* 8 Executive KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Revenue', value: fmtCurrency(kpis.totalRevenue), sub: `${salesOrders.length} orders`, color: '#10b981', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Total Spend', value: fmtCurrency(kpis.totalSpend), sub: `${purchaseOrders.length} POs`, color: '#ef4444', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z' },
          { label: 'Gross Margin', value: `${kpis.grossMargin.toFixed(1)}%`, sub: kpis.grossMargin > 0 ? 'Profitable' : 'Negative', color: kpis.grossMargin >= 20 ? '#10b981' : '#f59e0b', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
          { label: 'Inventory Value', value: fmtCurrency(kpis.inventoryValue), sub: `${inventory.length} records`, color: '#6366f1', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
          { label: 'Production Efficiency', value: `${kpis.prodEfficiency.toFixed(1)}%`, sub: `${prodOrders.length} orders`, color: kpis.prodEfficiency >= 70 ? '#10b981' : '#f59e0b', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
          { label: 'Quality Score', value: kpis.qualityScore.toFixed(1), sub: `${qualityInspections.length} inspections`, color: kpis.qualityScore >= 80 ? '#10b981' : '#f59e0b', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
          { label: 'Capacity Utilization', value: `${kpis.capacityUtil.toFixed(1)}%`, sub: `${capacityPlans.length} plans`, color: kpis.capacityUtil <= 85 ? '#06b6d4' : '#ef4444', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
          { label: 'Forecast Accuracy', value: `${kpis.forecastAccuracy.toFixed(1)}%`, sub: `${demandForecasts.length} forecasts`, color: kpis.forecastAccuracy >= 70 ? '#10b981' : '#f59e0b', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
        ].map(kpi => (
          <div key={kpi.label} className="kpi-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 12, right: 12, opacity: 0.12 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={kpi.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={kpi.icon} /></svg>
            </div>
            <div className="kpi-value" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="kpi-label">{kpi.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Revenue vs Spend + Supply Chain Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>
        <div className="chart-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Revenue vs Spend Trend
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Monthly comparison with margin</span>
          </h3>
          {revSpendTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={revSpendTrend} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => fmtCurrency(v)} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3 }} />
                <Area type="monotone" dataKey="spend" name="Spend" stroke="#ef4444" fill="url(#spendGrad)" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
                <Line type="monotone" dataKey="margin" name="Margin" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No order data to visualize trends</div>}
        </div>

        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ width: '100%' }}>Supply Chain Health Score</h3>
          <GaugeChart value={healthScore.total} size={200} strokeWidth={16} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginTop: 12 }}>
            {healthScore.breakdown.map(b => (
              <div key={b.label} style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{b.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: b.color }}>{b.score}/{b.max}</span>
                </div>
                <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ width: `${(b.score / b.max) * 100}%`, height: '100%', borderRadius: 2, background: b.color, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Top Items + Supplier Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="chart-card">
          <h3>Top Items Analysis</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-4px 0 12px' }}>Revenue, cost, and inventory value by item</p>
          {topItems.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topItems} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCurrency(v)} width={55} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} barSize={12} />
                <Bar dataKey="cost" name="Cost" fill="#ef4444" radius={[3, 3, 0, 0]} barSize={12} />
                <Bar dataKey="inventoryValue" name="Inventory Value" fill="#6366f1" radius={[3, 3, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No item data available</div>}
        </div>

        <div className="chart-card">
          <h3>Supplier Performance Matrix</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-4px 0 12px' }}>Order count, spend, and delivery performance</p>
          {supplierPerf.length > 0 ? (
            <div style={{ overflow: 'auto', maxHeight: 340 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Supplier', 'Orders', 'Total Spend', 'Avg Order', 'Delivery %'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Supplier' ? 'left' : 'right', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {supplierPerf.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '10px', fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{s.name}</td>
                      <td style={{ padding: '10px', fontSize: 12, color: 'var(--text-dim)', textAlign: 'right' }}>{s.orderCount}</td>
                      <td style={{ padding: '10px', fontSize: 12, color: 'var(--text)', textAlign: 'right', fontWeight: 600 }}>{fmtCurrency(s.totalSpend)}</td>
                      <td style={{ padding: '10px', fontSize: 12, color: 'var(--text-dim)', textAlign: 'right' }}>{fmtCurrency(s.avgOrderValue)}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 12, fontWeight: 700,
                          color: s.deliveryRate >= 80 ? '#10b981' : s.deliveryRate >= 60 ? '#f59e0b' : '#ef4444',
                        }}>
                          <span style={{ width: 36, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', display: 'inline-block', position: 'relative', overflow: 'hidden' }}>
                            <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${s.deliveryRate}%`, borderRadius: 3, background: s.deliveryRate >= 80 ? '#10b981' : s.deliveryRate >= 60 ? '#f59e0b' : '#ef4444' }} />
                          </span>
                          {s.deliveryRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-state">No supplier data available</div>}
        </div>
      </div>

      {/* Row 3: Production Pipeline + Cost Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="chart-card">
          <h3>Production Pipeline</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-4px 0 16px' }}>Order flow from planning to shipment</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pipeline.map((stage, i) => {
              const maxCount = Math.max(...pipeline.map(p => p.count), 1);
              const barWidth = Math.max((stage.count / maxCount) * 100, 8);
              return (
                <div key={stage.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: `${stage.color}20`, color: stage.color, fontSize: 10, fontWeight: 700, marginRight: 8 }}>
                        {i + 1}
                      </span>
                      {stage.stage}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: stage.color }}>{stage.count} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>({stage.pct}%)</span></span>
                  </div>
                  <div style={{ width: '100%', height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.03)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                      width: `${barWidth}%`, height: '100%', borderRadius: 6,
                      background: `linear-gradient(90deg, ${stage.color}40, ${stage.color}80)`,
                      transition: 'width 0.8s ease',
                      display: 'flex', alignItems: 'center', paddingLeft: 10,
                    }}>
                      {stage.count > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{stage.count} orders</span>}
                    </div>
                    {i < pipeline.length - 1 && (
                      <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', opacity: 0.3 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Production Orders</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{prodOrders.length}</span>
          </div>
        </div>

        <div className="chart-card">
          <h3>Cost Breakdown</h3>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '-4px 0 12px' }}>Material, labor, overhead, and scrap costs</p>
          {costBreakdown.some(c => c.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={costBreakdown} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                  <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCurrency(v)} width={55} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Cost" radius={[6, 6, 0, 0]} barSize={40}>
                    {costBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
                {costBreakdown.map(c => {
                  const total = costBreakdown.reduce((s, x) => s + x.value, 0);
                  return (
                    <div key={c.name} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.color }}>{fmtCurrency(c.value)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.name} ({total > 0 ? pct(c.value, total) : 0}%)</div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : <div className="empty-state">No cost data available</div>}
        </div>
      </div>

      {/* Row 4: Alerts & Recommendations */}
      <div className="chart-card" style={{ marginBottom: 20 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
          Alerts &amp; Recommendations
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>AI-computed operational insights</span>
        </h3>
        {alerts.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 12 }}>
            {alerts.map((alert, i) => {
              const borderColor = alert.type === 'critical' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#06b6d4';
              const bgColor = alert.type === 'critical' ? 'rgba(239,68,68,0.06)' : alert.type === 'warning' ? 'rgba(245,158,11,0.06)' : 'rgba(6,182,212,0.06)';
              return (
                <div key={i} style={{
                  padding: '14px 16px', borderRadius: 10, background: bgColor,
                  borderLeft: `3px solid ${borderColor}`,
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={borderColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={alert.icon} /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{alert.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{alert.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>All systems operating normally. No alerts at this time.</div>
          </div>
        )}
      </div>
    </div>
  );
}
