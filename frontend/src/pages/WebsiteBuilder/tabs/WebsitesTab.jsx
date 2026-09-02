import React, { useState, useEffect } from "react";
import { Button, Input, Radio, Table, Typography, Space, Modal, Card, Select, Row, Col, Badge, Tag, Divider, Popconfirm, Dropdown, Menu, message, Spin, Pagination, Grid, Tooltip } from "antd";
import { Plus, Search, Folder, Sparkles, LayoutTemplate, Link2, Settings, FileText, Monitor, Smartphone, UploadCloud, ChevronRight, PenTool, ExternalLink, ArrowLeft, ArrowRight, Info, Activity, Trash2, ArrowUp, ArrowDown, MoreVertical, Copy, FolderInput, Share2, Edit2, Code2, Newspaper } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useActionPermissions } from "../../../hooks/useActionPermissions";
import WebsiteTemplateLibraryModal from "./WebsiteTemplateLibraryModal";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Removed basic WebsiteBuilderView in favor of GrapesJSBuilder

const CreateWebsiteModal = ({ open, onCancel, onCreate, loading, initialType = "blank" }) => {
  const [selectedType, setSelectedType] = useState(initialType);
  const [websiteName, setWebsiteName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState("Professional");

  // WordPress Specific State
  const [wpUrl, setWpUrl] = useState("");
  const [wpApiUrl, setWpApiUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpPassword, setWpPassword] = useState("");
  const [wpTesting, setWpTesting] = useState(false);
  const [wpTestSuccess, setWpTestSuccess] = useState(null);

  const handleTestWp = async () => {
    setWpTesting(true);
    setWpTestSuccess(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/wordpress/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": token ? `Bearer ${token}` : "" },
        body: JSON.stringify({ apiUrl: wpApiUrl, username: wpUsername, password: wpPassword })
      });
      const data = await res.json();
      if (data.success) {
        setWpTestSuccess(true);
        message.success("WordPress connected successfully!");
      } else {
        setWpTestSuccess(false);
        message.error(data.message || "Failed to connect to WordPress");
      }
    } catch (err) {
      setWpTestSuccess(false);
      message.error("Error connecting to WordPress API");
    } finally {
      setWpTesting(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSelectedType(initialType);
    }
  }, [open, initialType]);

  const handleCreate = () => {
    if (selectedType === "wordpress") {
      onCreate({ name: websiteName, type: selectedType, wpUrl, wpApiUrl, wpUsername, wpPassword });
    } else {
      onCreate({ name: websiteName, type: selectedType, description, industry, tone });
    }
    setWebsiteName("");
    setIndustry("");
    setDescription("");
    setSelectedType("blank");
    setWpUrl("");
    setWpApiUrl("");
    setWpUsername("");
    setWpPassword("");
    setWpTestSuccess(null);
  };

  const isFormValid = websiteName.trim().length > 0 && 
    (selectedType !== "ai" || description.trim().length > 0) &&
    (selectedType !== "wordpress" || (wpUrl && wpApiUrl && wpUsername && wpPassword && wpTestSuccess));

  const handleModalCancel = () => {
    if (loading) return;
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleModalCancel}
      footer={null}
      width={1200}
      title={<div style={{ fontSize: 24, fontWeight: 900, paddingBottom: 16, borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>Create New Website</div>}
      className="glassmorphism-modal"
      bodyStyle={{ maxHeight: "75vh", overflowY: "auto", padding: '24px 0' }}
      closeIcon={<span style={{ color: 'var(--text-secondary)' }}>✕</span>}
      closable={!loading}
      maskClosable={!loading}
    >
      <div style={{ display: "flex", gap: 24, marginBottom: 32, flexWrap: "wrap" }}>
        {/* From blank */}
        <div 
          onClick={() => setSelectedType("blank")}
          style={{
            flex: "1 1 180px",
            minWidth: 180,
            border: selectedType === "blank" ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
            background: selectedType === "blank" ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-secondary)',
            borderRadius: 16,
            padding: 24,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: selectedType === "blank" ? 'var(--shadow-md)' : 'none',
            display: 'flex',
            flexDirection: 'column'
          }}
          className="hover-shadow-md"
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>From blank</div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: selectedType === 'blank' ? '6px solid var(--accent-primary)' : '2px solid var(--border-color)', background: '#fff' }}></div>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 32, minHeight: 40, fontWeight: 500 }}>
            Design from scratch using the website builder
          </div>
          <div style={{ textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, fontWeight: 700, padding: "20px 0", background: 'var(--bg-primary)', borderRadius: 12, marginTop: 'auto', border: '1px dashed var(--border-color)' }}>
            Empty site with a home page
          </div>
        </div>

        {/* Create with AI */}
         <div 
          onClick={() => setSelectedType("ai")}
          style={{
            flex: "1 1 180px",
            minWidth: 180,
            border: selectedType === "ai" ? '2px solid var(--accent-secondary)' : '1px solid var(--border-color)',
            background: selectedType === "ai" ? 'rgba(13, 148, 136, 0.05)' : 'var(--bg-secondary)',
            borderRadius: 16,
            padding: 24,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: selectedType === "ai" ? 'var(--shadow-md)' : 'none',
            display: 'flex',
            flexDirection: 'column'
          }}
          className="hover-shadow-md"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={18} color="var(--accent-secondary)" /> AI generated</div>
              <div style={{ background: "rgba(13, 148, 136, 0.1)", color: "var(--accent-secondary)", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 12 }}>BETA</div>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: selectedType === 'ai' ? '6px solid var(--accent-secondary)' : '2px solid var(--border-color)', background: '#fff' }}></div>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, minHeight: 40, fontWeight: 500 }}>
            Generate content, layout, and images from your business brief
          </div>
          <div style={{ background: 'var(--accent-primary)', color: "#fff", padding: "16px", textAlign: "center", borderRadius: 12, fontWeight: 800, fontSize: 13, marginTop: 'auto' }}>
            Home + Contact + About pages
          </div>
        </div> 

        {/* From templates */}
        <div 
          onClick={() => setSelectedType("templates")}
          style={{
            flex: "1 1 180px",
            minWidth: 180,
            border: selectedType === "templates" ? '2px solid var(--accent-info)' : '1px solid var(--border-color)',
            background: selectedType === "templates" ? 'rgba(14, 165, 233, 0.05)' : 'var(--bg-secondary)',
            borderRadius: 16,
            padding: 24,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: selectedType === "templates" ? 'var(--shadow-md)' : 'none',
            display: 'flex',
            flexDirection: 'column'
          }}
          className="hover-shadow-md"
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}><LayoutTemplate size={18} color="var(--accent-info)" /> Templates</div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: selectedType === 'templates' ? '6px solid var(--accent-info)' : '2px solid var(--border-color)', background: '#fff' }}></div>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, minHeight: 40, fontWeight: 500 }}>
            Jump start with an awesome prebuilt website
          </div>
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", padding: "16px", textAlign: "center", borderRadius: 12, fontWeight: 800, fontSize: 15, color: "var(--text-primary)", marginTop: 'auto' }}>
            100+<br /><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Templates</span>
          </div>
        </div>

        {/* Connect WordPress */}
        <div 
          onClick={() => setSelectedType("wordpress")}
          style={{
            flex: "1 1 180px",
            minWidth: 180,
            border: selectedType === "wordpress" ? '2px solid #0073AA' : '1px solid var(--border-color)',
            background: selectedType === "wordpress" ? 'rgba(0, 115, 170, 0.05)' : 'var(--bg-secondary)',
            borderRadius: 16,
            padding: 24,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: selectedType === "wordpress" ? 'var(--shadow-md)' : 'none',
            display: 'flex',
            flexDirection: 'column'
          }}
          className="hover-shadow-md"
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}><Link2 size={18} color="#0073AA" /> WordPress</div>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: selectedType === 'wordpress' ? '6px solid #0073AA' : '2px solid var(--border-color)', background: '#fff' }}></div>
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, minHeight: 40, fontWeight: 500 }}>
            Connect to an existing WordPress site via API
          </div>
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", padding: "16px", textAlign: "center", borderRadius: 12, fontWeight: 800, fontSize: 15, color: "var(--text-primary)", marginTop: 'auto' }}>
            Manage<br /><span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Externally</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>WEBSITE NAME <span style={{ color: "var(--accent-danger)" }}>*</span></div>
        <Input 
          size="large"
          placeholder="e.g. Prestige Estates Luxury Launch" 
          value={websiteName}
          onChange={(e) => setWebsiteName(e.target.value)}
          style={{ borderRadius: 8 }} 
        />
      </div>

      {selectedType === "ai" && (
        <div style={{ border: "2px solid rgba(13, 148, 136, 0.2)", background: "rgba(13, 148, 136, 0.05)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "var(--accent-secondary)" }}>INDUSTRY</div>
            <Input 
              size="large"
              placeholder="e.g. Dental clinic, Real estate" 
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              style={{ borderRadius: 8 }} 
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "var(--accent-secondary)" }}>DESCRIBE YOUR BUSINESS <span style={{ color: "var(--accent-danger)" }}>*</span></div>
            <TextArea 
              size="large"
              placeholder="What you do, who you serve, and what visitors should do next." 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ minHeight: 120, borderRadius: 8 }} 
            />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "var(--accent-secondary)" }}>TONE</div>
            <Select size="large" value={tone} onChange={setTone} style={{ width: "100%" }}>
              <Option value="Professional">Professional</Option>
              <Option value="Friendly">Friendly</Option>
              <Option value="Energetic">Energetic</Option>
              <Option value="Luxury">Luxury</Option>
            </Select>
          </div>
        </div>
      )}

      {selectedType === "wordpress" && (
        <div style={{ border: "2px solid rgba(0, 115, 170, 0.2)", background: "rgba(0, 115, 170, 0.05)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#0073AA" }}>WEBSITE URL <span style={{ color: "var(--accent-danger)" }}>*</span></div>
            <Input size="large" placeholder="https://mywordpress.com" value={wpUrl} onChange={(e) => setWpUrl(e.target.value)} style={{ borderRadius: 8 }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#0073AA" }}>WORDPRESS API URL <span style={{ color: "var(--accent-danger)" }}>*</span></div>
            <Input size="large" placeholder="https://mywordpress.com/wp-json" value={wpApiUrl} onChange={(e) => setWpApiUrl(e.target.value)} style={{ borderRadius: 8 }} />
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#0073AA" }}>WP USERNAME <span style={{ color: "var(--accent-danger)" }}>*</span></div>
                <Input size="large" placeholder="admin" value={wpUsername} onChange={(e) => setWpUsername(e.target.value)} style={{ borderRadius: 8 }} />
              </div>
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#0073AA" }}>APPLICATION PASSWORD <span style={{ color: "var(--accent-danger)" }}>*</span></div>
                <Input.Password size="large" placeholder="abcd efgh ijkl mnop" value={wpPassword} onChange={(e) => setWpPassword(e.target.value)} style={{ borderRadius: 8 }} />
              </div>
            </Col>
          </Row>
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 16 }}>
            <Button size="large" onClick={handleTestWp} loading={wpTesting} disabled={!wpApiUrl || !wpUsername || !wpPassword} style={{ background: '#0073AA', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700 }}>
              Test Connection
            </Button>
            {wpTestSuccess === true && <Badge status="success" text={<span style={{ fontWeight: 700, color: 'var(--accent-success)' }}>Connection Successful</span>} />}
            {wpTestSuccess === false && <Badge status="error" text={<span style={{ fontWeight: 700, color: 'var(--accent-danger)' }}>Connection Failed</span>} />}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-color)' }}>
        <Button size="large" onClick={onCancel} style={{ borderRadius: 8, fontWeight: 700, padding: "0 32px", borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>Cancel</Button>
        <Button 
          size="large"
          type="primary" 
          onClick={handleCreate}
          disabled={!isFormValid || loading}
          loading={loading && selectedType === "ai"}
          style={{ 
            background: selectedType === "ai" ? "var(--accent-secondary)" : (selectedType === "templates" ? "var(--accent-info)" : (selectedType === "wordpress" ? "#0073AA" : "var(--accent-primary)")), 
            border: "none", 
            borderRadius: 8, fontWeight: 800, padding: "0 32px" 
          }}
        >
          {loading && selectedType === "ai" ? "Generating Website..." : (selectedType === "ai" ? "Generate Website with AI" : (selectedType === "templates" ? "Browse Templates" : (selectedType === "wordpress" ? "Connect WordPress" : "Create Empty Site")))}
        </Button>
      </div>
    </Modal>
  );
};

