import React, { useState, useEffect, useRef } from "react";
import { Button, Table, Typography, Space, Input, Select, Card, Row, Col, Popconfirm, Tag, message, Modal } from "antd";
import { Plus, Trash2, Edit3, Newspaper, LayoutTemplate, Settings, Tag as TagIcon, LayoutList, FileText, ArrowRight, ArrowLeft, ImagePlus, X } from "lucide-react";
import { motion } from "framer-motion";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const CreateBlogView = ({ setView, handleCreateBlog, itemVariants, websites, stores }) => {
  const [formData, setFormData] = useState({
    name: "",
    website: "—",
    webstore: "—",
    description: "",
    status: "active"
  });

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }} onClick={() => setView("list")}>
        <ArrowLeft size={16} /> Back to Blogs
      </div>
      <Title level={3} style={{ marginBottom: 32, color: 'var(--text-primary)', fontWeight: 800 }}>Create New Blog</Title>
      
      <Card bodyStyle={{ padding: 32 }} style={{ maxWidth: 800, borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>BLOG NAME</div>
          <Input 
            size="large"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            style={{ borderRadius: 8 }} 
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>WEBSITE (OPTIONAL)</div>
          <Select 
            size="large"
            value={formData.website}
            onChange={v => setFormData({...formData, website: v})}
            style={{ width: "100%" }}
          >
            <Option value="—">—</Option>
            {websites.map(w => (
              <Option key={w._id} value={w._id}>{w.name}</Option>
            ))}
          </Select>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>DESCRIPTION</div>
          <TextArea 
            size="large"
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            rows={3} 
            style={{ borderRadius: 8 }} 
          />
        </div>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>STATUS</div>
          <Select 
            size="large"
            value={formData.status}
            onChange={v => setFormData({...formData, status: v})}
            style={{ width: "100%" }}
          >
            <Option value="active">Active</Option>
            <Option value="draft">Draft</Option>
          </Select>
        </div>
        <Button 
          type="primary" 
          size="large"
          style={{ backgroundColor: "var(--accent-primary)", border: "none", borderRadius: 8, fontWeight: 700, padding: "0 32px" }}
          disabled={!formData.name}
          onClick={() => handleCreateBlog(formData)}
        >
          Create blog
        </Button>
      </Card>
    </motion.div>
  );
};

const SettingsBlogView = ({ activeBlog, setView, handleUpdateBlog, itemVariants, websites, stores }) => {
  const [formData, setFormData] = useState({
    name: activeBlog.name,
    website: activeBlog.website,
    webstore: activeBlog.webstore,
    status: activeBlog.status,
    postsPerPage: activeBlog.postsPerPage
  });

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }} onClick={() => setView("manage")}>
        <ArrowLeft size={16} /> Back to {activeBlog.name}
      </div>
      <Title level={3} style={{ marginBottom: 32, color: 'var(--text-primary)', fontWeight: 800 }}>Blog Settings</Title>
      
      <Card bodyStyle={{ padding: 32 }} style={{ maxWidth: 800, borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>NAME</div>
          <Input 
            size="large"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            style={{ borderRadius: 8 }} 
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>WEBSITE</div>
          <Select 
            size="large"
            value={formData.website}
            onChange={v => setFormData({...formData, website: v})}
            style={{ width: "100%" }}
          >
            <Option value="—">—</Option>
            {websites.map(w => (
              <Option key={w._id} value={w._id}>{w.name}</Option>
            ))}
          </Select>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>POSTS PER PAGE (ARCHIVE)</div>
          <Input 
            size="large"
            value={formData.postsPerPage}
            onChange={e => setFormData({...formData, postsPerPage: e.target.value})}
            style={{ borderRadius: 8, width: 120 }} 
            type="number"
          />
        </div>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>STATUS</div>
          <Select 
            size="large"
            value={formData.status}
            onChange={v => setFormData({...formData, status: v})}
            style={{ width: "100%" }}
          >
            <Option value="active">Active</Option>
            <Option value="draft">Draft</Option>
          </Select>
        </div>
        <Button 
          type="primary" 
          size="large"
          style={{ backgroundColor: "var(--accent-primary)", border: "none", borderRadius: 8, fontWeight: 700, padding: "0 32px" }}
          onClick={() => handleUpdateBlog(formData)}
        >
          Save Settings
        </Button>
      </Card>
    </motion.div>
  );
};

