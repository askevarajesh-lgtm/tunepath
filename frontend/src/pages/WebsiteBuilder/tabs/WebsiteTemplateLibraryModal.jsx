import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { Modal, Input, Button, Typography, Space, Row, Col, Card, Tag, message, Spin, Popconfirm } from "antd";
import { Globe, X as CloseIcon, Search as SearchIcon, CheckCircle, Upload as UploadIcon, Trash2 } from "lucide-react";

const { Title, Text } = Typography;

const WebsiteTemplateLibraryModal = ({ open, onCancel, onCreate, initialWebsiteName, initialShowUploadBox = false }) => {
  const [websiteName, setWebsiteName] = useState(initialWebsiteName || "");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [showUploadBox, setShowUploadBox] = useState(initialShowUploadBox);
  const [uploadTemplateName, setUploadTemplateName] = useState("");
  const [selectedUploadFile, setSelectedUploadFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (initialWebsiteName) {
      setWebsiteName(initialWebsiteName);
    }
  }, [initialWebsiteName]);

  useEffect(() => {
    if (open) {
      fetchTemplates();
      setShowUploadBox(initialShowUploadBox);
    }
  }, [open, initialShowUploadBox]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch("/api/templates?type=website", {
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data.templates);
        const catNames = ["All", ...data.data.categories.map(c => c.name)];
        setCategories(catNames);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      message.error("Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedUploadFile(file);
    }
  };

  const handleZipUpload = async () => {
    if (!selectedUploadFile) return;

    setIsUploadingTemplate(true);
    try {
      // Validate ZIP contains index.html
      const zip = new JSZip();
      const loadedZip = await zip.loadAsync(selectedUploadFile);
      let hasIndexHtml = false;
      let htmlFilesCount = 0;
      
      loadedZip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.html')) {
          htmlFilesCount++;
        }
        if (!zipEntry.dir && relativePath.toLowerCase().endsWith('index.html')) {
          hasIndexHtml = true;
        }
      });

      if (!hasIndexHtml) {
        message.error({ content: 'Invalid template: ZIP must contain an index.html file.', key: 'upload' });
        setIsUploadingTemplate(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedUploadFile);
      
      const defaultName = selectedUploadFile.name.replace(".zip", "");
      formData.append("name", uploadTemplateName.trim() ? uploadTemplateName.trim() : defaultName);
      formData.append("type", "website");
      formData.append("category", "Custom Uploads");
      formData.append("featuresCount", htmlFilesCount);

      const token = localStorage.getItem("token");
      const res = await fetch("/api/templates/upload", {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        message.success({ content: 'Template uploaded successfully', key: 'upload' });
        await fetchTemplates();
        if (data.data && data.data._id) {
          setSelectedTemplate(data.data._id);
          setSelectedCategory("All"); 
          setWebsiteName(data.data.name);
          setShowUploadBox(false);
          setSelectedUploadFile(null);
          setUploadTemplateName("");
        }
      } else {
        message.error({ content: data.error || 'Failed to upload', key: 'upload' });
      }
    } catch (error) {
      console.error(error);
      message.error({ content: 'Error processing template upload', key: 'upload' });
    } finally {
      setIsUploadingTemplate(false);
    }
    
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreate({ 
        name: websiteName, 
        template: selectedTemplate ? templates.find(t => t._id === selectedTemplate)?.name : null,
        type: "template"
      });
      setSelectedTemplate(null);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTemplate = async (e, id) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        message.success("Template deleted successfully");
        if (selectedTemplate === id) setSelectedTemplate(null);
        await fetchTemplates();
      } else {
        message.error(data.error || "Failed to delete template");
      }
    } catch (error) {
      console.error(error);
      message.error("An error occurred while deleting the template");
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <Spin fullscreen spinning={isUploadingTemplate} tip="Uploading template..." size="large" />
      <Modal
        open={open}
      onCancel={onCancel}
      footer={null}
      width={1100}
      closeIcon={<Button type="text" icon={<CloseIcon size={20} />} onClick={onCancel} style={{ color: "var(--text-secondary)" }} />}
      style={{ top: 30 }}
      bodyStyle={{ padding: 0, borderRadius: 16, overflow: "hidden" }}
      className="glassmorphism-modal"
    >
      <div style={{ display: "flex", height: "80vh", maxHeight: 800 }}>
        {/* Sidebar */}
        <div style={{ width: 260, borderRight: "1px solid var(--border-color)", padding: "24px 16px", overflowY: "auto", background: "var(--bg-secondary)", display: "flex", flexDirection: "column" }}>
          <Title level={4} style={{ marginBottom: 24, fontSize: 18, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
            <Globe size={20} color="var(--accent-info)" /> Website Templates
          </Title>
          
          <div 
            onClick={() => setSelectedCategory("All")}
            style={{ 
              background: selectedCategory === "All" ? "rgba(14, 165, 233, 0.1)" : "transparent", 
              color: selectedCategory === "All" ? "var(--accent-info)" : "var(--text-primary)", 
              padding: "10px 16px", 
              borderRadius: 8, 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              marginBottom: 8, 
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <span>All Templates</span>
            <Tag style={{ margin: 0, borderRadius: 12, background: selectedCategory === "All" ? "rgba(14, 165, 233, 0.2)" : "var(--bg-tertiary)", border: "none", color: selectedCategory === "All" ? "var(--accent-info)" : "var(--text-secondary)" }}>{templates.length}</Tag>
          </div>
          
          <div style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", color: "var(--text-secondary)", marginBottom: 24, cursor: "not-allowed", fontWeight: 500 }}>
            <span>My Templates</span>
            <Text type="secondary" style={{ fontSize: 12 }}>0</Text>
          </div>

          <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, marginBottom: 16, display: "block" }}>BROWSE CATEGORIES</Text>
          
          <Space direction="vertical" style={{ width: "100%", flex: 1 }}>
            {categories.slice(1).map(cat => (
              <div 
                key={cat} 
                onClick={() => setSelectedCategory(cat)}
                style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "10px 12px", 
                  cursor: "pointer",
                  borderRadius: 8,
                  background: selectedCategory === cat ? "rgba(14, 165, 233, 0.05)" : "transparent",
                  color: selectedCategory === cat ? "var(--accent-info)" : "var(--text-secondary)",
                  fontWeight: selectedCategory === cat ? 700 : 500
                }}
              >
                <span style={{ fontSize: 13 }}>{cat}</span>
                <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>{templates.filter(t => t.category === cat).length}</span>
              </div>
            ))}
          </Space>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
          <div style={{ padding: 24, borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Title level={4} style={{ margin: 0, fontSize: 18, color: "var(--text-primary)" }}>Website library</Title>
                <Text type="secondary">
                  {isCreating ? (
                    <span style={{ color: "var(--accent-info)", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                      <Spin size="small" /> Website template is currently being uploaded...
                    </span>
                  ) : (
                    "Select a layout to jump-start your project"
                  )}
                </Text>
              </div>
              <Space>
                <Button 
                  icon={<UploadIcon size={16} />}
                  onClick={() => setShowUploadBox(!showUploadBox)}
                  style={{ borderRadius: 8, height: 40, fontWeight: 600, borderColor: showUploadBox ? "var(--accent-info)" : "var(--border-color)", background: showUploadBox ? "rgba(14, 165, 233, 0.1)" : "var(--bg-primary)", color: showUploadBox ? "var(--accent-info)" : "var(--text-primary)" }}
                >
                  Upload ZIP
                </Button>
                <Input 
                  placeholder="Search website templates..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  prefix={<SearchIcon size={16} color="var(--text-tertiary)" />} 
                  style={{ width: 250, borderRadius: 8, height: 40 }} 
                />
              </Space>
            </div>
          </div>

          {showUploadBox && (
            <div style={{ padding: "16px 24px", background: "rgba(16, 185, 129, 0.05)", borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 12, padding: "20px", background: "var(--bg-primary)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 16 }}>
                  ZIP with <span style={{ fontFamily: "monospace", background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 4 }}>index.html</span> and assets folders.
                </div>
                <Space size="large" align="center" style={{ width: "100%", flexWrap: "wrap" }}>
                  <Input 
                    placeholder="Template name (optional)" 
                    value={uploadTemplateName}
                    onChange={(e) => setUploadTemplateName(e.target.value)}
                    style={{ width: 250, height: 40, borderRadius: 8 }}
                  />
                  
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-color)", borderRadius: 8, padding: "4px 12px 4px 4px", background: "var(--bg-secondary)", height: 40 }}>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      accept=".zip,application/zip" 
                      onChange={handleFileSelect} 
                    />
                    <Button 
                      type="primary"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ background: "var(--accent-success)", border: "none", borderRadius: 6, fontWeight: 600, height: 32, marginRight: 12 }}
                    >
                      Choose File
                    </Button>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {selectedUploadFile ? selectedUploadFile.name : "No file chosen"}
                    </span>
                  </div>

                  <Button 
                    type="primary" 
                    onClick={handleZipUpload}
                    disabled={!selectedUploadFile}
                    style={{ background: "var(--accent-success)", border: "none", borderRadius: 8, height: 40, fontWeight: 700, padding: "0 24px" }}
                  >
                    Upload
                  </Button>
                </Space>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            <Row gutter={[24, 24]}>
              {filteredTemplates.map(template => {
                const isSelected = selectedTemplate === template._id;
                return (
                  <Col span={12} key={template._id}>
                    <Card 
                      hoverable 
                      onClick={() => setSelectedTemplate(template._id)}
                      style={{ 
                        borderRadius: 16, 
                        overflow: "hidden",
                        border: isSelected ? "2px solid var(--accent-info)" : "1px solid var(--border-color)",
                        boxShadow: isSelected ? "0 4px 20px rgba(14, 165, 233, 0.15)" : "var(--shadow-sm)",
                        background: "var(--bg-secondary)",
                        padding: 0
                      }}
                      bodyStyle={{ padding: 0 }}
                    >
                      <div style={{ height: 160, background: template.thumbnailColor || "linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))", position: 'relative', overflow: 'hidden', padding: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", position: 'relative', zIndex: 2 }}>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <div style={{ width: 28, height: 28, background: "rgba(255,255,255,0.2)", borderRadius: 6, marginRight: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: 14 }}>W</div>
                            <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>{template.name}</span>
                          </div>
                          <Tag style={{ margin: 0, background: "rgba(255, 255, 255, 0.2)", border: "none", color: "#fff", fontWeight: 700, borderRadius: 6 }}>{template.featuresCount} Pages</Tag>
                        </div>
                        <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, zIndex: 2 }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{template.name}</div>
                          <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.8)", fontWeight: 500 }}>Modern multi-page website optimized for SEO and conversion.</div>
                        </div>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', zIndex: 1 }} />
                      </div>
                      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{template.name}</div>
                          <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 500 }}>{template.category}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {template.canDelete && (
                            <Popconfirm
                              title="Delete template"
                              description="Are you sure to delete this template?"
                              onConfirm={(e) => handleDeleteTemplate(e, template._id)}
                              onCancel={(e) => e.stopPropagation()}
                              okText="Yes"
                              cancelText="No"
                            >
                              <Button
                                type="text"
                                icon={<Trash2 size={16} />}
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: "var(--accent-error)", padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              />
                            </Popconfirm>
                          )}
                          {isSelected && (
                            <div style={{ color: "var(--accent-info)", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center" }}>
                              <CheckCircle size={16} style={{ marginRight: 6 }} /> SELECTED
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Col>
                );
              })}
              {filteredTemplates.length === 0 && (
                <Col span={24} style={{ textAlign: "center", padding: "60px 0" }}>
                  <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>No templates match your search or filter.</Text>
                </Col>
              )}
            </Row>
          </div>

          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-color)", background: "var(--bg-secondary)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ width: 320 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Website name</div>
              <Input 
                value={websiteName} 
                onChange={(e) => setWebsiteName(e.target.value)} 
                style={{ borderRadius: 8, height: 44, fontSize: 15 }}
                placeholder="e.g. Prestige Estates Launch"
              />
            </div>
            
            <Space size="middle">
              <Button onClick={onCancel} style={{ borderRadius: 8, height: 44, fontWeight: 600, padding: "0 24px", borderColor: "var(--border-color)", background: "var(--bg-primary)", color: "var(--text-primary)" }}>Back</Button>
              <Button 
                type="primary" 
                onClick={handleCreate}
                loading={isCreating}
                disabled={!websiteName.trim() || !selectedTemplate || isCreating}
                style={{ backgroundColor: "var(--accent-info)", border: "none", borderRadius: 8, height: 44, fontWeight: 700, padding: "0 24px" }}
              >
                Create Website
              </Button>
            </Space>
          </div>
        </div>
      </div>
      </Modal>
    </>
  );
};

export default WebsiteTemplateLibraryModal;
