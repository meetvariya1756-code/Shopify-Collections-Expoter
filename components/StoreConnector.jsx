'use client';

import React, { useState } from 'react';
import {
  Store,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Trash2,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';
import axios from 'axios';

export default function StoreConnector({
  sourceStore,
  setSourceStore,
  targetStore,
  setTargetStore,
  onProceedToExport,
  onProceedToImport,
  onOpenGuide
}) {
  // Source form state
  const [sourceUrl, setSourceUrl] = useState(sourceStore?.shopUrl || '');
  const [sourceToken, setSourceToken] = useState(sourceStore?.accessToken || '');
  const [showSourceToken, setShowSourceToken] = useState(false);
  const [testingSource, setTestingSource] = useState(false);
  const [sourceError, setSourceError] = useState('');

  // Target form state
  const [targetUrl, setTargetUrl] = useState(targetStore?.shopUrl || '');
  const [targetToken, setTargetToken] = useState(targetStore?.accessToken || '');
  const [showTargetToken, setShowTargetToken] = useState(false);
  const [testingTarget, setTestingTarget] = useState(false);
  const [targetError, setTargetError] = useState('');

  // Test Source Connection
  const handleTestSource = async (e) => {
    e?.preventDefault();
    if (!sourceUrl.trim() || !sourceToken.trim()) {
      setSourceError('Please enter both Store URL and Access Token.');
      return;
    }

    setTestingSource(true);
    setSourceError('');

    try {
      const res = await axios.post('/api/shopify/test-connection', {
        shopUrl: sourceUrl.trim(),
        accessToken: sourceToken.trim()
      });

      if (res.data && res.data.success) {
        const storeData = {
          shopUrl: sourceUrl.trim(),
          accessToken: sourceToken.trim(),
          ...res.data.shop
        };
        setSourceStore(storeData);
        try {
          localStorage.setItem('shopify_source_store', JSON.stringify(storeData));
        } catch (_) {}
      } else {
        setSourceError(res.data?.error || 'Connection failed. Please verify credentials.');
      }
    } catch (err) {
      setSourceError(err.response?.data?.error || err.message || 'Connection failed.');
    } finally {
      setTestingSource(false);
    }
  };

  // Test Target Connection
  const handleTestTarget = async (e) => {
    e?.preventDefault();
    if (!targetUrl.trim() || !targetToken.trim()) {
      setTargetError('Please enter both Store URL and Access Token.');
      return;
    }

    setTestingTarget(true);
    setTargetError('');

    try {
      const res = await axios.post('/api/shopify/test-connection', {
        shopUrl: targetUrl.trim(),
        accessToken: targetToken.trim()
      });

      if (res.data && res.data.success) {
        const storeData = {
          shopUrl: targetUrl.trim(),
          accessToken: targetToken.trim(),
          ...res.data.shop
        };
        setTargetStore(storeData);
        try {
          localStorage.setItem('shopify_target_store', JSON.stringify(storeData));
        } catch (_) {}
      } else {
        setTargetError(res.data?.error || 'Connection failed. Please verify credentials.');
      }
    } catch (err) {
      setTargetError(err.response?.data?.error || err.message || 'Connection failed.');
    } finally {
      setTestingTarget(false);
    }
  };

  const handleDisconnectSource = () => {
    setSourceStore(null);
    setSourceUrl('');
    setSourceToken('');
    try { localStorage.removeItem('shopify_source_store'); } catch (_) {}
  };

  const handleDisconnectTarget = () => {
    setTargetStore(null);
    setTargetUrl('');
    setTargetToken('');
    try { localStorage.removeItem('shopify_target_store'); } catch (_) {}
  };

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', padding: '40px 20px' }}>
      {/* Header Banner */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#EEF2FF',
          border: '1px solid #C7D2FE',
          padding: '6px 16px',
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 600,
          color: '#4F46E5',
          marginBottom: 16
        }}>
          <Sparkles size={15} color="#4F46E5" />
          <span>Shopify Admin API &bull; Excel (.xlsx) Zero Data-Loss Migration</span>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.6px', color: '#0F172A', marginBottom: 12 }}>
          Connect Your Shopify Stores
        </h1>
        <p style={{ fontSize: 15, color: '#475569', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
          Export all collections with smart rules, product tags, images, and descriptions to Excel &mdash; then import or sync them directly into any Shopify store.
        </p>
      </div>

      {/* Grid of Two Store Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: 28,
        marginBottom: 36
      }}>
        {/* SOURCE STORE CARD */}
        <div className="glass-panel" style={{
          padding: 32,
          borderRadius: '16px',
          border: sourceStore ? '2px solid #10B981' : '1px solid #E2E8F0',
          background: '#FFFFFF',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: sourceStore ? '#ECFDF5' : '#EEF2FF',
                border: `1px solid ${sourceStore ? '#A7F3D0' : '#C7D2FE'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Store size={24} color={sourceStore ? '#059669' : '#4F46E5'} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Source Store</h3>
                  <span className={`badge ${sourceStore ? 'badge-success' : ''}`} style={{ fontSize: 11 }}>
                    {sourceStore ? 'Connected' : 'Export From'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  Where your collections and tags will be exported from
                </p>
              </div>
            </div>

            {sourceStore && (
              <button
                onClick={handleDisconnectSource}
                title="Disconnect store"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12, color: '#E11D48', border: '1px solid #FECDD3' }}
              >
                <Trash2 size={13} />
                <span>Disconnect</span>
              </button>
            )}
          </div>

          {/* Connected View */}
          {sourceStore ? (
            <div>
              <div style={{
                background: '#F8FAFC',
                borderRadius: '12px',
                padding: '18px 20px',
                border: '1px solid #E2E8F0',
                marginBottom: 24
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Store Name</span>
                    <p style={{ fontWeight: 700, color: '#0F172A', marginTop: 2, fontSize: 14 }}>{sourceStore.name || 'Shopify Store'}</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Domain</span>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#059669', fontWeight: 600, marginTop: 2 }}>{sourceStore.domain || sourceStore.myshopifyDomain}</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Currency</span>
                    <p style={{ fontWeight: 600, color: '#0F172A', marginTop: 2 }}>{sourceStore.currency || 'USD'}</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Plan</span>
                    <p style={{ fontWeight: 600, color: '#0F172A', marginTop: 2 }}>{sourceStore.plan_name || 'Active'}</p>
                  </div>
                </div>
              </div>

              <button
                id="go-to-export-btn"
                onClick={onProceedToExport}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px 20px', fontSize: 14 }}
              >
                <span>Explore & Export Collections</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            /* Connection Form */
            <form onSubmit={handleTestSource} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  Shopify Store URL / Myshopify Domain
                </label>
                <input
                  id="source-store-url"
                  type="text"
                  placeholder="e.g. your-store.myshopify.com"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="input-field"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    Admin API Access Token (shpat_...)
                  </label>
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4F46E5',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <HelpCircle size={13} />
                    <span>Need a token?</span>
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="source-access-token"
                    type={showSourceToken ? 'text' : 'password'}
                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                    value={sourceToken}
                    onChange={(e) => setSourceToken(e.target.value)}
                    className="input-field font-mono"
                    style={{
                      paddingRight: 40,
                      fontSize: 13
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSourceToken(!showSourceToken)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer'
                    }}
                  >
                    {showSourceToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {sourceError && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: '#FFF1F2',
                  border: '1px solid #FECDD3',
                  color: '#BE123C',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <AlertCircle size={16} flexShrink={0} />
                  <span>{sourceError}</span>
                </div>
              )}

              <button
                id="test-source-btn"
                type="submit"
                disabled={testingSource || !sourceUrl || !sourceToken}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: 14,
                  marginTop: 4
                }}
              >
                {testingSource ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Connect Source Store</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* TARGET STORE CARD */}
        <div className="glass-panel" style={{
          padding: 32,
          borderRadius: '16px',
          border: targetStore ? '2px solid #7C3AED' : '1px solid #E2E8F0',
          background: '#FFFFFF',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: targetStore ? '#F5F3FF' : '#F8FAFC',
                border: `1px solid ${targetStore ? '#DDD6FE' : '#E2E8F0'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Store size={24} color={targetStore ? '#7C3AED' : '#0284C7'} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Destination Store</h3>
                  <span className={`badge ${targetStore ? 'badge-smart' : ''}`} style={{ fontSize: 11 }}>
                    {targetStore ? 'Connected' : 'Import Into'}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  Where imported collections and rules will be created
                </p>
              </div>
            </div>

            {targetStore && (
              <button
                onClick={handleDisconnectTarget}
                title="Disconnect store"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12, color: '#E11D48', border: '1px solid #FECDD3' }}
              >
                <Trash2 size={13} />
                <span>Disconnect</span>
              </button>
            )}
          </div>

          {/* Connected View */}
          {targetStore ? (
            <div>
              <div style={{
                background: '#F8FAFC',
                borderRadius: '12px',
                padding: '18px 20px',
                border: '1px solid #E2E8F0',
                marginBottom: 24
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, fontSize: 13 }}>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Store Name</span>
                    <p style={{ fontWeight: 700, color: '#0F172A', marginTop: 2, fontSize: 14 }}>{targetStore.name || 'Target Shopify Store'}</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Domain</span>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#7C3AED', fontWeight: 600, marginTop: 2 }}>{targetStore.domain || targetStore.myshopifyDomain}</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Currency</span>
                    <p style={{ fontWeight: 600, color: '#0F172A', marginTop: 2 }}>{targetStore.currency || 'USD'}</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Plan</span>
                    <p style={{ fontWeight: 600, color: '#0F172A', marginTop: 2 }}>{targetStore.plan_name || 'Active'}</p>
                  </div>
                </div>
              </div>

              <button
                id="go-to-import-btn"
                onClick={onProceedToImport}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  fontSize: 14,
                  background: '#7C3AED'
                }}
              >
                <span>Go to Excel Import Studio</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            /* Connection Form */
            <form onSubmit={handleTestTarget} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  Destination Store URL / Myshopify Domain
                </label>
                <input
                  id="target-store-url"
                  type="text"
                  placeholder="e.g. target-store.myshopify.com"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className="input-field font-mono"
                  style={{ fontSize: 13 }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    Admin API Access Token (shpat_...)
                  </label>
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#7C3AED',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <HelpCircle size={13} />
                    <span>Setup guide</span>
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="target-access-token"
                    type={showTargetToken ? 'text' : 'password'}
                    placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                    value={targetToken}
                    onChange={(e) => setTargetToken(e.target.value)}
                    className="input-field font-mono"
                    style={{
                      paddingRight: 40,
                      fontSize: 13
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTargetToken(!showTargetToken)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer'
                    }}
                  >
                    {showTargetToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {targetError && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: '#FFF1F2',
                  border: '1px solid #FECDD3',
                  color: '#BE123C',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  <AlertCircle size={16} flexShrink={0} />
                  <span>{targetError}</span>
                </div>
              )}

              <button
                id="test-target-btn"
                type="submit"
                disabled={testingTarget || !targetUrl || !targetToken}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: 14,
                  marginTop: 4,
                  background: '#7C3AED'
                }}
              >
                {testingTarget ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Connect Destination Store</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Feature Badges */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 20
      }}>
        <div className="glass-panel" style={{ padding: 22, background: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16 }}>📊</span>
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>100% Excel Fidelity (.xlsx)</h4>
          </div>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
            All smart rule conditions, product tags, product handles, image URLs, and sort orders are preserved in standard Microsoft Excel columns.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: 22, background: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16 }}>⚡</span>
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Duplicate Skipping Built-in</h4>
          </div>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
            Collections that already exist in your destination store are automatically detected and skipped, while all new collections are safely imported.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: 22, background: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 16 }}>🔒</span>
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Zero Cloud Storage</h4>
          </div>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
            Your tokens and store data are never stored in external databases. Everything executes directly in-memory through official Shopify APIs.
          </p>
        </div>
      </div>
    </div>
  );
}
