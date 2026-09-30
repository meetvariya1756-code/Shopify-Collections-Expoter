'use client';

import React, { useState, useMemo } from 'react';
import {
  Layers,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Tag,
  ArrowRight,
  Eye,
  Loader2,
  SendHorizontal,
  Sliders,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import CollectionDetailModal from './CollectionDetailModal';

export default function CollectionExplorer({
  collections,
  setCollections,
  sourceStore,
  targetStore,
  loadingCollections,
  fetchCollectionsFromStore,
  onSyncDirectly,
  onNavigateToConnect
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'smart' | 'custom'
  const [selectedHandles, setSelectedHandles] = useState(new Set());
  const [exportingExcel, setExportingExcel] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Filtered collection list
  const filteredCollections = useMemo(() => {
    setCurrentPage(1);
    return (collections || []).filter((col) => {
      // Type filter
      if (filterType === 'smart' && col.collection_type !== 'smart' && (!col.rules || col.rules.length === 0)) {
        return false;
      }
      if (filterType === 'custom' && (col.collection_type === 'smart' || (col.rules && col.rules.length > 0))) {
        return false;
      }

      // Search query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const titleMatch = col.title?.toLowerCase().includes(query);
        const handleMatch = col.handle?.toLowerCase().includes(query);
        const tagMatch = col.product_tags?.some((t) => t.toLowerCase().includes(query));
        const ruleMatch = col.rules?.some((r) => r.condition?.toLowerCase().includes(query));
        if (!titleMatch && !handleMatch && !tagMatch && !ruleMatch) return false;
      }

      return true;
    });
  }, [collections, filterType, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCollections.length / pageSize));
  const paginatedCollections = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCollections.slice(start, start + pageSize);
  }, [filteredCollections, currentPage, pageSize]);

  // Handle selection toggles
  const handleToggleSelect = (handle) => {
    const next = new Set(selectedHandles);
    if (next.has(handle)) {
      next.delete(handle);
    } else {
      next.add(handle);
    }
    setSelectedHandles(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedHandles);
    filteredCollections.forEach((c) => next.add(c.handle));
    setSelectedHandles(next);
  };

  const handleDeselectAll = () => {
    setSelectedHandles(new Set());
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    const itemsToExport = selectedHandles.size > 0
      ? collections.filter((c) => selectedHandles.has(c.handle))
      : filteredCollections;

    if (itemsToExport.length === 0) {
      alert('No collections available to export.');
      return;
    }

    setExportingExcel(true);

    try {
      const response = await axios.post(
        '/api/shopify/export-excel',
        {
          collections: itemsToExport,
          storeInfo: sourceStore || { name: 'Shopify Store' }
        },
        { responseType: 'blob' }
      );

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const storeSlug = sourceStore?.name
        ? sourceStore.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        : 'shopify';
      link.setAttribute('download', `shopify-collections-${storeSlug}-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Excel failed:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingExcel(false);
    }
  };

  // Direct sync to destination store
  const handleSyncSelected = () => {
    const itemsToSync = selectedHandles.size > 0
      ? collections.filter((c) => selectedHandles.has(c.handle))
      : filteredCollections;

    if (itemsToSync.length === 0) {
      alert('Please select at least one collection to sync.');
      return;
    }

    onSyncDirectly(itemsToSync);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '36px 24px' }}>
      {/* Top Action Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 24
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px' }}>
              Collection Explorer
            </h1>
            {collections?.length > 0 && (
              <span className="badge badge-tag" style={{ fontSize: 13, padding: '4px 10px', background: '#F1F5F9', color: '#334155' }}>
                {collections.length} Total Collections
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>
            {sourceStore
              ? `Live collections loaded from ${sourceStore.name || sourceStore.domain}`
              : 'Connect your source store to fetch live collections & automated rules.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sourceStore ? (
            <button
              id="fetch-collections-btn"
              onClick={() => fetchCollectionsFromStore(sourceStore)}
              disabled={loadingCollections}
              className="btn btn-secondary"
              style={{ padding: '10px 16px', fontSize: 13 }}
            >
              <RefreshCw size={15} className={loadingCollections ? 'spin' : ''} />
              <span>{loadingCollections ? 'Refreshing...' : 'Refresh From Store'}</span>
            </button>
          ) : (
            <button
              onClick={onNavigateToConnect}
              className="btn btn-primary"
              style={{ padding: '10px 16px', fontSize: 13 }}
            >
              <span>Connect Store First</span>
              <ArrowRight size={14} />
            </button>
          )}

          {/* Export to Excel */}
          <button
            id="download-excel-btn"
            onClick={handleExportExcel}
            disabled={exportingExcel || !collections || collections.length === 0}
            className="btn btn-excel"
            style={{
              padding: '10px 20px',
              fontSize: 13,
              opacity: !collections || collections.length === 0 ? 0.5 : 1
            }}
          >
            {exportingExcel ? (
              <>
                <Loader2 size={16} className="spin" />
                <span>Generating .xlsx...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet size={16} />
                <span>
                  Export to Excel (.xlsx) {selectedHandles.size > 0 ? `(${selectedHandles.size})` : ''}
                </span>
              </>
            )}
          </button>

          {/* Direct Sync button */}
          {targetStore && collections?.length > 0 && (
            <button
              id="sync-to-target-btn"
              onClick={handleSyncSelected}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: 13,
                background: '#7C3AED'
              }}
            >
              <SendHorizontal size={15} />
              <span>
                Direct Sync to Target {selectedHandles.size > 0 ? `(${selectedHandles.size})` : ''}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Controls */}
      {collections?.length > 0 && (
        <div className="glass-panel" style={{
          padding: '16px 20px',
          background: '#FFFFFF',
          borderRadius: '14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20
        }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 460 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              id="collection-search-input"
              type="text"
              placeholder="Search by title, handle, product tag, or rule condition..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field"
              style={{
                paddingLeft: 36,
                fontSize: 13,
                background: '#F8FAFC'
              }}
            />
          </div>

          {/* Type Filters & Selection Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {/* Filter Pills */}
            <div style={{
              display: 'flex',
              background: '#F1F5F9',
              padding: 3,
              borderRadius: '8px',
              border: '1px solid #E2E8F0'
            }}>
              <button
                onClick={() => setFilterType('all')}
                style={{
                  background: filterType === 'all' ? '#FFFFFF' : 'transparent',
                  color: filterType === 'all' ? '#0F172A' : '#64748B',
                  boxShadow: filterType === 'all' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                All ({collections.length})
              </button>
              <button
                onClick={() => setFilterType('smart')}
                style={{
                  background: filterType === 'smart' ? '#FFFFFF' : 'transparent',
                  color: filterType === 'smart' ? '#7C3AED' : '#64748B',
                  boxShadow: filterType === 'smart' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Smart ({collections.filter(c => c.collection_type === 'smart' || (c.rules && c.rules.length > 0)).length})
              </button>
              <button
                onClick={() => setFilterType('custom')}
                style={{
                  background: filterType === 'custom' ? '#FFFFFF' : 'transparent',
                  color: filterType === 'custom' ? '#0284C7' : '#64748B',
                  boxShadow: filterType === 'custom' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Custom ({collections.filter(c => c.collection_type === 'custom' && (!c.rules || c.rules.length === 0)).length})
              </button>
            </div>

            {/* Selection actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSelectAllFiltered}
                className="btn btn-secondary"
                style={{ padding: '7px 12px', fontSize: 12 }}
              >
                Select Filtered ({filteredCollections.length})
              </button>
              {selectedHandles.size > 0 && (
                <button
                  onClick={handleDeselectAll}
                  className="btn btn-secondary"
                  style={{ padding: '7px 12px', fontSize: 12, color: '#E11D48', border: '1px solid #FECDD3' }}
                >
                  Clear ({selectedHandles.size})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loadingCollections && (
        <div className="glass-panel" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
          background: '#FFFFFF',
          borderRadius: '16px'
        }}>
          <Loader2 size={36} className="spin" color="#4F46E5" />
          <h3 style={{ marginTop: 16, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
            Fetching Live Collections & Rule Sets...
          </h3>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            Reading automated tag conditions, products, images, and sort orders
          </p>
        </div>
      )}

      {/* Empty State: Not connected or no collections */}
      {!loadingCollections && (!collections || collections.length === 0) && (
        <div className="glass-panel" style={{
          padding: '60px 24px',
          borderRadius: '16px',
          background: '#FFFFFF',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: '#EEF2FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16
          }}>
            <Layers size={32} color="#4F46E5" />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
            No Collections Loaded
          </h3>
          <p style={{ fontSize: 14, color: '#64748B', maxWidth: 480, marginBottom: 24, lineHeight: 1.5 }}>
            {sourceStore
              ? 'Click below to fetch all automated and custom collections from your connected Shopify store.'
              : 'Connect your source Shopify store first to load collections and begin exporting.'}
          </p>
          {sourceStore ? (
            <button
              onClick={() => fetchCollectionsFromStore(sourceStore)}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: 14 }}
            >
              <RefreshCw size={16} />
              <span>Fetch Collections Now</span>
            </button>
          ) : (
            <button
              onClick={onNavigateToConnect}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: 14 }}
            >
              <span>Connect Store</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}

      {/* Collections Table */}
      {!loadingCollections && collections?.length > 0 && (
        <div className="glass-panel" style={{
          borderRadius: '16px',
          overflow: 'hidden',
          background: '#FFFFFF',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        if (selectedHandles.size === filteredCollections.length) {
                          handleDeselectAll();
                        } else {
                          handleSelectAllFiltered();
                        }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', margin: '0 auto' }}
                    >
                      {selectedHandles.size > 0 && selectedHandles.size === filteredCollections.length ? (
                        <CheckSquare size={18} color="#4F46E5" />
                      ) : (
                        <Square size={18} color="#94A3B8" />
                      )}
                    </button>
                  </th>
                  <th>COLLECTION</th>
                  <th>TYPE</th>
                  <th>RULES / CONDITIONS</th>
                  <th>PRODUCT TAGS</th>
                  <th>SORT ORDER</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCollections.map((col) => {
                  const isSelected = selectedHandles.has(col.handle);
                  const isSmart = col.collection_type === 'smart' || (col.rules && col.rules.length > 0);

                  return (
                    <tr
                      key={col.handle || col.title}
                      style={{
                        background: isSelected ? '#F5F3FF' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleSelect(col.handle)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', margin: '0 auto' }}
                        >
                          {isSelected ? (
                            <CheckSquare size={18} color="#4F46E5" />
                          ) : (
                            <Square size={18} color="#CBD5E1" />
                          )}
                        </button>
                      </td>

                      {/* Collection Title & Image */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {col.image?.src ? (
                            <img
                              src={col.image.src}
                              alt={col.image.alt || col.title}
                              style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid #E2E8F0' }}
                            />
                          ) : (
                            <div style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              background: '#F1F5F9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #E2E8F0'
                            }}>
                              <Layers size={18} color="#94A3B8" />
                            </div>
                          )}
                          <div>
                            <span
                              onClick={() => setSelectedDetail(col)}
                              style={{
                                fontWeight: 700,
                                fontSize: 14,
                                color: '#0F172A',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#4F46E5')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#0F172A')}
                            >
                              {col.title}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#64748B' }}>
                                /{col.handle}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td>
                        <span className={`badge ${isSmart ? 'badge-smart' : 'badge-custom'}`}>
                          {isSmart ? 'Smart' : 'Custom'}
                        </span>
                      </td>

                      {/* Rules */}
                      <td style={{ maxWidth: 280 }}>
                        {col.rules && col.rules.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {col.rules.slice(0, 2).map((r, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: 11,
                                  fontFamily: 'var(--font-mono)',
                                  background: '#F1F5F9',
                                  border: '1px solid #E2E8F0',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  color: '#334155'
                                }}
                              >
                                {r.column} = &ldquo;{r.condition}&rdquo;
                              </span>
                            ))}
                            {col.rules.length > 2 && (
                              <span style={{ fontSize: 11, color: '#64748B', alignSelf: 'center', fontWeight: 600 }}>
                                +{col.rules.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
                            Manual items
                          </span>
                        )}
                      </td>

                      {/* Tags */}
                      <td style={{ maxWidth: 240 }}>
                        {col.product_tags && col.product_tags.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {col.product_tags.slice(0, 3).map((t, i) => (
                              <span key={i} className="badge badge-tag" style={{ fontSize: 11, padding: '2px 6px' }}>
                                {t}
                              </span>
                            ))}
                            {col.product_tags.length > 3 && (
                              <span style={{ fontSize: 11, color: '#64748B', alignSelf: 'center', fontWeight: 600 }}>
                                +{col.product_tags.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: '#94A3B8' }}>&mdash;</span>
                        )}
                      </td>

                      {/* Sort Order */}
                      <td style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
                        {col.sort_order || 'best-selling'}
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedDetail(col)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 12, gap: 5 }}
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderTop: '1px solid #E2E8F0',
              background: '#F8FAFC',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                Showing <strong style={{ color: '#0F172A' }}>{(currentPage - 1) * pageSize + 1}</strong> to <strong style={{ color: '#0F172A' }}>{Math.min(currentPage * pageSize, filteredCollections.length)}</strong> of <strong style={{ color: '#0F172A' }}>{filteredCollections.length.toLocaleString()}</strong> collections
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: 12, opacity: currentPage === 1 ? 0.5 : 1 }}
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: 12, opacity: currentPage === 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>

                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', padding: '0 8px' }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: 12, opacity: currentPage === totalPages ? 0.5 : 1 }}
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: 12, opacity: currentPage === totalPages ? 0.5 : 1 }}
                >
                  Last
                </button>
              </div>
            </div>
          )}
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
