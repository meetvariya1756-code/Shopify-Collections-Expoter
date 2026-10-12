'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Settings2,
  Trash2,
  Eye,
  Lock,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import CollectionDetailModal from './CollectionDetailModal';

export default function ExcelImporter({
  currentShop = '',
  stagedCollections = [],
  setStagedCollections = () => {},
  onUpdateMigrationState = () => {},
  onOpenGuide
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);

  // Migration Options
  const [conflictStrategy, setConflictStrategy] = useState('skip'); // 'skip' | 'overwrite'
  const [transferImages, setTransferImages] = useState(true);
  const [mapProducts, setMapProducts] = useState(true);

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Live Import Execution State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusMessage, setImportStatusMessage] = useState('');
  const [importStats, setImportStats] = useState({ created: 0, updated: 0, skipped: 0, failed: 0, total: 0 });
  const [importCompleted, setImportCompleted] = useState(false);
  const [importReport, setImportReport] = useState([]);

  // Advanced Delete Section & Modal
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatusMessage, setDeleteStatusMessage] = useState('');
  const [deleteStats, setDeleteStats] = useState({ deleted: 0, failed: 0 });

  const fileInputRef = useRef(null);

  // Format store domain
  const activeShop = currentShop
    ? (currentShop.includes('.myshopify.com') ? currentShop : `${currentShop}.myshopify.com`)
    : 'session-store.myshopify.com';

  // Compute status counts from staged collections
  const newCount = (stagedCollections || []).filter(c => c.status === 'new').length;
  const existsCount = (stagedCollections || []).filter(c => c.status === 'exists').length;
  const errorCount = (stagedCollections || []).filter(c => c.status === 'error' || c.errorReason).length;
  const validCollections = (stagedCollections || []).filter(c => c.status !== 'error' && !c.errorReason);
  const validCount = validCollections.length;

  const smartCount = (stagedCollections || []).filter(
    (c) => c.collection_type === 'smart' || (c.rules && c.rules.length > 0)
  ).length;
  const customCount = (stagedCollections || []).length - smartCount;

  // Collections with failed image attachments
  const failedImageCollections = (stagedCollections || []).filter(
    c => (c.status && c.status.includes('image failed')) || (c.reason && c.reason.includes('image failed'))
  );

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

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds the 5 MB limit. Please upload a smaller spreadsheet.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setImportCompleted(false);
    setImportReport([]);

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

  // Execute Import via SSE
  const handleExecuteImport = async () => {
    setShowConfirmModal(false);

    if (validCollections.length === 0) {
      alert('No valid collections to import.');
      return;
    }

    setIsImporting(true);
    setImportCompleted(false);
    setImportProgress(0);
    setImportStatusMessage('Connecting to store and initiating collection import...');
    setImportStats({ created: 0, updated: 0, skipped: 0, failed: 0, total: validCollections.length });

    // Inform Live Migration tab
    if (typeof onUpdateMigrationState === 'function') {
      onUpdateMigrationState({
        isRunning: true,
        isCompleted: false,
        progress: 0,
        currentMessage: `Initiating import of ${validCollections.length} collections into ${activeShop}...`,
        logs: [
          {
            time: new Date().toLocaleTimeString(),
            type: 'info',
            message: `Started import of ${validCollections.length} collections into ${activeShop}`
          }
        ],
        stats: { total: validCollections.length, created: 0, updated: 0, skipped: 0, failed: 0 },
        error: null
      });
    }

    try {
      const response = await fetch('/api/shopify/import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collections: validCollections,
          options: {
            conflictStrategy,
            transferImages,
            mapProducts
          }
        })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `HTTP error ${response.status}`);
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

          const eventLines = block.split('\n');
          for (const line of eventLines) {
            if (line.startsWith('event: ')) {
              event = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.replace('data: ', '').trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            handleImportSseEvent(event, data);
          } catch (_) {}
        }
      }
    } catch (err) {
      setIsImporting(false);
      setImportStatusMessage(`Import error: ${err.message}`);
      if (typeof onUpdateMigrationState === 'function') {
        onUpdateMigrationState(prev => ({
          ...prev,
          isRunning: false,
          error: err.message,
          logs: [
            ...(prev?.logs || []),
            { time: new Date().toLocaleTimeString(), type: 'error', message: `Import failed: ${err.message}` }
          ]
        }));
      }
    }
  };

  const handleImportSseEvent = (event, data) => {
    const time = new Date().toLocaleTimeString();

    if (event === 'progress') {
      const pct = data.percent !== undefined ? data.percent : 0;
      setImportProgress(pct);
      setImportStatusMessage(data.message || `Processing [${data.index}/${data.total}] "${data.currentTitle}"...`);

      if (data.status) {
        setImportStats(prev => {
          const next = { ...prev };
          if (data.status === 'created' || data.status === 'created, image failed') next.created++;
          else if (data.status === 'updated' || data.status === 'updated, image failed') next.updated++;
          else if (data.status === 'skipped') next.skipped++;
          else if (data.status === 'failed') next.failed++;
          return next;
        });
      }

      if (typeof onUpdateMigrationState === 'function') {
        onUpdateMigrationState(prev => {
          const nextStats = { ...(prev?.stats || {}) };
          if (data.status === 'created' || data.status === 'created, image failed') nextStats.created = (nextStats.created || 0) + 1;
          else if (data.status === 'updated' || data.status === 'updated, image failed') nextStats.updated = (nextStats.updated || 0) + 1;
          else if (data.status === 'skipped') nextStats.skipped = (nextStats.skipped || 0) + 1;
          else if (data.status === 'failed') nextStats.failed = (nextStats.failed || 0) + 1;

          let logType = 'info';
          if (data.status === 'created' || data.status === 'updated') logType = 'success';
          else if (data.status?.includes('image failed')) logType = 'warning';
          else if (data.status === 'skipped') logType = 'warning';
          else if (data.status === 'failed') logType = 'error';

          return {
            ...prev,
            progress: pct,
            currentMessage: data.message || `Processing ${data.currentTitle}...`,
            stats: nextStats,
            logs: [
              ...(prev?.logs || []),
              { time, type: logType, message: `[${data.index}/${data.total}] ${data.message || data.currentTitle}` }
            ]
          };
        });
      }
    } else if (event === 'complete') {
      setIsImporting(false);
      setImportCompleted(true);
      setImportProgress(100);
      setImportStatusMessage(data.message || 'Import finished!');

      if (data.results) {
        setImportStats({
          total: data.results.total || validCollections.length,
          created: data.results.created ?? 0,
          updated: data.results.updated ?? 0,
          skipped: data.results.skipped ?? 0,
          failed: data.results.failed ?? 0
        });

        if (Array.isArray(data.results.details)) {
          setImportReport(data.results.details);
          // Also update stagedCollections so preview displays the imported result & reason for each row
          setStagedCollections(prev => {
            const detailMap = new Map();
            for (const d of data.results.details) {
              if (d.handle) detailMap.set(String(d.handle).toLowerCase().trim(), d);
            }
            return prev.map(c => {
              const d = detailMap.get(String(c.handle || '').toLowerCase().trim());
              if (d) {
                return {
                  ...c,
                  status: d.status,
                  reason: d.reason
                };
              }
              return c;
            });
          });
        }
      }

      if (typeof onUpdateMigrationState === 'function') {
        onUpdateMigrationState(prev => ({
          ...prev,
          isRunning: false,
          isCompleted: true,
          progress: 100,
          currentMessage: data.message || 'All collections processed!',
          stats: data.results
            ? {
                total: data.results.total || validCollections.length,
                created: data.results.created ?? 0,
                updated: data.results.updated ?? 0,
                skipped: data.results.skipped ?? 0,
                failed: data.results.failed ?? 0
              }
            : (prev?.stats || {}),
          logs: [
            ...(prev?.logs || []),
            { time, type: 'complete', message: `🎉 ${data.message || 'Import completed.'}` }
          ]
        }));
      }
    } else if (event === 'error') {
      setIsImporting(false);
      setImportStatusMessage(`Import error: ${data.message}`);
    }
  };

  // Retry image attachment for failed rows using the same fallback order
  const handleRetryFailedImages = async (collectionsToRetry = null) => {
    const targets = Array.isArray(collectionsToRetry) ? collectionsToRetry : failedImageCollections;
    if (!targets || targets.length === 0) {
      alert('No collections with failed images to retry.');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportStatusMessage(`Retrying image attachment for ${targets.length} collection(s)...`);

    if (typeof onUpdateMigrationState === 'function') {
      onUpdateMigrationState(prev => ({
        ...prev,
        isRunning: true,
        isCompleted: false,
        progress: 0,
        currentMessage: `Retrying image attachment for ${targets.length} collection(s)...`,
        logs: [
          ...(prev?.logs || []),
          { time: new Date().toLocaleTimeString(), type: 'info', message: `🔄 Retrying image attachment for ${targets.length} collection(s) with fallback order...` }
        ]
      }));
    }

    try {
      const response = await fetch('/api/shopify/import-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collections: targets,
          options: {
            conflictStrategy: 'overwrite',
            transferImages: true,
            mapProducts: false
          }
        })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `HTTP error ${response.status}`);
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

          const eventLines = block.split('\n');
          for (const line of eventLines) {
            if (line.startsWith('event: ')) {
              event = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.replace('data: ', '').trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            handleImportSseEvent(event, data);
          } catch (_) {}
        }
      }
    } catch (err) {
      setIsImporting(false);
      setImportStatusMessage(`Image retry error: ${err.message}`);
    }
  };

  // Generate and download Excel report
  const handleDownloadReport = () => {
    if (!importReport || importReport.length === 0) {
      alert('No report data available to download.');
      return;
    }

    // Formula injection prevention helper
    const sanitizeFormulaForExcel = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      const trimmed = str.trim();
      if (trimmed.length > 0 && ['=', '+', '-', '@'].includes(trimmed[0])) {
        return `'${trimmed}`;
      }
      return str;
    };

    const rows = importReport.map(item => ({
      Handle: sanitizeFormulaForExcel(item.handle || ''),
      Title: sanitizeFormulaForExcel(item.title || ''),
      Status: String(item.status || 'UNKNOWN').toUpperCase(),
      Reason: sanitizeFormulaForExcel(item.reason || item.message || '')
    }));

    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ['Handle', 'Title', 'Status', 'Reason']
    });

    ws['!cols'] = [
      { wch: 30 },
      { wch: 35 },
      { wch: 14 },
      { wch: 60 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Report');

    const metaWs = XLSX.utils.aoa_to_sheet([
      ['Shopify Collection Import Execution Report'],
      ['Store', activeShop],
      ['Generated At', new Date().toISOString()],
      ['Total Collections', importReport.length],
      ['Created', importReport.filter(r => r.status === 'created' || String(r.status || '').startsWith('created')).length],
      ['Updated', importReport.filter(r => r.status === 'updated' || String(r.status || '').startsWith('updated')).length],
      ['Skipped', importReport.filter(r => r.status === 'skipped').length],
      ['Failed', importReport.filter(r => r.status === 'failed').length]
    ]);
    metaWs['!cols'] = [{ wch: 22 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, metaWs, 'Summary');

    XLSX.writeFile(wb, `shopify-import-report-${activeShop.replace('.myshopify.com', '')}-${Date.now()}.xlsx`);
  };

  // Execute Deletion of Sheet Collections in Session Store
  const handleExecuteDelete = async () => {
    if (deleteConfirmInput.trim() !== activeShop) {
      alert(`Please type "${activeShop}" to confirm deletion.`);
      return;
    }

    const handlesToDelete = stagedCollections.map(c => c.handle).filter(Boolean);
    if (handlesToDelete.length === 0) {
      alert('No collection handles found in the uploaded sheet to delete.');
      return;
    }

    setIsDeleting(true);
    setDeleteStatusMessage(`Starting deletion of ${handlesToDelete.length} sheet collection(s) in ${activeShop}...`);
    setDeleteStats({ deleted: 0, failed: 0 });

    try {
      const response = await fetch('/api/shopify/delete-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handles: handlesToDelete
        })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `HTTP error ${response.status}`);
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

          const eventLines = block.split('\n');
          for (const line of eventLines) {
            if (line.startsWith('event: ')) {
              event = line.replace('event: ', '').trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.replace('data: ', '').trim();
            }
          }

          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            if (event === 'progress') {
              setDeleteStatusMessage(data.message || `Deleting ${data.currentTitle}...`);
            } else if (event === 'complete') {
              setIsDeleting(false);
              setDeleteStatusMessage(data.message || 'Deletion completed.');
              if (data.results) {
                setDeleteStats({
                  deleted: data.results.deleted || 0,
                  failed: data.results.failed || 0
                });
              }
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      setIsDeleting(false);
      setDeleteStatusMessage(`Deletion error: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 20px' }}>
      {/* Read-Only Line: Importing into <shop>.myshopify.com */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 14px',
        borderRadius: '8px',
        background: '#F1F5F9',
        border: '1px solid #CBD5E1',
        color: '#1E293B',
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 20
      }}>
        <Lock size={15} color="#475569" />
        <span>Importing into: <strong>{activeShop}</strong></span>
      </div>

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
              Excel Import Studio
            </h1>
            <span className="badge badge-smart" style={{ fontSize: 11 }}>
              .XLSX Native
            </span>
          </div>
          <p style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>
            Upload an Excel sheet of collections to create and update collections directly in <strong>{activeShop}</strong>.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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

      {/* Upload Drop Zone (if nothing staged) */}
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
            Upload an Excel sheet (<code style={{ color: '#059669', fontWeight: 600 }}>.xlsx</code>, max 5 MB, max 1000 rows). Automated rules, product tags, descriptions, and handles will be parsed and previewed.
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                    {stagedCollections.length} Collections Uploaded
                  </h3>
                  <span className="badge" style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
                    {newCount} New
                  </span>
                  <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                    {existsCount} Already exists
                  </span>
                  {errorCount > 0 && (
                    <span className="badge" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }}>
                      {errorCount} Error
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                  {validCount} collection(s) ready to import into <strong>{activeShop}</strong>. {errorCount > 0 ? `${errorCount} row(s) with errors will be skipped.` : ''}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setStagedCollections([]);
                  setUploadError('');
                  setImportCompleted(false);
                  setImportReport([]);
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
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>Import Options</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {/* Conflict Strategy */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  Duplicate Strategy
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
                  <option value="skip">Skip if exists (Recommended)</option>
                  <option value="overwrite">Update existing</option>
                </select>
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>
                  {conflictStrategy === 'skip'
                    ? 'Collections that already exist in this store will be left untouched.'
                    : 'Existing collections with matching handles will be updated with new rules & descriptions.'}
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
                  <span>Transfer Featured Images</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#334155', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={mapProducts}
                    onChange={(e) => setMapProducts(e.target.checked)}
                    style={{ width: 17, height: 17, accentColor: '#4F46E5' }}
                  />
                  <span>Map & Link Products by Handle</span>
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
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                SPREADSHEET PREVIEW ({stagedCollections.length} ROWS)
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="badge" style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: 11 }}>
                  New: {newCount}
                </span>
                <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', fontSize: 11 }}>
                  Already exists: {existsCount}
                </span>
                <span className="badge" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3', fontSize: 11 }}>
                  Error: {errorCount}
                </span>
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 420 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>STATUS</th>
                    <th>TITLE & HANDLE</th>
                    <th>TYPE</th>
                    <th>RULES / CONDITIONS</th>
                    <th>NOTES / REASON</th>
                    <th style={{ textAlign: 'right' }}>INSPECT</th>
                  </tr>
                </thead>
                <tbody>
                  {stagedCollections.map((col, idx) => {
                    const isSmart = col.collection_type === 'smart' || (col.rules && col.rules.length > 0);
                    const isError = col.status === 'error' || Boolean(col.errorReason);
                    const isImageFailed = Boolean(col.status && col.status.includes('image failed'));
                    const isCreated = col.status === 'created';
                    const isUpdated = col.status === 'updated';
                    const isExists = col.status === 'exists';
                    const isNew = col.status === 'new';

                    return (
                      <tr key={idx} style={{ background: isError ? '#FFFDFD' : isImageFailed ? '#FFFBEB' : 'transparent' }}>
                        <td style={{ fontSize: 12, color: '#94A3B8' }}>{col.rowIndex || idx + 1}</td>
                        <td>
                          {isError && (
                            <span className="badge" style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3', fontSize: 10 }}>
                              Error
                            </span>
                          )}
                          {isImageFailed && (
                            <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', fontSize: 10 }}>
                              {col.status}
                            </span>
                          )}
                          {isCreated && (
                            <span className="badge" style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: 10 }}>
                              Created
                            </span>
                          )}
                          {isUpdated && (
                            <span className="badge" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: 10 }}>
                              Updated
                            </span>
                          )}
                          {isExists && !isUpdated && !isImageFailed && (
                            <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', fontSize: 10 }}>
                              Already exists
                            </span>
                          )}
                          {isNew && !isCreated && !isImageFailed && (
                            <span className="badge" style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: 10 }}>
                              New
                            </span>
                          )}
                        </td>
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
                        <td style={{ fontSize: 12, color: isError ? '#BE123C' : isImageFailed ? '#B45309' : '#64748B' }}>
                          {col.reason || col.errorReason || (isNew ? 'Will be created' : isExists ? 'Existing handle' : '')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            {isImageFailed && (
                              <button
                                onClick={() => handleRetryFailedImages([col])}
                                disabled={isImporting}
                                className="btn btn-secondary"
                                title="Retry image with fallbacks"
                                style={{ padding: '4px 8px', fontSize: 11, color: '#B45309', borderColor: '#FDE68A', background: '#FFFBEB' }}
                              >
                                <RefreshCw size={11} className={isImporting ? 'spin' : ''} />
                                <span>Retry image</span>
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedDetail(col)}
                              className="btn btn-secondary"
                              style={{ padding: '5px 10px', fontSize: 11 }}
                            >
                              <Eye size={12} />
                              <span>View</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bar: Main Import Button */}
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
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#5B21B6' }}>
                Ready to Import Collections
              </h3>
              <p style={{ fontSize: 13, color: '#6D28D9', marginTop: 2 }}>
                {validCount} collections will be processed in <strong>{activeShop}</strong> via Shopify Admin GraphQL API.
              </p>
            </div>

            <button
              id="start-import-btn"
              onClick={() => setShowConfirmModal(true)}
              disabled={validCount === 0 || isImporting}
              className="btn btn-primary"
              style={{
                padding: '12px 28px',
                fontSize: 15,
                background: '#7C3AED',
                opacity: validCount === 0 ? 0.5 : 1,
                cursor: validCount === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {isImporting ? (
                <>
                  <Loader2 size={18} className="spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <span>Import {validCount} collections into {activeShop}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

          {/* Real-time Import Progress Bar */}
          {(isImporting || importCompleted) && (
            <div className="glass-panel" style={{
              padding: 24,
              borderRadius: '16px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                  {importCompleted ? 'Import Execution Complete' : 'Importing Collections in Progress'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#7C3AED' }}>
                  {importProgress}%
                </span>
              </div>

              {/* Progress bar line */}
              <div style={{ width: '100%', height: 10, background: '#F1F5F9', borderRadius: 9999, overflow: 'hidden', marginBottom: 14 }}>
                <div style={{
                  width: `${importProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #7C3AED 0%, #059669 100%)',
                  borderRadius: 9999,
                  transition: 'width 0.3s ease'
                }} />
              </div>

              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
                {importStatusMessage}
              </p>

              {/* Stat Boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#ECFDF5', border: '1px solid #A7F3D0' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase' }}>Created</span>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#047857', marginTop: 2 }}>{importStats.created}</p>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase' }}>Updated</span>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#1D4ED8', marginTop: 2 }}>{importStats.updated}</p>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Skipped</span>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#B45309', marginTop: 2 }}>{importStats.skipped}</p>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FFF1F2', border: '1px solid #FECDD3' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#9F1239', textTransform: 'uppercase' }}>Failed</span>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#BE123C', marginTop: 2 }}>{importStats.failed}</p>
                </div>
              </div>

              {/* Result Report Download Button & Retry Images */}
              {importCompleted && (
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {failedImageCollections.length > 0 && (
                    <button
                      id="retry-images-btn"
                      onClick={() => handleRetryFailedImages()}
                      disabled={isImporting}
                      className="btn btn-secondary"
                      style={{ padding: '10px 18px', fontSize: 13, gap: 8, color: '#B45309', borderColor: '#FDE68A', background: '#FFFBEB' }}
                    >
                      <RefreshCw size={15} className={isImporting ? 'spin' : ''} />
                      <span>Retry images ({failedImageCollections.length})</span>
                    </button>
                  )}
                  <button
                    id="download-report-btn"
                    onClick={handleDownloadReport}
                    className="btn btn-primary"
                    style={{ padding: '10px 20px', fontSize: 13, gap: 8, background: '#059669' }}
                  >
                    <Download size={15} />
                    <span>Download report (.xlsx)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Advanced Collapsed Section */}
          <div style={{
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            overflow: 'hidden',
            background: '#FFFFFF'
          }}>
            <button
              type="button"
              id="advanced-section-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: '100%',
                padding: '14px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#F8FAFC',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#334155' }}>Advanced Options</span>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>&bull; Store Collection Clean-up</span>
              </div>
              {showAdvanced ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
            </button>

            {showAdvanced && (
              <div style={{ padding: '20px 24px', borderTop: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16
                }}>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#9F1239' }}>
                      Delete collections in this store
                    </h4>
                    <p style={{ fontSize: 12, color: '#64748B', marginTop: 4, maxWidth: 540 }}>
                      Safely delete only the collections listed in the uploaded Excel sheet from <strong>{activeShop}</strong>. Requires store name confirmation to prevent accidental loss.
                    </p>
                  </div>

                  <button
                    id="open-delete-modal-btn"
                    onClick={() => {
                      setDeleteConfirmInput('');
                      setShowDeleteModal(true);
                    }}
                    disabled={stagedCollections.length === 0}
                    className="btn btn-secondary"
                    style={{
                      padding: '9px 18px',
                      fontSize: 13,
                      background: '#FFF1F2',
                      borderColor: '#FECDD3',
                      color: '#BE123C',
                      fontWeight: 600,
                      gap: 8,
                      opacity: stagedCollections.length === 0 ? 0.5 : 1
                    }}
                  >
                    <Trash2 size={14} color="#E11D48" />
                    <span>Delete collections in this store</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 16,
            maxWidth: 480,
            width: '100%',
            padding: 28,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #E2E8F0'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
              Confirm Collection Import
            </h3>

            <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, marginBottom: 20 }}>
              <strong>{newCount}</strong> collections will be created and{' '}
              <strong>{conflictStrategy === 'overwrite' ? existsCount : 0}</strong> updated in{' '}
              <strong style={{ color: '#4F46E5' }}>{activeShop}</strong>.
              {conflictStrategy === 'skip' && existsCount > 0 && (
                <span style={{ display: 'block', fontSize: 13, color: '#64748B', marginTop: 8 }}>
                  ({existsCount} existing collection(s) will be skipped to prevent duplicates).
                </span>
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                id="cancel-import-confirm-btn"
                onClick={() => setShowConfirmModal(false)}
                className="btn btn-secondary"
                style={{ padding: '9px 18px', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                id="confirm-import-btn"
                onClick={handleExecuteImport}
                className="btn btn-primary"
                style={{ padding: '9px 22px', fontSize: 13, background: '#7C3AED' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: 16,
            maxWidth: 520,
            width: '100%',
            padding: 28,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #FECDD3'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#BE123C' }}>
                Delete Collections in This Store
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: '#FFF1F2',
              border: '1px solid #FECDD3',
              color: '#9F1239',
              fontSize: 13,
              marginBottom: 16,
              lineHeight: 1.5
            }}>
              <AlertTriangle size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
              <strong>Warning:</strong> This will delete <strong>only the {stagedCollections.length} collections</strong> listed in the uploaded Excel sheet from <strong>{activeShop}</strong>. This operation cannot be undone.
            </div>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Type <strong>{activeShop}</strong> to confirm:
            </label>
            <input
              type="text"
              id="delete-confirmation-input"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder={activeShop}
              className="input-field"
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: 13,
                marginBottom: 16,
                border: '1px solid #CBD5E1',
                borderRadius: 8
              }}
            />

            {deleteStatusMessage && (
              <p style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
                {deleteStatusMessage}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary"
                disabled={isDeleting}
                style={{ padding: '9px 16px', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                id="execute-delete-btn"
                onClick={handleExecuteDelete}
                disabled={deleteConfirmInput.trim() !== activeShop || isDeleting}
                className="btn btn-primary"
                style={{
                  padding: '9px 20px',
                  fontSize: 13,
                  background: '#E11D48',
                  opacity: deleteConfirmInput.trim() !== activeShop || isDeleting ? 0.5 : 1,
                  cursor: deleteConfirmInput.trim() !== activeShop || isDeleting ? 'not-allowed' : 'pointer'
                }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Collections</span>
                )}
              </button>
            </div>
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
    </div>
  );
}
