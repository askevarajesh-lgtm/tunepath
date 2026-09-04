import React, { useState } from 'react';
import {
  Card, Button, Typography, Steps, Form, Input,
  Upload, message, List, Tag, Modal
} from 'antd';
import { UploadCloud, CheckCircle, Code, FileCode, Store } from 'lucide-react';
import { getTemplates, saveTemplate } from '../utils/storage';
import { processZipFile } from '../utils/zipExtractor';
import { analyzePageElements } from '../utils/analyzer';
import EcommerceGrapesJS from './EcommerceGrapesJS';
import { useEcommerce } from '../contexts/EcommerceContext';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

const { Title, Text } = Typography;

const EcommerceStoreBuilder = () => {
  const { templateId: routeTemplateId, pageId: routePageId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [templateId, setTemplateId] = useState('');
  const [pages, setPages] = useState({});
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [assets, setAssets] = useState({});

  // Save Store modal state
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { workspaceId, websiteId, reloadTemplates, changeTemplate } = useEcommerce();

  React.useEffect(() => {
    if (routeTemplateId && workspaceId && websiteId) {
      getTemplates(workspaceId, websiteId).then(templates => {
        if (templates[routeTemplateId]) {
          setTemplateId(routeTemplateId);
          setPages(templates[routeTemplateId].pages || {});
          setAssets(templates[routeTemplateId].assets || {});

          if (routePageId && templates[routeTemplateId].pages?.[routePageId]) {
            setSelectedPageId(routePageId);
            setCurrentStep(3);
          } else {
            setCurrentStep(1);
          }
        }
      });
    }
  }, [routeTemplateId, routePageId, workspaceId, websiteId]);

  const handleFileUpload = async (file) => {
    try {
      message.loading({ content: 'Extracting ZIP...', key: 'zip' });
      const { pages: extractedPages, assets: extractedAssets } = await processZipFile(file);
      setAssets(extractedAssets);

      const analyzedPages = {};
      Object.keys(extractedPages).forEach(pageId => {
        analyzedPages[pageId] = {
          ...extractedPages[pageId],
          mapping: analyzePageElements(extractedPages[pageId].html)
        };
      });

      setPages(analyzedPages);
      // Generate a stable templateId immediately on upload (but do NOT save yet)
      const newTemplateId = `tpl_${Date.now()}`;
      setTemplateId(newTemplateId);

      message.success({ content: `Extracted ${Object.keys(analyzedPages).length} pages. Review them and click "Save Store" when ready.`, key: 'zip', duration: 4 });
      setCurrentStep(1);
    } catch (err) {
      console.error(err);
      message.error({ content: 'Failed to parse ZIP file. Make sure it contains HTML files.', key: 'zip' });
    }
    return false;
  };

  const selectPage = (pageId) => {
    setSelectedPageId(pageId);

    const pageHtml = pages[pageId].html;
    const detectedMappings = analyzePageElements(pageHtml);

    const updatedPages = { ...pages };
    // Merge: preserve any user-set mappings, auto-fill the rest
    updatedPages[pageId].mapping = { ...detectedMappings, ...(updatedPages[pageId].mapping || {}) };
    setPages(updatedPages);

    setCurrentStep(2);
  };

  const handleMappingConfirm = (values) => {
    const updatedPages = { ...pages };
    updatedPages[selectedPageId].mapping = values;
    setPages(updatedPages);
    message.success('Mappings confirmed!');
    setCurrentStep(1); // Return to page list (not proceed to GrapesJS yet)
  };

  // --- Save Store ---
  const openSaveModal = () => {
    if (Object.keys(pages).length === 0) {
      message.warning('No pages detected. Please upload a valid ZIP first.');
      return;
    }
    setStoreName('');
    setIsSaveModalOpen(true);
  };

  const handleConfirmSave = async () => {
    const trimmedName = storeName.trim();
    if (!trimmedName) {
      message.error('Store name is required.');
      return;
    }
    if (trimmedName.length > 100) {
      message.error('Store name is too long (max 100 characters).');
      return;
    }
    if (!workspaceId || !websiteId) {
      message.error('No workspace/website found. Please ensure you have at least one website in your account.');
      return;
    }

    setIsSaving(true);
    try {
      const templateData = {
        id: templateId,
        name: trimmedName,
        pages,
        assets,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveTemplate(workspaceId, websiteId, templateId, templateData);

      // Notify context to refresh template list
      window.dispatchEvent(new CustomEvent('ecommerce_templates_updated'));
      if (reloadTemplates) await reloadTemplates();
      if (changeTemplate) changeTemplate(templateId);

      message.success(`Store "${trimmedName}" saved successfully!`);
      setIsSaveModalOpen(false);

      // Navigate to Store Library
      navigate('../templates');
    } catch (err) {
      console.error('Failed to save store', err);
      message.error('Failed to save store. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderUpload = () => (
    <Card style={{ textAlign: 'center', padding: '40px 20px', maxWidth: 600, margin: '0 auto', marginTop: 40 }}>
      <UploadCloud size={48} color="var(--accent-primary)" style={{ marginBottom: 16 }} />
      <Title level={4}>Upload Template ZIP</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Upload a complete e-commerce HTML template ZIP containing index.html, cart.html, product.html, css/, js/, images/, etc.
      </Text>
      <Upload beforeUpload={handleFileUpload} accept=".zip" showUploadList={false}>
        <Button type="primary" size="large" icon={<UploadCloud size={16} />}>Select ZIP File</Button>
      </Upload>
    </Card>
  );

  const renderPageList = () => (
    <Card style={{ maxWidth: 900, margin: '0 auto', marginTop: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Detected Pages</Title>
          <Text type="secondary">{Object.keys(pages).length} pages found. You may edit each page's mappings or go straight to Save.</Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<Store size={16} />}
          onClick={openSaveModal}
          disabled={Object.keys(pages).length === 0}
        >
          Save Store
        </Button>
      </div>
      <List
        dataSource={Object.values(pages)}
        renderItem={page => (
          <List.Item
            actions={[
              <Button onClick={() => selectPage(page.id)}>Configure Mappings</Button>
            ]}
          >
            <List.Item.Meta
              avatar={<FileCode size={24} color="var(--accent-secondary)" />}
              title={page.name || page.id}
              description={page.fileName || page.id}
            />
            <Tag color={page.role === 'Product Listing' ? 'blue' : page.role === 'Checkout' ? 'green' : page.role === 'Cart' ? 'orange' : 'default'}>
              {page.role || 'General'}
            </Tag>
          </List.Item>
        )}
      />
    </Card>
  );

  const renderMapping = () => {
    const page = pages[selectedPageId];
    if (!page) return null;

    const mappingKeys = [
      { key: 'productGrid', label: 'Product Grid Container' },
      { key: 'productCard', label: 'Product Card Element' },
      { key: 'productImage', label: 'Product Image' },
      { key: 'productName', label: 'Product Name' },
      { key: 'productPrice', label: 'Product Price' },
      { key: 'salePrice', label: 'Sale Price (optional)' },
      { key: 'addBtn', label: 'Add to Cart Button' },
      { key: 'cartContainer', label: 'Cart Container' },
      { key: 'cartItem', label: 'Cart Item Row' },
      { key: 'cartTotal', label: 'Cart Total Element' },
      { key: 'checkoutForm', label: 'Checkout Form' },
    ];

    return (
      <Card style={{ maxWidth: 800, margin: '0 auto', marginTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0 }}>Configure Mappings: {page.name || page.id}</Title>
          <Button onClick={() => setCurrentStep(1)}>← Back to Pages</Button>
        </div>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          Adjust the CSS selectors to match your template's structure. Auto-detected values are pre-filled.
        </Text>
        <Form
          layout="horizontal"
          labelCol={{ span: 9 }}
          wrapperCol={{ span: 15 }}
          initialValues={page.mapping}
          onFinish={handleMappingConfirm}
        >
          {mappingKeys.map(item => (
            <Form.Item key={item.key} name={item.key} label={item.label}>
              <Input placeholder="CSS Selector (e.g. .product-card)" />
            </Form.Item>
          ))}
          <Form.Item wrapperCol={{ offset: 9, span: 15 }}>
            <Button type="primary" htmlType="submit">Save Mappings</Button>
          </Form.Item>
        </Form>
      </Card>
    );
  };

  if (currentStep === 3) {
    const page = pages[selectedPageId];
    return (
      <EcommerceGrapesJS
        templateId={templateId}
        pageId={selectedPageId}
        initialHtml={page.html}
        initialCss={page.css}
        assets={assets}
        initialName={pages[selectedPageId]?.name || ''}
        onBack={() => {
          if (routePageId) {
            const match = location.pathname.match(/^(.*?\/website\/ecommerce)(?=\/|$)/);
            const basePath = match ? match[0] : '';
            if (basePath) {
              navigate(`${basePath}/pages`);
            } else {
              navigate(`../../pages`);
            }
          } else {
            setCurrentStep(1);
          }
        }}
        onSave={async (html, css) => {
          // Only update the edited page — never overwrite other pages
          const updatedPages = { ...pages };
          updatedPages[selectedPageId] = {
            ...updatedPages[selectedPageId],
            html,
            css,
            updatedAt: new Date().toISOString()
          };
          setPages(updatedPages);

          // Persist only if the store is already saved
          if (templateId) {
            const templates = await getTemplates(workspaceId, websiteId);
            if (templates[templateId]) {
              templates[templateId].pages = updatedPages;
              templates[templateId].updatedAt = new Date().toISOString();
              await saveTemplate(workspaceId, websiteId, templateId, templates[templateId]);
              window.dispatchEvent(new CustomEvent('ecommerce_templates_updated'));
            }
          }
        }}
      />
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Steps
        current={currentStep}
        items={[
          { title: 'Upload ZIP', icon: <UploadCloud size={16} /> },
          { title: 'Pages', icon: <FileCode size={16} /> },
          { title: 'Map Elements', icon: <Code size={16} /> },
          { title: 'Visual Builder', icon: <CheckCircle size={16} /> },
        ]}
        style={{ maxWidth: 800, margin: '0 auto', marginBottom: 40 }}
      />

      {currentStep === 0 && renderUpload()}
      {currentStep === 1 && renderPageList()}
      {currentStep === 2 && renderMapping()}

      {/* Save Store Modal */}
      <Modal
        title="Save Store"
        open={isSaveModalOpen}
        onOk={handleConfirmSave}
        onCancel={() => setIsSaveModalOpen(false)}
        okText="Save Store"
        confirmLoading={isSaving}
        okButtonProps={{ disabled: !storeName.trim() }}
      >
        <div style={{ marginBottom: 8 }}>
          <Text>Give your new store a name. This will appear in the Store Library and Active Store dropdown.</Text>
        </div>
        <Input
          value={storeName}
          onChange={e => setStoreName(e.target.value)}
          placeholder="e.g. Fashion Boutique, Tech Store..."
          maxLength={100}
          showCount
          onPressEnter={handleConfirmSave}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default EcommerceStoreBuilder;
