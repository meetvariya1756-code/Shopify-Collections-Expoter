'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  RefreshCw,
  Terminal,
  Layers,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LiveProgress({
  migrationState,
  targetStore,
  onResetMigration,
  onViewCollections
}) {
  const { isRunning, isCompleted, progress, currentMessage, logs, stats, error } = migrationState;
  const [logFilter, setLogFilter] = useState('all'); // 'all' | 'success' | 'warning' | 'error'
  const logEndRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Confetti on success
  useEffect(() => {
    if (isCompleted && (stats.created > 0 || stats.updated > 0 || stats.skipped > 0) && stats.failed === 0) {
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (_) {}
    }
  }, [isCompleted, stats]);

  const filteredLogs = (logs || []).filter((log) => {
    if (logFilter === 'all') return true;
    if (logFilter === 'success' && (log.type === 'success' || log.type === 'complete')) return true;
    if (logFilter === 'warning' && log.type === 'warning') return true;
    if (logFilter === 'error' && log.type === 'error') return true;
    return false;
  });

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 28
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px' }}>
              Live Migration Monitor
            </h1>
            {isRunning && (
              <span className="badge badge-smart pulse-glow" style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7C3AED' }} />
                <span>Streaming SSE</span>
              </span>
            )}
            {isCompleted && (
              <span className="badge badge-success" style={{ fontSize: 11 }}>
                Completed
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>
            {targetStore
              ? `Syncing directly to ${targetStore.name || targetStore.domain}`
              : 'Real-time Server-Sent Events pipeline.'}
          </p>
        </div>

        {/* Action button if finished */}
        {isCompleted && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onResetMigration}
              className="btn btn-secondary"
              style={{ padding: '10px 18px', fontSize: 13 }}
            >
              <RefreshCw size={15} />
              <span>Import Another Spreadsheet</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Progress Card */}
      <div className="glass-panel" style={{
        padding: 28,
        background: '#FFFFFF',
        borderRadius: '16px',
        marginBottom: 24
      }}>
        {/* Progress header & percentage */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Migration Status
            </span>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>
              {isRunning
                ? (currentMessage || 'Processing collection batch...')
                : isCompleted
                  ? 'Collection Migration Finished Successfully!'
                  : error
                    ? 'Migration Halted with Errors'
                    : 'Awaiting Migration Job'}
            </h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isCompleted ? '#059669' : '#4F46E5' }}>
              {progress}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: 10,
          borderRadius: 9999,
          background: '#E2E8F0',
          overflow: 'hidden',
          marginBottom: 24,
          position: 'relative'
        }}>
          <div
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              height: '100%',
              background: isCompleted
                ? 'linear-gradient(90deg, #10B981, #059669)'
                : 'linear-gradient(90deg, #4F46E5, #7C3AED)',
              borderRadius: 9999,
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>

        {/* 5 Stats Counters */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 14
        }}>
          {/* Total */}
          <div style={{
            background: '#F8FAFC',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0'
          }}>
            <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</span>
            <p style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: 2, color: '#0F172A' }}>
              {stats.total}
            </p>
          </div>

          {/* Created */}
          <div style={{
            background: '#ECFDF5',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #A7F3D0'
          }}>
            <span style={{ fontSize: 11, color: '#065F46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Created</span>
            <p style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: 2, color: '#059669' }}>
              {stats.created}
            </p>
          </div>

          {/* Updated */}
          <div style={{
            background: '#EEF2FF',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #C7D2FE'
          }}>
            <span style={{ fontSize: 11, color: '#3730A3', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Updated</span>
            <p style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: 2, color: '#4F46E5' }}>
              {stats.updated}
            </p>
          </div>

          {/* Skipped */}
          <div style={{
            background: '#FFFBEB',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #FDE68A'
          }}>
            <span style={{ fontSize: 11, color: '#92400E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Skipped</span>
            <p style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: 2, color: '#D97706' }}>
              {stats.skipped}
            </p>
          </div>

          {/* Failed */}
          <div style={{
            background: '#FFF1F2',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #FECDD3'
          }}>
            <span style={{ fontSize: 11, color: '#9F1239', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Failed</span>
            <p style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', marginTop: 2, color: '#E11D48' }}>
              {stats.failed}
            </p>
          </div>
        </div>
      </div>

      {/* Live Log Terminal */}
      <div className="glass-panel" style={{
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#0F172A',
        border: '1px solid #334155'
      }}>
        {/* Terminal Header */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid #334155',
          background: '#0B0F19',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Terminal size={16} color="#818CF8" />
            <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#CBD5E1' }}>
              PIPELINE EXECUTION LOGS ({filteredLogs.length})
            </span>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'success', 'warning', 'error'].map((f) => (
              <button
                key={f}
                onClick={() => setLogFilter(f)}
                style={{
                  background: logFilter === f ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                  color: logFilter === f ? '#FFFFFF' : '#94A3B8',
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Terminal Body */}
        <div style={{
          padding: 16,
          height: 380,
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          {filteredLogs.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B' }}>
              No log messages yet. Launch an import to view real-time events.
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              let color = '#E2E8F0';
              let badge = 'INFO';
              if (log.type === 'success' || log.type === 'complete') {
                color = '#34D399';
                badge = 'DONE';
              } else if (log.type === 'warning') {
                color = '#FBBF24';
                badge = 'SKIP';
              } else if (log.type === 'error') {
                color = '#FB7185';
                badge = 'FAIL';
              }

              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, lineHeight: 1.5 }}>
                  <span style={{ color: '#64748B', fontSize: 10, flexShrink: 0 }}>
                    [{log.time || new Date().toLocaleTimeString()}]
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color,
                    background: 'rgba(255, 255, 255, 0.08)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    flexShrink: 0
                  }}>
                    {badge}
                  </span>
                  <span style={{ color, wordBreak: 'break-word' }}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
