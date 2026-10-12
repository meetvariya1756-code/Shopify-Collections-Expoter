'use client';

import React, { useState, useEffect } from 'react';
import {
  Store,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Trash2,
  Sparkles,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import axios from 'axios';
import SetupGuideModal from './SetupGuideModal';

const SHOPIFY_DOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
const SHOW_DESTINATION_CARD = false;
const SHOW_INFO_SECTIONS = false;
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com';

export default function StoreConnector({
  sourceStore,
  setSourceStore,
  targetStore,
  setTargetStore,
  onProceedToExport,
  onProceedToImport
}) {
  // Destination form state
  const [targetUrl, setTargetUrl] = useState(targetStore?.shopUrl || '');
  const [connectingTarget, setConnectingTarget] = useState(false);
  const [targetError, setTargetError] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Load existing destination link on mount if not already loaded
  useEffect(() => {
    let mounted = true;
    async function loadExistingDestination() {
      if (targetStore?.shopUrl) return;
      try {
        const res = await axios.get('/api/shopify/destination');
        if (res.data?.connected && res.data?.destinationShop && mounted) {
          const destDomain = res.data.destinationShop;
          setTargetStore({
            shopUrl: destDomain,
            domain: destDomain,
            name: destDomain.replace('.myshopify.com', '')
          });
        }
      } catch (_) {}
    }

    loadExistingDestination();
    return () => { mounted = false; };
  }, [targetStore, setTargetStore]);

  // Connect Destination Store via Shopify OAuth
  const handleConnectDestination = async (e) => {
    e?.preventDefault();
    setTargetError('');

    let domain = (targetUrl || '').trim().toLowerCase();
    // Auto-append .myshopify.com if handle alone was provided
    if (domain && !domain.includes('.')) {
      domain = `${domain}.myshopify.com`;
      setTargetUrl(domain);
    }

    if (!domain) {
      setTargetError('Please enter a destination store domain.');
      return;
    }

    // Validate format ^[a-z0-9][a-z0-9-]*\.myshopify\.com$
    if (!SHOPIFY_DOMAIN_REGEX.test(domain)) {
      setTargetError('Invalid domain format. Must be formatted like: store-name.myshopify.com');
      return;
    }

    if (sourceStore?.shopUrl && domain === sourceStore.shopUrl.toLowerCase()) {
      setTargetError('Destination store cannot be the same as your source store.');
      return;
    }

    setConnectingTarget(true);

    try {
      const res = await axios.post('/api/shopify/destination/start', {
        destinationShop: domain
      });

      if (res.data?.success && res.data?.authorizeUrl) {
        const authorizeUrl = res.data.authorizeUrl;

        // Requirement: Must open with a TOP-LEVEL redirect (App Bridge open(url, "_top"), not inside iframe)
        if (typeof window !== 'undefined') {
          if (window.shopify && typeof window.shopify.open === 'function') {
            window.shopify.open(authorizeUrl, '_top');
          } else if (window.top) {
            window.top.location.href = authorizeUrl;
          } else {
            window.location.href = authorizeUrl;
          }
        }
      } else {
        setTargetError(res.data?.error || 'Failed to start Shopify authorization.');
        setConnectingTarget(false);
      }
    } catch (err) {
      setTargetError(err.response?.data?.error || err.message || 'Failed to initiate OAuth authorization.');
      setConnectingTarget(false);
    }
  };

  // Disconnect Destination Store (deletes ShopLink)
  const handleDisconnectTarget = async () => {
    if (!targetStore?.shopUrl) return;

    setDisconnecting(true);
    setTargetError('');

    try {
      await axios.post('/api/shopify/destination/disconnect', {
        destinationShop: targetStore.shopUrl
      });
      setTargetStore(null);
      setTargetUrl('');
    } catch (err) {
      setTargetError(err.response?.data?.error || err.message || 'Failed to disconnect destination store.');
    } finally {
      setDisconnecting(false);
    }
  };

  const sourceDomain = sourceStore?.shopUrl || sourceStore?.domain || 'Shopify Source Store';
  const sourceName = sourceStore?.name || (sourceStore?.shopUrl ? sourceStore.shopUrl.replace('.myshopify.com', '') : 'Connected Store');

  return (
    <div className="store-connector-container" style={{ maxWidth: 1240, margin: '0 auto', padding: '40px 20px', width: '100%', boxSizing: 'border-box' }}>
      {/* Header Banner */}
      {SHOW_INFO_SECTIONS && (
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
            <span>Shopify OAuth 2.0 &bull; Multi-Store Collection Sync</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.6px', color: '#0F172A', marginBottom: 12 }}>
            Connected Shopify Stores
          </h1>
          <p style={{ fontSize: 15, color: '#475569', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
            Authenticated securely using official Shopify OAuth session tokens. Your source store is connected automatically from Shopify Admin.
          </p>
        </div>
      )}

      {/* Grid of Two Store Cards */}
      <div className="store-connector-card-grid" style={{
        display: 'grid',
        gridTemplateColumns: SHOW_DESTINATION_CARD ? 'repeat(auto-fit, minmax(460px, 1fr))' : '1fr',
        maxWidth: SHOW_DESTINATION_CARD ? 'none' : '680px',
        margin: SHOW_DESTINATION_CARD ? '0 0 36px 0' : '0 auto 36px auto',
        gap: 28,
        marginBottom: 36,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* SOURCE STORE CARD - Pure OAuth / Verified Session */}
        <div className="glass-panel source-store-card" style={{
          padding: 32,
          borderRadius: '16px',
          border: '2px solid #10B981',
          background: '#FFFFFF',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Store size={24} color="#059669" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Source Store</h3>
                  <span className="badge badge-success" style={{ fontSize: 11 }}>
                    Connected
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  Where your collections and tags will be exported from
                </p>
              </div>
            </div>
          </div>

          {/* Details Card */}
          <div style={{
            background: '#F8FAFC',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #E2E8F0',
            marginBottom: 24
          }}>
            <div className="source-card-details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
              <div>
                <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Store Name</span>
                <p style={{ fontWeight: 700, color: '#0F172A', marginTop: 3, fontSize: 14 }}>{sourceName}</p>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Myshopify Domain</span>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#059669', fontWeight: 600, marginTop: 3 }}>{sourceDomain}</p>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Connection Type</span>
                <p style={{ fontWeight: 600, color: '#0F172A', marginTop: 3 }}>Shopify Session Token</p>
              </div>
              <div>
                <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Token Security</span>
                <p style={{ fontWeight: 600, color: '#059669', marginTop: 3 }}>Server Encrypted (AES-256)</p>
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

        {/* DESTINATION STORE CARD - OAuth Connect / Disconnect */}
        {SHOW_DESTINATION_CARD && (
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

            {/* Disconnect Destination Button */}
            {targetStore && (
              <button
                id="disconnect-destination-btn"
                onClick={handleDisconnectTarget}
                disabled={disconnecting}
                title="Disconnect destination store"
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12, color: '#E11D48', border: '1px solid #FECDD3' }}
              >
                {disconnecting ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                <span>Disconnect destination</span>
              </button>
            )}
          </div>

          {/* Connected View */}
          {targetStore ? (
            <div>
              <div style={{
                background: '#F8FAFC',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #E2E8F0',
                marginBottom: 24
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Store Name</span>
                    <p style={{ fontWeight: 700, color: '#0F172A', marginTop: 3, fontSize: 14 }}>
                      {targetStore.name || targetStore.shopUrl?.replace('.myshopify.com', '') || 'Destination Store'}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Myshopify Domain</span>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#7C3AED', fontWeight: 600, marginTop: 3 }}>
                      {targetStore.shopUrl || targetStore.domain}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Link Status</span>
                    <p style={{ fontWeight: 600, color: '#7C3AED', marginTop: 3 }}>Authorized via ShopLink</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Token Security</span>
                    <p style={{ fontWeight: 600, color: '#059669', marginTop: 3 }}>Server Encrypted (AES-256)</p>
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
            /* Connection Form - Single Domain Input with OAuth start */
            <form onSubmit={handleConnectDestination} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label
                  htmlFor="destination-domain-input"
                  style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}
                >
                  Destination Store Domain
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="destination-domain-input"
                    type="text"
                    placeholder="e.g. your-other-store.myshopify.com"
                    value={targetUrl}
                    onChange={(e) => {
                      setTargetUrl(e.target.value);
                      if (targetError) setTargetError('');
                    }}
                    disabled={connectingTarget}
                    className="input-field"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <span style={{ display: 'block', fontSize: 12, color: '#64748B', marginTop: 6 }}>
                  Enter the full <code>store-name.myshopify.com</code> domain to authorize via Shopify OAuth.
                </span>
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
                  alignItems: 'flex-start',
                  gap: 10
                }}>
                  <AlertCircle size={16} flexShrink={0} style={{ marginTop: 2 }} />
                  <span style={{ lineHeight: 1.4 }}>{targetError}</span>
                </div>
              )}

              <button
                id="connect-destination-btn"
                type="submit"
                disabled={connectingTarget || !targetUrl.trim()}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: 14,
                  marginTop: 4,
                  background: '#7C3AED'
                }}
              >
                {connectingTarget ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>Opening Shopify Authorization...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink size={16} />
                    <span>Connect destination store</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}
      </div>

      {/* Setup Guide Link & Support Info */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 4,
        marginBottom: 32,
        fontSize: 13,
        color: '#64748B'
      }}>
        <button
          id="connect-setup-guide-btn"
          type="button"
          onClick={() => setGuideOpen(true)}
          className="btn-setup-guide-pill"
        >
          <HelpCircle size={14} />
          <span>Setup Guide</span>
        </button>

        <span style={{ color: '#64748B', fontSize: 13 }}>
          Need help?{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            style={{
              color: '#4F46E5',
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: '3px'
            }}
          >
            {SUPPORT_EMAIL}
          </a>
        </span>
      </div>

      {/* Setup Guide Modal */}
      <SetupGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Feature Badges */}
      {SHOW_INFO_SECTIONS && (
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
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>Zero Manual Token Hassle</h4>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
              Both stores authenticate securely via standard Shopify OAuth grants. No manual <code>shpat_</code> API keys to copy or paste.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: 22, background: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16 }}>🔒</span>
              </div>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>AES-256 Server-Side Security</h4>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
              Tokens are encrypted using AES-256-GCM and never exposed to client browsers. Access between stores is strictly isolated by verified store links.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
