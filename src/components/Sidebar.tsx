'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { category: 'Overview', items: [
    { label: 'Dashboard', href: '/', icon: '📊' },
    { label: 'MRP Run', href: '/mrp', icon: '🔄' },
  ]},
  { category: 'Master Data', items: [
    { label: 'Items', href: '/items', icon: '📦' },
    { label: 'Suppliers', href: '/suppliers', icon: '🚛' },
    { label: 'Customers', href: '/customers', icon: '👥' },
    { label: 'Warehouses', href: '/warehouses', icon: '🏭' },
    { label: 'Work Centers', href: '/work-centers', icon: '⚙️' },
    { label: 'Units of Measure', href: '/uom', icon: '📏' },
  ]},
  { category: 'Engineering', items: [
    { label: 'Bill of Materials', href: '/bom', icon: '📋' },
    { label: 'BOM Lines', href: '/bom-lines', icon: '📝' },
    { label: 'Routings', href: '/routings', icon: '🔀' },
    { label: 'Routing Operations', href: '/routing-ops', icon: '🔧' },
  ]},
  { category: 'Purchasing', items: [
    { label: 'Purchase Orders', href: '/purchase-orders', icon: '🛒' },
    { label: 'PO Lines', href: '/po-lines', icon: '📃' },
  ]},
  { category: 'Sales', items: [
    { label: 'Sales Orders', href: '/sales-orders', icon: '🧾' },
    { label: 'SO Lines', href: '/so-lines', icon: '📃' },
  ]},
  { category: 'Manufacturing', items: [
    { label: 'Production Orders', href: '/production-orders', icon: '🔨' },
    { label: 'Prod Operations', href: '/prod-ops', icon: '🔩' },
  ]},
  { category: 'Inventory', items: [
    { label: 'Inventory', href: '/inventory', icon: '📦' },
    { label: 'Transactions', href: '/inv-transactions', icon: '↔️' },
  ]},
  { category: 'Planning', items: [
    { label: 'Demand Forecasts', href: '/forecasts', icon: '📈' },
    { label: 'MRP Runs', href: '/mrp-runs', icon: '▶️' },
    { label: 'Recommendations', href: '/mrp-recs', icon: '💡' },
  ]},
  { category: 'Quality', items: [
    { label: 'Inspections', href: '/inspections', icon: '✅' },
    { label: 'Check Items', href: '/check-items', icon: '☑️' },
  ]},
  { category: 'Capacity & Finance', items: [
    { label: 'Capacity Plans', href: '/capacity', icon: '📊' },
    { label: 'Cost Centers', href: '/cost-centers', icon: '💰' },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside style={{ width: 260, position: 'fixed', top: 0, left: 0, bottom: 0, background: '#0f172a', overflowY: 'auto', padding: '16px 0' }}>
      <div style={{ padding: '8px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa', margin: 0 }}>MRP Enterprise</h1>
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>Material Requirements Planning</p>
      </div>
      <nav style={{ marginTop: 8 }}>
        {NAV.map((group) => (
          <div key={group.category}>
            <div className="sidebar-category">{group.category}</div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link${pathname === item.href ? ' active' : ''}`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
