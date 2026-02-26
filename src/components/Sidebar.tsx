'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';

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
  const { theme, toggle } = useTheme();

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

      {/* Theme Toggle */}
      <button className="theme-toggle" onClick={toggle}>
        {theme === 'dark' ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </button>
    </aside>
  );
}
