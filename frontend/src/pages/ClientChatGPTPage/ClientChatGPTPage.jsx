import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  Select,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileImageOutlined,
  GlobalOutlined,
  MenuOutlined,
  PaperClipOutlined,
  PictureOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";

import api from "../../services/api";

// Mocking APIs that don't exist in the current project structure yet
const useDeleteAiSessionMutation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const mutate = (sessionId) => {
    setIsLoading(true);
    const promise = (async () => {
      try {
        const response = await api.delete(`/ai-studio/chat/session/${sessionId}`);
        setIsLoading(false);
        return response.data;
      } catch (e) {
        setIsLoading(false);
        const errorObj = { data: e.response?.data || { message: e.message } };
        throw errorObj;
      }
    })();
    promise.unwrap = () => promise;
    return promise;
  };
  return [mutate, { isLoading }];
};

const useGetAiHistoryQuery = () => {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const refetch = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/ai-studio/chat/history');
      setData(response.data?.data || []);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e);
    }
    setIsLoading(false);
  };
  useEffect(() => { refetch(); }, []);
  return { data, isLoading, error, refetch };
};

const useGetAiSettingsQuery = () => {
  const [data, setData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const refetch = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/ai-studio/settings');
      setData(response.data?.data || {});
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };
  useEffect(() => { refetch(); }, []);
  return { data, isLoading, refetch };
};

const useLazyGetAiSessionQuery = () => {
  const [isFetching, setIsFetching] = useState(false);
  const trigger = (sessionId) => {
    setIsFetching(true);
    const promise = (async () => {
      try {
        const response = await api.get(`/ai-studio/chat/session/${sessionId}`);
        setIsFetching(false);
        return response.data;
      } catch (e) {
        setIsFetching(false);
        const errorObj = { data: e.response?.data || { message: e.message } };
        throw errorObj;
      }
    })();
    promise.unwrap = () => promise;
    return promise;
  };
  return [trigger, { isFetching }];
};

const useSendAiMessageMutation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const mutate = (payload) => {
    setIsLoading(true);
    const promise = (async () => {
      try {
        const response = await api.post('/ai-studio/chat/message', payload);
        setIsLoading(false);
        return response.data.data;
      } catch (e) {
        setIsLoading(false);
        const errorObj = { data: e.response?.data || { message: e.message } };
        throw errorObj;
      }
    })();
    promise.unwrap = () => promise;
    return promise;
  };
  return [mutate, { isLoading }];
};

const useUpdateAiSettingsMutation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const mutate = (payload) => {
    setIsLoading(true);
    const promise = (async () => {
      try {
        const dataToSent = { ...payload };
        if (payload.apiKey !== undefined) dataToSent.openaiApiKey = payload.apiKey;
        const response = await api.post('/ai-studio/settings', dataToSent);
        setIsLoading(false);
        return response.data;
      } catch (e) {
        setIsLoading(false);
        const errorObj = { data: e.response?.data || { message: e.message } };
        throw errorObj;
      }
    })();
    promise.unwrap = () => promise;
    return promise;
  };
  return [mutate, { isLoading }];
};

const useUploadAiFileMutation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const mutate = (file) => {
    setIsLoading(true);
    const promise = (async () => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        // Use standard axios if api wrapper doesn't support FormData well,
        // but typically it handles FormData correctly if Content-Type is multipart/form-data 
        // or let the browser set it automatically.
        const response = await api.post('/ai-studio/chat/upload', formData);
        
        setIsLoading(false);
        return response.data.data;
      } catch (e) {
        setIsLoading(false);
        const errorObj = { data: e.response?.data || { message: e.message } };
        throw errorObj;
      }
    })();
    promise.unwrap = () => promise;
    return promise;
  };
  return [mutate, { isLoading }];
};

const { TextArea } = Input;
const { Text, Title } = Typography;

const AI_MODEL_OPTIONS = [
  { value: "gpt-4o-mini", label: "gpt-4o-mini" },
  { value: "gpt-4o", label: "gpt-4o" },
];

const TOOL_PRESETS = [
  {
    key: "image",
    label: "Create an image",
    icon: <PictureOutlined />,
    prompt:
      "Create an image concept for our client campaign. Include style, layout, mood, and color direction.",
  },
  {
    key: "write",
    label: "Write or edit",
    icon: <EditOutlined />,
    prompt: "Write and polish a client-ready campaign update in a concise, professional tone.",
  },
  {
    key: "lookup",
    label: "Look something up",
    icon: <GlobalOutlined />,
    prompt: "Research this topic and summarize the most useful points for a client-facing decision.",
  },
];

const SIDEBAR_ACTIONS = [
  {
    key: "search",
    label: "Search chats",
    icon: <SearchOutlined />,
    helper: "Browse your saved conversations",
  },
  {
    key: "draft",
    label: "Write or edit",
    icon: <EditOutlined />,
    prompt: "Help me write or improve this content for my client.",
  },
  {
    key: "research",
    label: "Look something up",
    icon: <GlobalOutlined />,
    prompt: "Research this topic and give me a clear summary with practical next steps.",
  },
];

