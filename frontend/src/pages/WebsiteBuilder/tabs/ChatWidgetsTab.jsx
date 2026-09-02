import React, { useState, useEffect } from "react";
import { Button, Input, Table, Typography, Space, Tag, Card, Row, Col, Select, Checkbox, Popconfirm, Divider } from "antd";
import { FacebookOutlined, InstagramOutlined } from "@ant-design/icons";
import { Plus, Search, Trash2, ArrowRight, ArrowLeft, MessageCircle, MessageSquare, Phone, Mail, Bot, Smartphone, Monitor } from "lucide-react";
import PhoneInput from "../../../components/common/PhoneInput";
import { isValidPhoneNumber } from "libphonenumber-js";
import { message } from "antd";
import { useActionPermissions } from "../../../hooks/useActionPermissions";

import { motion } from "framer-motion";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const widgetTypes = [
  { id: "All-in-one chat", icon: <MessageCircle size={28} />, desc: "Combine WhatsApp, live chat, email/SMS, Facebook, Instagram & Voice AI in one widget for seamless customer communication.", bg: "linear-gradient(135deg, #4f46e5, #6366f1)", color: "#fff" },
  { id: "SMS / Email chat", icon: <Mail size={28} />, desc: "Collect visitor details and follow up via SMS or email. Ideal for teams that don't offer 24/7 live support.", bg: "linear-gradient(135deg, #10b981, #34d399)", color: "#fff" },
  { id: "Live chat", icon: <MessageSquare size={28} />, desc: "Engage visitors instantly through real-time website chat. Powered by your team or Conversation AI, anytime, anywhere.", bg: "linear-gradient(135deg, #9333ea, #a855f7)", color: "#fff" },
  { id: "Facebook chat", icon: <FacebookOutlined style={{ fontSize: 28 }} />, textColor: "#1877F2", desc: "Redirect visitors to Facebook Messenger for real-time conversations. Perfect for businesses active on Facebook.", bg: "var(--bg-primary)", border: true },
  { id: "Instagram chat", icon: <InstagramOutlined style={{ fontSize: 28 }} />, desc: "Route visitors to Instagram DMs for instant engagement. Great for brands connecting with customers on Instagram.", bg: "linear-gradient(135deg, #e11d48, #f43f5e)", color: "#fff" },
  { id: "WhatsApp chat", icon: <Phone size={28} />, textColor: "#25D366", desc: "Let visitors message you directly on WhatsApp. Ideal for small teams managing chats without 24/7 coverage.", bg: "var(--bg-primary)", border: true },
  { id: "Voice AI", icon: <Bot size={28} />, textColor: "var(--accent-primary)", desc: "Let AI talk, listen, and assist your visitors — handling voice conversations for you 24/7, with no human intervention needed.", bg: "var(--bg-primary)", border: true }
];

const CreateWidgetView = ({ setView, handleCreateWidget, itemVariants }) => {
  const [formData, setFormData] = useState({
    name: "",
    type: "All-in-one chat"
  });

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }} onClick={() => setView("list")}>
        <ArrowLeft size={16} /> Back to Chat Widgets
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 900 }}>Create Chat Widget</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Choose a widget type, then configure channels and styling.</Text>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Card bodyStyle={{ padding: 32 }} style={{ borderRadius: 16, marginBottom: 32, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: "var(--text-tertiary)", letterSpacing: 0.5 }}>WIDGET NAME</div>
          <Input 
            size="large"
            placeholder="e.g. Main site support"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            style={{ borderRadius: 8 }}
          />
        </Card>

        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 24, color: 'var(--text-primary)' }}>Choose type</div>
        <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
          {widgetTypes.map(type => (
            <Col span={12} key={type.id}>
              <div 
                onClick={() => setFormData({...formData, type: type.id})}
                style={{
                  border: formData.type === type.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                  background: formData.type === type.id ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-secondary)',
                  borderRadius: 16,
                  padding: 24,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: formData.type === type.id ? '0 4px 12px rgba(59, 130, 246, 0.1)' : 'var(--shadow-sm)',
                  display: 'flex',
                  gap: 20,
                  height: '100%',
                  alignItems: 'flex-start'
                }}
                className="hover-shadow-md"
              >
                <div style={{ 
                  background: type.bg, 
                  border: type.border ? '1px solid var(--border-color)' : 'none',
                  width: 56, 
                  height: 56, 
                  borderRadius: 16, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: type.textColor || type.color,
                  flexShrink: 0
                }}>
                  {type.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, color: "var(--text-primary)" }}>{type.id}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, fontWeight: 500 }}>{type.desc}</div>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        <Button 
          type="primary" 
          size="large"
          block 
          disabled={!formData.name}
          style={{ height: 56, borderRadius: 12, fontWeight: 800, backgroundColor: "var(--accent-primary)", border: "none", fontSize: 16, boxShadow: 'var(--shadow-md)' }}
          onClick={() => handleCreateWidget(formData)}
        >
          Continue to configuration <ArrowRight size={18} style={{ marginLeft: 8 }} />
        </Button>
      </div>
    </motion.div>
  );
};

