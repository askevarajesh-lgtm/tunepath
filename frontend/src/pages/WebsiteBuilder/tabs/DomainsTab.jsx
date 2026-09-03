import React, { useState, useEffect } from "react";
import { Button, Input, Table, Typography, Space, Tag, Card, Select, Row, Col, Divider, Popconfirm, message } from "antd";
import { Plus, Search, Globe, ArrowRight, ArrowLeft, Info, Server, Activity, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useActionPermissions } from "../../../hooks/useActionPermissions";

const { Title, Text } = Typography;
const { Option } = Select;

const ConnectDomainView = ({ setView, handleConnectDomain, itemVariants }) => {
  const [formData, setFormData] = useState({
    propertyType: "Website",
    property: "",
    customDomain: ""
  });

  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const fetchProperties = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const headers = { "Authorization": token ? `Bearer ${token}` : "" };
        const webRes = await fetch("/api/websites", { headers });
        const webData = await webRes.json();
        const webs = webData.success ? webData.data : [];
        setWebsites(webs);

        // Auto-select the first website if available
        if (webs.length > 0) {
          setFormData(prev => ({ ...prev, property: webs[0]._id }));
        }
      } catch (err) {
        console.error("Error loading properties for domain connection", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
  }, []);

  const handlePropertyTypeChange = (type) => {
    let defaultPropId = "";
    if (type === "Website" && websites.length > 0) {
      defaultPropId = websites[0]._id;
    }
    setFormData({
      ...formData,
      propertyType: type,
      property: defaultPropId
    });
  };

  const getPropertyOptions = () => {
    if (formData.propertyType === "Website") {
      return websites.map(w => <Option key={w._id} value={w._id}>{w.name}</Option>);
    }
    return [];
  };

  const error = formData.customDomain.includes("tunepath.askeva.io") || formData.customDomain.includes("m1.workforce.themilabs.com")
    ? "That hostname is reserved for this application." 
    : null;

  const currentPropertiesLength = formData.propertyType === "Website" ? websites.length : 0;

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }} onClick={() => setView("list")}>
        <ArrowLeft size={16} /> Back to Domains
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 900 }}>Connect Domain</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Point DNS to Bcc Crm, then verify ownership.</Text>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {error && hasInteracted && (
          <div style={{ marginBottom: 24, padding: "16px 20px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 12, color: "var(--accent-danger)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "flex-start", gap: 12 }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{error}</div>
          </div>
        )}

        <Card loading={loading} bodyStyle={{ padding: 32 }} style={{ borderRadius: 24, marginBottom: 32, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>PROPERTY TYPE</div>
            <Select 
              size="large"
              value={formData.propertyType}
              onChange={handlePropertyTypeChange}
              style={{ width: "100%" }}
            >
              <Option value="Website">Website</Option>
            </Select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>PROPERTY</div>
            <Select 
              size="large"
              value={formData.property || undefined}
              placeholder={currentPropertiesLength === 0 ? `No active ${formData.propertyType}s found` : `Select a ${formData.propertyType}`}
              onChange={v => setFormData({...formData, property: v})}
              style={{ width: "100%" }}
              disabled={currentPropertiesLength === 0}
            >
              {getPropertyOptions()}
            </Select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>CUSTOM DOMAIN</div>
            <Input 
              size="large"
              placeholder="www.yourbrand.com"
              value={formData.customDomain}
              onChange={e => {
                setFormData({...formData, customDomain: e.target.value});
                setHasInteracted(true);
              }}
              style={{ borderRadius: 8, borderColor: (error && hasInteracted) ? "var(--accent-danger)" : undefined }}
            />
          </div>
        </Card>

        <Button 
          type="primary" 
          size="large"
          block 
          disabled={!formData.customDomain || !formData.property || (error && hasInteracted)}
          style={{ height: 56, borderRadius: 12, fontWeight: 800, backgroundColor: "var(--accent-primary)", border: "none", fontSize: 16, boxShadow: 'var(--shadow-md)' }}
          onClick={() => handleConnectDomain(formData)}
        >
          Continue to DNS Setup <ArrowRight size={18} style={{ marginLeft: 8 }} />
        </Button>
      </div>
    </motion.div>
  );
};

const ManageDomainView = ({ activeDomain, setView, handleDisconnect, handleVerifyDNS, verifying, itemVariants }) => {
  const { canEdit, canDelete } = useActionPermissions('/website');

  return (
    <motion.div variants={itemVariants} className="builder-view-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 700 }} onClick={() => setView("list")}>
        <ArrowLeft size={16} /> Back to Domains
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0, marginBottom: 8, color: 'var(--text-primary)', fontWeight: 900 }}>{activeDomain.domain}</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 600 }}>{activeDomain.connectedTo}</Text>
        </div>
      </div>

      <Row gutter={32}>
        <Col span={16}>
          <Card bodyStyle={{ padding: 40 }} style={{ borderRadius: 24, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
            <Title level={4} style={{ marginBottom: 12, color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Server size={20} color="var(--accent-primary)" /> DNS Configuration
            </Title>
            <div style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 32, lineHeight: 1.6, fontWeight: 500 }}>
              Add <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>one</strong> of the records below at your domain registrar. Propagation can take up to 48 hours (usually minutes).
            </div>

            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 20 }}>OPTION A — CNAME (RECOMMENDED)</div>
              
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 600 }}>Type</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>CNAME</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 600 }}>Host</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>@</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 600 }}>Target</span>
                <span style={{ color: "var(--accent-primary)", fontWeight: 800, fontSize: 14 }}>{window.location.hostname}</span>
              </div>
            </div>

            <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 24, marginBottom: 32 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 20 }}>OPTION B — TXT VERIFICATION</div>
              
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 600 }}>Type</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>TXT</span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>HOST</div>
                <div style={{ fontWeight: 800, fontSize: 14, wordBreak: "break-all", color: 'var(--text-primary)' }}>_bcc-verify.{activeDomain.domain}</div>
              </div>
              <div>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>VALUE</div>
                <div style={{ fontWeight: 800, fontSize: 14, wordBreak: "break-all", color: 'var(--text-primary)' }}>{activeDomain.txtVerificationToken}</div>
              </div>
            </div>

            {canEdit && (
              <Button 
                type="primary" 
                size="large" 
                block 
                loading={verifying}
                disabled={activeDomain.status === "Connected"}
                onClick={() => handleVerifyDNS(activeDomain.key)}
                style={{ height: 56, borderRadius: 12, fontWeight: 800, backgroundColor: "var(--accent-primary)", border: "none", fontSize: 16 }}
              >
                {activeDomain.status === "Connected" ? "Domain Connected & Active" : "Verify DNS & Activate"}
              </Button>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card bodyStyle={{ padding: 32 }} style={{ borderRadius: 24, marginBottom: 24, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} /> STATUS</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: activeDomain.status === 'Pending' ? 'var(--accent-warning)' : 'var(--accent-success)' }}>{activeDomain.status}</div>
          </Card>

          {canDelete && (
            <Popconfirm title="Are you sure you want to disconnect this domain?" onConfirm={() => handleDisconnect(activeDomain.key)}>
              <Button size="large" block danger style={{ height: 48, borderRadius: 12, fontWeight: 800, background: "rgba(239, 68, 68, 0.1)", border: "none", color: "var(--accent-danger)" }}>
                Disconnect Domain
              </Button>
            </Popconfirm>
          )}
        </Col>
      </Row>
    </motion.div>
  );
};