const pageStyles = `
  .cgpt-page-shell {
    --cgpt-bg: #1f1f1f;
    --cgpt-bg-elevated: #2a2a2a;
    --cgpt-bg-soft: #171717;
    --cgpt-line: rgba(255, 255, 255, 0.08);
    --cgpt-line-strong: rgba(255, 255, 255, 0.14);
    --cgpt-text: #f5f5f5;
    --cgpt-text-soft: #a3a3a3;
    --cgpt-pill: #2f2f2f;
    --cgpt-pill-hover: #3a3a3a;
    --cgpt-accent: #ffffff;
    --cgpt-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
    position: relative;
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    height: calc(100vh - 118px);
    height: calc(100dvh - 118px);
    background:
      radial-gradient(circle at top right, rgba(255, 255, 255, 0.05), transparent 18%),
      linear-gradient(180deg, #202020 0%, #171717 100%);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 28px;
    overflow: hidden;
    box-shadow: var(--cgpt-shadow);
  }

  .cgpt-page-shell,
  .cgpt-page-shell * {
    box-sizing: border-box;
  }

  .cgpt-page-shell ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .cgpt-page-shell ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.14);
    border-radius: 999px;
  }

  .cgpt-page-shell .ant-typography,
  .cgpt-page-shell .ant-btn {
    font-family: inherit;
  }

  .cgpt-sidebar {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: linear-gradient(180deg, #111111 0%, #151515 100%);
    border-right: 1px solid var(--cgpt-line);
  }

  .cgpt-menu-toggle.ant-btn {
    display: none;
    flex-shrink: 0;
    color: #f5f5f5;
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .cgpt-sidebar-backdrop {
    display: none;
  }

  .cgpt-sidebar-head {
    padding: 18px 16px 10px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .cgpt-sidebar-brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .cgpt-brand-mark {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: linear-gradient(135deg, #0b0b0d 0%, #2d2d2d 100%);
    border: 1px solid var(--cgpt-line-strong);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--cgpt-accent);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .cgpt-mobile-close-btn {
    display: none;
  }

  .cgpt-ghost-button.ant-btn {
    color: #d4d4d4;
    border-color: var(--cgpt-line);
    background: transparent;
  }

  .cgpt-ghost-button.ant-btn:hover,
  .cgpt-ghost-button.ant-btn:focus {
    color: #ffffff;
    border-color: var(--cgpt-line-strong);
    background: rgba(255, 255, 255, 0.04);
  }

  .cgpt-new-chat.ant-btn {
    height: 44px;
    border-radius: 14px;
    justify-content: flex-start;
    background: #2f2f2f;
    border-color: rgba(255, 255, 255, 0.04);
    color: #ffffff;
    font-weight: 500;
    box-shadow: none;
  }

  .cgpt-new-chat.ant-btn:hover,
  .cgpt-new-chat.ant-btn:focus {
    background: #3a3a3a;
    border-color: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .cgpt-sidebar-search .ant-input-affix-wrapper {
    border-radius: 14px;
    border-color: rgba(255, 255, 255, 0.06);
    background: #171717;
    color: #f5f5f5;
    box-shadow: none;
  }

  .cgpt-sidebar-search .ant-input-affix-wrapper:hover,
  .cgpt-sidebar-search .ant-input-affix-wrapper:focus,
  .cgpt-sidebar-search .ant-input-affix-wrapper-focused {
    border-color: rgba(255, 255, 255, 0.16);
  }

  .cgpt-sidebar-search input {
    background: transparent;
    color: #f5f5f5;
  }

  .cgpt-sidebar-search input::placeholder {
    color: #7d7d7d;
  }

  .cgpt-sidebar-search .ant-input-prefix {
    color: #9b9b9b;
  }

  .cgpt-sidebar-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 10px 10px 16px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .cgpt-sidebar-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cgpt-section-label {
    padding: 0 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #7d7d7d;
  }

  .cgpt-sidebar-link {
    width: 100%;
    border: 0;
    outline: 0;
    cursor: pointer;
    border-radius: 14px;
    background: transparent;
    color: #d6d6d6;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    text-align: left;
    transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
  }

  .cgpt-sidebar-link:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
    transform: translateX(1px);
  }

  .cgpt-sidebar-link-icon {
    width: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #bdbdbd;
  }

  .cgpt-sidebar-link-text {
    min-width: 0;
    flex: 1;
  }

  .cgpt-sidebar-link-title {
    display: block;
    color: inherit;
    font-size: 14px;
    line-height: 1.35;
  }

  .cgpt-sidebar-link-subtitle {
    display: block;
    margin-top: 2px;
    color: #8f8f8f;
    font-size: 12px;
    line-height: 1.3;
  }

  .cgpt-history-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cgpt-history-item {
    width: 100%;
    border: 0;
    outline: 0;
    cursor: pointer;
    border-radius: 14px;
    background: transparent;
    color: #dedede;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 11px 12px;
    text-align: left;
    transition: background 0.18s ease, color 0.18s ease;
  }

  .cgpt-history-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .cgpt-history-item.active {
    background: rgba(255, 255, 255, 0.08);
    color: #ffffff;
  }

  .cgpt-history-copy {
    min-width: 0;
    flex: 1;
  }

  .cgpt-history-title {
    display: block;
    color: inherit;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
    line-height: 1.35;
  }

  .cgpt-history-meta {
    display: block;
    margin-top: 4px;
    color: #8d8d8d;
    font-size: 11px;
    line-height: 1.2;
  }

  .cgpt-delete-button.ant-btn {
    color: #8f8f8f;
    opacity: 0;
    transition: opacity 0.18s ease, color 0.18s ease, background 0.18s ease;
  }

  .cgpt-history-item:hover .cgpt-delete-button.ant-btn,
  .cgpt-history-item.active .cgpt-delete-button.ant-btn {
    opacity: 1;
  }

  .cgpt-delete-button.ant-btn:hover,
  .cgpt-delete-button.ant-btn:focus {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .cgpt-sidebar-empty {
    padding: 26px 12px 14px;
    border-radius: 18px;
    border: 1px dashed rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .cgpt-sidebar-foot {
    margin-top: auto;
    padding: 14px 12px 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cgpt-foot-card {
    border-radius: 16px;
    padding: 12px 12px 10px;
    background: linear-gradient(180deg, #1a1a1a 0%, #121212 100%);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cgpt-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background:
      radial-gradient(circle at top center, rgba(255, 255, 255, 0.04), transparent 20%),
      linear-gradient(180deg, #212121 0%, #1d1d1d 100%);
  }

  .cgpt-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 22px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cgpt-topbar-left,
  .cgpt-topbar-right {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .cgpt-topbar-copy {
    min-width: 0;
  }

  .cgpt-eyebrow {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8f8f8f;
    margin-bottom: 4px;
  }

  .cgpt-topbar-title {
    display: block;
    color: #ffffff;
    font-size: 24px;
    font-weight: 600;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cgpt-topbar-subtitle {
    display: block;
    margin-top: 4px;
    color: #9e9e9e;
    font-size: 13px;
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cgpt-settings-button.ant-btn {
    height: 38px;
    border-radius: 999px;
    color: #f5f5f5;
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
  }

  .cgpt-settings-button.ant-btn:hover,
  .cgpt-settings-button.ant-btn:focus {
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.06);
  }

  .cgpt-key-tag.ant-tag {
    margin: 0;
    border-radius: 999px;
    border-color: rgba(108, 167, 255, 0.24);
    background: rgba(31, 90, 191, 0.18);
    color: #b9d4ff;
  }

  .cgpt-main-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .cgpt-banner-stack {
    padding: 16px 24px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cgpt-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
  }

  .cgpt-empty-stage {
    flex: 1;
    min-height: 0;
    padding: 28px 24px 34px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 26px;
    text-align: center;
  }

  .cgpt-empty-copy {
    max-width: 680px;
  }

  .cgpt-empty-copy h1 {
    margin: 0;
    color: #ffffff;
    font-size: clamp(34px, 4vw, 48px);
    line-height: 1.08;
    font-weight: 600;
    letter-spacing: -0.03em;
  }

  .cgpt-empty-copy p {
    margin: 14px 0 0;
    color: #9f9f9f;
    font-size: 15px;
    line-height: 1.6;
  }

  .cgpt-thread-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .cgpt-thread {
    width: min(920px, calc(100% - 32px));
    margin: 0 auto;
    padding: 28px 0 18px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .cgpt-message-row {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .cgpt-message-row.user {
    justify-content: flex-end;
  }

  .cgpt-message-row.user .cgpt-message-shell {
    align-items: flex-end;
  }

  .cgpt-message-shell {
    max-width: 100%;
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .cgpt-message-row.user .cgpt-message-shell {
    flex-direction: row-reverse;
  }

  .cgpt-avatar {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    color: #ffffff;
    background: #2e2e2e;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .cgpt-avatar.assistant {
    background: linear-gradient(135deg, #0f0f11 0%, #2e2e2e 100%);
  }

  .cgpt-avatar.user {
    background: linear-gradient(135deg, #383838 0%, #4a4a4a 100%);
  }

  .cgpt-bubble-wrap {
    max-width: min(780px, calc(100vw - 420px));
  }

  .cgpt-message-row.user .cgpt-bubble-wrap {
    max-width: min(720px, calc(100vw - 420px));
  }

  .cgpt-message-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .cgpt-message-name {
    color: #f5f5f5;
    font-size: 13px;
    font-weight: 600;
  }

  .cgpt-message-time {
    color: #7f7f7f;
    font-size: 11px;
    line-height: 1.2;
  }

  .cgpt-bubble {
    border-radius: 22px;
    padding: 16px 18px;
    color: #efefef;
    background: transparent;
  }

  .cgpt-message-row.user .cgpt-bubble {
    background: #2f2f2f;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .cgpt-message-row.assistant .cgpt-bubble {
    padding-left: 0;
    padding-right: 0;
  }

  .cgpt-rendered-text {
    color: inherit;
    font-size: 15px;
    line-height: 1.72;
  }

  .cgpt-rendered-text .cgpt-line {
    margin: 0 0 10px;
  }

  .cgpt-rendered-text .cgpt-line:last-child {
    margin-bottom: 0;
  }

  .cgpt-rendered-text code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 8px;
    color: #f1f1f1;
    background: rgba(255, 255, 255, 0.08);
  }

  .cgpt-code-block {
    margin: 14px 0;
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #111111;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .cgpt-code-head {
    padding: 11px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: rgba(255, 255, 255, 0.05);
    color: #c9c9c9;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .cgpt-code-pre {
    margin: 0;
    padding: 14px 16px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    color: #f3f3f3;
    font-family: Consolas, "Courier New", monospace;
    font-size: 13px;
    line-height: 1.65;
  }

  .cgpt-attachment-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: #f5f5f5;
  }

  .cgpt-image-output {
    display: inline-block;
    width: min(100%, 460px);
    margin-top: 14px;
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .cgpt-image-output img {
    display: block;
    width: 100%;
    height: auto;
  }

  .cgpt-typing {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 0 2px;
  }

  .cgpt-typing span {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #d8d8d8;
    display: inline-block;
    animation: cgpt-bounce 1s infinite ease-in-out;
  }

  .cgpt-typing span:nth-child(2) {
    animation-delay: 0.15s;
  }

  .cgpt-typing span:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes cgpt-bounce {
    0%, 80%, 100% {
      transform: scale(0.82);
      opacity: 0.5;
    }

    40% {
      transform: scale(1.08);
      opacity: 1;
    }
  }

  .cgpt-dock {
    padding: 18px 24px 22px;
    background:
      linear-gradient(180deg, rgba(29, 29, 29, 0) 0%, rgba(29, 29, 29, 0.94) 24%, #1d1d1d 100%);
  }

  .cgpt-composer-lane {
    width: min(860px, 100%);
    margin: 0 auto;
  }

  .cgpt-composer-lane.centered {
    width: min(760px, calc(100% - 12px));
  }

  .cgpt-composer {
    border-radius: 28px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #2b2b2b;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    padding: 10px 12px 12px;
  }

  .cgpt-composer-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 0 4px 8px;
  }

  .cgpt-composer-tag.ant-tag {
    margin: 0;
    border-radius: 999px;
    padding: 6px 10px;
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.06);
    color: #f1f1f1;
  }

  .cgpt-composer-textarea {
    display: flex;
    align-items: stretch;
    gap: 10px;
  }

  .cgpt-composer .ant-input {
    padding: 8px 10px 6px;
    color: #f5f5f5;
    background: transparent;
    font-size: 15px;
    line-height: 1.6;
  }

  .cgpt-composer .ant-input::placeholder {
    color: #909090;
  }

  .cgpt-composer .ant-input:focus,
  .cgpt-composer .ant-input-focused {
    box-shadow: none;
  }

  .cgpt-composer-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 8px;
    flex-wrap: wrap;
  }

  .cgpt-composer-tools {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .cgpt-tool-button.ant-btn,
  .cgpt-send-button.ant-btn {
    height: 40px;
    border-radius: 999px;
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    color: #efefef;
    box-shadow: none;
  }

  .cgpt-tool-button.ant-btn:hover,
  .cgpt-tool-button.ant-btn:focus,
  .cgpt-send-button.ant-btn:hover,
  .cgpt-send-button.ant-btn:focus {
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.07);
  }

  .cgpt-send-button.ant-btn {
    background: #f3f3f3;
    color: #151515;
    border-color: #f3f3f3;
    font-weight: 600;
  }

  .cgpt-send-button.ant-btn:hover,
  .cgpt-send-button.ant-btn:focus {
    background: #ffffff;
    color: #111111;
    border-color: #ffffff;
  }

  .cgpt-send-button.ant-btn[disabled],
  .cgpt-send-button.ant-btn[disabled]:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #7f7f7f;
    border-color: rgba(255, 255, 255, 0.08);
  }

  .cgpt-tool-pills {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 16px;
  }

  .cgpt-tool-pill {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    color: #f1f1f1;
    border-radius: 999px;
    padding: 10px 16px;
    font-size: 14px;
    line-height: 1.2;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
  }

  .cgpt-tool-pill:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.14);
    transform: translateY(-1px);
  }

  .cgpt-tool-pill-icon {
    color: #cfcfcf;
  }

  .cgpt-page-shell.theme-light {
    background:
      radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 20%),
      linear-gradient(180deg, #ffffff 0%, #f6f8fc 100%);
    border-color: rgba(15, 23, 42, 0.08);
    box-shadow: 0 20px 48px rgba(15, 23, 42, 0.08);
  }

  .cgpt-page-shell.theme-light ::-webkit-scrollbar-thumb {
    background: rgba(15, 23, 42, 0.16);
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar {
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
    border-right-color: rgba(15, 23, 42, 0.08);
  }

  .cgpt-page-shell.theme-light .cgpt-brand-mark {
    background: linear-gradient(135deg, #ffffff 0%, #eef2f7 100%);
    border-color: rgba(15, 23, 42, 0.08);
    color: #111827;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .cgpt-page-shell.theme-light .cgpt-ghost-button.ant-btn {
    color: #334155;
    border-color: rgba(15, 23, 42, 0.08);
    background: rgba(255, 255, 255, 0.7);
  }

  .cgpt-page-shell.theme-light .cgpt-ghost-button.ant-btn:hover,
  .cgpt-page-shell.theme-light .cgpt-ghost-button.ant-btn:focus {
    color: #0f172a;
    border-color: rgba(15, 23, 42, 0.16);
    background: #ffffff;
  }

  .cgpt-page-shell.theme-light .cgpt-new-chat.ant-btn {
    background: #111827;
    border-color: #111827;
    color: #ffffff;
  }

  .cgpt-page-shell.theme-light .cgpt-new-chat.ant-btn:hover,
  .cgpt-page-shell.theme-light .cgpt-new-chat.ant-btn:focus {
    background: #1f2937;
    border-color: #1f2937;
    color: #ffffff;
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-search .ant-input-affix-wrapper {
    background: #ffffff;
    border-color: rgba(15, 23, 42, 0.1);
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-search .ant-input-affix-wrapper:hover,
  .cgpt-page-shell.theme-light .cgpt-sidebar-search .ant-input-affix-wrapper:focus,
  .cgpt-page-shell.theme-light .cgpt-sidebar-search .ant-input-affix-wrapper-focused {
    border-color: rgba(37, 99, 235, 0.26);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.08);
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-search input {
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-search input::placeholder {
    color: #94a3b8;
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-search .ant-input-prefix,
  .cgpt-page-shell.theme-light .cgpt-section-label,
  .cgpt-page-shell.theme-light .cgpt-eyebrow {
    color: #64748b;
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-link {
    color: #334155;
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-link:hover {
    background: rgba(148, 163, 184, 0.14);
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-link-icon {
    color: #475569;
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-link-subtitle,
  .cgpt-page-shell.theme-light .cgpt-history-meta {
    color: #64748b;
  }

  .cgpt-page-shell.theme-light .cgpt-history-item {
    color: #334155;
  }

  .cgpt-page-shell.theme-light .cgpt-history-item:hover {
    background: rgba(148, 163, 184, 0.14);
  }

  .cgpt-page-shell.theme-light .cgpt-history-item.active {
    background: rgba(37, 99, 235, 0.1);
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-delete-button.ant-btn {
    color: #64748b;
  }

  .cgpt-page-shell.theme-light .cgpt-delete-button.ant-btn:hover,
  .cgpt-page-shell.theme-light .cgpt-delete-button.ant-btn:focus {
    color: #0f172a;
    background: rgba(148, 163, 184, 0.14);
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-empty {
    border-color: rgba(15, 23, 42, 0.08);
    background: rgba(255, 255, 255, 0.76);
  }

  .cgpt-page-shell.theme-light .cgpt-sidebar-foot {
    border-top-color: rgba(15, 23, 42, 0.08);
  }

  .cgpt-page-shell.theme-light .cgpt-foot-card {
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border-color: rgba(15, 23, 42, 0.08);
  }

  .cgpt-page-shell.theme-light .cgpt-main {
    background:
      radial-gradient(circle at top center, rgba(37, 99, 235, 0.06), transparent 22%),
      linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  }

  .cgpt-page-shell.theme-light .cgpt-topbar {
    border-bottom-color: rgba(15, 23, 42, 0.08);
  }

  .cgpt-page-shell.theme-light .cgpt-topbar-title,
  .cgpt-page-shell.theme-light .cgpt-empty-copy h1,
  .cgpt-page-shell.theme-light .cgpt-message-name {
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-topbar-subtitle,
  .cgpt-page-shell.theme-light .cgpt-empty-copy p,
  .cgpt-page-shell.theme-light .cgpt-message-time {
    color: #64748b;
  }

  .cgpt-page-shell.theme-light .cgpt-settings-button.ant-btn {
    color: #0f172a;
    border-color: rgba(15, 23, 42, 0.1);
    background: rgba(255, 255, 255, 0.84);
  }

  .cgpt-page-shell.theme-light .cgpt-settings-button.ant-btn:hover,
  .cgpt-page-shell.theme-light .cgpt-settings-button.ant-btn:focus {
    color: #0f172a;
    border-color: rgba(15, 23, 42, 0.18);
    background: #ffffff;
  }

  .cgpt-page-shell.theme-light .cgpt-key-tag.ant-tag {
    border-color: rgba(37, 99, 235, 0.18);
    background: rgba(37, 99, 235, 0.1);
    color: var(--accent-primary);
  }

  .cgpt-page-shell.theme-light .cgpt-avatar {
    background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
    border-color: rgba(37, 99, 235, 0.12);
    color: var(--accent-primary);
  }

  .cgpt-page-shell.theme-light .cgpt-avatar.assistant {
    background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
    color: #ffffff;
  }

  .cgpt-page-shell.theme-light .cgpt-avatar.user {
    background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary) 100%);
    color: #ffffff;
  }

  .cgpt-page-shell.theme-light .cgpt-bubble {
    color: #1e293b;
  }

  .cgpt-page-shell.theme-light .cgpt-message-row.user .cgpt-bubble {
    background: #eff6ff;
    border-color: rgba(37, 99, 235, 0.14);
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-rendered-text code {
    color: #0f172a;
    background: rgba(15, 23, 42, 0.06);
  }

  .cgpt-page-shell.theme-light .cgpt-attachment-chip {
    background: #ffffff;
    border-color: rgba(15, 23, 42, 0.1);
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-image-output {
    border-color: rgba(15, 23, 42, 0.08);
  }

  .cgpt-page-shell.theme-light .cgpt-typing span {
    background: #64748b;
  }

  .cgpt-page-shell.theme-light .cgpt-dock {
    background:
      linear-gradient(180deg, rgba(248, 250, 252, 0) 0%, rgba(248, 250, 252, 0.96) 26%, #f8fafc 100%);
  }

  .cgpt-page-shell.theme-light .cgpt-composer {
    border-color: rgba(15, 23, 42, 0.1);
    background: #ffffff;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
  }

  .cgpt-page-shell.theme-light .cgpt-composer-tag.ant-tag {
    border-color: rgba(15, 23, 42, 0.08);
    background: rgba(148, 163, 184, 0.12);
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-composer .ant-input {
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-composer .ant-input::placeholder {
    color: #94a3b8;
  }

  .cgpt-page-shell.theme-light .cgpt-tool-button.ant-btn {
    border-color: rgba(15, 23, 42, 0.1);
    background: #f8fafc;
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-tool-button.ant-btn:hover,
  .cgpt-page-shell.theme-light .cgpt-tool-button.ant-btn:focus {
    border-color: rgba(15, 23, 42, 0.18);
    background: #eef2f7;
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-send-button.ant-btn {
    background: #111827;
    color: #ffffff;
    border-color: #111827;
  }

  .cgpt-page-shell.theme-light .cgpt-send-button.ant-btn:hover,
  .cgpt-page-shell.theme-light .cgpt-send-button.ant-btn:focus {
    background: #1f2937;
    color: #ffffff;
    border-color: #1f2937;
  }

  .cgpt-page-shell.theme-light .cgpt-send-button.ant-btn[disabled],
  .cgpt-page-shell.theme-light .cgpt-send-button.ant-btn[disabled]:hover {
    background: #e2e8f0;
    color: #94a3b8;
    border-color: #e2e8f0;
  }

  .cgpt-page-shell.theme-light .cgpt-tool-pill {
    border-color: rgba(15, 23, 42, 0.1);
    background: rgba(255, 255, 255, 0.9);
    color: #0f172a;
  }

  .cgpt-page-shell.theme-light .cgpt-tool-pill:hover {
    background: #f8fafc;
    border-color: rgba(15, 23, 42, 0.18);
  }

  .cgpt-page-shell.theme-light .cgpt-tool-pill-icon {
    color: #475569;
  }

  @media (max-width: 1200px) {
    .cgpt-page-shell {
      grid-template-columns: 250px minmax(0, 1fr);
    }
  }

  @media (max-width: 960px) {
    .cgpt-page-shell {
      grid-template-columns: 1fr;
      height: calc(100vh - 90px);
      height: calc(100dvh - 90px);
      min-height: 420px;
      border-radius: 20px;
    }

    /* Sidebar becomes an off-canvas drawer instead of stacking inline,
       so it no longer squeezes/overlaps the chat panel on small screens. */
    .cgpt-sidebar {
      position: absolute;
      z-index: 20;
      top: 0;
      left: 0;
      bottom: 0;
      width: min(320px, 84vw);
      max-height: none;
      transform: translateX(-100%);
      transition: transform 0.22s ease;
      box-shadow: 24px 0 48px rgba(0, 0, 0, 0.28);
    }

    .cgpt-sidebar.is-open {
      transform: translateX(0);
    }

    .cgpt-sidebar-backdrop {
      display: block;
      position: absolute;
      inset: 0;
      z-index: 15;
      background: rgba(0, 0, 0, 0.45);
    }

    .cgpt-menu-toggle.ant-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .cgpt-mobile-close-btn {
      display: inline-flex;
    }

    .cgpt-bubble-wrap,
    .cgpt-message-row.user .cgpt-bubble-wrap {
      max-width: 100%;
    }
  }

  @media (max-width: 640px) {
    .cgpt-page-shell {
      border-radius: 14px;
      height: calc(100vh - 64px);
      height: calc(100dvh - 64px);
    }

    .cgpt-topbar,
    .cgpt-banner-stack,
    .cgpt-empty-stage,
    .cgpt-dock {
      padding-left: 16px;
      padding-right: 16px;
    }

    .cgpt-topbar {
      gap: 10px;
    }

    .cgpt-topbar-left {
      flex: 1;
    }

    .cgpt-topbar-title {
      font-size: 19px;
    }

    .cgpt-topbar-right {
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
    }

    .cgpt-settings-button.ant-btn {
      padding-left: 12px;
      padding-right: 12px;
    }

    .cgpt-empty-copy h1 {
      font-size: clamp(24px, 8vw, 32px);
    }

    .cgpt-message-shell {
      gap: 10px;
    }

    .cgpt-avatar {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      font-size: 13px;
    }

    .cgpt-composer-toolbar {
      gap: 8px;
    }

    .cgpt-composer-tools {
      gap: 6px;
    }

    .cgpt-tool-button.ant-btn {
      padding-left: 10px;
      padding-right: 12px;
    }

    .cgpt-tool-button.ant-btn .anticon + span,
    .cgpt-send-button.ant-btn .anticon + span {
      display: inline;
    }

    .cgpt-tool-pills {
      gap: 8px;
    }

    .cgpt-tool-pill {
      padding: 8px 12px;
      font-size: 13px;
    }
  }

  @media (max-width: 460px) {
    .cgpt-topbar-title {
      font-size: 17px;
    }

    .cgpt-brand-mark {
      width: 30px;
      height: 30px;
    }

    /* Collapse Attach/New-chat buttons to icon-only pills so the toolbar
       fits on one row instead of wrapping into a stacked, full-width mess. */
    .cgpt-tool-button.ant-btn {
      padding: 0;
      width: 40px;
      height: 40px;
      border-radius: 999px;
    }

    .cgpt-tool-button.ant-btn .cgpt-btn-label {
      display: none;
    }

    .cgpt-send-button.ant-btn {
      padding: 0;
      width: 44px;
      height: 44px;
      border-radius: 999px;
    }

    .cgpt-send-button.ant-btn .cgpt-btn-label {
      display: none;
    }

    .cgpt-composer-toolbar {
      flex-wrap: nowrap;
    }

    .cgpt-tool-pills {
      flex-direction: column;
      align-items: stretch;
    }

    .cgpt-tool-pill {
      justify-content: flex-start;
    }
  }
`;

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const copyToClipboard = async (value) => {
  try {
    await navigator.clipboard.writeText(value);
    message.success("Copied");
  } catch (error) {
    message.error("Unable to copy content");
  }
};