const ManageWebsiteView = ({ activeWebsite, setView, itemVariants, role }) => {
  const { canAdd, canEdit, canDelete } = useActionPermissions('/website');
  const screens = Grid.useBreakpoint();
  const hideText = !screens.xl; // hide text on smaller screens to save horizontal space

  const [pages, setPages] = useState(activeWebsite.pages || []);
  const [pagesCurrentPage, setPagesCurrentPage] = useState(1);
  const pagesPageSize = 10;

  // AI Edit Modal State
  const [isAiEditModalOpen, setIsAiEditModalOpen] = useState(false);
  const [aiEditContextPage, setAiEditContextPage] = useState(null);
  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const [isAiEditing, setIsAiEditing] = useState(false);

  const handleAiEdit = async () => {
    if (!aiEditPrompt.trim()) return;
    setIsAiEditing(true);
    try {
      const token = localStorage.getItem("token");
      const payload = { prompt: aiEditPrompt };
      if (aiEditContextPage) {
        payload.pageId = aiEditContextPage._id || aiEditContextPage.key;
        payload.pageSlug = aiEditContextPage.path;
      }
      
      const res = await fetch(`/api/websites/${activeWebsite.key}/ai-edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        message.success("AI changes applied successfully.");
        // Refresh website details
        const refreshRes = await fetch(`/api/websites/${activeWebsite.key}`, {
          headers: { "Authorization": token ? `Bearer ${token}` : "" }
        });
        const refreshData = await refreshRes.json();
        if (refreshData.success) {
          activeWebsite.theme = refreshData.data.theme;
          setFontFamily(activeWebsite.theme?.fontFamily || "Inter");
          setPrimaryColor(activeWebsite.theme?.primaryColor || "var(--accent-primary)");
          setPages(refreshData.data.pages || []);
        }
        setIsAiEditModalOpen(false);
        setAiEditPrompt("");
      } else {
        message.error(data.error || "Failed to apply AI edits.");
      }
    } catch (err) {
      console.error(err);
      message.error("Error applying AI edits.");
    } finally {
      setIsAiEditing(false);
    }
  };


  // Blog AI Edit Modal State
  const [isBlogAiEditModalOpen, setIsBlogAiEditModalOpen] = useState(false);
  const [blogAiEditTarget, setBlogAiEditTarget] = useState(null);
  const [blogAiEditPrompt, setBlogAiEditPrompt] = useState("");
  const [isBlogAiEditing, setIsBlogAiEditing] = useState(false);

  const handleBlogAiEdit = async () => {
    if (!blogAiEditPrompt.trim() || !blogAiEditTarget) return;
    setIsBlogAiEditing(true);
    try {
      const token = localStorage.getItem("token");
      const { blogId, postId } = blogAiEditTarget;
      
      const res = await fetch(`/api/blogs/${blogId}/posts/${postId}/ai-edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ prompt: blogAiEditPrompt })
      });
      const data = await res.json();
      if (data.success) {
        message.success("Blog page updated successfully.");
        setIsBlogAiEditModalOpen(false);
        setBlogAiEditPrompt("");
        // Reload blogs
        const headers = { "Authorization": token ? `Bearer ${token}` : "" };
        const blogsRes = await fetch(`/api/blogs?websiteId=${activeWebsite.key}`, { headers });
        const blogsData = await blogsRes.json();
        if (blogsData.success) {
          const blogsList = blogsData.data || [];
          const blogsWithPosts = await Promise.all(blogsList.map(async (b) => {
            try {
              const postsRes = await fetch(`/api/blogs/${b._id}/posts`, { headers });
              const postsData = await postsRes.json();
              return { ...b, postsList: postsData.success ? (postsData.data || []) : [] };
            } catch (err) {
              return { ...b, postsList: [] };
            }
          }));
          setWebsiteBlogs(blogsWithPosts);
        }
      } else {
        message.error(data.error || "Failed to apply AI edits.");
      }
    } catch (err) {
      console.error(err);
      message.error("Error applying AI edits.");
    } finally {
      setIsBlogAiEditing(false);
    }
  };
  const [newPageTitle, setNewPageTitle] = useState("");
  const [websiteName, setWebsiteName] = useState(activeWebsite.name || "");
  const [description, setDescription] = useState(activeWebsite.description || "");
  const [status, setStatus] = useState(activeWebsite.status || "Draft");
  const [faviconUrl, setFaviconUrl] = useState(activeWebsite.faviconUrl || "");
  const [fontFamily, setFontFamily] = useState(activeWebsite.theme?.fontFamily || "Inter");
  const [primaryColor, setPrimaryColor] = useState(activeWebsite.theme?.primaryColor || "var(--accent-primary)");
  const [syncingTheme, setSyncingTheme] = useState(false);
  const [chatWidgets, setChatWidgets] = useState([]);
  const [selectedChatWidgetId, setSelectedChatWidgetId] = useState(activeWebsite.chatWidgetId || "none");
  const [savingWidget, setSavingWidget] = useState(false);
  const [websiteBlogs, setWebsiteBlogs] = useState([]);
  const [loadingBlogs, setLoadingBlogs] = useState(true);
  const [contentView, setContentView] = useState("pages");
  const [scriptModalPageId, setScriptModalPageId] = useState(null);
  const [headCodeInput, setHeadCodeInput] = useState("");
  const [bodyCodeInput, setBodyCodeInput] = useState("");
  const [savingScript, setSavingScript] = useState(false);
  const [isConnectDomainModalOpen, setIsConnectDomainModalOpen] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [connectingDomain, setConnectingDomain] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchWidgets = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/chat-widgets", {
          headers: { "Authorization": token ? `Bearer ${token}` : "" }
        });
        const data = await res.json();
        if (data.success) {
          setChatWidgets(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch widgets", err);
      }
    };
    fetchWidgets();
  }, []);

  useEffect(() => {
    const fetchWebsiteBlogs = async () => {
      try {
        setLoadingBlogs(true);
        const token = localStorage.getItem("token");
        const headers = { "Authorization": token ? `Bearer ${token}` : "" };
        const res = await fetch(`/api/blogs?websiteId=${activeWebsite.key}`, { headers });
        const data = await res.json();
        if (data.success) {
          const blogsList = data.data || [];
          const blogsWithPosts = await Promise.all(blogsList.map(async (blog) => {
            try {
              const postsRes = await fetch(`/api/blogs/${blog._id}/posts`, { headers });
              const postsData = await postsRes.json();
              return { ...blog, postsList: postsData.success ? (postsData.data || []) : [] };
            } catch (err) {
              return { ...blog, postsList: [] };
            }
          }));
          setWebsiteBlogs(blogsWithPosts);
        }
      } catch (err) {
        console.error("Failed to fetch blogs for website", err);
      } finally {
        setLoadingBlogs(false);
      }
    };
    fetchWebsiteBlogs();
  }, [activeWebsite.key]);

  const handleManageBlogs = () => {
    const match = location.pathname.match(/^(.*?\/website)(?=\/|$)/);
    const basePath = match ? match[0] : '/workspace/website';
    navigate(`${basePath}/blogs`);
  };

  const handleSaveWidgetAssignment = async () => {
    try {
      setSavingWidget(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/websites/${activeWebsite.key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ chatWidgetId: selectedChatWidgetId === "none" ? null : selectedChatWidgetId })
      });
      const data = await res.json();
      if (data.success) {
        message.success("Chat widget assigned successfully!");
        activeWebsite.chatWidgetId = selectedChatWidgetId === "none" ? null : selectedChatWidgetId;
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

  const handleCreateNewChatWidgetClick = () => {
    const match = location.pathname.match(/^(.*?\/website)(?=\/|$)/);
    const basePath = match ? match[0] : '/workspace/website';
    navigate(`${basePath}/chat-widgets`);
  };

  const [addingPage, setAddingPage] = useState(false);

  // Previously this only pushed a client-side `temp-<timestamp>` page into
  // local state; it was never persisted to the backend until the unrelated
  // "Save Changes" button was clicked. That's why a newly-added page
  // vanished on refresh, and why "Edit in Builder" 404'd immediately after
  // adding one — the builder route fetches the page by _id from the server,
  // and that temp id never existed there. Now it's created via the real
  // addPage endpoint right away, so the returned page has a real _id from
  // the first click.
  const handleAddPage = async () => {
    if (!newPageTitle.trim() || addingPage) return;
    const path = `/${newPageTitle.toLowerCase().replace(/\s+/g, "-")}`;
    setAddingPage(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/websites/${activeWebsite.key}/pages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ title: newPageTitle, path })
      });
      const data = await res.json();
      if (data.success) {
        setPages(prev => [...prev, data.data]);
        setNewPageTitle("");
      } else {
        message.error(data.error || "Failed to add page");
      }
    } catch (err) {
      console.error(err);
      message.error("Error adding page");
    } finally {
      setAddingPage(false);
    }
  };

  // Same fix as handleAddPage: duplicate immediately via the backend's own
  // duplicatePage endpoint (which already copies html/css/layoutJson) rather
  // than stashing an unsaved temp copy in local state.
  const handleDuplicatePage = async (pageId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/websites/${activeWebsite.key}/pages/${pageId}/duplicate`, {
        method: "POST",
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setPages(prev => [...prev, data.data]);
      } else {
        message.error(data.error || "Failed to duplicate page");
      }
    } catch (err) {
      console.error(err);
      message.error("Error duplicating page");
    }
  };

  // Delete immediately too, for the same reason — leaving this as a local-only
  // change meant a deleted page would silently reappear on refresh since it
  // was never actually removed server-side.
  const handleDeletePage = async (pageId) => {
    const previousPages = pages;
    setPages(pages.filter(p => (p._id !== pageId && p.key !== pageId)));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/websites/${activeWebsite.key}/pages/${pageId}`, {
        method: "DELETE",
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (!data.success) {
        message.error(data.error || "Failed to delete page");
        setPages(previousPages);
      }
    } catch (err) {
      console.error(err);
      message.error("Error deleting page");
      setPages(previousPages);
    }
  };


  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const handleFaviconUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      message.error("File size must be less than 1MB");
      return;
    }

    setUploadingFavicon(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: formData
      });
      const data = await res.json();
      const uploadedUrl = data.url || (data.data && data.data.url);
      if (data.success && uploadedUrl) {
        setFaviconUrl(uploadedUrl);
        message.success("Favicon uploaded successfully");
      } else {
        message.error(data.error || "Failed to upload favicon");
      }
    } catch (error) {
      console.error(error);
      message.error("Error uploading favicon");
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleConnectDomain = async () => {
    if (!customDomain) {
      message.error("Please enter a domain");
      return;
    }
    
    if (customDomain.includes("tunepath.askeva.io") || customDomain.includes("m1.workforce.themilabs.com")) {
      message.error("That hostname is reserved for this application.");
      return;
    }

    try {
      setConnectingDomain(true);
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          customDomain,
          propertyType: "Website",
          property: activeWebsite._id || activeWebsite.key
        })
      });
      const data = await res.json();
      if (data.success) {
        message.success("Domain connected! Please go to Domains tab to verify DNS.");
        setIsConnectDomainModalOpen(false);
        setCustomDomain("");
      } else {
        message.error(data.error || "Failed to connect domain");
      }
    } catch (error) {
      message.error("Error connecting domain");
    } finally {
      setConnectingDomain(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/websites/${activeWebsite.key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ name: websiteName, description, status, faviconUrl, pages, theme: { fontFamily, primaryColor } })
      });
      const data = await res.json();
      if (data.success) {
        message.success("Changes saved successfully!");
        activeWebsite.theme = { fontFamily, primaryColor };
        activeWebsite.faviconUrl = faviconUrl;
        // Update local activeWebsite to reflect new saved pages (backend returns updated pages)
        if (data.data && data.data.pages) {
           setPages(data.data.pages);
        }
      } else {
        message.error(data.error || "Failed to save changes");
      }
    } catch (err) {
      console.error(err);
      message.error("Error saving changes");
    }
  };

  const handleSyncTheme = async () => {
    try {
      setSyncingTheme(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/websites/${activeWebsite.key}/sync-theme`, {
        method: "POST",
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        if (data.data?.theme) {
          setFontFamily(data.data.theme.fontFamily);
          setPrimaryColor(data.data.theme.primaryColor);
          activeWebsite.theme = data.data.theme;
        }
        message.success(data.message || "Theme synced from site pages");
      } else {
        message.error(data.error || "Failed to sync theme");
      }
    } catch (err) {
      console.error(err);
      message.error("Error syncing theme");
    } finally {
      setSyncingTheme(false);
    }
  };

  const handleSavePage = (updatedPage) => {
    setPages(pages.map(p => p._id === updatedPage._id ? updatedPage : p));
  };

  const handleOpenScriptModal = (page) => {
    setScriptModalPageId(page._id || page.key);
    setHeadCodeInput(page.customHeadCode || "");
    setBodyCodeInput(page.customBodyCode || "");
  };

  const handleCloseScriptModal = () => {
    setScriptModalPageId(null);
    setHeadCodeInput("");
    setBodyCodeInput("");
  };

  const handleSaveScript = async () => {
    const pageId = scriptModalPageId;
    setPages(pages.map(p => (p._id === pageId || p.key === pageId)
      ? { ...p, customHeadCode: headCodeInput, customBodyCode: bodyCodeInput }
      : p));

    // Persist immediately for pages that already exist on the server
    if (pageId && !pageId.toString().startsWith('temp-')) {
      try {
        setSavingScript(true);
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/websites/${activeWebsite.key}/pages/${pageId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({ customHeadCode: headCodeInput, customBodyCode: bodyCodeInput })
        });
        const data = await res.json();
        if (data.success) {
          message.success("Custom code saved for this page!");
        } else {
          message.error(data.error || "Failed to save custom code");
        }
      } catch (err) {
        console.error(err);
        message.error("Error saving custom code");
      } finally {
        setSavingScript(false);
      }
    } else {
      message.success("Custom code added. Click \"Save Changes\" to persist this page.");
    }

    handleCloseScriptModal();
  };

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }} onClick={() => {
        const basePath = location.pathname.substring(0, location.pathname.indexOf('/websites') + 9);
        navigate(basePath);
      }}>
        <ArrowLeft size={16} /> Back to Websites
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 900 }}>{websiteName}</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Manage pages, settings, and tracking for this website.</Text>
        </div>
        {canEdit && (
          <Button 
            size="large" 
            type="primary" 
            icon={<Sparkles size={16} />} 
            onClick={() => {
              setAiEditContextPage(null);
              setAiEditPrompt("");
              setIsAiEditModalOpen(true);
            }} 
            style={{ background: "var(--accent-secondary)", border: "none", borderRadius: 8, fontWeight: 800, padding: "0 24px" }}
          >
            ✨ AI Edit Website
          </Button>
        )}
      </div>

      <div>
        
        {activeWebsite.isNew && (
          <div style={{ marginBottom: 32, padding: "16px 24px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 12, color: "var(--accent-success)", fontWeight: 600, fontSize: 14 }}>
            Website created successfully.
          </div>
        )}

        <Row gutter={32}>
          {/* Left Sidebar */}
          <Col span={8}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              
              <Card bodyStyle={{ padding: 32 }} style={{ borderRadius: 24, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>WEBSITE NAME</div>
                  <Input size="large" value={websiteName} onChange={e => setWebsiteName(e.target.value)} style={{ borderRadius: 8 }} disabled={!canEdit} />
                </div>
                
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>DESCRIPTION</div>
                  <TextArea size="large" value={description} onChange={e => setDescription(e.target.value)} style={{ borderRadius: 8, minHeight: 80 }} disabled={!canEdit} />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>STATUS</div>
                  <Select size="large" value={status} onChange={setStatus} style={{ width: "100%" }} disabled={!canEdit}>
                    <Option value="Draft">Draft</Option>
                    <Option value="Published">Published</Option>
                  </Select>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>FAVICON URL</div>
                  <Input size="large" placeholder="https://example.com/favicon.png" style={{ borderRadius: 8 }} disabled={!canEdit} value={faviconUrl} onChange={e => setFaviconUrl(e.target.value)} />
                </div>

                {canEdit && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>UPLOAD FAVICON</div>
                    <div style={{ border: "1px dashed var(--border-color)", borderRadius: 12, padding: "16px", textAlign: 'center', background: "var(--bg-primary)" }}>
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/x-icon, image/svg+xml" 
                        style={{ display: 'none' }} 
                        id="favicon-upload" 
                        onChange={handleFaviconUpload}
                      />
                      <Button size="middle" loading={uploadingFavicon} onClick={() => document.getElementById('favicon-upload').click()} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontWeight: 600, marginBottom: 8 }}>Choose File</Button>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>Max 1MB. Recommended 32x32px.</div>
                    </div>
                  </div>
                )}

                {/* Website Theme */}
                <div style={{ border: "1px solid var(--border-color)", borderRadius: 16, padding: 24, marginBottom: 32, background: "var(--bg-primary)" }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><PenTool size={16} color="var(--accent-primary)"/> Theme</div>
                    {canEdit && (
                      <Button size="small" loading={syncingTheme} onClick={handleSyncTheme} style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
                        Sync from pages
                      </Button>
                    )}
                  </div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 20, fontWeight: 500 }}>Default font and brand color used across this site — including embedded blocks like blogs, so they match the rest of the site instead of falling back to generic defaults. If this site was created from a template, use "Sync from pages" to detect its actual font/color.</div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 6 }}>SITE FONT</div>
                    <Select size="middle" value={fontFamily} onChange={setFontFamily} style={{ width: "100%" }} disabled={!canEdit}>
                      <Option value="Inter">Inter</Option>
                      <Option value="Poppins">Poppins</Option>
                      <Option value="Roboto">Roboto</Option>
                      <Option value="Lato">Lato</Option>
                      <Option value="Playfair Display">Playfair Display</Option>
                      <Option value="Montserrat">Montserrat</Option>
                    </Select>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 6 }}>BRAND COLOR</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={e => setPrimaryColor(e.target.value)}
                        disabled={!canEdit}
                        style={{ width: 40, height: 32, padding: 0, border: '1px solid var(--border-color)', borderRadius: 6, background: 'none', cursor: !canEdit ? 'not-allowed' : 'pointer' }}
                      />
                      <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} style={{ borderRadius: 6, fontSize: 13 }} disabled={!canEdit} />
                    </div>
                  </div>
                </div>

                {/* Tracking Pixels */}
                <div style={{ border: "1px solid var(--border-color)", borderRadius: 16, padding: 24, marginBottom: 32, background: "var(--bg-primary)" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} color="var(--accent-primary)"/> Tracking pixels</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 20, fontWeight: 500 }}>Injected on every public page for this website.</div>
                  
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={12}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 6 }}>META (FB) PIXEL</div>
                      <Input placeholder="123456789012345" style={{ borderRadius: 6, fontSize: 13 }} disabled={!canEdit} />
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 6 }}>GA4 ID</div>
                      <Input placeholder="G-XXXXXXXXXX" style={{ borderRadius: 6, fontSize: 13 }} disabled={!canEdit} />
                    </Col>
                  </Row>

                  <Row gutter={16} style={{ marginBottom: 24 }}>
                    <Col span={12}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 6 }}>GTM ID</div>
                      <Input placeholder="GTM-XXXXXXX" style={{ borderRadius: 6, fontSize: 13 }} disabled={!canEdit} />
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 6 }}>TIKTOK PIXEL</div>
                      <Input placeholder="CXX000000000000X" style={{ borderRadius: 6, fontSize: 13 }} disabled={!canEdit} />
                    </Col>
                  </Row>
                </div>

                {canEdit && (
                  <>
                    <Button type="primary" size="large" onClick={handleSaveSettings} block style={{ background: "var(--accent-primary)", border: "none", borderRadius: 12, fontWeight: 800, height: 48, marginBottom: 16, boxShadow: 'var(--shadow-md)' }}>
                      Save Changes
                    </Button>
                    
                    <Row gutter={16}>
                      <Col span={12}>
                        <Button type="primary" size="large" onClick={() => { setStatus("Published"); handleSaveSettings(); }} block style={{ background: "var(--accent-success)", border: "none", borderRadius: 12, fontWeight: 700, height: 48 }}>
                          Publish
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button type="primary" size="large" onClick={() => { setStatus("Draft"); handleSaveSettings(); }} block style={{ background: "var(--accent-warning)", border: "none", borderRadius: 12, fontWeight: 700, height: 48, color: '#fff' }}>
                          Revert to Draft
                        </Button>
                      </Col>
                    </Row>
                  </>
                )}
              </Card>

              <Card bodyStyle={{ padding: 24 }} style={{ borderRadius: 24, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 15, color: 'var(--text-primary)' }}>Chat widget</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16, fontWeight: 500 }}>
                  Assign a published chat widget to this property. It also appears in the page builder under Chat.
                </div>
                <Select 
                  size="large" 
                  value={selectedChatWidgetId || "none"} 
                  onChange={setSelectedChatWidgetId}
                  style={{ width: "100%", marginBottom: 16 }} 
                  disabled={!canEdit}
                >
                  <Option value="none">— None —</Option>
                  {chatWidgets.filter(w => w.status !== 'Draft').map(w => (
                    <Option key={w._id} value={w._id}>
                      {w.name}
                    </Option>
                  ))}
                </Select>
                {canEdit && (
                  <>
                    <Button 
                      size="large" 
                      type="primary" 
                      block 
                      loading={savingWidget}
                      onClick={handleSaveWidgetAssignment}
                      style={{ background: "var(--accent-info)", border: "none", borderRadius: 12, fontWeight: 700, height: 48, marginBottom: 16 }}
                    >
                      Save Widget Assignment
                    </Button>
                    <div 
                      onClick={handleCreateNewChatWidgetClick}
                      style={{ textAlign: "center", color: "var(--accent-info)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >
                      + Create new chat widget
                    </div>
                  </>
                )}
              </Card>

              <Card bodyStyle={{ padding: 24 }} style={{ borderRadius: 24, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 15, color: 'var(--text-primary)' }}>Custom domain</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16, fontWeight: 500 }}>
                  Connect a domain so visitors reach this property without /shop/ or /p/ paths.
                </div>
                {canEdit && (
                  <Button size="large" type="primary" block onClick={() => setIsConnectDomainModalOpen(true)} style={{ background: "var(--accent-primary)", border: "none", borderRadius: 12, fontWeight: 700, height: 48 }}>
                    Connect Domain
                  </Button>
                )}
              </Card>

            </div>
          </Col>

          {/* Right Area */}
          <Col span={16}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              
              <div style={{ padding: "20px 24px", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 16, fontSize: 14, fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Info size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>Header and footer are synced from your home page. Other pages use them automatically in the builder and when published.</div>
              </div>

              <Card bodyStyle={{ padding: 32 }} style={{ borderRadius: 24, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 24, background: 'var(--bg-primary)', padding: 4, borderRadius: 12, border: '1px solid var(--border-color)', width: 'fit-content' }}>
                  <div
                    onClick={() => setContentView("pages")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      padding: '10px 20px', borderRadius: 8, fontWeight: 800, fontSize: 14,
                      background: contentView === 'pages' ? 'var(--bg-secondary)' : 'transparent',
                      color: contentView === 'pages' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: contentView === 'pages' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <FileText size={16} /> Pages <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>{pages.length}</span>
                  </div>
                  <div
                    onClick={() => setContentView("blogs")}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      padding: '10px 20px', borderRadius: 8, fontWeight: 800, fontSize: 14,
                      background: contentView === 'blogs' ? 'var(--bg-secondary)' : 'transparent',
                      color: contentView === 'blogs' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: contentView === 'blogs' ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Newspaper size={16} /> Blogs <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>{websiteBlogs.length}</span>
                  </div>
                </div>

                {contentView === "pages" ? (
                  <>
                    <div style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 32, fontWeight: 500 }}>Home page sets global header & footer for all other pages.</div>

                    {canAdd && (
                      <div style={{ display: "flex", gap: 16, marginBottom: 40, background: 'var(--bg-primary)', padding: 16, borderRadius: 16, border: '1px solid var(--border-color)' }}>
                        <Input size="large" placeholder="New page title (e.g. Services)" value={newPageTitle} onChange={e => setNewPageTitle(e.target.value)} onPressEnter={handleAddPage} style={{ flex: 1, borderRadius: 8 }} />
                        <Button size="large" type="primary" loading={addingPage} onClick={handleAddPage} style={{ background: "var(--text-primary)", border: "none", borderRadius: 8, fontWeight: 800, padding: "0 32px" }}>
                          Add Page
                        </Button>
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {(() => {
                        const displayedPages = pages.slice((pagesCurrentPage - 1) * pagesPageSize, pagesCurrentPage * pagesPageSize);
                        return displayedPages.map((page, index) => (
                          <div key={page._id || page.key || index} style={{ borderBottom: index < displayedPages.length - 1 ? "1px solid var(--border-color)" : "none", paddingBottom: 24, marginBottom: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: page.isHome ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary)', border: page.isHome ? 'none' : '1px solid var(--border-color)', color: page.isHome ? 'var(--accent-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <FileText size={24} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 10, color: 'var(--text-primary)' }}>
                                    {page.title}
                                    {page.isHome && <Tag style={{ margin: 0, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', border: 'none', fontWeight: 800, borderRadius: 6, fontSize: 10 }}>HOME</Tag>}
                                  </div>
                                  <div style={{ color: "var(--text-tertiary)", fontSize: 13, fontWeight: 500 }}>{page.path}</div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                {canEdit && (
                                  <Tooltip title="Edit in Builder">
                                    <Button type="primary" style={{ background: "var(--accent-primary)", border: "none", borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} icon={<PenTool size={18} />} onClick={() => {
                                      const match = location.pathname.match(/^(.*?\/website)(?=\/|$)/);
                                      const basePath = match ? match[0] : '/workspace/website';
                                      navigate(`${basePath}/${activeWebsite.key}/pages/${page._id}/edit`);
                                    }} />
                                  </Tooltip>
                                )}
                                <Tooltip title="Preview">
                                  <Button style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: 'var(--text-primary)', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} icon={<Monitor size={18} />} onClick={() => window.open(`/preview/website/${activeWebsite.key}/page/${page._id || page.key}`, '_blank')} />
                                </Tooltip>
                                {canEdit && (
                                  <Tooltip title="AI Edit">
                                    <Button 
                                      style={{ background: "rgba(13, 148, 136, 0.1)", borderColor: "transparent", color: 'var(--accent-secondary)', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                                      icon={<Sparkles size={18} />} 
                                      onClick={() => {
                                        setAiEditContextPage(page);
                                        setAiEditPrompt("");
                                        setIsAiEditModalOpen(true);
                                      }}
                                    />
                                  </Tooltip>
                                )}
                                {canAdd && (
                                  <Tooltip title="Duplicate">
                                    <Button style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: 'var(--text-primary)', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} icon={<Copy size={18} />} onClick={() => handleDuplicatePage(page._id)} />
                                  </Tooltip>
                                )}
                                {canEdit && (
                                  <Tooltip title="Script">
                                    <Button style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: 'var(--text-primary)', borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} icon={<Code2 size={18} />} onClick={() => handleOpenScriptModal(page)} />
                                  </Tooltip>
                                )}
                                {(canDelete && !page.isHome) && (
                                  <Tooltip title="Delete">
                                    <Button danger style={{ background: "rgba(239, 68, 68, 0.1)", border: "none", color: "var(--accent-danger)", borderRadius: 12, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} icon={<Trash2 size={18} />} onClick={() => handleDeletePage(page._id)} />
                                  </Tooltip>
                                )}
                                <Select
                                  size="large"
                                  value={page.status || "Draft"}
                                  onChange={(val) => {
                                    setPages(pages.map(p => (p._id === page._id || p.key === page._id) ? { ...p, status: val } : p));
                                  }}
                                  style={{ width: 120 }}
                                  disabled={!canEdit}
                                >
                                  <Option value="Draft">Draft</Option>
                                  <Option value="Published">Published</Option>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                    {pages.length > pagesPageSize && (
                      <Pagination
                        current={pagesCurrentPage}
                        total={pages.length}
                        pageSize={pagesPageSize}
                        onChange={(page) => setPagesCurrentPage(page)}
                        style={{ textAlign: 'center', marginTop: 24 }}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 32, fontWeight: 500 }}>Blogs linked to this website only.</div>

                    {loadingBlogs ? (
                      <div style={{ padding: '24px 0', textAlign: 'center' }}>
                        <Spin />
                      </div>
                    ) : websiteBlogs.length === 0 ? (
                      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14, fontWeight: 500 }}>
                        No blogs are linked to this website yet.
                        {canAdd && (
                          <div style={{ marginTop: 16 }}>
                            <Button type="primary" onClick={handleManageBlogs} style={{ background: "var(--text-primary)", border: "none", borderRadius: 8, fontWeight: 800, padding: "0 24px" }}>
                              Create a Blog
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        {websiteBlogs.map((blog, index) => (
                          <div key={blog._id || index} style={{ borderBottom: index < websiteBlogs.length - 1 ? "1px solid var(--border-color)" : "none", paddingBottom: 24, marginBottom: 24 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: (blog.postsList && blog.postsList.length > 0) ? 20 : 0 }}>
                              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Newspaper size={24} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 10, color: 'var(--text-primary)' }}>
                                    {blog.name}
                                    <Tag style={{ margin: 0, background: blog.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-primary)', color: blog.status === 'active' ? 'var(--accent-success)' : 'var(--text-tertiary)', border: 'none', fontWeight: 800, borderRadius: 6, fontSize: 10, textTransform: 'uppercase' }}>{blog.status || 'inactive'}</Tag>
                                  </div>
                                  <div style={{ color: "var(--text-tertiary)", fontSize: 13, fontWeight: 500 }}>{(blog.postsList ? blog.postsList.length : (blog.posts || 0))} posts &middot; {blog.publicUrl || `/blog/${blog.slug}`}</div>
                                </div>
                              </div>
                              <Button style={{ background: "var(--bg-primary)", borderColor: "var(--border-color)", color: 'var(--text-primary)', borderRadius: 8, fontWeight: 600, padding: "0 20px" }} onClick={handleManageBlogs}>
                                Manage
                              </Button>
                            </div>

                            {blog.postsList && blog.postsList.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 64 }}>
                                {blog.postsList.map((post) => (
                                  <div key={post._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <FileText size={16} color="var(--text-secondary)" />
                                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{post.title}</span>
                                      <Tag style={{ margin: 0, background: post.status === 'published' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)', color: post.status === 'published' ? 'var(--accent-success)' : 'var(--text-tertiary)', border: 'none', fontWeight: 800, borderRadius: 6, fontSize: 10, textTransform: 'uppercase' }}>{post.status || 'draft'}</Tag>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                      {canEdit && (
                                        <>
                                          <Tooltip title="Edit in Builder">
                                            <Button
                                              size="small"
                                              type="primary"
                                              icon={<PenTool size={16} />}
                                              style={{ background: "var(--accent-primary)", border: "none", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
                                              onClick={() => {
                                                const match = location.pathname.match(/^(.*?\/website)(?=\/|$)/);
                                                const basePath = match ? match[0] : '/workspace/website';
                                                navigate(`${basePath}/${activeWebsite.key}/blogs/${blog._id}/posts/${post._id}/edit`);
                                              }}
                                            />
                                          </Tooltip>
                                          <Tooltip title="✨ AI Edit">
                                            <Button
                                              size="small"
                                              type="primary"
                                              icon={<Sparkles size={16} />}
                                              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', border: "none", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
                                              onClick={() => {
                                                setBlogAiEditTarget({ blogId: blog._id, postId: post._id });
                                                setIsBlogAiEditModalOpen(true);
                                              }}
                                            />
                                          </Tooltip>
                                        </>
                                      )}
                                      <Tooltip title="Preview">
                                        <Button
                                          size="small"
                                          icon={<Monitor size={16} />}
                                          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-color)", color: 'var(--text-primary)', borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
                                          onClick={() => window.open(`/preview/website/${activeWebsite.key}/blog-post/${post._id}`, '_blank')}
                                        />
                                      </Tooltip>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>

            </div>
          </Col>
        </Row>
      </div>

      <Modal
        open={!!scriptModalPageId}
        onCancel={handleCloseScriptModal}
        footer={null}
        width={640}
        title={<div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Code2 size={18} color="var(--accent-primary)" /> Custom Code</div>}
        className="glassmorphism-modal"
      >
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, fontWeight: 500 }}>
          Add custom code for this page only. Head code is injected inside &lt;head&gt;&lt;/head&gt;, body code is injected inside &lt;body&gt;&lt;/body&gt; when the page renders.
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 6 }}>CUSTOM HEAD CODE</div>
          <TextArea
            placeholder="<script>...</script> placed before </head>"
            value={headCodeInput}
            onChange={(e) => setHeadCodeInput(e.target.value)}
            style={{ borderRadius: 6, minHeight: 100, fontFamily: "monospace", fontSize: 12 }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 6 }}>CUSTOM BODY CODE</div>
          <TextArea
            placeholder="<noscript>...</noscript> placed inside <body>"
            value={bodyCodeInput}
            onChange={(e) => setBodyCodeInput(e.target.value)}
            style={{ borderRadius: 6, minHeight: 100, fontFamily: "monospace", fontSize: 12 }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Button size="large" onClick={handleCloseScriptModal} style={{ borderRadius: 8, fontWeight: 700, borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>Cancel</Button>
          <Button size="large" type="primary" loading={savingScript} onClick={handleSaveScript} style={{ background: "var(--accent-primary)", border: "none", borderRadius: 8, fontWeight: 800 }}>Save Code</Button>
        </div>
      </Modal>

      {/* Blog AI Edit Modal */}
      <Modal
        open={isBlogAiEditModalOpen}
        onCancel={() => !isBlogAiEditing && setIsBlogAiEditModalOpen(false)}
        footer={null}
        width={500}
        title={<div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} color="#8b5cf6" /> ✨ AI Edit Blog Page</div>}
        className="glassmorphism-modal"
        closable={!isBlogAiEditing}
        maskClosable={!isBlogAiEditing}
      >
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, fontWeight: 500 }}>
          Describe what you want to change on this blog page.
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <TextArea
            placeholder="Example: Change the article heading to '10 Essential Tips for a Healthier Smile' and add a short introductory paragraph below it."
            value={blogAiEditPrompt}
            onChange={(e) => setBlogAiEditPrompt(e.target.value)}
            style={{ borderRadius: 8, minHeight: 120, fontSize: 14 }}
            disabled={isBlogAiEditing}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Button size="large" onClick={() => setIsBlogAiEditModalOpen(false)} disabled={isBlogAiEditing} style={{ borderRadius: 8, fontWeight: 700, borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>Cancel</Button>
          <Button size="large" type="primary" loading={isBlogAiEditing} onClick={handleBlogAiEdit} disabled={!blogAiEditPrompt.trim()} style={{ background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", border: "none", borderRadius: 8, fontWeight: 800 }}>Apply Changes</Button>
        </div>
      </Modal>

      {/* AI Edit Modal */}
      <Modal
        open={isAiEditModalOpen}
        onCancel={() => { if (!isAiEditing) setIsAiEditModalOpen(false); }}
        footer={null}
        width={640}
        title={
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color="var(--accent-secondary)" /> 
            {aiEditContextPage ? `AI Edit: ${aiEditContextPage.title}` : 'AI Edit Website'}
          </div>
        }
        className="glassmorphism-modal"
        closable={!isAiEditing}
        maskClosable={!isAiEditing}
      >
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, fontWeight: 500 }}>
          Describe what you want to change. Claude will automatically generate or update the necessary content, design, and settings.
        </div>

        <div style={{ marginBottom: 24 }}>
          <TextArea
            placeholder="e.g. Add a testimonials section to the home page, Create a Services page, Change the primary color to dark blue..."
            value={aiEditPrompt}
            onChange={(e) => setAiEditPrompt(e.target.value)}
            style={{ borderRadius: 8, minHeight: 120, fontSize: 14 }}
            disabled={isAiEditing}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Button size="large" disabled={isAiEditing} onClick={() => setIsAiEditModalOpen(false)} style={{ borderRadius: 8, fontWeight: 700, borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>Cancel</Button>
          <Button size="large" type="primary" loading={isAiEditing} disabled={!aiEditPrompt.trim()} onClick={handleAiEdit} style={{ background: "var(--accent-secondary)", border: "none", borderRadius: 8, fontWeight: 800 }}>
            {isAiEditing ? "Generating Changes..." : "Apply Changes"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={isConnectDomainModalOpen}
        onCancel={() => { if (!connectingDomain) setIsConnectDomainModalOpen(false); }}
        footer={null}
        width={480}
        title={
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)' }}>
            Connect Custom Domain
          </div>
        }
        className="glassmorphism-modal"
        closable={!connectingDomain}
        maskClosable={!connectingDomain}
      >
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, fontWeight: 500 }}>
          Enter the custom domain you want to connect to this website. You will need to configure DNS settings afterward.
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>CUSTOM DOMAIN</div>
          <Input 
            size="large" 
            placeholder="e.g. www.mywebsite.com" 
            value={customDomain} 
            onChange={(e) => setCustomDomain(e.target.value.toLowerCase())} 
            style={{ borderRadius: 8 }}
            disabled={connectingDomain}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Button size="large" disabled={connectingDomain} onClick={() => setIsConnectDomainModalOpen(false)} style={{ borderRadius: 8, fontWeight: 700, borderColor: 'var(--border-color)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>Cancel</Button>
          <Button size="large" type="primary" loading={connectingDomain} onClick={handleConnectDomain} style={{ background: "var(--accent-primary)", border: "none", borderRadius: 8, fontWeight: 800 }}>
            Connect
          </Button>
        </div>
      </Modal>

    </motion.div>
  );
};

const WebsitesTab = ({ itemVariants, initialAction, onActionComplete }) => {
  const { role } = useAuth();
  const { canAdd, canEdit, canDelete } = useActionPermissions('/website');
  const [viewType, setViewType] = useState("list");
  const [folderView, setFolderView] = useState("home");
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createModalInitialType, setCreateModalInitialType] = useState("blank");
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateModalInitialUpload, setTemplateModalInitialUpload] = useState(false);
  const [isAiSettingsModalOpen, setIsAiSettingsModalOpen] = useState(false);
  const [pendingWebsiteName, setPendingWebsiteName] = useState("");
  const [isCloning, setIsCloning] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  
  const [websites, setWebsites] = useState([]);
  const [activeWebsite, setActiveWebsite] = useState(null);
  const [view, setView] = useState("list");

  const navigate = useNavigate();
  const location = useLocation();

  const fetchWebsiteDetails = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/websites/${id}`, {
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const resData = await res.json();
      if (resData.success) {
        setActiveWebsite({
          ...resData.data,
          key: resData.data._id,
          pages: resData.data.pages || [],
          isNew: false
        });
        setView("manage");
      } else {
        // If not found, go back to list
        const basePath = location.pathname.substring(0, location.pathname.indexOf('/websites') + 9);
        navigate(basePath, { replace: true });
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const match = location.pathname.match(/\/websites\/([a-zA-Z0-9_-]+)$/);
    if (match) {
      const websiteId = match[1];
      if (!activeWebsite || activeWebsite.key !== websiteId) {
        fetchWebsiteDetails(websiteId);
      }
    } else {
      setView("list");
      setActiveWebsite(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (initialAction === 'openTemplates') {
      setTemplateModalInitialUpload(false);
      setIsTemplateModalOpen(true);
      if (onActionComplete) onActionComplete();
    } else if (initialAction === 'openAiGenerate') {
      setCreateModalInitialType("ai");
      setIsModalOpen(true);
      if (onActionComplete) onActionComplete();
    } else if (initialAction === 'openUpload') {
      setTemplateModalInitialUpload(true);
      setIsTemplateModalOpen(true);
      if (onActionComplete) onActionComplete();
    }
  }, [initialAction, onActionComplete]);

  const fetchWebsites = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { "Authorization": token ? `Bearer ${token}` : "" };
      
      const [webRes, wpRes] = await Promise.all([
        fetch("/api/websites", { headers }),
        fetch("/api/wordpress", { headers })
      ]);
      
      const webData = await webRes.json();
      const wpData = await wpRes.json();
      
      let mapped = [];
      if (webData.success && webData.data) {
        mapped = [...mapped, ...webData.data.map(w => ({
          key: w._id,
          name: w.name,
          description: w.description,
          lastUpdated: new Date(w.updatedAt).toLocaleDateString(),
          pages: w.pagesCount || 1,
          blogs: w.blogsCount || 0,
          isNew: false,
          isWordpress: false
        }))];
      }
      if (wpData.success && wpData.data) {
        const wpMapped = wpData.data.map(w => ({
          key: w._id,
          name: w.name,
          description: "WordPress Site (" + w.websiteUrl + ")",
          lastUpdated: new Date(w.updatedAt).toLocaleDateString(),
          pages: w.pagesCount !== undefined ? w.pagesCount : "...",
          blogs: w.blogsCount !== undefined ? w.blogsCount : "...",
          isNew: false,
          isWordpress: true
        }));
        mapped = [...mapped, ...wpMapped];
        
        // Fetch WP counts asynchronously so we don't block the list load
        wpMapped.forEach(w => {
          fetch(`/api/wordpress/${w.key}/counts`, { headers })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                setWebsites(prev => prev.map(pw => pw.key === w.key ? { ...pw, pages: data.pagesCount, blogs: data.blogsCount } : pw));
              } else {
                setWebsites(prev => prev.map(pw => pw.key === w.key ? { ...pw, pages: "—", blogs: "—" } : pw));
              }
            })
            .catch(() => {
              setWebsites(prev => prev.map(pw => pw.key === w.key ? { ...pw, pages: "—", blogs: "—" } : pw));
            });
        });
      }
      
      setWebsites(mapped);
    } catch (err) {
      console.error("Failed to fetch websites", err);
    }
  };

  useEffect(() => {
    fetchWebsites();
  }, [view]);

  const handleDeleteWebsite = async (id, isWordpress = false) => {
    try {
      const token = localStorage.getItem("token");
      const endpoint = isWordpress ? `/api/wordpress/${id}` : `/api/websites/${id}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        message.success(isWordpress ? "WordPress connection deleted" : "Website deleted successfully");
        fetchWebsites();
      } else {
        message.error(data.error || "Failed to delete");
      }
    } catch (err) {
      message.error("Error deleting");
    }
  };

  const handleCloneWebsite = async (id) => {
    setIsCloning(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/websites/${id}/clone`, {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        message.success({ content: 'Website cloned successfully', key: 'clone' });
        fetchWebsites();
      } else {
        message.error({ content: data.error || "Failed to clone website", key: 'clone' });
      }
    } catch (err) {
      message.error({ content: "Error cloning website", key: 'clone' });
    } finally {
      setIsCloning(false);
    }
  };

  const handleCreateWebsite = async (data) => {
    if (data.type === "blank" || data.type === "template" || data.type === "ai") {
      try {
        if (data.type === "ai") setIsGeneratingAi(true);

        const token = localStorage.getItem("token");
        const res = await fetch("/api/websites", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({
            name: data.name,
            description: data.description || (data.template ? `Created from ${data.template} template` : ""),
            type: data.type,
            templateName: data.template,
            industry: data.industry,
            tone: data.tone
          })
        });
        const resData = await res.json();
        
        if (data.type === "ai") setIsGeneratingAi(false);

        if (resData.success) {
          if (resData.warning) {
            message.warning(resData.warning, 8);
          }
          const newWebsite = {
            key: resData.data._id,
            name: resData.data.name,
            description: resData.data.description,
            lastUpdated: "Just now",
            pages: resData.data.pages ? resData.data.pages.length : 1,
            isNew: true
          };
          setWebsites([newWebsite, ...websites]);
          setIsModalOpen(false);
          setIsTemplateModalOpen(false);
          // Navigate to the new website to load it properly
          const basePath = location.pathname.substring(0, location.pathname.indexOf('/websites') + 9);
          navigate(`${basePath}/${newWebsite.key}`);
        } else {
           message.error(resData.error || "Failed to create website");
        }
      } catch (err) {
        console.error(err);
        if (data.type === "ai") setIsGeneratingAi(false);
        message.error("Failed to create website");
      }
    } else if (data.type === "wordpress") {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/wordpress/connect", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({
            name: data.name,
            websiteUrl: data.wpUrl,
            apiUrl: data.wpApiUrl,
            username: data.wpUsername,
            password: data.wpPassword
          })
        });
        const resData = await res.json();
        if (resData.success) {
          const newWebsite = {
            key: resData.data._id,
            name: resData.data.name,
            description: "WordPress Site (" + resData.data.websiteUrl + ")",
            lastUpdated: "Just now",
            pages: "—",
            blogs: "—",
            isNew: true,
            isWordpress: true
          };
          setWebsites([newWebsite, ...websites]);
          setIsModalOpen(false);
          const basePath = location.pathname.substring(0, location.pathname.indexOf('/websites') + 9);
          navigate(`${basePath}/wordpress/${newWebsite.key}/dashboard`);
        } else {
          message.error(resData.message || "Failed to connect to WordPress");
        }
      } catch (err) {
        console.error(err);
        message.error("Error connecting to WordPress");
      }
    } else if (data.type === "templates") {
      setPendingWebsiteName(data.name);
      setIsModalOpen(false);
      setIsTemplateModalOpen(true);
    }
  };

  if (view === "manage" && activeWebsite) {
    return <ManageWebsiteView activeWebsite={activeWebsite} setView={setView} itemVariants={itemVariants} role={role} />;
  }

  const columns = [
    {
      title: "NAME",
      dataIndex: "name",
      key: "name",
      render: (t, r) => (
        <div>
          <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 15 }}>{t}</span>
          {r.description && <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, fontWeight: 500 }}>{r.description}</div>}
        </div>
      )
    },
    {
      title: "LAST UPDATED",
      dataIndex: "lastUpdated",
      key: "lastUpdated",
      render: (t) => <Text style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t}</Text>
    },
    {
      title: "PAGES",
      dataIndex: "pages",
      key: "pages",
      render: (t) => <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Array.isArray(t) ? t.length : t}</span>
    },
    {
      title: "BLOGS",
      dataIndex: "blogs",
      key: "blogs",
      render: (t) => <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Array.isArray(t) ? t.length : (t || 0)}</span>
    },
    {
      title: "ACTIONS",
      key: "actions",
      align: "right",
      render: (_, r) => {
        const handleManage = () => {
          const basePath = location.pathname.substring(0, location.pathname.indexOf('/websites') + 9);
          if (r.isWordpress) {
            navigate(`${basePath}/wordpress/${r.key}/dashboard`);
          } else {
            navigate(`${basePath}/${r.key}`);
          }
        };

        const menuItems = [
          {
            key: 'edit',
            icon: <Edit2 size={16} />,
            label: 'Manage',
            onClick: handleManage,
            style: { fontWeight: 600, color: 'var(--text-primary)', padding: '8px 12px' }
          },
          ...(r.isWordpress || !canAdd ? [] : [
            {
              key: 'clone',
              icon: <Copy size={16} />,
              label: 'Clone',
              onClick: () => handleCloneWebsite(r.key),
              style: { fontWeight: 600, color: 'var(--text-primary)', padding: '8px 12px' }
            }
          ]),
          {
            key: 'folder',
            icon: <FolderInput size={16} />,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>Move To Folder</span>
                <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 800, marginLeft: 12 }}>Create a folder first</span>
              </div>
            ),
            disabled: true,
            style: { fontWeight: 600, color: 'var(--text-secondary)', padding: '8px 12px' }
          },
          {
            key: 'upload',
            icon: <UploadCloud size={16} />,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>Upload To Website Templates</span>
                <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 800, marginLeft: 12 }}>Soon</span>
              </div>
            ),
            disabled: true,
            style: { fontWeight: 600, color: 'var(--text-secondary)', padding: '8px 12px' }
          },
          {
            key: 'share',
            icon: <Share2 size={16} />,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>Share</span>
                <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 800, marginLeft: 12 }}>Soon</span>
              </div>
            ),
            disabled: true,
            style: { fontWeight: 600, color: 'var(--text-secondary)', padding: '8px 12px' }
          },
          ...(canDelete ? [{
            key: 'delete',
            icon: <Trash2 size={16} />,
            label: 'Delete',
            danger: true,
            onClick: () => handleDeleteWebsite(r.key),
            style: { fontWeight: 700, padding: '8px 12px' }
          }] : [])
        ];

        return (
          <Space>
            <Dropdown 
              menu={{ items: menuItems }} 
              trigger={['click']} 
              placement="bottomRight"
              overlayStyle={{ minWidth: 220 }}
            >
              <Button type="text" icon={<MoreVertical size={18} color="var(--text-secondary)" />} style={{ borderRadius: 8 }} />
            </Dropdown>
          </Space>
        );
      }
    },
  ];

  return (
    <motion.div variants={itemVariants}>
      <Spin fullscreen spinning={isCloning} tip="Cloning website..." size="large" />
      <Spin fullscreen spinning={isGeneratingAi} tip={<div style={{ marginTop: 16 }}><b>Generating Website with AI...</b><br /><small>This may take up to 30 seconds.</small></div>} size="large" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={4} style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Monitor size={24} color="var(--accent-primary)" /> Websites
          </Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
            Build custom websites to showcase your products and build a trusted brand.
          </Text>
        </div>
        <Space>
          {canAdd && (
            <>
              <Button 
                size="large"
                icon={<Sparkles size={18} />} 
                onClick={() => setIsAiSettingsModalOpen(true)}
                style={{ color: "var(--accent-secondary)", borderColor: "var(--accent-secondary)", background: "rgba(13, 148, 136, 0.05)", borderRadius: 8, fontWeight: 800, height: 44, padding: '0 20px' }}
              >
                AI Settings
              </Button>
              {/* <Button 
                size="large"
                icon={<Sparkles size={18} />} 
                onClick={() => setIsModalOpen(true)}
                style={{ color: "var(--accent-secondary)", borderColor: "var(--accent-secondary)", background: "rgba(13, 148, 136, 0.05)", borderRadius: 8, fontWeight: 800, height: 44, padding: '0 20px' }}
              >
                Build with AI <Tag style={{ margin: '0 0 0 8px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 12, padding: '2px 8px', fontSize: 10 }}>BETA</Tag>
              </Button> */}
              <Button 
                size="large"
                type="primary" 
                icon={<Plus size={18} />}
                onClick={() => setIsModalOpen(true)}
                style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: 8, fontWeight: 800, height: 44, padding: '0 24px', boxShadow: 'var(--shadow-md)' }}
              >
                New Website
              </Button>
            </>
          )}
        </Space>
      </div>

      <div style={{ display: 'flex', justifyContent: 'end', marginBottom: 24, alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Space>
          <Input
            size="large"
            placeholder="Search for Websites"
            prefix={<Search size={16} color="var(--text-tertiary)" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300, borderRadius: 10 }}
          />
        </Space>
      </div>

      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <Table scroll={{ x: 800 }} 
          columns={columns}
          dataSource={websites.filter(w => w.name.toLowerCase().includes(searchText.toLowerCase()))}
          pagination={{
            defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            position: ['bottomCenter']
          }}
          locale={{
            emptyText: (
              <div style={{ padding: "80px 0", textAlign: "center" }}>
                <div style={{ width: 80, height: 80, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <Monitor size={40} />
                </div>
                <Title level={4} style={{ marginBottom: 12, color: 'var(--text-primary)', fontWeight: 800 }}>No websites yet</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 32, fontSize: 15, fontWeight: 500 }}>
                  Create your first website from blank or from a template.
                </Text>
                <Button type="primary" icon={<Plus size={18} />} onClick={() => setIsModalOpen(true)} style={{ borderRadius: 8, height: 44, background: 'var(--accent-primary)', border: 'none', fontWeight: 700, padding: '0 32px' }}>New Website</Button>
              </div>
            )
          }}
        />
      </Card>

      <CreateWebsiteModal 
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          // reset to default for next open
          setTimeout(() => setCreateModalInitialType("blank"), 200);
        }}
        onCreate={handleCreateWebsite}
        loading={isGeneratingAi}
        initialType={createModalInitialType}
      />

      <WebsiteTemplateLibraryModal 
        open={isTemplateModalOpen}
        initialWebsiteName={pendingWebsiteName}
        initialShowUploadBox={templateModalInitialUpload}
        onCancel={() => {
          setIsTemplateModalOpen(false);
          setIsModalOpen(true);
        }}
        onCreate={handleCreateWebsite}
      />

      <AiSettingsModal 
        open={isAiSettingsModalOpen}
        onCancel={() => setIsAiSettingsModalOpen(false)}
      />
    </motion.div>
  );
};

