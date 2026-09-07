import React, { useEffect, useRef, useState } from "react";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import "./grapesjs-theme.css"; // Premium custom theme override
import webpagePlugin from "grapesjs-preset-webpage";
import { Button, message, Modal, Select } from "antd";
const { Option } = Select;
import { ArrowLeft } from "lucide-react";
import CustomImagePanel from "./CustomImagePanel";
import MediaStorageModal from "./MediaStorageModal";

const getWidgetHtmlOnly = (widget) => {
  if (!widget) return "";
  const positionCss =
    widget.launcherPosition === "Bottom left"
      ? "left: 24px !important; right: auto !important;"
      : "right: 24px !important; left: auto !important;";

  const bottomOffset = "24px";

  let brandColor = widget.brandColor || "#3b82f6";
  if (brandColor.startsWith("var(")) {
    brandColor = "#3b82f6";
  }

  let isLight = false;
  if (brandColor.startsWith('#')) {
    const hex = brandColor.replace('#', '');
    if (hex.length === 3 || hex.length === 6) {
      const r = parseInt(hex.length === 3 ? hex[0]+hex[0] : hex.substring(0, 2), 16);
      const g = parseInt(hex.length === 3 ? hex[1]+hex[1] : hex.substring(2, 4), 16);
      const b = parseInt(hex.length === 3 ? hex[2]+hex[2] : hex.substring(4, 6), 16);
      isLight = ((r * 299 + g * 587 + b * 114) / 1000) > 200;
    }
  }
  const headerText = isLight ? "#1e293b" : "#ffffff";
  const headerSubText = isLight ? "#64748b" : "rgba(255,255,255,0.85)";
  const iconColor = isLight ? "#1e293b" : brandColor;
  const avatarBorder = isLight ? "#cbd5e1" : "rgba(255,255,255,0.4)";
  const avatarBg = isLight ? "#f1f5f9" : "rgba(255,255,255,0.2)";
  const launcherText = isLight ? "#1e293b" : "#ffffff";

  // Compute a slightly darker shade for the gradient
  let gradColor = brandColor;
  if (brandColor.startsWith('#') && (brandColor.length === 7 || brandColor.length === 4)) {
    const hex = brandColor.replace('#', '');
    let r = parseInt(hex.length === 3 ? hex[0]+hex[0] : hex.substring(0, 2), 16);
    let g = parseInt(hex.length === 3 ? hex[1]+hex[1] : hex.substring(2, 4), 16);
    let b = parseInt(hex.length === 3 ? hex[2]+hex[2] : hex.substring(4, 6), 16);
    r = Math.max(0, r - 30);
    g = Math.max(0, g - 30);
    b = Math.max(0, b - 30);
    gradColor = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  const channelsHtml = (widget.channels || [])
    .map((ch) => {
      let icon = "";
      let link = "#";
      let label = ch;
      let clickHandler = "";

      if (ch === "WhatsApp") {
        icon = `<svg style="width:20px !important;height:20px !important;fill:currentColor !important;" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.019-5.117-2.875-6.974C16.592 1.91 14.121.889 11.5.888c-5.441 0-9.865 4.424-9.869 9.869-.001 1.755.464 3.468 1.346 4.985L1.929 20.91l5.447-1.43c1.554.847 3.11 1.274 4.83 1.274zm9.467-6.807c-.242-.12-.1.43-.88-.413l-.95-.475c-.2-.1-.4-.1-.5.1l-.4.5c-.1.1-.2.1-.4 0-1.05-.5-1.75-1.2-2.1-1.8-.1-.2 0-.3.1-.4l.3-.4c.1-.1.1-.2 0-.3l-.9-2.15c-.1-.2-.2-.2-.4-.2h-.3c-.2 0-.5.1-.7.3-.6.6-.9 1.4-.9 2.2 0 1.6 1.05 3.1 1.2 3.3.15.2 2.1 3.2 5.1 4.5.7.3 1.25.5 1.7.6.7.2 1.35.15 1.85.1.55-.05 1.7-.7 1.95-1.35.25-.65.25-1.2.15-1.35-.1-.2-.3-.3-.75-.45z"/></svg>`;
        link = `https://wa.me/${(widget.whatsappPhone || "").replace(/[^0-9]/g, "")}`;
      } else if (ch === "Email") {
        icon = `<svg style="width:20px !important;height:20px !important;fill:none !important;stroke:currentColor !important;stroke-width:2 !important;" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>`;
        link = `mailto:${widget.supportEmail || ""}`;
      } else if (ch === "SMS") {
        icon = `<svg style="width:20px !important;height:20px !important;fill:none !important;stroke:currentColor !important;stroke-width:2 !important;" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
        link = `sms:${widget.whatsappPhone || ""}`;
      } else if (ch === "Live chat") {
        icon = `<svg style="width:20px !important;height:20px !important;fill:none !important;stroke:currentColor !important;stroke-width:2 !important;" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`;
        clickHandler = `onclick="openLiveChatPopup()"`;
      } else {
        icon = `<svg style="width:20px !important;height:20px !important;fill:none !important;stroke:currentColor !important;stroke-width:2 !important;" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
      }

      return `
      <a href="${link}" ${clickHandler} target="_blank" style="display:flex !important;align-items:center !important;gap:14px !important;padding:14px 18px !important;background:#ffffff !important;border:1px solid #e2e8f0 !important;border-radius:12px !important;color:#1e293b !important;text-decoration:none !important;font-weight:600 !important;font-size:14px !important;transition:all 0.2s !important;font-family:'Inter',sans-serif !important;box-sizing:border-box !important;text-transform:none !important;letter-spacing:normal !important;line-height:1.2 !important;width:100% !important;text-align:left !important;box-shadow:0 1px 3px rgba(0,0,0,0.02) !important;" onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1';" onmouseout="this.style.background='#ffffff'; this.style.borderColor='#e2e8f0';">
        <span style="color:${iconColor} !important; display:flex !important; align-items:center !important; justify-content:center !important; flex-shrink:0 !important;">${icon}</span>
        <span style="color:#1e293b !important; font-family:'Inter',sans-serif !important; font-size:14px !important; font-weight:600 !important;">${label}</span>
      </a>
    `;
    })
    .join("");

  const widgetName = widget.name || "Chat";

  return `
    <div id="bcc-chat-widget" style="font-family:'Inter', sans-serif !important; position:fixed !important; bottom:${bottomOffset} !important; ${positionCss} z-index:999999 !important; display:block !important; margin:0 !important; padding:0 !important; box-sizing:border-box !important; border:none !important; background:none !important;">
      <style>
        .chat-btn, .chat-button, .floating-chat, .template-chat-button, .chat-widget:not(#bcc-chat-widget) { display: none !important; }
      </style>
      <!-- Launcher (DIV-based to prevent template button overrides) -->
      <div onclick="toggleBccChat()" style="background:${brandColor} !important; color:${launcherText} !important; border:${isLight ? '1px solid #cbd5e1' : 'none'} !important; border-radius:50% !important; width:60px !important; height:60px !important; display:flex !important; align-items:center !important; justify-content:center !important; cursor:pointer !important; box-shadow:0 10px 25px -5px rgba(0,0,0,0.2) !important; transition:all 0.3s !important; z-index:999999 !important; outline:none !important; margin:0 !important; box-sizing:border-box !important;" onmouseover="this.style.transform='scale(1.1) translateY(-2px)'" onmouseout="this.style.transform='scale(1) translateY(0)'">
        <svg style="width:28px !important;height:28px !important;fill:currentColor !important;display:inline-block !important;vertical-align:middle !important;margin:0 !important;padding:0 !important;" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.13 2 11.23c0 2.946 1.487 5.576 3.82 7.377a.75.75 0 01.246.685l-.758 3.51a.75.75 0 001.077.787l4.032-2.128a.75.75 0 01.62-.057c.928.326 1.93.504 2.963.504 5.523 0 10-4.13 10-9.23C22 6.13 17.523 2 12 2zm0 15c-.886 0-1.745-.148-2.544-.43a2.25 2.25 0 00-1.859.17l-2.48 1.309.467-2.164a2.25 2.25 0 00-.737-2.057C3.376 12.63 2.5 10.984 2.5 9.23 2.5 5.503 6.74 2.5 12 2.5s9.5 3.003 9.5 6.73c0 3.727-4.24 6.77-9.5 6.77z"/>
        </svg>
      </div>

      <!-- Chat Window -->
      <div id="bcc-chat-window" style="display:none !important; position:absolute !important; bottom:70px !important; ${widget.launcherPosition === "Bottom left" ? "left: 0 !important;" : "right: 0 !important;"} width:360px !important; background:#ffffff !important; border-radius:24px !important; box-shadow:0 20px 40px -10px rgba(0,0,0,0.2), 0 10px 20px -5px rgba(0,0,0,0.1) !important; border:1px solid #e2e8f0 !important; overflow:hidden !important; transition:all 0.3s ease !important; transform:translateY(10px) !important; opacity:0 !important; z-index:9999999 !important; font-family:'Inter', sans-serif !important; box-sizing:border-box !important;">
        <!-- Header -->
        <div style="background:${brandColor} !important; border-bottom:${isLight ? '1px solid #f1f5f9' : 'none'} !important; color:${headerText} !important; padding:28px 24px 24px 24px !important; position:relative !important; box-sizing:border-box !important; border-top-left-radius:24px !important; border-top-right-radius:24px !important; display:block !important; text-align:left !important;">
          <div style="display:flex !important; align-items:center !important; gap:16px !important; margin-bottom:12px !important;">
            <!-- Avatar with online indicator -->
            <div style="position:relative !important; width:52px !important; height:52px !important; background:${avatarBg} !important; border-radius:50% !important; display:flex !important; align-items:center !important; justify-content:center !important; font-weight:800 !important; color:${headerText} !important; font-size:22px !important; border: 2px solid ${avatarBorder} !important; font-family:'Inter',sans-serif !important; box-sizing:border-box !important; box-shadow:0 4px 10px rgba(0,0,0,0.1) !important;">
              ${widgetName.charAt(0).toUpperCase()}
              <span style="position:absolute !important; bottom:2px !important; right:2px !important; width:12px !important; height:12px !important; background:#22c55e !important; border:2px solid ${brandColor} !important; border-radius:50% !important;"></span>
            </div>
            <div style="display:block !important;">
              <div style="font-weight:800 !important; font-size:18px !important; color:${headerText} !important; font-family:'Inter',sans-serif !important; line-height:1.2 !important; margin:0 !important; letter-spacing:-0.3px !important;">${widgetName}</div>
              <div style="font-size:13px !important; color:${headerSubText} !important; font-family:'Inter',sans-serif !important; line-height:1.2 !important; margin-top:4px !important; font-weight:600 !important; display:flex !important; align-items:center !important; gap:4px !important;">
                <span style="display:inline-block !important; width:6px !important; height:6px !important; background:#22c55e !important; border-radius:50% !important;"></span>
                Online · Support Team
              </div>
            </div>
          </div>
          <div style="font-size:14px !important; color:${isLight ? '#475569' : 'rgba(255,255,255,0.95)'} !important; font-family:'Inter',sans-serif !important; line-height:1.5 !important; font-weight:500 !important; margin-top:16px !important;">
            ${widget.greeting || "Hi! How can we help you today?"}
          </div>
          <div onclick="toggleBccChat()" style="position:absolute !important; top:16px !important; right:16px !important; background:rgba(255,255,255,0.1) !important; border-radius:50% !important; border:none !important; color:${headerText} !important; font-size:20px !important; cursor:pointer !important; outline:none !important; width:32px !important; height:32px !important; display:flex !important; align-items:center !important; justify-content:center !important; line-height:1 !important; transition:all 0.2s !important;" onmouseover="this.style.background='rgba(255,255,255,0.2)';" onmouseout="this.style.background='rgba(255,255,255,0.1)';">×</div>
        </div>

        <!-- Channels list -->
        <div style="padding:20px !important; display:flex !important; flex-direction:column !important; gap:10px !important; max-height:300px !important; overflow-y:auto !important; box-sizing:border-box !important; background:#ffffff !important;">
          ${channelsHtml}
        </div>

        <!-- Branding footer -->
        <div style="padding:12px 20px !important; text-align:center !important; font-size:11px !important; color:#94a3b8 !important; border-top:1px solid #f1f5f9 !important; background:#fafafa !important; font-family:'Inter',sans-serif !important; font-weight:500 !important; display:block !important; line-height:1.2 !important; box-sizing:border-box !important;">
          Powered by Bcc Crm
        </div>

        <!-- Live Chat Sub-view (Initially Hidden) -->
        <div id="bcc-live-chat-panel" style="display:none !important; position:absolute !important; top:0 !important; left:0 !important; width:100% !important; height:100% !important; background:#ffffff !important; flex-direction:column !important; z-index:100 !important; box-sizing:border-box !important;">
          <div style="background:${brandColor} !important; border-bottom:${isLight ? '1px solid #f1f5f9' : 'none'} !important; color:${headerText} !important; padding:16px !important; display:flex !important; align-items:center !important; gap:12px !important; box-sizing:border-box !important;">
            <div onclick="closeLiveChatPopup()" style="background:transparent !important; border:none !important; color:${headerText} !important; font-size:20px !important; cursor:pointer !important; outline:none !important; padding:0 !important; margin:0 !important; width:auto !important; height:auto !important;">←</div>
            <div style="font-weight:700 !important; font-size:15px !important; font-family:'Inter',sans-serif !important; color:${headerText} !important; text-transform:none !important;">Live Chat</div>
          </div>
          <div id="bcc-chat-messages" style="flex:1 !important; padding:16px !important; overflow-y:auto !important; display:flex !important; flex-direction:column !important; gap:12px !important; background:#f8fafc !important; font-size:13px !important; box-sizing:border-box !important;">
            <div style="background:#ffffff !important; border:1px solid #e2e8f0 !important; padding:10px 14px !important; border-radius:12px !important; max-width:85% !important; align-self:flex-start !important; color:#1e293b !important; line-height:1.4 !important; font-family:'Inter',sans-serif !important; text-align:left !important; box-sizing:border-box !important;">
              ${widget.greeting || "Hello! How can we help you?"}
            </div>
          </div>
          <div style="padding:12px !important; border-top:1px solid #e2e8f0 !important; display:flex !important; gap:8px !important; box-sizing:border-box !important; background:#ffffff !important;">
            <input id="bcc-chat-input" type="text" placeholder="Type a message..." style="flex:1 !important; padding:8px 12px !important; border:1px solid #cbd5e1 !important; border-radius:8px !important; font-size:13px !important; outline:none !important; font-family:'Inter',sans-serif !important; background:#ffffff !important; color:#1e293b !important; box-sizing:border-box !important; height:auto !important;" onkeypress="handleBccChatKey(event)" />
            <div onclick="sendBccChatMessage()" style="background:${brandColor} !important; color:${launcherText} !important; border:${isLight ? '1px solid #cbd5e1' : 'none'} !important; border-radius:8px !important; padding:10px 16px !important; cursor:pointer !important; font-weight:700 !important; font-size:13px !important; outline:none !important; font-family:'Inter',sans-serif !important; height:38px !important; box-sizing:border-box !important; display:flex !important; align-items:center !important; justify-content:center !important;">Send</div>
          </div>
        </div>
      </div>
    </div>
  `;
};

const NON_CONTENT_SELECTOR =
  "script, style, noscript, #spinner, #preloader, .preloader, .loader-wrapper, .loader, .td-preloader-wrap, " +
  ".back-to-top, #back-to-top, .backtotop, .back-to-top-btn, .scroll-top, .scrolltop, .scroll-to-top, .scrollup, .go-top, .gotop, .totop";

const GENERIC_CLASS_RE =
  /^(container|container-fluid|row|col(-\w+)?(-\d+)?|[pm][trblxy]?-\d+|wow|fade\w*|text-(center|left|right|white|dark)|d-\w+|position-\w+|w-100|h-100)$/i;

const significantClassTokens = (el) =>
  (el.className || "")
    .toString()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((c) => !GENERIC_CLASS_RE.test(c));

const shareStyleSignal = (elA, elB) => {
  const a = significantClassTokens(elA);
  const b = new Set(significantClassTokens(elB));
  return a.some((c) => b.has(c));
};

const isNavLike = (el) =>
  el.matches("nav") ||
  !!el.querySelector("nav") ||
  el.matches('[class*="navbar"]') ||
  !!el.querySelector('[class*="navbar"]');

const isFooterSignal = (el) =>
  el.matches('[class*="footer"], [id*="footer"], [class*="copyright"], [id*="copyright"]');

const buildHeaderGroup = (children) => {
  if (children.length === 0) return [];
  const lookahead = Math.min(children.length, 3);
  for (let i = 0; i < lookahead; i++) {
    if (isNavLike(children[i])) return children.slice(0, i + 1);
  }
  return [children[0]]; 
};

const buildFooterGroup = (children) => {
  const n = children.length;
  if (n === 0) return [];
  const lookback = Math.min(n, 3);
  const group = [children[n - 1]];
  for (let i = n - 2; i >= n - lookback; i--) {
    const el = children[i];
    if (isFooterSignal(el) || shareStyleSignal(el, group[0])) {
      group.unshift(el);
    } else {
      break;
    }
  }
  return group;
};

const parseHeaderFooterFromHtml = (html) => {
  if (!html) return { header: "", footer: "" };
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const body = doc.body;
    if (!body) return { header: "", footer: "" };

    const headerEl = doc.querySelector(
      "header, [data-gjs-type='header'], .site-header, .main-header, #header",
    );
    const footerEl = doc.querySelector(
      "footer, [data-gjs-type='footer'], .site-footer, .main-footer, #footer",
    );

    const topLevelChildren = Array.from(body.children).filter(
      (el) => !el.matches(NON_CONTENT_SELECTOR),
    );

    let headerGroup = headerEl ? [headerEl] : [];
    let footerGroup = footerEl ? [footerEl] : [];

    if (headerGroup.length === 0 && topLevelChildren.length > 1) {
      headerGroup = buildHeaderGroup(topLevelChildren);
    }
    if (footerGroup.length === 0 && topLevelChildren.length > 1) {
      footerGroup = buildFooterGroup(topLevelChildren);
    }

    // Guard against a single-section page grabbing the same element(s) twice.
    if (headerGroup.length && footerGroup.length && headerGroup.some((h) => footerGroup.includes(h))) {
      footerGroup = [];
    }

    return {
      header: headerGroup.map((el) => el.outerHTML).join("\n"),
      footer: footerGroup.map((el) => el.outerHTML).join("\n"),
    };
  } catch (err) {
    console.error("Failed to parse header/footer from home page", err);
    return { header: "", footer: "" };
  }
};

