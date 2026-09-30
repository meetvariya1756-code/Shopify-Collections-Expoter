'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  Settings2,
  Trash2,
  Eye,
  Check
} from 'lucide-react';
import axios from 'axios';
import CollectionDetailModal from './CollectionDetailModal';
import DestinationCleanerModal from './DestinationCleanerModal';

export default function ExcelImporter({
  targetStore,
  stagedCollections,
  setStagedCollections,
  onStartMigration,
  onNavigateToConnect,
  onOpenGuide
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [showCleanerModal, setShowCleanerModal] = useState(false);

  // Migration Options
  const [conflictStrategy, setConflictStrategy] = useState('skip'); // 'skip' | 'overwrite' | 'create_new'
  const [transferImages, setTransferImages] = useState(true);
  const [mapProducts, setMapProducts] = useState(true);

  const fileInputRef = useRef(null);

  // Handle Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  // Upload and parse .xlsx file via backend API
  const processFile = async (file) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setUploadError('Please select a valid Excel spreadsheet (.xlsx or .xls)');
      return;
    }

    setUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post('/api/shopify/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data && res.data.success) {
        setStagedCollections(res.data.collections || []);
      } else {
        setUploadError(res.data?.error || 'Failed to parse Excel file.');
      }
    } catch (err) {
      setUploadError(err.response?.data?.error || err.message || 'Failed to process Excel file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Download Sample Template
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const response = await axios.get('/api/shopify/template-excel', {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'shopify-collections-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Failed to download template: ${err.message}`);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleTriggerImport = () => {
    if (!targetStore) {
      alert('Please connect a Destination Store before starting the import.');
      return;
    }
    if (!stagedCollections || stagedCollections.length === 0) {
      alert('No collections staged for import.');
      return;
    }

    onStartMigration(stagedCollections, {
      conflictStrategy,
      transferImages,
      mapProducts
    });
  };

  const smartCount = (stagedCollections || []).filter(
    (c) => c.collection_type === 'smart' || (c.rules && c.rules.length > 0)
  ).length;
  const customCount = (stagedCollections || []).length - smartCount;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 20px' }}>
      {/* Title & Description */}
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
              Excel Import & Migration Studio
            </h1>
            <span className="badge badge-smart" style={{ fontSize: 11 }}>
              .XLSX Native
            </span>
          </div>
          <p style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>
            Upload an Excel sheet of collections or download our sample template to build new collections in bulk.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* Destination Store Collection Purge / Delete Tool (DESTINATION ONLY) */}
          <button
            id="open-cleanup-tool-btn"
            onClick={() => setShowCleanerModal(true)}
            className="btn btn-secondary"
            style={{
              padding: '10px 18px',
              fontSize: 13,
              gap: 8,
              background: '#FFF1F2',
              borderColor: '#FECDD3',
              color: '#BE123C',
              fontWeight: 600
            }}
          >
            <Trash2 size={15} color="#E11D48" />
            <span>Delete Destination Collections</span>
          </button>

          {/* Download Sample Template */}
          <button
            id="download-template-btn"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            className="btn btn-secondary"
            style={{ padding: '10px 18px', fontSize: 13, gap: 8 }}
          >
            {downloadingTemplate ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Download size={15} color="#4F46E5" />
            )}
            <span>Download Sample Template (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Upload Drop Zone (if nothing staged or staging more) */}
      {(!stagedCollections || stagedCollections.length === 0) && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="glass-panel"
          style={{
            padding: '60px 24px',
            borderRadius: '16px',
            border: `2px dashed ${dragOver ? '#4F46E5' : '#CBD5E1'}`,
            background: dragOver ? '#EEF2FF' : '#FFFFFF',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: 32,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
          />

          <div style={{
            width: 68,
            height: 68,
            borderRadius: 18,
            background: '#EEF2FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px auto',
            border: '1px solid #C7D2FE'
          }}>
            {uploading ? (
              <Loader2 size={32} className="spin" color="#4F46E5" />
            ) : (
              <UploadCloud size={32} color="#4F46E5" />
            )}
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
            {uploading ? 'Analyzing Excel Spreadsheet...' : 'Drop your Collections Excel file here'}
          </h3>
          <p style={{ fontSize: 14, color: '#64748B', maxWidth: 440, margin: '0 auto 20px auto', lineHeight: 1.5 }}>
            Supports Microsoft Excel spreadsheets (<code style={{ color: '#059669', fontWeight: 600 }}>.xlsx</code>). All automated rules, product tags, descriptions, and images will be parsed.
          </p>

          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '10px 24px', fontSize: 13, pointerEvents: 'none' }}
          >
            <FileSpreadsheet size={16} />
            <span>Browse Computer</span>
          </button>
        </div>
      )}

      {/* Error alert */}
      {uploadError && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '10px',
          background: '#FFF1F2',
          border: '1px solid #FECDD3',
          color: '#BE123C',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 24
        }}>
          <AlertCircle size={18} flexShrink={0} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* STAGED COLLECTIONS PREVIEW & IMPORT CONTROLS */}
      {stagedCollections && stagedCollections.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Summary Strip & Clear Button */}
          <div className="glass-panel" style={{
            padding: '18px 24px',
            background: '#FFFFFF',
            borderRadius: '14px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #A7F3D0'
              }}>
                <CheckCircle2 size={24} color="#059669" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                    {stagedCollections.length} Collections Ready for Import
                  </h3>
                  <span className="badge badge-smart">{smartCount} Smart</span>
                  <span className="badge badge-custom">{customCount} Custom</span>
                </div>
                <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  Spreadsheet validated successfully with all rules and tags intact.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setStagedCollections([]);
                  setUploadError('');
                }}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: 12, color: '#E11D48', border: '1px solid #FECDD3' }}
              >
                <Trash2 size={14} />
                <span>Discard Sheet</span>
              </button>
            </div>
          </div>

          {/* Import Configuration Settings */}
          <div className="glass-panel" style={{
            padding: 24,
            background: '#FFFFFF',
            borderRadius: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <Settings2 size={18} color="#4F46E5" />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Migration Options</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {/* Conflict Strategy */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  Duplicate & Handle Conflict Strategy
                </label>
                <select
                  id="conflict-strategy-select"
                  value={conflictStrategy}
                  onChange={(e) => setConflictStrategy(e.target.value)}
                  className="input-field"
                  style={{
                    background: '#F8FAFC',
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  <option value="skip">Skip if already exists on destination (Recommended)</option>
                  <option value="overwrite">Overwrite / Update existing collections</option>
                  <option value="create_new">Create new duplicates with unique handle</option>
                </select>
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>
                  By default, any collection that already exists on the destination store will be skipped to prevent duplicates.
                </p>
              </div>

              {/* Toggle Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#334155', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={transferImages}
                    onChange={(e) => setTransferImages(e.target.checked)}
                    style={{ width: 17, height: 17, accentColor: '#4F46E5' }}
                  />
                  <span>Transfer Collection Featured Images</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#334155', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={mapProducts}
                    onChange={(e) => setMapProducts(e.target.checked)}
                    style={{ width: 17, height: 17, accentColor: '#4F46E5' }}
                  />
                  <span>Map & Link Matching Products by Handle</span>
                </label>
              </div>
            </div>
          </div>

          {/* Staged Collections Preview Table */}
          <div className="glass-panel" style={{
            borderRadius: '16px',
            overflow: 'hidden',
            background: '#FFFFFF'
          }}>
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid #E2E8F0',
              background: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                SPREADSHEET PREVIEW ({stagedCollections.length} ROWS)
              </span>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                Destination Store: <strong style={{ color: targetStore ? '#059669' : '#E11D48' }}>{targetStore?.name || targetStore?.domain || 'Not Connected'}</strong>
              </span>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 400 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>TITLE & HANDLE</th>
                    <th>TYPE</th>
                    <th>RULES / CONDITIONS</th>
                    <th>PRODUCT TAGS</th>
                    <th style={{ textAlign: 'right' }}>INSPECT</th>
                  </tr>
                </thead>
                <tbody>
                  {stagedCollections.map((col, idx) => {
                    const isSmart = col.collection_type === 'smart' || (col.rules && col.rules.length > 0);
                    return (
                      <tr key={idx}>
                        <td style={{ fontSize: 12, color: '#94A3B8' }}>{idx + 1}</td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{col.title}</span>
                          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748B', marginTop: 2 }}>
                            /{col.handle}
                          </p>
                        </td>
                        <td>
                          <span className={`badge ${isSmart ? 'badge-smart' : 'badge-custom'}`} style={{ fontSize: 10 }}>
                            {isSmart ? 'Smart' : 'Custom'}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#475569' }}>
                          {col.rules?.length > 0 ? (
                            <span style={{ fontFamily: 'var(--font-mono)', color: '#334155', fontWeight: 600 }}>
                              {col.rules.length} condition{col.rules.length > 1 ? 's' : ''} ({col.disjunctive ? 'ANY' : 'ALL'})
                            </span>
                          ) : (
                            <span style={{ color: '#94A3B8' }}>None (Manual)</span>
                          )}
                        </td>
                        <td>
                          {col.product_tags?.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {col.product_tags.slice(0, 2).map((t, i) => (
                                <span key={i} className="badge badge-tag" style={{ fontSize: 10 }}>{t}</span>
                              ))}
                              {col.product_tags.length > 2 && (
                                <span style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>+{col.product_tags.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#94A3B8' }}>&mdash;</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedDetail(col)}
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: 11 }}
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action to Start Migration */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: 24,
            background: '#F5F3FF',
            border: '1px solid #DDD6FE',
            borderRadius: '16px'
          }}>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#5B21B6' }}>Ready to Execute Collection Migration</h3>
              <p style={{ fontSize: 13, color: '#6D28D9', marginTop: 2 }}>
                {targetStore
                  ? `Collections will be synced to ${targetStore.name || targetStore.domain}`
                  : 'Destination store connection is required before launching.'}
              </p>
            </div>

            {targetStore ? (
              <button
                id="start-migration-btn"
                onClick={handleTriggerImport}
                className="btn btn-primary"
                style={{
                  padding: '12px 28px',
                  fontSize: 15,
                  background: '#7C3AED'
                }}
              >
                <span>Launch Migration ({stagedCollections.length} Collections)</span>
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                onClick={onNavigateToConnect}
                className="btn btn-primary"
                style={{ padding: '12px 22px', fontSize: 14 }}
              >
                <span>Connect Destination Store</span>
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collection Detail Modal */}
      {selectedDetail && (
        <CollectionDetailModal
          collection={selectedDetail}
          onClose={() => setSelectedDetail(null)}
        />
      )}

      {/* Destination Store Cleaner / Purge Modal (ONLY ON IMPORT / DESTINATION STORE) */}
      <DestinationCleanerModal
        isOpen={showCleanerModal}
        onClose={() => setShowCleanerModal(false)}
        targetStore={targetStore}
        onNavigateToConnect={onNavigateToConnect}
      />
    </div>
  );
}
