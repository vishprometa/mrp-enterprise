'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { category: 'Overview', items: [
    { label: 'Dashboard', href: '/', icon: '&#xe871;' },
    { label: 'MRP Simulation', href: '/mrp', icon: '&#xe863;' },
  ]},
  { category: 'Master Data', items: [
    { label: 'Items', href: '/items', icon: '&#xe54e;' },
    { label: 'Suppliers', href: '/suppliers', icon: '&#xe558;' },
    { label: 'Customers', href: '/customers', icon: '&#xe7fb;' },
    { label: 'Warehouses', href: '/warehouses', icon: '&#xe8d1;' },
    { label: 'Work Centers', href: '/work-centers', icon: '&#xea3c;' },
    { label: 'Units of Measure', href: '/uom', icon: '&#xe1b7;' },
  ]},
  { category: 'Engineering', items: [
    { label: 'Bill of Materials', href: '/bom', icon: '&#xe8ef;' },
    { label: 'BOM Lines', href: '/bom-lines', icon: '&#xe241;' },
    { label: 'Routings', href: '/routings', icon: '&#xe569;' },
    { label: 'Routing Operations', href: '/routing-ops', icon: '&#xe869;' },
  ]},
  { category: 'Purchasing', items: [
    { label: 'Purchase Orders', href: '/purchase-orders', icon: '&#xf1cc;' },
    { label: 'PO Lines', href: '/po-lines', icon: '&#xe873;' },
  ]},
  { category: 'Sales', items: [
    { label: 'Sales Orders', href: '/sales-orders', icon: '&#xe8cc;' },
    { label: 'SO Lines', href: '/so-lines', icon: '&#xe873;' },
  ]},
  { category: 'Manufacturing', items: [
    { label: 'Production Orders', href: '/production-orders', icon: '&#xea3a;' },
    { label: 'Prod Operations', href: '/prod-ops', icon: '&#xe8c8;' },
  ]},
  { category: 'Inventory', items: [
    { label: 'Inventory', href: '/inventory', icon: '&#xe1b8;' },
    { label: 'Transactions', href: '/inv-transactions', icon: '&#xe8d4;' },
  ]},
  { category: 'Planning', items: [
    { label: 'Demand Forecasts', href: '/forecasts', icon: '&#xe6e1;' },
    { label: 'MRP Runs', href: '/mrp-runs', icon: '&#xe037;' },
    { label: 'Recommendations', href: '/mrp-recs', icon: '&#xe90f;' },
  ]},
  { category: 'Quality', items: [
    { label: 'Inspections', href: '/inspections', icon: '&#xef76;' },
    { label: 'Check Items', href: '/check-items', icon: '&#xe86c;' },
  ]},
  { category: 'Capacity & Finance', items: [
    { label: 'Capacity Plans', href: '/capacity', icon: '&#xe01d;' },
    { label: 'Cost Centers', href: '/cost-centers', icon: '&#xe263;' },
  ]},
];

// Using simple SVG icons instead of Material Icons to avoid font loading
const NavIcon = ({ active }: { active: boolean }) => (
  <span style={{
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: active ? '#818cf8' : '#4b5563',
    display: 'block',
    flexShrink: 0,
    transition: 'all 150ms',
  }} />
);

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">M</div>
        <div className="sidebar-brand-text">
          <h1>MRP Enterprise</h1>
          <p>Material Planning</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((group) => (
          <div key={group.category}>
            <div className="sidebar-category">{group.category}</div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link${active ? ' active' : ''}`}
                >
                  <NavIcon active={active} />
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