const getSiteHeaderFooter = (website) => {
  if (!website || !Array.isArray(website.pages)) return { header: "", footer: "", css: "" };
  const homePage =
    website.pages.find((p) => p.isHome) ||
    website.pages.find((p) => p.html) ||
    null;
  if (!homePage || !homePage.html) return { header: "", footer: "", css: "" };
  const { header, footer } = parseHeaderFooterFromHtml(homePage.html);
  // Carry the home page CSS so header/footer class selectors resolve in all pages
  return { header, footer, css: homePage.css || "" };
};

const DEFAULT_FEATURED_IMAGE_ASPECT_RATIO = "16/9";
const LEGACY_DEFAULT_FEATURED_IMAGE_HEIGHT = "280px";
const normalizeFeaturedImageHeight = (html) => {
  if (!html) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const img = doc.querySelector('[data-post-field="image"]');
    if (img) {
      if (!img.style.aspectRatio && (!img.style.height || img.style.height === LEGACY_DEFAULT_FEATURED_IMAGE_HEIGHT)) {
        img.style.removeProperty("height");
        img.style.aspectRatio = DEFAULT_FEATURED_IMAGE_ASPECT_RATIO;
      }
      img.style.removeProperty("max-height");
      if (!img.style.objectFit) img.style.objectFit = "cover";
    }
    return doc.body.innerHTML;
  } catch (err) {
    console.error("Failed to normalize featured image height", err);
    return html;
  }
};