const CreatePostView = ({ setView, handleCreatePost, itemVariants, websites, stores, categories, editData }) => {
  const [formData, setFormData] = useState(editData ? {
    title: editData.title || "",
    categoryId: editData.categories?.[0] || "—",
    status: editData.status || "draft",
    websiteId: editData.websiteId || "—",
    storeId: editData.storeId || "—",
    excerpt: editData.excerpt || "",
    featuredImageUrl: editData.featuredImageUrl || "",
    metaTitle: editData.metaTitle || "",
    metaDescription: editData.metaDescription || "",
    isFeatured: !!editData.isFeatured
  } : {
    title: "",
    categoryId: "—",
    status: "draft",
    websiteId: "—",
    storeId: "—",
    excerpt: "",
    featuredImageUrl: "",
    metaTitle: "",
    metaDescription: "",
    isFeatured: false
  });

  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const excerptRef = useRef(null);
  const [excerptMode, setExcerptMode] = useState('visual');

  useEffect(() => {
    if (excerptMode === 'visual' && excerptRef.current) {
      excerptRef.current.innerHTML = formData.excerpt || "";
    }
  }, [excerptMode]);

  const handleExcerptInput = () => {
    setFormData(prev => ({ ...prev, excerpt: excerptRef.current.innerHTML }));
  };

  const handleExcerptCodeChange = (e) => {
    setFormData(prev => ({ ...prev, excerpt: e.target.value }));
  };

  const handleExcerptFormat = (command) => {
    if (excerptMode !== 'visual' || !excerptRef.current) return;
    document.execCommand(command);
    handleExcerptInput();
  };

  const stripPastedStyling = (node) => {
    if (node.nodeType === 1) {
      node.removeAttribute('style');
      node.removeAttribute('class');
      node.removeAttribute('bgcolor');
      Array.from(node.childNodes).forEach(stripPastedStyling);
    }
  };

  const handleExcerptPaste = (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    let cleanHtml;
    if (html) {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      stripPastedStyling(temp);
      cleanHtml = temp.innerHTML;
    } else {
      const text = e.clipboardData.getData('text/plain') || '';
      cleanHtml = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
    document.execCommand('insertHTML', false, cleanHtml);
    handleExcerptInput();
  };

  const savedRangeRef = useRef(null);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkUrlInput, setLinkUrlInput] = useState("");

  const handleInsertLink = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !excerptRef.current || !excerptRef.current.contains(selection.anchorNode)) {
      message.warning("Select a word in the excerpt first.");
      return;
    }
    savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    setLinkUrlInput("");
    setLinkModalVisible(true);
  };

  const handleConfirmInsertLink = () => {
    const url = linkUrlInput.trim();
    setLinkModalVisible(false);
    if (!url || !savedRangeRef.current || !excerptRef.current) return;

    const range = savedRangeRef.current;
    requestAnimationFrame(() => {
      if (!excerptRef.current) return;
      excerptRef.current.focus();
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand('createLink', false, url);

      excerptRef.current.querySelectorAll('a').forEach(a => {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      });
      handleExcerptInput();
    });
  };

  const FORMAT_TAGS = ["P", "H1", "H2", "H3", "H4", "H5", "H6"];

  const handleWrapTag = (tagName, { inline = true } = {}) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !excerptRef.current || !excerptRef.current.contains(selection.anchorNode)) {
      message.warning("Select a word in the excerpt first.");
      return;
    }
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === 3) container = container.parentElement;
    let formatEl = null;
    for (let node = container; node && node !== excerptRef.current; node = node.parentElement) {
      if (node.nodeType === 1 && FORMAT_TAGS.includes(node.tagName)) {
        formatEl = node;
        break;
      }
    }

    if (formatEl) {
      const getLeafPoint = (node, atStart) => {
        if (node.nodeType === 3) return { node, offset: atStart ? 0 : node.length };
        const kids = node.childNodes;
        if (!kids.length) return { node, offset: 0 };
        return getLeafPoint(kids[atStart ? 0 : kids.length - 1], atStart);
      };
      const startPt = getLeafPoint(formatEl, true);
      const endPt = getLeafPoint(formatEl, false);
      const startBoundary = document.createRange();
      startBoundary.setStart(startPt.node, startPt.offset);
      startBoundary.setEnd(startPt.node, startPt.offset);
      const endBoundary = document.createRange();
      endBoundary.setStart(endPt.node, endPt.offset);
      endBoundary.setEnd(endPt.node, endPt.offset);

      const selectionCoversEl =
        range.compareBoundaryPoints(Range.START_TO_START, startBoundary) <= 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, endBoundary) >= 0;

      if (selectionCoversEl) {
        const newTag = document.createElement(tagName);
        if (inline) newTag.style.display = "inline";
        newTag.innerHTML = formatEl.innerHTML;
        formatEl.replaceWith(newTag);
        selection.removeAllRanges();
        handleExcerptInput();
        return;
      }
    }

    const tag = document.createElement(tagName);
    if (inline) tag.style.display = "inline";

    try {
      range.surroundContents(tag);
    } catch (e) {
      const contents = range.extractContents();
      tag.appendChild(contents);
      range.insertNode(tag);
    }

    selection.removeAllRanges();
    handleExcerptInput();
  };

  const handleFormatHeading = (level) => handleWrapTag(`h${level}`);

  const handleFormatParagraph = () => handleWrapTag("p");

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingImage(true);
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "blog-posts");
      const res = await fetch("/api/media/upload", {
        method: "POST",
        headers: { "Authorization": token ? `Bearer ${token}` : "" },
        body: fd
      });
      const data = await res.json();
      if (data.success) {
        setFormData(prev => ({ ...prev, featuredImageUrl: data.data.url }));
        message.success("Image uploaded successfully!");
      } else {
        message.error(data.error || "Failed to upload image");
      }
    } catch (err) {
      console.error(err);
      message.error("Error uploading image");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isComplete = formData.title && formData.categoryId !== "—" && formData.excerpt && formData.metaTitle && formData.metaDescription;

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: '#ea580c', fontWeight: 700 }} onClick={() => setView("manage")}>
        <ArrowLeft size={16} /> Back to Manage
      </div>
      <Title level={3} style={{ marginBottom: 32, color: 'var(--text-primary)', fontWeight: 800 }}>{editData ? "Edit blog post" : "New blog post"}</Title>
      
      <Card bodyStyle={{ padding: 32 }} style={{ maxWidth: 800, borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>TITLE</div>
          <Input 
            size="large"
            value={formData.title}
            onChange={e => setFormData({...formData, title: e.target.value})}
            style={{ borderRadius: 8 }} 
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>FEATURED IMAGE</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />
          {formData.featuredImageUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img
                src={formData.featuredImageUrl}
                alt="Featured"
                style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border-color)" }}
              />
              <Space>
                <Button
                  loading={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ borderRadius: 8, fontWeight: 600 }}
                >
                  Replace Image
                </Button>
                <Button
                  danger
                  icon={<X size={14} />}
                  onClick={() => setFormData(prev => ({ ...prev, featuredImageUrl: "" }))}
                  style={{ borderRadius: 8, fontWeight: 600 }}
                >
                  Remove
                </Button>
              </Space>
            </div>
          ) : (
            <div style={{ border: "1px dashed var(--border-color)", borderRadius: 12, padding: 20, textAlign: "center", background: "var(--bg-primary)" }}>
              <Button
                icon={<ImagePlus size={16} />}
                loading={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
                style={{ borderRadius: 8, fontWeight: 600, marginBottom: 8 }}
              >
                Choose Image
              </Button>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500 }}>Recommended 1200×630px.</div>
            </div>
          )}
        </div>

        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>CATEGORY</div>
            <Select 
              size="large"
              value={formData.categoryId}
              onChange={v => setFormData({...formData, categoryId: v})}
              style={{ width: "100%" }}
            >
              <Option value="—">—</Option>
              {categories.map(c => <Option key={c._id} value={c._id}>{c.name}</Option>)}
            </Select>
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>STATUS</div>
            <Select 
              size="large"
              value={formData.status}
              onChange={v => setFormData({...formData, status: v})}
              style={{ width: "100%" }}
            >
              <Option value="draft">draft</Option>
              <Option value="published">published</Option>
            </Select>
          </Col>
        </Row>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>EXCERPT</div>

          <style>{`
            .excerpt-editable, .excerpt-editable * { background-color: transparent !important; }
          `}</style>
          <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-color)", background: "var(--bg-primary)" }}>
            {/* Visual / Code tabs */}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
              <span
                onClick={() => setExcerptMode('visual')}
                style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: excerptMode === 'visual' ? "var(--text-primary)" : "var(--text-tertiary)" }}
              >
                Visual
              </span>
              <span style={{ color: "var(--border-color)" }}>|</span>
              <span
                onClick={() => setExcerptMode('code')}
                style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: excerptMode === 'code' ? "var(--text-primary)" : "var(--text-tertiary)" }}
              >
                Code
              </span>
            </div>

            {/* Formatting toolbar — only acts on the Visual editor */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)",
              opacity: excerptMode === 'code' ? 0.4 : 1, pointerEvents: excerptMode === 'code' ? "none" : "auto"
            }}>
              {[
                { label: "b", title: "Bold", onClick: () => handleExcerptFormat('bold'), style: { fontWeight: 800 } },
                { label: "i", title: "Italic", onClick: () => handleExcerptFormat('italic'), style: { fontStyle: "italic" } },
                { label: "u", title: "Underline", onClick: () => handleExcerptFormat('underline'), style: { textDecoration: "underline" } },
                { label: "del", title: "Strikethrough", onClick: () => handleExcerptFormat('strikeThrough'), style: { textDecoration: "line-through" } },
                { label: "link", title: "Insert link", onClick: handleInsertLink },
                { label: "P", title: "Paragraph", onClick: handleFormatParagraph },
                { label: "H1", title: "Heading 1", onClick: () => handleFormatHeading(1) },
                { label: "H2", title: "Heading 2", onClick: () => handleFormatHeading(2) },
                { label: "H3", title: "Heading 3", onClick: () => handleFormatHeading(3) },
              ].map(btn => (
                <button
                  key={btn.label}
                  type="button"
                  title={btn.title}
                  onClick={btn.onClick}
                  style={{
                    minWidth: 32, height: 28, padding: "0 10px", fontSize: 12, borderRadius: 4,
                    border: "1px solid var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)", cursor: "pointer",
                    ...btn.style
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Content area */}
            {excerptMode === 'visual' ? (
              <div
                ref={excerptRef}
                contentEditable
                className="excerpt-editable"
                suppressContentEditableWarning
                onInput={handleExcerptInput}
                onPaste={handleExcerptPaste}
                style={{
                  minHeight: 140,
                  padding: "14px 16px",
                  fontSize: 14,
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  lineHeight: 1.7
                }}
              />
            ) : (
              <textarea
                value={formData.excerpt}
                onChange={handleExcerptCodeChange}
                spellCheck={false}
                style={{
                  width: "100%",
                  minHeight: 140,
                  padding: "14px 16px",
                  fontSize: 13,
                  fontFamily: "'Fira Code', 'Courier New', monospace",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "none",
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.7
                }}
              />
            )}
          </div>

          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
            Select a word in Visual mode, then click a format button — "link" makes it clickable, P wraps it in a paragraph tag, H1/H2/H3 change its size.
          </div>
        </div>

        <Modal
          title="Insert Link"
          open={linkModalVisible}
          onOk={handleConfirmInsertLink}
          onCancel={() => setLinkModalVisible(false)}
          centered
          width={400}
          okText="Insert"
        >
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>
            Enter the link URL (e.g. https://example.com)
          </div>
          <Input
            autoFocus
            size="large"
            placeholder="https://example.com"
            value={linkUrlInput}
            onChange={e => setLinkUrlInput(e.target.value)}
            onPressEnter={handleConfirmInsertLink}
          />
        </Modal>

        <Row gutter={24} style={{ marginBottom: 32 }}>
          <Col span={12}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>META TITLE</div>
            <Input 
              size="large"
              value={formData.metaTitle}
              onChange={e => setFormData({...formData, metaTitle: e.target.value})}
              style={{ borderRadius: 8 }} 
            />
          </Col>
          <Col span={12}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>META DESCRIPTION</div>
            <Input 
              size="large"
              value={formData.metaDescription}
              onChange={e => setFormData({...formData, metaDescription: e.target.value})}
              style={{ borderRadius: 8 }} 
            />
          </Col>
        </Row>

        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <input 
            type="checkbox" 
            checked={formData.isFeatured}
            onChange={e => setFormData({...formData, isFeatured: e.target.checked})}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Featured post</span>
        </div>

          <Button 
            type="primary" 
            size="large"
            style={{ backgroundColor: "#ea580c", border: "none", borderRadius: 8, fontWeight: 700, padding: "0 32px" }}
            onClick={() => handleCreatePost(formData, editData?._id)}
          >
            {editData ? "Update blog post" : "Create blog post"}
          </Button>
      </Card>
    </motion.div>
  );
};

const CreateCategoryView = ({ setView, handleCreateCategory, itemVariants, editData }) => {
  const [formData, setFormData] = useState(editData ? {
    name: editData.name || "",
    slug: editData.slug || "",
    description: editData.description || ""
  } : {
    name: "",
    slug: "",
    description: ""
  });

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: '#ea580c', fontWeight: 700 }} onClick={() => setView("manage")}>
        <ArrowLeft size={16} /> Back to Manage
      </div>
      <Title level={3} style={{ marginBottom: 32, color: 'var(--text-primary)', fontWeight: 800 }}>{editData ? "Edit category" : "New category"}</Title>
      
      <Card bodyStyle={{ padding: 32 }} style={{ maxWidth: 800, borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>NAME</div>
          <Input 
            size="large"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            style={{ borderRadius: 8 }} 
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>SLUG (OPTIONAL)</div>
          <Input 
            size="large"
            placeholder="auto from name"
            value={formData.slug}
            onChange={e => setFormData({...formData, slug: e.target.value})}
            style={{ borderRadius: 8 }} 
          />
        </div>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-tertiary)', letterSpacing: 0.5 }}>DESCRIPTION</div>
          <TextArea 
            size="large"
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            rows={4} 
            style={{ borderRadius: 8 }} 
          />
        </div>
        <Button 
          type="primary" 
          size="large"
          style={{ backgroundColor: "#ea580c", border: "none", borderRadius: 8, fontWeight: 700, padding: "0 48px" }}
          disabled={!formData.name}
          onClick={() => handleCreateCategory(formData, editData?._id)}
        >
          {editData ? "Update" : "Save"}
        </Button>
      </Card>
    </motion.div>
  );
};


import BlogPostEmbedView from './BlogPostEmbedView';
import { useActionPermissions } from "../../../hooks/useActionPermissions";

const BlogsTab = ({ itemVariants }) => {
  const { canAdd, canEdit, canDelete } = useActionPermissions('/website');
  const [view, setView] = useState("list"); // list, create, manage, settings
  const [blogs, setBlogs] = useState([]);
  const [activeBlog, setActiveBlog] = useState(null);
  const [manageSubTab, setManageSubTab] = useState("posts");
  const [websites, setWebsites] = useState([]);
  const stores = [];

  const [activeBlogPosts, setActiveBlogPosts] = useState([]);
  const [activeBlogCategories, setActiveBlogCategories] = useState([]);
  const [editingData, setEditingData] = useState(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const token = localStorage.getItem("token");
        const webRes = await fetch("/api/websites", { headers: { "Authorization": token ? `Bearer ${token}` : "" } });
        const webData = await webRes.json();
        if (webData.success) setWebsites(webData.data || []);
      } catch (err) {
        console.error("Failed to fetch websites", err);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (view === "manage" && activeBlog) {
      const fetchManageData = async () => {
        try {
          const token = localStorage.getItem("token");
          const [postsRes, catsRes] = await Promise.all([
            fetch(`/api/blogs/${activeBlog.key}/posts`, { headers: { "Authorization": token ? `Bearer ${token}` : "" } }),
            fetch(`/api/blogs/${activeBlog.key}/categories`, { headers: { "Authorization": token ? `Bearer ${token}` : "" } })
          ]);
          const pData = await postsRes.json();
          const cData = await catsRes.json();
          if (pData.success) setActiveBlogPosts(pData.data);
          if (cData.success) setActiveBlogCategories(cData.data);
        } catch (err) {
          console.error(err);
        }
      };
      fetchManageData();
    }
  }, [view, activeBlog]);

  useEffect(() => {
    const fetchBlogs = async () => {
      if (view !== "list") return;
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/blogs", {
          headers: { "Authorization": token ? `Bearer ${token}` : "" }
        });
        const data = await res.json();
        if (data.success) {
          setBlogs(data.data.map(b => ({
            key: b._id,
            name: b.name,
            slug: b.slug,
            assignedTo: b.assignedTo || 'Any site / store',
            posts: b.posts || 0,
            categories: b.categories || 0,
            publicUrl: b.publicUrl || `/blog/${b.slug}`,
            website: b.websiteId || '—',
            webstore: b.storeId || '—',
            description: b.description || '',
            status: b.status || 'active',
            postsPerPage: b.postsPerPage || 12
          })));
        }
      } catch (e) {
        console.error("Failed to fetch blogs from API");
      }
    };
    fetchBlogs();
  }, [view]);

  const handleCreateBlog = async (newBlogData) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/blogs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          ...newBlogData,
          slug: newBlogData.name.toLowerCase().replace(/\s+/g, '-')
        })
      });
      const data = await res.json();
      if (data.success) {
        setView("list");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePost = async (postData, id) => {
    try {
      const token = localStorage.getItem("token");
      const url = id ? `/api/blogs/posts/${id}` : `/api/blogs/${activeBlog.key}/posts`;
      const method = id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          ...postData,
          categories: postData.categoryId && postData.categoryId !== '—' ? [postData.categoryId] : []
        })
      });
      const data = await res.json();
      if (data.success) {
        // Fetch fresh posts list to reflect the new creation
        const postsRes = await fetch(`/api/blogs/${activeBlog.key}/posts`, { headers: { "Authorization": token ? `Bearer ${token}` : "" } });
        const pData = await postsRes.json();
        if (pData.success) setActiveBlogPosts(pData.data);
        
        // Switch back to posts list
        setManageSubTab("posts");
        setView("manage");
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateCategory = async (catData, id) => {
    try {
      const token = localStorage.getItem("token");
      const url = id ? `/api/blogs/categories/${id}` : `/api/blogs/${activeBlog.key}/categories`;
      const method = id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(catData)
      });
      const data = await res.json();
      if (data.success) {
        // Fetch fresh categories list to reflect the new creation/update
        const catsRes = await fetch(`/api/blogs/${activeBlog.key}/categories`, { headers: { "Authorization": token ? `Bearer ${token}` : "" } });
        const cData = await catsRes.json();
        if (cData.success) setActiveBlogCategories(cData.data);

        setManageSubTab("categories");
        setView("manage");
      }
    } catch (err) { console.error(err); }
  };

  const handleDeletePost = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/blogs/posts/${id}`, {
        method: "DELETE",
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setActiveBlogPosts(prev => prev.filter(p => p._id !== id));
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteCategory = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/blogs/categories/${id}`, {
        method: "DELETE",
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setActiveBlogCategories(prev => prev.filter(c => c._id !== id));
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateBlog = async (updatedData) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/blogs/${activeBlog.key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(updatedData)
      });
      const data = await res.json();
      if (data.success) {
        setActiveBlog({ ...activeBlog, ...updatedData });
        setView("manage");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBlog = async (key) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/blogs/${key}`, {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setBlogs(blogs.filter(b => b.key !== key));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderList = () => {
    const columns = [
      {
        title: "BLOG",
        dataIndex: "blog",
        key: "blog",
        render: (_, record) => (
          <div>
            <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 15 }}>{record.name}</div>
            <div style={{ color: "var(--text-secondary)", fontSize: "13px", fontWeight: 500 }}>{record.slug}</div>
          </div>
        )
      },
      {
        title: "ASSIGNED TO",
        dataIndex: "assignedTo",
        key: "assignedTo",
        render: (text) => <Text type="secondary" style={{ fontWeight: 500 }}>{text}</Text>
      },
      {
        title: "POSTS",
        dataIndex: "posts",
        key: "posts",
        render: (_, record) => <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{record.posts} <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>/ {record.categories} cat.</span></span>
      },
      {
        title: "PUBLIC URL",
        dataIndex: "publicUrl",
        key: "publicUrl",
        render: (text) => <span style={{ color: "var(--accent-info)", fontWeight: 600 }}>{text}</span>
      },
      {
        title: "ACTIONS",
        key: "actions",
        align: "right",
        render: (_, record) => (
          <Space>
            <span 
              style={{ color: "var(--accent-primary)", fontWeight: 700, cursor: "pointer", display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => {
                setActiveBlog(record);
                setView("manage");
              }}
            >
              Manage <ArrowRight size={14} />
            </span>
            {canDelete && (
              <Popconfirm title="Delete this blog?" onConfirm={() => handleDeleteBlog(record.key)}>
                <Button type="text" danger icon={<Trash2 size={16} />} size="small" style={{ borderRadius: 6 }} />
              </Popconfirm>
            )}
          </Space>
        )
      },
    ];

    return (
      <motion.div variants={itemVariants}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={4} style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Newspaper size={24} color="var(--accent-primary)" /> Blogs
            </Title>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
              WordPress-style blogs — assign templates, embed modules in the page builder.
            </Text>
          </div>
          <Space>
            {canAdd && (
              <Button 
                type="primary" 
                icon={<Plus size={18} />} 
                style={{ backgroundColor: "var(--accent-primary)", border: 'none', borderRadius: 8, fontWeight: 700, height: 44, padding: '0 24px', boxShadow: 'var(--shadow-md)' }}
                onClick={() => setView("create")}
              >
                New blog
              </Button>
            )}
          </Space>
        </div>

        <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <Table scroll={{ x: 800 }} 
            columns={columns}
            dataSource={blogs}
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
                    <Newspaper size={40} />
                  </div>
                  <Title level={4} style={{ marginBottom: 12, color: 'var(--text-primary)', fontWeight: 800 }}>No blogs yet</Title>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 32, fontSize: 15, fontWeight: 500 }}>
                    Click <strong style={{ color: "var(--text-primary)" }}>+ New blog</strong> to start writing articles.
                  </Text>
                  {canAdd && <Button type="primary" icon={<Plus size={18} />} onClick={() => setView("create")} style={{ borderRadius: 8, height: 44, background: 'var(--accent-primary)', border: 'none', fontWeight: 700, padding: '0 32px' }}>Create Blog</Button>}
                </div>
              )
            }}
          />
        </Card>
      </motion.div>
    );
  };

  const renderManage = () => {
    if (!activeBlog) return null;

    const recentPosts = [
      "Learning doesn't stop at school. Simple daily routines and engaging activities at home can greatly enhance a child's understanding and curiosity.",
      "The Importance of Early Childhood Learning",
      "Building a Scalable React Architecture for 2026",
      "Why Glassmorphism is the New Standard",
      "Optimizing SEO for Modern Single Page Applications"
    ];

    return (
      <motion.div variants={itemVariants}>
        <div style={{ padding: "0" }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }} onClick={() => setView("list")}>
            <ArrowLeft size={16} /> Back to Blogs
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <Title level={2} style={{ margin: 0, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 900 }}>{activeBlog.name}</Title>
              <div style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                Public URL: <span style={{ color: "var(--accent-info)", fontWeight: 600 }}>{activeBlog.publicUrl}</span>
              </div>
            </div>
            <Space>
              {canEdit && (
                <Button size="large" style={{ borderRadius: 8, fontWeight: 700, borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} onClick={() => setView("settings")} icon={<Settings size={16} />}>
                  Settings
                </Button>
              )}
              {canAdd && (
                <Button size="large" type="primary" icon={<Plus size={16} />} style={{ backgroundColor: "#ea580c", border: "none", borderRadius: 8, fontWeight: 700 }} onClick={() => {
                  setEditingData(null);
                  manageSubTab === 'categories' ? setView("create-category") : setView("create-post");
                }}>
                  {manageSubTab === 'categories' ? "New category" : "New post"}
                </Button>
              )}
            </Space>
          </div>

          <Row gutter={24} style={{ marginBottom: 32 }}>
            <Col span={8}>
              <Card bodyStyle={{ padding: 24 }} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> POSTS</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{activeBlogPosts.length}</div>
              </Card>
            </Col>
            <Col span={8}>
              <Card bodyStyle={{ padding: 24 }} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><TagIcon size={14} /> CATEGORIES</div>
                <div style={{ fontSize: 36, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{activeBlogCategories.length}</div>
              </Card>
            </Col>
            <Col span={8}>
              <Card bodyStyle={{ padding: 24, height: "100%", display: "flex", alignItems: "center" }} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: activeBlog.website && activeBlog.website !== '—' ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  {activeBlog.website && activeBlog.website !== '—' ? 
                    `Assigned to: ${websites.find(w => w._id === activeBlog.website)?.name || 'Unknown Website'}` 
                    : "Unassigned to site"}
                </div>
              </Card>
            </Col>
          </Row>

          <div style={{ display: 'flex', gap: 12, marginBottom: 32, borderBottom: '2px solid var(--border-color)', paddingBottom: 0 }}>
            {[
              { key: "posts", label: "Posts", icon: <LayoutList size={16} /> },
              { key: "categories", label: "Categories", icon: <LayoutTemplate size={16} /> }
            ].map(tab => (
              <div 
                key={tab.key}
                onClick={() => setManageSubTab(tab.key)}
                style={{
                  padding: '12px 16px',
                  color: manageSubTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: manageSubTab === tab.key ? 800 : 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  borderBottom: manageSubTab === tab.key ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  marginBottom: -2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
              >
                {tab.icon} {tab.label}
              </div>
            ))}
          </div>

          {manageSubTab === "posts" && (
            <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 32, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
                Recent posts
              </div>
              <div>
                {activeBlogPosts.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: 'var(--text-secondary)' }}>No posts found. Create one!</div>
                ) : (
                  activeBlogPosts.map((post, idx) => (
                    <div key={post._id} style={{ padding: "20px 24px", borderBottom: idx !== activeBlogPosts.length - 1 ? "1px solid var(--border-color)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }} className="hover-bg-primary">
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 4 }}>{post.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, display: 'flex', gap: 12 }}>
                          <span>{post.status.toUpperCase()}</span>
                          {post.websiteId && <span>Website ID: {post.websiteId}</span>}
                        </div>
                      </div>
                      <Space size="middle" style={{ color: "var(--accent-primary)", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => {
                          setEditingData(post);
                          setView("create-post");
                        }}><Edit3 size={14} /> Edit</span>
                        <Popconfirm title="Delete this post?" onConfirm={() => handleDeletePost(post._id)}>
                          <span style={{ color: "#ef4444", display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={14} /> Delete</span>
                        </Popconfirm>
                      </Space>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          {manageSubTab === "categories" && (
            <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 32, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
                Categories
              </div>
              <div>
                {activeBlogCategories.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: 'var(--text-secondary)' }}>No categories found. Create one!</div>
                ) : (
                  activeBlogCategories.map((cat, idx) => (
                    <div key={cat._id} style={{ padding: "20px 24px", borderBottom: idx !== activeBlogCategories.length - 1 ? "1px solid var(--border-color)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }} className="hover-bg-primary">
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 4 }}>{cat.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>/{cat.slug}</div>
                      </div>
                      <Space size="middle" style={{ color: "var(--accent-primary)", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => {
                          setEditingData(cat);
                          setView("create-category");
                        }}><Edit3 size={14} /> Edit</span>
                        <Popconfirm title="Delete this category?" onConfirm={() => handleDeleteCategory(cat._id)}>
                          <span style={{ color: "#ef4444", display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={14} /> Delete</span>
                        </Popconfirm>
                      </Space>
                    </div>
                  ))
                )}
              </div>
            </Card>
          )}

          <div style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", padding: 24, borderRadius: 16, color: "var(--accent-primary)", display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <FileText size={24} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ lineHeight: 1.6, fontSize: 14 }}>
              <strong style={{ fontWeight: 800, display: 'block', marginBottom: 4, fontSize: 15 }}>Page builder integration</strong>
              Open any page on the assigned website → <strong style={{ fontWeight: 800 }}>Blog</strong> tab → drag <em>Latest, Featured</em>, or <em>Blog menu</em> modules. Create menus under <strong style={{ fontWeight: 800 }}>Menus</strong> with type "Blog home" or "Blog post".
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div style={{ position: "relative" }}>
      {view === "list" && renderList()}
      {view === "create" && <CreateBlogView setView={setView} handleCreateBlog={handleCreateBlog} itemVariants={itemVariants} websites={websites} stores={stores} />}
      {view === "create-post" && <CreatePostView setView={setView} handleCreatePost={handleCreatePost} itemVariants={itemVariants} websites={websites} stores={stores} categories={activeBlogCategories} editData={editingData} />}
      {view === "create-category" && <CreateCategoryView setView={setView} handleCreateCategory={handleCreateCategory} itemVariants={itemVariants} editData={editingData} />}
      {view === "manage" && renderManage()}
      {view === "settings" && <SettingsBlogView activeBlog={activeBlog} setView={setView} handleUpdateBlog={handleUpdateBlog} itemVariants={itemVariants} websites={websites} stores={stores} />}
    </div>
  );
};

export default BlogsTab;