const ConfigureWidgetView = ({ activeWidget, setView, handleUpdateWidget, handleDeleteWidget, itemVariants }) => {
  const { canAdd, canEdit, canDelete } = useActionPermissions('/website');
  const [formData, setFormData] = useState({
    name: activeWidget.name,
    status: activeWidget.status || "Draft",
    greeting: activeWidget.greeting || "Hi! How can we help you today?",
    brandColor: activeWidget.brandColor || "var(--accent-primary)",
    launcherPosition: activeWidget.launcherPosition || "Bottom right",
    launcherLabel: activeWidget.launcherLabel || "Chat",
    channels: activeWidget.channels || ["WhatsApp", "Email", "Live chat", "SMS"],
    whatsappPhone: activeWidget.whatsappPhone || "",
    supportEmail: activeWidget.supportEmail || "",
    smsPhone: activeWidget.smsPhone || "",
    facebookUrl: activeWidget.facebookUrl || "",
    instagramUrl: activeWidget.instagramUrl || "",
    voiceAiAgent: activeWidget.voiceAiAgent || ""
  });

  const toggleChannel = (channel) => {
    const newChannels = formData.channels.includes(channel)
      ? formData.channels.filter(c => c !== channel)
      : [...formData.channels, channel];
    setFormData({ ...formData, channels: newChannels });
  };

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }} onClick={() => setView("list")}>
        <ArrowLeft size={16} /> Back to Chat Widgets
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 900 }}>{activeWidget.name}</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 600 }}>{activeWidget.type} · {activeWidget.status}</Text>
        </div>
      </div>

      <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", color: "var(--accent-success)", padding: "16px 24px", borderRadius: 12, marginBottom: 32, fontWeight: 600, fontSize: 14 }}>
        Chat widget created. Configure it, publish, then assign to websites.
      </div>

      <Row gutter={32}>
        <Col span={16}>
          <Card bodyStyle={{ padding: 32 }} style={{ borderRadius: 24, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
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
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>STATUS</div>
              <Select 
                size="large"
                value={formData.status}
                onChange={v => setFormData({...formData, status: v})}
                style={{ width: "100%" }}
              >
                <Option value="Draft">Draft</Option>
                <Option value="Published">Published</Option>
              </Select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>GREETING MESSAGE</div>
              <TextArea 
                size="large"
                value={formData.greeting}
                onChange={e => setFormData({...formData, greeting: e.target.value})}
                rows={3}
                style={{ borderRadius: 8 }}
              />
            </div>

            <Row gutter={24} style={{ marginBottom: 24 }}>
              <Col span={12}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>BRAND COLOR</div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 44, height: 44, background: formData.brandColor, borderRadius: 8, border: "1px solid var(--border-color)" }}></div>
                  <Input 
                    size="large"
                    value={formData.brandColor} 
                    onChange={e => setFormData({...formData, brandColor: e.target.value})}
                    style={{ borderRadius: 8 }}
                  />
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>LAUNCHER POSITION</div>
                <Select 
                  size="large"
                  value={formData.launcherPosition}
                  onChange={v => setFormData({...formData, launcherPosition: v})}
                  style={{ width: "100%" }}
                >
                  <Option value="Bottom right">Bottom right</Option>
                  <Option value="Bottom left">Bottom left</Option>
                </Select>
              </Col>
            </Row>

            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>LAUNCHER LABEL</div>
              <Input 
                size="large"
                value={formData.launcherLabel}
                onChange={e => setFormData({...formData, launcherLabel: e.target.value})}
                style={{ borderRadius: 8 }}
              />
            </div>

            <Divider style={{ borderColor: 'var(--border-color)', margin: '32px 0' }} />

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)' }}>ENABLED CHANNELS</div>
              <Row gutter={[16, 16]}>
                {["WhatsApp", "Live chat", "Email", "SMS", "Facebook", "Instagram", "Voice AI"].map(ch => (
                  <Col span={12} key={ch}>
                    <Checkbox 
                      checked={formData.channels.includes(ch)}
                      onChange={() => toggleChannel(ch)}
                      style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }}
                    >
                      {ch}
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>
              {formData.channels.includes("WhatsApp") && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>WHATSAPP NUMBER</div>
                  <PhoneInput 
                    size="large"
                    style={{ borderRadius: 8 }}
                    countryCodeValue={formData.countryCode || '91'}
                    onCountryCodeChange={val => setFormData({...formData, countryCode: val})}
                    isoCountryValue={formData.countryIso || 'IN'}
                    onCountryIsoChange={val => setFormData({...formData, countryIso: val})}
                    value={formData.whatsappPhone}
                    onChange={e => setFormData({...formData, whatsappPhone: e.target.value})}
                  />
                </div>
              )}
              {formData.channels.includes("Email") && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>SUPPORT EMAIL</div>
                  <Input 
                    size="large"
                    placeholder="support@yoursite.com"
                    value={formData.supportEmail}
                    onChange={e => setFormData({...formData, supportEmail: e.target.value})}
                    style={{ borderRadius: 8 }}
                  />
                </div>
              )}
              {formData.channels.includes("SMS") && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>SMS NUMBER</div>
                  <PhoneInput 
                    size="large"
                    style={{ borderRadius: 8 }}
                    countryCodeValue={formData.smsCountryCode || '1'}
                    onCountryCodeChange={val => setFormData({...formData, smsCountryCode: val})}
                    isoCountryValue={formData.smsCountryIso || 'US'}
                    onCountryIsoChange={val => setFormData({...formData, smsCountryIso: val})}
                    value={formData.smsPhone}
                    onChange={e => setFormData({...formData, smsPhone: e.target.value})}
                  />
                </div>
              )}
              {formData.channels.includes("Facebook") && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>FACEBOOK PAGE URL</div>
                  <Input 
                    size="large"
                    placeholder="https://facebook.com/yourpage"
                    value={formData.facebookUrl}
                    onChange={e => setFormData({...formData, facebookUrl: e.target.value})}
                    style={{ borderRadius: 8 }}
                  />
                </div>
              )}
              {formData.channels.includes("Instagram") && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>INSTAGRAM PROFILE URL</div>
                  <Input 
                    size="large"
                    placeholder="https://instagram.com/yourprofile"
                    value={formData.instagramUrl}
                    onChange={e => setFormData({...formData, instagramUrl: e.target.value})}
                    style={{ borderRadius: 8 }}
                  />
                </div>
              )}
              {formData.channels.includes("Voice AI") && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>VOICE AI AGENT ID / PHONE</div>
                  <Input 
                    size="large"
                    placeholder="Agent ID or Phone number for AI"
                    value={formData.voiceAiAgent}
                    onChange={e => setFormData({...formData, voiceAiAgent: e.target.value})}
                    style={{ borderRadius: 8 }}
                  />
                </div>
              )}
            </div>

            {canEdit && (
              <Button 
                type="primary" 
                size="large"
                block 
                style={{ height: 48, borderRadius: 12, fontWeight: 800, backgroundColor: "var(--accent-primary)", border: "none", fontSize: 15, boxShadow: 'var(--shadow-md)' }}
                onClick={() => handleUpdateWidget(formData)}
              >
                Save Widget Configuration
              </Button>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card bodyStyle={{ padding: 24 }} style={{ borderRadius: 24, marginBottom: 24, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Monitor size={16} /> Embed</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6, fontWeight: 500 }}>
              Add to any page from the builder Chat tab, or paste this script before &lt;/body&gt;:
            </div>
            <div style={{ fontSize: 13, color: "var(--accent-warning)", fontWeight: 700, background: 'rgba(245, 158, 11, 0.1)', padding: '12px 16px', borderRadius: 8 }}>
              Publish this widget to enable embed.
            </div>
          </Card>

          {canDelete && (
            <Popconfirm title="Are you sure you want to delete this widget?" onConfirm={() => handleDeleteWidget(activeWidget.key)}>
              <Button size="large" block danger style={{ height: 48, borderRadius: 12, fontWeight: 800, background: "rgba(239, 68, 68, 0.1)", border: "none", color: "var(--accent-danger)" }}>
                Delete Widget
              </Button>
            </Popconfirm>
          )}
        </Col>
      </Row>
    </motion.div>
  );
};