const AiSettingsModal = ({ open, onCancel }) => {
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (open) {
      const fetchSettings = async () => {
        setFetching(true);
        try {
          const token = localStorage.getItem("token");
          const res = await fetch("/api/ai-studio/settings", {
            headers: { "Authorization": token ? `Bearer ${token}` : "" }
          });
          const data = await res.json();
          if (data.success && data.data.isAnthropicConfigured) {
            setAnthropicApiKey(data.data.maskedAnthropicKey || "sk-ant-...");
          } else {
            setAnthropicApiKey("");
          }
        } catch (err) {
          console.error(err);
        }
        setFetching(false);
      };
      fetchSettings();
    }
  }, [open]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      
      const payload = {};
      if (anthropicApiKey && !anthropicApiKey.includes("...")) {
        payload.anthropicApiKey = anthropicApiKey;
      }

      const res = await fetch("/api/ai-studio/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        message.success("AI Settings saved successfully");
        onCancel();
      } else {
        message.error(data.message || "Failed to save settings");
      }
    } catch (err) {
      message.error("Error saving AI settings");
    }
    setLoading(false);
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={<div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} color="var(--accent-secondary)" /> AI Configuration</div>}
      className="glassmorphism-modal"
    >
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, fontWeight: 500 }}>
        Configure your AI API keys to generate websites with AI. These settings are shared across your workspace.
      </div>
      
      {fetching ? (
        <div style={{ textAlign: "center", padding: 24 }}><Spin /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 6 }}>CLAUDE API KEY (ANTHROPIC)</div>
            <Input.Password
              size="large"
              placeholder="sk-ant-..."
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              style={{ borderRadius: 8 }}
            />
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
        <Button size="large" onClick={onCancel} style={{ borderRadius: 8, fontWeight: 700 }}>Cancel</Button>
        <Button size="large" type="primary" loading={loading} onClick={handleSave} style={{ background: "var(--accent-secondary)", border: "none", borderRadius: 8, fontWeight: 800 }}>Save Settings</Button>
      </div>
    </Modal>
  );
};

export default WebsitesTab;