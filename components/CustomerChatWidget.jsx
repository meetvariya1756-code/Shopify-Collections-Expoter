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
  Square,
  Paperclip,
  X,
  Minimize2,
  Maximize2,
  FileText,
  Download,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Headphones
} from 'lucide-react';

const COMMON_EMOJIS = ['😊', '👍', '🙏', '🔥', '🎉', '💡', '❤️', '🚀', '⭐', '📦', '👋', '✅', '❌', '✨', '👏', '🤝'];

export default function CustomerChatWidget({ shop = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // Initial user form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSessionStarted, setIsSessionStarted] = useState(false);

  // Message input state
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Call support modal state
  const [showCallModal, setShowCallModal] = useState(false);
  const [callPhone, setCallPhone] = useState('');
  const [callPreferredTime, setCallPreferredTime] = useState('ASAP');
  const [callTopic, setCallTopic] = useState('');
  const [submittingCall, setSubmittingCall] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // File uploading state
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef(null);

  // Selected media preview in lightbox
  const [previewMedia, setPreviewMedia] = useState(null);

  // Auto-scroll
  const chatBottomRef = useRef(null);

  // Initialize or restore conversation from local storage
  useEffect(() => {
    const savedConvId = localStorage.getItem('ce_support_conv_id');
    const savedEmail = localStorage.getItem('ce_support_email');
    const savedName = localStorage.getItem('ce_support_name');

    if (savedEmail) setCustomerEmail(savedEmail);
    if (savedName) setCustomerName(savedName);

    if (savedConvId) {
      fetchConversation(savedConvId);
    }
  }, [shop]);

  // Polling for new messages when open and active
  useEffect(() => {
    let interval = null;
    if (isOpen && conversation?.id) {
      interval = setInterval(() => {
        pollMessages(conversation.id);
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, conversation?.id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecording]);

  const fetchConversation = async (convId) => {
    try {
      const res = await axios.get(`/api/chat/session?id=${convId}`);
      if (res.data?.conversation) {
        setConversation(res.data.conversation);
        setMessages(res.data.conversation.messages || []);
        setIsSessionStarted(true);
      } else {
        localStorage.removeItem('ce_support_conv_id');
      }
    } catch (_) {
      localStorage.removeItem('ce_support_conv_id');
    }
  };

  const pollMessages = async (convId) => {
    try {
      const res = await axios.get(`/api/chat/message?conversationId=${convId}`);
      if (res.data?.messages) {
        setMessages(res.data.messages);
      }
    } catch (_) {}
  };

  const handleStartSession = async (type = 'chat') => {
    if (!customerEmail.trim()) {
      alert('Please enter your email address to receive your support transcript.');
      return;
    }

    setLoading(true);
    try {
      const shopDomain = shop || window.location.hostname || 'merchant-store.myshopify.com';
      const res = await axios.post('/api/chat/session', {
        shop: shopDomain,
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim() || 'Merchant',
        supportType: type
      });

      if (res.data?.conversation) {
        setConversation(res.data.conversation);
        setMessages(res.data.conversation.messages || []);
        setIsSessionStarted(true);
        localStorage.setItem('ce_support_conv_id', res.data.conversation.id);
        localStorage.setItem('ce_support_email', customerEmail.trim());
        localStorage.setItem('ce_support_name', customerName.trim());
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start support session.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (textToSend = null) => {
    const text = textToSend !== null ? textToSend : inputText;
    if (!text.trim() || !conversation?.id || sending) return;

    setSending(true);
    try {
      const res = await axios.post('/api/chat/message', {
        conversationId: conversation.id,
        sender: 'customer',
        senderName: customerName || 'Merchant',
        messageType: 'text',
        content: text.trim()
      });

      if (res.data?.message) {
        setMessages((prev) => [...prev, res.data.message]);
        setInputText('');
        setShowEmojiPicker(false);
      }
    } catch (err) {
      alert('Failed to send message: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  };

  const handleRequestHuman = async () => {
    if (!conversation?.id) return;
    try {
      await axios.post('/api/chat/request-human', { conversationId: conversation.id });
      setConversation((prev) => ({ ...prev, humanRequested: true }));
      pollMessages(conversation.id);
    } catch (err) {
      alert('Failed to request human agent: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSubmitCallRequest = async (e) => {
    e.preventDefault();
    if (!callPhone.trim() || !conversation?.id) return;

    setSubmittingCall(true);
    try {
      await axios.post('/api/chat/request-call', {
        conversationId: conversation.id,
        phone: callPhone.trim(),
        preferredTime: callPreferredTime,
        topic: callTopic.trim()
      });
      setShowCallModal(false);
      setCallPhone('');
      setCallTopic('');
      pollMessages(conversation.id);
      alert('📞 Your Call Support request has been sent! Our support team will call you shortly.');
    } catch (err) {
      alert('Failed to submit call request: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmittingCall(false);
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
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
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
      alert('Microphone access denied or not supported on this browser.');
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
      mediaRecorderRef.current.onstop = null; // Don't upload
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      audioChunksRef.current = [];
    }
  };

  const uploadAndSendAudio = async (audioBlob) => {
    if (!conversation?.id) return;
    setSending(true);
    try {
      const formData = new FormData();
      const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
      formData.append('file', audioFile);
      formData.append('conversationId', conversation.id);

      const uploadRes = await axios.post('/api/chat/upload', formData);
      if (uploadRes.data?.success) {
        const msgRes = await axios.post('/api/chat/message', {
          conversationId: conversation.id,
          sender: 'customer',
          senderName: customerName || 'Merchant',
          messageType: 'audio',
          fileUrl: uploadRes.data.fileUrl,
          fileName: uploadRes.data.fileName,
          fileSize: uploadRes.data.fileSize,
          fileMime: uploadRes.data.fileMime,
          content: '🎤 Voice message'
        });
        if (msgRes.data?.message) {
          setMessages((prev) => [...prev, msgRes.data.message]);
        }
      }
    } catch (err) {
      alert('Failed to send audio message: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  };

  // File Upload Handler
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !conversation?.id) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', conversation.id);

      const uploadRes = await axios.post('/api/chat/upload', formData);
      if (uploadRes.data?.success) {
        let msgType = 'file';
        if (file.type.startsWith('image/')) msgType = 'image';
        else if (file.type.startsWith('video/')) msgType = 'video';
        else if (file.type.startsWith('audio/')) msgType = 'audio';

        const msgRes = await axios.post('/api/chat/message', {
          conversationId: conversation.id,
          sender: 'customer',
          senderName: customerName || 'Merchant',
          messageType: msgType,
          fileUrl: uploadRes.data.fileUrl,
          fileName: uploadRes.data.fileName,
          fileSize: uploadRes.data.fileSize,
          fileMime: uploadRes.data.fileMime,
          content: file.name
        });

        if (msgRes.data?.message) {
          setMessages((prev) => [...prev, msgRes.data.message]);
        }
      }
    } catch (err) {
      alert('Failed to upload file: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          id="chat-widget-launcher"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            height: 54,
            borderRadius: 27,
            padding: '0 20px',
            backgroundColor: '#4F46E5',
            backgroundImage: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)',
            color: '#FFFFFF',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.45)',
            cursor: 'pointer',
            zIndex: 99999,
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          <div style={{ position: 'relative' }}>
            <Headphones size={22} />
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 9,
                height: 9,
                borderRadius: '50%',
                backgroundColor: '#10B981',
                border: '2px solid #FFFFFF'
              }}
            />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.2px' }}>Support & Chat</span>
        </button>
      )}

      {/* Main Widget Card */}
      {isOpen && (
        <div
          id="chat-widget-panel"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 380,
            maxWidth: 'calc(100vw - 32px)',
            height: 600,
            maxHeight: 'calc(100vh - 48px)',
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.22)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #E2E8F0',
            zIndex: 99999,
            animation: 'fadeInUp 0.25s ease-out'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 18px',
              backgroundColor: '#1E1B4B',
              backgroundImage: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(6px)'
                }}
              >
                <Sparkles size={20} color="#FBBF24" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#FFFFFF' }}>Collections Support</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#A5B4FC' }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      backgroundColor: '#10B981'
                    }}
                  />
                  <span>Live Agent & Bot Support</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isSessionStarted && (
                <button
                  title="Request Call Support"
                  onClick={() => setShowCallModal(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.12)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 8px',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600
                  }}
                >
                  <Phone size={13} />
                  <span>Call</span>
                </button>
              )}

              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Subheader: Human Agent request status pill */}
          {isSessionStarted && (
            <div
              style={{
                backgroundColor: '#EEF2FF',
                borderBottom: '1px solid #E0E7FF',
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#4338CA'
              }}
            >
              <span>
                {conversation?.humanRequested
                  ? '🙋 Connected to Human Queue'
                  : '🤖 AI Assistant Active'}
              </span>

              {!conversation?.humanRequested && (
                <button
                  onClick={handleRequestHuman}
                  style={{
                    background: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 9999,
                    padding: '3px 9px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Connect with Human
                </button>
              )}
            </div>
          )}

          {/* Body */}
          {!isSessionStarted ? (
            /* Welcome / Initial Start View */
            <div
              style={{
                flex: 1,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                backgroundColor: '#F8FAFC'
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12
                  }}
                >
                  <Headphones size={28} />
                </div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 17, fontWeight: 700, color: '#1E293B' }}>
                  How can we help today?
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: '#64748B', lineHeight: 1.4 }}>
                  Connect with our team for instant answers, excel migrations, or request a phone call.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Merchant Name"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    Your Email (For Transcript Delivery) *
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="merchant@example.com"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: '1px solid #CBD5E1',
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  disabled={loading}
                  onClick={() => handleStartSession('chat')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    backgroundColor: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                  }}
                >
                  <MessageSquare size={16} />
                  <span>{loading ? 'Starting...' : 'Start Live Chat'}</span>
                </button>

                <button
                  disabled={loading}
                  onClick={() => {
                    handleStartSession('call');
                    setShowCallModal(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: 10,
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    border: '1px solid #CBD5E1',
                    fontWeight: 600,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: 'pointer'
                  }}
                >
                  <Phone size={15} color="#059669" />
                  <span>Request Call Support</span>
                </button>
              </div>
            </div>
          ) : (
            /* Active Chat View */
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                backgroundColor: '#F8FAFC'
              }}
            >
              {/* Message scroll list */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                {messages.map((msg) => {
                  const isMe = msg.sender === 'customer';
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
                          padding: '5px 12px',
                          borderRadius: 12,
                          maxWidth: '90%',
                          textAlign: 'center',
                          lineHeight: 1.4
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
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '82%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#94A3B8',
                          marginBottom: 3,
                          padding: '0 4px'
                        }}
                      >
                        {isMe ? 'You' : isBot ? 'Assistant' : msg.senderName || 'Support Agent'}
                      </div>

                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: 16,
                          borderBottomRightRadius: isMe ? 4 : 16,
                          borderBottomLeftRadius: !isMe ? 4 : 16,
                          backgroundColor: isMe ? '#4F46E5' : '#FFFFFF',
                          color: isMe ? '#FFFFFF' : '#1E293B',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                          fontSize: 13,
                          lineHeight: 1.45,
                          wordBreak: 'break-word',
                          border: isMe ? 'none' : '1px solid #E2E8F0'
                        }}
                      >
                        {/* Text / Caption */}
                        {msg.content && <div>{msg.content}</div>}

                        {/* Image file */}
                        {msg.messageType === 'image' && msg.fileUrl && (
                          <div style={{ marginTop: msg.content ? 8 : 0 }}>
                            <img
                              src={msg.fileUrl}
                              alt={msg.fileName || 'Attachment'}
                              style={{
                                maxWidth: '100%',
                                maxHeight: 180,
                                borderRadius: 8,
                                cursor: 'pointer',
                                display: 'block'
                              }}
                              onClick={() => setPreviewMedia({ type: 'image', url: msg.fileUrl, name: msg.fileName })}
                            />
                          </div>
                        )}

                        {/* Video file */}
                        {msg.messageType === 'video' && msg.fileUrl && (
                          <div style={{ marginTop: msg.content ? 8 : 0 }}>
                            <video
                              controls
                              src={msg.fileUrl}
                              style={{
                                maxWidth: '100%',
                                maxHeight: 180,
                                borderRadius: 8,
                                display: 'block'
                              }}
                            />
                          </div>
                        )}

                        {/* Audio file */}
                        {msg.messageType === 'audio' && msg.fileUrl && (
                          <div style={{ marginTop: 6, minWidth: 200 }}>
                            <audio
                              controls
                              src={msg.fileUrl}
                              style={{ width: '100%', height: 36, outline: 'none' }}
                            />
                          </div>
                        )}

                        {/* Generic File */}
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
                              backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : '#F1F5F9',
                              borderRadius: 8,
                              color: isMe ? '#FFFFFF' : '#0F172A',
                              textDecoration: 'none',
                              fontSize: 12
                            }}
                          >
                            <FileText size={16} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {msg.fileName || 'Download File'}
                            </span>
                            <Download size={14} />
                          </a>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 9,
                          color: '#94A3B8',
                          marginTop: 3,
                          padding: '0 4px'
                        }}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottomRef} />
              </div>

              {/* Recording indicator bar */}
              {isRecording && (
                <div
                  style={{
                    backgroundColor: '#FEF2F2',
                    borderTop: '1px solid #FECACA',
                    padding: '8px 14px',
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
                    <span>Recording Audio... {recordingSeconds}s</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={cancelRecording}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6B7280',
                        fontSize: 11,
                        cursor: 'pointer'
                      }}
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

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderTop: '1px solid #E2E8F0',
                    padding: '10px 14px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    gap: 6,
                    fontSize: 18
                  }}
                >
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setInputText((prev) => prev + emoji);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 18,
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 6
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Toolbar & Area */}
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#FFFFFF',
                  borderTop: '1px solid #E2E8F0'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* File Upload Hidden Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
                  />

                  {/* Attachment button */}
                  <button
                    disabled={uploadingFile || isRecording}
                    title="Attach File / Media"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: uploadingFile ? '#94A3B8' : '#64748B',
                      cursor: 'pointer',
                      padding: 6,
                      borderRadius: 8
                    }}
                  >
                    <Paperclip size={18} />
                  </button>

                  {/* Audio Record Button */}
                  <button
                    disabled={uploadingFile}
                    title={isRecording ? 'Stop Recording' : 'Record Audio Message'}
                    onClick={isRecording ? stopRecording : startRecording}
                    style={{
                      background: isRecording ? '#EF4444' : 'none',
                      border: 'none',
                      color: isRecording ? '#FFFFFF' : '#64748B',
                      cursor: 'pointer',
                      padding: 6,
                      borderRadius: 8
                    }}
                  >
                    <Mic size={18} />
                  </button>

                  {/* Emoji Button */}
                  <button
                    title="Insert Emoji"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    style={{
                      background: showEmojiPicker ? '#EEF2FF' : 'none',
                      border: 'none',
                      color: showEmojiPicker ? '#4F46E5' : '#64748B',
                      cursor: 'pointer',
                      padding: 6,
                      borderRadius: 8
                    }}
                  >
                    <Smile size={18} />
                  </button>

                  {/* Input field */}
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                    placeholder={uploadingFile ? 'Uploading file...' : 'Type message...'}
                    disabled={uploadingFile || isRecording}
                    style={{
                      flex: 1,
                      border: '1px solid #CBD5E1',
                      borderRadius: 20,
                      padding: '8px 14px',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  />

                  {/* Send Button */}
                  <button
                    disabled={!inputText.trim() || sending}
                    onClick={() => handleSendMessage()}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      backgroundColor: inputText.trim() ? '#4F46E5' : '#E2E8F0',
                      color: inputText.trim() ? '#FFFFFF' : '#94A3B8',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: inputText.trim() ? 'pointer' : 'default',
                      transition: 'background-color 0.15s'
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Call Support Modal */}
      {showCallModal && (
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
              width: 380,
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={20} color="#059669" />
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Request Call Support</h4>
              </div>
              <button
                onClick={() => setShowCallModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748B' }}>
              Provide your phone number and our engineering support agent will contact your store directly.
            </p>

            <form onSubmit={handleSubmitCallRequest}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Phone Number (with Country Code) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (555) 000-0000"
                  value={callPhone}
                  onChange={(e) => setCallPhone(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Preferred Time
                </label>
                <select
                  value={callPreferredTime}
                  onChange={(e) => setCallPreferredTime(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                >
                  <option value="ASAP">Immediately (ASAP)</option>
                  <option value="Within 30 mins">Within 30 Minutes</option>
                  <option value="Morning">Morning (9 AM - 12 PM)</option>
                  <option value="Afternoon">Afternoon (12 PM - 5 PM)</option>
                </select>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Topic / Question
                </label>
                <input
                  type="text"
                  placeholder="e.g. Excel import issue, rules mapping"
                  value={callTopic}
                  onChange={(e) => setCallTopic(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowCallModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
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
                  type="submit"
                  disabled={submittingCall}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#059669',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {submittingCall ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox / Media Preview Modal */}
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
    </>
  );
}
