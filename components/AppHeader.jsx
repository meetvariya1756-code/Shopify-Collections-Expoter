'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store, ShieldCheck, LogOut, ExternalLink, Layers, LayoutDashboard } from 'lucide-react';
import { useAuth } from './AuthProvider';

export default function AppHeader({ shop = '' }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [detectedShop, setDetectedShop] = useState(shop);

  const isOnAdminPage = pathname?.startsWith('/admin');
  const isAdminRole = user?.role === 'admin';

  useEffect(() => {
    if (shop) {
      setDetectedShop(shop);
    } else if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryShop = params.get('shop') || '';
      if (queryShop) {
        setDetectedShop(queryShop);
      }
    }
  }, [shop]);

  // If on /admin, display admin header
  if (isOnAdminPage) {
    if (!user) return null;

    return (
      <header
        id="app-header-dark"
        style={{
          width: '100%',
          height: 52,
          background: '#141416',
          borderBottom: '1px solid #232326',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          color: '#FFFFFF',
          zIndex: 200,
          position: 'sticky',
          top: 0
        }}
      >
        {/* Left: Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link
            href="/admin"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Layers size={15} color="#FFFFFF" />
            </div>
            <span
              style={{
                fontWeight: 800,
                fontSize: 15,
                letterSpacing: '-0.2px',
                color: '#FFFFFF'
              }}
            >
              Collections Exporter
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link
              href="/admin"
              id="nav-admin-dashboard"
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#FFFFFF',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.08)'
              }}
            >
              <LayoutDashboard size={14} />
              <span>Admin Dashboard</span>
            </Link>

            <Link
              href="/"
              id="nav-open-app"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#94A3B8',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 4
              }}
            >
              <ExternalLink size={14} />
              <span>Open Merchant App</span>
            </Link>
          </nav>
        </div>

        {/* Right: Admin Badge, Name, Log out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            id="role-badge-admin"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid #F59E0B',
              color: '#F59E0B',
              padding: '3px 10px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.2px'
            }}
          >
            <ShieldCheck size={12} strokeWidth={2.5} />
            <span>Admin</span>
          </div>

          <span
            id="user-display-name"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#F1F5F9'
            }}
          >
            {user.displayName || user.username}
          </span>

          <button
            id="btn-logout"
            onClick={logout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#FFFFFF',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <LogOut size={13} />
            <span>Log out</span>
          </button>
        </div>
      </header>
    );
  }

  // Merchant Header for root "/" (No Log out button, Merchant badge, Shop domain)
  const displayShopName = detectedShop || 'Shopify Store';

  return (
    <header
      id="app-header-dark"
      style={{
        width: '100%',
        height: 50,
        background: '#141416',
        borderBottom: '1px solid #232326',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        color: '#FFFFFF',
        zIndex: 200,
        position: 'sticky',
        top: 0
      }}
    >
      {/* Left: Brand Logo & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: 'linear-gradient(135deg, #4F46E5 0%, #059669 100%)',
            boxShadow: '0 2px 6px rgba(79, 70, 229, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Layers size={15} color="#FFFFFF" />
        </div>
        <span
          style={{
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: '-0.2px',
            color: '#FFFFFF'
          }}
        >
          Collections Exporter
        </span>
      </div>

      {/* Right: Shop Domain & Merchant Badge (No Logout button) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          id="merchant-shop-domain"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#E2E8F0'
          }}
        >
          {displayShopName}
        </span>

        <div
          id="role-badge-merchant"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10B981',
            color: '#10B981',
            padding: '3px 10px',
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.2px'
          }}
        >
          <Store size={12} strokeWidth={2.5} />
          <span>Merchant</span>
        </div>
      </div>
    </header>
  );
}
