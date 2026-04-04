"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, Users, ShoppingCart,
  BarChart3, Settings, LogOut, Tag, Truck, Receipt, ShoppingBag,
} from "lucide-react";

const menuItems = [
  { href: "/dashboard",             label: "Dashboard",   icon: LayoutDashboard },
  { href: "/dashboard/pos",         label: "New Sale",    icon: ShoppingBag },
  { href: "/dashboard/products",    label: "Products",    icon: Package },
  { href: "/dashboard/categories",  label: "Categories",  icon: Tag },
  { href: "/dashboard/orders",      label: "Orders",      icon: ShoppingCart },
  { href: "/dashboard/customers",   label: "Customers",   icon: Users },
  { href: "/dashboard/suppliers",   label: "Suppliers",   icon: Truck },
  { href: "/dashboard/purchases",   label: "Purchases",   icon: Receipt },
  { href: "/dashboard/expenses",    label: "Expenses",    icon: Receipt },
  { href: "/dashboard/analytics",   label: "Analytics",   icon: BarChart3 },
  { href: "/dashboard/settings",    label: "Settings",    icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const border = '1px solid rgba(255,255,255,0.07)';

  return (
    <aside style={{ width: 220, background: '#0d0d16', borderRight: border, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px', borderBottom: border }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>S</span>
          </div>
          <div>
            <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>Shop OS</div>
            <div style={{ color: '#334155', fontSize: 10 }}>Business Dashboard</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {menuItems.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10,
                background: active ? 'rgba(124,58,237,0.18)' : 'transparent',
                color: active ? '#a78bfa' : '#475569',
                textDecoration: 'none', fontSize: 13, fontWeight: active ? 700 : 500,
                transition: 'all .15s',
              }}>
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 8px', borderTop: border }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'transparent', color: '#334155', cursor: 'pointer', border: 'none', fontSize: 13, width: '100%' }}>
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
