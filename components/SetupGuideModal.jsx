'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  RefreshCw,
  Filter,
  FileSpreadsheet,
  Download,
  Store,
  UploadCloud,
  CheckCircle2,
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Lock,
  BookOpen
} from 'lucide-react';

export default function SetupGuideModal({ open, onClose }) {
  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'import'
  const [currentStep, setCurrentStep] = useState(0);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const exportSteps = [
    {
      number: 1,
      icon: Layers,
      title: 'Open Collections & Export tab',
      hint: 'Click tab 2 in the top navigation bar.',
      mock: (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#F1F5F9',
          padding: '6px 10px',
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          fontSize: 12
        }}>
          <span style={{ color: '#94A3B8', padding: '4px 8px' }}>1. Connect Stores</span>
          <span style={{
            background: '#FFFFFF',
            color: '#4F46E5',
            fontWeight: 700,
            padding: '5px 12px',
            borderRadius: 7,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}>
            <Layers size={13} color="#4F46E5" />
            2. Collections & Export
          </span>
          <span style={{ color: '#94A3B8', padding: '4px 8px' }}>3. Excel Import</span>
        </div>
      )
    },
    {
      number: 2,
      icon: RefreshCw,
      title: 'Collections load from store',
      hint: 'Click Refresh From Store if newly added items are missing.',
      mock: (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#F8FAFC',
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid #E2E8F0'
        }}>
          <span style={{
            background: '#EEF2FF',
            color: '#4F46E5',
            border: '1px solid #C7D2FE',
            fontSize: 12,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 6
          }}>
            18 Collections Loaded
          </span>
          <span style={{
            background: '#FFFFFF',
            color: '#0F172A',
            border: '1px solid #CBD5E1',
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
          }}>
            <RefreshCw size={12} color="#64748B" />
            Refresh From Store
          </span>
        </div>
      )
    },
    {
      number: 3,
      icon: Filter,
      title: 'Filter or select target collections',
      hint: 'Filter by type (All, Smart, Custom) or select specific rows.',
      mock: (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          background: '#F8FAFC',
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid #E2E8F0'
        }}>
          <span style={{
            background: '#4F46E5',
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 999
          }}>
            All (18)
          </span>
          <span style={{
            background: '#F5F3FF',
            color: '#7C3AED',
            border: '1px solid #DDD6FE',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 999
          }}>
            Smart (12)
          </span>
          <span style={{
            background: '#F0F9FF',
            color: '#0284C7',
            border: '1px solid #BAE6FD',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 999
          }}>
            Custom (6)
          </span>
          <span style={{
            background: '#FFFFFF',
            color: '#334155',
            border: '1px solid #CBD5E1',
            fontSize: 11,
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: 6
          }}>
            ✓ Select Filtered
          </span>
        </div>
      )
    },
    {
      number: 4,
      icon: FileSpreadsheet,
      title: 'Click Export to Excel button',
      hint: 'Generates a clean spreadsheet with rules, tags, and images.',
      mock: (
        <div style={{
          background: '#059669',
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: 700,
          padding: '10px 18px',
          borderRadius: 8,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 10px rgba(5, 150, 105, 0.25)'
        }}>
          <FileSpreadsheet size={16} color="#FFFFFF" />
          <span>Export 18 Collections to Excel (.xlsx)</span>
        </div>
      )
    },
    {
      number: 5,
      icon: Download,
      title: 'Excel file downloads to device',
      hint: 'Keep your .xlsx file safe for backup or store migration.',
      mock: (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 12,
          color: '#065F46',
          fontFamily: 'var(--font-mono)'
        }}>
          <Download size={14} color="#059669" />
          <span style={{ fontWeight: 600 }}>Store_Collections_Export.xlsx</span>
          <span style={{ color: '#047857', fontSize: 11 }}>(38 KB)</span>
        </div>
      )
    }
  ];

  const importSteps = [
    {
      number: 1,
      icon: Store,
      title: 'Open app in receiving store',
      hint: 'Verify the lock reads "Importing into: <your-store>".',
      mock: (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          color: '#065F46'
        }}>
          <Lock size={13} color="#059669" />
          <span>Importing into:</span>
          <code style={{ fontFamily: 'var(--font-mono)', color: '#047857' }}>
            your-store.myshopify.com
          </code>
        </div>
      )
    },
    {
      number: 2,
      icon: FileSpreadsheet,
      title: 'Open Excel Import tab',
      hint: 'Optional: download sample template to check formatting.',
      mock: (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#F8FAFC',
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid #E2E8F0'
        }}>
          <span style={{
            background: '#FFFFFF',
            color: '#4F46E5',
            fontWeight: 700,
            fontSize: 12,
            padding: '5px 12px',
            borderRadius: 7,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}>
            <FileSpreadsheet size={13} color="#4F46E5" />
            3. Excel Import
          </span>
          <span style={{
            background: '#FFFFFF',
            color: '#475569',
            border: '1px solid #CBD5E1',
            fontSize: 12,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}>
            <Download size={12} />
            Download Sample Template
          </span>
        </div>
      )
    },
    {
      number: 3,
      icon: UploadCloud,
      title: 'Drop or browse your spreadsheet',
      hint: 'Supports spreadsheets up to 5 MB and 1,000 rows.',
      mock: (
        <div style={{
          width: '100%',
          maxWidth: 360,
          border: '2px dashed #CBD5E1',
          background: '#F8FAFC',
          borderRadius: 10,
          padding: '16px 20px',
          textAlign: 'center'
        }}>
          <UploadCloud size={24} color="#6366F1" style={{ margin: '0 auto 6px' }} />
          <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
            Drag & drop .xlsx file here or browse
          </p>
          <span style={{ fontSize: 11, color: '#64748B' }}>
            Max 5 MB &bull; Up to 1,000 collections
          </span>
        </div>
      )
    },
    {
      number: 4,
      icon: CheckCircle2,
      title: 'Review preview counts and strategy',
      hint: 'Check NEW/EXISTS/ERROR and pick duplicate strategy.',
      mock: (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: '#F8FAFC',
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid #E2E8F0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              background: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6
            }}>
              18 NEW
            </span>
            <span style={{
              background: '#FFFBEB',
              color: '#D97706',
              border: '1px solid #FDE68A',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6
            }}>
              0 ALREADY EXISTS
            </span>
            <span style={{
              background: '#FFF1F2',
              color: '#E11D48',
              border: '1px solid #FECDD3',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 6
            }}>
              0 ERROR
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#475569' }}>
            Duplicate Strategy: <strong>Skip existing (Safe)</strong>
          </span>
        </div>
      )
    },
    {
      number: 5,
      icon: Layers,
      title: 'Click Import, then Confirm',
      hint: 'Double-check target store in modal before confirming.',
      mock: (
        <div style={{
          background: '#7C3AED',
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: 700,
          padding: '10px 18px',
          borderRadius: 8,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 4px 10px rgba(124, 58, 237, 0.25)'
        }}>
          <span>Import 18 Collections into Store</span>
          <ArrowRight size={15} color="#FFFFFF" />
        </div>
      )
    },
    {
      number: 6,
      icon: Activity,
      title: 'Watch progress and download report',
      hint: 'Live SSE stream updates counts; check Shopify Admin.',
      mock: (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: '#F8FAFC',
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          width: '100%',
          maxWidth: 360
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#059669', fontWeight: 700 }}>✓ Import Complete (18 / 18)</span>
            <span style={{ color: '#64748B', fontFamily: 'var(--font-mono)' }}>100%</span>
          </div>
          <div style={{
            width: '100%',
            height: 6,
            background: '#E2E8F0',
            borderRadius: 999,
            overflow: 'hidden'
          }}>
            <div style={{ width: '100%', height: '100%', background: '#059669' }} />
          </div>
          <span style={{
            background: '#FFFFFF',
            color: '#4F46E5',
            border: '1px solid #C7D2FE',
            fontSize: 11,
            fontWeight: 700,
            padding: '4px 10px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
            <Download size={12} />
            Download Result Report (.xlsx)
          </span>
        </div>
      )
    }
  ];

  const steps = activeTab === 'export' ? exportSteps : importSteps;
  const current = steps[currentStep] || steps[0];
  const StepIcon = current.icon;
  const isLastStep = currentStep === steps.length - 1;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentStep(0);
  };

  const handleNext = () => {
    if (isLastStep) {
      onClose?.();
    } else {
      setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-guide-title"
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 620,
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
          padding: '18px 24px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#F8FAFC'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#EEF2FF',
              border: '1px solid #C7D2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BookOpen size={18} color="#4F46E5" />
            </div>
            <div>
              <h2
                id="setup-guide-title"
                style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}
              >
                App Setup & Migration Guide
              </h2>
              <p style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Visual walkthrough for exporting & importing collections
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close setup guide"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher (Export vs Import) */}
        <div style={{
          padding: '14px 24px 8px',
          background: '#FFFFFF',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: 4,
            background: '#F1F5F9',
            padding: 4,
            borderRadius: 10,
            border: '1px solid #E2E8F0'
          }}>
            <button
              type="button"
              onClick={() => handleTabChange('export')}
              style={{
                background: activeTab === 'export' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'export' ? '#4F46E5' : '#64748B',
                fontWeight: activeTab === 'export' ? 700 : 500,
                fontSize: 13,
                padding: '6px 18px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                boxShadow: activeTab === 'export' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <FileSpreadsheet size={14} color={activeTab === 'export' ? '#4F46E5' : '#64748B'} />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('import')}
              style={{
                background: activeTab === 'import' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'import' ? '#7C3AED' : '#64748B',
                fontWeight: activeTab === 'import' ? 700 : 500,
                fontSize: 13,
                padding: '6px 18px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                boxShadow: activeTab === 'import' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              <UploadCloud size={14} color={activeTab === 'import' ? '#7C3AED' : '#64748B'} />
              <span>Import</span>
            </button>
          </div>

          {/* Step Indicator */}
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#475569',
            fontFamily: 'var(--font-mono)'
          }}>
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>

        {/* Modal Body - Scrollable Step Card */}
        <div style={{
          padding: '24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 20
        }}>
          {/* Progress Dots */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6
          }}>
            {steps.map((st, idx) => {
              const isCurrent = idx === currentStep;
              const isDone = idx < currentStep;
              return (
                <button
                  key={st.number}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  aria-label={`Go to step ${idx + 1}`}
                  style={{
                    height: 8,
                    width: isCurrent ? 24 : 8,
                    borderRadius: 999,
                    background: isCurrent
                      ? (activeTab === 'export' ? '#4F46E5' : '#7C3AED')
                      : isDone
                        ? '#10B981'
                        : '#E2E8F0',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    padding: 0
                  }}
                />
              );
            })}
          </div>

          {/* Main Visual Step Card */}
          <div style={{
            border: '1px solid #E2E8F0',
            borderRadius: 14,
            padding: '22px',
            background: '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            {/* Top step badge & icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: activeTab === 'export' ? '#EEF2FF' : '#F5F3FF',
                border: `1px solid ${activeTab === 'export' ? '#C7D2FE' : '#DDD6FE'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <StepIcon
                  size={20}
                  color={activeTab === 'export' ? '#4F46E5' : '#7C3AED'}
                />
              </div>

              <div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: activeTab === 'export' ? '#4F46E5' : '#7C3AED'
                }}>
                  Step {current.number}
                </span>
                <h3 style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#0F172A',
                  marginTop: 2,
                  lineHeight: 1.3
                }}>
                  {current.title}
                </h3>
              </div>
            </div>

            {/* Hint text (at most one short line) */}
            {current.hint && (
              <p style={{
                fontSize: 13,
                color: '#475569',
                margin: 0,
                lineHeight: 1.5
              }}>
                {current.hint}
              </p>
            )}

            {/* CSS UI Mock */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 88,
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
            }}>
              {current.mock}
            </div>
          </div>

          {/* Import note at the end */}
          {activeTab === 'import' && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12,
              color: '#1E40AF',
              lineHeight: 1.4
            }}>
              <Info size={16} flexShrink={0} style={{ marginTop: 2, color: '#2563EB' }} />
              <span>
                <strong>Note:</strong> Smart collections show products only if products with those tags exist in the store.
              </span>
            </div>
          )}
        </div>

        {/* Footer Navigation (Back / Next / Done) */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#F8FAFC'
        }}>
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              gap: 6,
              opacity: currentStep === 0 ? 0.4 : 1,
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="btn btn-primary"
            style={{
              padding: '8px 20px',
              fontSize: 13,
              gap: 6,
              background: activeTab === 'export' ? '#4F46E5' : '#7C3AED'
            }}
          >
            {isLastStep ? (
              <>
                <Check size={14} />
                <span>Done</span>
              </>
            ) : (
              <>
                <span>Next</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
