'use client';

import React, { useState, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  CheckCircle2,
  Layers,
  Sparkles,
  Tag,
  RefreshCw,
  ShieldAlert,
  Search,
  Filter
} from 'lucide-react';
import axios from 'axios';

export default function DestinationCleanerModal({
  isOpen,
  onClose,
  targetStore,
  onNavigateToConnect
}) {
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [destCollections, setDestCollections] = useState([]);
  const [loadError, setLoadError] = useState('');
  
  // Selection & filter
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filterType, setFilterType] = useState('all'); // 'all' | 'smart' | 'custom'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Deletion state
  const [deleteMode, setDeleteMode] = useState(null); // 'all' | 'smart' | 'custom' | 'selected'
  const [confirmStep, setConfirmStep] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  
  // SSE Deletion Stream
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteStatusMessage, setDeleteStatusMessage] = useState('');
  const [deleteLogs, setDeleteLogs] = useState([]);
  const [deleteStats, setDeleteStats] = useState({ total: 0, deleted: 0, failed: 0 });
  const [isCompleted, setIsCompleted] = useState(false);

  // Fetch destination store collections
  const loadDestCollections = async () => {
    if (!targetStore?.shopUrl || !targetStore?.accessToken) return;
    
    setLoadingCollections(true);
    setLoadError('');
    setSelectedIds(new Set());
    
    try {
      const res = await axios.post('/api/shopify/fetch-collections', {
        shopUrl: targetStore.shopUrl,
        accessToken: targetStore.accessToken,
        options: {
          includeProducts: false,
          includeSmartRules: true,
          includeCustomItems: true
        }
      });
      
      if (res.data && res.data.success) {
        setDestCollections(res.data.collections || []);
      } else {
        setLoadError(res.data?.error || 'Failed to retrieve collections from destination store.');
      }
    } catch (err) {
      setLoadError(err.response?.data?.error || err.message || 'Error connecting to destination store.');
    } finally {
      setLoadingCollections(false);
    }
  };

  useEffect(() => {
    if (isOpen && targetStore) {
      loadDestCollections();
      // Reset flow
      setDeleteMode(null);
      setConfirmStep(false);
      setConfirmText('');
      setIsDeleting(false);
      setIsCompleted(false);
      setDeleteLogs([]);
      setDeleteProgress(0);
    }
  }, [isOpen, targetStore]);

  if (!isOpen) return null;

  const smartCollections = destCollections.filter(c => c.collection_type === 'smart' || (c.rules && c.rules.length > 0));
  const customCollections = destCollections.filter(c => c.collection_type !== 'smart' && (!c.rules || c.rules.length === 0));

  const filteredList = destCollections.filter(col => {
    if (filterType === 'smart' && col.collection_type !== 'smart' && (!col.rules || col.rules.length === 0)) return false;
    if (filterType === 'custom' && (col.collection_type === 'smart' || (col.rules && col.rules.length > 0))) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const titleMatch = col.title?.toLowerCase().includes(q);
      const handleMatch = col.handle?.toLowerCase().includes(q);
      if (!titleMatch && !handleMatch) return false;
    }
    return true;
  });

  const handleToggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedIds);
    filteredList.forEach(c => next.add(c.id));
    setSelectedIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Trigger Deletion Confirmation Prompt
  const promptDelete = (mode) => {
    if (mode === 'selected' && selectedIds.size === 0) {
      alert('Please select at least one collection to delete.');
      return;
    }
    setDeleteMode(mode);
    setConfirmStep(true);
    setConfirmText('');
  };

  // Start Real-Time SSE Deletion Pipeline
  const executeDeletion = async () => {
    if (!targetStore) return;
    
    setConfirmStep(false);
    setIsDeleting(true);
    setIsCompleted(false);
    setDeleteProgress(0);
    setDeleteLogs([]);

    let idsToSend = [];
    if (deleteMode === 'selected') {
      idsToSend = Array.from(selectedIds);
    }

    const payload = {
      targetStoreUrl: targetStore.shopUrl,
      targetAccessToken: targetStore.accessToken,
      mode: deleteMode === 'custom' ? 'manual' : deleteMode,
      collectionIds: idsToSend
    };

    try {
      const response = await fetch('/api/shopify/delete-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          if (!block.trim()) continue;
          let event = 'message';
          let dataStr = '';

          const blockLines = block.split('\n');
          for (const line of blockLines) {
            if (line.startsWith('event: ')) event = line.replace('event: ', '').trim();
            else if (line.startsWith('data: ')) dataStr = line.replace('data: ', '').trim();
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            const time = new Date().toLocaleTimeString();

            if (event === 'start') {
              setDeleteStatusMessage(data.message || 'Starting deletion...');
              setDeleteLogs(prev => [...prev, { time, type: 'info', message: data.message }]);
            } else if (event === 'progress') {
              setDeleteProgress(data.percent !== undefined ? data.percent : 0);
              setDeleteStatusMessage(data.message || `Deleting ${data.currentTitle}...`);
              setDeleteLogs(prev => [
                ...prev,
                {
                  time,
                  type: data.status === 'deleted' ? 'success' : data.status === 'failed' ? 'error' : 'info',
                  message: `[${data.index}/${data.total}] ${data.message || data.currentTitle}`
                }
              ]);
            } else if (event === 'complete') {
              setIsDeleting(false);
              setIsCompleted(true);
              setDeleteProgress(100);
              setDeleteStatusMessage(data.message || 'Deletion completed!');
              setDeleteStats(data.results ? {
                total: data.results.total || 0,
                deleted: data.results.deleted || 0,
                failed: data.results.failed || 0
              } : { total: 0, deleted: 0, failed: 0 });
              setDeleteLogs(prev => [
                ...prev,
                { time, type: 'complete', message: `🎉 ${data.message}` }
              ]);
              // Refresh collections list
              loadDestCollections();
            } else if (event === 'error') {
              setIsDeleting(false);
              setDeleteStatusMessage(`Error: ${data.message}`);
              setDeleteLogs(prev => [
                ...prev,
                { time, type: 'error', message: `Error: ${data.message}` }
              ]);
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      setIsDeleting(false);
      setDeleteStatusMessage(`Deletion error: ${err.message}`);
      setDeleteLogs(prev => [
        ...prev,
        { time: new Date().toLocaleTimeString(), type: 'error', message: `Deletion pipeline failed: ${err.message}` }
      ]);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        width: '100%',
        maxWidth: 960,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #E2E8F0'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFF1F2'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#FFE4E6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #FECDD3'
            }}>
              <Trash2 size={20} color="#E11D48" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#9F1239' }}>
                  Destination Store Collection Cleanup
                </h2>
                <span className="badge" style={{ background: '#FECDD3', color: '#9F1239', fontSize: 11, fontWeight: 700 }}>
                  Destination Only
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#BE123C', marginTop: 2 }}>
                Target Store: <strong>{targetStore?.name || targetStore?.domain || 'Connected Destination Store'}</strong> ({targetStore?.myshopifyDomain || targetStore?.shopUrl})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: 8,
              cursor: 'pointer',
              color: '#9F1239',
              borderRadius: 8
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {!targetStore ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <AlertTriangle size={48} color="#F59E0B" style={{ margin: '0 auto 16px auto' }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                No Destination Store Connected
              </h3>
              <p style={{ fontSize: 14, color: '#64748B', maxWidth: 440, margin: '0 auto 20px auto' }}>
                Please connect your Destination (Target) Store in Tab 1 before using the collection cleanup tool.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onNavigateToConnect?.();
                }}
                className="btn btn-primary"
              >
                Go to Connect Stores
              </button>
            </div>
          ) : isDeleting || isCompleted ? (
            /* Live Deletion Progress View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{
                background: isCompleted ? '#ECFDF5' : '#FFF1F2',
                border: `1px solid ${isCompleted ? '#A7F3D0' : '#FECDD3'}`,
                borderRadius: 14,
                padding: 20,
                textAlign: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
                  {isDeleting ? (
                    <Loader2 size={24} className="spin" color="#E11D48" />
                  ) : (
                    <CheckCircle2 size={28} color="#059669" />
                  )}
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: isCompleted ? '#065F46' : '#9F1239' }}>
                    {isCompleted ? 'Deletion Process Finished' : 'Deleting Collections from Destination Store'}
                  </h3>
                </div>
                <p style={{ fontSize: 14, color: isCompleted ? '#047857' : '#BE123C', fontWeight: 600 }}>
                  {deleteStatusMessage}
                </p>

                {/* Progress Bar */}
                <div style={{
                  width: '100%',
                  height: 10,
                  background: '#E2E8F0',
                  borderRadius: 9999,
                  overflow: 'hidden',
                  margin: '16px 0 8px 0'
                }}>
                  <div style={{
                    width: `${deleteProgress}%`,
                    height: '100%',
                    background: isCompleted ? '#10B981' : '#E11D48',
                    transition: 'width 0.25s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B' }}>
                  <span>Progress</span>
                  <span style={{ fontWeight: 700 }}>{deleteProgress}%</span>
                </div>
              </div>

              {/* Stats Summary */}
              {isCompleted && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  textAlign: 'center'
                }}>
                  <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Total Processed</span>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{deleteStats.total}</p>
                  </div>
                  <div style={{ background: '#ECFDF5', padding: 12, borderRadius: 10, border: '1px solid #A7F3D0' }}>
                    <span style={{ fontSize: 11, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>Successfully Deleted</span>
                    <p style={{ fontSize: 18, fontWeight: 800, color: '#059669', marginTop: 2 }}>{deleteStats.deleted}</p>
                  </div>
                  <div style={{ background: deleteStats.failed > 0 ? '#FFF1F2' : '#F8FAFC', padding: 12, borderRadius: 10, border: `1px solid ${deleteStats.failed > 0 ? '#FECDD3' : '#E2E8F0'}` }}>
                    <span style={{ fontSize: 11, color: deleteStats.failed > 0 ? '#E11D48' : '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Failed</span>
                    <p style={{ fontSize: 18, fontWeight: 800, color: deleteStats.failed > 0 ? '#E11D48' : '#0F172A', marginTop: 2 }}>{deleteStats.failed}</p>
                  </div>
                </div>
              )}

              {/* Real-time Logs Console */}
              <div style={{
                background: '#0F172A',
                color: '#E2E8F0',
                borderRadius: 12,
                padding: 16,
                maxHeight: 220,
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: 12
              }}>
                {deleteLogs.map((log, index) => (
                  <div key={index} style={{
                    marginBottom: 4,
                    color: log.type === 'error' ? '#F87171' : log.type === 'success' ? '#4ADE80' : log.type === 'complete' ? '#60A5FA' : '#CBD5E1'
                  }}>
                    <span style={{ color: '#64748B', marginRight: 8 }}>[{log.time}]</span>
                    {log.message}
                  </div>
                ))}
              </div>

              {isCompleted && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setIsCompleted(false);
                      setDeleteMode(null);
                    }}
                    className="btn btn-secondary"
                  >
                    Back to Collection Manager
                  </button>
                  <button
                    onClick={onClose}
                    className="btn btn-primary"
                  >
                    Done & Close
                  </button>
                </div>
              )}
            </div>
          ) : confirmStep ? (
            /* Safety Confirmation Prompt */
            <div style={{
              background: '#FFF1F2',
              border: '2px solid #FECDD3',
              borderRadius: 16,
              padding: 28,
              textAlign: 'center'
            }}>
              <ShieldAlert size={48} color="#E11D48" style={{ margin: '0 auto 16px auto' }} />
              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#9F1239', marginBottom: 8 }}>
                Are you sure you want to proceed?
              </h3>
              <p style={{ fontSize: 14, color: '#BE123C', maxWidth: 540, margin: '0 auto 18px auto', lineHeight: 1.5 }}>
                {deleteMode === 'all' && (
                  <span>This will permanently delete <strong>ALL ({destCollections.length}) collections</strong> from your Destination Store (<strong>{targetStore?.myshopifyDomain || targetStore?.shopUrl}</strong>).</span>
                )}
                {deleteMode === 'smart' && (
                  <span>This will permanently delete all <strong>Automated / Smart ({smartCollections.length}) collections</strong> from your Destination Store.</span>
                )}
                {deleteMode === 'custom' && (
                  <span>This will permanently delete all <strong>Manual / Custom ({customCollections.length}) collections</strong> from your Destination Store.</span>
                )}
                {deleteMode === 'selected' && (
                  <span>This will permanently delete the <strong>{selectedIds.size} selected collection(s)</strong> from your Destination Store.</span>
                )}
              </p>
              <div style={{
                background: '#FFFFFF',
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid #FECDD3',
                display: 'inline-block',
                marginBottom: 20,
                fontSize: 13,
                color: '#881337',
                fontWeight: 600
              }}>
                ⚠️ This action cannot be undone. Products themselves are preserved in Shopify, but their collection groupings will be removed.
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
                <button
                  onClick={() => setConfirmStep(false)}
                  className="btn btn-secondary"
                  style={{ padding: '10px 20px', fontSize: 14 }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeDeletion}
                  className="btn"
                  style={{
                    background: '#E11D48',
                    color: '#FFFFFF',
                    padding: '10px 24px',
                    fontSize: 14,
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <Trash2 size={16} />
                  <span>Yes, Delete Collections</span>
                </button>
              </div>
            </div>
          ) : (
            /* Standard Collections Management & Delete Actions View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Destination Store Metrics Strip */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 14
              }}>
                <div style={{ background: '#F8FAFC', padding: 16, borderRadius: 12, border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748B', fontSize: 12, fontWeight: 700 }}>
                    <span>TOTAL ON DESTINATION</span>
                    <Layers size={16} color="#64748B" />
                  </div>
                  <p style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                    {loadingCollections ? <Loader2 size={18} className="spin" /> : destCollections.length}
                  </p>
                </div>

                <div style={{ background: '#EEF2FF', padding: 16, borderRadius: 12, border: '1px solid #C7D2FE' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#4F46E5', fontSize: 12, fontWeight: 700 }}>
                    <span>SMART (AUTOMATED)</span>
                    <Sparkles size={16} color="#4F46E5" />
                  </div>
                  <p style={{ fontSize: 24, fontWeight: 800, color: '#4F46E5', marginTop: 4 }}>
                    {loadingCollections ? <Loader2 size={18} className="spin" /> : smartCollections.length}
                  </p>
                </div>

                <div style={{ background: '#F5F3FF', padding: 16, borderRadius: 12, border: '1px solid #DDD6FE' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#7C3AED', fontSize: 12, fontWeight: 700 }}>
                    <span>MANUAL (CUSTOM)</span>
                    <Tag size={16} color="#7C3AED" />
                  </div>
                  <p style={{ fontSize: 24, fontWeight: 800, color: '#7C3AED', marginTop: 4 }}>
                    {loadingCollections ? <Loader2 size={18} className="spin" /> : customCollections.length}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    onClick={loadDestCollections}
                    disabled={loadingCollections}
                    className="btn btn-secondary"
                    style={{ width: '100%', height: '100%', padding: '12px', gap: 8, fontSize: 13 }}
                  >
                    <RefreshCw size={15} className={loadingCollections ? 'spin' : ''} />
                    <span>Refresh Store</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons: 3 Targeted Delete Modes */}
              <div style={{
                background: '#FFF5F5',
                border: '1px solid #FED7D7',
                borderRadius: 14,
                padding: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <Trash2 size={18} color="#E53E3E" />
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: '#9B2C2C' }}>
                    Quick Purge Options for Destination Store
                  </h4>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12
                }}>
                  {/* Option 1: Delete All */}
                  <button
                    onClick={() => promptDelete('all')}
                    disabled={loadingCollections || destCollections.length === 0}
                    className="btn"
                    style={{
                      background: '#E53E3E',
                      color: '#FFFFFF',
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span>💥 Delete ALL Collections</span>
                    <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>
                      Wipe all {destCollections.length} collections
                    </span>
                  </button>

                  {/* Option 2: Delete Only Smart */}
                  <button
                    onClick={() => promptDelete('smart')}
                    disabled={loadingCollections || smartCollections.length === 0}
                    className="btn"
                    style={{
                      background: '#DD6B20',
                      color: '#FFFFFF',
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span>⚡ Delete ONLY Smart</span>
                    <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>
                      Remove {smartCollections.length} automated collections
                    </span>
                  </button>

                  {/* Option 3: Delete Only Manual */}
                  <button
                    onClick={() => promptDelete('custom')}
                    disabled={loadingCollections || customCollections.length === 0}
                    className="btn"
                    style={{
                      background: '#805AD5',
                      color: '#FFFFFF',
                      padding: '12px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      border: 'none',
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <span>🏷️ Delete ONLY Manual</span>
                    <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>
                      Remove {customCollections.length} custom collections
                    </span>
                  </button>
                </div>
              </div>

              {/* Detailed Collection Checklist for Selective Deletion */}
              <div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                      Or Select Specific Collections ({selectedIds.size} selected)
                    </h4>
                  </div>

                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => promptDelete('selected')}
                      className="btn"
                      style={{
                        background: '#E11D48',
                        color: '#FFFFFF',
                        padding: '8px 16px',
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Delete {selectedIds.size} Selected Collection(s)
                    </button>
                  )}
                </div>

                {/* Filter and Search Bar */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      placeholder="Search destination collections by title or handle..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input-field"
                      style={{ paddingLeft: 34, fontSize: 13 }}
                    />
                  </div>

                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="input-field"
                    style={{ width: 160, fontSize: 13 }}
                  >
                    <option value="all">All Types</option>
                    <option value="smart">Smart Only</option>
                    <option value="custom">Manual Only</option>
                  </select>
                </div>

                {/* Selection helper row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 12, color: '#64748B' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleSelectAllFiltered} style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontWeight: 600 }}>Select Filtered</button>
                    <span>&bull;</span>
                    <button onClick={handleDeselectAll} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>Deselect All</button>
                  </div>
                  <span>Showing {filteredList.length} of {destCollections.length}</span>
                </div>

                {/* Collections List Table */}
                <div style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: 12,
                  maxHeight: 280,
                  overflowY: 'auto'
                }}>
                  {loadingCollections ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748B' }}>
                      <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px auto' }} />
                      <p style={{ fontSize: 13 }}>Loading destination store collections...</p>
                    </div>
                  ) : filteredList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#94A3B8', fontSize: 13 }}>
                      No collections found on the destination store.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #E2E8F0' }}>
                        <tr>
                          <th style={{ width: 40, padding: '10px 12px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={filteredList.length > 0 && filteredList.every(c => selectedIds.has(c.id))}
                              onChange={(e) => {
                                if (e.target.checked) handleSelectAllFiltered();
                                else handleDeselectAll();
                              }}
                              style={{ width: 15, height: 15, accentColor: '#E11D48' }}
                            />
                          </th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Collection Title</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Type</th>
                          <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Handle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredList.map((col) => {
                          const isSelected = selectedIds.has(col.id);
                          const isSmart = col.collection_type === 'smart' || (col.rules && col.rules.length > 0);
                          return (
                            <tr
                              key={col.id}
                              onClick={() => handleToggleSelect(col.id)}
                              style={{
                                cursor: 'pointer',
                                background: isSelected ? '#FFF1F2' : '#FFFFFF',
                                borderBottom: '1px solid #F1F5F9'
                              }}
                            >
                              <td style={{ padding: '10px 12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelect(col.id)}
                                  style={{ width: 15, height: 15, accentColor: '#E11D48' }}
                                />
                              </td>
                              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0F172A' }}>
                                {col.title}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span className={`badge ${isSmart ? 'badge-smart' : 'badge-custom'}`} style={{ fontSize: 11 }}>
                                  {isSmart ? 'Smart' : 'Manual'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', color: '#64748B', fontFamily: 'monospace', fontSize: 12 }}>
                                {col.handle}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #F1F5F9',
          background: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: 12, color: '#64748B' }}>
            Operations executed via Shopify Admin API (2024-01) with rate-limit protection.
          </span>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="btn btn-secondary"
            style={{ padding: '8px 18px', fontSize: 13 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
