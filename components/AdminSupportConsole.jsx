'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  MessageSquare,
  Phone,
  UserCheck,
  Send,
  Smile,
  Mic,
  Paperclip,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Mail,
  ExternalLink,
  Download,
  FileText,
  RefreshCw,
  Sparkles,
  Headphones,
  Bell,
  Eye,
  X
} from 'lucide-react';

const COMMON_EMOJIS = ['😊', '👍', '🙏', '🔥', '🎉', '💡', '❤️', '🚀', '⭐', '📦', '👋', '✅', '❌', '✨', '👏', '🤝'];

const CANNED_RESPONSES = [
  "Hello! How can I assist you with your collections today?",
  "I'm checking your store's collection data right now.",
  "Your Excel file format looks good! You can proceed with the import.",
  "I'll initiate a test export to verify the issue.",
  "Everything has been resolved on our end. Let us know if you need anything else!"
];

export default function AdminSupportConsole({ currentUser = null }) {
  const [conversations, setConversations] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    pendingCount: 0,
    inProgressCount: 0,
    callRequestsCount: 0,
    humanRequestsCount: 0,
    totalUnread: 0
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Pending' | 'In Progress' | 'Closed'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'call' | 'human' | 'unread'
  const [searchQuery, setSearchQuery] = useState('');

  // Selected conversation
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // File upload
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);

  // Media preview lightbox
  const [previewMedia, setPreviewMedia] = useState(null);

  // Modals
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const chatBottomRef = useRef(null);

  // Initial load and periodic polling for real-time conversation & notifications
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => {
      fetchConversations(false);
    }, 2500);

    return () => clearInterval(interval);
  }, [statusFilter, typeFilter, searchQuery]);

  // When selectedChat changes, poll its messages
  useEffect(() => {
    if (selectedChat?.id) {
      pollSelectedMessages(selectedChat.id);
      // Mark as read in backend
      markChatAsRead(selectedChat.id);
    }
  }, [selectedChat?.id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecording]);

  const fetchConversations = async (showLoading = true) => {
    if (showLoading && loading) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('filter', typeFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await axios.get(`/api/admin/chat?${params.toString()}`);
      if (res.data?.success) {
        setConversations(res.data.conversations || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }

        // Keep current selected chat updated
        if (selectedChat?.id) {
          const fresh = res.data.conversations.find((c) => c.id === selectedChat.id);
          if (fresh) {
            setSelectedChat(fresh);
            setMessages(fresh.messages || []);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching admin chats:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const pollSelectedMessages = async (convId) => {
    try {
      const res = await axios.get(`/api/chat/message?conversationId=${convId}`);
      if (res.data?.messages) {
        setMessages(res.data.messages);
      }
    } catch (_) {}
  };

  const markChatAsRead = async (convId) => {
    try {
      await axios.patch('/api/admin/chat', {
        conversationId: convId,
        markAsRead: true
      });
    } catch (_) {}
  };

  const handleSendMessage = async (textToSend = null) => {
    const text = textToSend !== null ? textToSend : inputText;
    if (!text.trim() || !selectedChat?.id || sending) return;

    setSending(true);
    try {
      const res = await axios.post('/api/chat/message', {
        conversationId: selectedChat.id,
        sender: 'admin',
        senderName: currentUser?.displayName || 'Support Team',
        messageType: 'text',
        content: text.trim()
      });

      if (res.data?.message) {
        setMessages((prev) => [...prev, res.data.message]);
        setInputText('');
        setShowEmojiPicker(false);
        fetchConversations(false);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  // Audio Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAndSendAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      showToast('Microphone access denied or unavailable', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      audioChunksRef.current = [];
    }
  };

  const uploadAndSendAudio = async (audioBlob) => {
    if (!selectedChat?.id) return;
    setSending(true);
    try {
      const formData = new FormData();
      const audioFile = new File([audioBlob], `admin_voice_${Date.now()}.webm`, { type: 'audio/webm' });
      formData.append('file', audioFile);
      formData.append('conversationId', selectedChat.id);

      const uploadRes = await axios.post('/api/chat/upload', formData);
      if (uploadRes.data?.success) {
        const msgRes = await axios.post('/api/chat/message', {
          conversationId: selectedChat.id,
          sender: 'admin',
          senderName: currentUser?.displayName || 'Support Team',
          messageType: 'audio',
          fileUrl: uploadRes.data.fileUrl,
          fileName: uploadRes.data.fileName,
          fileSize: uploadRes.data.fileSize,
          fileMime: uploadRes.data.fileMime,
          content: '🎤 Voice message'
        });
        if (msgRes.data?.message) {
          setMessages((prev) => [...prev, msgRes.data.message]);
          fetchConversations(false);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to send audio message', 'error');
    } finally {
      setSending(false);
    }
  };

  // File Upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat?.id) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', selectedChat.id);

      const uploadRes = await axios.post('/api/chat/upload', formData);
      if (uploadRes.data?.success) {
        let msgType = 'file';
        if (file.type.startsWith('image/')) msgType = 'image';
        else if (file.type.startsWith('video/')) msgType = 'video';
        else if (file.type.startsWith('audio/')) msgType = 'audio';

        const msgRes = await axios.post('/api/chat/message', {
          conversationId: selectedChat.id,
          sender: 'admin',
          senderName: currentUser?.displayName || 'Support Team',
          messageType: msgType,
          fileUrl: uploadRes.data.fileUrl,
          fileName: uploadRes.data.fileName,
          fileSize: uploadRes.data.fileSize,
          fileMime: uploadRes.data.fileMime,
          content: file.name
        });

        if (msgRes.data?.message) {
          setMessages((prev) => [...prev, msgRes.data.message]);
          fetchConversations(false);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to upload attachment', 'error');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!selectedChat?.id) return;
    if (newStatus === 'Resolved') {
      setShowResolveModal(true);
      return;
    }

    try {
      const res = await axios.patch('/api/admin/chat', {
        conversationId: selectedChat.id,
        status: newStatus
      });
      if (res.data?.success) {
        setSelectedChat(res.data.conversation);
        fetchConversations(false);
        showToast(`Status updated to ${newStatus}`, 'success');
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  const confirmResolveAndEmail = async () => {
    if (!selectedChat?.id) return;
    setResolving(true);
    try {
      const res = await axios.patch('/api/admin/chat', {
        conversationId: selectedChat.id,
        status: 'Resolved'
      });

      if (res.data?.success) {
        setShowResolveModal(false);
        showToast(
          `✅ Chat history emailed to ${selectedChat.customerEmail} from meetvariya1756@gmail.com! Conversation data safely purged.`,
          'success'
        );
        setSelectedChat(null);
        setMessages([]);
        fetchConversations(true);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to resolve and email conversation', 'error');
    } finally {
      setResolving(false);
    }
  };

  const confirmDeleteChat = async () => {
    if (!selectedChat?.id) return;
    setDeleting(true);
    try {
      const res = await axios.delete(`/api/admin/chat?id=${selectedChat.id}`);
      if (res.data?.success) {
        setShowDeleteModal(false);
        showToast('Conversation and all files permanently deleted from storage.', 'success');
        setSelectedChat(null);
        setMessages([]);
        fetchConversations(true);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete conversation', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 999999,
            backgroundColor: toast.type === 'error' ? '#EF4444' : '#10B981',
            color: '#FFFFFF',
            padding: '12px 20px',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            fontWeight: 600
          }}
        >
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Metric & Notification Alert Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}
      >
        {/* Total Active Chats */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: 16,
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: '#EEF2FF',
              color: '#4F46E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <MessageSquare size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Total Active Chats</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>{summary.total}</div>
          </div>
        </div>

        {/* Pending Inquiries */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            padding: 16,
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Pending Queries</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#D97706' }}>{summary.pendingCount}</div>
          </div>
        </div>

        {/* Call Support Alerts */}
        <div
          onClick={() => setTypeFilter(typeFilter === 'call' ? 'all' : 'call')}
          style={{
            backgroundColor: summary.callRequestsCount > 0 ? '#FEF2F2' : '#FFFFFF',
            padding: 16,
            borderRadius: 12,
            border: summary.callRequestsCount > 0 ? '1px solid #FCA5A5' : '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer'
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: summary.callRequestsCount > 0 ? '#EF4444' : '#DCFCE7',
              color: summary.callRequestsCount > 0 ? '#FFFFFF' : '#166534',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Phone size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: summary.callRequestsCount > 0 ? '#DC2626' : '#64748B' }}>
              📞 Call Requests
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: summary.callRequestsCount > 0 ? '#DC2626' : '#0F172A' }}>
              {summary.callRequestsCount}
            </div>
          </div>
        </div>

        {/* Human Agent Alerts */}
        <div
          onClick={() => setTypeFilter(typeFilter === 'human' ? 'all' : 'human')}
          style={{
            backgroundColor: summary.humanRequestsCount > 0 ? '#EFF6FF' : '#FFFFFF',
            padding: 16,
            borderRadius: 12,
            border: summary.humanRequestsCount > 0 ? '1px solid #93C5FD' : '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer'
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: summary.humanRequestsCount > 0 ? '#3B82F6' : '#F1F5F9',
              color: summary.humanRequestsCount > 0 ? '#FFFFFF' : '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Headphones size={22} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: summary.humanRequestsCount > 0 ? '#2563EB' : '#64748B' }}>
              🙋 Human Requested
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: summary.humanRequestsCount > 0 ? '#2563EB' : '#0F172A' }}>
              {summary.humanRequestsCount}
            </div>
          </div>
        </div>
      </div>

      {/* Main Console Split View */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '360px 1fr',
          gap: 20,
          minHeight: 640,
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
        }}
      >
        {/* Left Column: Conversations List */}
        <div
          style={{
            borderRight: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#F8FAFC'
          }}
        >
          {/* Search & Filter Header */}
          <div style={{ padding: 14, borderBottom: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 10, top: 10 }} />
              <input
                type="text"
                placeholder="Search store or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 32px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  outline: 'none',
                  backgroundColor: '#FFFFFF'
                }}
              />
            </div>

            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
              {['all', 'Pending', 'In Progress', 'Closed'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: statusFilter === st ? '#1E293B' : '#E2E8F0',
                    color: statusFilter === st ? '#FFFFFF' : '#475569',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {st === 'all' ? 'All' : st}
                </button>
              ))}
            </div>

            {/* Special Filter Pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setTypeFilter(typeFilter === 'call' ? 'all' : 'call')}
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid #FCA5A5',
                  backgroundColor: typeFilter === 'call' ? '#EF4444' : '#FEF2F2',
                  color: typeFilter === 'call' ? '#FFFFFF' : '#DC2626',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Phone size={11} />
                <span>Calls ({summary.callRequestsCount})</span>
              </button>

              <button
                onClick={() => setTypeFilter(typeFilter === 'human' ? 'all' : 'human')}
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  border: '1px solid #93C5FD',
                  backgroundColor: typeFilter === 'human' ? '#3B82F6' : '#EFF6FF',
                  color: typeFilter === 'human' ? '#FFFFFF' : '#2563EB',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Headphones size={11} />
                <span>Human ({summary.humanRequestsCount})</span>
              </button>
            </div>
          </div>

          {/* List items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conversations.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                No conversations found matching filters.
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedChat?.id === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedChat(conv)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                      border: isSelected ? '1px solid #6366F1' : '1px solid transparent',
                      boxShadow: isSelected ? '0 4px 12px rgba(99, 102, 241, 0.12)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                        {conv.customerName || conv.shop}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor:
                            conv.status === 'Pending'
                              ? '#FEF3C7'
                              : conv.status === 'In Progress'
                              ? '#E0E7FF'
                              : '#F1F5F9',
                          color:
                            conv.status === 'Pending'
                              ? '#D97706'
                              : conv.status === 'In Progress'
                              ? '#4F46E5'
                              : '#475569'
                        }}
                      >
                        {conv.status}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: '#64748B' }}>{conv.shop}</div>

                    {/* Badges for Call or Human */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {conv.callRequested && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                        >
                          <Phone size={10} /> Call Requested
                        </span>
                      )}

                      {conv.humanRequested && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: '#E0E7FF',
                            color: '#4338CA',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                        >
                          <Headphones size={10} /> Human Agent
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: '#475569',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {conv.lastMessage || 'No messages yet'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>
                        {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {conv.unreadAdminCount > 0 && (
                        <span
                          style={{
                            backgroundColor: '#EF4444',
                            color: '#FFFFFF',
                            fontSize: 10,
                            fontWeight: 800,
                            borderRadius: 9999,
                            padding: '1px 6px'
                          }}
                        >
                          {conv.unreadAdminCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chat Conversation & Details */}
        {selectedChat ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Conversation Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#FFFFFF'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                    {selectedChat.customerName || 'Merchant'}
                  </h3>
                  <span style={{ fontSize: 12, color: '#64748B' }}>({selectedChat.customerEmail})</span>
                </div>
                <div style={{ fontSize: 12, color: '#4F46E5', fontWeight: 600, marginTop: 2 }}>
                  Store: {selectedChat.shop}
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Status Dropdown */}
                <select
                  value={selectedChat.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #CBD5E1',
                    fontSize: 12,
                    fontWeight: 700,
                    backgroundColor: '#F8FAFC',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved (Email & Purge)</option>
                  <option value="Closed">Closed</option>
                </select>

                {/* Resolve & Send Transcript Email Button */}
                <button
                  onClick={() => setShowResolveModal(true)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 8,
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Mail size={14} />
                  <span>Resolve & Email</span>
                </button>

                {/* Manual Delete Chat Button */}
                <button
                  title="Permanently Delete Conversation"
                  onClick={() => setShowDeleteModal(true)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Call Support Info Banner (if call requested) */}
            {selectedChat.callRequested && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  borderBottom: '1px solid #FECACA',
                  padding: '10px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: '#991B1B'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={16} color="#DC2626" />
                  <span>
                    <strong>Call Requested:</strong> {selectedChat.customerPhone} | Time:{' '}
                    {selectedChat.callPreferredTime || 'ASAP'} | Topic: {selectedChat.callTopic || 'Support'}
                  </span>
                </div>
                <a
                  href={`tel:${selectedChat.customerPhone}`}
                  style={{
                    backgroundColor: '#DC2626',
                    color: '#FFFFFF',
                    padding: '4px 10px',
                    borderRadius: 6,
                    textDecoration: 'none',
                    fontSize: 11,
                    fontWeight: 700
                  }}
                >
                  Call Now
                </a>
              </div>
            )}

            {/* Human Agent Request Banner */}
            {selectedChat.humanRequested && (
              <div
                style={{
                  backgroundColor: '#EEF2FF',
                  borderBottom: '1px solid #C7D2FE',
                  padding: '8px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: '#3730A3',
                  fontWeight: 600
                }}
              >
                <Headphones size={15} color="#4F46E5" />
                <span>Customer requested live human support. You are chatting as the Human Agent.</span>
              </div>
            )}

            {/* Chat Messages List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                backgroundColor: '#F8FAFC'
              }}
            >
              {messages.map((msg) => {
                const isAdmin = msg.sender === 'admin';
                const isCustomer = msg.sender === 'customer';
                const isSystem = msg.sender === 'system';
                const isBot = msg.sender === 'bot';

                if (isSystem) {
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: 'center',
                        backgroundColor: '#E2E8F0',
                        color: '#475569',
                        fontSize: 11,
                        padding: '6px 14px',
                        borderRadius: 14,
                        maxWidth: '85%',
                        textAlign: 'center'
                      }}
                    >
                      {msg.content}
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isAdmin ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#64748B',
                        marginBottom: 3,
                        padding: '0 4px'
                      }}
                    >
                      {isAdmin ? 'Admin (You)' : isBot ? 'Bot Assistant' : msg.senderName || 'Customer'}
                    </div>

                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: 16,
                        borderBottomRightRadius: isAdmin ? 4 : 16,
                        borderBottomLeftRadius: !isAdmin ? 4 : 16,
                        backgroundColor: isAdmin ? '#4F46E5' : '#FFFFFF',
                        color: isAdmin ? '#FFFFFF' : '#0F172A',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        fontSize: 13,
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                        border: isAdmin ? 'none' : '1px solid #E2E8F0'
                      }}
                    >
                      {msg.content && <div>{msg.content}</div>}

                      {/* Image Preview */}
                      {msg.messageType === 'image' && msg.fileUrl && (
                        <div style={{ marginTop: msg.content ? 8 : 0 }}>
                          <img
                            src={msg.fileUrl}
                            alt={msg.fileName}
                            style={{
                              maxWidth: '100%',
                              maxHeight: 240,
                              borderRadius: 8,
                              cursor: 'pointer',
                              display: 'block'
                            }}
                            onClick={() => setPreviewMedia({ type: 'image', url: msg.fileUrl, name: msg.fileName })}
                          />
                        </div>
                      )}

                      {/* Video Player */}
                      {msg.messageType === 'video' && msg.fileUrl && (
                        <div style={{ marginTop: msg.content ? 8 : 0 }}>
                          <video
                            controls
                            src={msg.fileUrl}
                            style={{
                              maxWidth: '100%',
                              maxHeight: 240,
                              borderRadius: 8,
                              display: 'block'
                            }}
                          />
                        </div>
                      )}

                      {/* Audio Message Player */}
                      {msg.messageType === 'audio' && msg.fileUrl && (
                        <div style={{ marginTop: 6, minWidth: 220 }}>
                          <audio controls src={msg.fileUrl} style={{ width: '100%', height: 36 }} />
                        </div>
                      )}

                      {/* Generic File Download */}
                      {msg.messageType === 'file' && msg.fileUrl && (
                        <a
                          href={msg.fileUrl}
                          download={msg.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            marginTop: 6,
                            padding: '6px 10px',
                            backgroundColor: isAdmin ? 'rgba(255,255,255,0.18)' : '#F1F5F9',
                            borderRadius: 8,
                            color: isAdmin ? '#FFFFFF' : '#0F172A',
                            textDecoration: 'none',
                            fontSize: 12
                          }}
                        >
                          <FileText size={16} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {msg.fileName || 'Download Attachment'}
                          </span>
                          <Download size={14} />
                        </a>
                      )}
                    </div>

                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3, padding: '0 4px' }}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            {/* Canned Responses Quick Bar */}
            <div
              style={{
                padding: '6px 14px',
                backgroundColor: '#F1F5F9',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                fontSize: 11
              }}
            >
              <span style={{ color: '#64748B', fontWeight: 700, alignSelf: 'center', whiteSpace: 'nowrap' }}>
                Quick Replies:
              </span>
              {CANNED_RESPONSES.map((resp, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(resp)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: 11,
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {resp.slice(0, 30)}...
                </button>
              ))}
            </div>

            {/* Recording Indicator */}
            {isRecording && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  borderTop: '1px solid #FECACA',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: '#DC2626'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#EF4444',
                      animation: 'pulse 1s infinite'
                    }}
                  />
                  <span>Recording Admin Voice Note... {recordingSeconds}s</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={cancelRecording}
                    style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={stopRecording}
                    style={{
                      background: '#EF4444',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 6,
                      padding: '3px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Send Audio
                  </button>
                </div>
              </div>
            )}

            {/* Emoji Popover */}
            {showEmojiPicker && (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderTop: '1px solid #E2E8F0',
                  padding: '8px 16px',
                  display: 'flex',
                  gap: 8,
                  fontSize: 18,
                  overflowX: 'auto'
                }}
              >
                {COMMON_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setInputText((prev) => prev + emoji)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Admin Input Toolbar */}
            <div
              style={{
                padding: '12px 18px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
              />

              <button
                disabled={uploadingFile}
                title="Attach Media / File"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: 6
                }}
              >
                <Paperclip size={18} />
              </button>

              <button
                disabled={uploadingFile}
                title={isRecording ? 'Stop Recording' : 'Record Voice Note'}
                onClick={isRecording ? stopRecording : startRecording}
                style={{
                  background: isRecording ? '#EF4444' : 'none',
                  border: 'none',
                  color: isRecording ? '#FFFFFF' : '#64748B',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6
                }}
              >
                <Mic size={18} />
              </button>

              <button
                title="Insert Emoji"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                style={{
                  background: showEmojiPicker ? '#EEF2FF' : 'none',
                  border: 'none',
                  color: showEmojiPicker ? '#4F46E5' : '#64748B',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6
                }}
              >
                <Smile size={18} />
              </button>

              <input
                type="text"
                placeholder={uploadingFile ? 'Uploading file...' : 'Type admin reply...'}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                disabled={uploadingFile || isRecording}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  outline: 'none'
                }}
              />

              <button
                disabled={!inputText.trim() || sending}
                onClick={() => handleSendMessage()}
                style={{
                  backgroundColor: inputText.trim() ? '#4F46E5' : '#E2E8F0',
                  color: inputText.trim() ? '#FFFFFF' : '#94A3B8',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: inputText.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Send size={15} />
                <span>Send</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              color: '#94A3B8'
            }}
          >
            <MessageSquare size={48} strokeWidth={1.5} style={{ marginBottom: 16 }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#475569' }}>No Conversation Selected</h4>
            <p style={{ margin: 0, fontSize: 13 }}>
              Select a conversation from the left to view customer messages and reply.
            </p>
          </div>
        )}
      </div>

      {/* Resolve & Send Email Confirmation Modal */}
      {showResolveModal && selectedChat && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            backdropFilter: 'blur(3px)'
          }}
        >
          <div
            style={{
              width: 480,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: '#DCFCE7',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Mail size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0F172A' }}>
                  Resolve & Email Chat History
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>
                  Automated Resolution & Data Archival
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
                fontSize: 13,
                lineHeight: 1.5,
                color: '#334155'
              }}
            >
              <p style={{ margin: '0 0 8px 0' }}>
                Upon marking this conversation as <strong>Resolved</strong>:
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  The complete transcript ({messages.length} messages) will be emailed to:
                  <br />
                  <strong style={{ color: '#4F46E5' }}>{selectedChat.customerEmail}</strong>
                </li>
                <li>
                  Sender address: <strong>meetvariya1756@gmail.com</strong>
                </li>
                <li style={{ color: '#DC2626', fontWeight: 600 }}>
                  After successful email delivery, all conversation data and uploaded media files will be{' '}
                  <u>permanently deleted</u> from database and storage.
                </li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                disabled={resolving}
                onClick={() => setShowResolveModal(false)}
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
                type="button"
                disabled={resolving}
                onClick={confirmResolveAndEmail}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#10B981',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {resolving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>{resolving ? 'Sending Email & Purging...' : 'Confirm & Send Transcript'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Delete Confirmation Modal */}
      {showDeleteModal && selectedChat && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            backdropFilter: 'blur(3px)'
          }}
        >
          <div
            style={{
              width: 420,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Trash2 size={22} />
              </div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                Delete Conversation Permanently?
              </h4>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748B', lineHeight: 1.45 }}>
              Are you sure you want to delete this chat with <strong>{selectedChat.shop}</strong>? All conversation
              messages and uploaded files will be permanently erased.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
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
                type="button"
                disabled={deleting}
                onClick={confirmDeleteChat}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Preview Lightbox */}
      {previewMedia && (
        <div
          onClick={() => setPreviewMedia(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100001,
            padding: 20
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            <img
              src={previewMedia.url}
              alt={previewMedia.name}
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }}
            />
            <button
              onClick={() => setPreviewMedia(null)}
              style={{
                position: 'absolute',
                top: -36,
                right: 0,
                background: 'none',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
