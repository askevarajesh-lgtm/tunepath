import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Input, Select, Button, Spin, Tooltip, Modal, message, Popconfirm, Alert
} from 'antd';
import {
  PlusOutlined, SearchOutlined, SendOutlined, PaperClipOutlined,
  SettingOutlined, DeleteOutlined, CopyOutlined, CheckOutlined,
  ReloadOutlined, CloseOutlined, LockOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { Sparkles, FileText, Search, Edit3, Lightbulb, Compass, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useClientContext } from '../../contexts/ClientContext';
import api from '../../services/api';
import './ClaudeChatPage.css';

const { TextArea } = Input;
const { Option } = Select;

const CLAUDE_MODELS = [
  { value: 'claude-sonnet-5', label: 'Sonnet 5', desc: 'Everyday tasks, high speed & cost-efficient' },
  { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet', desc: 'Optimal speed and high intelligence' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', desc: 'Fastest response speed' },
  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', desc: 'Lightweight & high availability' },
];

const PROMPT_SHORTCUTS = [
  {
    icon: <FileText size={20} />,
    title: 'Analyze a Document',
    desc: 'Extract key insights, summaries, or structured data',
    prompt: 'Please analyze the attached document or content and provide a structured summary with key takeaways.'
  },
  {
    icon: <Edit3 size={20} />,
    title: 'Write or Refine Content',
    desc: 'Draft client updates, proposals, or emails',
    prompt: 'Help me draft a clear, professional email update for our client regarding project progress.'
  },
  {
    icon: <Search size={20} />,
    title: 'Research & Insights',
    desc: 'Explore industry trends or complex questions',
    prompt: 'Summarize the top current digital marketing & AEO (Answer Engine Optimization) best practices for 2026.'
  },
  {
    icon: <Lightbulb size={20} />,
    title: 'Campaign Strategy',
    desc: 'Brainstorm creative concepts & ad ideas',
    prompt: 'Brainstorm 5 high-converting performance ad concepts for a luxury retail client.'
  },
  {
    icon: <Compass size={20} />,
    title: 'CRM & Lead Strategy',
    desc: 'Optimize lead follow-up & conversion flows',
    prompt: 'Create an automated lead nurturing workflow for inbound website leads.'
  },
  {
    icon: <Zap size={20} />,
    title: 'Code & Automation',
    desc: 'Write scripts, formulas, or API integrations',
    prompt: 'Write a JavaScript helper function to clean and validate customer contact numbers.'
  }
];

const ClaudeChatPage = () => {
  const { isDark } = useTheme();
  const { selectedClient } = useClientContext() || {};

  // State
  const [conversations, setConversations] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-5');
  const [searchQuery, setSearchQuery] = useState('');
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
        message.success(`Uploaded ${file.name}`);
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
        model: selectedModel || 'claude-sonnet-5'
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

  return (
    <div className={`claude-page-shell ${isDark ? 'dark-theme' : 'light-theme'}`}>
      {/* LEFT SIDEBAR */}
      <div className="claude-sidebar">
        <div className="claude-brand">
          <span className="claude-brand-icon">✶</span>
          <span>Claude</span>
        </div>

        <button className="claude-new-chat-btn" onClick={handleNewChat}>
          <PlusOutlined />
          <span>New chat</span>
        </button>

        <div className="claude-search-box">
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--claude-text-muted)' }} />}
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="claude-search-input"
            allowClear
          />
        </div>

        <div className="claude-history-section-title">Recent Chats</div>

        <div className="claude-history-list">
          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}><Spin size="small" /></div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--claude-text-muted)' }}>
              No chats found
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv._id}
                className={`claude-history-item ${activeSessionId === conv._id ? 'active' : ''}`}
                onClick={() => loadConversation(conv._id)}
              >
                <span className="claude-history-title">{conv.title || 'Untitled Chat'}</span>
                <div className="claude-history-actions">
                  <Popconfirm
                    title="Delete this chat?"
                    onConfirm={(e) => handleDeleteConversation(conv._id, e)}
                    okText="Delete"
                    cancelText="Cancel"
                  >
                    <DeleteOutlined
                      className="claude-action-icon"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="claude-main-area">
        {/* Header */}
        <div className="claude-header">
          <div className="claude-header-left">
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              className="claude-model-select"
              dropdownStyle={{ backgroundColor: 'var(--claude-card-bg)', borderColor: 'var(--claude-border)' }}
            >
              {CLAUDE_MODELS.map(m => (
                <Option key={m.value} value={m.value}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--claude-text)' }}>{m.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--claude-text-muted)' }}>{m.desc}</span>
                  </div>
                </Option>
              ))}
            </Select>
          </div>

          <div className="claude-header-right">
            <Button
              type="text"
              icon={<SettingOutlined style={{ color: 'var(--claude-text)' }} />}
              onClick={() => setSettingsModalOpen(true)}
              style={{ color: 'var(--claude-text)' }}
            >
              API Key Settings
            </Button>
          </div>
        </div>

        {/* API Key Missing Alert */}
        {!isAnthropicConfigured && (
          <div style={{ padding: '12px 24px 0 24px' }}>
            <Alert
              message="Anthropic API Key Required"
              description="To start chatting with Claude, please configure your Anthropic API key."
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

        {/* Messages or Empty State */}
        {messages.length === 0 && !isStreaming ? (
          <div className="claude-empty-container">
            <div className="claude-star-logo">✶</div>
            <div className="claude-empty-title">How can I help you today?</div>
            <div className="claude-prompts-grid">
              {PROMPT_SHORTCUTS.map((item, idx) => (
                <div
                  key={idx}
                  className="claude-prompt-card"
                  onClick={() => handleSendMessage(item.prompt)}
                >
                  <div className="claude-prompt-card-icon">{item.icon}</div>
                  <div className="claude-prompt-card-title">{item.title}</div>
                  <div className="claude-prompt-card-desc">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="claude-chat-container">
            {loadingSession ? (
              <div style={{ textAlign: 'center', padding: '40px' }}><Spin size="large" /></div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg._id || idx} className={`claude-msg-row ${isUser ? 'claude-msg-row-user' : 'claude-msg-row-ai'}`}>
                    <div className={`claude-avatar ${isUser ? 'claude-avatar-user' : 'claude-avatar-ai'}`}>
                      {isUser ? 'U' : '✶'}
                    </div>
                    <div className="claude-msg-content">
                      <div className={isUser ? 'claude-msg-user-bubble' : 'claude-msg-ai-bubble'}>
                        {msg.isTyping ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--claude-text-muted)', fontStyle: 'italic' }}>
                            <Spin size="small" />
                            <span>Claude is thinking...</span>
                          </div>
                        ) : (
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        )}
                      </div>

                      {msg.attachment && (
                        <div className="claude-attachment-tag">
                          <PaperClipOutlined />
                          <span>{msg.attachment.name}</span>
                        </div>
                      )}

                      {!isUser && !msg.isTyping && (
                        <button
                          className="claude-copy-btn"
                          onClick={() => handleCopy(msg.content, idx)}
                        >
                          {copiedIndex === idx ? <CheckOutlined /> : <CopyOutlined />}
                          <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div ref={chatBottomRef} />
          </div>
        )}

        {/* COMPOSER */}
        <div className="claude-composer-wrapper">
          {attachment && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--claude-card-bg)', border: '1px solid var(--claude-border)', borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
              <PaperClipOutlined />
              <span>{attachment.name}</span>
              <CloseOutlined style={{ cursor: 'pointer', marginLeft: 4 }} onClick={() => setAttachment(null)} />
            </div>
          )}

          <div className="claude-composer-card">
            <TextArea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply to Claude..."
              autoSize={{ minRows: 2, maxRows: 8 }}
              className="claude-textarea"
              disabled={isStreaming}
            />

            <div className="claude-composer-toolbar">
              <div className="claude-composer-tools-left">
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <button
                  className="claude-icon-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isStreaming}
                  title="Attach File"
                >
                  {isUploading ? <Spin size="small" /> : <PaperClipOutlined style={{ fontSize: 16 }} />}
                </button>
              </div>

              <button
                className="claude-send-btn"
                onClick={() => handleSendMessage()}
                disabled={(!inputText.trim() && !attachment) || isStreaming}
              >
                <SendOutlined style={{ fontSize: 14 }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* API KEY SETTINGS MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LockOutlined style={{ color: 'var(--claude-accent)' }} />
            <span>Anthropic API Key Settings</span>
          </div>
        }
        open={settingsModalOpen}
        onCancel={() => setSettingsModalOpen(false)}
        onOk={handleSaveSettings}
        confirmLoading={savingSettings}
        okText="Save Key"
      >
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
          Enter your Anthropic API Key below. Your key will be securely encrypted and stored in your workspace settings.
        </p>

        {isAnthropicConfigured && (
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Current Configured Key: </span>
            <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4 }}>{maskedKey}</code>
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
