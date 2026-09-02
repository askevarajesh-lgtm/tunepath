import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const getWidgetScriptCode = (widget) => {
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

    <script>
      function toggleBccChat() {
        const win = document.getElementById('bcc-chat-window');
        if (!win) return;
        if (win.style.getPropertyValue('display') === 'none' || win.style.display === 'none' || win.style.display === '') {
          win.style.setProperty('display', 'block', 'important');
          setTimeout(() => {
            win.style.setProperty('transform', 'translateY(0)', 'important');
            win.style.setProperty('opacity', '1', 'important');
          }, 10);
        } else {
          win.style.setProperty('transform', 'translateY(10px)', 'important');
          win.style.setProperty('opacity', '0', 'important');
          setTimeout(() => {
            win.style.setProperty('display', 'none', 'important');
          }, 300);
        }
      }

      function openLiveChatPopup() {
        const panel = document.getElementById('bcc-live-chat-panel');
        if (panel) panel.style.setProperty('display', 'flex', 'important');
      }

      function closeLiveChatPopup() {
        const panel = document.getElementById('bcc-live-chat-panel');
        if (panel) panel.style.setProperty('display', 'none', 'important');
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
        userDiv.style.cssText = 'background:${widget.brandColor || "var(--accent-primary)"} !important; color:#ffffff !important; padding:10px 14px !important; border-radius:12px !important; max-width:85% !important; align-self:flex-end !important; line-height:1.4 !important; font-family:"Inter",sans-serif !important; box-sizing:border-box !important; text-align:left !important;';
        userDiv.textContent = text;
        msgs.appendChild(userDiv);
        msgs.scrollTop = msgs.scrollHeight;

        // Mock bot reply after 1s
        setTimeout(() => {
          const botDiv = document.createElement('div');
          botDiv.style.cssText = 'background:#ffffff !important; border:1px solid #e2e8f0 !important; padding:10px 14px !important; border-radius:12px !important; max-width:85% !important; align-self:flex-start !important; color:#1e293b !important; line-height:1.4 !important; font-family:"Inter",sans-serif !important; box-sizing:border-box !important; text-align:left !important;';
          botDiv.textContent = "Thanks for your message! Our team will get back to you shortly.";
          msgs.appendChild(botDiv);
          msgs.scrollTop = msgs.scrollHeight;
        }, 1000);
      }
    </script>
  `;
};

const WebsitePreviewView = () => {
  const { websiteId, pageId } = useParams();
  const [pageData, setPageData] = useState(null);
  const [widgetData, setWidgetData] = useState(null);
  const [websiteTheme, setWebsiteTheme] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPage = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: token ? `Bearer ${token}` : "" };
        const res = await fetch(`/api/websites/${websiteId}/public`, { headers });
        const data = await res.json();
        if (data.success && data.data && data.data.pages) {
          const page = data.data.pages.find(
            (p) => p._id === pageId || p.key === pageId || (pageId === 'home' && p.isHome) || p.path === `/${pageId}` || p.path === pageId
          );
          setPageData(page);

          // Capture the website theme for CSS variable injection
          if (data.data.theme) {
            setWebsiteTheme(data.data.theme);
          }

          if (data.data.chatWidgetId) {
            const widgetRes = await fetch(
              `/api/chat-widgets/${data.data.chatWidgetId}/public`,
            );
            const wData = await widgetRes.json();
            if (wData.success) {
              setWidgetData(wData.data);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching preview", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPage();
  }, [websiteId, pageId]);


  useEffect(() => {
    // Inject Inter font just in case
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Loading preview...
      </div>
    );
  }

  if (!pageData) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Page not found.
      </div>
    );
  }

  return (
    <iframe
      title={`Preview ${pageData.title}`}
      srcDoc={`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${pageData.title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          ${(pageData.stylesheetUrls || []).map((url) => `<link rel="stylesheet" href="${url}">`).join("\n          ")}
          <style>
            :root {
              --brand-color: ${websiteTheme?.primaryColor || '#3b82f6'};
              --site-font: '${websiteTheme?.fontFamily || 'Inter'}', sans-serif;
            }
            body { margin: 0; padding: 0; background: #fff; font-family: var(--site-font); }
            ${pageData.css || ""}
            /* Hide preloaders exactly like the builder view */
            #spinner, #preloader, .preloader, .loader-wrapper, .loader, .td-preloader-wrap {
              display: none !important;
              opacity: 0 !important;
              visibility: hidden !important;
              pointer-events: none !important;
              z-index: -9999 !important;
            }
            /* Specific Bootstrap 5 spinner overlay used in many templates */
            div.show.bg-white.position-fixed.translate-middle.w-100.vh-100 {
              display: none !important;
              opacity: 0 !important;
              visibility: hidden !important;
              pointer-events: none !important;
            }
          </style>
          ${pageData.customHeadCode || ""}
        </head>
        <body>
          ${pageData.customBodyCode || ""}
          ${pageData.html || '<div style="padding:40px;text-align:center;font-family:sans-serif;">This page is currently empty.</div>'}
          ${widgetData ? getWidgetScriptCode(widgetData) : ""}
        </body>
        </html>
      `}
      style={{
        width: "100vw",
        height: "100vh",
        border: "none",
        display: "block",
      }}
    />
  );
};

export default WebsitePreviewView;