'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import StoreConnector from '@/components/StoreConnector';
import CollectionExplorer from '@/components/CollectionExplorer';
import ExcelImporter from '@/components/ExcelImporter';
import LiveProgress from '@/components/LiveProgress';
import ApiGuideModal from '@/components/ApiGuideModal';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('connect'); // 'connect' | 'export' | 'import' | 'monitor'
  const [sourceStore, setSourceStore] = useState(null);
  const [targetStore, setTargetStore] = useState(null);
  const [collections, setCollections] = useState([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [stagedCollections, setStagedCollections] = useState([]);
  const [showGuide, setShowGuide] = useState(false);

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

  // Load saved store configurations or handle OAuth return code on mount
  useEffect(() => {
    const handleAuth = async () => {
      try {
        const savedSource = localStorage.getItem('shopify_source_store');
        const savedTarget = localStorage.getItem('shopify_target_store');
        if (savedSource) setSourceStore(JSON.parse(savedSource));
        if (savedTarget) setTargetStore(JSON.parse(savedTarget));

        // Check if redirected from Shopify OAuth install (?token=... or ?code=...)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const token = params.get('token');
          const code = params.get('code');
          const shop = params.get('shop') || '';

          if (token) {
            setLoadingCollections(true);
            const storeData = {
              shopUrl: shop,
              accessToken: token,
              name: ''
            };
            setSourceStore(storeData);
            localStorage.setItem('shopify_source_store', JSON.stringify(storeData));
            window.history.replaceState({}, document.title, window.location.pathname);
            await fetchCollectionsFromStore(storeData);
            setActiveTab('export');
            return;
          }

          if (code) {
            setLoadingCollections(true);
            const clientId = localStorage.getItem('shopify_client_id') || process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID || '';
            const clientSecret = localStorage.getItem('shopify_client_secret') || process.env.SHOPIFY_CLIENT_SECRET || '';

            if (!clientId || !clientSecret) {
              setLoadingCollections(false);
              return;
            }

            const res = await axios.post('/api/shopify/exchange-token', {
              shopUrl: shop,
              clientId,
              clientSecret,
              code
            });

            if (res.data?.success && res.data?.accessToken) {
              const storeData = {
                shopUrl: shop,
                accessToken: res.data.accessToken,
                ...res.data.shop
              };
              setSourceStore(storeData);
              localStorage.setItem('shopify_source_store', JSON.stringify(storeData));
              window.history.replaceState({}, document.title, window.location.pathname);
              await fetchCollectionsFromStore(storeData);
              setActiveTab('export');
            }
          }
        }
      } catch (err) {
        console.error('OAuth / Load error:', err);
      }
    };

    handleAuth();
  }, []);

  // Fetch collections from source store
  const fetchCollectionsFromStore = async (store) => {
    const activeSource = store || sourceStore;
    if (!activeSource) return;

    setLoadingCollections(true);
    try {
      const res = await axios.post('/api/shopify/fetch-collections', {
        shopUrl: activeSource.shopUrl,
        accessToken: activeSource.accessToken,
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
          targetAccessToken: targetStore.accessToken,
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
      <main style={{ flex: 1, paddingBottom: 60 }}>
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
            targetStore={targetStore}
            stagedCollections={stagedCollections}
            setStagedCollections={setStagedCollections}
            onStartMigration={handleStartMigration}
            onNavigateToConnect={() => setActiveTab('connect')}
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

      {/* API Guide Modal */}
      {showGuide && <ApiGuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
