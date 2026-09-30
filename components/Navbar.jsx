'use client';

import React from 'react';
import {
  Layers,
  Database,
  FileSpreadsheet,
  Activity,
  HelpCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  sourceStore,
  targetStore,
  collectionsCount = 0,
  migrationRunning = false,
  onOpenGuide
}) {
  const tabs = [
    { id: 'connect', label: '1. Connect Stores', icon: Database },
    { id: 'export', label: '2. Collections & Export', icon: Layers, badge: collectionsCount > 0 ? collectionsCount : null },
    { id: 'import', label: '3. Excel Import', icon: FileSpreadsheet },
    { id: 'monitor', label: '4. Live Migration', icon: Activity, isLive: migrationRunning },
  ];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: '#FFFFFF',
      borderBottom: '1px solid #E2E8F0',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '0 24px',
        height: 68,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #4F46E5 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(79, 70, 229, 0.2)'
          }}>
            <FileSpreadsheet size={20} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px', color: '#0F172A' }}>
                Shopify Collections
              </span>
              <span className="badge badge-smart" style={{ fontSize: 10, padding: '2px 7px' }}>
                Excel Studio
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
              Smart Rules &bull; Tags &bull; Handle Mapping &bull; .XLSX
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: '#F1F5F9',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0'
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  padding: '8px 16px',
                  borderRadius: '8px',
                  color: isActive ? '#4F46E5' : '#475569',
                  background: isActive ? '#FFFFFF' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} color={isActive ? '#4F46E5' : '#64748B'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    fontSize: 11,
                    background: isActive ? '#EEF2FF' : '#E2E8F0',
                    color: isActive ? '#4F46E5' : '#475569',
                    padding: '1px 6px',
                    borderRadius: 9999,
                    fontWeight: 700
                  }}>
                    {tab.badge}
                  </span>
                )}
                {tab.isLive && (
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#059669',
                    boxShadow: '0 0 6px #059669'
                  }} className="pulse-glow" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Status & Guide Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Store status pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: sourceStore ? '#ECFDF5' : '#F8FAFC',
              border: `1px solid ${sourceStore ? '#A7F3D0' : '#E2E8F0'}`,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: 12
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: sourceStore ? '#059669' : '#94A3B8'
              }} />
              <span style={{ color: sourceStore ? '#065F46' : '#64748B', fontWeight: 600 }}>
                Src: {sourceStore ? (sourceStore.name || sourceStore.domain?.split('.')[0]) : 'None'}
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: targetStore ? '#F5F3FF' : '#F8FAFC',
              border: `1px solid ${targetStore ? '#DDD6FE' : '#E2E8F0'}`,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: 12
            }}>
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: targetStore ? '#7C3AED' : '#94A3B8'
              }} />
              <span style={{ color: targetStore ? '#5B21B6' : '#64748B', fontWeight: 600 }}>
                Dst: {targetStore ? (targetStore.name || targetStore.domain?.split('.')[0]) : 'None'}
              </span>
            </div>
          </div>

          <button
            id="open-guide-btn"
            onClick={onOpenGuide}
            className="btn btn-secondary"
            style={{
              padding: '7px 12px',
              fontSize: 12,
              gap: 6,
              borderRadius: '8px'
            }}
          >
            <HelpCircle size={14} color="#4F46E5" />
            <span>Setup Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
}
