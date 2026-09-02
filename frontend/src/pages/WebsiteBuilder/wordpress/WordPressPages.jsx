import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Typography, Card, Table, Button, Tag, Space, Modal, Input, message, Drawer, Select, Tooltip } from "antd";
import { ArrowLeft, ExternalLink, Plus, Edit2, Trash2, Activity, RefreshCcw, Image as ImageIcon, Layout, AlertTriangle, Sparkles, FileText, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import RichTextEditor from "../../../components/RichTextEditor";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const WordPressPages = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingPage, setEditingPage] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("publish");

  // AI Edit State
  const [isAiEditModalOpen, setIsAiEditModalOpen] = useState(false);
  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const [isAiEditing, setIsAiEditing] = useState(false);
  const [aiEditTargetPage, setAiEditTargetPage] = useState(null);

  // Drawer AI State
  const [drawerAiPrompt, setDrawerAiPrompt] = useState("");
  const [isDrawerAiEditing, setIsDrawerAiEditing] = useState(false);

  // Elementor Warning State
  const [elementorWarning, setElementorWarning] = useState({ visible: false, html: "" });

  useEffect(() => {
    fetchPages();
  }, [id]);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/wordpress/${id}/pages`, {
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setPages(data.data);
      } else {
        message.error("Failed to fetch WordPress pages");
      }
    } catch (err) {
      console.error(err);
      message.error("Error fetching pages");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(location.pathname.replace(/\/pages$/, '/dashboard'));
  };

  const openDrawer = (page = null) => {
    if (page) {
      setEditingPage(page);
      setTitle(page.title?.raw || page.title?.rendered || "");
      setContent(page.content?.raw || page.content?.rendered || "");
      setStatus(page.status || "publish");
    } else {
      setEditingPage(null);
      setTitle("");
      setContent("");
      setStatus("publish");
    }
    setDrawerAiPrompt("");
    setDrawerVisible(true);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setEditingPage(null);
    setDrawerAiPrompt("");
  };

  const handleSave = async () => {
    if (!title.trim()) {
      message.error("Title is required");
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        title,
        content,
        status
      };
      
      const endpoint = editingPage 
        ? `/api/wordpress/${id}/pages/${editingPage.id}`
        : `/api/wordpress/${id}/pages`;
        
      const method = editingPage ? "PUT" : "POST";
      
      const res = await fetch(endpoint, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "" 
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (data.success) {
        message.success(`Page ${editingPage ? 'updated' : 'created'} successfully`);
        closeDrawer();
        fetchPages();
      } else {
        message.error(data.message || "Failed to save page");
      }
    } catch (err) {
      console.error(err);
      message.error("Error saving page");
    } finally {
      setSaving(false);
    }
  };

  const handleAiEdit = async () => {
    if (!aiEditPrompt.trim() || !aiEditTargetPage) return;
    
    setIsAiEditing(true);
    try {
      const token = localStorage.getItem("token");
      const payload = { prompt: aiEditPrompt };
      
      const res = await fetch(`/api/wordpress/${id}/pages/${aiEditTargetPage.id}/ai-edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (data.success) {
        const newHtml = data.data.content?.raw || data.data.content?.rendered || "";
        // Detect Elementor
        if (newHtml.includes('data-elementor-type') || newHtml.includes('elementor-widget')) {
          setElementorWarning({ visible: true, html: newHtml });
          setIsAiEditModalOpen(false);
          setAiEditPrompt("");
          fetchPages();
        } else {
          message.success("AI changes applied successfully.");
          setIsAiEditModalOpen(false);
          setAiEditPrompt("");
          fetchPages();
        }
      } else {
        message.error(data.message || "Failed to apply AI edits.");
      }
    } catch (err) {
      console.error(err);
      message.error("Error applying AI edits.");
    } finally {
      setIsAiEditing(false);
    }
  };

  const handleDrawerAiEdit = async () => {
    if (!drawerAiPrompt.trim() || !editingPage) return;
    
    setIsDrawerAiEditing(true);
    try {
      const token = localStorage.getItem("token");
      // Pass the current drawer content in case they made manual changes before asking AI
      const payload = { prompt: drawerAiPrompt, currentHtml: content };
      
      const res = await fetch(`/api/wordpress/${id}/pages/${editingPage.id}/ai-edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (data.success) {
        const newHtml = data.data.content?.raw || data.data.content?.rendered || "";
        setContent(newHtml);
        setDrawerAiPrompt("");
        fetchPages(); // refresh the list behind the drawer too
        
        if (newHtml.includes('data-elementor-type') || newHtml.includes('elementor-widget')) {
          setElementorWarning({ visible: true, html: newHtml });
        } else {
          message.success("AI changes applied successfully.");
        }
      } else {
        message.error(data.message || "Failed to apply AI edits.");
      }
    } catch (err) {
      console.error(err);
      message.error("Error applying AI edits.");
    } finally {
      setIsDrawerAiEditing(false);
    }
  };

  const handleDelete = (pageId) => {
    Modal.confirm({
      title: <div style={{ fontSize: 18, fontWeight: 900 }}>Delete this page?</div>,
      content: <div style={{ fontWeight: 500 }}>This will move the page to trash in WordPress.</div>,
      okText: "Yes, delete",
      cancelText: "Cancel",
      okButtonProps: { danger: true, style: { borderRadius: 8, fontWeight: 700 } },
      cancelButtonProps: { style: { borderRadius: 8, fontWeight: 600 } },
      className: "glassmorphism-modal",
      onOk: async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`/api/wordpress/${id}/pages/${pageId}`, {
            method: "DELETE",
            headers: { "Authorization": token ? `Bearer ${token}` : "" }
          });
          const data = await res.json();
          if (data.success) {
            message.success("Page deleted successfully");
            fetchPages();
          } else {
            message.error(data.message || "Failed to delete page");
          }
        } catch (err) {
          message.error("Error deleting page");
        }
      }
    });
  };

  const columns = [
    {
      title: "TITLE",
      dataIndex: "title",
      key: "title",
      render: (t, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0, 115, 170, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={16} color="#0073AA" />
          </div>
          <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 15 }} dangerouslySetInnerHTML={{ __html: t.rendered || '(No title)' }}></span>
        </div>
      )
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      render: (t) => {
        const isPublished = t === 'publish';
        return (
          <Tag style={{ 
            margin: 0, 
            borderRadius: 12, 
            border: 'none', 
            background: isPublished ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)', 
            color: isPublished ? 'var(--accent-success)' : 'var(--text-tertiary)', 
            fontWeight: 800, 
            padding: '2px 10px',
            textTransform: 'uppercase'
          }}>
            {t}
          </Tag>
        );
      }
    },
    {
      title: "DATE",
      dataIndex: "date",
      key: "date",
      render: (t) => <Text style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{new Date(t).toLocaleDateString()}</Text>
    },
    {
      title: "ACTIONS",
      key: "actions",
      align: "right",
      render: (_, r) => {
        let pageBuilderUrl = null;
        try {
          if (r.link) {
            const origin = new URL(r.link).origin;
            if (r.pageBuilder === 'elementor') pageBuilderUrl = `${origin}/wp-admin/post.php?post=${r.id}&action=elementor`;
            if (r.pageBuilder === 'divi') pageBuilderUrl = `${origin}/wp-admin/post.php?post=${r.id}&action=edit&et_fb=1`;
          }
        } catch (e) {
          console.error("Invalid URL format", r.link);
        }

        return (
          <Space size="middle">
            {pageBuilderUrl && (
              <Tooltip title={`Edit with ${r.pageBuilder === 'elementor' ? 'Elementor' : 'Divi'}`}>
                <Button type="text" icon={<Layout size={16} color={r.pageBuilder === 'elementor' ? '#e64980' : '#845ef7'} />} onClick={() => window.open(pageBuilderUrl, '_blank')} />
              </Tooltip>
            )}
            <Tooltip title="Preview">
              <Button type="text" icon={<ExternalLink size={16} color="var(--text-secondary)" />} onClick={() => window.open(r.link, '_blank')} />
            </Tooltip>
            <Tooltip title="AI Edit">
              <Button type="text" icon={<Sparkles size={16} color="var(--accent-secondary)" />} onClick={() => {
                setAiEditTargetPage(r);
                setAiEditPrompt("");
                setIsAiEditModalOpen(true);
              }} />
            </Tooltip>
            <Tooltip title="Edit">
              <Button type="text" icon={<Edit2 size={16} color="var(--accent-info)" />} onClick={() => openDrawer(r)} />
            </Tooltip>
            <Tooltip title="Delete">
              <Button type="text" danger icon={<Trash2 size={16} />} onClick={() => handleDelete(r.id)} />
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: '#0073AA', fontWeight: 700 }} onClick={handleBack}>
        <ArrowLeft size={16} /> Back to Dashboard
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 900 }}>WordPress Pages</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Manage pages synchronized with your remote WordPress installation.</Text>
        </div>
        
        <Space>
          <Button size="large" icon={<RefreshCcw size={16} />} onClick={fetchPages} loading={loading} style={{ borderRadius: 8, fontWeight: 700, borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            Sync
          </Button>
          <Button size="large" type="primary" icon={<Plus size={16} />} onClick={() => openDrawer()} style={{ borderRadius: 8, fontWeight: 800, background: '#0073AA', border: 'none' }}>
            New Page
          </Button>
        </Space>
      </div>

      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
        <Table 
          columns={columns} 
          dataSource={pages} 
          rowKey="id" 
          loading={loading}
          pagination={{
            defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            position: ['bottomCenter']
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      <Drawer
        title={<div style={{ fontSize: 18, fontWeight: 900 }}>{editingPage ? 'Edit WordPress Page' : 'Create WordPress Page'}</div>}
        width={600}
        onClose={closeDrawer}
        open={drawerVisible}
        bodyStyle={{ paddingBottom: 80, background: 'var(--bg-primary)' }}
        extra={
          <Space>
            <Button onClick={closeDrawer} style={{ borderRadius: 8, fontWeight: 700 }}>Cancel</Button>
            <Button onClick={handleSave} type="primary" loading={saving} disabled={editingPage && ['elementor', 'divi', 'wpbakery', 'pagelayer'].includes(editingPage.pageBuilder)} style={{ background: '#0073AA', border: 'none', borderRadius: 8, fontWeight: 800 }}>
              {editingPage ? 'Update Page' : 'Publish Page'}
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>PAGE TITLE <span style={{ color: "var(--accent-danger)" }}>*</span></div>
          <Input 
            size="large"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. About Us"
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 16 }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>PUBLICATION STATUS</div>
          <Select size="large" value={status} onChange={setStatus} style={{ width: '100%' }} dropdownStyle={{ borderRadius: 8 }}>
            <Option value="publish">Published</Option>
            <Option value="draft">Draft</Option>
            <Option value="pending">Pending Review</Option>
            <Option value="private">Private</Option>
          </Select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>PAGE CONTENT (HTML SUPPORTED)</div>
          
          {editingPage && ['elementor', 'divi', 'wpbakery', 'pagelayer'].includes(editingPage.pageBuilder) ? (
            <div style={{ padding: "24px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 12, color: "var(--text-primary)" }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: "var(--accent-warning)", marginBottom: 12, fontSize: 16 }}>
                <AlertTriangle size={20} /> Page Builder Detected
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                This page is built with <b style={{ textTransform: 'capitalize' }}>{editingPage.pageBuilder}</b>. Due to WordPress restrictions, the content cannot be updated through this basic text editor. 
                <br/><br/>
                To safely edit the visual layout and text of this page, please close this drawer and click the <b>{editingPage.pageBuilder === 'elementor' ? 'Edit with Elementor (Pink Icon)' : editingPage.pageBuilder === 'divi' ? 'Edit with Divi (Purple Icon)' : 'Native WP Edit'}</b> button in the pages table!
              </div>
            </div>
          ) : (
            <>
              {editingPage && (
                <div style={{ marginBottom: 16, padding: "16px", background: "rgba(13, 148, 136, 0.05)", border: "1px solid rgba(13, 148, 136, 0.2)", borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent-secondary)", marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={16} /> Edit Content with AI
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Input 
                      placeholder="e.g. Add a testimonials section, Make the heading bold..." 
                      value={drawerAiPrompt} 
                      onChange={(e) => setDrawerAiPrompt(e.target.value)} 
                      disabled={isDrawerAiEditing}
                      style={{ borderRadius: 8 }}
                      onPressEnter={handleDrawerAiEdit}
                    />
                    <Button type="primary" loading={isDrawerAiEditing} onClick={handleDrawerAiEdit} disabled={!drawerAiPrompt.trim()} style={{ background: "var(--accent-secondary)", border: "none", borderRadius: 8, fontWeight: 700 }}>
                      Apply AI
                    </Button>
                  </div>
                </div>
              )}

              <RichTextEditor
                value={content}
                onChange={(val) => setContent(val)}
                placeholder="Welcome to my site! This is my new page content..."
              />
              <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                Note: The content you enter here will be directly rendered by your WordPress theme. You can use standard HTML tags.
              </Text>
            </>
          )}
        </div>
      </Drawer>

      <Modal
        open={isAiEditModalOpen}
        onCancel={() => { if (!isAiEditing) setIsAiEditModalOpen(false); }}
        footer={null}
        width={640}
        title={
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color="var(--accent-secondary)" /> 
            {aiEditTargetPage ? `AI Edit: ${aiEditTargetPage.title?.rendered?.replace(/(<([^>]+)>)/gi, '') || 'Page'}` : 'AI Edit Page'}
          </div>
        }
        className="glassmorphism-modal"
        closable={!isAiEditing}
        maskClosable={!isAiEditing}
      >
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24, fontWeight: 500 }}>
          Describe what you want to change on this page. Claude will automatically generate or update the necessary content and design.
        </div>

        <div style={{ marginBottom: 24 }}>
          <TextArea
            placeholder="e.g. Add a testimonials section, Change the primary color to dark blue, Make the heading bold..."
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
        open={elementorWarning.visible}
        onCancel={() => setElementorWarning({ visible: false, html: "" })}
        footer={null}
        width={700}
        title={
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
            Elementor Page Detected
          </div>
        }
        className="glassmorphism-modal"
      >
        <div style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24, fontWeight: 500, lineHeight: 1.6 }}>
          The AI has successfully generated the updated code. However, because this page is built with <b>Elementor</b>, WordPress will ignore the standard content we saved to the database.
          <br /><br />
          To see these changes on your live site, please click <b>Copy HTML</b> below, then edit the page in Elementor and paste the code into an HTML widget.
        </div>
        
        <TextArea
          rows={10}
          value={elementorWarning.html}
          readOnly
          style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 12, background: 'var(--bg-secondary)', marginBottom: 24 }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Button size="large" onClick={() => setElementorWarning({ visible: false, html: "" })} style={{ borderRadius: 8, fontWeight: 700 }}>Close</Button>
          <Button size="large" type="primary" onClick={() => {
            navigator.clipboard.writeText(elementorWarning.html);
            message.success("Copied to clipboard!");
          }} style={{ background: "var(--accent-info)", border: "none", borderRadius: 8, fontWeight: 800 }}>
            Copy HTML
          </Button>
        </div>
      </Modal>

    </div>
  );
};

export default WordPressPages;