const extractStylesheetUrls = (html) => {
  if (!html) return [];
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
      .map((l) => l.getAttribute("href"))
      .filter((href) => !!href && /^https?:\/\//i.test(href));
  } catch (err) {
    console.error("Failed to extract stylesheet urls from template html", err);
    return [];
  }
};

const GrapesJSBuilder = ({
  activeWebsite = {},
  activePage = {},
  activePost = {},
  mode = "page",
  setEditingPage,
  onSave,
  onCustomSave,
}) => {
  const isPostMode = mode === "post";
  const editorRef = useRef(null);
  const stylesheetUrlsRef = useRef([]);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(null); 
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const initialPostTitle = activePost?.title || "";
  const initialPostExcerpt = activePost?.excerpt || "";
  const initialPostFeaturedImageUrl = activePost?.featuredImageUrl || "";
  const [chatWidgets, setChatWidgets] = useState([]);
  const [selectedChatWidgetId, setSelectedChatWidgetId] = useState(
    activeWebsite.chatWidgetId || "none",
  );
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [savingWidget, setSavingWidget] = useState(false);
  const [assignedWidget, setAssignedWidget] = useState(null);
  const [postStatus, setPostStatus] = useState(activePost?.status || "draft");

  useEffect(() => {
    if (!editorRef.current) return;

    const sourceContent = isPostMode ? activePost : activePage;
    const siteFont = activeWebsite?.theme?.fontFamily || "Inter";
    const brandColor = activeWebsite?.theme?.primaryColor || "var(--accent-primary)";

    const homePageForAssets = Array.isArray(activeWebsite?.pages)
      ? activeWebsite.pages.find((p) => p.isHome) ||
        activeWebsite.pages.find((p) => p.html) ||
        null
      : null;
    const resolveCssUrls = (page) =>
      (page?.stylesheetUrls?.length ? page.stylesheetUrls : extractStylesheetUrls(page?.html || "")).filter(url => !url.endsWith('.js') && !url.includes('.js?'));
    
    const resolveJsUrls = (page) =>
      (page?.stylesheetUrls?.length ? page.stylesheetUrls : []).filter(url => url.endsWith('.js') || url.includes('.js?'));

    const templateCssUrls = isPostMode
      ? resolveCssUrls(homePageForAssets)
      : (resolveCssUrls(sourceContent).length ? resolveCssUrls(sourceContent) : resolveCssUrls(homePageForAssets));
      
    const templateJsUrls = isPostMode
      ? resolveJsUrls(homePageForAssets)
      : (resolveJsUrls(sourceContent).length ? resolveJsUrls(sourceContent) : resolveJsUrls(homePageForAssets));

    stylesheetUrlsRef.current = templateCssUrls;

    const styleSectors = [
      {
        name: "General",
        open: false,
        buildProps: [
          "display",
          "float",
          "position",
          "top",
          "right",
          "left",
          "bottom",
        ],
      },
      {
        name: "Dimension",
        open: true,
        buildProps: [
          "width",
          "height",
          "max-width",
          "min-width",
          "max-height",
          "min-height",
          "margin",
          "margin-top",
          "margin-right",
          "margin-bottom",
          "margin-left",
          "padding",
          "padding-top",
          "padding-right",
          "padding-bottom",
          "padding-left",
        ],
      },
      {
        name: "Typography",
        open: true,
        buildProps: [
          "font-family",
          "font-size",
          "font-weight",
          "letter-spacing",
          "color",
          "line-height",
          "text-align",
          "text-decoration",
          "text-shadow",
        ],
      },
      {
        name: "Decorations",
        open: true,
        buildProps: [
          "background-color",
          "border-radius",
          "border",
          "box-shadow",
          "background",
        ],
      },
      {
        name: "Flex",
        open: false,
        buildProps: [
          "flex-direction",
          "flex-wrap",
          "justify-content",
          "align-items",
          "align-content",
          "order",
          "flex-basis",
          "flex-grow",
          "flex-shrink",
          "align-self",
        ],
      },
      {
        name: "Extra",
        open: false,
        buildProps: ["opacity", "transition", "transform", "cursor", "overflow"],
      },
    ];

    const e = grapesjs.init({
      container: editorRef.current,
      fromElement: true,
      height: "100%",
      width: "auto",
      storageManager: false, // We'll handle saving manually
      assetManager: {
        custom: {
          open() {
            setIsMediaModalOpen(true);
          },
          close() {
            setIsMediaModalOpen(false);
          },
        },
      },
      styleManager: {
        sectors: styleSectors,
      },
      plugins: [webpagePlugin],
      pluginsOpts: {
        "grapesjs-preset-webpage": {
          customStyleManager: styleSectors,
        },
      },
      canvas: {
        styles: [
          // Basic reset or custom styles
          "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap",
          ...templateCssUrls,
        ],
        scripts: [
          "https://cdn.tailwindcss.com",
          ...templateJsUrls,
        ],
      },
    });

    // Extract header/footer HTML and home-page CSS BEFORE registering the "load" event
    // so the closure captures the correct values when the event fires.
    const { header: siteHeaderHtml, footer: siteFooterHtml, css: siteHeaderFooterCss } = getSiteHeaderFooter(activeWebsite);
    const siteName = activeWebsite?.name || "Your Site";

    const fallbackHeaderHtml = `<header style="display:flex; align-items:center; justify-content:space-between; padding:20px 40px; font-family:var(--site-font, '${siteFont}'), sans-serif; border-bottom:1px solid #e2e8f0;"><div style="font-weight:800; font-size:20px; color:#0f172a;">${siteName}</div><nav style="display:flex; gap:24px; font-size:15px; font-weight:600; color:#334155;"><span>Home</span><span>About</span><span>Contact</span></nav></header>`;
    const fallbackFooterHtml = `<footer style="padding:32px 40px; text-align:center; font-family:var(--site-font, '${siteFont}'), sans-serif; color:#64748b; font-size:14px; border-top:1px solid #e2e8f0;">© ${new Date().getFullYear()} ${siteName}. All rights reserved.</footer>`;

    // Helper to (re-)inject home-page CSS into the canvas iframe head.
    // This is a separate <style> tag so editor.getCss() never includes it —
    // keeping saves clean and avoiding duplication on disk.
    const ensureHomePageCssInCanvas = (canvasDoc) => {
      if (!siteHeaderFooterCss && !canvasDoc) return;
      let homeStyleEl = canvasDoc.getElementById("bcc-home-page-css");
      if (!homeStyleEl) {
        homeStyleEl = canvasDoc.createElement("style");
        homeStyleEl.id = "bcc-home-page-css";
        canvasDoc.head.appendChild(homeStyleEl);
      }
      
      const externalCss = (isPostMode ? activePost?.externalInlineCss : activePage?.externalInlineCss) || "";
      homeStyleEl.textContent = (siteHeaderFooterCss || "") + "\n" + externalCss;
    };

    e.on("load", () => {
      const canvasDoc = e.Canvas.getDocument();
      if (!canvasDoc) return;
      let styleEl = canvasDoc.getElementById("bcc-theme-vars");
      if (!styleEl) {
        styleEl = canvasDoc.createElement("style");
        styleEl.id = "bcc-theme-vars";
        canvasDoc.head.appendChild(styleEl);
      }
      const postRenderOverrides = isPostMode
        ? `
          body { font-family: var(--site-font), sans-serif; }
          body > * { width: 100% !important; max-width: 100% !important; box-sizing: border-box; }
          [data-post-field="faq"], [data-post-field="faq"] *, .faq-item, .faq-item * {
            font-family: var(--site-font) !important;
          }
          [data-post-field="faq"] > div:first-child > span:first-child > span:first-child,
          .faq-item summary span[style*="border-radius:999px"] {
            background: var(--brand-color) !important;
          }
          [data-post-field="faq"] h2 span {
            color: var(--brand-color) !important;
          }
          [data-post-field="faq"] > div:first-child > span:first-child {
            background: color-mix(in srgb, var(--brand-color) 10%, transparent) !important;
            border-color: color-mix(in srgb, var(--brand-color) 20%, transparent) !important;
          }
          .bcc-brand-bg { background: var(--brand-color) !important; }
          .bcc-brand-text { color: var(--brand-color) !important; }
          .bcc-brand-tint {
            background: color-mix(in srgb, var(--brand-color) 10%, transparent) !important;
            border-color: color-mix(in srgb, var(--brand-color) 20%, transparent) !important;
          }
        `
        : "";
      styleEl.innerHTML = `:root { --site-font: '${siteFont}', sans-serif; --brand-color: ${brandColor}; } ${postRenderOverrides}`;

      // Inject home-page CSS as a separate style tag (outside GrapesJS CSS Composer).
      ensureHomePageCssInCanvas(canvasDoc);
    });

    if (sourceContent.html) {
      e.setComponents(
        isPostMode ? normalizeFeaturedImageHeight(sourceContent.html || "") : (sourceContent.html || ""),
      );
      if (sourceContent.css) {
        // e.setStyle overwrites all CSS (including inline styles converted by setComponents).
        // To preserve component styles, we append the source CSS to the generated CSS.
        const existingCss = e.getCss() || "";
        e.setStyle(existingCss + "\n" + sourceContent.css);
      }
    } else if (isPostMode) {
      e.setComponents(`
        ${siteHeaderHtml}
        <div style="width:100%; box-sizing:border-box; padding: 50px 40px; font-family: var(--site-font, '${siteFont}'), sans-serif;">
          <img data-post-field="image" src="${initialPostFeaturedImageUrl || "https://placehold.co/800x400?text=Featured+Image"}" alt="Featured image" style="width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:12px; margin-bottom:28px;" />
          <h1 data-post-field="title" style="font-size:36px; font-weight:800; line-height:1.2; margin:0 0 14px; color:#0f172a;">${initialPostTitle || "Post title"}</h1>
          <p data-post-field="excerpt" style="font-size:17px; color:#64748b; line-height:1.6; margin:0 0 32px;">${initialPostExcerpt || "A short summary shown in blog listings."}</p>
          <div style="font-size:16px; line-height:1.8; color:#1e293b;">
            <p>Start writing your blog post content here, or drag more blocks in from the panel.</p>
          </div>
        </div>
        ${siteFooterHtml}
      `);
    } else {
      e.setComponents(`
        ${siteHeaderHtml}
        <div style="padding: 50px; text-align: center; font-family: var(--site-font, '${siteFont}'), sans-serif;"><h1>Welcome to M1 Growth platform Builder</h1><p>Start dragging blocks from the right panel to build your page!</p></div>
        ${siteFooterHtml}
      `);
    }

    setEditor(e);

    // Use plain HTML strings for block content so GrapesJS does NOT add the
    // home CSS to getCss(). The home CSS is already available via the
    // <style id="bcc-home-page-css"> tag injected in the canvas head on load.
    e.BlockManager.add("site-header-block", {
      label: "Header",
      category: "Basic",
      content: siteHeaderHtml || fallbackHeaderHtml,
      attributes: { class: "fa fa-window-maximize" },
    });
    e.BlockManager.add("site-footer-block", {
      label: "Footer",
      category: "Basic",
      content: siteFooterHtml || fallbackFooterHtml,
      attributes: { class: "fa fa-window-minimize" },
    });

    // When a header/footer block is dragged in, ensure the home CSS style tag
    // is still present (GrapesJS canvas resets can sometimes clear head tags).
    e.on("block:drag:stop", (component, block) => {
      const blockId = block?.get ? block.get("id") : block?.id;
      if (blockId === "site-header-block" || blockId === "site-footer-block") {
        const canvasDoc = e.Canvas.getDocument();
        if (canvasDoc) ensureHomePageCssInCanvas(canvasDoc);
      }
    });

    // Fetch forms and register them as GrapesJS blocks
    const loadForms = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/forms", {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
          data.data.forEach((form) => {
            const embedUrl = `${window.location.origin}/embed/form/${form._id}`;
            const iframeCode = `<iframe src="${embedUrl}" title="${form.name}" style="width:100%; height:520px; border:0; border-radius:16px;"></iframe>`;

            e.BlockManager.add(`form-${form._id}`, {
              label: form.name,
              category: "Forms",
              content: iframeCode,
              attributes: { class: "fa fa-wpforms" }, // simple icon representation
            });
          });
        }
      } catch (err) {
        console.error("Failed to fetch forms for GrapesJS", err);
      }
    };

    // Fetch blogs and register them as GrapesJS blocks
    const loadBlogs = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/blogs", {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
          data.data.forEach((blog) => {
            const embedUrl = `${window.location.origin}/embed/blog/${blog._id}`;
            const iframeCode = `<iframe src="${embedUrl}" title="${blog.name}" style="width:100%; height:800px; border:0; border-radius:16px;"></iframe>`;

            e.BlockManager.add(`blog-${blog._id}`, {
              label: blog.name,
              category: "Blogs",
              content: iframeCode,
              attributes: { class: "fa fa-newspaper-o" }, // FontAwesome newspaper icon
            });
          });
        }
      } catch (err) {
        console.error("Failed to fetch blogs for GrapesJS", err);
      }
    };

    // Fetch QR links and register them as GrapesJS blocks
    const loadQRs = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/qrs", {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();

        if (data.success && Array.isArray(data.data)) {
          data.data.forEach((qr) => {
            const embedUrl = `${window.location.origin}/embed/qr/${qr._id}`;
            const iframeCode = `<iframe src="${embedUrl}" title="${qr.name}" style="width:220px; height:240px; border:0; border-radius:16px; overflow:hidden;" scrolling="no"></iframe>`;

            e.BlockManager.add(`qr-${qr._id}`, {
              label: qr.name,
              category: "QR Links",
              content: iframeCode,
              attributes: { class: "fa fa-qrcode" },
            });
          });
        }
      } catch (err) {
        console.error("Failed to fetch QRs for GrapesJS", err);
      }
    };

    if (!isPostMode) {
      loadForms();
      loadBlogs();
      loadQRs();
    } else {
      e.BlockManager.add("post-title-block", {
        label: "Post Title",
        category: "Post",
        content: `<h1 data-post-field="title" style="font-size:36px; font-weight:800; line-height:1.2; margin:0 0 14px; color:#0f172a; font-family:var(--site-font, '${siteFont}'), sans-serif;">Post title</h1>`,
        attributes: { class: "fa fa-header" },
      });
      e.BlockManager.add("post-featured-image-block", {
        label: "Featured Image",
        category: "Post",
        content: `<img data-post-field="image" src="https://placehold.co/800x400?text=Featured+Image" alt="Featured image" style="width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:12px;" />`,
        attributes: { class: "fa fa-image" },
      });
      e.BlockManager.add("post-excerpt-block", {
        label: "Excerpt",
        category: "Post",
        content: `<p data-post-field="excerpt" style="font-size:17px; color:#64748b; line-height:1.6; font-family:var(--site-font, '${siteFont}'), sans-serif;">A short summary shown in blog listings.</p>`,
        attributes: { class: "fa fa-align-left" },
      });

      const faqThemeColor = activeWebsite?.theme?.primaryColor || "var(--accent-primary)";
      const faqThemeFont = activeWebsite?.theme?.fontFamily || "Inter";
      const faqFontFamily = `var(--site-font, '${faqThemeFont}'), sans-serif`;
      const faqColor = `var(--brand-color, ${faqThemeColor})`;
      const faqTintBg = `color-mix(in srgb, ${faqColor} 10%, transparent)`;
      const faqTintBorder = `color-mix(in srgb, ${faqColor} 20%, transparent)`;

      const faqItemHtml = (question, answer, open) => `
          <details class="faq-item"${open ? " open" : ""} style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px 24px; margin-bottom:16px; box-shadow:0 1px 2px rgba(15,23,42,0.04); font-family:${faqFontFamily};">
            <summary style="list-style:none; cursor:pointer; margin:0; display:flex; align-items:center; justify-content:space-between; gap:16px;">
              <span data-faq-question style="font-weight:700; font-size:16px; color:#0f172a; font-family:${faqFontFamily};">${question}</span>
              <span class="bcc-brand-bg" style="flex-shrink:0; width:32px; height:32px; border-radius:999px; background:${faqColor}; display:flex; align-items:center; justify-content:center;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </span>
            </summary>
            <div data-faq-answer style="font-size:15px; color:#64748b; line-height:1.7; margin-top:12px; font-family:${faqFontFamily};">${answer}</div>
          </details>`;

      e.BlockManager.add("post-faq-section-block", {
        label: "FAQ Section",
        category: "Post",
        content: `
          <div data-post-field="faq" style="margin-top:40px; padding-top:32px; font-family:${faqFontFamily};">
            <div style="text-align:center; margin-bottom:32px;">
              <span class="bcc-brand-tint" style="display:inline-flex; align-items:center; gap:2px; background:${faqTintBg}; border:1px solid ${faqTintBorder}; border-radius:999px; padding:4px; margin-bottom:20px;">
                <span class="bcc-brand-bg" style="background:${faqColor}; color:#ffffff; font-weight:700; font-size:13px; padding:6px 16px; border-radius:999px; font-family:${faqFontFamily};">Brand</span>
                <span style="color:#0f172a; font-weight:700; font-size:13px; padding:6px 16px; font-family:${faqFontFamily};">FAQ</span>
              </span>
              <h2 style="font-size:32px; font-weight:800; margin:0 0 12px; color:#0f172a; line-height:1.25; font-family:${faqFontFamily};">Frequently answer <span class="bcc-brand-text" style="color:${faqColor};">questions</span></h2>
              <p style="font-size:15px; color:#64748b; margin:0; font-family:${faqFontFamily};">Manage it all with a fully customizable, no code platform</p>
            </div>
            ${faqItemHtml(
              "What is Customer Relationship Management (CRM)?",
              "Customer Relationship Management (CRM) is a platform that helps companies manage interactions with current and potential customers. CRM software enhances customer relationships by connecting with customers, streamlining activities, and improving retention.",
              true
            )}
            ${faqItemHtml("What is CRM Software Used For?", "Its answer.", true)}
            ${faqItemHtml("Manage your finances from any device", "Its answer.", true)}
          </div>
        `,
        attributes: { class: "fa fa-question-circle" },
      });
      e.BlockManager.add("post-faq-item-block", {
        label: "FAQ Item",
        category: "Post",
        content: faqItemHtml("Another question?", "Its answer.", true),
        attributes: { class: "fa fa-plus-square" },
      });
    }

    // Hide common HTML template preloaders/spinners inside the canvas
    e.on("load", () => {
      try {
        const doc = e.Canvas.getDocument();
        if (doc) {
          const style = doc.createElement("style");
          style.innerHTML = `
            /* Match the published preview's reset so nothing renders with
               stray default browser spacing on the sides */
            body { margin: 0; padding: 0; overflow: auto !important; height: auto !important; }
            html { overflow: auto !important; height: auto !important; }
            /* Hide preloaders in builder so they don't block the canvas */
            #spinner, #preloader, .preloader, .loader-wrapper, .loader {
              display: none !important;
              opacity: 0 !important;
              visibility: hidden !important;
              pointer-events: none !important;
            }
            /* Specific Bootstrap 5 spinner overlay used in many templates */
            div.show.bg-white.position-fixed.translate-middle.w-100.vh-100 {
              display: none !important;
              opacity: 0 !important;
              visibility: hidden !important;
              pointer-events: none !important;
            }
            /* Posts saved before the featured-image max-height fix can still carry
               a stale max-height:280px (from the old insert default) alongside a
               larger resized height, which clamps the image back down. Neutralize
               it here so the canvas reflects the real, resized height. */
            [data-post-field="image"] {
              max-height: none !important;
            }
          `;
          doc.head.appendChild(style);
        }
      } catch (err) {
        console.error("Error injecting canvas styles", err);
      }

      // Add 'src' to the image component's traits so it's easily editable in the Settings panel
      try {
        const domc = e.DomComponents;
        const imgType = domc.getType("image");
        if (imgType) {
          domc.addType("image", {
            model: {
              defaults: {
                traits: [
                  {
                    type: "text",
                    label: "Image URL",
                    name: "src",
                    placeholder: "https://example.com/image.jpg",
                  },
                  {
                    type: "text",
                    label: "Alt Text",
                    name: "alt",
                    placeholder: "eg. Text here",
                  },
                ],
              },
            },
          });
        }
      } catch (err) {
        console.error("Error updating image traits", err);
      }
    });

    e.on("component:selected", (component) => {
      setSelectedComponent(component);
    });

    e.on("component:deselected", () => {
      setSelectedComponent(null);
    });

    e.on("run:core:preview", () => setIsPreviewing(true));
    e.on("stop:core:preview", () => setIsPreviewing(false));

    return () => {
      e.destroy();
    };
  }, [activePage.html, activePage.css, activePost?.html, activePost?.css]);

  useEffect(() => {
    const fetchWidgets = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/chat-widgets", {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        });
        const data = await res.json();
        if (data.success) {
          setChatWidgets(data.data);
          const current = data.data.find(
            (w) => w._id === activeWebsite.chatWidgetId,
          );
          if (current) {
            setAssignedWidget(current);
          }
        }
      } catch (err) {
        console.error("Failed to fetch widgets", err);
      }
    };
    fetchWidgets();
  }, [activeWebsite.chatWidgetId]);

  const injectChatWidgetToCanvas = (editorInstance, widget) => {
    if (!editorInstance) return;
    const doc = editorInstance.Canvas.getDocument();
    if (!doc) return;

    // Remove existing if any
    const existing = doc.getElementById("bcc-chat-widget");
    if (existing) existing.remove();
    const existingScript = doc.getElementById("bcc-chat-widget-script");
    if (existingScript) existingScript.remove();
    const existingContainer = doc.getElementById("bcc-chat-widget-container");
    if (existingContainer) existingContainer.remove();

    if (!widget) return;

    // Inject Inter font into canvas head if not already there
    if (
      !doc.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')
    ) {
      const fontLink = doc.createElement("link");
      fontLink.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap";
      fontLink.rel = "stylesheet";
      doc.head.appendChild(fontLink);
    }

    // Add Widget HTML
    const widgetHtml = getWidgetHtmlOnly(widget);
    const container = doc.createElement("div");
    container.id = "bcc-chat-widget-container";
    container.innerHTML = widgetHtml;
    doc.body.appendChild(container);

    // Add Widget Script
    const scriptEl = doc.createElement("script");
    scriptEl.id = "bcc-chat-widget-script";
    scriptEl.textContent = `
      function toggleBccChat() {
        const win = document.getElementById('bcc-chat-window');
        if (!win) return;
        if (win.style.display === 'none' || win.style.display === '') {
          win.style.display = 'block';
          setTimeout(() => {
            win.style.transform = 'translateY(0)';
            win.style.opacity = '1';
          }, 10);
        } else {
          win.style.transform = 'translateY(10px)';
          win.style.opacity = '0';
          setTimeout(() => {
            win.style.display = 'none';
          }, 300);
        }
      }

      function openLiveChatPopup() {
        document.getElementById('bcc-live-chat-panel').style.display = 'flex';
      }

      function closeLiveChatPopup() {
        document.getElementById('bcc-live-chat-panel').style.display = 'none';
      }

      function handleBccChatKey(e) {
        if (e.key === 'Enter') {
          sendBccChatMessage();
        }
      }

      function sendBccChatMessage() {
        const inp = document.getElementById('bcc-chat-input');
        const text = inp.value.trim();
        if (!text) return;
        
        inp.value = '';
        const msgs = document.getElementById('bcc-chat-messages');
        
        // User message
        const userDiv = document.createElement('div');
        userDiv.style.cssText = 'background:${widget.brandColor || "var(--accent-primary)"}; color:#fff; padding:10px 14px; border-radius:12px; max-width:85%; align-self:flex-end; line-height:1.4; font-family:"Inter",sans-serif;';
        userDiv.textContent = text;
        msgs.appendChild(userDiv);
        msgs.scrollTop = msgs.scrollHeight;

        // Mock bot reply after 1s
        setTimeout(() => {
          const botDiv = document.createElement('div');
          botDiv.style.cssText = 'background:#fff; border:1px solid #e2e8f0; padding:10px 14px; border-radius:12px; max-width:85%; align-self:flex-start; color:#1e293b; line-height:1.4; font-family:"Inter",sans-serif;';
          botDiv.textContent = "Thanks for your message! Our team will get back to you shortly.";
          msgs.appendChild(botDiv);
          msgs.scrollTop = msgs.scrollHeight;
        }, 1000);
      }
    `;
    doc.body.appendChild(scriptEl);
  };

  useEffect(() => {
    if (editor) {
      injectChatWidgetToCanvas(editor, assignedWidget);
      editor.on("load", () => {
        injectChatWidgetToCanvas(editor, assignedWidget);
      });
    }
  }, [editor, assignedWidget]);

  useEffect(() => {
    if (!saveToast) return;
    const timer = setTimeout(() => setSaveToast(null), 3000);
    return () => clearTimeout(timer);
  }, [saveToast]);

  const handleSaveWidgetAssignment = async () => {
    try {
      setSavingWidget(true);
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/websites/${activeWebsite.key || activeWebsite._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            chatWidgetId:
              selectedChatWidgetId === "none" ? null : selectedChatWidgetId,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        message.success("Chat widget assigned successfully!");
        activeWebsite.chatWidgetId =
          selectedChatWidgetId === "none" ? null : selectedChatWidgetId;
        const currentWidget = chatWidgets.find(
          (w) => w._id === selectedChatWidgetId,
        );
        setAssignedWidget(currentWidget || null);
        setIsChatModalOpen(false);
      } else {
        message.error(data.error || "Failed to save widget assignment");
      }
    } catch (err) {
      console.error(err);
      message.error("Error saving widget assignment");
    } finally {
      setSavingWidget(false);
    }
  };

  const handleSave = async () => {
    if (!editor) return;

    const html = editor.getHtml();
    const css = editor.getCss();

    try {
      setSaving(true);
      const token = localStorage.getItem("token");

      if (isPostMode) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const titleEl = doc.querySelector('[data-post-field="title"]');
        const excerptEl = doc.querySelector('[data-post-field="excerpt"]');
        const imageEl = doc.querySelector('[data-post-field="image"]');

        const title = titleEl
          ? titleEl.textContent.trim()
          : initialPostTitle;
        const excerpt = excerptEl
          ? excerptEl.textContent.trim()
          : initialPostExcerpt;
        const featuredImageUrl = imageEl
          ? imageEl.getAttribute("src") || ""
          : initialPostFeaturedImageUrl;

        let postCss = css;
        if (imageEl) {
          imageEl.style.removeProperty("max-height");
          const imageElId = imageEl.getAttribute("id");
          if (imageElId) {
            postCss = postCss.replace(
              new RegExp(`(#${imageElId}\\s*{[^}]*?)max-height\\s*:[^;]+;\\s*`, "g"),
              "$1"
            );
          }
        }

        const faqs = [];
        const faqSection = doc.querySelector('[data-post-field="faq"]');
        if (faqSection) {
          faqSection.querySelectorAll(".faq-item").forEach((item) => {
            const qEl = item.querySelector("[data-faq-question]");
            const aEl = item.querySelector("[data-faq-answer]");
            const question = qEl ? qEl.textContent.trim() : "";
            const answer = aEl ? aEl.textContent.trim() : "";
            if (question || answer) faqs.push({ question, answer });
          });
        }
        doc.querySelectorAll(".faq-item[open]").forEach((item) => {
          item.removeAttribute("open");
        });
        const finalHtml = doc.body.innerHTML;

        if (!title) {
          setSaveToast({ type: "error", text: "Add a Post Title block with some text before saving." });
          setSaving(false);
          return;
        }

        const res = await fetch(`/api/blogs/posts/${activePost._id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            html: finalHtml,
            css: postCss,
            title,
            excerpt,
            featuredImageUrl,
            faqs,
            status: postStatus,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setSaveToast({
            type: "success",
            text:
              postStatus === "published"
                ? "Blog post saved and published!"
                : "Blog post saved as draft. Switch to \"Published\" and save again to make it appear in Blog List blocks."
          });
          onSave(data.data);
        } else {
          setSaveToast({ type: "error", text: data.error || "Failed to save blog post" });
        }
        return;
      }

      if (onCustomSave) {
        await onCustomSave({ html, css, editor });
        setSaving(false);
        return;
      }

      const res = await fetch(
        `/api/websites/${activeWebsite?.key}/pages/${activePage?._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({ html, css, stylesheetUrls: stylesheetUrlsRef.current }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setSaveToast({ type: "success", text: "Page saved successfully!" });
        if (onSave) onSave(data.data);
      } else {
        setSaveToast({ type: "error", text: data.error || "Failed to save page" });
      }
    } catch (err) {
      console.error(err);
      setSaveToast({ type: "error", text: "An error occurred while saving" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`builder-container ${isPreviewing ? "is-previewing" : ""}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        background: "#ffffff",
        height: "100vh",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {saveToast && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 20px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: saveToast.type === "success" ? "#16a34a" : "#dc2626",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {saveToast.text}
        </div>
      )}

      {/* Custom Premium Top Bar */}
      {!isPreviewing && (
        <div
          style={{
            height: "60px",
            background: "#0f172a", // Deep Navy from reference
            borderBottom: "1px solid #1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Button
              type="text"
              icon={<ArrowLeft size={16} />}
              onClick={() => setEditingPage(null)}
              style={{
                color: "#cbd5e1",
                display: "flex",
                alignItems: "center",
                fontWeight: 600,
                padding: "4px 8px",
                borderRadius: 6,
              }}
            >
              Back
            </Button>
            <div
              style={{
                width: 1,
                height: 24,
                background: "rgba(255,255,255,0.1)",
              }}
            ></div>
            <div
              style={{
                fontWeight: 800,
                color: "#f8fafc",
                fontSize: 15,
                letterSpacing: 0.3,
              }}
            >
              M1 Growth platform Builder:{" "}
              <span style={{ color: "var(--accent-primary)" }}>
                {isPostMode ? activePost.title : activePage.title}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {!isPostMode && (
              <Button
                type="default"
                onClick={() => setIsChatModalOpen(true)}
                style={{
                  background: "#1e293b",
                  color: "#cbd5e1",
                  borderColor: "#334155",
                  fontWeight: 600,
                  borderRadius: 6,
                  height: 36,
                }}
              >
                Chat Widget
              </Button>
            )}
            {isPostMode && (
              <Select
                value={postStatus}
                onChange={(v) => setPostStatus(v)}
                style={{ width: 130, height: 36 }}
              >
                <Option value="draft">Draft</Option>
                <Option value="published">Published</Option>
              </Select>
            )}
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              style={{
                background: "var(--accent-primary)",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                borderRadius: 6,
                padding: "0 20px",
                height: 36,
                boxShadow: "0 2px 4px rgba(59, 130, 246, 0.3)",
              }}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}

      {/* Editor Container */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div ref={editorRef} style={{ height: "100%" }}></div>

        {/* Custom Image Panel */}
        {!isPreviewing &&
          selectedComponent &&
          selectedComponent.is("image") && (
            <CustomImagePanel
              editor={editor}
              selectedComponent={selectedComponent}
              onClose={() => editor.select(null)}
              onOpenMedia={() => setIsMediaModalOpen(true)}
            />
          )}
      </div>

      <MediaStorageModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        onSelectImage={(url) => {
          if (selectedComponent && selectedComponent.is("image")) {
            selectedComponent.addAttributes({ src: url });
          } else {
            editor.AssetManager.add(url);
          }
          setIsMediaModalOpen(false);
        }}
      />

      <Modal
        title={
          <div
            style={{
              fontWeight: 800,
              fontSize: 18,
              color: "var(--text-primary)",
            }}
          >
            Chat Widget Assignment
          </div>
        }
        open={isChatModalOpen}
        onCancel={() => setIsChatModalOpen(false)}
        footer={[
          <Button
            key="back"
            onClick={() => setIsChatModalOpen(false)}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={savingWidget}
            onClick={handleSaveWidgetAssignment}
            style={{
              background: "var(--accent-primary)",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
            }}
          >
            Save Assignment
          </Button>,
        ]}
        bodyStyle={{ padding: "24px 0 8px" }}
      >
        <div style={{ padding: "0 24px" }}>
          <div
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              marginBottom: 16,
              fontWeight: 500,
            }}
          >
            Assign a chat widget to float on all pages of this website. Visitors
            will be able to engage with the channels configured in the widget.
          </div>
          <div
            style={{
              fontWeight: 700,
              marginBottom: 8,
              fontSize: 13,
              color: "var(--text-primary)",
            }}
          >
            Select Chat Widget
          </div>
          <Select
            value={selectedChatWidgetId || "none"}
            onChange={setSelectedChatWidgetId}
            style={{ width: "100%", marginBottom: 16 }}
            size="large"
          >
            <Option value="none">— None —</Option>
            {chatWidgets.map((w) => (
              <Option key={w._id} value={w._id}>
                {w.name} {w.status === "Draft" ? "(Draft)" : ""}
              </Option>
            ))}
          </Select>
          <div
            onClick={() => {
              setIsChatModalOpen(false);
              setEditingPage(null); // Go back to website detail view
            }}
            style={{
              color: "var(--accent-info)",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Manage chat widgets in website dashboard →
          </div>
        </div>
      </Modal>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .gjs-cv-canvas {
          top: 0;
          width: 100%;
          height: 100%;
        }
        /* Make sure GrapesJS panels do not overlap our top bar incorrectly if we use default layout */
        .gjs-editor {
          height: 100% !important;
        }
      `,
        }}
      />
    </div>
  );
};

export default GrapesJSBuilder;