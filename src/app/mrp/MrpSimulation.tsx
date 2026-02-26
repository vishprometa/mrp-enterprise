'use client';

import { useState, useMemo, useCallback } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, CartesianGrid, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Cell,
} from 'recharts';

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

interface Props {
  items: any[];
  boms: any[];
  bomLines: any[];
  inventory: any[];
  salesOrderLines: any[];
  productionOrders: any[];
}

interface SimParams {
  safetyStockMultiplier: number;
  planningHorizon: number;
  demandForecastBoost: number;
  scrapFactor: number;
}

interface MrpResult {
  itemId: string;
  sku: string;
  description: string;
  itemType: string;
  grossRequirement: number;
  adjustedGross: number;
  onHand: number;
  safetyStock: number;
  netRequirement: number;
  actionQty: number;
  standardCost: number;
  estimatedCost: number;
  action: 'Purchase' | 'Production' | 'None';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  leadTimeDays: number;
  reorderPoint: number;
}

interface BomNode {
  itemId: string;
  sku: string;
  description: string;
  requiredQty: number;
  availableQty: number;
  shortage: number;
  children: BomNode[];
}

const DEFAULT_PARAMS: SimParams = {
  safetyStockMultiplier: 1.0,
  planningHorizon: 30,
  demandForecastBoost: 100,
  scrapFactor: 5,
};

// ═══════════════════════════════════════════════════
// Chart theme constants
// ═══════════════════════════════════════════════════

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#f1f5f9' },
};
const AXIS_TICK = { fill: '#64748b', fontSize: 11 };
const GRID_STROKE = 'rgba(255,255,255,0.04)';

// ═══════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}

// ═══════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════

