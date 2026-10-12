'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  UserPlus,
  Search,
  Key,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import SkeletonLoader from '@/components/SkeletonLoader';
import { useAuth } from '@/components/AuthProvider';

export default function AdminDashboardPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();

  // Stats state
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    disabledUsers: 0,
    loginsLast24h: 0
  });

  // Users table state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Activity logs state
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Selected user for edit / reset / delete
  const [selectedUser, setSelectedUser] = useState(null);

  // Forms state
  const [addForm, setAddForm] = useState({
    displayName: '',
    username: '',
    password: '',
    role: 'user',
    status: 'active'
  });
  const [showAddPassword, setShowAddPassword] = useState(false);

  const [editForm, setEditForm] = useState({
    displayName: '',
    role: 'user',
    status: 'active'
  });

  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Auth gate
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'admin') {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get('/api/admin/stats');
      if (res.data?.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await axios.get(`/api/admin/users?${params.toString()}`);
      if (res.data?.success) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      showToast(err.response?.data?.error || 'Failed to load users list.', 'error');
    } finally {
      setLoadingUsers(false);
    }
  }, [searchQuery, roleFilter, statusFilter]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await axios.get('/api/admin/logs?limit=30');
      if (res.data?.success) {
        setLogs(res.data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchStats();
      fetchUsers();
      fetchLogs();
    }
  }, [isAdmin, fetchStats, fetchUsers, fetchLogs]);

  // Helper: generate random secure password
  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Action: Add User
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!addForm.displayName || !addForm.username || !addForm.password) {
      showToast('All fields are required.', 'error');
      return;
    }

    try {
      const res = await axios.post('/api/admin/users', addForm);
      if (res.data?.success) {
        showToast(`User "${addForm.username}" created successfully!`);
        setShowAddModal(false);
        setAddForm({
          displayName: '',
          username: '',
          password: '',
          role: 'user',
          status: 'active'
        });
        fetchUsers();
        fetchStats();
        fetchLogs();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create user.', 'error');
    }
  };

  // Action: Open Edit Modal
  const handleOpenEdit = (targetUser) => {
    setSelectedUser(targetUser);
    setEditForm({
      displayName: targetUser.displayName,
      role: targetUser.role,
      status: targetUser.status
    });
    setShowEditModal(true);
  };

  // Action: Submit Edit User
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const res = await axios.patch(`/api/admin/users/${selectedUser.id}`, editForm);
      if (res.data?.success) {
        showToast(`Updated "${selectedUser.username}" successfully.`);
        setShowEditModal(false);
        fetchUsers();
        fetchStats();
        fetchLogs();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update user.', 'error');
    }
  };

  // Action: Toggle Enable/Disable
  const handleToggleStatus = async (targetUser) => {
    const newStatus = targetUser.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await axios.patch(`/api/admin/users/${targetUser.id}`, { status: newStatus });
      if (res.data?.success) {
        showToast(`Account "${targetUser.username}" set to ${newStatus}.`);
        fetchUsers();
        fetchStats();
        fetchLogs();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to change status.', 'error');
    }
  };

  // Action: Open Reset Password
  const handleOpenReset = (targetUser) => {
    setSelectedUser(targetUser);
    const pwd = generateSecurePassword();
    setResetPasswordValue(pwd);
    setShowResetModal(true);
  };

  // Action: Save Reset Password
  const handleSaveResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUser || !resetPasswordValue) return;

    try {
      const res = await axios.post(`/api/admin/users/${selectedUser.id}/reset-password`, {
        newPassword: resetPasswordValue
      });
      if (res.data?.success) {
        showToast(`Password for "${selectedUser.username}" reset successfully!`);
        setShowResetModal(false);
        fetchLogs();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to reset password.', 'error');
    }
  };

  // Action: Open Delete Dialog
  const handleOpenDelete = (targetUser) => {
    setSelectedUser(targetUser);
    setShowDeleteDialog(true);
  };

  // Action: Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedUser) return;

    try {
      const res = await axios.delete(`/api/admin/users/${selectedUser.id}`);
      if (res.data?.success) {
        showToast(`User "${selectedUser.username}" deleted successfully.`);
        setShowDeleteDialog(false);
        fetchUsers();
        fetchStats();
        fetchLogs();
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete user.', 'error');
    }
  };

  if (authLoading || !user || user.role !== 'admin') {
    return <SkeletonLoader />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Dark Top Bar */}
      <AppHeader />

      {/* Toast Notification Banner */}
      {toast && (
        <div
          id="admin-toast-message"
          style={{
            position: 'fixed',
            top: 64,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            borderRadius: 10,
            background: toast.type === 'error' ? '#EF4444' : '#10B981',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: 13,
            boxShadow: '0 10px 20px rgba(0, 0, 0, 0.15)',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          {toast.type === 'error' ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', padding: 0, marginLeft: 8 }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Admin Content Container */}
      <main style={{ maxWidth: 1360, width: '100%', margin: '0 auto', padding: '28px 24px 60px' }}>
        {/* Title bar with Add User button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px', margin: 0 }}>
                Admin Dashboard
              </h1>
              <span
                style={{
                  background: '#EEF2FF',
                  color: '#4F46E5',
                  padding: '3px 10px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Access & User Management
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 0 }}>
              Manage client accounts, assign privileges, monitor activity logs, and configure access.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              id="btn-refresh-admin"
              onClick={() => {
                fetchStats();
                fetchUsers();
                fetchLogs();
                showToast('Data refreshed');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 14px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>

            <button
              id="btn-add-user"
              onClick={() => {
                const pwd = generateSecurePassword();
                setAddForm({
                  displayName: '',
                  username: '',
                  password: pwd,
                  role: 'user',
                  status: 'active'
                });
                setShowAddModal(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
              }}
            >
              <UserPlus size={16} />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* 1. Summary Cards */}
        <section
          id="admin-summary-cards"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 28
          }}
        >
          {/* Total Users */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Total Accounts</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                {stats.totalUsers}
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#EEF2FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4F46E5'
              }}
            >
              <Users size={22} />
            </div>
          </div>

          {/* Active Users */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Active Users</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                {stats.activeUsers}
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#ECFDF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#059669'
              }}
            >
              <UserCheck size={22} />
            </div>
          </div>

          {/* Disabled Users */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Disabled Users</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#DC2626', marginTop: 4 }}>
                {stats.disabledUsers}
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#FEF2F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#DC2626'
              }}
            >
              <UserX size={22} />
            </div>
          </div>

          {/* Logins 24h */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              padding: '20px 22px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Logins (24h)</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
                {stats.loginsLast24h}
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#FFFBEB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D97706'
              }}
            >
              <Clock size={22} />
            </div>
          </div>
        </section>

        {/* 2. Users Table Card with Search & Filters */}
        <section
          style={{
            background: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            marginBottom: 36
          }}
        >
          {/* Table Header Controls */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94A3B8'
                  }}
                />
                <input
                  id="search-users-input"
                  type="text"
                  placeholder="Search by name or username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 14px 8px 36px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Role filter */}
              <select
                id="role-filter-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  outline: 'none',
                  background: '#FFFFFF',
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Roles</option>
                <option value="user">User (Client)</option>
                <option value="admin">Admin</option>
              </select>

              {/* Status filter */}
              <select
                id="status-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  outline: 'none',
                  background: '#FFFFFF',
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>
              Showing {users.length} user{users.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Table Container */}
          <div style={{ overflowX: 'auto' }}>
            <table
              id="users-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: 13
              }}
            >
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 600 }}>
                  <th style={{ padding: '12px 20px' }}>Display Name</th>
                  <th style={{ padding: '12px 20px' }}>Username / Client ID</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 20px' }}>Created Date</th>
                  <th style={{ padding: '12px 20px' }}>Last Login</th>
                  <th style={{ padding: '12px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                      Loading users list...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                      No users match the criteria.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const isSelf = u.id === user.id;
                    const createdFormatted = new Date(u.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    });
                    const lastLoginFormatted = u.lastLoginAt
                      ? new Date(u.lastLoginAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Never';

                    return (
                      <tr
                        key={u.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background-color 0.1s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#F8FAFC';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <td style={{ padding: '14px 20px', fontWeight: 600, color: '#0F172A' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{u.displayName}</span>
                            {isSelf && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: '#EEF2FF',
                                  color: '#4F46E5',
                                  padding: '1px 6px',
                                  borderRadius: 4
                                }}
                              >
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', fontFamily: 'monospace', color: '#334155' }}>
                          {u.username}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {u.role === 'admin' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#FEF3C7',
                                color: '#92400E',
                                padding: '3px 8px',
                                borderRadius: 9999,
                                fontSize: 11,
                                fontWeight: 700
                              }}
                            >
                              <Shield size={12} />
                              <span>Admin</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#ECFDF5',
                                color: '#065F46',
                                padding: '3px 8px',
                                borderRadius: 9999,
                                fontSize: 11,
                                fontWeight: 700
                              }}
                            >
                              <span>Client</span>
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {u.status === 'active' ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                color: '#059669',
                                fontWeight: 600,
                                fontSize: 12
                              }}
                            >
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                color: '#DC2626',
                                fontWeight: 600,
                                fontSize: 12
                              }}
                            >
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444' }} />
                              <span>Disabled</span>
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 20px', color: '#64748B' }}>{createdFormatted}</td>
                        <td style={{ padding: '14px 20px', color: '#64748B' }}>{lastLoginFormatted}</td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {/* Edit Button */}
                            <button
                              id={`edit-user-${u.id}`}
                              onClick={() => handleOpenEdit(u)}
                              title="Edit user"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #E2E8F0',
                                background: '#FFFFFF',
                                color: '#475569',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              <Edit2 size={13} />
                            </button>

                            {/* Reset Password Button */}
                            <button
                              id={`reset-pwd-${u.id}`}
                              onClick={() => handleOpenReset(u)}
                              title="Reset password"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #E2E8F0',
                                background: '#FFFFFF',
                                color: '#D97706',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              <Key size={13} />
                            </button>

                            {/* Enable / Disable Button */}
                            <button
                              id={`toggle-status-${u.id}`}
                              onClick={() => handleToggleStatus(u)}
                              disabled={isSelf}
                              title={u.status === 'active' ? 'Disable account' : 'Enable account'}
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #E2E8F0',
                                background: '#FFFFFF',
                                color: u.status === 'active' ? '#DC2626' : '#059669',
                                cursor: isSelf ? 'not-allowed' : 'pointer',
                                opacity: isSelf ? 0.4 : 1,
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              {u.status === 'active' ? <UserX size={13} /> : <UserCheck size={13} />}
                            </button>

                            {/* Delete Button */}
                            <button
                              id={`delete-user-${u.id}`}
                              onClick={() => handleOpenDelete(u)}
                              disabled={isSelf}
                              title="Delete user"
                              style={{
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid #FEE2E2',
                                background: '#FFF5F5',
                                color: '#DC2626',
                                cursor: isSelf ? 'not-allowed' : 'pointer',
                                opacity: isSelf ? 0.4 : 1,
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. Activity Log Table */}
        <section
          id="activity-logs-section"
          style={{
            background: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#EEF2FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4F46E5'
                }}
              >
                <Activity size={17} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Recent Activity Logs
                </h2>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  Audit trail of logins, exports, imports, and account management actions
                </span>
              </div>
            </div>

            <button
              id="refresh-logs-btn"
              onClick={fetchLogs}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#64748B',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={12} />
              <span>Refresh Logs</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '10px 20px' }}>Timestamp</th>
                  <th style={{ padding: '10px 20px' }}>User</th>
                  <th style={{ padding: '10px 20px' }}>Action</th>
                  <th style={{ padding: '10px 20px' }}>Details</th>
                  <th style={{ padding: '10px 20px' }}>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {loadingLogs ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                      Loading activity records...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                      No activity recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const timeFormatted = new Date(log.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });

                    // Badge color by action
                    let actionBadgeBg = '#F1F5F9';
                    let actionBadgeColor = '#475569';

                    if (log.action.includes('LOGIN')) {
                      actionBadgeBg = log.action === 'LOGIN' ? '#ECFDF5' : '#FEF2F2';
                      actionBadgeColor = log.action === 'LOGIN' ? '#065F46' : '#B91C1C';
                    } else if (log.action.includes('EXPORT')) {
                      actionBadgeBg = '#EEF2FF';
                      actionBadgeColor = '#4338CA';
                    } else if (log.action.includes('IMPORT') || log.action.includes('MIGRATION')) {
                      actionBadgeBg = '#FDF4FF';
                      actionBadgeColor = '#86198F';
                    } else if (log.action.includes('CREATE')) {
                      actionBadgeBg = '#F0FDF4';
                      actionBadgeColor = '#15803D';
                    } else if (log.action.includes('DELETE')) {
                      actionBadgeBg = '#FEF2F2';
                      actionBadgeColor = '#991B1B';
                    }

                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 20px', color: '#64748B', whiteSpace: 'nowrap' }}>
                          {timeFormatted}
                        </td>
                        <td style={{ padding: '10px 20px', fontWeight: 600, color: '#1E293B' }}>
                          {log.username}
                        </td>
                        <td style={{ padding: '10px 20px' }}>
                          <span
                            style={{
                              background: actionBadgeBg,
                              color: actionBadgeColor,
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              fontFamily: 'monospace'
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '10px 20px', color: '#475569' }}>{log.details || '—'}</td>
                        <td style={{ padding: '10px 20px', color: '#94A3B8', fontFamily: 'monospace', fontSize: 12 }}>
                          {log.ipAddress || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* ── MODAL: Add User ──────────────────────────────────────────────── */}
      {showAddModal && (
        <div
          id="modal-backdrop-add-user"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
        >
          <div
            id="modal-add-user"
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 480,
              width: '100%',
              padding: 28,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0F172A' }}>Create User Account</h3>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Add a new client or administrator</span>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddUser}>
              {/* Display Name */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Display Name
                </label>
                <input
                  id="add-display-name"
                  type="text"
                  placeholder="e.g. SK Diam or Store Manager"
                  value={addForm.displayName}
                  onChange={(e) => setAddForm({ ...addForm, displayName: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Username / Client ID */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Username / Client ID
                </label>
                <input
                  id="add-username"
                  type="text"
                  placeholder="e.g. client_102 or jsmith"
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value.toLowerCase().trim() })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Password with Generate Button */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pwd = generateSecurePassword();
                      setAddForm({ ...addForm, password: pwd });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4F46E5',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Generate Strong Password</span>
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="add-password"
                    type={showAddPassword ? 'text' : 'password'}
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 40px 9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer'
                    }}
                  >
                    {showAddPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Role & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Role
                  </label>
                  <select
                    id="add-role-select"
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      background: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="user">User (Client)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Status
                  </label>
                  <select
                    id="add-status-select"
                    value={addForm.status}
                    onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      background: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-add-user"
                  type="submit"
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#4F46E5',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Edit User ─────────────────────────────────────────────── */}
      {showEditModal && selectedUser && (
        <div
          id="modal-backdrop-edit-user"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
        >
          <div
            id="modal-edit-user"
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 460,
              width: '100%',
              padding: 28,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0F172A' }}>Edit Account</h3>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Username: {selectedUser.username}</span>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Display Name
                </label>
                <input
                  id="edit-display-name"
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Role
                  </label>
                  <select
                    id="edit-role-select"
                    value={editForm.role}
                    disabled={selectedUser.id === user.id}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      background: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="user">User (Client)</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Status
                  </label>
                  <select
                    id="edit-status-select"
                    value={editForm.status}
                    disabled={selectedUser.id === user.id}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      background: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              {selectedUser.id === user.id && (
                <p style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
                  Note: You cannot demote or disable your own active administrator account.
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-edit-user"
                  type="submit"
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#4F46E5',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Reset Password ────────────────────────────────────────── */}
      {showResetModal && selectedUser && (
        <div
          id="modal-backdrop-reset-pwd"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
        >
          <div
            id="modal-reset-pwd"
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 440,
              width: '100%',
              padding: 28,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                  <Key size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#0F172A' }}>Reset Password</h3>
                  <span style={{ fontSize: 12, color: '#64748B' }}>User: {selectedUser.username}</span>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveResetPassword}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pwd = generateSecurePassword();
                      setResetPasswordValue(pwd);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4F46E5',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Generate New</span>
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-password-input"
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '9px 70px 9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      title="Copy password"
                      onClick={() => {
                        navigator.clipboard?.writeText(resetPasswordValue);
                        showToast('Password copied to clipboard!');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748B',
                        cursor: 'pointer',
                        padding: 2
                      }}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      tabIndex={-1}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: 2
                      }}
                    >
                      {showResetPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-reset-pwd"
                  type="submit"
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#D97706',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Delete Confirm Dialog ─────────────────────────────────── */}
      {showDeleteDialog && selectedUser && (
        <div
          id="modal-backdrop-delete"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20
          }}
        >
          <div
            id="dialog-confirm-delete"
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              maxWidth: 420,
              width: '100%',
              padding: 26,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 9999,
                background: '#FEE2E2',
                color: '#DC2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}
            >
              <Trash2 size={24} />
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
              Delete Account?
            </h3>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5, margin: '0 0 24px' }}>
              Are you sure you want to permanently delete account <strong>{selectedUser.username}</strong> ({selectedUser.displayName})? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-user"
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
