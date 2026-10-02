import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Input, Select, Button, Spin, Tooltip, Modal, message, Popconfirm, Alert, Dropdown
} from 'antd';
import {
  PlusOutlined, SearchOutlined, SendOutlined, PaperClipOutlined,
  SettingOutlined, DeleteOutlined, CopyOutlined, CheckOutlined,
  ReloadOutlined, CloseOutlined, LockOutlined, AudioOutlined,
  DownOutlined, MenuFoldOutlined, MenuUnfoldOutlined, AppstoreOutlined
} from '@ant-design/icons';
import {
  Folder, Layers, Code2, Sliders, MessageSquare,
  Sparkles, FileText, Search, Edit3, Lightbulb, Compass, Zap, Mic, Headphones
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useClientContext } from '../../contexts/ClientContext';
import api from '../../services/api';
import './ClaudeChatPage.css';

const { TextArea } = Input;

const CLAUDE_MODELS = [
  { value: 'claude-3-5-sonnet-latest', label: 'Sonnet 3.5', subLabel: 'Medium', desc: 'Optimal speed and high intelligence' },
  { value: 'claude-sonnet-5', label: 'Sonnet 5', subLabel: 'High Speed', desc: 'Everyday tasks, high speed & cost-efficient' },
  { value: 'claude-3-7-sonnet', label: 'Sonnet 3.7', subLabel: 'Hybrid Reasoning', desc: 'Cutting-edge reasoning and coding' },
  { value: 'claude-3-5-haiku-20241022', label: 'Haiku 3.5', subLabel: 'Fast', desc: 'Fastest response speed' },
];