const DomainsTab = ({ itemVariants }) => {
  const { canAdd, canEdit, canDelete } = useActionPermissions('/website');
  const [view, setView] = useState("list");
  const [domains, setDomains] = useState([]);
  const [activeDomain, setActiveDomain] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const fetchDomains = async () => {
      if (view !== "list") return;
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/domains", {
          headers: { "Authorization": token ? `Bearer ${token}` : "" }
        });
        const data = await res.json();
        if (data.success) {
          setDomains(data.data.map(d => ({
            key: d._id,
            domain: d.customDomain,
            connectedTo: d.connectedTo || `${d.propertyType} · Bcc Crm`,
            status: d.status || 'Pending',
            ...d
          })));
        }
      } catch (err) {
        console.error("Failed to fetch domains", err);
      }
    };
    fetchDomains();
  }, [view]);

  const handleConnectDomain = async (data) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          propertyType: data.propertyType,
          property: data.property,
          customDomain: data.customDomain
        })
      });
      const resData = await res.json();
      if (resData.success) {
        message.success("Domain connected successfully!");
        setView("list");
      } else {
        message.error(resData.error || "Failed to connect domain");
      }
    } catch (err) {
      console.error(err);
      message.error("An error occurred. Please try again.");
    }
  };

  const handleDisconnect = async (key) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/domains/${key}`, {
        method: "DELETE",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setDomains(domains.filter(d => d.key !== key));
        message.success("Domain disconnected successfully.");
        setView("list");
      } else {
        message.error(data.error || "Failed to disconnect domain");
      }
    } catch (err) {
      console.error(err);
      message.error("An error occurred. Please try again.");
    }
  };

  const handleVerifyDNS = async (domainId) => {
    setVerifying(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/domains/${domainId}/verify`, {
        method: "POST",
        headers: {
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      const data = await res.json();
      if (data.success) {
        message.success("Domain verified and connected successfully!");
        setDomains(prev => prev.map(d => d.key === domainId ? { ...d, status: 'Connected' } : d));
        setActiveDomain(prev => prev ? { ...prev, status: 'Connected' } : null);
      } else {
        message.error(data.error || "DNS verification failed. Please check records and try again.");
      }
    } catch (err) {
      console.error(err);
      message.error("An error occurred during verification.");
    } finally {
      setVerifying(false);
    }
  };

  const renderList = () => {
    const columns = [
      {
        title: "DOMAIN",
        dataIndex: "domain",
        key: "domain",
        render: (text) => <span style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: 15 }}>{text}</span>
      },
      {
        title: "CONNECTED TO",
        dataIndex: "connectedTo",
        key: "connectedTo",
        render: (text) => <Text style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{text}</Text>
      },
      {
        title: "STATUS",
        dataIndex: "status",
        key: "status",
        render: (status) => {
          let bg = status === "Connected" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)";
          let color = status === "Connected" ? "var(--accent-success)" : "var(--accent-warning)";
          return <Tag style={{ margin: 0, background: bg, color: color, fontWeight: 700, borderRadius: 12, padding: '4px 12px', fontSize: 12, border: 'none' }}>{status}</Tag>;
        }
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
                setActiveDomain(record);
                setView("manage");
              }}
            >
              Manage <ArrowRight size={14} />
            </span>
          ) : null
        )
      },
    ];

    const filtered = domains.filter(d => d.domain.toLowerCase().includes(searchText.toLowerCase()));

    return (
      <motion.div variants={itemVariants}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={4} style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Globe size={24} color="var(--accent-primary)" /> Domains
            </Title>
            <Text type="secondary" style={{ fontSize: 14, fontWeight: 500 }}>
              Connect custom domains to websites.
            </Text>
          </div>
          <Space>
            {canAdd && (
              <Button 
                type="primary" 
                icon={<Plus size={18} />} 
                style={{ backgroundColor: "var(--accent-primary)", border: 'none', borderRadius: 8, fontWeight: 700, height: 44, padding: '0 24px', boxShadow: 'var(--shadow-md)' }}
                onClick={() => setView("connect")}
              >
                Connect Domain
              </Button>
            )}
          </Space>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
          <Input
            size="large"
            placeholder="Search hostname..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300, borderRadius: 8 }}
            prefix={<Search size={16} color="var(--text-tertiary)" />}
          />
        </div>

        <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <Table
            columns={columns}
            dataSource={filtered}
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
                    <Globe size={40} />
                  </div>
                  <Title level={4} style={{ marginBottom: 12, color: 'var(--text-primary)', fontWeight: 800 }}>No domains yet</Title>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 32, fontSize: 15, fontWeight: 500 }}>
                    Click <strong style={{ color: "var(--text-primary)" }}>+ Connect Domain</strong> to link your custom domains.
                  </Text>
                  {canAdd && <Button type="primary" icon={<Plus size={18} />} onClick={() => setView("connect")} style={{ borderRadius: 8, height: 44, background: 'var(--accent-primary)', border: 'none', fontWeight: 700, padding: '0 32px' }}>Connect Domain</Button>}
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
      {view === "connect" && <ConnectDomainView setView={setView} handleConnectDomain={handleConnectDomain} itemVariants={itemVariants} />}
      {view === "manage" && activeDomain && <ManageDomainView activeDomain={activeDomain} setView={setView} handleDisconnect={handleDisconnect} handleVerifyDNS={handleVerifyDNS} verifying={verifying} itemVariants={itemVariants} />}
    </div>
  );
};

export default DomainsTab;