const ChatWidgetsTab = ({ itemVariants }) => {
  const { canAdd, canEdit, canDelete } = useActionPermissions('/website');
  const [view, setView] = useState("list");
  const [widgets, setWidgets] = useState([]);
  const [activeWidget, setActiveWidget] = useState(null);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    const fetchWidgets = async () => {
      if (view !== "list") return;
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/chat-widgets", {
          headers: { "Authorization": token ? `Bearer ${token}` : "" }
        });
        const data = await res.json();
        if (data.success) {
          setWidgets(data.data.map(w => ({
            key: w._id,
            name: w.name,
            type: w.type,
            status: w.status || 'Draft',
            assignments: 0, // Mock assignments for now, backend could support it later
            ...w
          })));
        }
      } catch (err) {
        console.error("Failed to fetch widgets", err);
      }
    };
    fetchWidgets();
  }, [view]);

  const handleCreateWidget = async (data) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/chat-widgets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          status: "Draft"
        })
      });
      const resData = await res.json();
      if (resData.success) {
        setActiveWidget({ ...resData.data, key: resData.data._id });
        setView("configure");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateWidget = async (data) => {
    if (data.whatsappPhone && !isValidPhoneNumber(data.whatsappPhone, data.countryIso || 'IN')) {
      message.error("Please enter a valid WhatsApp phone number for the selected country");
      return;
    }
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/chat-widgets/${activeWidget.key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify(data)
      });
      const resData = await res.json();
      if (resData.success) {
        setActiveWidget({ ...activeWidget, ...data });
        setView("list");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWidget = async (key) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/chat-widgets/${key}`, {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setWidgets(widgets.filter(w => w.key !== key));
        setView("list");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderList = () => {
    const columns = [
      {
        title: "NAME",
        dataIndex: "name",
        key: "name",
        render: (text) => <span style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 15 }}>{text}</span>
      },
      {
        title: "TYPE",
        dataIndex: "type",
        key: "type",
        render: (text) => <Text style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{text}</Text>
      },
      {
        title: "STATUS",
        dataIndex: "status",
        key: "status",
        render: (status) => {
          let bg = status === "Published" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)";
          let color = status === "Published" ? "var(--accent-success)" : "var(--accent-warning)";
          return <Tag style={{ margin: 0, background: bg, color: color, fontWeight: 700, borderRadius: 12, padding: '4px 12px', fontSize: 12, border: 'none' }}>{status}</Tag>;
        }
      },
      {
        title: "ASSIGNMENTS",
        dataIndex: "assignments",
        key: "assignments",
        render: (text) => <Text style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{text}</Text>
      },
      {
        title: "ACTIONS",
        key: "actions",
        align: "right",
        render: (_, record) => (
          canEdit ? (
            <span 
              style={{ color: "var(--accent-primary)", fontWeight: 700, cursor: "pointer", display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => {
                setActiveWidget(record);
                setView("configure");
              }}
            >
              Edit <ArrowRight size={14} />
            </span>
          ) : null
        )
      },
    ];

    const filtered = widgets.filter(w => w.name.toLowerCase().includes(searchText.toLowerCase()));

    return (
      <motion.div variants={itemVariants}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={4} style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
              <MessageCircle size={24} color="var(--accent-primary)" /> Chat Widgets
            </Title>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
              Create floating chat experiences and assign them to websites.
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
                Create Widget
              </Button>
            )}
          </Space>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <Input
            size="large"
            placeholder="Search widgets..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300, borderRadius: 8 }}
            prefix={<Search size={16} color="var(--text-tertiary)" />}
          />
        </div>

        <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <Table scroll={{ x: 800 }} 
            columns={columns}
            dataSource={filtered}
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
                    <MessageCircle size={40} />
                  </div>
                  <Title level={4} style={{ marginBottom: 12, color: 'var(--text-primary)', fontWeight: 800 }}>No chat widgets yet</Title>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 32, fontSize: 15, fontWeight: 500 }}>
                    Click <strong style={{ color: "var(--text-primary)" }}>+ Create Widget</strong> to build customer engagement tools.
                  </Text>
                  {canAdd && <Button type="primary" icon={<Plus size={18} />} onClick={() => setView("create")} style={{ borderRadius: 8, height: 44, background: 'var(--accent-primary)', border: 'none', fontWeight: 700, padding: '0 32px' }}>Create Widget</Button>}
                </div>
              )
            }}
          />
        </Card>
      </motion.div>
    );
  };

  return (
    <div style={{ position: "relative" }}>
      {view === "list" && renderList()}
      {view === "create" && <CreateWidgetView setView={setView} handleCreateWidget={handleCreateWidget} itemVariants={itemVariants} />}
      {view === "configure" && <ConfigureWidgetView activeWidget={activeWidget} setView={setView} handleUpdateWidget={handleUpdateWidget} handleDeleteWidget={handleDeleteWidget} itemVariants={itemVariants} />}
    </div>
  );
};

export default ChatWidgetsTab;