const ClaudeSunburst = ({ size = 28, color = '#D97757' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    {/* Authentic 8-ray Claude Asterisk Logo */}
    <path d="M12 2.5V21.5" stroke={color} strokeWidth="2.7" strokeLinecap="round" />
    <path d="M2.5 12H21.5" stroke={color} strokeWidth="2.7" strokeLinecap="round" />
    <path d="M5.28 5.28L18.72 18.72" stroke={color} strokeWidth="2.7" strokeLinecap="round" />
    <path d="M5.28 18.72L18.72 5.28" stroke={color} strokeWidth="2.7" strokeLinecap="round" />
  </svg>
);

const ClaudeChatPage = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const { selectedClient } = useClientContext() || {};

  // State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-latest');
  const [activeMode, setActiveMode] = useState('chat'); // 'chat' | 'cowork'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Settings State
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isAnthropicConfigured, setIsAnthropicConfigured] = useState(true);
  const [anthropicApiKeyInput, setAnthropicApiKeyInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');

  const chatBottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Greeting logic
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = 'Good afternoon';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour >= 18) timeGreeting = 'Good evening';

    const rawName = user?.name || user?.fullName || user?.username || 'Rajesh';
    const firstName = rawName.split(' ')[0];
    return `${timeGreeting}, ${firstName}`;
  }, [user]);

  // Fetch Settings Status
  const fetchSettings = async () => {
    try {
      const res = await api.get('/ai-studio/settings?module=claude');
      if (res.data?.success) {
        const { isAnthropicConfigured, maskedAnthropicKey, model } = res.data.data;
        setIsAnthropicConfigured(!!isAnthropicConfigured);
        setMaskedKey(maskedAnthropicKey || '');
        if (model) setSelectedModel(model);
      }
    } catch (err) {
      console.error('Failed to fetch AI settings status:', err);
    }
  };

  // Fetch Conversation History
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get('/ai-studio/chat/history?provider=anthropic');
      if (res.data?.success) {
        setConversations(res.data.data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to fetch Claude chat history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchHistory();
    setActiveSessionId(null);
    setMessages([]);
  }, [selectedClient?._id]);

  // Load Specific Conversation
  const loadConversation = async (sessionId) => {
    if (activeSessionId === sessionId) return;
    setActiveSessionId(sessionId);
    setLoadingSession(true);
    try {
      const res = await api.get(`/ai-studio/chat/session/${sessionId}`);
      if (res.data?.success) {
        setMessages(res.data.data.conversation?.messages || []);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to load conversation');
    } finally {
      setLoadingSession(false);
    }
  };

  // Create New Chat
  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInputText('');
    setAttachment(null);
    setStreamingText('');
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  // Delete Conversation
  const handleDeleteConversation = async (sessionId, e) => {
    e?.stopPropagation();
    try {
      const res = await api.delete(`/ai-studio/chat/session/${sessionId}`);
      if (res.data?.success) {
        message.success('Conversation deleted');
        if (activeSessionId === sessionId) {
          handleNewChat();
        }
        fetchHistory();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete conversation');
    }
  };

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  // File Upload Handler
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      message.error('File size cannot exceed 10MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const res = await api.post('/ai-studio/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        setAttachment(res.data.data);
        message.success(`Attached ${file.name}`);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'File upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send Message Handler
  const handleSendMessage = async (customPrompt) => {
    const textToSend = customPrompt || inputText.trim();
    if (!textToSend || isStreaming) return;

    if (!isAnthropicConfigured) {
      setSettingsModalOpen(true);
      message.warning('Please enter your Anthropic API Key first');
      return;
    }

    const tempUserMessageId = `temp-user-${Date.now()}`;
    const tempAssistantMessageId = `temp-assistant-${Date.now()}`;
    const pendingAttachment = attachment;

    const tempUserMsg = {
      _id: tempUserMessageId,
      role: 'user',
      content: textToSend,
      attachment: pendingAttachment,
      timestamp: new Date().toISOString()
    };

    const tempAssistantMsg = {
      _id: tempAssistantMessageId,
      role: 'assistant',
      content: '',
      isTyping: true,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg]);
    setInputText('');
    setAttachment(null);
    setIsStreaming(true);

    try {
      const res = await api.post('/ai-studio/chat/message', {
        sessionId: activeSessionId || undefined,
        content: textToSend,
        attachment: pendingAttachment || undefined,
        provider: 'anthropic',
        module: 'claude',
        model: selectedModel
      });

      if (res.data?.success) {
        const { sessionId, userMessage, aiMessage } = res.data.data;
        setActiveSessionId(sessionId);
        setMessages((prev) => [
          ...prev.filter(
            (entry) => entry._id !== tempUserMessageId && entry._id !== tempAssistantMessageId
          ),
          userMessage,
          aiMessage
        ]);
        fetchHistory();
      }
    } catch (err) {
      console.error('Claude Chat Error:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to generate response from Claude';
      message.error(errorMsg);

      setMessages((prev) =>
        prev.map((entry) => {
          if (entry._id === tempAssistantMessageId) {
            return {
              ...entry,
              isTyping: false,
              content: `⚠️ Error: ${errorMsg}`,
              isError: true
            };
          }
          return entry;
        })
      );

      const errLower = errorMsg.toLowerCase();
      if (errLower.includes('api key') || errLower.includes('not configured') || errLower.includes('404') || errLower.includes('model not found')) {
        setIsAnthropicConfigured(false);
        setSettingsModalOpen(true);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  // Keyboard shortcut (Enter to send, Shift+Enter newline)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Copy Message to Clipboard
  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    message.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Save Settings
  const handleSaveSettings = async () => {
    if (!anthropicApiKeyInput.trim()) {
      message.error('Please enter a valid Anthropic API key');
      return;
    }
    setSavingSettings(true);
    try {
      const res = await api.post('/ai-studio/settings', {
        module: 'claude',
        anthropicApiKey: anthropicApiKeyInput.trim(),
        aiProvider: 'anthropic',
        model: selectedModel || 'claude-3-5-sonnet-latest'
      });
      if (res.data?.success) {
        message.success('Anthropic API key saved successfully!');
        setSettingsModalOpen(false);
        setAnthropicApiKeyInput('');
        fetchSettings();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Filtered Conversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    return conversations.filter(c => c.title?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [conversations, searchQuery]);

  const currentModelObj = useMemo(() => {
    return CLAUDE_MODELS.find(m => m.value === selectedModel) || CLAUDE_MODELS[0];
  }, [selectedModel]);

  const modelMenuItems = CLAUDE_MODELS.map(m => ({
    key: m.value,
    label: (
      <div className="claude-model-dropdown-item">
        <div className="claude-model-dropdown-title">
          <span>{m.label}</span>
          <span className="claude-model-dropdown-tag">{m.subLabel}</span>
        </div>
        <div className="claude-model-dropdown-desc">{m.desc}</div>
      </div>
    ),
    onClick: () => setSelectedModel(m.value)
  }));

  const userNameDisplay = user?.name || user?.fullName || 'Rajesh';
  const userInitial = userNameDisplay.charAt(0).toUpperCase();

  return (
    <div className={`claude-app-container ${isDark ? 'claude-dark' : 'claude-light'} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* 1. CLAUDE AUTHENTIC SIDEBAR */}
      <aside className="claude-app-sidebar">
        {/* Sidebar Header with Toggle & Logo */}
        <div className="claude-sidebar-header">
          <div className="claude-sidebar-brand-group">
            <button
              className="claude-sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title="Toggle sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
            <span className="claude-wordmark">Claude</span>
          </div>
        </div>

        {/* + New Button */}
        <div className="claude-new-chat-wrapper">
          <button className="claude-new-btn" onClick={handleNewChat}>
            <PlusOutlined className="claude-new-plus-icon" />
            <span className="claude-new-text">New</span>
          </button>
        </div>

        {/* Chats and Tasks Header */}
        <div className="claude-section-header">
          <span className="claude-section-title">Chats and tasks</span>
          <button
            className="claude-section-action-btn"
            onClick={() => setSearchVisible(!searchVisible)}
            title="Search chats"
          >
            <SearchOutlined style={{ fontSize: 13 }} />
          </button>
        </div>

        {/* Search Bar (if opened) */}
        {searchVisible && (
          <div className="claude-sidebar-search">
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--claude-subtext)' }} />}
              placeholder="Filter chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="claude-filter-input"
              allowClear
              size="small"
              autoFocus
            />
          </div>
        )}

        {/* Chat History List */}
        <div className="claude-history-container">
          {loadingHistory ? (
            <div className="claude-history-spinner"><Spin size="small" /></div>
          ) : filteredConversations.length === 0 ? (
            <div className="claude-empty-history">No recent chats</div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv._id}
                className={`claude-chat-item ${activeSessionId === conv._id ? 'active' : ''}`}
                onClick={() => loadConversation(conv._id)}
              >
                <span className="claude-chat-bullet">○</span>
                <span className="claude-chat-title">{conv.title || 'Untitled Chat'}</span>
                <div className="claude-chat-item-actions">
                  <Popconfirm
                    title="Delete this chat?"
                    onConfirm={(e) => handleDeleteConversation(conv._id, e)}
                    okText="Delete"
                    cancelText="Cancel"
                  >
                    <button
                      className="claude-chat-del-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DeleteOutlined />
                    </button>
                  </Popconfirm>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom User Bar */}
        <div className="claude-sidebar-footer">
          <div className="claude-user-profile" onClick={() => setSettingsModalOpen(true)}>
            <div className="claude-user-avatar">{userInitial}</div>
            <div className="claude-user-meta">
              <span className="claude-user-name">{userNameDisplay} · Free</span>
            </div>
            <DownOutlined className="claude-user-chevron" />
          </div>
          <div className="claude-sidebar-footer-actions">
            <button className="claude-footer-icon-btn" onClick={() => setSettingsModalOpen(true)} title="Settings">
              <SettingOutlined />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CHAT & HERO WORKSPACE */}
      <main className="claude-app-main">
        {/* Top Navbar */}
        {sidebarCollapsed && (
          <header className="claude-main-header">
            <button
              className="claude-sidebar-expand-btn"
              onClick={() => setSidebarCollapsed(false)}
              title="Expand sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          </header>
        )}

        {/* API Key Missing Notice (Floating banner if not configured) */}
        {!isAnthropicConfigured && (
          <div className="claude-config-banner">
            <Alert
              message="Anthropic API Key Required"
              description="To chat with Claude, please configure your Anthropic API key."
              type="warning"
              showIcon
              action={
                <Button size="small" type="primary" onClick={() => setSettingsModalOpen(true)}>
                  Configure API Key
                </Button>
              }
            />
          </div>
        )}

        {/* Content View: Hero Empty State OR Chat Messages */}
        <div className="claude-content-scrollable">
          {messages.length === 0 && !isStreaming ? (
            <div className="claude-hero-container">
              {/* Star Logo + Greeting */}
              <div className="claude-hero-greeting-group">
                <ClaudeSunburst size={34} color="#D97757" />
                <h1 className="claude-hero-greeting-text">{greeting}</h1>
              </div>

              {/* Floating Center Claude Input Box */}
              <div className="claude-floating-composer-card">
                <TextArea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="How can I help you today?"
                  autoSize={{ minRows: 2, maxRows: 8 }}
                  className="claude-hero-textarea"
                  disabled={isStreaming}
                />

                {attachment && (
                  <div className="claude-attachment-chip">
                    <PaperClipOutlined />
                    <span>{attachment.name}</span>
                    <CloseOutlined className="claude-chip-remove" onClick={() => setAttachment(null)} />
                  </div>
                )}

                <div className="claude-floating-composer-bottom">
                  {/* Left Controls: Plus & Mode Pills */}
                  <div className="claude-composer-left">
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                    />
                    <button
                      className="claude-attach-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || isStreaming}
                      title="Attach file"
                    >
                      {isUploading ? <Spin size="small" /> : <PlusOutlined style={{ fontSize: 13 }} />}
                    </button>

                    <div className="claude-mode-pill-group">
                      <button
                        className={`claude-mode-pill ${activeMode === 'chat' ? 'active' : ''}`}
                        onClick={() => setActiveMode('chat')}
                      >
                        Chat
                      </button>
                      <button
                        className={`claude-mode-pill ${activeMode === 'cowork' ? 'active' : ''}`}
                        onClick={() => setActiveMode('cowork')}
                      >
                        Cowork
                      </button>
                    </div>
                  </div>

                  {/* Right Controls: Model Picker, Voice, Audio, Send */}
                  <div className="claude-composer-right">
                    <Dropdown menu={{ items: modelMenuItems }} trigger={['click']}>
                      <button className="claude-model-badge-btn">
                        <span>{currentModelObj.label} · {currentModelObj.subLabel}</span>
                        <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
                      </button>
                    </Dropdown>

                    <button
                      className="claude-tool-icon-btn"
                      title="Voice Input"
                      onClick={() => message.info('Voice dictation active in browser')}
                    >
                      <Mic size={15} />
                    </button>

                    <button
                      className="claude-tool-icon-btn"
                      title="Audio Mode"
                      onClick={() => message.info('Audio response active')}
                    >
                      <Headphones size={15} />
                    </button>

                    {/* Send Button */}
                    <button
                      className={`claude-hero-send-btn ${(inputText.trim() || attachment) && !isStreaming ? 'ready' : ''}`}
                      onClick={() => handleSendMessage()}
                      disabled={(!inputText.trim() && !attachment) || isStreaming}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="19" x2="12" y2="5" />
                        <polyline points="5 12 12 5 19 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Active Chat Messages Stream */
            <div className="claude-chat-thread">
              {loadingSession ? (
                <div className="claude-thread-loader"><Spin size="large" /></div>
              ) : (
                messages.map((msg, idx) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={msg._id || idx} className={`claude-message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
                      <div className="claude-message-container">
                        {!isUser && (
                          <div className="claude-assistant-avatar">
                            <ClaudeSunburst size={20} color="#D97757" />
                          </div>
                        )}

                        <div className="claude-message-body">
                          {isUser && (
                            <div className="claude-user-message-card">
                              <div className="claude-user-text">{msg.content}</div>
                              {msg.attachment && (
                                <div className="claude-user-attachment">
                                  <PaperClipOutlined />
                                  <span>{msg.attachment.name}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {!isUser && (
                            <div className="claude-assistant-content">
                              {msg.isTyping ? (
                                <div className="claude-thinking-indicator">
                                  <Spin size="small" />
                                  <span>Claude is thinking...</span>
                                </div>
                              ) : (
                                <div className="claude-markdown-render">
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                              )}

                              {!msg.isTyping && msg.content && (
                                <div className="claude-message-actions">
                                  <button
                                    className="claude-msg-action-btn"
                                    onClick={() => handleCopy(msg.content, idx)}
                                    title="Copy text"
                                  >
                                    {copiedIndex === idx ? <CheckOutlined /> : <CopyOutlined />}
                                    <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>
          )}
        </div>

        {/* 3. STICKY BOTTOM COMPOSER (WHEN IN CHAT) */}
        {messages.length > 0 && (
          <div className="claude-chat-bottom-wrapper">
            <div className="claude-floating-composer-card in-chat">
              <TextArea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply to Claude..."
                autoSize={{ minRows: 2, maxRows: 8 }}
                className="claude-hero-textarea"
                disabled={isStreaming}
              />

              {attachment && (
                <div className="claude-attachment-chip">
                  <PaperClipOutlined />
                  <span>{attachment.name}</span>
                  <CloseOutlined className="claude-chip-remove" onClick={() => setAttachment(null)} />
                </div>
              )}

              <div className="claude-floating-composer-bottom">
                <div className="claude-composer-left">
                  <button
                    className="claude-attach-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isStreaming}
                    title="Attach file"
                  >
                    {isUploading ? <Spin size="small" /> : <PlusOutlined style={{ fontSize: 13 }} />}
                  </button>

                  <div className="claude-mode-pill-group">
                    <button
                      className={`claude-mode-pill ${activeMode === 'chat' ? 'active' : ''}`}
                      onClick={() => setActiveMode('chat')}
                    >
                      Chat
                    </button>
                    <button
                      className={`claude-mode-pill ${activeMode === 'cowork' ? 'active' : ''}`}
                      onClick={() => setActiveMode('cowork')}
                    >
                      Cowork
                    </button>
                  </div>
                </div>

                <div className="claude-composer-right">
                  <Dropdown menu={{ items: modelMenuItems }} trigger={['click']}>
                    <button className="claude-model-badge-btn">
                      <span>{currentModelObj.label} · {currentModelObj.subLabel}</span>
                      <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
                    </button>
                  </Dropdown>

                  <button
                    className="claude-tool-icon-btn"
                    title="Voice Input"
                    onClick={() => message.info('Voice dictation active in browser')}
                  >
                    <Mic size={15} />
                  </button>

                  <button
                    className="claude-tool-icon-btn"
                    title="Audio Mode"
                    onClick={() => message.info('Audio response active')}
                  >
                    <Headphones size={15} />
                  </button>

                  <button
                    className={`claude-hero-send-btn ${(inputText.trim() || attachment) && !isStreaming ? 'ready' : ''}`}
                    onClick={() => handleSendMessage()}
                    disabled={(!inputText.trim() && !attachment) || isStreaming}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* API KEY SETTINGS MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LockOutlined style={{ color: '#D97757' }} />
            <span>Anthropic API Key Settings</span>
          </div>
        }
        open={settingsModalOpen}
        onCancel={() => setSettingsModalOpen(false)}
        onOk={handleSaveSettings}
        confirmLoading={savingSettings}
        okText="Save Key"
      >
        <p style={{ color: 'var(--claude-subtext)', marginBottom: 12 }}>
          Enter your Anthropic API Key below. Your key will be securely encrypted and stored in your workspace settings.
        </p>

        {isAnthropicConfigured && (
          <div style={{ marginBottom: 14, fontSize: 13 }}>
            <span style={{ color: 'var(--claude-subtext)' }}>Configured API Key: </span>
            <code style={{ background: 'rgba(0,0,0,0.06)', padding: '3px 8px', borderRadius: 4, fontFamily: 'monospace' }}>{maskedKey}</code>
          </div>
        )}

        <Input.Password
          placeholder="sk-ant-api03-..."
          value={anthropicApiKeyInput}
          onChange={(e) => setAnthropicApiKeyInput(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default ClaudeChatPage;