const extractConversations = (payload) =>
  payload?.conversations ||
  payload?.data?.conversations ||
  payload?.data?.data?.conversations ||
  [];

const extractConversation = (payload) =>
  payload?.conversation ||
  payload?.data?.conversation ||
  payload?.data?.data?.conversation ||
  null;

const extractSettings = (payload) => {
  const data = payload?.data || payload || {};
  return {
    ...data,
    hasCustomKey: data.isConfigured || false,
    maskedApiKey: data.maskedKey || ""
  };
};

const formatTimestamp = (value) =>
  value ? dayjs(value).format("DD MMM, h:mm A") : "";

const formatSidebarTimestamp = (value) =>
  value ? dayjs(value).format("DD MMM") : "";

const renderInlineText = (text, keyPrefix) => {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  const parts = String(text || "").split(pattern);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
};

const renderTextBlock = (text, keyPrefix) => {
  const lines = String(text || "").split("\n");

  return (
    <div className="cgpt-rendered-text">
      {lines.map((line, index) => {
        const key = `${keyPrefix}-line-${index}`;
        const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
        const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
        const bulletMatch = line.match(/^[-*]\s+(.*)$/);
        const quoteMatch = line.match(/^>\s+(.*)$/);

        if (!line.trim()) {
          return <div key={key} style={{ height: 8 }} />;
        }

        if (headingMatch) {
          const headingLevel = Math.min(headingMatch[1].length + 2, 5);
          return (
            <Title
              key={key}
              level={headingLevel}
              style={{ margin: "0 0 10px", color: "inherit" }}
            >
              {renderInlineText(headingMatch[2], key)}
            </Title>
          );
        }

        if (orderedMatch) {
          return (
            <div
              key={key}
              className="cgpt-line"
              style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
            >
              <strong style={{ minWidth: 18 }}>{orderedMatch[1]}.</strong>
              <span>{renderInlineText(orderedMatch[2], key)}</span>
            </div>
          );
        }

        if (bulletMatch) {
          return (
            <div
              key={key}
              className="cgpt-line"
              style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
            >
              <span style={{ minWidth: 14 }}>-</span>
              <span>{renderInlineText(bulletMatch[1], key)}</span>
            </div>
          );
        }

        if (quoteMatch) {
          return (
            <div
              key={key}
              className="cgpt-line"
              style={{
                borderLeft: "3px solid rgba(255, 255, 255, 0.16)",
                paddingLeft: 12,
                opacity: 0.92,
              }}
            >
              {renderInlineText(quoteMatch[1], key)}
            </div>
          );
        }

        return (
          <div key={key} className="cgpt-line">
            {renderInlineText(line, key)}
          </div>
        );
      })}
    </div>
  );
};

