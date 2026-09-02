import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Typography, Card, Table, Button, Tag, Space, Modal, Input, message, Drawer, Select, Tooltip, Row, Col, Spin, Image, Upload } from "antd";
import { ArrowLeft, ExternalLink, Plus, Edit2, Trash2, Activity, RefreshCcw, Image as ImageIcon, Layout, AlertTriangle, Sparkles, FileText, CheckCircle, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";
import RichTextEditor from "../../../components/RichTextEditor";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const WordPressPosts = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Data State
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [media, setMedia] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [status, setStatus] = useState("publish");
  const [authorId, setAuthorId] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [featuredMediaId, setFeaturedMediaId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { "Authorization": token ? `Bearer ${token}` : "" };
      
      const [postsRes, catRes, tagRes, authRes, mediaRes] = await Promise.all([
        fetch(`/api/wordpress/${id}/posts`, { headers }),
        fetch(`/api/wordpress/${id}/categories`, { headers }),
        fetch(`/api/wordpress/${id}/tags`, { headers }),
        fetch(`/api/wordpress/${id}/authors`, { headers }),
        fetch(`/api/wordpress/${id}/media`, { headers })
      ]);

      const [postsData, catData, tagData, authData, mediaData] = await Promise.all([
        postsRes.json(), catRes.json(), tagRes.json(), authRes.json(), mediaRes.json()
      ]);

      if (postsData.success) setPosts(postsData.data);
      if (catData.success) setCategories(catData.data);
      if (tagData.success) setTags(tagData.data);
      if (authData.success) {
        setAuthors(authData.data);
        if (authData.data.length > 0) setAuthorId(authData.data[0].id);
      }
      if (mediaData.success) setMedia(mediaData.data);
      
    } catch (err) {
      console.error(err);
      message.error("Error fetching WordPress data");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(location.pathname.replace(/\/posts$/, '/dashboard'));
  };

  const openDrawer = (post = null) => {
    if (post) {
      setEditingPost(post);
      setTitle(post.title?.raw || post.title?.rendered || "");
      setContent(post.content?.raw || post.content?.rendered || "");
      setExcerpt(post.excerpt?.rendered || "");
      setStatus(post.status || "publish");
      setAuthorId(post.author || (authors.length > 0 ? authors[0].id : null));
      setSelectedCategories(post.categories || []);
      setSelectedTags(post.tags || []);
      setFeaturedMediaId(post.featured_media || null);
    } else {
      setEditingPost(null);
      setTitle("");
      setContent("");
      setExcerpt("");
      setStatus("publish");
      setAuthorId(authors.length > 0 ? authors[0].id : null);
      setSelectedCategories([]);
      setSelectedTags([]);
      setFeaturedMediaId(null);
    }
    setDrawerVisible(true);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setEditingPost(null);
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
        excerpt,
        status,
        author: authorId,
        categories: selectedCategories,
        tags: selectedTags,
        featured_media: featuredMediaId
      };
      
      const endpoint = editingPost 
        ? `/api/wordpress/${id}/posts/${editingPost.id}`
        : `/api/wordpress/${id}/posts`;
        
      const method = editingPost ? "PUT" : "POST";
      
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
        message.success(`Post ${editingPost ? 'updated' : 'created'} successfully`);
        closeDrawer();
        fetchData();
      } else {
        message.error(data.message || "Failed to save post");
      }
    } catch (err) {
      console.error(err);
      message.error("Error saving post");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (postId) => {
    Modal.confirm({
      title: <div style={{ fontSize: 18, fontWeight: 900 }}>Delete this post?</div>,
      content: <div style={{ fontWeight: 500 }}>This will move the post to trash in WordPress.</div>,
      okText: "Yes, delete",
      cancelText: "Cancel",
      okButtonProps: { danger: true, style: { borderRadius: 8, fontWeight: 700 } },
      cancelButtonProps: { style: { borderRadius: 8, fontWeight: 600 } },
      className: "glassmorphism-modal",
      onOk: async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`/api/wordpress/${id}/posts/${postId}`, {
            method: "DELETE",
            headers: { "Authorization": token ? `Bearer ${token}` : "" }
          });
          const data = await res.json();
          if (data.success) {
            message.success("Post deleted successfully");
            fetchData();
          } else {
            message.error(data.message || "Failed to delete post");
          }
        } catch (err) {
          message.error("Error deleting post");
        }
      }
    });
  };

  const handleUpload = async (options) => {
    const { onSuccess, onError, file } = options;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("token");
      const res = await fetch(`/api/wordpress/${id}/media`, {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        message.success("Image uploaded successfully");
        setMedia([data.data, ...media]);
        setFeaturedMediaId(data.data.id);
        setMediaModalVisible(false);
        onSuccess("Ok");
      } else {
        message.error(data.message || "Upload failed");
        onError(new Error(data.message));
      }
    } catch (err) {
      console.error("Upload error", err);
      message.error("Error uploading image");
      onError(err);
    } finally {
      setUploading(false);
    }
  };

  const columns = [
    {
      title: "TITLE",
      dataIndex: "title",
      key: "title",
      render: (t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={16} color="#10b981" />
          </div>
          <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: 15 }} dangerouslySetInnerHTML={{ __html: t.rendered || '(No title)' }}></span>
        </div>
      )
    },
    {
      title: "AUTHOR",
      dataIndex: "author",
      key: "author",
      render: (authorId) => {
        const author = authors.find(a => a.id === authorId);
        return <Text style={{ fontWeight: 600 }}>{author?.name || 'Unknown'}</Text>;
      }
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

  const getFeaturedImageUrl = () => {
    if (!featuredMediaId) return null;
    const item = media.find(m => m.id === featuredMediaId);
    return item ? item.source_url : null;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: '#10b981', fontWeight: 700 }} onClick={handleBack}>
        <ArrowLeft size={16} /> Back to Dashboard
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 900 }}>SEO Blog Posts</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Manage fully-featured SEO blog posts directly from your CRM.</Text>
        </div>
        
        <Space>
          <Button size="large" icon={<RefreshCcw size={16} />} onClick={fetchData} loading={loading} style={{ borderRadius: 8, fontWeight: 700, borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            Sync
          </Button>
          <Button size="large" type="primary" icon={<Plus size={16} />} onClick={() => openDrawer()} style={{ borderRadius: 8, fontWeight: 800, background: '#10b981', border: 'none' }}>
            New Post
          </Button>
        </Space>
      </div>

      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
        <Table 
          columns={columns} 
          dataSource={posts} 
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
        title={<div style={{ fontSize: 18, fontWeight: 900 }}>{editingPost ? 'Edit Blog Post' : 'Create SEO Blog Post'}</div>}
        width={1000}
        onClose={closeDrawer}
        open={drawerVisible}
        bodyStyle={{ padding: 24, paddingBottom: 80, background: 'var(--bg-primary)' }}
        extra={
          <Space>
            <Button onClick={closeDrawer} style={{ borderRadius: 8, fontWeight: 700 }}>Cancel</Button>
            <Button onClick={handleSave} type="primary" loading={saving} disabled={editingPost && ['elementor', 'divi', 'wpbakery', 'pagelayer'].includes(editingPost.pageBuilder)} style={{ background: '#10b981', border: 'none', borderRadius: 8, fontWeight: 800 }}>
              {editingPost ? 'Update Post' : 'Publish Post'}
            </Button>
          </Space>
        }
      >
        <Row gutter={32}>
          {/* Main Content Column */}
          <Col xs={24} lg={16}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>POST TITLE <span style={{ color: "var(--accent-danger)" }}>*</span></div>
              <Input 
                size="large"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 10 Tips for Better SEO"
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 16 }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>POST CONTENT (HTML SUPPORTED)</div>
              
              {editingPost && ['elementor', 'divi', 'wpbakery', 'pagelayer'].includes(editingPost.pageBuilder) ? (
                <div style={{ padding: "24px", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: 12, color: "var(--text-primary)" }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: "var(--accent-warning)", marginBottom: 12, fontSize: 16 }}>
                    <AlertTriangle size={20} /> Page Builder Detected
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                    This post is built with <b style={{ textTransform: 'capitalize' }}>{editingPost.pageBuilder}</b>. Due to WordPress restrictions, the content cannot be updated through this basic text editor. 
                    <br/><br/>
                    To safely edit the visual layout and text of this post, please close this drawer and click the <b>{editingPost.pageBuilder === 'elementor' ? 'Edit with Elementor (Pink Icon)' : editingPost.pageBuilder === 'divi' ? 'Edit with Divi (Purple Icon)' : 'Native WP Edit'}</b> button in the posts table!
                  </div>
                </div>
              ) : (
                <RichTextEditor
                  value={content}
                  onChange={(val) => setContent(val)}
                  placeholder="My New Article... Start writing here..."
                />
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>EXCERPT (SEO SUMMARY)</div>
              <TextArea
                rows={4}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Write a brief summary of this post for search engines..."
                style={{ borderRadius: 8, fontSize: 14, background: 'var(--bg-secondary)' }}
              />
            </div>
          </Col>

          {/* Sidebar Settings Column */}
          <Col xs={24} lg={8}>
            <Card style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', marginBottom: 24 }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>PUBLISH STATUS</div>
                <Select size="large" value={status} onChange={setStatus} style={{ width: '100%' }} dropdownStyle={{ borderRadius: 8 }}>
                  <Option value="publish">Published</Option>
                  <Option value="draft">Draft</Option>
                  <Option value="pending">Pending Review</Option>
                  <Option value="private">Private</Option>
                </Select>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>AUTHOR</div>
                <Select size="large" value={authorId} onChange={setAuthorId} style={{ width: '100%' }} dropdownStyle={{ borderRadius: 8 }}>
                  {authors.map(a => <Option key={a.id} value={a.id}>{a.name}</Option>)}
                </Select>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>CATEGORIES</div>
                <Select mode="multiple" size="large" value={selectedCategories} onChange={setSelectedCategories} style={{ width: '100%' }} placeholder="Select categories" dropdownStyle={{ borderRadius: 8 }}>
                  {categories.map(c => <Option key={c.id} value={c.id}>{c.name}</Option>)}
                </Select>
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>TAGS</div>
                <Select mode="multiple" size="large" value={selectedTags} onChange={setSelectedTags} style={{ width: '100%' }} placeholder="Select tags" dropdownStyle={{ borderRadius: 8 }}>
                  {tags.map(t => <Option key={t.id} value={t.id}>{t.name}</Option>)}
                </Select>
              </div>
            </Card>

            <Card style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 16 }}>FEATURED IMAGE</div>
              
              {featuredMediaId ? (
                <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <Image src={getFeaturedImageUrl()} alt="Featured" style={{ width: '100%', height: 'auto', display: 'block' }} preview={false} />
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 8 }}>
                    <Button size="small" type="primary" onClick={() => setMediaModalVisible(true)} style={{ borderRadius: 4, fontWeight: 700 }}>Replace</Button>
                    <Button size="small" danger onClick={() => setFeaturedMediaId(null)} style={{ borderRadius: 4, fontWeight: 700 }}>Remove</Button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => setMediaModalVisible(true)}
                  style={{ 
                    height: 120, border: '1px dashed var(--border-color)', borderRadius: 8, 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', background: 'var(--bg-primary)', color: 'var(--text-tertiary)'
                  }}
                >
                  <ImageIcon size={24} style={{ marginBottom: 8 }} />
                  <Text style={{ fontWeight: 600 }}>Set Featured Image</Text>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Drawer>

      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Select Featured Image</div>
            <Upload customRequest={handleUpload} showUploadList={false} accept="image/*">
              <Button type="primary" icon={<UploadCloud size={16} />} loading={uploading} style={{ background: '#10b981', border: 'none', borderRadius: 8, fontWeight: 700 }}>
                Upload Image
              </Button>
            </Upload>
          </div>
        }
        open={mediaModalVisible}
        onCancel={() => setMediaModalVisible(false)}
        footer={null}
        width={800}
        className="glassmorphism-modal"
      >
        <div style={{ maxHeight: 500, overflowY: 'auto', padding: '10px 0' }}>
          <Row gutter={[16, 16]}>
            {media.filter(m => m.media_type === 'image').map(item => (
              <Col span={6} key={item.id}>
                <div 
                  onClick={() => {
                    setFeaturedMediaId(item.id);
                    setMediaModalVisible(false);
                  }}
                  style={{ 
                    borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    border: featuredMediaId === item.id ? '2px solid #10b981' : '1px solid var(--border-color)',
                    height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-secondary)'
                  }}
                >
                  <img src={item.source_url} alt="Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </Col>
            ))}
            {media.filter(m => m.media_type === 'image').length === 0 && (
              <div style={{ width: '100%', textAlign: 'center', padding: 40 }}>
                <Text type="secondary">No images found in your WordPress Media Library.</Text>
              </div>
            )}
          </Row>
        </div>
      </Modal>
    </div>
  );
};

export default WordPressPosts;
