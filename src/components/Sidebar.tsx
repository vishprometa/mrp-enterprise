'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { category: 'Overview', items: [
    { label: 'Dashboard', href: '/' },
    { label: 'MRP Simulation', href: '/mrp' },
    { label: 'Analytics', href: '/analytics' },
    { label: 'Activity Log', href: '/audit' },
  ]},
  { category: 'Master Data', items: [
    { label: 'Items', href: '/items' },
    { label: 'Suppliers', href: '/suppliers' },
    { label: 'Customers', href: '/customers' },
    { label: 'Warehouses', href: '/warehouses' },
    { label: 'Work Centers', href: '/work-centers' },
    { label: 'Units of Measure', href: '/uom' },
  ]},
  { category: 'Engineering', items: [
    { label: 'Bill of Materials', href: '/bom' },
    { label: 'BOM Lines', href: '/bom-lines' },
    { label: 'BOM Explosion', href: '/bom-explosion' },
    { label: 'Routings', href: '/routings' },
    { label: 'Routing Operations', href: '/routing-ops' },
  ]},
  { category: 'Purchasing', items: [
    { label: 'Purchase Orders', href: '/purchase-orders' },
    { label: 'PO Lines', href: '/po-lines' },
  ]},
  { category: 'Sales', items: [
    { label: 'Sales Orders', href: '/sales-orders' },
    { label: 'SO Lines', href: '/so-lines' },
  ]},
  { category: 'Manufacturing', items: [
    { label: 'Production Orders', href: '/production-orders' },
    { label: 'Prod Operations', href: '/prod-ops' },
  ]},
  { category: 'Inventory', items: [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Transactions', href: '/inv-transactions' },
  ]},
  { category: 'Planning', items: [
    { label: 'Demand Forecasts', href: '/forecasts' },
    { label: 'MRP Runs', href: '/mrp-runs' },
    { label: 'Recommendations', href: '/mrp-recs' },
  ]},
  { category: 'Quality', items: [
    { label: 'Inspections', href: '/inspections' },
    { label: 'Check Items', href: '/check-items' },
  ]},
  { category: 'Capacity & Finance', items: [
    { label: 'Capacity Plans', href: '/capacity' },
    { label: 'Cost Centers', href: '/cost-centers' },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">M</div>
        <div className="sidebar-brand-text">
          <h1>MRP Enterprise</h1>
          <p>Material Planning Console</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((group) => (
          <div key={group.category}>
            <div className="sidebar-category">{group.category}</div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`sidebar-link${active ? ' active' : ''}`}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#818cf8' : 'var(--text-dim)', display: 'block', flexShrink: 0 }} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