const MarkdownMessage = ({ content }) => {
  const source = String(content || "").trim();

  if (!source) {
    return null;
  }

  const blocks = [];
  const pattern = /```([\w-]+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: "text",
        content: source.slice(lastIndex, match.index),
      });
    }

    blocks.push({
      type: "code",
      language: match[1] || "code",
      content: match[2].replace(/\n$/, ""),
    });

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < source.length) {
    blocks.push({
      type: "text",
      content: source.slice(lastIndex),
    });
  }

  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <div className="cgpt-code-block" key={`code-${index}`}>
              <div className="cgpt-code-head">
                <span>{block.language}</span>
                <Button
                  size="small"
                  type="text"
                  style={{ color: "#f3f3f3" }}
                  onClick={() => copyToClipboard(block.content)}
                >
                  Copy
                </Button>
              </div>
              <pre className="cgpt-code-pre">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        return (
          <div key={`text-${index}`}>{renderTextBlock(block.content, index)}</div>
        );
      })}
    </>
  );
};

const AttachmentChip = ({ attachment }) => {
  if (!attachment?.filename) return null;

  return (
    <a
      className="cgpt-attachment-chip"
      href={attachment.url || "#"}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!attachment.url) {
          event.preventDefault();
        }
      }}
    >
      <PaperClipOutlined />
      <span>{attachment.filename}</span>
    </a>
  );
};

const normalizeSessionSearch = (sessions, keyword) => {
  const search = keyword.trim();
  if (!search) return sessions;

  const pattern = new RegExp(escapeRegExp(search), "i");
  return sessions.filter((session) => pattern.test(session?.title || ""));
};

import { useActionPermissions } from "../../hooks/useActionPermissions";

const ClientChatGPTPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [settingsForm] = Form.useForm();
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const { canAdd, canDelete, canView, canEdit } = useActionPermissions('/chatgpt');

  const {
    data: historyPayload,
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: refetchHistory,
  } = useGetAiHistoryQuery();
  const {
    data: settingsPayload,
    isLoading: isLoadingSettings,
    error: settingsError,
    refetch: refetchSettings,
  } = useGetAiSettingsQuery();
  const [loadSession, { isFetching: isLoadingSession }] =
    useLazyGetAiSessionQuery();
  const [sendAiMessage, { isLoading: isSending }] = useSendAiMessageMutation();
  const [deleteAiSession, { isLoading: isDeletingSession }] =
    useDeleteAiSessionMutation();
  const [updateAiSettings, { isLoading: isSavingSettings }] =
    useUpdateAiSettingsMutation();
  const [uploadAiFile, { isLoading: isUploadingFile }] =
    useUploadAiFileMutation();

  const [activeSessionId, setActiveSessionId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState("New conversation");
  const [conversationMessages, setConversationMessages] = useState([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftAttachment, setDraftAttachment] = useState(null);
  const [historySearch, setHistorySearch] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [shouldClearCustomKey, setShouldClearCustomKey] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const history = useMemo(
    () => extractConversations(historyPayload),
    [historyPayload],
  );
  const aiSettings = useMemo(
    () => extractSettings(settingsPayload),
    [settingsPayload],
  );
  const filteredHistory = useMemo(
    () => normalizeSessionSearch(history, historySearch),
    [history, historySearch],
  );

  useEffect(() => {
    settingsForm.setFieldsValue({
      isEnabled: aiSettings.isEnabled ?? true,
      model: ['gpt-4o-mini', 'gpt-4o'].includes(aiSettings.model) ? aiSettings.model : 'gpt-4o-mini',
      apiKey: "",
    });
  }, [aiSettings, settingsForm]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversationMessages, isSending]);

  const activeHistoryEntry = useMemo(
    () => history.find((session) => session._id === activeSessionId) || null,
    [activeSessionId, history],
  );

  const hasBackendIssue = Boolean(historyError || settingsError);
  const isConversationEmpty = conversationMessages.length === 0;
  const isAiDisabled = aiSettings.isEnabled === false;
  const isMainPanelLoading = isLoadingSession || isLoadingSettings;

  const handleStartNewChat = () => {
    setActiveSessionId(null);
    setConversationTitle("New conversation");
    setConversationMessages([]);
    setDraftAttachment(null);
    setIsMobileSidebarOpen(false);
  };

  const handlePresetClick = (prompt) => {
    handleStartNewChat();
    setDraftMessage(prompt);
  };

  const handleSessionOpen = async (sessionId) => {
    try {
      const payload = await loadSession(sessionId).unwrap();
      const conversation = extractConversation(payload);

      if (!conversation) {
        throw new Error("Conversation details were not returned.");
      }

      setActiveSessionId(conversation._id);
      setConversationTitle(conversation.title || "Conversation");
      setConversationMessages(conversation.messages || []);
      setIsMobileSidebarOpen(false);
    } catch (error) {
      message.error(
        error?.data?.message || error?.message || "Failed to load conversation",
      );
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await deleteAiSession(sessionId).unwrap();
      message.success("Conversation removed");
      refetchHistory();

      if (sessionId === activeSessionId) {
        handleStartNewChat();
      }
    } catch (error) {
      message.error(error?.data?.message || "Failed to delete conversation");
    }
  };

  const handleFilePick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      const result = await uploadAiFile(file).unwrap();
      setDraftAttachment(result);
      message.success("Attachment ready");
    } catch (error) {
      message.error(error?.data?.message || "Failed to upload file");
    }
  };

  const handleSendMessage = async () => {
    const trimmedMessage = draftMessage.trim();
    if (!trimmedMessage && !draftAttachment) return;

    const createdAt = new Date().toISOString();
    const tempUserMessageId = `temp-user-${Date.now()}`;
    const tempAssistantMessageId = `temp-assistant-${Date.now()}`;
    const pendingAttachment = draftAttachment;

    setConversationMessages((current) => [
      ...current,
      {
        _id: tempUserMessageId,
        role: "user",
        content: trimmedMessage,
        attachment: pendingAttachment,
        timestamp: createdAt,
      },
      {
        _id: tempAssistantMessageId,
        role: "assistant",
        content: "",
        isTyping: true,
        timestamp: new Date(Date.now() + 1000).toISOString(),
      },
    ]);

    setDraftMessage("");
    setDraftAttachment(null);

    try {
      const response = await sendAiMessage({
        content: trimmedMessage,
        sessionId: activeSessionId || undefined,
        attachment: pendingAttachment || undefined,
      }).unwrap();

      setActiveSessionId(response.sessionId);
      setConversationTitle(response.title || "Conversation");
      setConversationMessages((current) => [
        ...current.filter(
          (entry) =>
            entry._id !== tempUserMessageId &&
            entry._id !== tempAssistantMessageId,
        ),
        response.userMessage,
        response.aiMessage,
      ]);
      refetchHistory();
    } catch (error) {
      const errorMessage =
        error?.data?.message || error?.message || "Failed to send message";

      setConversationMessages((current) =>
        current.map((entry) => {
          if (entry._id === tempAssistantMessageId) {
            return {
              ...entry,
              isTyping: false,
              content: errorMessage,
              isError: true,
            };
          }

          return entry;
        }),
      );
      message.error(errorMessage);
    }
  };

  const handleSaveSettings = async (values) => {
    try {
      const payload = {
        isEnabled: values.isEnabled,
        model: values.model,
      };

      const trimmedApiKey = values.apiKey?.trim();
      if (shouldClearCustomKey) {
        payload.apiKey = "";
      } else if (trimmedApiKey) {
        payload.apiKey = trimmedApiKey;
      }

      await updateAiSettings(payload).unwrap();
      message.success("AI settings updated");
      setShouldClearCustomKey(false);
      settingsForm.setFieldValue("apiKey", "");
      refetchSettings();
      setIsSettingsOpen(false);
    } catch (error) {
      message.error(error?.data?.message || "Failed to update AI settings");
    }
  };

  const renderComposer = (centered = false) => (
    <div className={`cgpt-composer-lane ${centered ? "centered" : ""}`}>
      <div className="cgpt-composer">
        {draftAttachment && (
          <div className="cgpt-composer-tags">
            <Tag
              closable
              onClose={() => setDraftAttachment(null)}
              icon={<FileImageOutlined />}
              className="cgpt-composer-tag"
            >
              {draftAttachment.filename}
            </Tag>
          </div>
        )}

        <div className="cgpt-composer-textarea">
          <TextArea
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            placeholder="Ask anything"
            autoSize={{ minRows: centered ? 1 : 2, maxRows: 8 }}
            variant="borderless"
            disabled={isAiDisabled}
            onPressEnter={(event) => {
              if (event.shiftKey) return;
              event.preventDefault();
              handleSendMessage();
            }}
          />
        </div>

        <div className="cgpt-composer-toolbar">
          <div className="cgpt-composer-tools">
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={handleFilePick}
            />
            <Tooltip title="Attach a file">
              <Button
                className="cgpt-tool-button"
                icon={<PaperClipOutlined />}
                onClick={() => fileInputRef.current?.click()}
                loading={isUploadingFile}
                disabled={isAiDisabled}
              >
                <span className="cgpt-btn-label">Attach</span>
              </Button>
            </Tooltip>
            {canAdd && (
              <Tooltip title="New chat">
                <Button
                  className="cgpt-tool-button"
                  icon={<PlusOutlined />}
                  onClick={handleStartNewChat}
                >
                  <span className="cgpt-btn-label">New chat</span>
                </Button>
              </Tooltip>
            )}
          </div>

          <Tooltip title="Send message">
            <Button
              className="cgpt-send-button"
              icon={<SendOutlined />}
              onClick={handleSendMessage}
              loading={isSending}
              disabled={
                isAiDisabled ||
                (!draftMessage.trim() && !draftAttachment) ||
                isUploadingFile
              }
            >
              <span className="cgpt-btn-label">Send</span>
            </Button>
          </Tooltip>
        </div>
      </div>

      {centered && (
        <div className="cgpt-tool-pills">
          {TOOL_PRESETS.map((tool) => (
            <button
              key={tool.key}
              type="button"
              className="cgpt-tool-pill"
              onClick={() => handlePresetClick(tool.prompt)}
            >
              <span className="cgpt-tool-pill-icon">{tool.icon}</span>
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{pageStyles}</style>

      <div className={`cgpt-page-shell ${isDark ? "theme-dark" : "theme-light"}`}>
        {isMobileSidebarOpen && (
          <div
            className="cgpt-sidebar-backdrop"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        <aside className={`cgpt-sidebar ${isMobileSidebarOpen ? "is-open" : ""}`}>
          <div className="cgpt-sidebar-head">
            <div className="cgpt-sidebar-brand">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="cgpt-brand-mark">
                  <RobotOutlined />
                </span>
                <div>
                  <Text
                    style={{
                      display: "block",
                      color: isDark ? "#ffffff" : "#0f172a",
                      fontWeight: 600,
                    }}
                  >
                    ChatGPT
                  </Text>
                  <Text
                    style={{
                      display: "block",
                      color: isDark ? "#8f8f8f" : "#64748b",
                      fontSize: 12,
                    }}
                  >
                    Client panel assistant
                  </Text>
                </div>
              </div>

              <Button
                className="cgpt-ghost-button cgpt-mobile-close-btn"
                shape="circle"
                icon={<ArrowLeftOutlined />}
                onClick={() => setIsMobileSidebarOpen(false)}
              />
            </div>

            {canAdd && (
              <Button
                className="cgpt-new-chat"
                icon={<PlusOutlined />}
                block
                onClick={handleStartNewChat}
              >
                New chat
              </Button>
            )}

            <Input
              className="cgpt-sidebar-search"
              prefix={<SearchOutlined />}
              placeholder="Search chats"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
            />
          </div>

          <div className="cgpt-sidebar-scroll">
            <div className="cgpt-sidebar-section">
              <div className="cgpt-section-label">Workspace</div>
              {SIDEBAR_ACTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="cgpt-sidebar-link"
                  onClick={() => {
                    if (item.prompt) {
                      handlePresetClick(item.prompt);
                    }
                  }}
                >
                  <span className="cgpt-sidebar-link-icon">{item.icon}</span>
                  <span className="cgpt-sidebar-link-text">
                    <span className="cgpt-sidebar-link-title">{item.label}</span>
                    <span className="cgpt-sidebar-link-subtitle">
                      {item.helper || "Start with a ready-made AI task"}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="cgpt-sidebar-section">
              <div className="cgpt-section-label">
                Recent
                {!isLoadingHistory && history.length > 0 ? ` (${history.length})` : ""}
              </div>

              {isLoadingHistory ? (
                <div className="cgpt-sidebar-empty" style={{ textAlign: "center" }}>
                  <Spin />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="cgpt-sidebar-empty">
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span style={{ color: isDark ? "#8f8f8f" : "#64748b" }}>
                        No conversations yet
                      </span>
                    }
                  />
                </div>
              ) : (
                <div className="cgpt-history-list">
                  {filteredHistory.map((session) => (
                    <div
                      key={session._id}
                      role="button"
                      tabIndex={0}
                      className={`cgpt-history-item ${
                        session._id === activeSessionId ? "active" : ""
                      }`}
                      onClick={() => handleSessionOpen(session._id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleSessionOpen(session._id);
                        }
                      }}
                    >
                      <span className="cgpt-history-copy">
                        <span className="cgpt-history-title">
                          {session.title || "Untitled conversation"}
                        </span>
                        <span className="cgpt-history-meta">
                          {formatSidebarTimestamp(session.updatedAt)}
                        </span>
                      </span>

                      <Tooltip title="Delete conversation">
                        <Button
                          type="text"
                          shape="circle"
                          size="small"
                          className="cgpt-delete-button"
                          icon={<DeleteOutlined />}
                          loading={
                            isDeletingSession && session._id === activeSessionId
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteSession(session._id);
                          }}
                        />
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="cgpt-sidebar-foot">
            <div className="cgpt-foot-card">
              <Text
                style={{
                  display: "block",
                  color: isDark ? "#ffffff" : "#0f172a",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {user?.companyId?.name || "Client workspace"}
              </Text>
              <Text
                style={{
                  color: isDark ? "#8f8f8f" : "#64748b",
                  fontSize: 12,
                }}
              >
                Session history, uploads, and your saved OpenAI settings all stay inside
                this client workspace.
              </Text>
            </div>
          </div>
        </aside>

        <section className="cgpt-main">
          <div className="cgpt-topbar">
            <div className="cgpt-topbar-left">
              <Button
                className="cgpt-menu-toggle"
                shape="circle"
                icon={<MenuOutlined />}
                onClick={() => setIsMobileSidebarOpen(true)}
              />
              <div className="cgpt-topbar-copy">
                <span className="cgpt-eyebrow">Model</span>
                <span className="cgpt-topbar-title">ChatGPT</span>
                <span className="cgpt-topbar-subtitle">
                  {activeHistoryEntry
                    ? conversationTitle
                    : "Ready for client-side summaries, drafts, research, and image prompts."}
                </span>
              </div>
            </div>

            <div className="cgpt-topbar-right">
              {aiSettings ? (
                <Tag className="cgpt-key-tag">
                  {['gpt-4o-mini', 'gpt-4o'].includes(aiSettings.model) ? aiSettings.model : 'gpt-4o-mini'}
                </Tag>
              ) : null}
              {aiSettings.hasCustomKey ? (
                <Tag className="cgpt-key-tag">Custom API key</Tag>
              ) : null}
              <Button
                className="cgpt-settings-button"
                icon={<SettingOutlined />}
                onClick={() => setIsSettingsOpen(true)}
              >
                Settings
              </Button>
            </div>
          </div>

          <div className="cgpt-main-body">
            <div className="cgpt-banner-stack">
              {isAiDisabled && (
                <Alert
                  type="warning"
                  showIcon
                  message="AI replies are currently turned off"
                  description="Enable the assistant from Settings to send new messages. Your history will remain available."
                />
              )}

              {hasBackendIssue && (
                <Alert
                  type="info"
                  showIcon
                  message="ChatGPT backend is not responding yet"
                  description="The panel is live, but the /api/ai endpoints still need to respond for history, chat, and settings to work."
                />
              )}
            </div>

            {isMainPanelLoading ? (
              <div className="cgpt-loading">
                <Spin size="large" />
              </div>
            ) : isConversationEmpty ? (
              <div className="cgpt-empty-stage">
                <div className="cgpt-empty-copy">
                  <Text className="cgpt-eyebrow" style={{ marginBottom: 10 }}>
                    Client AI workspace
                  </Text>
                  <h1>Ready when you are.</h1>
                  <p>
                    Ask anything about tasks, campaigns, follow-ups, proposals, or
                    content. Use the tool shortcuts below to start faster.
                  </p>
                </div>
                {renderComposer(true)}
              </div>
            ) : (
              <>
                <div className="cgpt-thread-scroll">
                  <div className="cgpt-thread">
                    {conversationMessages.map((entry) => {
                      const isUserMessage = entry.role === "user";

                      return (
                        <div
                          key={entry._id}
                          className={`cgpt-message-row ${
                            isUserMessage ? "user" : "assistant"
                          }`}
                        >
                          <div className="cgpt-message-shell">
                            <div
                              className={`cgpt-avatar ${
                                isUserMessage ? "user" : "assistant"
                              }`}
                            >
                              {isUserMessage ? <UserOutlined /> : <RobotOutlined />}
                            </div>

                            <div className="cgpt-bubble-wrap">
                              <div className="cgpt-message-head">
                                <span className="cgpt-message-name">
                                  {isUserMessage ? "You" : "ChatGPT"}
                                </span>
                                <span className="cgpt-message-time">
                                  {formatTimestamp(entry.timestamp)}
                                </span>
                              </div>

                              <div className="cgpt-bubble">
                                {entry.isTyping ? (
                                  <div className="cgpt-typing" aria-label="Assistant typing">
                                    <span />
                                    <span />
                                    <span />
                                  </div>
                                ) : (
                                  <>
                                    {String(entry.content || "").trim() ? (
                                      <MarkdownMessage content={entry.content} />
                                    ) : entry.attachment ? (
                                      <Text
                                        style={{
                                          color: isDark ? "#a7a7a7" : "#64748b",
                                        }}
                                      >
                                        Shared an attachment.
                                      </Text>
                                    ) : null}
                                    <AttachmentChip attachment={entry.attachment} />
                                    {entry.imageUrl && (
                                      <div className="cgpt-image-output">
                                        <Image
                                          src={entry.imageUrl}
                                          alt="Generated response"
                                          style={{ borderRadius: "8px" }}
                                        />
                                        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                                          <Button
                                            icon={<DownloadOutlined />}
                                            size="small"
                                            onClick={() => {
                                              const a = document.createElement("a");
                                              a.href = entry.imageUrl;
                                              a.download = `generated-image-${Date.now()}.png`;
                                              a.click();
                                            }}
                                          >
                                            Download
                                          </Button>
                                          <Button
                                            icon={<CopyOutlined />}
                                            size="small"
                                            onClick={async () => {
                                              try {
                                                const response = await fetch(entry.imageUrl);
                                                const blob = await response.blob();
                                                await navigator.clipboard.write([
                                                  new ClipboardItem({
                                                    [blob.type]: blob
                                                  })
                                                ]);
                                                message.success("Image copied to clipboard!");
                                              } catch (err) {
                                                console.error("Copy failed:", err);
                                                message.error("Failed to copy image");
                                              }
                                            }}
                                          >
                                            Copy Image
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                </div>

                <div className="cgpt-dock">{renderComposer(false)}</div>
              </>
            )}
          </div>
        </section>
      </div>

      <Drawer
        title="Assistant Settings"
        width={420}
        open={isSettingsOpen}
        onClose={() => {
          setShouldClearCustomKey(false);
          settingsForm.setFieldsValue({
            isEnabled: aiSettings.isEnabled ?? true,
            model: ['gpt-4o-mini', 'gpt-4o'].includes(aiSettings.model) ? aiSettings.model : 'gpt-4o-mini',
            apiKey: "",
          });
          setIsSettingsOpen(false);
        }}
        destroyOnClose={false}
      >
        <Form
          form={settingsForm}
          layout="vertical"
          onFinish={handleSaveSettings}
          initialValues={{
            isEnabled: true,
            model: "gpt-4o-mini",
            apiKey: "",
          }}
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 18 }}
            message="Save your organization's OpenAI API key to enable AI features for this workspace."
          />

          <Form.Item
            name="isEnabled"
            label="Assistant status"
            valuePropName="checked"
          >
            <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
          </Form.Item>

          <Form.Item
            name="model"
            label="OpenAI model"
            rules={[{ required: true, message: "Please choose a model" }]}
          >
            <Select options={AI_MODEL_OPTIONS} />
          </Form.Item>

          <div
            style={{
              border: "1px solid rgba(15, 23, 42, 0.08)",
              borderRadius: 18,
              padding: 16,
              marginBottom: 18,
              background: isDark ? "rgba(15, 23, 42, 0.55)" : "#f8fafc",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text strong>Custom API key</Text>
              {aiSettings.hasCustomKey ? (
                <Tag color="blue" style={{ margin: 0 }}>
                  Saved
                </Tag>
              ) : (
                <Tag style={{ margin: 0 }}>Using server default</Tag>
              )}
            </div>

            <Text type="secondary">
              Paste a new key to replace the saved one. Leave it blank to keep the
              current behavior.
            </Text>

            <Form.Item
              name="apiKey"
              style={{ marginTop: 14, marginBottom: 10 }}
              rules={[
                {
                  validator: (_, value) => {
                    if (!value || value.trim().length === 0) {
                      return Promise.resolve();
                    }

                    if (value.trim().length < 20) {
                      return Promise.reject(
                        new Error("API key looks too short. Please check it."),
                      );
                    }

                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input.Password
                placeholder={aiSettings.hasCustomKey && aiSettings.maskedApiKey ? aiSettings.maskedApiKey : "Paste a custom OpenAI API key"}
                autoComplete="new-password"
              />
            </Form.Item>

            {aiSettings.hasCustomKey && (
              <Button
                type={shouldClearCustomKey ? "primary" : "default"}
                danger={shouldClearCustomKey}
                onClick={() => setShouldClearCustomKey((current) => !current)}
              >
                {shouldClearCustomKey ? "Will remove saved key" : "Remove saved key"}
              </Button>
            )}
          </div>

          <Button type="primary" htmlType="submit" block loading={isSavingSettings}>
            Save settings
          </Button>
        </Form>
      </Drawer>
    </>
  );
};

export default ClientChatGPTPage;