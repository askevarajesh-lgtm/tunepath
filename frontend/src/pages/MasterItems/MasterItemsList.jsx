import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Space, Popconfirm, message, Segmented, Row, Col, theme } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

const MasterItemsList = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('card');
  const { user, role } = useAuth();
  const { token } = theme.useToken();

  const isSuperAdmin = ['supreme_super_admin', 'superadmin', 'agency_super_admin'].includes(role);
  const isManagerRole = ['agency_manager', 'admin', 'brand_admin', 'brand_manager'].includes(role);
  const permissions = user?.permissions?.['General-Master Item'] || user?.permissions?.['Workspace-Master Item'] || {};
  const canCreate = isSuperAdmin || isManagerRole || permissions.Create;
  const canEdit = isSuperAdmin || isManagerRole || permissions.Edit;
  const canDelete = isSuperAdmin || isManagerRole || permissions.Delete;

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const authToken = localStorage.getItem("token");
      const res = await fetch('/api/master-items', {
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
      } else {
        message.error("Failed to fetch master items");
      }
    } catch (error) {
      console.error(error);
      message.error("Error fetching master items");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const authToken = localStorage.getItem("token");
      const res = await fetch(`/api/master-items/${id}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        message.success("Master item deleted");
        fetchItems();
      } else {
        message.error(data.message || "Failed to delete");
      }
    } catch (error) {
      console.error(error);
      message.error("Error deleting master item");
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Master Items</Title>
          <Text type="secondary">Manage your service packages and items</Text>
        </div>
        <Space>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: 'List', value: 'list', icon: <UnorderedListOutlined /> },
              { label: 'Cards', value: 'card', icon: <AppstoreOutlined /> },
            ]}
          />
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('new')}>
              Create Master Item
            </Button>
          )}
        </Space>
      </div>

      {viewMode === 'list' ? (
        <Card>
          <Table
            columns={[
              { title: 'Department', key: 'department', render: (_, record) => record.department || record.departmentId?.name ? <Tag color="blue">{record.department || record.departmentId?.name}</Tag> : <Text type="secondary">—</Text> },
              { title: 'Item Name', dataIndex: 'name', key: 'name' },
              {
                title: 'Categories', dataIndex: 'categories', key: 'categories', render: (cats) => (
                  <Space size={[0, 4]} wrap>
                    {cats?.map(c => <Tag key={c.name}>{c.name} ({c.count})</Tag>)}
                  </Space>
                )
              },
              { title: 'Price', dataIndex: 'price', key: 'price', render: (val) => `₹${val}` },
              { title: 'Campaign Amt', key: 'campaignAmount', render: (_, record) => record.isCampaign ? `₹${record.campaignDetails?.campaignAmount || 0}` : 'N/A' },
              { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => <Tag color={status === 'active' ? 'green' : 'red'}>{status}</Tag> },
              { title: 'Created By', dataIndex: 'createdBy', key: 'createdBy', render: (user) => user?.name || 'Unknown' },
              {
                title: 'Actions', key: 'actions', render: (_, record) => (
                  <Space>
                    {canEdit && <Button type="text" icon={<EditOutlined />} onClick={() => navigate(`${record._id}`)} />}
                    {canDelete && (
                      <Popconfirm title="Delete this item?" onConfirm={() => handleDelete(record._id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    )}
                  </Space>
                )
              }
            ]}
            dataSource={items}
            rowKey="_id"
            loading={loading}
          />
        </Card>
      ) : (
        <Row gutter={[24, 24]}>
          {items.map(item => (
            <Col xs={24} sm={24} md={12} lg={8} xl={8} key={item._id}>
              <Card
                hoverable
                style={{
                  borderRadius: 16,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  borderColor: token.colorBorderSecondary,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
                }}
                bodyStyle={{ padding: 28, display: 'flex', flexDirection: 'column', flex: 1 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Title level={3} style={{ margin: 0, fontWeight: 700 }}>{item.name}</Title>
                  <Space wrap>
                    {(item.department || item.departmentId?.name) && (
                      <Tag color="blue" style={{ borderRadius: 12, margin: 0 }}>
                        {item.department || item.departmentId?.name}
                      </Tag>
                    )}
                    <Tag color={item.status === 'active' ? 'purple-inverse' : 'default'} style={{ borderRadius: 12, margin: 0, border: 'none' }}>
                      {item.status === 'active' ? 'Active' : 'Inactive'}
                    </Tag>
                    {canDelete && (
                      <Popconfirm title="Delete this item?" onConfirm={() => handleDelete(item._id)}>
                        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                      </Popconfirm>
                    )}
                  </Space>
                </div>

                <Text type="secondary" style={{ marginBottom: 20, minHeight: 44, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 15 }}>
                  {item.description || 'No description provided.'}
                </Text>

                <div style={{
                  background: 'linear-gradient(90deg, #f3ebff 0%, #d8c2ff 100%)',
                  borderRadius: 12,
                  padding: '20px',
                  marginBottom: 28,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16
                }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: '#c45484', lineHeight: 1 }}>₹{item.price?.toLocaleString()}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 14, color: '#333', fontWeight: 500, lineHeight: 1.3 }}>
                      Charged {item.handlingDuration?.toLowerCase() || 'per project'},<br />for the package.
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, marginBottom: 28 }}>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    
                    {item.isCampaign && (
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <CheckCircleOutlined style={{ color: '#c45484', marginTop: 3, fontSize: 16 }} />
                        <span style={{ fontSize: 14, color: token.colorTextSecondary }}>
                          Campaign Amount: <strong style={{ color: '#c45484' }}>₹{item.campaignDetails?.campaignAmount?.toLocaleString()}</strong>
                        </span>
                      </li>
                    )}

                    {item.categories && item.categories.length > 0 && item.categories.map((cat, idx) => (
                      <li key={`cat-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <CheckCircleOutlined style={{ color: '#6554c0', marginTop: 3, fontSize: 16 }} />
                        <span style={{ fontSize: 14, color: token.colorTextSecondary }}>
                          {cat.name}: <strong>{cat.count}</strong>
                        </span>
                      </li>
                    ))}

                    {item.applicableAccess && item.applicableAccess.length > 0 && (
                      item.applicableAccess.map((access, idx) => (
                        <li key={`acc-${idx}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <CheckCircleOutlined style={{ color: '#6554c0', marginTop: 3, fontSize: 16 }} />
                          <span style={{ fontSize: 14, color: token.colorTextSecondary }}>
                            {access.name}: <strong>{access.value}</strong>
                          </span>
                        </li>
                      ))
                    )}

                    {(!item.categories || item.categories.length === 0) && (!item.applicableAccess || item.applicableAccess.length === 0) && (
                      <li style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <span style={{ fontSize: 14, color: token.colorTextSecondary, fontStyle: 'italic' }}>No deliverables specified</span>
                      </li>
                    )}
                  </ul>
                </div>

                <div style={{ marginTop: 'auto' }}>
                  {canEdit && (
                    <Button
                      type="primary"
                      size="large"
                      style={{
                        width: '100%',
                        background: '#6554c0',
                        borderColor: '#6554c0',
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 16,
                        height: 48
                      }}
                      onClick={() => navigate(`${item._id}`)}
                    >
                      Edit Package
                    </Button>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default MasterItemsList;
