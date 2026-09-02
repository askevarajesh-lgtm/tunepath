import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Input,
  Modal,
  Select,
  Segmented,
  Spin,
  Typography,
  message,
  Tag,
} from "antd";
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  BgColorsOutlined,
  CheckCircleFilled,
  CloudDownloadOutlined,
  DisconnectOutlined,
  ExportOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FolderOpenOutlined,
  HomeFilled,
  LinkOutlined,
  PictureOutlined,
  PlusOutlined,
  ProjectOutlined,
  ReadOutlined,
  ReloadOutlined,
  SearchOutlined,
  VideoCameraFilled,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useConnectCanvaMutation,
  useDisconnectCanvaMutation,
  useGetCanvaStatusQuery,
  useGetCanvaDesignsQuery
} from "../../api/integrationApi";

// Mocking APIs that don't exist in the current project structure yet
const useCreateCanvaDesignMutation = () => [
  () => ({
    unwrap: async () => ({ design: { canvaDesignId: 'mock-' + Date.now(), title: 'New Mock Design' } })
  }), 
  { isLoading: false }
];
const useExportCanvaDesignMutation = () => [
  () => ({
    unwrap: async () => ({ job: { status: 'completed' } })
  }), 
  { isLoading: false }
];

import { useTheme } from "../../contexts/ThemeContext";

const { Text, Title, Paragraph } = Typography;

const DESIGN_TYPE_OPTIONS = [
  {
    value: "presentation",
    label: "Presentation",
    icon: <ProjectOutlined />,
    color: "#ff7a18",
    detail: "Decks, pitches, and client proposals",
  },
  {
    value: "social_media",
    label: "Social media",
    icon: <BgColorsOutlined />,
    color: "#ff4d6d",
    detail: "Posts, reels covers, and promo creatives",
  },
  {
    value: "video",
    label: "Video",
    icon: <VideoCameraFilled />,
    color: "#c84fff",
    detail: "Motion-ready launch assets and stories",
  },
  {
    value: "doc",
    label: "Doc",
    icon: <ReadOutlined />,
    color: "#1aa7c9",
    detail: "Briefs, internal notes, and planning docs",
  },
  {
    value: "whiteboard",
    label: "Whiteboard",
    icon: <AppstoreOutlined />,
    color: "#2cbf6d",
    detail: "Moodboards, ideation maps, and workshops",
  },
  {
    value: "poster",
    label: "Poster",
    icon: <PictureOutlined />,
    color: "#2a91ff",
    detail: "Posters, flyers, and visual promo boards",
  },
  {
    value: "flyer",
    label: "Flyer",
    icon: <FileImageOutlined />,
    color: "#5764ff",
    detail: "Quick one-pagers for offers and events",
  },
  {
    value: "infographic",
    label: "Custom size",
    icon: <PlusOutlined />,
    color: "#f3f4f6",
    detail: "Long-form or custom-dimension design work",
  },
];

const EXPORT_FORMAT_OPTIONS = [
  { label: "PNG", value: "png" },
  { label: "JPG", value: "jpg" },
  { label: "PDF", value: "pdf" },
];

const WORKSPACE_NAV = [
  { key: "home", label: "Home", icon: <HomeFilled /> },
  { key: "designs", label: "My designs", icon: <FolderOpenOutlined /> },
  { key: "templates", label: "Templates", icon: <AppstoreOutlined /> },
  { key: "create", label: "Create", icon: <PlusOutlined /> },
  { key: "export", label: "Export", icon: <ExportOutlined /> },
  { key: "connection", label: "Connection", icon: <LinkOutlined /> },
];

const HOME_BANNERS = [
  {
    title: "Campaign launch pack",
    subtitle: "Ready-to-tune layouts for sales decks and proposals",
    colors: ["#ffb1b1", "#ff9b8b"],
  },
  {
    title: "For the Women Who Build & Create",
    subtitle: "High-energy post series and social edits",
    colors: ["#26c767", "#0b9f35"],
  },
  {
    title: "Designs that make learning feel easy",
    subtitle: "Explainers, presentations, and educational carousels",
    colors: ["#ffd56a", "#ffbe47"],
  },
  {
    title: "Explore summer launch visuals",
    subtitle: "Fresh templates for seasonal offers and travel promos",
    colors: ["#6fd2ff", "#1ea5e9"],
  },
];

const TEMPLATE_FILTERS = ["Business", "Video", "Social media", "Docs"];

const TEMPLATE_CARDS = [
  "Presentation",
  "Poster",
  "CV",
  "Email",
  "Logo",
  "Flyer",
  "Brochure",
  "Instagram Post",
  "Instagram Story",
  "Landscape Video",
  "Invitation",
  "Mobile Video",
];

const getApiErrorMessage = (error, fallback) =>
  error?.data?.error ||
  error?.data?.message ||
  error?.error ||
  fallback;

const formatDateTime = (value) =>
  value ? dayjs(value).format("DD MMM YYYY, hh:mm A") : "Not available";

