'use client';

import React from 'react';

export default function SkeletonLoader() {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Dark Header Skeleton */}
      <div
        style={{
          width: '100%',
          height: 52,
          background: '#141416',
          borderBottom: '1px solid #232326',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: '#27272A' }} />
          <div style={{ width: 140, height: 16, borderRadius: 4, background: '#27272A' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 60, height: 22, borderRadius: 9999, background: '#27272A' }} />
          <div style={{ width: 90, height: 14, borderRadius: 4, background: '#27272A' }} />
          <div style={{ width: 70, height: 28, borderRadius: 6, background: '#27272A' }} />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div style={{ maxWidth: 1200, width: '100%', margin: '40px auto', padding: '0 24px' }}>
        <div
          style={{
            height: 38,
            width: 280,
            borderRadius: 8,
            background: '#E2E8F0',
            marginBottom: 20
          }}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 28
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 100,
                borderRadius: 12,
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                padding: 16
              }}
            >
              <div style={{ width: 80, height: 12, background: '#E2E8F0', borderRadius: 4, marginBottom: 12 }} />
              <div style={{ width: 50, height: 28, background: '#CBD5E1', borderRadius: 6 }} />
            </div>
          ))}
        </div>
        <div
          style={{
            height: 320,
            borderRadius: 14,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            padding: 24
          }}
        >
          <div style={{ width: '40%', height: 20, background: '#E2E8F0', borderRadius: 4, marginBottom: 20 }} />
          <div style={{ width: '100%', height: 40, background: '#F1F5F9', borderRadius: 6, marginBottom: 12 }} />
          <div style={{ width: '100%', height: 40, background: '#F8FAFC', borderRadius: 6, marginBottom: 12 }} />
          <div style={{ width: '100%', height: 40, background: '#F1F5F9', borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}
