import React, { useState, useEffect } from "react";
import { Button, Input, Table, Typography, Space, Select, DatePicker, Card, Row, Col, Modal, Checkbox, Tag, message, Spin } from "antd";
import { Plus, Search, X, ArrowUp, ArrowDown, Edit3, Copy, HelpCircle, FileText, BarChart3, Inbox, Calendar, Link2, ListPlus, Upload as UploadIcon, Eye, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

const { Title, Text } = Typography;
const { Option } = Select;

import FormBuilderView from './FormBuilderView';
import { useActionPermissions } from "../../../hooks/useActionPermissions";

const FormsTab = ({ itemVariants }) => {
  const { canAdd, canEdit, canDelete } = useActionPermissions('/website');
  const [activeSubTab, setActiveSubTab] = useState("builder");
  const [activeForm, setActiveForm] = useState(null);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const [createType, setCreateType] = useState("templates");
  const [formName, setFormName] = useState("");
  
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const fileInputRef = React.useRef(null);

  const [forms, setForms] = useState([]);
  const [isLoadingForms, setIsLoadingForms] = useState(false);

  const [submissions, setSubmissions] = useState([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [analytics, setAnalytics] = useState({ totalSubmissions: 0, recentSubmissions: 0, formsCount: 0, submissionsPerForm: [] });
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const [submissionFormId, setSubmissionFormId] = useState("all");
  const [submissionSearch, setSubmissionSearch] = useState("");

  const [viewSubmission, setViewSubmission] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    if (!activeForm) {
      fetchForms();
    }
  }, [activeForm]);

  const fetchForms = async () => {
    setIsLoadingForms(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/forms", {
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setForms(data.data.map(f => ({ ...f, key: f._id })));
      }
    } catch (err) {
      message.error("Failed to load forms");
    }
    setIsLoadingForms(false);
  };

  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/forms/analytics", {
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAnalytics(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics", err);
    }
    setIsLoadingAnalytics(false);
  };

  const fetchSubmissions = async () => {
    setIsLoadingSubmissions(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/forms/submissions?formId=${submissionFormId}&search=${encodeURIComponent(submissionSearch)}`, {
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.data.map(s => ({ ...s, key: s._id })));
      }
    } catch (err) {
      console.error("Failed to fetch submissions", err);
    }
    setIsLoadingSubmissions(false);
  };

  const handleDeleteSubmission = async (id) => {
    Modal.confirm({
      title: 'Delete Submission',
      content: 'Are you sure you want to delete this submission? This action cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`/api/forms/submissions/${id}`, {
            method: "DELETE",
            headers: { "Authorization": token ? `Bearer ${token}` : "" }
          });
          const data = await res.json();
          if (data.success) {
            message.success("Submission deleted successfully");
            fetchSubmissions();
            fetchAnalytics();
          } else {
            message.error(data.error || "Failed to delete submission");
          }
        } catch (err) {
          message.error("Failed to delete submission");
        }
      }
    });
  };

  useEffect(() => {
    if (activeSubTab === "analyze") fetchAnalytics();
    if (activeSubTab === "submissions") fetchSubmissions();
  }, [activeSubTab, submissionFormId, submissionSearch]);

  useEffect(() => {
    if (isTemplateModalOpen) {
      fetchTemplates();
    }
  }, [isTemplateModalOpen]);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/form-templates", {
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data.templates);
        const catNames = ["All", ...data.data.categories.map(c => c.name)];
        setCategories(catNames);
      }
    } catch (error) {
      message.error("Failed to load templates");
    }
  };

  const handleZipUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploadingTemplate(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name.replace(".zip", ""));
    formData.append("type", "form");
    formData.append("category", "Custom Uploads");

    try {
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
        }
      } else {
        message.error({ content: data.error || 'Failed to upload', key: 'upload' });
      }
    } catch (error) {
      message.error({ content: 'Error uploading template', key: 'upload' });
    } finally {
      setIsUploadingTemplate(false);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filteredTemplates = templates.filter(template => {
    const nameStr = template.templateName || template.name || "";
    const matchesSearch = nameStr.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  

  const handleCreateContinue = () => {
    setIsCreateModalOpen(false);
    if (createType === "templates") {
      setIsTemplateModalOpen(true);
    } else {
      setActiveForm({ name: formName || "New Form", from: "scratch" });
    }
  };

  const renderHeader = () => {
    switch (activeSubTab) {
      case "builder":
        return { title: "Forms", subtitle: "Build reusable forms, embed them anywhere, and track submissions.", icon: <FileText size={24} color="var(--accent-primary)" /> };
      case "analyze":
        return { title: "Analyze", subtitle: "High-level submission volume across all forms.", icon: <BarChart3 size={24} color="var(--accent-info)" /> };
      case "submissions":
        return { title: "Submissions", subtitle: "Effortlessly review, manage, and export your form entries.", icon: <Inbox size={24} color="var(--accent-success)" /> };
      default:
        return { title: "", subtitle: "", icon: null };
    }
  };

  const headerInfo = renderHeader();

  const renderBuilderList = () => {
    const columns = [
      { title: "NAME", dataIndex: "name", key: "name", render: (t, record) => <span style={{ fontWeight: 800, color: 'var(--accent-primary)', cursor: 'pointer' }} onClick={() => setActiveForm(record)}>{t}</span> },
      { title: "STATUS", dataIndex: "status", key: "status", render: t => <Tag color="green" style={{ borderRadius: 12, padding: '2px 10px', fontWeight: 700 }}>{t}</Tag> },
      { title: "UPDATED", dataIndex: "updatedAt", key: "updatedAt", render: t => <Text type="secondary" style={{ fontWeight: 500 }}>{new Date(t).toLocaleDateString()}</Text> },
      { title: "ACTIONS", key: "actions", align: "right", render: (_, record) => canEdit ? <Button type="link" onClick={() => setActiveForm(record)} style={{ padding: 0, fontWeight: 700 }}>Edit</Button> : null },
    ];

    return (
      <motion.div variants={itemVariants}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <Space>
            <Input placeholder="Search forms..." prefix={<Search size={16} color="var(--text-tertiary)" />} size="large" style={{ width: 280, borderRadius: 8 }} />
          </Space>
        </div>
        <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <Table
            columns={columns}
            dataSource={forms}
            loading={isLoadingForms}
            pagination={{
              defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
              position: ['bottomCenter']
            }}
            scroll={{ x: 800 }}
            locale={{
              emptyText: (
                <div style={{ padding: "80px 0", textAlign: "center" }}>
                  <div style={{ width: 80, height: 80, background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-primary)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <FileText size={40} />
                  </div>
                  <Title level={4} style={{ marginBottom: 12, color: 'var(--text-primary)', fontWeight: 800 }}>No forms yet</Title>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 32, fontSize: 15, fontWeight: 500 }}>
                    Click <strong style={{ color: "var(--text-primary)" }}>+ Create Form</strong> to pick a template or start from scratch.
                  </Text>
                  {canAdd && <Button type="primary" icon={<Plus size={18} />} onClick={() => setIsCreateModalOpen(true)} style={{ borderRadius: 8, height: 44, background: 'var(--accent-primary)', border: 'none', fontWeight: 700, padding: '0 32px' }}>Create Form</Button>}
                </div>
              )
            }}
          />
        </Card>
      </motion.div>
    );
  };

  const renderAnalyze = () => {
    const columns = [
      { title: "FORM", dataIndex: "form", key: "form" },
      { title: "SUBMISSIONS", dataIndex: "submissions", key: "submissions" },
    ];

    return (
      <motion.div variants={itemVariants}>
        <Row gutter={24} style={{ marginBottom: 32 }}>
          <Col span={8}>
            <Card bodyStyle={{ padding: 24 }} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 12, letterSpacing: 0.5 }}>ALL TIME</div>
              <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)', lineHeight: 1 }}>{analytics.totalSubmissions}</div>
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13 }}>Submissions</div>
            </Card>
          </Col>
          <Col span={8}>
            <Card bodyStyle={{ padding: 24 }} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 12, letterSpacing: 0.5 }}>LAST 30 DAYS</div>
              <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, color: 'var(--accent-info)', lineHeight: 1 }}>{analytics.recentSubmissions}</div>
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13 }}>Submissions</div>
            </Card>
          </Col>
          <Col span={8}>
            <Card bodyStyle={{ padding: 24 }} style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 12, letterSpacing: 0.5 }}>FORMS</div>
              <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)', lineHeight: 1 }}>{analytics.formsCount}</div>
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13 }}>In workspace</div>
            </Card>
          </Col>
        </Row>
        <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <Table
            columns={columns}
            dataSource={analytics.submissionsPerForm || []}
            loading={isLoadingAnalytics}
            rowKey="form"
            pagination={{
              defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
              position: ['bottomCenter']
            }}
            scroll={{ x: 800 }}
            locale={{ emptyText: <div style={{ padding: '40px 0', color: 'var(--text-secondary)', fontWeight: 500 }}>No analytics data yet.</div> }}
          />
        </Card>
      </motion.div>
    );
  };

  const renderSubmissions = () => {
    const columns = [
      { title: "SUBMITTED AT", dataIndex: "submittedAt", key: "submittedAt", render: t => new Date(t).toLocaleString() },
      { title: "FORM", dataIndex: "formId", key: "form", render: f => f?.name || "Unknown" },
      { title: "NAME", dataIndex: "name", key: "name" },
      { title: "EMAIL", dataIndex: "email", key: "email" },
      { title: "PHONE", dataIndex: "phone", key: "phone" },
      { 
        title: "DETAILS", 
        dataIndex: "details", 
        key: "details",
        render: details => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {details && Object.entries(details).map(([k, v]) => (
              <Tag key={k} color="blue" style={{ borderRadius: 4, margin: 2 }}>{k}: {v}</Tag>
            ))}
          </div>
        )
      },
      {
        title: "ACTIONS",
        key: "actions",
        align: "right",
        render: (_, record) => (
          <Space>
            <Button 
              type="text" 
              icon={<Eye size={16} />} 
              onClick={() => { setViewSubmission(record); setIsViewModalOpen(true); }} 
              style={{ color: 'var(--accent-primary)', padding: '4px 8px' }}
            >
              View
            </Button>
            {canDelete && (
              <Button 
                type="text" 
                danger 
                icon={<Trash2 size={16} />} 
                onClick={() => handleDeleteSubmission(record._id)}
                style={{ padding: '4px 8px' }}
              >
                Delete
              </Button>
            )}
          </Space>
        )
      }
    ];

    return (
      <motion.div variants={itemVariants}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, alignItems: 'center', background: 'var(--bg-secondary)', padding: 24, borderRadius: 16, border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: 0.5 }}>FORM</div>
            <Space>
              <Select value={submissionFormId} onChange={setSubmissionFormId} size="large" style={{ width: 180 }}>
                <Option value="all">All forms</Option>
                {forms.map(f => (
                  <Option key={f._id} value={f._id}>{f.name}</Option>
                ))}
              </Select>
              <Tag style={{ margin: 0, color: 'var(--accent-info)', background: 'rgba(14, 165, 233, 0.1)', border: 'none', padding: '6px 12px', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
                {submissions.length} submissions
              </Tag>
            </Space>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: 0.5 }}>FROM</div>
            <DatePicker size="large" placeholder="dd-mm-yyyy" format="DD-MM-YYYY" style={{ width: 150, borderRadius: 8 }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: 0.5 }}>TO</div>
            <DatePicker size="large" placeholder="dd-mm-yyyy" format="DD-MM-YYYY" style={{ width: 150, borderRadius: 8 }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: 0.5 }}>SEARCH</div>
            <Input 
              placeholder="Search name, email, phone..." 
              size="large" 
              style={{ borderRadius: 8 }}
              value={submissionSearch}
              onChange={e => setSubmissionSearch(e.target.value)}
              onPressEnter={fetchSubmissions}
            />
          </div>
        </div>
        <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <Table
            columns={columns}
            dataSource={submissions}
            loading={isLoadingSubmissions}
            pagination={{
              defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
              position: ['bottomCenter']
            }}
            scroll={{ x: 1000 }}
            locale={{ emptyText: <div style={{ padding: '40px 0', color: 'var(--text-secondary)', fontWeight: 500 }}>No submissions yet.</div> }}
          />
        </Card>
      </motion.div>
    );
  };

  if (activeForm) {
    return <FormBuilderView activeForm={activeForm} setActiveForm={setActiveForm} itemVariants={itemVariants} />;
  }

  return (
    <motion.div variants={itemVariants}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={4} style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            {headerInfo.icon} {headerInfo.title}
          </Title>
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>{headerInfo.subtitle}</Text>
        </div>
        {(activeSubTab === "builder" && canAdd) && (
          <Space>
            <Button 
              type="primary" 
              icon={<Plus size={18} />} 
              style={{ backgroundColor: "var(--accent-primary)", border: 'none', borderRadius: 8, fontWeight: 700, height: 44, padding: '0 24px', boxShadow: 'var(--shadow-md)' }}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Create Form
            </Button>
          </Space>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32, borderBottom: '2px solid var(--border-color)', paddingBottom: 0 }}>
        {[
          { key: "builder", label: "Builder", icon: <FileText size={16} /> },
          { key: "analyze", label: "Analyze", icon: <BarChart3 size={16} /> },
          { key: "submissions", label: "Submissions", icon: <Inbox size={16} /> }
        ].map(tab => (
          <div 
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            style={{
              padding: '12px 16px',
              color: activeSubTab === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeSubTab === tab.key ? 800 : 600,
              fontSize: 14,
              cursor: 'pointer',
              borderBottom: activeSubTab === tab.key ? '3px solid var(--accent-primary)' : '3px solid transparent',
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

      {activeSubTab === "builder" && renderBuilderList()}
      {activeSubTab === "analyze" && renderAnalyze()}
      {activeSubTab === "submissions" && renderSubmissions()}

      {/* CREATE NEW FORM MODAL */}
      <Modal
        title={<div style={{ fontSize: 20, fontWeight: 800, marginTop: 8, color: 'var(--text-primary)' }}>Create New Form</div>}
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={720}
        centered
        className="glassmorphism-modal"
      >
        <div style={{ marginTop: 24 }}>
          <Row gutter={24} style={{ marginBottom: 32 }}>
            <Col span={12}>
              <div 
                onClick={() => setCreateType("scratch")}
                style={{
                  border: createType === "scratch" ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  borderRadius: 16,
                  padding: 24,
                  cursor: "pointer",
                  height: "100%",
                  transition: "all 0.2s",
                  boxShadow: createType === "scratch" ? "0 4px 20px rgba(59, 130, 246, 0.15)" : "none"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Start from Scratch</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4, fontWeight: 500 }}>Design from scratch using the form builder</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: createType === 'scratch' ? '6px solid var(--accent-primary)' : '2px solid var(--border-color)', flexShrink: 0 }} />
                </div>
                <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 64, height: 64, border: "2px dashed var(--border-color)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", background: 'var(--bg-primary)' }}>
                    <Plus size={24} color="var(--text-tertiary)" />
                  </div>
                </div>
              </div>
            </Col>
            <Col span={12}>
              <div 
                onClick={() => setCreateType("templates")}
                style={{
                  border: createType === "templates" ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  borderRadius: 16,
                  padding: 24,
                  cursor: "pointer",
                  height: "100%",
                  transition: "all 0.2s",
                  boxShadow: createType === "templates" ? "0 4px 20px rgba(59, 130, 246, 0.15)" : "none"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>From templates</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4, fontWeight: 500 }}>Jump start with an awesome prebuilt form</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: createType === 'templates' ? '6px solid var(--accent-primary)' : '2px solid var(--border-color)', flexShrink: 0 }} />
                </div>
                <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ background: "rgba(245, 158, 11, 0.1)", padding: "16px 24px", borderRadius: 12, border: "1px solid rgba(245, 158, 11, 0.2)", color: "var(--accent-warning)", fontWeight: 700, fontSize: 14 }}>
                    Browse our template library
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Form name <span style={{ color: "var(--accent-danger)" }}>*</span></div>
            <Input 
              size="large"
              placeholder="e.g. Contact form, Workshop registration"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 16 }}>
            <Button style={{ borderRadius: 8, fontWeight: 700, height: 44, padding: "0 32px", borderColor: 'var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="primary" style={{ borderRadius: 8, fontWeight: 800, height: 44, padding: "0 32px", background: "var(--accent-primary)", border: 'none' }} onClick={handleCreateContinue} disabled={!formName && createType === 'scratch'}>
              Continue
            </Button>
          </div>
        </div>
      </Modal>

      {/* VIEW SUBMISSION MODAL */}
      <Modal
        title={null}
        open={isViewModalOpen}
        onCancel={() => setIsViewModalOpen(false)}
        footer={null}
        width={700}
        centered
        className="glassmorphism-modal"
        closeIcon={<X size={20} color="var(--text-primary)" />}
        bodyStyle={{ padding: 0, borderRadius: 16, overflow: 'hidden' }}
      >
        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-color)", background: 'var(--bg-secondary)' }}>
          <Title level={4} style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Eye size={20} color="var(--accent-primary)" /> Submission Details
          </Title>
        </div>
        {viewSubmission && (
          <div style={{ padding: "32px", background: 'var(--bg-primary)' }}>
            <Row gutter={[24, 24]}>
              <Col span={12}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: 0.5 }}>FORM NAME</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{viewSubmission.formId?.name || "Unknown"}</div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: 0.5 }}>SUBMITTED AT</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(viewSubmission.submittedAt).toLocaleString()}</div>
              </Col>
              
              <Col span={24}><div style={{ height: 1, background: 'var(--border-color)', margin: '8px 0' }}></div></Col>

              <Col span={12}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: 0.5 }}>NAME</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{viewSubmission.name || "-"}</div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: 0.5 }}>EMAIL</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{viewSubmission.email || "-"}</div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: 0.5 }}>PHONE</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{viewSubmission.phone || "-"}</div>
              </Col>
              
              <Col span={24}><div style={{ height: 1, background: 'var(--border-color)', margin: '8px 0' }}></div></Col>
              <Col span={24}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-tertiary)', marginBottom: 16, letterSpacing: 0.5 }}>ALL SUBMITTED DATA</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {viewSubmission.details && Object.entries(viewSubmission.details).map(([key, value]) => (
                    <div key={key} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 4 }}>{key}</div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                  {(!viewSubmission.details || Object.keys(viewSubmission.details).length === 0) && (
                    <div style={{ color: 'var(--text-secondary)' }}>No additional data.</div>
                  )}
                </div>
              </Col>
            </Row>
            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
               <Button type="primary" size="large" onClick={() => setIsViewModalOpen(false)} style={{ borderRadius: 8, fontWeight: 700, padding: '0 32px' }}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* TEMPLATE LIBRARY MODAL */}
      <Modal
        title={null}
        open={isTemplateModalOpen}
        onCancel={() => setIsTemplateModalOpen(false)}
        footer={null}
        width={1100}
        centered
        bodyStyle={{ padding: 0, height: 750, display: "flex", flexDirection: "column", borderRadius: 16, overflow: 'hidden' }}
        className="glassmorphism-modal"
        closeIcon={<X size={20} color="var(--text-primary)" />}
      >
        <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-color)", background: 'var(--bg-secondary)' }}>
          <Title level={4} style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={20} color="var(--accent-primary)" /> Template Library
          </Title>
        </div>
        
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left Sidebar */}
          <div style={{ width: 280, borderRight: "1px solid var(--border-color)", padding: "24px", overflowY: "auto", background: 'var(--bg-secondary)' }}>
            <div 
              onClick={() => setSelectedCategory("All")}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: selectedCategory === "All" ? "rgba(59, 130, 246, 0.1)" : "transparent", border: selectedCategory === "All" ? "1px solid rgba(59, 130, 246, 0.2)" : "1px solid transparent", borderRadius: 12, color: selectedCategory === "All" ? "var(--accent-primary)" : "var(--text-primary)", fontWeight: 700, marginBottom: 32, cursor: "pointer" }}
            >
              <Checkbox checked={selectedCategory === "All"} />
              All Templates
            </div>

            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-tertiary)", marginBottom: 16, letterSpacing: 0.5 }}>BROWSE CATEGORIES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {categories.slice(1).map(cat => (
                <div 
                  key={cat} 
                  onClick={() => setSelectedCategory(cat)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: selectedCategory === cat ? "var(--accent-primary)" : "var(--text-primary)", background: selectedCategory === cat ? "rgba(59, 130, 246, 0.05)" : "transparent", padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }} 
                  className="hover-bg-primary"
                >
                  <Space>
                    <div style={{ width: 16, height: 16, border: "2px solid var(--border-color)", borderRadius: 4, background: selectedCategory === cat ? "var(--accent-primary)" : "transparent" }}></div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{cat}</span>
                  </Space>
                  <span style={{ fontSize: 13, color: "var(--text-tertiary)", fontWeight: 600 }}>{templates.filter(t => t.category === cat).length}</span>
                </div>
              ))}
              <div style={{ color: "var(--accent-primary)", fontWeight: 700, marginTop: 12, fontSize: 14, cursor: "pointer", padding: '0 12px' }}>Show more</div>
            </div>
          </div>

          {/* Right Content */}
          <div style={{ flex: 1, padding: "32px", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Forms</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 500 }}>Showing {filteredTemplates.length} templates</div>
              </div>
              <Space>
                <Input 
                  size="large" 
                  placeholder="Search templates..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  prefix={<Search size={16} color="var(--text-tertiary)" />} 
                  style={{ width: 300, borderRadius: 8 }} 
                />
              </Space>
            </div>

            <div style={{ flex: 1, overflowY: "auto", margin: "-12px", padding: "12px" }}>
              <Row gutter={[24, 24]}>
                {filteredTemplates.map((tpl, i) => {
                  const isSelected = selectedTemplate === tpl._id;
                  return (
                  <Col span={8} key={tpl._id}>
                    <Card 
                      onClick={() => setSelectedTemplate(tpl._id)}
                      bodyStyle={{ padding: 0 }} 
                      style={{ 
                        borderRadius: 16, 
                        overflow: "hidden", 
                        border: isSelected ? "2px solid var(--accent-primary)" : "1px solid var(--border-color)", 
                        cursor: "pointer", 
                        background: 'var(--bg-secondary)', 
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? "0 4px 20px rgba(59, 130, 246, 0.15)" : "none"
                      }} 
                      className="hover-shadow-md"
                    >
                      <div style={{ height: 210, background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden', padding: 24 }}>
                        <div style={{ width: "100%", height: "100%", border: "1px solid var(--border-color)", borderRadius: 8, padding: '12px', display: "flex", flexDirection: "column", gap: 8, background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                           <div style={{ fontSize: 8, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.templateName ? tpl.templateName.toUpperCase() : 'FORM TEMPLATE'}</div>
                           <div style={{ fontSize: 5, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 4 }}>Fill out this form below</div>
                           
                           {tpl.fields?.slice(0, 4).map((f, idx) => (
                             <div key={f.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                               <div style={{ fontSize: 6, fontWeight: 600, color: 'var(--text-secondary)' }}>{f.label} {f.required && <span style={{ color: 'var(--accent-danger)' }}>*</span>}</div>
                               <div style={{ width: "100%", height: 14, background: "var(--bg-primary)", borderRadius: 3, border: "1px solid var(--border-color)" }}></div>
                             </div>
                           ))}
                           
                           <div style={{ width: "100%", height: 18, background: tpl.thumbnailColor || "var(--accent-primary)", borderRadius: 4, marginTop: "auto", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <div style={{ width: '40%', height: 4, background: 'rgba(255,255,255,0.8)', borderRadius: 2 }}></div>
                           </div>
                        </div>
                      </div>
                      <div style={{ padding: "20px" }}>
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.templateName || tpl.name}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>{tpl.category} · {tpl.fields?.length || tpl.featuresCount || 5} fields</div>
                      </div>
                    </Card>
                  </Col>
                )})}
              </Row>
            </div>
          </div>
        </div>

        {/* Template Footer */}
        <div style={{ padding: "24px 32px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-secondary)" }}>
          <div style={{ width: 400 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: "var(--text-primary)" }}>Form name</div>
            <Input 
              size="large"
              placeholder="Uses template name if empty"
              style={{ borderRadius: 8, borderColor: "var(--accent-primary)" }}
            />
          </div>
          <Space size="large">
            <Button size="large" style={{ borderRadius: 8, fontWeight: 700, padding: "0 32px", borderColor: 'var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} onClick={() => setIsTemplateModalOpen(false)}>
              Back
            </Button>
            <Button size="large" type="primary" style={{ borderRadius: 8, fontWeight: 800, padding: "0 32px", background: "var(--accent-primary)", border: 'none' }} onClick={() => {
              setIsTemplateModalOpen(false);
              const templateObj = templates.find(t => t._id === selectedTemplate);
              const nameToUse = formName || templateObj?.templateName || templateObj?.name || "Template Form";
              setActiveForm({ name: nameToUse, from: "template", templateFields: templateObj?.fields || [] });
              setFormName("");
              setSelectedTemplate(null);
            }} disabled={!selectedTemplate}>
              Use template
            </Button>
          </Space>
        </div>
      </Modal>
    </motion.div>
  );
};

export default FormsTab;