export function MrpSimulation({ items, boms, bomLines, inventory, salesOrderLines, productionOrders }: Props) {
  const [params, setParams] = useState<SimParams>({ ...DEFAULT_PARAMS });
  const [hasRun, setHasRun] = useState(false);
  const [tab, setTab] = useState<'overview' | 'bom' | 'recommendations'>('overview');
  const [selectedBomItem, setSelectedBomItem] = useState('');

  // ─── Index maps ──────────────────────────────────
  const itemMap = useMemo(() => {
    const map: Record<string, any> = {};
    items.forEach(i => { map[i.id] = i; });
    return map;
  }, [items]);

  const inventoryByItem = useMemo(() => {
    const map: Record<string, number> = {};
    inventory.forEach(inv => {
      const itemId = inv['Item'] || inv['item'];
      if (itemId) map[itemId] = (map[itemId] || 0) + Number(inv['Qty On Hand'] || 0);
    });
    return map;
  }, [inventory]);

  const demandByItem = useMemo(() => {
    const map: Record<string, number> = {};
    salesOrderLines.forEach(sol => {
      const itemId = sol['Item'] || sol['item'];
      const qty = Number(sol['Quantity'] || 0);
      const shipped = Number(sol['Shipped Qty'] || 0);
      const status = sol['Status'] || '';
      if (itemId && status !== 'Cancelled' && status !== 'Delivered') {
        map[itemId] = (map[itemId] || 0) + Math.max(0, qty - shipped);
      }
    });
    return map;
  }, [salesOrderLines]);

  // Build a map: itemId -> list of component itemIds required via BOM
  const bomComponentDemand = useMemo(() => {
    const map: Record<string, number> = {};
    // For each production order (non-completed, non-cancelled), explode BOM to find component demand
    productionOrders.forEach(po => {
      const status = po['Status'] || '';
      if (status === 'Completed' || status === 'Cancelled') return;
      const parentItemId = po['Item'] || po['item'];
      const plannedQty = Number(po['Planned Qty'] || 0);
      const completedQty = Number(po['Completed Qty'] || 0);
      const remainingQty = Math.max(0, plannedQty - completedQty);
      if (!parentItemId || remainingQty <= 0) return;

      const itemBom = boms.find(b => b['Item'] === parentItemId && b['Status'] === 'Active');
      if (!itemBom) return;

      const lines = bomLines.filter(l => l['BOM'] === itemBom.id);
      lines.forEach(line => {
        const compId = line['Item'];
        const lineQty = Number(line['Quantity'] || 1);
        const scrap = Number(line['Scrap Pct'] || 0) / 100;
        if (compId) {
          map[compId] = (map[compId] || 0) + Math.ceil(remainingQty * lineQty * (1 + scrap));
        }
      });
    });
    return map;
  }, [productionOrders, boms, bomLines]);

  // ─── Simulation computation ──────────────────────
  const simulationResults = useMemo((): MrpResult[] => {
    if (!hasRun) return [];

    const { safetyStockMultiplier, demandForecastBoost, scrapFactor } = params;

    return items.map(item => {
      const itemId = item.id;
      const sku = item['SKU'] || '???';
      const description = item['Description'] || sku;
      const itemType = item['Item Type'] || '';
      const safetyStock = Number(item['Safety Stock'] || 0);
      const reorderPoint = Number(item['Reorder Point'] || 0);
      const standardCost = Number(item['Standard Cost'] || 0);
      const minOrderQty = Number(item['Min Order Qty'] || 1);
      const leadTimeDays = Number(item['Lead Time Days'] || 0);
      const onHand = inventoryByItem[itemId] || 0;

      // Gross requirement = sales order demand + BOM component demand from production orders
      const salesDemand = demandByItem[itemId] || 0;
      const componentDemand = bomComponentDemand[itemId] || 0;
      const grossRequirement = salesDemand + componentDemand;

      // Apply demand forecast boost
      const boostedGross = grossRequirement * (demandForecastBoost / 100);
      // Apply scrap factor
      const adjustedGross = boostedGross * (1 + scrapFactor / 100);
      // Net requirement = max(0, adjusted gross - on hand + safety stock * multiplier)
      const effectiveSafety = safetyStock * safetyStockMultiplier;
      const netRequirement = Math.max(0, adjustedGross - onHand + effectiveSafety);

      let action: 'Purchase' | 'Production' | 'None' = 'None';
      if (netRequirement > 0) {
        action = (itemType === 'Raw Material' || itemType === 'Consumable') ? 'Purchase' : 'Production';
      }

      const actionQty = netRequirement > 0 ? Math.max(netRequirement, minOrderQty) : 0;
      const estimatedCost = actionQty * standardCost;

      let priority: 'Critical' | 'High' | 'Medium' | 'Low' = 'Low';
      if (netRequirement > 2 * effectiveSafety && effectiveSafety > 0) priority = 'Critical';
      else if (netRequirement > effectiveSafety && effectiveSafety > 0) priority = 'High';
      else if (netRequirement > 0) priority = 'Medium';

      return {
        itemId, sku, description, itemType, grossRequirement,
        adjustedGross: Math.round(adjustedGross),
        onHand, safetyStock, netRequirement: Math.round(netRequirement),
        actionQty: Math.round(actionQty), standardCost, estimatedCost: Math.round(estimatedCost * 100) / 100,
        action, priority, leadTimeDays, reorderPoint,
      };
    }).filter(r => r.grossRequirement > 0 || r.onHand > 0);
  }, [hasRun, params, items, inventoryByItem, demandByItem, bomComponentDemand]);

  // ─── Derived metrics ─────────────────────────────
  const kpis = useMemo(() => {
    const totalGross = simulationResults.reduce((sum, r) => sum + r.adjustedGross, 0);
    const totalNet = simulationResults.reduce((sum, r) => sum + r.netRequirement, 0);
    const plannedOrders = simulationResults.filter(r => r.netRequirement > 0).length;
    const totalCost = simulationResults.reduce((sum, r) => sum + r.estimatedCost, 0);
    return { totalGross, totalNet, plannedOrders, totalCost };
  }, [simulationResults]);

  // ─── Chart data: top 8 items by gross requirement ─
  const barChartData = useMemo(() => {
    return [...simulationResults]
      .sort((a, b) => b.adjustedGross - a.adjustedGross)
      .slice(0, 8)
      .map(r => ({
        name: r.sku.length > 12 ? r.sku.slice(0, 12) + '..' : r.sku,
        Demand: r.adjustedGross,
        'On Hand': r.onHand,
        'Net Req': r.netRequirement,
      }));
  }, [simulationResults]);

  // ─── Chart data: coverage analysis ────────────────
  const coverageData = useMemo(() => {
    return [...simulationResults]
      .filter(r => r.adjustedGross > 0)
      .sort((a, b) => b.adjustedGross - a.adjustedGross)
      .slice(0, 8)
      .map(r => {
        const dailyDemand = r.adjustedGross / Math.max(params.planningHorizon, 1);
        const coverageDays = dailyDemand > 0 ? Math.round(r.onHand / dailyDemand) : 999;
        return {
          item: r.sku.length > 12 ? r.sku.slice(0, 12) + '..' : r.sku,
          coverage: Math.min(coverageDays, params.planningHorizon),
          fullMark: params.planningHorizon,
        };
      });
  }, [simulationResults, params.planningHorizon]);

  // ─── BOM tree explosion ──────────────────────────
  const bomTree = useMemo((): BomNode | null => {
    if (!selectedBomItem) return null;

    const buildTree = (itemId: string, qty: number, depth: number): BomNode => {
      const item = itemMap[itemId] || {};
      const sku = item['SKU'] || '???';
      const description = item['Description'] || sku;
      const availableQty = inventoryByItem[itemId] || 0;
      const shortage = Math.min(0, availableQty - qty);

      const children: BomNode[] = [];
      if (depth < 8) {
        const itemBom = boms.find(b => b['Item'] === itemId && b['Status'] === 'Active');
        if (itemBom) {
          const lines = bomLines.filter(l => l['BOM'] === itemBom.id);
          lines.sort((a, b) => Number(a['Position'] || 0) - Number(b['Position'] || 0));
          lines.forEach(line => {
            const compId = line['Item'];
            const lineQty = Number(line['Quantity'] || 1);
            const scrap = Number(line['Scrap Pct'] || 0) / 100;
            const requiredQty = Math.ceil(qty * lineQty * (1 + scrap));
            if (compId) {
              children.push(buildTree(compId, requiredQty, depth + 1));
            }
          });
        }
      }

      return { itemId, sku, description, requiredQty: qty, availableQty, shortage, children };
    };

    return buildTree(selectedBomItem, 100, 0);
  }, [selectedBomItem, itemMap, inventoryByItem, boms, bomLines]);

  // ─── Recommendations (sorted by priority) ────────
  const recommendations = useMemo(() => {
    const priorityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return [...simulationResults]
      .filter(r => r.netRequirement > 0)
      .sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));
  }, [simulationResults]);

  // ─── Handlers ────────────────────────────────────
  const updateParam = useCallback((key: keyof SimParams, val: number) => {
    setParams(p => ({ ...p, [key]: val }));
    if (hasRun) setHasRun(true); // keep live-updating
  }, [hasRun]);

  const runSimulation = useCallback(() => {
    setHasRun(true);
    setTab('overview');
  }, []);

  const resetParams = useCallback(() => {
    setParams({ ...DEFAULT_PARAMS });
    setHasRun(false);
  }, []);

  // Items that can be BOM-exploded (have active BOMs)
  const bomItems = useMemo(() => {
    const bomItemIds = new Set(boms.filter(b => b['Status'] === 'Active').map(b => b['Item']));
    return items.filter(i => bomItemIds.has(i.id));
  }, [items, boms]);

  // ═══════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════

  return (
    <div>
      {/* ─── Page Header ─── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">MRP Simulation Console</h1>
          <p className="page-subtitle">Material Requirements Planning &mdash; Interactive demand analysis with real-time parameter tuning</p>
        </div>
      </div>

      {/* ─── Control Panel ─── */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#6366f1', fontSize: 16 }}>&#9881;</span> Simulation Parameters
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={resetParams}>Reset</button>
            <button className="btn btn-primary btn-sm" onClick={runSimulation} style={{ minWidth: 130 }}>
              Run Simulation
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          <SliderControl
            label="Safety Stock Multiplier"
            value={params.safetyStockMultiplier}
            min={0.5} max={3.0} step={0.1}
            display={params.safetyStockMultiplier.toFixed(1) + 'x'}
            onChange={v => updateParam('safetyStockMultiplier', v)}
          />
          <SliderControl
            label="Planning Horizon"
            value={params.planningHorizon}
            min={7} max={90} step={1}
            display={params.planningHorizon + ' days'}
            onChange={v => updateParam('planningHorizon', v)}
          />
          <SliderControl
            label="Demand Forecast Boost"
            value={params.demandForecastBoost}
            min={0} max={200} step={5}
            display={params.demandForecastBoost + '%'}
            onChange={v => updateParam('demandForecastBoost', v)}
          />
          <SliderControl
            label="Scrap Factor"
            value={params.scrapFactor}
            min={0} max={25} step={1}
            display={params.scrapFactor + '%'}
            onChange={v => updateParam('scrapFactor', v)}
          />
        </div>
      </div>

      {/* ─── KPI Summary ─── */}
      {hasRun && (
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <div className="kpi-card">
            <div className="kpi-value" style={{ color: '#f97316' }}>{fmt(kpis.totalGross)}</div>
            <div className="kpi-label">Total Gross Requirement</div>
            <div className="kpi-trend neutral" style={{ fontSize: 11 }}>Adjusted for boost + scrap</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value" style={{ color: '#6366f1' }}>{fmt(kpis.totalNet)}</div>
            <div className="kpi-label">Net Requirement</div>
            <div className="kpi-trend neutral" style={{ fontSize: 11 }}>After inventory &amp; safety stock</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value" style={{ color: '#06b6d4' }}>{kpis.plannedOrders}</div>
            <div className="kpi-label">Planned Orders</div>
            <div className="kpi-trend neutral" style={{ fontSize: 11 }}>Items needing reorder</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-value" style={{ color: '#10b981' }}>{fmtCurrency(kpis.totalCost)}</div>
            <div className="kpi-label">Estimated Cost</div>
            <div className="kpi-trend neutral" style={{ fontSize: 11 }}>Net req x standard cost</div>
          </div>
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="tabs-bar">
        <button className={`tab-btn${tab === 'overview' ? ' active' : ''}`} onClick={() => setTab('overview')}>
          <span className="tab-icon">&#9776;</span> Overview
        </button>
        <button className={`tab-btn${tab === 'bom' ? ' active' : ''}`} onClick={() => setTab('bom')}>
          <span className="tab-icon">&#128466;</span> BOM Explorer
        </button>
        <button className={`tab-btn${tab === 'recommendations' ? ' active' : ''}`} onClick={() => setTab('recommendations')}>
          <span className="tab-icon">&#9888;</span> Recommendations
          {recommendations.length > 0 && <span className="tab-count">{recommendations.length}</span>}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB: Overview                                  */}
      {/* ═══════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div>
          {!hasRun ? (
            <div className="empty-state">
              <div className="empty-state-icon">&#128202;</div>
              Adjust parameters above and click <strong>Run Simulation</strong> to generate the MRP analysis.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Left: Demand vs Supply Bar Chart */}
              <div className="chart-card">
                <h3>Demand vs Supply (Top 8)</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={barChartData} barGap={2} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                      <XAxis dataKey="name" tick={AXIS_TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                      <YAxis tick={AXIS_TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                      <Tooltip {...CHART_TOOLTIP} />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                      <Bar dataKey="Demand" fill="#f97316" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="On Hand" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Net Req" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right: Coverage Radar */}
              <div className="chart-card">
                <h3>Item Coverage Analysis (Days of Supply)</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    {coverageData.length >= 3 ? (
                      <RadarChart data={coverageData} outerRadius="70%">
                        <PolarGrid stroke={GRID_STROKE} />
                        <PolarAngleAxis dataKey="item" tick={{ fill: '#64748b', fontSize: 10 }} />
                        <PolarRadiusAxis tick={{ fill: '#475569', fontSize: 9 }} domain={[0, params.planningHorizon]} />
                        <Tooltip {...CHART_TOOLTIP} />
                        <Radar name="Coverage (days)" dataKey="coverage" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                      </RadarChart>
                    ) : (
                      <AreaChart data={coverageData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="item" tick={AXIS_TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                        <YAxis tick={AXIS_TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} domain={[0, params.planningHorizon]} />
                        <Tooltip {...CHART_TOOLTIP} />
                        <Area type="monotone" dataKey="coverage" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} name="Coverage (days)" />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB: BOM Explorer                              */}
      {/* ═══════════════════════════════════════════════ */}
      {tab === 'bom' && (
        <div>
          <div className="glass-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, maxWidth: 400 }}>
                <label className="field-label">Select Item to Explode</label>
                <select className="input" value={selectedBomItem} onChange={e => setSelectedBomItem(e.target.value)}>
                  <option value="">Choose an item with an active BOM...</option>
                  {bomItems.map(i => (
                    <option key={i.id} value={i.id}>{i['SKU']} &mdash; {i['Description'] || i['SKU']}</option>
                  ))}
                  {bomItems.length === 0 && items.map(i => (
                    <option key={i.id} value={i.id}>{i['SKU'] || i.id}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!selectedBomItem ? (
            <div className="empty-state">
              <div className="empty-state-icon">&#128466;</div>
              Select an item above to view its BOM explosion tree.
            </div>
          ) : bomTree ? (
            <div className="glass-card">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>BOM Explosion Tree</h3>
              <BomTreeNode node={bomTree} depth={0} />
            </div>
          ) : (
            <div className="empty-state">No active BOM found for the selected item.</div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* TAB: Recommendations                           */}
      {/* ═══════════════════════════════════════════════ */}
      {tab === 'recommendations' && (
        <div>
          {!hasRun ? (
            <div className="empty-state">
              <div className="empty-state-icon">&#9888;</div>
              Run a simulation first to generate recommendations.
            </div>
          ) : recommendations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">&#10003;</div>
              No reorder recommendations. Inventory levels are sufficient for current demand parameters.
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  Reorder Recommendations
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
                  {recommendations.length} items require action
                </span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item SKU</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Gross Req</th>
                    <th style={{ textAlign: 'right' }}>On Hand</th>
                    <th style={{ textAlign: 'right' }}>Net Req</th>
                    <th style={{ textAlign: 'right' }}>Action Qty</th>
                    <th style={{ textAlign: 'right' }}>Est. Cost</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map((r, i) => (
                    <tr key={r.itemId + '-' + i}>
                      <td>
                        <span className="mono-text">{r.sku}</span>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{r.description}</div>
                      </td>
                      <td><StatusBadge value={r.action} /></td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.adjustedGross.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.onHand.toLocaleString()}</td>
                      <td style={{
                        textAlign: 'right', fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                        color: r.netRequirement > 0 ? '#ef4444' : '#22c55e',
                      }}>
                        {r.netRequirement.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#6366f1' }}>
                        {r.actionQty.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#10b981' }}>
                        {fmtCurrency(r.estimatedCost)}
                      </td>
                      <td><StatusBadge value={r.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Summary row */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 24,
                padding: '12px 18px', borderTop: '1px solid var(--border)',
                background: 'var(--bg-sunken)', fontSize: 12, fontWeight: 600,
              }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Total Action Qty: <span style={{ color: '#6366f1' }}>{recommendations.reduce((s, r) => s + r.actionQty, 0).toLocaleString()}</span>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>
                  Total Est. Cost: <span style={{ color: '#10b981' }}>{fmtCurrency(recommendations.reduce((s, r) => s + r.estimatedCost, 0))}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Slider Control
// ═══════════════════════════════════════════════════

function SliderControl({ label, value, min, max, step, display, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          {label}
        </label>
        <span style={{
          fontSize: 14, fontWeight: 700, color: '#6366f1',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          height: 6,
          appearance: 'none',
          WebkitAppearance: 'none',
          background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((value - min) / (max - min)) * 100}%, #1e293b ${((value - min) / (max - min)) * 100}%, #1e293b 100%)`,
          borderRadius: 100,
          outline: 'none',
          cursor: 'pointer',
          accentColor: '#6366f1',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
        <span>{typeof min === 'number' && min % 1 !== 0 ? min.toFixed(1) : min}</span>
        <span>{typeof max === 'number' && max % 1 !== 0 ? max.toFixed(1) : max}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// BOM Tree Node (recursive)
// ═══════════════════════════════════════════════════

function BomTreeNode({ node, depth }: { node: BomNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="tree-node"
        style={{
          marginLeft: depth * 28,
          borderLeft: depth > 0 ? '2px solid rgba(99,102,241,0.2)' : 'none',
          background: depth === 0 ? 'var(--bg-elevated)' : 'transparent',
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Expand/collapse indicator */}
        <span style={{ fontSize: 12, width: 16, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
          {hasChildren ? (expanded ? '\u25BC' : '\u25B6') : '\u00B7'}
        </span>

        {/* SKU */}
        <span className="mono-text" style={{ minWidth: 110 }}>{node.sku}</span>

        {/* Description */}
        <span style={{ fontWeight: 500, flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
          {node.description}
        </span>

        {/* Required qty */}
        <span style={{
          fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text-muted)', minWidth: 80, textAlign: 'right',
        }}>
          Need: <strong style={{ color: 'var(--text)' }}>{node.requiredQty.toLocaleString()}</strong>
        </span>

        {/* Available qty */}
        <span style={{
          fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--text-muted)', minWidth: 80, textAlign: 'right',
        }}>
          Avail: <strong style={{ color: node.availableQty >= node.requiredQty ? '#10b981' : '#64748b' }}>{node.availableQty.toLocaleString()}</strong>
        </span>

        {/* Shortage */}
        {node.shortage < 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#ef4444',
            background: 'rgba(239,68,68,0.12)', padding: '2px 8px',
            borderRadius: 100, fontFamily: "'JetBrains Mono', monospace",
          }}>
            {node.shortage.toLocaleString()}
          </span>
        )}
        {node.shortage >= 0 && node.availableQty >= node.requiredQty && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#10b981',
            background: 'rgba(16,185,129,0.12)', padding: '2px 8px',
            borderRadius: 100,
          }}>
            OK
          </span>
        )}
      </div>

      {expanded && node.children.map((child, i) => (
        <BomTreeNode key={child.itemId + '-' + i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
