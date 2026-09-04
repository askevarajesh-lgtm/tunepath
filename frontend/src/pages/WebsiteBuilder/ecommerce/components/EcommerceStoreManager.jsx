import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, List, Space, message, Spin, Modal, Input, Tag } from 'antd';
import { LayoutTemplate, Eye, Edit2, ChevronLeft, FileCode } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getTemplates, saveTemplate } from '../utils/storage';
import { useEcommerce } from '../contexts/EcommerceContext';

const { Title, Text } = Typography;

const EcommerceStoreManager = ({ templateId: propTemplateId }) => {
  const { templateId: paramTemplateId } = useParams();
  const templateId = paramTemplateId || propTemplateId;
  const navigate = useNavigate();
  const { workspaceId, websiteId, reloadTemplates } = useEcommerce();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit Store Name modal
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (workspaceId && websiteId && templateId) {
      loadTemplate();
    }
  }, [workspaceId, websiteId, templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const templates = await getTemplates(workspaceId, websiteId);
      if (templates[templateId]) {
        setTemplate(templates[templateId]);
      } else {
        message.error('Store not found');
        navigate('../templates');
      }
    } catch (err) {
      console.error(err);
      message.error('Failed to load store details');
    } finally {
      setLoading(false);
    }
  };

  const openRenameModal = () => {
    setNewName(template?.name || '');
    setIsRenameModalOpen(true);
  };

  const handleConfirmRename = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      message.error('Store name cannot be empty.');
      return;
    }
    if (trimmedName.length > 100) {
      message.error('Store name is too long (max 100 characters).');
      return;
    }
    setIsRenaming(true);
    try {
      const templates = await getTemplates(workspaceId, websiteId);
      if (templates[templateId]) {
        templates[templateId].name = trimmedName;
        templates[templateId].updatedAt = new Date().toISOString();
        await saveTemplate(workspaceId, websiteId, templateId, templates[templateId]);
        setTemplate(prev => ({ ...prev, name: trimmedName }));
        window.dispatchEvent(new CustomEvent('ecommerce_templates_updated'));
        if (reloadTemplates) await reloadTemplates();
        message.success(`Store renamed to "${trimmedName}"`);
        setIsRenameModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to rename store', err);
      message.error('Failed to rename store. Please try again.');
    } finally {
      setIsRenaming(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  if (!template) return null;

  const pagesList = template.pages ? Object.values(template.pages) : [];

  return (
    <div style={{ padding: '24px' }}>
      <Button
        type="link"
        icon={<ChevronLeft size={16} />}
        onClick={() => navigate('../templates')}
        style={{ padding: 0, marginBottom: 16 }}
      >
        Back to Store Library
      </Button>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <LayoutTemplate size={24} color="var(--accent-primary)" /> {template.name}
            </Title>
            <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
              Store ID: <Text code>{templateId}</Text> • {pagesList.length} pages • Last Updated:{' '}
              {new Date(template.updatedAt || template.createdAt).toLocaleDateString()}
            </Text>
          </div>
          <Space>
            <Button onClick={() => window.open(`/preview/store/${templateId}`, '_blank')}>
              <Eye size={14} style={{ marginRight: 4 }} /> Preview Store
            </Button>
            <Button type="default" onClick={openRenameModal}>
              <Edit2 size={14} style={{ marginRight: 4 }} /> Edit Store Name
            </Button>
          </Space>
        </div>
      </Card>

      <Card title={<Title level={4} style={{ margin: 0 }}>Pages ({pagesList.length})</Title>}>
        <List
          dataSource={pagesList}
          renderItem={page => (
            <List.Item
              actions={[
                <Button
                  key="preview"
                  icon={<Eye size={14} />}
                  onClick={() => window.open(`/preview/store/${templateId}?page=${page.id}`, '_blank')}
                >
                  Preview
                </Button>,
                <Button
                  key="edit"
                  type="primary"
                  icon={<Edit2 size={14} />}
                  onClick={() => navigate(`../builder/${templateId}/${page.id}`)}
                >
                  Edit Page
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={<FileCode size={20} color="var(--accent-secondary)" />}
                title={<span>{page.name || page.id} <Tag style={{ marginLeft: 4 }} color={
                  page.role === 'Product Listing' ? 'blue' :
                  page.role === 'Product Detail' ? 'purple' :
                  page.role === 'Cart' ? 'orange' :
                  page.role === 'Checkout' ? 'green' : 'default'
                }>{page.role || 'General'}</Tag></span>}
                description={`File: ${page.fileName || page.id}`}
              />
            </List.Item>
          )}
        />
      </Card>

      {/* Edit Store Name Modal */}
      <Modal
        title="Edit Store Name"
        open={isRenameModalOpen}
        onOk={handleConfirmRename}
        onCancel={() => setIsRenameModalOpen(false)}
        okText="Rename Store"
        confirmLoading={isRenaming}
        okButtonProps={{ disabled: !newName.trim() }}
      >
        <div style={{ marginBottom: 8 }}>
          <Text>Enter a new name for this store:</Text>
        </div>
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="e.g. Fashion Boutique"
          maxLength={100}
          showCount
          onPressEnter={handleConfirmRename}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default EcommerceStoreManager;
