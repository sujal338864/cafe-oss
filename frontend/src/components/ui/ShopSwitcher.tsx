'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function ShopSwitcher() {
  const { shops, activeShop, switchShop, user } = useAuth() as any;
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!activeShop) return null;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          borderRadius: 12,
          background: theme.input,
          border: `1px solid ${theme.border}`,
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
          transition: 'all 0.2s',
        }}
      >
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'linear-gradient(135deg,#7c3aed,#3b82f6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 900,
          fontSize: 14,
          flexShrink: 0
        }}>
          {activeShop.name[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ 
            fontSize: 13, 
            fontWeight: 800, 
            color: theme.text, 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis' 
          }}>
            {activeShop.name}
          </div>
          <div style={{ fontSize: 10, color: theme.textFaint }}>{activeShop.role}</div>
        </div>
        <span style={{ fontSize: 10, color: theme.textMuted }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '110%',
          left: 0,
          right: 0,
          background: theme.card,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
          zIndex: 1000,
          padding: 6,
          maxHeight: 300,
          overflowY: 'auto'
        }}>
          <div style={{ padding: '8px 10px', fontSize: 10, fontWeight: 700, color: theme.textFaint, textTransform: 'uppercase' }}>
            Switch Branch
          </div>
          {shops.map((s: any) => (
            <button
              key={s.id}
              onClick={() => {
                switchShop(s.id);
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                width: '100%',
                borderRadius: 8,
                background: s.id === activeShop.id ? theme.hover : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = theme.hover}
              onMouseLeave={e => e.currentTarget.style.background = s.id === activeShop.id ? theme.hover : 'transparent'}
            >
              <div style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: s.id === activeShop.id ? 'linear-gradient(135deg,#7c3aed,#3b82f6)' : theme.border,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 700,
                fontSize: 10
              }}>
                {s.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>{s.name}</div>
                <div style={{ fontSize: 9, color: theme.textFaint }}>{s.role}</div>
              </div>
              {s.id === activeShop.id && <span style={{ color: '#7c3aed', fontSize: 12 }}>✓</span>}
            </button>
          ))}
          
          <div style={{ margin: '6px 0', height: 1, background: theme.border }} />
          
          <button
            onClick={() => { window.location.href = '/dashboard/settings/shops'; }}
            style={{
              padding: '8px 10px',
              width: '100%',
              borderRadius: 8,
              background: 'transparent',
              border: `1px dashed ${theme.border}`,
              color: theme.accent,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            + Add New Branch
          </button>
        </div>
      )}
    </div>
  );
}
