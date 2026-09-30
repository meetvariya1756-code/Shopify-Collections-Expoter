'use client';

import React from 'react';
import {
  X,
  Key,
  ShieldCheck,
  Copy,
  Check,
  BookOpen
} from 'lucide-react';

export default function ApiGuideModal({ onClose }) {
  const [copiedScope, setCopiedScope] = React.useState('');

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedScope(text);
    setTimeout(() => setCopiedScope(''), 2000);
  };

  const requiredScopes = [
    { name: 'read_products', desc: 'Read smart/custom collections, rules, and product tags' },
    { name: 'write_products', desc: 'Create and update collections and smart rule conditions' },
    { name: 'read_product_listings', desc: 'Read product handles for collection association' }
  ];

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
              <BookOpen size={20} color="#4F46E5" />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                Shopify API Token Setup Guide
              </h3>
              <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                How to generate Admin API access tokens in Shopify
              </p>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-secondary" style={{ padding: 6, borderRadius: '50%' }}>
            <X size={16} color="#64748B" />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Step 1 */}
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#4F46E5',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 800,
              flexShrink: 0
            }}>
              1
            </div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                Navigate to App Development in Shopify Admin
              </h4>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                Log in to your Shopify store admin &rarr; click <strong>Settings</strong> (bottom left) &rarr; select <strong>Apps and sales channels</strong> &rarr; click <strong>Develop apps</strong> &rarr; click <strong>Create an app</strong>.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#4F46E5',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 800,
              flexShrink: 0
            }}>
              2
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                Configure Admin API Scopes
              </h4>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, marginBottom: 10 }}>
                Click <strong>Configure Admin API scopes</strong> and enable the following permissions:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {requiredScopes.map((scope) => (
                  <div
                    key={scope.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#F8FAFC',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0'
                    }}
                  >
                    <div>
                      <code style={{ fontSize: 12, color: '#4F46E5', fontWeight: 700 }}>{scope.name}</code>
                      <p style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{scope.desc}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(scope.name)}
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: 11 }}
                      title="Copy scope name"
                    >
                      {copiedScope === scope.name ? <Check size={12} color="#059669" /> : <Copy size={12} color="#64748B" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#4F46E5',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 800,
              flexShrink: 0
            }}>
              3
            </div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                Install App & Reveal Access Token
              </h4>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                Click <strong>Save</strong> &rarr; click <strong>Install app</strong> &rarr; under <em>Admin API access token</em>, click <strong>Reveal token once</strong>. Copy the token starting with <code style={{ color: '#059669', fontWeight: 700 }}>shpat_...</code> and paste it into this app.
              </p>
            </div>
          </div>

          {/* Security Note */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10
          }}>
            <ShieldCheck size={18} color="#059669" flexShrink={0} style={{ marginTop: 2 }} />
            <p style={{ fontSize: 12, color: '#065F46', lineHeight: 1.5 }}>
              <strong>Security Guarantee:</strong> Your Admin API tokens never leave your local browser session. They are only sent over encrypted HTTPS calls directly to authenticate with Shopify.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'flex-end',
          background: '#F8FAFC'
        }}>
          <button onClick={onClose} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 13 }}>
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
