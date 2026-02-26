'use client';

import { useState, useMemo } from 'react';
import { StatusBadge } from '@/components/StatusBadge';

interface Props {
  items: any[];
  boms: any[];
  bomLines: any[];
  inventory: any[];
  salesOrderLines: any[];
  productionOrders: any[];
}

interface MrpResult {
  itemId: string;
  itemName: string;
  itemCode: string;
  grossRequirement: number;
  onHand: number;
  safetyStock: number;
  netRequirement: number;
  plannedOrderQty: number;
  action: 'Purchase' | 'Production' | 'None';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  children: MrpResult[];
}

export function MrpSimulation({ items, boms, bomLines, inventory, salesOrderLines, productionOrders }: Props) {
  const [selectedItem, setSelectedItem] = useState('');
  const [demandQty, setDemandQty] = useState(100);
  const [results, setResults] = useState<MrpResult[]>([]);
  const [bomTree, setBomTree] = useState<any[]>([]);
  const [tab, setTab] = useState<'simulation' | 'results' | 'tree'>('simulation');

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

  const explodeBom = (itemId: string, qty: number, depth = 0): MrpResult => {
    const item = itemMap[itemId] || {};
    const itemName = item['SKU'] || 'Unknown';
    const itemCode = item['SKU'] || '???';
    const itemType = item['Item Type'] || '';
    const safetyStock = Number(item['Safety Stock'] || 0);
    const onHand = inventoryByItem[itemId] || 0;
    const reorderQty = Number(item['Min Order Qty'] || qty);

    const netReq = Math.max(0, qty + safetyStock - onHand);
    const plannedQty = netReq > 0 ? Math.max(netReq, reorderQty) : 0;

    let action: 'Purchase' | 'Production' | 'None' = 'None';
    if (netReq > 0) {
      action = itemType === 'Raw Material' || itemType === 'Consumable' ? 'Purchase' : 'Production';
    }

    let priority: 'Critical' | 'High' | 'Medium' | 'Low' = 'Low';
    if (onHand === 0 && netReq > 0) priority = 'Critical';
    else if (onHand < safetyStock) priority = 'High';
    else if (netReq > 0) priority = 'Medium';

    const itemBom = boms.find(b => b['Item'] === itemId && b['Status'] === 'Active');
    const children: MrpResult[] = [];

    if (itemBom && depth < 10) {
      const lines = bomLines.filter(l => l['BOM'] === itemBom.id);
      lines.forEach(line => {
        const compId = line['Item'];
        const lineQty = Number(line['Quantity'] || 1);
        const scrap = Number(line['Scrap Pct'] || 0) / 100;
        const requiredQty = Math.ceil(plannedQty * lineQty * (1 + scrap));
        if (compId) {
          children.push(explodeBom(compId, requiredQty, depth + 1));
        }
      });
    }

    return { itemId, itemName, itemCode, grossRequirement: qty, onHand, safetyStock, netRequirement: netReq, plannedOrderQty: plannedQty, action, priority, children };
  };

  const runSimulation = () => {
    if (!selectedItem) return;
    const result = explodeBom(selectedItem, demandQty);
    setResults(flattenResults(result));
    setBomTree([result]);
    setTab('results');
  };

  const flattenResults = (node: MrpResult): MrpResult[] => {
    const list: MrpResult[] = [node];
    node.children.forEach(c => list.push(...flattenResults(c)));
    return list;
  };

  const purchaseActions = results.filter(r => r.action === 'Purchase').length;
  const productionActions = results.filter(r => r.action === 'Production').length;
  const criticalItems = results.filter(r => r.priority === 'Critical').length;

  const finishedGoods = items.filter(i => i['Item Type'] === 'Finished Good' || i['Item Type'] === 'Semi-Finished');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">MRP Simulation</h1>
          <p className="page-subtitle">Material Requirements Planning &mdash; BOM Explosion &amp; Demand Analysis</p>
        </div>
      </div>

      <div className="tabs-bar">
        <button className={`tab-btn${tab === 'simulation' ? ' active' : ''}`} onClick={() => setTab('simulation')}>
          <span className="tab-icon">&#9881;</span> Setup
        </button>
        <button className={`tab-btn${tab === 'results' ? ' active' : ''}`} onClick={() => setTab('results')}>
          <span className="tab-icon">&#9776;</span> Results {results.length > 0 && <span className="tab-count">{results.length}</span>}
        </button>
        <button className={`tab-btn${tab === 'tree' ? ' active' : ''}`} onClick={() => setTab('tree')}>
          <span className="tab-icon">&#128466;</span> BOM Tree
        </button>
      </div>

      {tab === 'simulation' && (
        <div>
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-value" style={{ color: '#6366f1' }}>{items.length}</div><div className="kpi-label">Total Items</div></div>
            <div className="kpi-card"><div className="kpi-value" style={{ color: '#8b5cf6' }}>{boms.filter(b => b['Status'] === 'Active').length}</div><div className="kpi-label">Active BOMs</div></div>
            <div className="kpi-card"><div className="kpi-value" style={{ color: '#10b981' }}>{inventory.length}</div><div className="kpi-label">Inventory Records</div></div>
            <div className="kpi-card"><div className="kpi-value" style={{ color: '#f59e0b' }}>{productionOrders.filter(p => p['Status'] !== 'Completed' && p['Status'] !== 'Cancelled').length}</div><div className="kpi-label">Open Prod Orders</div></div>
          </div>

          <div className="glass-card" style={{ maxWidth: 640 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>&#9889;</span> Run MRP Explosion
            </h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label className="field-label">Select Item (Finished / Semi-Finished) <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="input" value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                  <option value="">Select an item...</option>
                  {finishedGoods.map(i => (
                    <option key={i.id} value={i.id}>{i['SKU']} &mdash; {i['Description'] || i['SKU']}</option>
                  ))}
                  {finishedGoods.length === 0 && items.map(i => (
                    <option key={i.id} value={i.id}>{i['SKU'] || i.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Demand Quantity <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="number" min={1} value={demandQty} onChange={e => setDemandQty(Number(e.target.value))} />
              </div>
              <button className="btn btn-primary" onClick={runSimulation} disabled={!selectedItem} style={{ justifyContent: 'center', padding: '12px 24px' }}>
                Run MRP Explosion
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'results' && (
        <div>
          {results.length === 0 ? (
            <div className="empty-state">Run a simulation first to see results</div>
          ) : (
            <>
              <div className="kpi-grid">
                <div className="kpi-card"><div className="kpi-value" style={{ color: '#6366f1' }}>{results.length}</div><div className="kpi-label">Total Requirements</div></div>
                <div className="kpi-card"><div className="kpi-value" style={{ color: '#8b5cf6' }}>{purchaseActions}</div><div className="kpi-label">Purchase Orders</div></div>
                <div className="kpi-card"><div className="kpi-value" style={{ color: '#10b981' }}>{productionActions}</div><div className="kpi-label">Production Orders</div></div>
                <div className="kpi-card"><div className="kpi-value" style={{ color: '#ef4444' }}>{criticalItems}</div><div className="kpi-label">Critical Items</div></div>
              </div>

              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead><tr><th>SKU</th><th>Gross Req</th><th>On Hand</th><th>Safety</th><th>Net Req</th><th>Planned Qty</th><th>Action</th><th>Priority</th></tr></thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i}>
                        <td><span className="mono-text">{r.itemCode}</span></td>
                        <td>{r.grossRequirement}</td>
                        <td>{r.onHand}</td>
                        <td>{r.safetyStock}</td>
                        <td style={{ fontWeight: r.netRequirement > 0 ? 700 : 400, color: r.netRequirement > 0 ? '#ef4444' : '#22c55e' }}>{r.netRequirement}</td>
                        <td style={{ fontWeight: 600 }}>{r.plannedOrderQty}</td>
                        <td><StatusBadge value={r.action} /></td>
                        <td><StatusBadge value={r.priority} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'tree' && (
        <div>
          {bomTree.length === 0 ? (
            <div className="empty-state">Run a simulation first to see the BOM tree</div>
          ) : (
            <div className="glass-card">
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>BOM Explosion Tree</h3>
              {bomTree.map((node, i) => <TreeNode key={i} node={node} depth={0} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, depth }: { node: MrpResult; depth: number }) {
  const indent = depth * 28;
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div className="tree-node" style={{ marginLeft: indent, borderLeft: depth > 0 ? '2px solid var(--border)' : 'none', background: depth === 0 ? 'var(--bg-elevated)' : 'transparent' }}>
        <span style={{ fontSize: 14 }}>{hasChildren ? '\u{1F4E6}' : '\u{1F529}'}</span>
        <span className="mono-text" style={{ minWidth: 100 }}>{node.itemCode}</span>
        <span style={{ fontWeight: 500, flex: 1 }}>{node.itemName}</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Need: <strong>{node.netRequirement}</strong></span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Stock: {node.onHand}</span>
        <StatusBadge value={node.action} />
        <StatusBadge value={node.priority} />
      </div>
      {node.children.map((child, i) => <TreeNode key={i} node={child} depth={depth + 1} />)}
    </div>
  );
}
