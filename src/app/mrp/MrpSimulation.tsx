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

  // Build lookup maps
  const itemMap = useMemo(() => {
    const map: Record<string, any> = {};
    items.forEach(i => { map[i.id] = i; map[i['Item Name']] = i; });
    return map;
  }, [items]);

  const inventoryByItem = useMemo(() => {
    const map: Record<string, number> = {};
    inventory.forEach(inv => {
      const itemId = inv['Item'] || inv['item'];
      if (itemId) map[itemId] = (map[itemId] || 0) + Number(inv['Quantity On Hand'] || 0);
    });
    return map;
  }, [inventory]);

  // BOM explosion: recursively compute requirements
  const explodeBom = (itemId: string, qty: number, depth = 0): MrpResult => {
    const item = itemMap[itemId] || {};
    const itemName = item['Item Name'] || 'Unknown';
    const itemCode = item['Item Code'] || '???';
    const category = item['Category'] || '';
    const safetyStock = Number(item['Safety Stock'] || 0);
    const onHand = inventoryByItem[itemId] || 0;
    const reorderQty = Number(item['Reorder Quantity'] || qty);

    const netReq = Math.max(0, qty + safetyStock - onHand);
    const plannedQty = netReq > 0 ? Math.max(netReq, reorderQty) : 0;

    // Determine action
    let action: 'Purchase' | 'Production' | 'None' = 'None';
    if (netReq > 0) {
      action = category === 'Raw Material' || category === 'Consumable' ? 'Purchase' : 'Production';
    }

    // Priority
    let priority: 'Critical' | 'High' | 'Medium' | 'Low' = 'Low';
    if (onHand === 0 && netReq > 0) priority = 'Critical';
    else if (onHand < safetyStock) priority = 'High';
    else if (netReq > 0) priority = 'Medium';

    // Find BOM for this item
    const itemBom = boms.find(b => b['Item'] === itemId && b['Status'] === 'Active');
    const children: MrpResult[] = [];

    if (itemBom && depth < 10) {
      const lines = bomLines.filter(l => l['BOM'] === itemBom.id);
      lines.forEach(line => {
        const compId = line['Component Item'];
        const lineQty = Number(line['Quantity'] || 1);
        const scrap = Number(line['Scrap Percent'] || 0) / 100;
        const requiredQty = Math.ceil(plannedQty * lineQty * (1 + scrap));
        if (compId) {
          children.push(explodeBom(compId, requiredQty, depth + 1));
        }
      });
    }

    return {
      itemId,
      itemName,
      itemCode,
      grossRequirement: qty,
      onHand,
      safetyStock,
      netRequirement: netReq,
      plannedOrderQty: plannedQty,
      action,
      priority,
      children,
    };
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

  const totalActions = results.filter(r => r.action !== 'None').length;
  const purchaseActions = results.filter(r => r.action === 'Purchase').length;
  const productionActions = results.filter(r => r.action === 'Production').length;
  const criticalItems = results.filter(r => r.priority === 'Critical').length;

  const finishedGoods = items.filter(i => i['Category'] === 'Finished Good' || i['Category'] === 'Semi-Finished');

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>MRP Simulation</h1>
        <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>
          Material Requirements Planning - BOM Explosion & Demand Analysis
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
        <button className={`tab${tab === 'simulation' ? ' active' : ''}`} onClick={() => setTab('simulation')}>Simulation Setup</button>
        <button className={`tab${tab === 'results' ? ' active' : ''}`} onClick={() => setTab('results')}>Results ({results.length})</button>
        <button className={`tab${tab === 'tree' ? ' active' : ''}`} onClick={() => setTab('tree')}>BOM Tree</button>
      </div>

      {tab === 'simulation' && (
        <div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div className="card card-stat">
              <span className="label">Total Items</span>
              <span className="value" style={{ color: '#3b82f6' }}>{items.length}</span>
            </div>
            <div className="card card-stat">
              <span className="label">Active BOMs</span>
              <span className="value" style={{ color: '#8b5cf6' }}>{boms.filter(b => b['Status'] === 'Active').length}</span>
            </div>
            <div className="card card-stat">
              <span className="label">Inventory Records</span>
              <span className="value" style={{ color: '#10b981' }}>{inventory.length}</span>
            </div>
            <div className="card card-stat">
              <span className="label">Open Prod Orders</span>
              <span className="value" style={{ color: '#f59e0b' }}>{productionOrders.filter(p => p['Status'] !== 'Completed' && p['Status'] !== 'Cancelled').length}</span>
            </div>
          </div>

          {/* Simulation Form */}
          <div className="card" style={{ maxWidth: 600 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Run MRP Explosion</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#475569' }}>
                  Select Item (Finished / Semi-Finished) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select className="input" value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                  <option value="">Select an item...</option>
                  {finishedGoods.map(i => (
                    <option key={i.id} value={i.id}>{i['Item Code']} - {i['Item Name']}</option>
                  ))}
                  {finishedGoods.length === 0 && items.map(i => (
                    <option key={i.id} value={i.id}>{i['Item Code'] || i['Item Name'] || i.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4, color: '#475569' }}>
                  Demand Quantity <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input className="input" type="number" min={1} value={demandQty} onChange={e => setDemandQty(Number(e.target.value))} />
              </div>
              <button className="btn btn-primary" onClick={runSimulation} disabled={!selectedItem} style={{ justifyContent: 'center' }}>
                Run MRP Explosion
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'results' && (
        <div>
          {results.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              Run a simulation first to see results
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <div className="card card-stat">
                  <span className="label">Total Requirements</span>
                  <span className="value" style={{ color: '#3b82f6' }}>{results.length}</span>
                </div>
                <div className="card card-stat">
                  <span className="label">Purchase Orders Needed</span>
                  <span className="value" style={{ color: '#8b5cf6' }}>{purchaseActions}</span>
                </div>
                <div className="card card-stat">
                  <span className="label">Production Orders Needed</span>
                  <span className="value" style={{ color: '#10b981' }}>{productionActions}</span>
                </div>
                <div className="card card-stat">
                  <span className="label">Critical Items</span>
                  <span className="value" style={{ color: '#ef4444' }}>{criticalItems}</span>
                </div>
              </div>

              {/* Results Table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Gross Req</th>
                      <th>On Hand</th>
                      <th>Safety Stock</th>
                      <th>Net Req</th>
                      <th>Planned Qty</th>
                      <th>Action</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500, fontFamily: 'monospace' }}>{r.itemCode}</td>
                        <td>{r.itemName}</td>
                        <td>{r.grossRequirement}</td>
                        <td>{r.onHand}</td>
                        <td>{r.safetyStock}</td>
                        <td style={{ fontWeight: r.netRequirement > 0 ? 700 : 400, color: r.netRequirement > 0 ? '#ef4444' : '#22c55e' }}>
                          {r.netRequirement}
                        </td>
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
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
              Run a simulation first to see the BOM tree
            </div>
          ) : (
            <div className="card">
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>BOM Explosion Tree</h3>
              {bomTree.map((node, i) => (
                <TreeNode key={i} node={node} depth={0} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, depth }: { node: MrpResult; depth: number }) {
  const indent = depth * 32;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          marginLeft: indent,
          borderLeft: depth > 0 ? '2px solid #e2e8f0' : 'none',
          background: depth === 0 ? '#f8fafc' : 'transparent',
          borderRadius: 8,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 14, color: '#64748b' }}>{hasChildren ? '📦' : '🔩'}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#64748b', minWidth: 80 }}>{node.itemCode}</span>
        <span style={{ fontWeight: 500, flex: 1 }}>{node.itemName}</span>
        <span style={{ fontSize: 13, color: '#64748b' }}>Need: <strong>{node.netRequirement}</strong></span>
        <span style={{ fontSize: 13, color: '#64748b' }}>On Hand: {node.onHand}</span>
        <StatusBadge value={node.action} />
        <StatusBadge value={node.priority} />
      </div>
      {node.children.map((child, i) => (
        <TreeNode key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
