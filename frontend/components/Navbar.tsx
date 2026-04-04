"use client";

import { Bell, Search, User } from "lucide-react";

export function Navbar() {
  const border = '1px solid rgba(255,255,255,0.07)';
  return (
    <nav style={{ height: 60, background: '#0d0d16', borderBottom: border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', gap: 16 }}>
      {/* Search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#334155', pointerEvents: 'none' }} />
        <input
          placeholder="Search..."
          style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 36, borderRadius: 10, border, background: '#1c1c26', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={{ width: 36, height: 36, borderRadius: 10, border, background: 'transparent', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={16} />
        </button>
        <button style={{ width: 36, height: 36, borderRadius: 10, border, background: 'transparent', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={16} />
        </button>
      </div>
    </nav>
  );
}