const formatEditedText = (value) => {
  if (!value) return "Edited recently";
  const now = dayjs();
  const updatedAt = dayjs(value);
  const diffDays = now.diff(updatedAt, "day");
  const diffHours = now.diff(updatedAt, "hour");

  if (diffHours < 1) return "Edited just now";
  if (diffHours < 24) return `Edited ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 30) return `Edited ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  const diffMonths = now.diff(updatedAt, "month");
  if (diffMonths < 12) {
    return `Edited ${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  }

  const diffYears = now.diff(updatedAt, "year");
  return `Edited ${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
};

const openExternalUrl = (url) => {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
};

const pageStyles = `
  .canva-ui-shell {
    display: grid;
    grid-template-columns: 94px minmax(0, 1fr);
    min-height: calc(100vh - 128px);
    border-radius: 28px;
    overflow: hidden;
    background: #17161f;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 24px 64px rgba(8, 9, 14, 0.28);
  }

  :root[data-theme='dark'] .canva-ui-shell {
    background: #17161f;
  }

  :root[data-theme='light'] .canva-ui-shell {
    background:
      linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,244,255,0.98)),
      #f7f4ff;
    border-color: rgba(124, 58, 237, 0.12);
    box-shadow: 0 24px 64px rgba(69, 52, 128, 0.12);
  }

  .canva-left-rail {
    background:
      linear-gradient(180deg, rgba(38, 16, 64, 0.96), rgba(22, 17, 34, 0.98));
    padding: 18px 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
  }

  :root[data-theme='light'] .canva-left-rail {
    background:
      linear-gradient(180deg, rgba(46, 24, 77, 0.96), rgba(77, 44, 129, 0.94));
  }

  .canva-left-brand {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 20px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
  }

  .canva-create-button {
    width: 42px;
    height: 42px;
    border-radius: 16px;
    border: none;
    color: #fff;
    background: linear-gradient(135deg, #7c3aed, #c026d3);
    box-shadow: 0 12px 24px rgba(124, 58, 237, 0.34);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .canva-rail-nav {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .canva-rail-item {
    width: 100%;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.72);
    padding: 10px 6px;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
  }

  .canva-rail-item:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-1px);
  }

  .canva-rail-item.active {
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
  }

  .canva-rail-icon {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .canva-rail-item.active .canva-rail-icon {
    background: rgba(255, 255, 255, 0.16);
  }

  .canva-rail-label {
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    line-height: 1.25;
  }

  .canva-rail-footer {
    margin-top: auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
  }

  .canva-status-badge {
    width: 44px;
    height: 44px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    font-size: 18px;
  }

  .canva-main-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .canva-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  :root[data-theme='light'] .canva-topbar {
    border-bottom-color: rgba(124, 58, 237, 0.1);
  }

  .canva-topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .canva-topbar-title {
    color: #fff;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.03em;
    margin: 0;
  }

  :root[data-theme='light'] .canva-topbar-title {
    color: #1d1230;
  }

  .canva-topbar-note {
    color: rgba(255, 255, 255, 0.68);
    font-size: 13px;
  }

  :root[data-theme='light'] .canva-topbar-note {
    color: rgba(29, 18, 48, 0.68);
  }

  .canva-topbar-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .canva-pill-action {
    border-radius: 999px !important;
    height: 40px !important;
    padding-inline: 16px !important;
    border-color: rgba(139, 92, 246, 0.52) !important;
    background: rgba(43, 28, 73, 0.78) !important;
    color: #fff !important;
    box-shadow: 0 0 24px rgba(124, 58, 237, 0.16);
  }

  .canva-pill-action.ant-btn-primary {
    background: linear-gradient(135deg, #7c3aed, #4f46e5) !important;
    border-color: transparent !important;
  }

  :root[data-theme='light'] .canva-pill-action {
    background: rgba(255, 255, 255, 0.92) !important;
    color: #2d1e45 !important;
    border-color: rgba(124, 58, 237, 0.28) !important;
    box-shadow: 0 0 24px rgba(124, 58, 237, 0.1);
  }

  :root[data-theme='light'] .canva-pill-action.ant-btn-primary {
    color: #fff !important;
  }

  .canva-content-area {
    padding: 22px;
    overflow: auto;
  }

  .canva-hero-zone {
    position: relative;
    border-radius: 28px;
    padding: 28px 28px 30px;
    background:
      radial-gradient(circle at top left, rgba(6, 182, 212, 0.34), transparent 34%),
      radial-gradient(circle at top right, rgba(124, 58, 237, 0.34), transparent 38%),
      linear-gradient(180deg, #181b26 0%, #17161f 100%);
    border: 1px solid rgba(139, 92, 246, 0.16);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
    margin-bottom: 24px;
  }

  :root[data-theme='light'] .canva-hero-zone {
    background:
      radial-gradient(circle at top left, rgba(6, 182, 212, 0.22), transparent 34%),
      radial-gradient(circle at top right, rgba(124, 58, 237, 0.18), transparent 38%),
      linear-gradient(180deg, #ffffff 0%, #f7f4ff 100%);
    border-color: rgba(124, 58, 237, 0.12);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
  }

  .canva-hero-title {
    margin: 4px 0 10px;
    text-align: center;
    font-size: 56px;
    line-height: 1.04;
    letter-spacing: -0.05em;
    font-weight: 700;
    color: #fff;
  }

  :root[data-theme='light'] .canva-hero-title {
    color: #22153b;
  }

  .canva-hero-subtitle {
    margin: 0 auto 20px;
    text-align: center;
    max-width: 760px;
    color: rgba(255, 255, 255, 0.66);
    font-size: 15px;
  }

  :root[data-theme='light'] .canva-hero-subtitle {
    color: rgba(34, 21, 59, 0.64);
  }

  .canva-search-shell {
    max-width: 760px;
    margin: 0 auto;
    border-radius: 22px;
    padding: 12px 16px;
    border: 1px solid rgba(167, 139, 250, 0.72);
    background: rgba(22, 21, 31, 0.88);
    box-shadow: 0 0 22px rgba(124, 58, 237, 0.28);
  }

  :root[data-theme='light'] .canva-search-shell {
    background: rgba(255,255,255,0.94);
    box-shadow: 0 0 22px rgba(124, 58, 237, 0.12);
  }

  .canva-search-shell .ant-input-affix-wrapper {
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    color: #fff !important;
  }

  :root[data-theme='light'] .canva-search-shell .ant-input-affix-wrapper {
    color: #22153b !important;
  }

  .canva-search-shell .ant-input-prefix {
    color: rgba(255, 255, 255, 0.74);
    font-size: 18px;
    margin-right: 8px;
  }

  :root[data-theme='light'] .canva-search-shell .ant-input-prefix {
    color: rgba(34, 21, 59, 0.54);
  }

  .canva-search-shell input::placeholder {
    color: rgba(255, 255, 255, 0.46) !important;
  }

  :root[data-theme='light'] .canva-search-shell input::placeholder {
    color: rgba(34, 21, 59, 0.44) !important;
  }

  .canva-quick-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 18px;
    margin-top: 26px;
  }

  .canva-quick-action {
    width: 92px;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    color: #fff;
    text-align: center;
  }

  :root[data-theme='light'] .canva-quick-action {
    color: #22153b;
  }

  .canva-quick-icon {
    width: 52px;
    height: 52px;
    margin: 0 auto 10px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: #fff;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
    transition: transform 0.18s ease;
  }

  .canva-quick-action:hover .canva-quick-icon {
    transform: translateY(-2px);
  }

  .canva-quick-label {
    font-size: 13px;
    line-height: 1.35;
    font-weight: 600;
  }

  .canva-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-top: 18px;
  }

  .canva-filter-chip {
    border-radius: 999px;
    border: 1px solid rgba(139, 92, 246, 0.4);
    color: #fff;
    background: rgba(31, 24, 46, 0.72);
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
  }

  :root[data-theme='light'] .canva-filter-chip {
    color: #2a1f44;
    background: rgba(255,255,255,0.92);
    border-color: rgba(124, 58, 237, 0.18);
  }

  .canva-section {
    margin-bottom: 26px;
  }

  .canva-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .canva-section-title {
    margin: 0;
    color: #fff;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  :root[data-theme='light'] .canva-section-title {
    color: #22153b;
  }

  .canva-section-link {
    border: none;
    background: transparent;
    color: #a78bfa;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }

  .canva-banner-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .canva-banner-card {
    min-height: 156px;
    border-radius: 22px;
    overflow: hidden;
    padding: 18px;
    color: #fff;
    position: relative;
    box-shadow: 0 18px 32px rgba(10, 10, 16, 0.18);
  }

  .canva-banner-card::after {
    content: "";
    position: absolute;
    width: 120px;
    height: 120px;
    right: -18px;
    bottom: -26px;
    border-radius: 26px;
    background: rgba(255, 255, 255, 0.2);
    transform: rotate(-12deg);
  }

  .canva-banner-card::before {
    content: "";
    position: absolute;
    width: 88px;
    height: 88px;
    right: 32px;
    bottom: 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.26);
    transform: rotate(8deg);
  }

  .canva-banner-title {
    position: relative;
    z-index: 1;
    max-width: 220px;
    font-size: 18px;
    line-height: 1.18;
    font-weight: 700;
    margin-bottom: 10px;
  }

  .canva-banner-copy {
    position: relative;
    z-index: 1;
    max-width: 220px;
    color: rgba(255, 255, 255, 0.88);
    font-size: 13px;
    line-height: 1.45;
  }

  .canva-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(214px, 1fr));
    gap: 18px;
  }

  .canva-design-card {
    border-radius: 22px;
    overflow: hidden;
    background: rgba(31, 30, 41, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 16px 32px rgba(10, 10, 16, 0.16);
  }

  :root[data-theme='light'] .canva-design-card {
    background: #fff;
    border-color: rgba(124, 58, 237, 0.08);
    box-shadow: 0 16px 32px rgba(69, 52, 128, 0.1);
  }

  .canva-design-thumb {
    height: 170px;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      linear-gradient(135deg, rgba(124, 58, 237, 0.16), rgba(6, 182, 212, 0.12));
    overflow: hidden;
  }

  .canva-design-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .canva-thumb-fallback {
    width: 74px;
    height: 74px;
    border-radius: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8b5cf6;
    font-size: 30px;
    background: rgba(255, 255, 255, 0.92);
  }

  .canva-design-body {
    padding: 14px 14px 16px;
  }

  .canva-design-title {
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 6px;
    min-height: 42px;
  }

  :root[data-theme='light'] .canva-design-title {
    color: #22153b;
  }

  .canva-design-meta {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.58);
    margin-bottom: 12px;
  }

  :root[data-theme='light'] .canva-design-meta {
    color: rgba(34, 21, 59, 0.56);
  }

  .canva-design-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .canva-design-actions .ant-btn {
    border-radius: 999px !important;
  }

  .canva-muted-card {
    border-radius: 24px;
    background: rgba(27, 26, 36, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 18px;
  }

  :root[data-theme='light'] .canva-muted-card {
    background: rgba(255, 255, 255, 0.96);
    border-color: rgba(124, 58, 237, 0.08);
  }

  .canva-mini-grid {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 18px;
  }

  .canva-exports-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .canva-export-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
  }

  :root[data-theme='light'] .canva-export-row {
    background: rgba(111, 86, 177, 0.06);
  }

  .canva-export-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .canva-export-icon {
    width: 44px;
    height: 44px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 18px;
    background: linear-gradient(135deg, #7c3aed, #4f46e5);
  }

  .canva-template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 14px;
  }

  .canva-template-card {
    border-radius: 20px;
    padding: 18px 16px;
    min-height: 120px;
    background:
      linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02)),
      rgba(29, 27, 39, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #fff;
    box-shadow: 0 14px 28px rgba(10, 10, 16, 0.16);
  }

  :root[data-theme='light'] .canva-template-card {
    background:
      linear-gradient(135deg, rgba(255,255,255,0.92), rgba(248,244,255,0.92)),
      #fff;
    border-color: rgba(124, 58, 237, 0.08);
    color: #22153b;
    box-shadow: 0 14px 28px rgba(69, 52, 128, 0.1);
  }

  .canva-template-visual {
    width: 52px;
    height: 52px;
    border-radius: 18px;
    margin-left: auto;
    background: linear-gradient(135deg, rgba(124,58,237,0.16), rgba(6,182,212,0.18));
    display: flex;
    align-items: center;
    justify-content: center;
    color: #8b5cf6;
    font-size: 22px;
  }

  .canva-create-layout,
  .canva-export-layout,
  .canva-connection-layout {
    display: grid;
    grid-template-columns: 1.35fr 0.95fr;
    gap: 18px;
  }

  .canva-preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 14px;
  }

  .canva-preset-card {
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 22px;
    padding: 18px;
    background: rgba(27, 26, 36, 0.92);
    color: #fff;
    cursor: pointer;
    transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .canva-preset-card:hover {
    transform: translateY(-2px);
    border-color: rgba(167, 139, 250, 0.3);
  }

  .canva-preset-card.active {
    border-color: rgba(139, 92, 246, 0.56);
    box-shadow: 0 16px 26px rgba(124, 58, 237, 0.14);
  }

  :root[data-theme='light'] .canva-preset-card {
    background: #fff;
    color: #22153b;
    border-color: rgba(124, 58, 237, 0.08);
  }

  .canva-preset-icon {
    width: 50px;
    height: 50px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 20px;
    margin-bottom: 14px;
  }

  .canva-highlight-panel {
    border-radius: 24px;
    padding: 22px;
    background:
      linear-gradient(180deg, rgba(23, 22, 31, 0.98), rgba(18, 17, 25, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  :root[data-theme='light'] .canva-highlight-panel {
    background:
      linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,244,255,0.98));
    border-color: rgba(124, 58, 237, 0.08);
  }

  .canva-connection-card {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 18px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.04);
    margin-top: 18px;
  }

  :root[data-theme='light'] .canva-connection-card {
    background: rgba(111, 86, 177, 0.06);
  }

  .canva-stat-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 18px;
  }

  .canva-stat-card {
    border-radius: 18px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.04);
  }

  :root[data-theme='light'] .canva-stat-card {
    background: rgba(111, 86, 177, 0.06);
  }

  .canva-stat-label {
    display: block;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.56);
    margin-bottom: 8px;
  }

  :root[data-theme='light'] .canva-stat-label {
    color: rgba(34, 21, 59, 0.5);
  }

  .canva-stat-value {
    display: block;
    color: #fff;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.04em;
  }

  :root[data-theme='light'] .canva-stat-value {
    color: #22153b;
  }

  .canva-empty-panel {
    border-radius: 24px;
    padding: 28px;
    background: rgba(27, 26, 36, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  :root[data-theme='light'] .canva-empty-panel {
    background: #fff;
    border-color: rgba(124, 58, 237, 0.08);
  }

  .canva-mobile-nav {
    display: none;
  }

  @media (max-width: 1180px) {
    .canva-banner-grid,
    .canva-mini-grid,
    .canva-create-layout,
    .canva-export-layout,
    .canva-connection-layout {
      grid-template-columns: 1fr;
    }

    .canva-hero-title {
      font-size: 44px;
    }
  }

  @media (max-width: 920px) {
    .canva-ui-shell {
      grid-template-columns: 1fr;
    }

    .canva-left-rail {
      display: none;
    }

    .canva-mobile-nav {
      display: flex;
      gap: 10px;
      overflow: auto;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }

    .canva-mobile-item {
      flex: 0 0 auto;
      border-radius: 999px;
      border: 1px solid rgba(139, 92, 246, 0.18);
      padding: 10px 14px;
      background: rgba(255,255,255,0.92);
      color: #2a1f44;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }

    :root[data-theme='dark'] .canva-mobile-item {
      background: rgba(31, 24, 46, 0.72);
      color: #fff;
      border-color: rgba(139, 92, 246, 0.32);
    }

    .canva-mobile-item.active {
      background: linear-gradient(135deg, #7c3aed, #4f46e5);
      border-color: transparent;
      color: #fff;
    }

    .canva-hero-title {
      font-size: 36px;
    }

    .canva-card-grid,
    .canva-banner-grid,
    .canva-template-grid,
    .canva-preset-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 640px) {
    .canva-topbar,
    .canva-content-area {
      padding: 16px;
    }

    .canva-topbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .canva-hero-zone {
      padding: 20px 18px 22px;
    }

    .canva-hero-title {
      font-size: 30px;
    }

    .canva-card-grid,
    .canva-banner-grid,
    .canva-template-grid,
    .canva-preset-grid,
    .canva-stat-grid {
      grid-template-columns: 1fr;
    }
  }
`;

const SearchHero = ({
  title,
  subtitle,
  searchValue,
  setSearchValue,
  placeholder,
  children,
}) => (
  <div className="canva-hero-zone">
    <h2 className="canva-hero-title">{title}</h2>
    {subtitle ? <p className="canva-hero-subtitle">{subtitle}</p> : null}
    <div className="canva-search-shell">
      <Input
        value={searchValue}
        onChange={(event) => setSearchValue(event.target.value)}
        prefix={<SearchOutlined />}
        placeholder={placeholder}
        bordered={false}
        size="large"
      />
    </div>
    {children}
  </div>
);

const DesignCard = ({ design, onOpen, onPreview, onExport, compact = false }) => (
  <div className="canva-design-card">
    <div className="canva-design-thumb" style={{ height: compact ? 148 : 170 }}>
      {design.thumbnailUrl ? (
        <img src={design.thumbnailUrl} alt={design.title || "Canva design"} />
      ) : (
        <div className="canva-thumb-fallback">
          <PictureOutlined />
        </div>
      )}
    </div>
    <div className="canva-design-body">
      <div className="canva-design-title">
        {design.title || "Untitled Design"}
      </div>
      <div className="canva-design-meta">
        {formatEditedText(design.lastModified || design.updatedAt)}
      </div>
      <div className="canva-design-actions">
        <Button type="primary" size="small" onClick={onOpen} disabled={!design.editUrl}>
          Open
        </Button>
        <Button size="small" onClick={onPreview} disabled={!design.viewUrl}>
          <EyeOutlined />
        </Button>
        <Button size="small" onClick={onExport}>
          <ExportOutlined />
        </Button>
      </div>
    </div>
  </div>
);

const ConnectPrompt = ({ onConnect, loading }) => (
  <div className="canva-empty-panel">
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="Connect Canva to unlock My designs, templates, create, and export."
    >
      <Button type="primary" onClick={onConnect} loading={loading}>
        Connect Canva
      </Button>
    </Empty>
  </div>
);

const ClientCanvaPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workspaceView, setWorkspaceView] = useState("home");
  const [searchValue, setSearchValue] = useState("");
  const [designType, setDesignType] = useState("presentation");
  const [selectedDesignId, setSelectedDesignId] = useState(null);
  const [exportFormat, setExportFormat] = useState("png");
  const [lastCreatedDesign, setLastCreatedDesign] = useState(null);
  const [lastExportJob, setLastExportJob] = useState(null);
  const [designFilter, setDesignFilter] = useState("all");

  const {
    data: statusData,
    isLoading: isStatusLoading,
    isFetching: isStatusFetching,
    refetch: refetchStatus,
  } = useGetCanvaStatusQuery();
  const isConnected = Boolean(statusData?.connected);

  const {
    data: designsData,
    isLoading: isDesignsLoading,
    isFetching: isDesignsFetching,
    refetch: refetchDesigns,
  } = useGetCanvaDesignsQuery(undefined, {
    skip: !isConnected,
    refetchOnMountOrArgChange: true,
  });

  const [connectCanva, { isLoading: isConnecting }] = useConnectCanvaMutation();
  const [disconnectCanva, { isLoading: isDisconnecting }] =
    useDisconnectCanvaMutation();
  const [createCanvaDesign, { isLoading: isCreatingDesign }] =
    useCreateCanvaDesignMutation();
  const [exportCanvaDesign, { isLoading: isExportingDesign }] =
    useExportCanvaDesignMutation();

  const designs = useMemo(() => designsData?.designs || [], [designsData]);

  const exportHistory = useMemo(
    () =>
      designs
        .flatMap((design) =>
          (design.exportedFiles || []).map((file, index) => ({
            ...file,
            designTitle: design.title || "Untitled Design",
            designId: design.canvaDesignId,
            thumbnailUrl: design.thumbnailUrl,
            key: `${design.canvaDesignId}-${file.exportedAt || index}`,
          })),
        )
        .sort(
          (a, b) =>
            new Date(b.exportedAt || 0).getTime() -
            new Date(a.exportedAt || 0).getTime(),
        ),
    [designs],
  );

  const filteredDesigns = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    let items = [...designs];

    if (designFilter === "exported") {
      items = items.filter((design) => (design.exportedFiles || []).length > 0);
    }

    if (designFilter === "recent") {
      items = items
        .sort(
          (a, b) =>
            new Date(b.lastModified || b.updatedAt || 0).getTime() -
            new Date(a.lastModified || a.updatedAt || 0).getTime(),
        )
        .slice(0, 8);
    }

    if (!query) return items;

    return items.filter((design) => {
      const title = design.title?.toLowerCase() || "";
      const id = design.canvaDesignId?.toLowerCase() || "";
      return title.includes(query) || id.includes(query);
    });
  }, [designFilter, designs, searchValue]);

  const filteredTemplates = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return TEMPLATE_CARDS;
    return TEMPLATE_CARDS.filter((template) =>
      template.toLowerCase().includes(query),
    );
  }, [searchValue]);

  const selectedDesign = useMemo(
    () =>
      designs.find((design) => design.canvaDesignId === selectedDesignId) || null,
    [designs, selectedDesignId],
  );

  const callbackConnected = searchParams.get("canva_connected");
  const callbackError = searchParams.get("canva_error");

  const callbackAlert = useMemo(() => {
    if (callbackConnected === "true") {
      return {
        type: "success",
        message: "Canva connected successfully",
        description: "Your client workspace is ready to browse and manage designs.",
      };
    }

    if (callbackError) {
      return {
        type: "error",
        message: "Canva connection could not be completed",
        description: `Canva returned: ${callbackError.split("_").join(" ")}.`,
      };
    }

    return null;
  }, [callbackConnected, callbackError]);

  const account = statusData?.account || null;

  useEffect(() => {
    if (!isConnected) {
      setSelectedDesignId(null);
      return;
    }

    const stillExists = designs.some(
      (design) => design.canvaDesignId === selectedDesignId,
    );

    if (!selectedDesignId || !stillExists) {
      setSelectedDesignId(designs[0]?.canvaDesignId || null);
    }
  }, [designs, isConnected, selectedDesignId]);

  useEffect(() => {
    if (callbackConnected === "true") {
      setWorkspaceView("designs");
    } else if (callbackError) {
      setWorkspaceView("connection");
    }
  }, [callbackConnected, callbackError]);

  const clearCallbackParams = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("canva_connected");
    nextParams.delete("canva_error");
    setSearchParams(nextParams, { replace: true });
  };

  const handleConnect = async () => {
    message.info("Canva integration is coming soon!");
    return;
  };

  const handleDisconnect = () => {
    Modal.confirm({
      title: "Disconnect Canva?",
      content:
        "This removes the Canva connection from this client workspace. Your CRM account stays active.",
      okText: "Disconnect",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await disconnectCanva().unwrap();
          setLastCreatedDesign(null);
          setLastExportJob(null);
          setWorkspaceView("connection");
          message.success("Canva account disconnected.");
        } catch (error) {
          message.error(
            getApiErrorMessage(error, "Unable to disconnect Canva."),
          );
        }
      },
    });
  };

  const handleCreateDesign = async () => {
    try {
      const result = await createCanvaDesign({ designType }).unwrap();
      const createdDesign = result?.design || null;
      setLastCreatedDesign(createdDesign);
      message.success("New Canva design created.");
      if (refetchDesigns) refetchDesigns();
    } catch (error) {
      message.error(
        getApiErrorMessage(error, "Unable to create a Canva design."),
      );
    }
  };

  const handleExportDesign = async () => {
    if (!selectedDesignId) {
      message.warning("Choose a design before exporting.");
      return;
    }

    try {
      const result = await exportCanvaDesign({
        designId: selectedDesignId,
        format: exportFormat,
      }).unwrap();
      setLastExportJob(result?.job || null);
      message.success(`Export finished as ${exportFormat.toUpperCase()}.`);
      if (refetchDesigns) refetchDesigns();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Unable to export this design."));
    }
  };

  const renderHomeView = () => (
    <>
      <SearchHero
        title="What will you design today?"
        subtitle="Search, open, create, and hand off branded client designs from one Canva-style workspace."
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        placeholder="Search designs, folders and uploads"
      >
        <div className="canva-quick-actions">
          {DESIGN_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              className="canva-quick-action"
              onClick={() => {
                setDesignType(option.value);
                setWorkspaceView("create");
              }}
            >
              <div
                className="canva-quick-icon"
                style={{
                  background:
                    option.value === "infographic"
                      ? "linear-gradient(135deg, #f8fafc, #d1d5db)"
                      : `linear-gradient(135deg, ${option.color}, ${option.color})`,
                  color: option.value === "infographic" ? "#111827" : "#fff",
                }}
              >
                {option.icon}
              </div>
              <div className="canva-quick-label">{option.label}</div>
            </button>
          ))}
        </div>
      </SearchHero>

      <div className="canva-section">
        <div className="canva-section-header">
          <h3 className="canva-section-title">See what's new</h3>
        </div>
        <div className="canva-banner-grid">
          {HOME_BANNERS.map((banner) => (
            <div
              key={banner.title}
              className="canva-banner-card"
              style={{
                background: `linear-gradient(135deg, ${banner.colors[0]}, ${banner.colors[1]})`,
              }}
            >
              <div className="canva-banner-title">{banner.title}</div>
              <div className="canva-banner-copy">{banner.subtitle}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="canva-section">
        <div className="canva-section-header">
          <h3 className="canva-section-title">Recents</h3>
          <button className="canva-section-link" onClick={() => setWorkspaceView("designs")}>
            Open My designs
          </button>
        </div>

        {!isConnected ? (
          <ConnectPrompt onConnect={handleConnect} loading={isConnecting} />
        ) : (
          <Spin spinning={isDesignsLoading || isDesignsFetching}>
            {filteredDesigns.length === 0 ? (
              <div className="canva-empty-panel">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No designs available yet in this Canva workspace."
                />
              </div>
            ) : (
              <div className="canva-card-grid">
                {filteredDesigns.slice(0, 6).map((design) => (
                  <DesignCard
                    key={design.canvaDesignId || design._id}
                    design={design}
                    onOpen={() => openExternalUrl(design.editUrl)}
                    onPreview={() => openExternalUrl(design.viewUrl)}
                    onExport={() => {
                      setSelectedDesignId(design.canvaDesignId);
                      setWorkspaceView("export");
                    }}
                  />
                ))}
              </div>
            )}
          </Spin>
        )}
      </div>
    </>
  );

  const renderDesignsView = () => (
    <>
      <SearchHero
        title="My designs"
        subtitle="All projects from your Canva-connected CRM workspace, with search and handoff built in."
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        placeholder="Search across My designs"
      >
        <div className="canva-filter-row">
          {[
            { key: "all", label: "All" },
            { key: "recent", label: "Recent" },
            { key: "exported", label: "Exported" },
          ].map((item) => (
            <button
              key={item.key}
              className="canva-filter-chip"
              style={
                designFilter === item.key
                  ? {
                      background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                      color: "#fff",
                      borderColor: "transparent",
                    }
                  : undefined
              }
              onClick={() => setDesignFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </SearchHero>

      {!isConnected ? (
        <ConnectPrompt onConnect={handleConnect} loading={isConnecting} />
      ) : (
        <>
          <div className="canva-section">
            <div className="canva-section-header">
              <h3 className="canva-section-title">Recent designs</h3>
              <Button
                className="canva-pill-action"
                onClick={() => refetchDesigns()}
                loading={isDesignsFetching}
              >
                <ReloadOutlined />
                Refresh
              </Button>
            </div>

            <Spin spinning={isDesignsLoading || isDesignsFetching}>
              {filteredDesigns.length === 0 ? (
                <div className="canva-empty-panel">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No designs matched your search."
                  />
                </div>
              ) : (
                <div className="canva-card-grid">
                  {filteredDesigns.map((design) => (
                    <DesignCard
                      key={design.canvaDesignId || design._id}
                      design={design}
                      onOpen={() => openExternalUrl(design.editUrl)}
                      onPreview={() => openExternalUrl(design.viewUrl)}
                      onExport={() => {
                        setSelectedDesignId(design.canvaDesignId);
                        setWorkspaceView("export");
                      }}
                    />
                  ))}
                </div>
              )}
            </Spin>
          </div>

          <div className="canva-section">
            <div className="canva-section-header">
              <h3 className="canva-section-title">Saved exports</h3>
              <button className="canva-section-link" onClick={() => setWorkspaceView("export")}>
                Open export panel
              </button>
            </div>
            <div className="canva-exports-list">
              {exportHistory.length === 0 ? (
                <div className="canva-empty-panel">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No export history saved yet."
                  />
                </div>
              ) : (
                exportHistory.slice(0, 5).map((item) => (
                  <div className="canva-export-row" key={item.key}>
                    <div className="canva-export-meta">
                      <div className="canva-export-icon">
                        {item.format === "PDF" ? <FilePdfOutlined /> : <CloudDownloadOutlined />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="canva-design-title" style={{ minHeight: "auto", marginBottom: 2 }}>
                          {item.designTitle}
                        </div>
                        <div className="canva-design-meta" style={{ marginBottom: 0 }}>
                          {item.format} . {formatEditedText(item.exportedAt)}
                        </div>
                      </div>
                    </div>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => openExternalUrl(item.url)}
                      disabled={!item.url}
                    >
                      Open
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  const renderTemplatesView = () => (
    <>
      <SearchHero
        title="Templates"
        subtitle="Browse the template-inspired front layer, then jump straight into creation with the same backend flow."
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        placeholder="Search millions of templates"
      >
        <div className="canva-filter-row">
          {TEMPLATE_FILTERS.map((filter) => (
            <div key={filter} className="canva-filter-chip">
              {filter}
            </div>
          ))}
        </div>
      </SearchHero>

      <div className="canva-section">
        <div className="canva-section-header">
          <h3 className="canva-section-title">Explore templates</h3>
        </div>
        <div className="canva-template-grid">
          {filteredTemplates.map((template, index) => (
            <button
              key={template}
              className="canva-template-card"
              onClick={() => {
                setDesignType(
                  DESIGN_TYPE_OPTIONS[index % DESIGN_TYPE_OPTIONS.length].value,
                );
                setWorkspaceView("create");
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
                {template}
              </div>
              <div style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(34,21,59,0.58)", fontSize: 13 }}>
                Quick start this layout style in your CRM workspace
              </div>
              <div className="canva-template-visual">
                {DESIGN_TYPE_OPTIONS[index % DESIGN_TYPE_OPTIONS.length].icon}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="canva-section">
        <div className="canva-section-header">
          <h3 className="canva-section-title">Inspired by your designs</h3>
        </div>
        {isConnected && filteredDesigns.length > 0 ? (
          <div className="canva-card-grid">
            {filteredDesigns.slice(0, 3).map((design) => (
              <DesignCard
                key={design.canvaDesignId || design._id}
                design={design}
                compact
                onOpen={() => openExternalUrl(design.editUrl)}
                onPreview={() => openExternalUrl(design.viewUrl)}
                onExport={() => {
                  setSelectedDesignId(design.canvaDesignId);
                  setWorkspaceView("export");
                }}
              />
            ))}
          </div>
        ) : (
          <div className="canva-empty-panel">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Connect Canva to see templates inspired by your recent work."
            />
          </div>
        )}
      </div>
    </>
  );

  const renderCreateView = () => {
    const activePreset =
      DESIGN_TYPE_OPTIONS.find((option) => option.value === designType) ||
      DESIGN_TYPE_OPTIONS[0];

    return (
      <>
        <SearchHero
          title="Create"
          subtitle="Choose a starting format and launch directly into Canva from the CRM."
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          placeholder="Search design presets"
        />

        {!isConnected ? (
          <ConnectPrompt onConnect={handleConnect} loading={isConnecting} />
        ) : (
          <div className="canva-create-layout">
            <div className="canva-muted-card">
              <div className="canva-section-header">
                <h3 className="canva-section-title">Start with a format</h3>
              </div>
              <div className="canva-preset-grid">
                {DESIGN_TYPE_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`canva-preset-card ${
                      option.value === designType ? "active" : ""
                    }`}
                    onClick={() => setDesignType(option.value)}
                  >
                    <div
                      className="canva-preset-icon"
                      style={{
                        background:
                          option.value === "infographic"
                            ? "linear-gradient(135deg, #f3f4f6, #d1d5db)"
                            : `linear-gradient(135deg, ${option.color}, ${option.color})`,
                        color: option.value === "infographic" ? "#111827" : "#fff",
                      }}
                    >
                      {option.icon}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                      {option.label}
                    </div>
                    <div style={{ color: isDark ? "rgba(255,255,255,0.6)" : "rgba(34,21,59,0.58)", fontSize: 13 }}>
                      {option.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="canva-highlight-panel">
              <Text
                style={{
                  color: isDark ? "#a78bfa" : "#7c3aed",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Launchpad
              </Text>
              <Title
                level={3}
                style={{
                  color: isDark ? "#fff" : "#22153b",
                  marginTop: 10,
                  marginBottom: 8,
                }}
              >
                {activePreset.label}
              </Title>
              <Paragraph style={{ color: isDark ? "rgba(255,255,255,0.68)" : "rgba(34,21,59,0.62)" }}>
                {activePreset.detail}
              </Paragraph>

              <div className="canva-connection-card" style={{ marginBottom: 18 }}>
                <div
                  className="canva-preset-icon"
                  style={{
                    marginBottom: 0,
                    background:
                      activePreset.value === "infographic"
                        ? "linear-gradient(135deg, #f3f4f6, #d1d5db)"
                        : `linear-gradient(135deg, ${activePreset.color}, ${activePreset.color})`,
                    color: activePreset.value === "infographic" ? "#111827" : "#fff",
                  }}
                >
                  {activePreset.icon}
                </div>
                <div>
                  <div
                    style={{
                      color: isDark ? "#fff" : "#22153b",
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    Backend preset mapping
                  </div>
                  <div style={{ color: isDark ? "rgba(255,255,255,0.62)" : "rgba(34,21,59,0.58)", fontSize: 13 }}>
                    This format keeps the existing backend create endpoint exactly the same.
                  </div>
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                className="canva-pill-action"
                style={{ width: "100%" }}
                icon={<PlusOutlined />}
                onClick={handleCreateDesign}
                loading={isCreatingDesign}
              >
                Create in Canva
              </Button>

              {lastCreatedDesign ? (
                <div className="canva-connection-card">
                  <Avatar
                    size={58}
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    }}
                    icon={<CheckCircleFilled />}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: isDark ? "#fff" : "#22153b",
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      {lastCreatedDesign.title || "New Canva design"}
                    </div>
                    <div style={{ color: isDark ? "rgba(255,255,255,0.62)" : "rgba(34,21,59,0.58)", fontSize: 13 }}>
                      Created successfully. Open it directly or continue with exports.
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <Button
                        type="primary"
                        size="small"
                        onClick={() =>
                          openExternalUrl(
                            lastCreatedDesign.openUrl ||
                              lastCreatedDesign.urls?.edit_url,
                          )
                        }
                      >
                        Open in Canva
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setWorkspaceView("export")}
                      >
                        Go to export
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </>
    );
  };

  const renderExportView = () => (
    <>
      <SearchHero
        title="Export"
        subtitle="Choose any synced design, select the output, and hand it off from the CRM."
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        placeholder="Search a design to export"
      />

      {!isConnected ? (
        <ConnectPrompt onConnect={handleConnect} loading={isConnecting} />
      ) : designs.length === 0 ? (
        <div className="canva-empty-panel">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="You need at least one synced design before exporting."
          >
            <Button type="primary" onClick={() => setWorkspaceView("create")}>
              Create a design
            </Button>
          </Empty>
        </div>
      ) : (
        <div className="canva-export-layout">
          <div className="canva-muted-card">
            <div className="canva-section-header">
              <h3 className="canva-section-title">Select a design</h3>
              <button className="canva-section-link" onClick={() => setWorkspaceView("designs")}>
                Open My designs
              </button>
            </div>
            <div className="canva-card-grid">
              {filteredDesigns.slice(0, 6).map((design) => (
                <div
                  key={design.canvaDesignId || design._id}
                  style={{
                    outline:
                      selectedDesignId === design.canvaDesignId
                        ? "2px solid #8b5cf6"
                        : "none",
                    borderRadius: 22,
                  }}
                >
                  <DesignCard
                    design={design}
                    compact
                    onOpen={() => {
                      setSelectedDesignId(design.canvaDesignId);
                      openExternalUrl(design.editUrl);
                    }}
                    onPreview={() => openExternalUrl(design.viewUrl)}
                    onExport={() => setSelectedDesignId(design.canvaDesignId)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="canva-highlight-panel">
            <Text
              style={{
                color: isDark ? "#a78bfa" : "#7c3aed",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Export handoff
            </Text>
            <Title
              level={3}
              style={{
                color: isDark ? "#fff" : "#22153b",
                marginTop: 10,
                marginBottom: 10,
              }}
            >
              Delivery settings
            </Title>

            <Text style={{ color: isDark ? "rgba(255,255,255,0.62)" : "rgba(34,21,59,0.58)" }}>
              Pick the design, choose the file type, and trigger the same backend export endpoint.
            </Text>

            <div style={{ marginTop: 18, marginBottom: 16 }}>
              <Select
                value={selectedDesignId}
                options={designs.map((design) => ({
                  label: design.title || design.canvaDesignId,
                  value: design.canvaDesignId,
                }))}
                onChange={setSelectedDesignId}
                placeholder="Select a design"
                optionFilterProp="label"
                style={{ width: "100%" }}
              />
            </div>

            <Segmented
              block
              options={EXPORT_FORMAT_OPTIONS}
              value={exportFormat}
              onChange={setExportFormat}
            />

            {selectedDesign ? (
              <div className="canva-connection-card">
                <Avatar
                  shape="square"
                  size={68}
                  src={selectedDesign.thumbnailUrl || undefined}
                  icon={<PictureOutlined />}
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: isDark ? "#fff" : "#22153b",
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    {selectedDesign.title || "Untitled Design"}
                  </div>
                  <div style={{ color: isDark ? "rgba(255,255,255,0.62)" : "rgba(34,21,59,0.58)", fontSize: 13 }}>
                    {formatEditedText(selectedDesign.lastModified || selectedDesign.updatedAt)}
                  </div>
                </div>
              </div>
            ) : null}

            <Button
              type="primary"
              size="large"
              className="canva-pill-action"
              style={{ width: "100%", marginTop: 16 }}
              icon={<ExportOutlined />}
              onClick={handleExportDesign}
              loading={isExportingDesign}
            >
              Export now
            </Button>

            {lastExportJob ? (
              <div className="canva-connection-card">
                <Avatar
                  size={58}
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  }}
                  icon={<CloudDownloadOutlined />}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: isDark ? "#fff" : "#22153b",
                      fontWeight: 700,
                      marginBottom: 4,
                    }}
                  >
                    Latest export ready
                  </div>
                  <div style={{ color: isDark ? "rgba(255,255,255,0.62)" : "rgba(34,21,59,0.58)", fontSize: 13 }}>
                    Job ID: {lastExportJob.id || "Unavailable"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    {(lastExportJob.urls || []).map((url) => (
                      <Button key={url} size="small" onClick={() => openExternalUrl(url)}>
                        Open file
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );

  const renderConnectionView = () => (
    <>
      <SearchHero
        title="Connection"
        subtitle="Keep the Canva workspace connected without clutter. Just the account status and actions you need."
        searchValue={searchValue}
        setSearchValue={setSearchValue}
        placeholder="Search your workspace"
      />

      <div className="canva-connection-layout">
        <div className="canva-muted-card">
          <div className="canva-section-header">
            <h3 className="canva-section-title">Account status</h3>
            <Button
              className="canva-pill-action"
              onClick={() => {
                refetchStatus();
                if (isConnected) refetchDesigns();
              }}
              loading={isStatusLoading || isStatusFetching}
            >
              <ReloadOutlined />
              Refresh
            </Button>
          </div>

          <div className="canva-connection-card">
            <Avatar
              size={78}
              src={account?.avatarUrl || undefined}
              icon={<BgColorsOutlined />}
              style={{
                background: isConnected
                  ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                  : "#64748b",
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: isDark ? "#fff" : "#22153b",
                  fontWeight: 700,
                  fontSize: 18,
                  marginBottom: 4,
                }}
              >
                {account?.displayName ||
                  account?.email ||
                  (isConnected ? "Connected Canva account" : "No Canva account connected")}
              </div>
              <div style={{ color: isDark ? "rgba(255,255,255,0.62)" : "rgba(34,21,59,0.58)", fontSize: 13 }}>
                {account?.email ||
                  (isConnected
                    ? "Connected and ready to sync designs."
                    : "Start the OAuth flow to attach Canva to this client workspace.")}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <Button
                  className="canva-pill-action"
                  onClick={handleConnect}
                  loading={isConnecting}
                >
                  {isConnected ? "Reconnect Canva" : "Connect Canva"}
                </Button>
                {isConnected ? (
                  <Button
                    className="canva-pill-action"
                    onClick={handleDisconnect}
                    loading={isDisconnecting}
                    danger
                  >
                    <DisconnectOutlined />
                    Disconnect
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="canva-stat-grid">
            <div className="canva-stat-card">
              <span className="canva-stat-label">Connection</span>
              <span className="canva-stat-value">
                {isConnected ? "Live" : "Pending"}
              </span>
            </div>
            <div className="canva-stat-card">
              <span className="canva-stat-label">Synced designs</span>
              <span className="canva-stat-value">{designs.length}</span>
            </div>
            <div className="canva-stat-card">
              <span className="canva-stat-label">Saved exports</span>
              <span className="canva-stat-value">{exportHistory.length}</span>
            </div>
          </div>
        </div>

        <div className="canva-highlight-panel">
          <Text
            style={{
              color: isDark ? "#a78bfa" : "#7c3aed",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Details
          </Text>
          <Title
            level={3}
            style={{
              color: isDark ? "#fff" : "#22153b",
              marginTop: 10,
              marginBottom: 12,
            }}
          >
            Current Canva connection
          </Title>
          <div className="canva-exports-list">
            {[
              {
                label: "Display name",
                value: account?.displayName || "Not linked yet",
              },
              {
                label: "Account email",
                value: account?.email || "Not available",
              },
              {
                label: "Canva account ID",
                value: account?.canvaAccountId || "Not linked yet",
              },
              {
                label: "Token expiry",
                value: formatDateTime(account?.tokenExpiry),
              },
            ].map((item) => (
              <div className="canva-export-row" key={item.label}>
                <div>
                  <div style={{ color: isDark ? "rgba(255,255,255,0.54)" : "rgba(34,21,59,0.48)", fontSize: 12 }}>
                    {item.label}
                  </div>
                  <div style={{ color: isDark ? "#fff" : "#22153b", fontWeight: 700 }}>
                    {item.value}
                  </div>
                </div>
                <CheckCircleFilled style={{ color: isConnected ? "#22c55e" : "#94a3b8" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const renderView = () => {
    switch (workspaceView) {
      case "designs":
        return renderDesignsView();
      case "templates":
        return renderTemplatesView();
      case "create":
        return renderCreateView();
      case "export":
        return renderExportView();
      case "connection":
        return renderConnectionView();
      case "home":
      default:
        return renderHomeView();
    }
  };

  return (
    <>
      <style>{pageStyles}</style>

      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 8,
          }}
        >
          <Title level={2} style={{ margin: 0 }}>
            Canva Workspace
          </Title>
          <Tag color="orange" style={{ margin: 0, fontSize: 14, padding: "2px 8px" }}>
            Coming Soon
          </Tag>
        </div>
        <Text type="secondary">
          A Canva-style client workspace for My designs, templates, create, export, and connection.
        </Text>
      </div>

      {callbackAlert ? (
        <Alert
          type={callbackAlert.type}
          showIcon
          closable
          onClose={clearCallbackParams}
          style={{ marginBottom: 18, borderRadius: 18 }}
          message={callbackAlert.message}
          description={callbackAlert.description}
        />
      ) : null}

      <div className="canva-ui-shell">
        <aside className="canva-left-rail">
          <div className="canva-left-brand">C</div>
          <button className="canva-create-button" onClick={() => setWorkspaceView("create")}>
            <PlusOutlined />
          </button>

          <div className="canva-rail-nav">
            {WORKSPACE_NAV.map((item) => (
              <button
                key={item.key}
                className={`canva-rail-item ${
                  workspaceView === item.key ? "active" : ""
                }`}
                onClick={() => setWorkspaceView(item.key)}
              >
                <span className="canva-rail-icon">{item.icon}</span>
                <span className="canva-rail-label">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="canva-rail-footer">
            <div className="canva-status-badge">
              {isConnected ? <CheckCircleFilled /> : <LinkOutlined />}
            </div>
          </div>
        </aside>

        <main className="canva-main-panel">
          <div className="canva-topbar">
            <div className="canva-topbar-left">
              <div>
                <div className="canva-topbar-title">
                  {workspaceView === "designs"
                    ? "My designs"
                    : workspaceView === "templates"
                      ? "Templates"
                      : workspaceView === "create"
                        ? "Create"
                        : workspaceView === "export"
                          ? "Export"
                          : workspaceView === "connection"
                            ? "Connection"
                            : "Home"}
                </div>
                <div className="canva-topbar-note">
                  {isConnected
                    ? "Connected to your Canva workspace"
                    : "Connect Canva to unlock the full workspace"}
                </div>
              </div>
            </div>

            <div className="canva-topbar-actions">
              <Button className="canva-pill-action" onClick={() => setWorkspaceView("connection")}>
                {isConnected ? "Workspace live" : "Connection"}
              </Button>
              <Button
                className="canva-pill-action"
                onClick={isConnected ? () => setWorkspaceView("designs") : handleConnect}
                loading={isConnecting}
              >
                {isConnected ? "Open My designs" : "Connect Canva"}
              </Button>
            </div>
          </div>

          <div className="canva-content-area">
            <div className="canva-mobile-nav">
              {WORKSPACE_NAV.map((item) => (
                <button
                  key={item.key}
                  className={`canva-mobile-item ${
                    workspaceView === item.key ? "active" : ""
                  }`}
                  onClick={() => setWorkspaceView(item.key)}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            {renderView()}
          </div>
        </main>
      </div>
    </>
  );
};

export default ClientCanvaPage;
