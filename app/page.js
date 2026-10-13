'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Layers, Loader2 } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import Navbar from '@/components/Navbar';
import StoreConnector from '@/components/StoreConnector';
import CollectionExplorer from '@/components/CollectionExplorer';
import ExcelImporter from '@/components/ExcelImporter';
import LiveProgress from '@/components/LiveProgress';
import ApiGuideModal from '@/components/ApiGuideModal';

export default function DashboardPage() {
  const [shopifyAuthorizing, setShopifyAuthorizing] = useState(true);
  const [shopDomain, setShopDomain] = useState('');

  const [activeTab, setActiveTab] = useState('connect'); // 'connect' | 'export' | 'import' | 'monitor'
  const [sourceStore, setSourceStore] = useState(null);
  const [targetStore, setTargetStore] = useState(null);
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [stagedCollections, setStagedCollections] = useState([]);
  const [showGuide, setShowGuide] = useState(false);
  const [buildCommit, setBuildCommit] = useState(
    process.env.NEXT_PUBLIC_GIT_COMMIT
      ? process.env.NEXT_PUBLIC_GIT_COMMIT.slice(0, 7)
      : (process.env.NEXT_PUBLIC_APP_VERSION || '')
  );

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data?.commit) {
          setBuildCommit(data.commit);
        }
      })
      .catch(() => {});
  }, []);

  // Migration Monitor State
  const [migrationState, setMigrationState] = useState({
    isRunning: false,
    isCompleted: false,
    progress: 0,
    currentMessage: '',
    logs: [],
    stats: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
    error: null
  });


  // Fetch collections from source store
  const fetchCollectionsFromStore = async (store) => {
    const activeSource = store || sourceStore;
    if (!activeSource?.shopUrl) return;

    setLoadingCollections(true);
    try {
      const res = await axios.post('/api/shopify/fetch-collections', {
        shopUrl: activeSource.shopUrl,
        options: {
          includeProducts: true,
          includeSmartRules: true,
          includeCustomItems: true
        }
      });

      if (res.data && res.data.success) {
        setCollections(res.data.collections || []);
      } else {
        alert(res.data?.error || 'Failed to fetch collections.');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to fetch collections.');
    } finally {
      setLoadingCollections(false);
    }
  };

  // Direct sync handler from CollectionExplorer
  const handleSyncDirectly = (selectedItems) => {
    setStagedCollections(selectedItems);
    setActiveTab('import');
  };

  // Start Migration SSE Stream
  const handleStartMigration = async (itemsToMigrate, options) => {
    if (!targetStore) {
      alert('Please connect a Target Store first.');
      return;
    }

    const total = itemsToMigrate.length;

    // Reset and switch to monitor tab
    setMigrationState({
      isRunning: true,
      isCompleted: false,
      progress: 0,
      currentMessage: 'Connecting to target store...',
      logs: [
        {
          time: new Date().toLocaleTimeString(),
          type: 'info',
          message: `Initiating migration of ${total} collections to ${targetStore.name || targetStore.domain}`
        }
      ],
      stats: { total, created: 0, updated: 0, skipped: 0, failed: 0 },
      error: null
    });

    setActiveTab('monitor');

    try {
      const response = await fetch('/api/shopify/import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStoreUrl: targetStore.shopUrl,
          collections: itemsToMigrate,
          options: options || {}
        })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // keep remaining partial line in buffer

        for (const block of lines) {
          if (!block.trim()) continue;

          let event = 'message';
          let dataStr = '';

          const eventLines = block.split('\n');
          for (const line of eventLines) {
            if (line.startsWith('event: ')) {
              event = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.replace('data: ', '').trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            handleSseEvent(event, data);
          } catch (_) { }
        }
      }
    } catch (err) {
      setMigrationState((prev) => ({
        ...prev,
        isRunning: false,
        error: err.message,
        logs: [
          ...prev.logs,
          {
            time: new Date().toLocaleTimeString(),
            type: 'error',
            message: `Migration pipeline failed: ${err.message}`
          }
        ]
      }));
    }
  };

  // Process SSE events
  const handleSseEvent = (event, data) => {
    const time = new Date().toLocaleTimeString();

    if (event === 'start') {
      setMigrationState((prev) => ({
        ...prev,
        currentMessage: data.message || 'Import pipeline started',
        logs: [...prev.logs, { time, type: 'info', message: data.message }]
      }));
    } else if (event === 'progress') {
      setMigrationState((prev) => {
        const nextStats = { ...prev.stats };
        if (data.status === 'created') nextStats.created += 1;
        else if (data.status === 'updated') nextStats.updated += 1;
        else if (data.status === 'skipped') nextStats.skipped += 1;
        else if (data.status === 'failed') nextStats.failed += 1;

        let logType = 'info';
        if (data.status === 'created' || data.status === 'updated') logType = 'success';
        else if (data.status === 'skipped') logType = 'warning';
        else if (data.status === 'failed') logType = 'error';

        return {
          ...prev,
          progress: data.percent !== undefined ? data.percent : prev.progress,
          currentMessage: data.message || `Processing ${data.currentTitle}...`,
          stats: nextStats,
          logs: [
            ...prev.logs,
            {
              time,
              type: logType,
              message: `[${data.index}/${data.total}] ${data.message || data.currentTitle}`
            }
          ]
        };
      });
    } else if (event === 'complete') {
      setMigrationState((prev) => ({
        ...prev,
        isRunning: false,
        isCompleted: true,
        progress: 100,
        currentMessage: data.message || 'All collections processed!',
        stats: data.results
          ? {
            total: data.results.total || prev.stats.total,
            created: data.results.created ?? prev.stats.created,
            updated: data.results.updated ?? prev.stats.updated,
            skipped: data.results.skipped ?? prev.stats.skipped,
            failed: data.results.failed ?? prev.stats.failed
          }
          : prev.stats,
        logs: [
          ...prev.logs,
          {
            time,
            type: 'complete',
            message: `🎉 ${data.message || 'Migration successfully completed.'}`
          }
        ]
      }));
    } else if (event === 'error') {
      setMigrationState((prev) => ({
        ...prev,
        isRunning: false,
        error: data.message,
        logs: [
          ...prev.logs,
          {
            time,
            type: 'error',
            message: `Error: ${data.message}`
          }
        ]
      }));
    }
  };

  // Check Shopify session & authorization
  useEffect(() => {
    let mounted = true;
    let attempts = 0;

    async function checkSession() {
      try {
        let resolvedShop = '';
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          resolvedShop = params.get('shop') || '';
          if (resolvedShop && mounted) {
            setShopDomain(resolvedShop);
          }
        }

        if (typeof window !== 'undefined' && window.shopify && typeof window.shopify.idToken === 'function') {
          const token = await window.shopify.idToken();
          if (token && mounted) {
            const currentShop = resolvedShop || shopDomain || 'dev-training-001.myshopify.com';
            const sourceData = {
              shopUrl: currentShop,
              domain: currentShop,
              name: currentShop.replace('.myshopify.com', '')
            };
            setSourceStore(sourceData);

            // Fetch linked destination store if any
            try {
              const destRes = await axios.get('/api/shopify/destination');
              if (destRes.data?.connected && destRes.data?.destinationShop && mounted) {
                setTargetStore({
                  shopUrl: destRes.data.destinationShop,
                  domain: destRes.data.destinationShop,
                  name: destRes.data.destinationShop.replace('.myshopify.com', '')
                });
              }
            } catch (_) {}

            setShopifyAuthorizing(false);
            fetchCollectionsFromStore(sourceData);
            return;
          }
        }

        // Inside Shopify iframe or with host param, allow brief retry for App Bridge initialization
        if (typeof window !== 'undefined' && (window.top !== window.self || window.location.search.includes('host='))) {
          if (attempts < 6) {
            attempts++;
            setTimeout(checkSession, 500);
            return;
          }
        }

        // Direct localhost browser fallback: fetch active installed store from database
        try {
          const storeRes = await axios.get('/api/shopify/active-store');
          if (storeRes.data?.success && storeRes.data?.store && mounted) {
            const currentShop = storeRes.data.store;
            setShopDomain(currentShop.domain);
            setSourceStore(currentShop);

            // Fetch linked destination store if any
            try {
              const destRes = await axios.get('/api/shopify/destination');
              if (destRes.data?.connected && destRes.data?.destinationShop && mounted) {
                setTargetStore({
                  shopUrl: destRes.data.destinationShop,
                  domain: destRes.data.destinationShop,
                  name: destRes.data.destinationShop.replace('.myshopify.com', '')
                });
              }
            } catch (_) {}

            setShopifyAuthorizing(false);
            fetchCollectionsFromStore(currentShop);
            return;
          }
        } catch (_) {}

        if (mounted) {
          setShopifyAuthorizing(false);
        }
      } catch (err) {
        if (attempts < 6) {
          attempts++;
          setTimeout(checkSession, 500);
        } else if (mounted) {
          setShopifyAuthorizing(false);
        }
      }
    }

    checkSession();
    return () => { mounted = false; };
  }, []);

  if (shopifyAuthorizing) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          gap: 16
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #4F46E5 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(79, 70, 229, 0.25)'
          }}
        >
          <Layers size={24} color="#FFFFFF" />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#475569',
            fontSize: 14,
            fontWeight: 600
          }}
        >
          <Loader2 size={18} className="animate-spin" />
          <span>Authorizing with Shopify...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Dark Top Bar */}
      <AppHeader shop={shopDomain || sourceStore?.shopUrl || ''} />

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sourceStore={sourceStore}
        targetStore={targetStore}
        collectionsCount={collections?.length || 0}
        migrationRunning={migrationState.isRunning}
        onOpenGuide={() => setShowGuide(true)}
      />

      {/* Main Content Area */}
      <main className="app-main-content" style={{ flex: 1, paddingBottom: 60, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
        {activeTab === 'connect' && (
          <StoreConnector
            sourceStore={sourceStore}
            setSourceStore={setSourceStore}
            targetStore={targetStore}
            setTargetStore={setTargetStore}
            onProceedToExport={() => {
              setActiveTab('export');
              if (sourceStore && collections.length === 0) {
                fetchCollectionsFromStore(sourceStore);
              }
            }}
            onProceedToImport={() => setActiveTab('import')}
            onOpenGuide={() => setShowGuide(true)}
          />
        )}

        {activeTab === 'export' && (
          <CollectionExplorer
            collections={collections}
            setCollections={setCollections}
            sourceStore={sourceStore}
            targetStore={targetStore}
            loadingCollections={loadingCollections}
            fetchCollectionsFromStore={fetchCollectionsFromStore}
            onSyncDirectly={handleSyncDirectly}
            onNavigateToConnect={() => setActiveTab('connect')}
          />
        )}

        {activeTab === 'import' && (
          <ExcelImporter
            currentShop={shopDomain || sourceStore?.shopUrl || 'session-store.myshopify.com'}
            stagedCollections={stagedCollections}
            setStagedCollections={setStagedCollections}
            onStartMigration={handleStartMigration}
            onUpdateMigrationState={setMigrationState}
            onOpenGuide={() => setShowGuide(true)}
          />
        )}

        {activeTab === 'monitor' && (
          <LiveProgress
            migrationState={migrationState}
            targetStore={targetStore}
            onResetMigration={() => {
              setMigrationState({
                isRunning: false,
                isCompleted: false,
                progress: 0,
                currentMessage: '',
                logs: [],
                stats: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
                error: null
              });
              setActiveTab('import');
            }}
            onViewCollections={() => setActiveTab('export')}
          />
        )}
      </main>

      {/* Build Marker Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '16px 20px 24px',
          fontSize: 11,
          color: '#94A3B8',
          letterSpacing: '0.02em',
        }}
      >
        build {buildCommit || 'dev'}
      </footer>

      {/* API Guide Modal */}
      {showGuide && <ApiGuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
