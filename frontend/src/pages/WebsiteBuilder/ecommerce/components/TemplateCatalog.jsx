import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Row, Col, Space, Modal, Input, message } from 'antd';
import { Eye, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEcommerce } from '../contexts/EcommerceContext';
import api from '../../../../services/api';
import { ENABLE_TEMPLATE_IMPORT } from '../templateImportConfig';

const { Title, Text } = Typography;
const { Meta } = Card;

const TemplateCatalog = () => {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [storeName, setStoreName] = useState('');
  const [creating, setCreating] = useState(false);
  
  const navigate = useNavigate();
  const { workspaceId, websiteId, changeTemplate } = useEcommerce();

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    try {
      const res = await api.get('/ecommerce/catalog');
      if (res.data.success) {
        setCatalog(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch catalog', e);
      message.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleUseTemplate = (template) => {
    setSelectedTemplate(template);
    setStoreName(template.name + ' Copy');
    setIsModalVisible(true);
  };

  const handleCreateStore = async () => {
    if (!storeName.trim()) {
      return message.warning('Please enter a store name');
    }
    
    setCreating(true);
    try {
      const res = await api.post(`/ecommerce/${websiteId}/stores`, {
        name: storeName,
        catalogTemplateId: selectedTemplate.templateId
      });
      
      if (res.data.success) {
        message.success('Store created successfully');
        changeTemplate(res.data.data.templateId); // which is storeId
        navigate('../dashboard');
      }
    } catch (e) {
      console.error('Failed to create store', e);
      message.error('Failed to create store');
    } finally {
      setCreating(false);
      setIsModalVisible(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Template Catalog</Title>
          <Text type="secondary">Choose a template to start building your store.</Text>
        </div>
        <Space>
          {ENABLE_TEMPLATE_IMPORT && (
            <Button type="dashed" onClick={() => navigate('../import-template')}>Import Template</Button>
          )}
          <Button onClick={() => navigate('../templates')}>Back to Store Library</Button>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {catalog.map(tpl => (
          <Col xs={24} sm={12} md={8} lg={6} key={tpl.templateId}>
            <Card
              hoverable
              loading={loading}
              cover={<img alt={tpl.name} src={tpl.thumbnail || 'https://placehold.co/300x200?text=No+Image'} style={{ height: 160, objectFit: 'cover' }} />}
              actions={[
                <Button type="text" icon={<Eye size={16} />} onClick={() => navigate(`../preview/${tpl.templateId}`)}>Preview</Button>,
                <Button type="primary" size="small" icon={<Copy size={16} />} onClick={() => handleUseTemplate(tpl)}>Use Template</Button>
              ]}
            >
              <Meta title={tpl.name} description={tpl.category} />
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title="Create New Store"
        open={isModalVisible}
        onOk={handleCreateStore}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={creating}
        okText="Create Store"
      >
        <p>You are about to create a new store using the <strong>{selectedTemplate?.name}</strong> template.</p>
        <div style={{ marginTop: 16 }}>
          <Text strong>Store Name</Text>
          <Input 
            value={storeName} 
            onChange={e => setStoreName(e.target.value)} 
            placeholder="e.g. My Awesome Store"
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default TemplateCatalog;
