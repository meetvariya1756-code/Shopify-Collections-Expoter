'use client';

import React, { useRef, useEffect } from 'react';
import {
  Layers,
  Database,
  FileSpreadsheet,
  Activity,
  HelpCircle
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
    { id: 'connect', label: '1. Connect Stores', shortLabel: '1. Connect', icon: Database },
    { id: 'export', label: '2. Collections & Export', shortLabel: '2. Export', icon: Layers, badge: collectionsCount > 0 ? collectionsCount : null },
    { id: 'import', label: '3. Excel Import', shortLabel: '3. Import', icon: FileSpreadsheet },
    { id: 'monitor', label: '4. Live Migration', shortLabel: '4. Migration', icon: Activity, isLive: migrationRunning },
  ];

  const activeTabRef = useRef(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [activeTab]);

  const sourceStoreName = sourceStore ? (sourceStore.name || sourceStore.domain?.split('.')[0]) : 'None';
  const targetStoreName = activeTab === 'import' ? 'this store' : (targetStore ? (targetStore.name || targetStore.domain?.split('.')[0]) : 'None');

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Brand */}
        <div className="navbar-brand">
          <div className="navbar-brand-icon">
            <FileSpreadsheet size={20} color="#FFFFFF" />
          </div>
          <div className="navbar-brand-text">
            <div className="navbar-brand-title-row">
              <span className="navbar-brand-title">
                Shopify Collections
              </span>
              <span className="badge badge-smart navbar-brand-badge">
                Excel Studio
              </span>
            </div>
            <p className="navbar-subtitle">
              Smart Rules &bull; Tags &bull; Handle Mapping &bull; .XLSX
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="navbar-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={isActive ? activeTabRef : null}
                id={`tab-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab-btn ${isActive ? 'nav-tab-active' : ''}`}
              >
                <Icon size={15} color={isActive ? '#4F46E5' : '#64748B'} className="nav-tab-icon" />
                <span className="nav-tab-label-full">{tab.label}</span>
                <span className="nav-tab-label-short">{tab.shortLabel}</span>
                {tab.badge && (
                  <span className="nav-tab-badge">
                    {tab.badge}
                  </span>
                )}
                {tab.isLive && (
                  <span className="nav-tab-live-dot pulse-glow" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Status & Guide Button */}
        <div className="navbar-actions">
          {/* Store status pills */}
          <div className="navbar-chips">
            <div
              className={`chip-pill chip-src ${sourceStore ? 'chip-connected' : 'chip-empty'}`}
              title={`Src: ${sourceStoreName}`}
            >
              <span className="chip-dot" />
              <span className="chip-text">
                Src: {sourceStoreName}
              </span>
            </div>

            <div
              className={`chip-pill chip-dst ${(activeTab === 'import' || targetStore) ? 'chip-connected' : 'chip-empty'}`}
              title={`Dst: ${targetStoreName}`}
            >
              <span className="chip-dot" />
              <span className="chip-text">
                Dst: {targetStoreName}
              </span>
            </div>
          </div>

          <button
            id="open-guide-btn"
            onClick={onOpenGuide}
            className="btn btn-secondary navbar-guide-btn"
            title="Setup Guide"
          >
            <HelpCircle size={14} color="#4F46E5" />
            <span className="guide-btn-text">Setup Guide</span>
          </button>
        </div>
      </div>
    </header>
  );
}
