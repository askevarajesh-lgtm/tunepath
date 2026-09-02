import React, { useState, useEffect } from 'react';
import { Typography, Switch, Table, Button, Tabs, message, Spin, Space, Tag, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Settings, Mail, Smartphone, MessageSquare } from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const { Title, Text } = Typography;

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1, 
    transition: { type: 'spring', stiffness: 300, damping: 24 } 
  }
};

const NotificationsTab = () => {
  const [activeTab, setActiveTab] = useState('notifications');
  const navigate = useNavigate();
  const { role } = useAuth();
  
  // Notifications List State
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Triggers State
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotifications();
    } else if (activeTab === 'triggers') {
      fetchSettings();
    }
  }, [activeTab]);

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const res = await api.get('/tasks/notifications');
      if (res.data && res.data.success) {
        setNotifications(res.data.data?.notifications || []);
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
      message.error('Failed to load notifications');
    } finally {
      setLoadingNotifications(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await api.get('/tasks/notification-settings');
      if (res.data && res.data.success) {
        setSettings(res.data.data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings', error);
      message.error('Failed to load notification settings');
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.put(`/tasks/notifications/${id}/read`);
      message.success('Notification marked as read');
      fetchNotifications();
    } catch (error) {
      message.error('Failed to mark as read');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await api.put('/tasks/notification-settings', settings);
      message.success('Notification triggers saved successfully');
    } catch (error) {
      console.error('Failed to save settings', error);
      message.error('Failed to save triggers');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTriggerChange = (category, event, channel, checked) => {
    setSettings(prev => {
      const nextSettings = { ...prev };
      if (category === 'systemTriggers') {
        if (!nextSettings.systemTriggers) nextSettings.systemTriggers = {};
        if (!nextSettings.systemTriggers[event]) nextSettings.systemTriggers[event] = { inApp: true, email: false, whatsapp: false };
        nextSettings.systemTriggers[event][channel] = checked;
      } else {
        if (!nextSettings[event]) nextSettings[event] = { inApp: true, email: false, whatsapp: false };
        nextSettings[event][channel] = checked;
      }
      return nextSettings;
    });
  };

  const notifColumns = [
    { title: 'Type', dataIndex: 'type', key: 'type', render: t => <Tag color="blue">{t?.replace(/_/g, ' ')}</Tag> },
    { title: 'Title', dataIndex: 'title', key: 'title', render: t => <strong style={{ color: 'var(--text-primary)' }}>{t}</strong> },
    { 
      title: 'Message', 
      dataIndex: 'message', 
      key: 'message', 
      render: t => <Text type="secondary">{t?.length > 50 ? `${t.substring(0, 50)}...` : t}</Text> 
    },
    { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', render: d => new Date(d).toLocaleString() },
    { 
      title: 'Action', 
      key: 'action', 
      align: 'right', 
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            size="small"
            onClick={() => {
              setSelectedNotification(record);
              setIsModalVisible(true);
            }}
          >
            View
          </Button>
          <Button 
            type="text" 
            size="small"
            disabled={record.isRead} 
            onClick={() => handleMarkAsRead(record._id)}
          >
            {record.isRead ? 'Read' : 'Mark as Read'}
          </Button>
        </Space>
      ) 
    }
  ];

  const renderTriggerRow = (title, category, eventKey) => {
    if (!settings) return null;
    const config = category === 'systemTriggers' 
      ? (settings.systemTriggers?.[eventKey] || { inApp: false, email: false, whatsapp: false })
      : (settings[eventKey] || { inApp: false, email: false, whatsapp: false });

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: 14 }}>{title}</strong>
          <Text type="secondary" style={{ fontSize: 12 }}>Trigger notification on this event.</Text>
        </div>
        <Space size="large">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={16} color="var(--text-secondary)" />
            <Switch size="small" checked={config.inApp} onChange={(c) => handleTriggerChange(category, eventKey, 'inApp', c)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={16} color="var(--text-secondary)" />
            <Switch size="small" checked={config.email} onChange={(c) => handleTriggerChange(category, eventKey, 'email', c)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={16} color="var(--text-secondary)" />
            <Switch size="small" checked={config.whatsapp} onChange={(c) => handleTriggerChange(category, eventKey, 'whatsapp', c)} />
          </div>
        </Space>
      </div>
    );
  };

  const tabItems = [
    {
      key: 'notifications',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
          <MessageSquare size={16} /> Notifications History
        </span>
      ),
      children: (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)' }}>
              <strong style={{ display: 'block', fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>Recent Notifications</strong>
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>A log of all actions performed in the Commander Admin panel and system events.</Text>
            </div>
            <Table 
              columns={notifColumns} 
              dataSource={notifications} 
              rowKey="_id"
              loading={loadingNotifications}
              pagination={{
                defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                position: ['bottomCenter']
              }} 
              size="middle" 
              rowClassName={() => 'hover-bg'} 
            />
          </div>
        </motion.div>
      )
    },
    {
      // key: 'triggers',
      // label: (
      //   <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
      //     <Settings size={16} /> Manage Triggers
      //   </span>
      // ),
      children: (
        <motion.div variants={itemVariants} initial="hidden" animate="visible">
          {loadingSettings ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
          ) : (
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: 16, color: 'var(--text-primary)', marginBottom: 4 }}>Notification Triggers</strong>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Enable or disable which modules and events should trigger notifications.</Text>
                </div>
                <Button type="primary" onClick={handleSaveSettings} loading={savingSettings}>Save Changes</Button>
              </div>

              {/* System Events */}
              <div style={{ padding: '16px 24px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>System Events</strong>
              </div>
              {renderTriggerRow('User Created', 'systemTriggers', 'userCreated')}
              {renderTriggerRow('Agency Created', 'systemTriggers', 'agencyCreated')}
              {renderTriggerRow('Brand Created', 'systemTriggers', 'brandCreated')}
              {renderTriggerRow('Report Downloaded', 'systemTriggers', 'reportDownloaded')}
              
              {/* Task Events */}
              <div style={{ padding: '16px 24px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', borderTop: '1px solid var(--border-color)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Task Events</strong>
              </div>
              {renderTriggerRow('Task Created', 'systemTriggers', 'taskCreated')}
              {renderTriggerRow('Task Completed', 'systemTriggers', 'taskCompleted')}
              {renderTriggerRow('Task Assigned', 'root', 'taskAssigned')}
              {renderTriggerRow('Task Status Changed', 'root', 'taskStatusChanged')}
              
            </div>
          )}
        </motion.div>
      )
    }
  ];

  return (
    <>
      <motion.div variants={itemVariants} initial="hidden" animate="visible" style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: '0 0 4px 0', fontWeight: 800 }}>Notification & Alert Settings</Title>
        <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Manage notification history and system-wide triggers.</Text>
      </motion.div>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} className="custom-tabs" />

      <Modal
        title={selectedNotification?.title || "Notification"}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsModalVisible(false)}>
            Close
          </Button>,
          selectedNotification && !selectedNotification.isRead && (
            <Button 
              key="read" 
              type="primary" 
              onClick={() => {
                handleMarkAsRead(selectedNotification._id);
                setIsModalVisible(false);
              }}
            >
              Read
            </Button>
          )
        ].filter(Boolean)}
      >
        <p style={{ marginTop: 16 }}>{selectedNotification?.message}</p>
        {selectedNotification?.type?.startsWith('sla_') && (
          <Button 
            type="link" 
            style={{ padding: 0, marginTop: 16 }}
            onClick={() => {
              setIsModalVisible(false);
              navigate(role.includes('brand') || role === 'client' ? '/client/sla' : '/agency/sla');
            }}
          >
            Go to SLA
          </Button>
        )}
      </Modal>
    </>
  );
};

export default NotificationsTab;
