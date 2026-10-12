'use client';

import React from 'react';
import {
  X,
  ShieldCheck,
  Check,
  BookOpen,
  Store,
  KeyRound,
  ExternalLink
} from 'lucide-react';

export default function ApiGuideModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          borderRadius: '16px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#F8FAFC'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#EEF2FF',
              border: '1px solid #C7D2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={20} color="#4F46E5" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                Shopify OAuth Connection Guide
              </h3>
              <p style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                Secure multi-store authentication without manual access tokens
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ width: 32, height: 32, padding: 0, borderRadius: '8px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontWeight: 700, fontSize: 14 }}>
              <Check size={16} />
              <span>No Manual Tokens Required</span>
            </div>
            <p style={{ fontSize: 13, color: '#15803D', marginTop: 6, lineHeight: 1.5 }}>
              This app uses official Shopify OAuth 2.0 with App Bridge session tokens. You no longer need to create Custom Apps or copy <code>shpat_</code> access tokens.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
              How Store Connection Works:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9999, background: '#EEF2FF', color: '#4F46E5', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  1
                </div>
                <div>
                  <h5 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Source Store (Current Store)</h5>
                  <p style={{ fontSize: 13, color: '#64748B', marginTop: 2, lineHeight: 1.5 }}>
                    When you open this app in your Shopify Admin, your session token is verified automatically and your collections are ready to export immediately.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9999, background: '#F5F3FF', color: '#7C3AED', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  2
                </div>
                <div>
                  <h5 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Destination Store (OAuth Link)</h5>
                  <p style={{ fontSize: 13, color: '#64748B', marginTop: 2, lineHeight: 1.5 }}>
                    Enter your destination store&apos;s <code>store-name.myshopify.com</code> domain and click <strong>Connect destination store</strong>. You will be redirected to approve the app on that store.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9999, background: '#ECFDF5', color: '#059669', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  3
                </div>
                <div>
                  <h5 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>AES-256 Server-Side Protection</h5>
                  <p style={{ fontSize: 13, color: '#64748B', marginTop: 2, lineHeight: 1.5 }}>
                    Upon approval, the destination store token is encrypted with AES-256 on the server and linked directly to your source store. You can disconnect at any time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E2E8F0',
          background: '#F8FAFC',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button onClick={onClose} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 13 }}>
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
