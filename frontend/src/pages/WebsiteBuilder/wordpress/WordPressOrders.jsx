import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Typography, Card, Table, Button, Tag, Space, Modal, message, Drawer, Select, Tooltip } from "antd";
import { ArrowLeft, ExternalLink, Edit2, Trash2, ShoppingCart, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

const { Title, Text } = Typography;
const { Option } = Select;

const WordPressOrders = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [status, setStatus] = useState("pending");

  useEffect(() => {
    fetchOrders();
  }, [id]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/wordpress/${id}/orders`, {
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
      } else {
        message.error(data.message || "Failed to fetch orders. Is WooCommerce installed?");
      }
    } catch (err) {
      console.error(err);
      message.error("Error fetching orders");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(location.pathname.replace(/\/orders$/, '/dashboard'));
  };

  const openDrawer = (order) => {
    setEditingOrder(order);
    setStatus(order.status || "pending");
    setDrawerVisible(true);
  };
  const closeDrawer = () => {
    setDrawerVisible(false);
    setEditingOrder(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      
      const payload = { status };
      
      const res = await fetch(`/api/wordpress/${id}/orders/${editingOrder.id}/status`, {
        method: "PUT",
        headers: { 
          "Authorization": token ? `Bearer ${token}` : "",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        message.success(`Order updated successfully`);
        closeDrawer();
        fetchOrders();
      } else {
        message.error(data.message || "Failed to update order");
      }
    } catch (err) {
      console.error(err);
      message.error("Error updating order");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: "ORDER ID",
      dataIndex: "id",
      key: "id",
      render: (id) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={16} color="#3b82f6" />
          </div>
          <Text style={{ fontWeight: 600, color: 'var(--text-primary)' }}>#{id}</Text>
        </div>
      )
    },
    {
      title: "CUSTOMER",
      key: "customer",
      render: (_, r) => (
        <Text style={{ fontWeight: 600 }}>
          {r.billing?.first_name} {r.billing?.last_name}
        </Text>
      )
    },
    {
      title: "TOTAL",
      dataIndex: "total",
      key: "total",
      render: (t, r) => <Text style={{ fontWeight: 600 }}>{r.currency_symbol}{t}</Text>
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      render: (t) => <Tag>{t}</Tag>
    },
    {
      title: "ACTIONS",
      key: "actions",
      align: "right",
      render: (_, item) => (
        <Space size="middle">
          <Tooltip title="View Order">
            <Button type="text" size="small" icon={<ExternalLink size={16} color="var(--text-secondary)" />} onClick={() => window.open(item.payment_url || '', '_blank')} />
          </Tooltip>
          <Tooltip title="Update Status">
            <Button type="text" size="small" icon={<Edit2 size={16} color="var(--accent-primary)" />} onClick={() => openDrawer(item)} />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: '#0073AA', fontWeight: 700 }} onClick={handleBack}>
        <ArrowLeft size={16} /> Back to Dashboard
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 900 }}>Orders</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Manage customer orders from your WooCommerce store.</Text>
        </div>
        
        <Space>
          <Button size="large" icon={<RefreshCcw size={16} />} onClick={fetchOrders} loading={loading} style={{ borderRadius: 8, fontWeight: 700, borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            Sync
          </Button>
        </Space>
      </div>

      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <Table 
          dataSource={orders} 
          columns={columns} 
          rowKey="id"
          pagination={{
            defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            position: ['bottomCenter']
          }}
          loading={loading}
        />
      </Card>

      <Drawer
        title={<div style={{ fontSize: 18, fontWeight: 900 }}>Update Order #{editingOrder?.id}</div>}
        width={400}
        onClose={closeDrawer}
        open={drawerVisible}
        bodyStyle={{ paddingBottom: 80, background: 'var(--bg-primary)' }}
        extra={
          <Space>
            <Button onClick={closeDrawer} style={{ borderRadius: 8, fontWeight: 700 }}>Cancel</Button>
            <Button onClick={handleSave} type="primary" loading={saving} style={{ background: '#0073AA', border: 'none', borderRadius: 8, fontWeight: 800 }}>
              Update Order
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>ORDER STATUS</div>
          <Select size="large" value={status} onChange={setStatus} style={{ width: '100%' }} dropdownStyle={{ borderRadius: 8 }}>
            <Option value="pending">Pending Payment</Option>
            <Option value="processing">Processing</Option>
            <Option value="on-hold">On Hold</Option>
            <Option value="completed">Completed</Option>
            <Option value="cancelled">Cancelled</Option>
            <Option value="refunded">Refunded</Option>
            <Option value="failed">Failed</Option>
          </Select>
        </div>
      </Drawer>
    </div>
  );
};

export default WordPressOrders;
