'use client';

import React from 'react';
import {
  X,
  Sparkles,
  Tag,
  Sliders,
  Layers,
  ListOrdered,
  Package
} from 'lucide-react';

export default function CollectionDetailModal({ collection, onClose }) {
  if (!collection) return null;

  const isSmart = collection.collection_type === 'smart' || (collection.rules && collection.rules.length > 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 680,
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
        {/* Modal Header */}
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
              background: isSmart ? '#F5F3FF' : '#F0F9FF',
              border: `1px solid ${isSmart ? '#DDD6FE' : '#BAE6FD'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isSmart ? <Sparkles size={20} color="#7C3AED" /> : <Layers size={20} color="#0284C7" />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>{collection.title}</h3>
                <span className={`badge ${isSmart ? 'badge-smart' : 'badge-custom'}`}>
                  {isSmart ? 'Smart (Automated)' : 'Custom (Manual)'}
                </span>
              </div>
              <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#64748B', marginTop: 2 }}>
                /{collection.handle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: 6, borderRadius: '50%' }}
          >
            <X size={16} color="#64748B" />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top Info Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            background: '#F8FAFC',
            padding: 16,
            borderRadius: '12px',
            border: '1px solid #E2E8F0'
          }}>
            <div>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sort Order</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <ListOrdered size={14} color="#4F46E5" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{collection.sort_order || 'best-selling'}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Match Criteria</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Sliders size={14} color="#4F46E5" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                  {collection.disjunctive ? 'Match ANY rule' : 'Match ALL rules'}
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Rules Count</span>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
                {collection.rules ? collection.rules.length : 0} conditions
              </p>
            </div>

            <div>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Product Tags</span>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 4 }}>
                {collection.product_tags ? collection.product_tags.length : 0} tags mapped
              </p>
            </div>
          </div>

          {/* Featured Image */}
          {collection.image && collection.image.src && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                Featured Image
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: '#F8FAFC',
                padding: 12,
                borderRadius: '10px',
                border: '1px solid #E2E8F0'
              }}>
                <img
                  src={collection.image.src}
                  alt={collection.image.alt || collection.title}
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0' }}
                />
                <div style={{ overflow: 'hidden' }}>
                  <p style={{ fontSize: 13, color: '#0F172A', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {collection.image.src}
                  </p>
                  {collection.image.alt && (
                    <p style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      Alt: &ldquo;{collection.image.alt}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {collection.body_html && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                Description (HTML)
              </label>
              <div
                style={{
                  background: '#F8FAFC',
                  padding: 14,
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  fontSize: 13,
                  color: '#334155',
                  lineHeight: 1.6,
                  maxHeight: 140,
                  overflowY: 'auto'
                }}
                dangerouslySetInnerHTML={{ __html: collection.body_html }}
              />
            </div>
          )}

          {/* Condition Rules */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
              Automated Collection Rules ({collection.rules?.length || 0})
            </label>
            {collection.rules && collection.rules.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {collection.rules.map((rule, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#F8FAFC',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12
                    }}
                  >
                    <span style={{ color: '#4F46E5', fontWeight: 700 }}>{rule.column}</span>
                    <span style={{ color: '#64748B' }}>{rule.relation}</span>
                    <span style={{
                      background: '#EEF2FF',
                      color: '#4F46E5',
                      border: '1px solid #C7D2FE',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 700
                    }}>
                      &ldquo;{rule.condition}&rdquo;
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>
                No automated rules (Manual custom collection).
              </p>
            )}
          </div>

          {/* Product Tags */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
              Mapped Product Tags ({collection.product_tags?.length || 0})
            </label>
            {collection.product_tags && collection.product_tags.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {collection.product_tags.map((tag, idx) => (
                  <span key={idx} className="badge badge-tag">
                    <Tag size={10} />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>
                No product tags mapped.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'flex-end',
          background: '#F8FAFC'
        }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
