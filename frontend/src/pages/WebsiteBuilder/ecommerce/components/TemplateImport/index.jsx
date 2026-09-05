import React from 'react';
import { Typography, Card, Button, Steps, Upload, Input, Select, Table, Space, Tag, Divider, Row, Col, Progress, Alert } from 'antd';
import { InboxOutlined, CheckCircleOutlined, CodeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useEcommerce } from '../../contexts/EcommerceContext';
import { useTemplateImport } from './useTemplateImport';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

const TemplateImport = () => {
  const navigate = useNavigate();
  const { websiteId } = useEcommerce();
  const {
    currentStep, setCurrentStep, loading,
    file, templateMeta, setTemplateMeta,
    pages, analysisResults, previewPage, setPreviewPage,
    handleZipUpload, processUpload, updatePageRole, runAnalysis,
    updateSelector, preparePreview, getPreviewHtml, importToCatalog
  } = useTemplateImport(websiteId);

  const getConfidenceColor = (score) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'normal';
    return 'exception';
  };

  const renderStep1 = () => (
    <Card title="Upload Template ZIP">
      <div style={{ marginBottom: 24 }}>
        <Text strong>Template Name</Text>
        <Input 
          value={templateMeta.name} 
          onChange={e => setTemplateMeta(p => ({...p, name: e.target.value}))} 
          placeholder="e.g. Ecomus Fashion"
          style={{ marginBottom: 16, marginTop: 8 }}
        />
        <Text strong>Category</Text>
        <Select 
          value={templateMeta.category} 
          onChange={v => setTemplateMeta(p => ({...p, category: v}))}
          style={{ width: '100%', marginBottom: 16, marginTop: 8 }}
        >
          <Option value="Fashion">Fashion</Option>
          <Option value="Electronics">Electronics</Option>
          <Option value="Furniture">Furniture</Option>
          <Option value="General">General</Option>
        </Select>
      </div>

      <Dragger 
        beforeUpload={file => { handleZipUpload(file); return false; }} 
        maxCount={1}
        accept=".zip"
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">Click or drag ZIP file to this area to upload</p>
        <p className="ant-upload-hint">Upload a valid HTML template ZIP. Make sure it contains index.html.</p>
      </Dragger>

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Button type="primary" onClick={processUpload} disabled={!file || !templateMeta.name} loading={loading}>
          Extract & Analyze Pages
        </Button>
      </div>
    </Card>
  );

  const renderStep2 = () => {
    const dataSource = Object.values(pages).map(p => ({ ...p, key: p.path }));
    const columns = [
      { title: 'File Path', dataIndex: 'path', key: 'path', render: text => <Text code>{text}</Text> },
      { 
        title: 'Detected Role', 
        key: 'role', 
        render: (_, record) => (
          <Select 
            value={record.role} 
            onChange={(val) => updatePageRole(record.path, val)}
            style={{ width: 150 }}
          >
            {['Home', 'Shop', 'Product Detail', 'Cart', 'Checkout', 'Wishlist', 'About', 'Contact', 'Terms', 'Privacy', 'Other'].map(r => (
               <Option key={r} value={r}>{r}</Option>
            ))}
          </Select>
        ) 
      },
      { 
        title: 'Status', 
        key: 'status',
        render: (_, record) => record.role !== 'Other' ? <Tag color="green">Mapped</Tag> : <Tag color="default">Ignored</Tag>
      }
    ];

    return (
      <Card title="Page Discovery">
        <Alert message="Review the detected page roles. Pages marked 'Other' will not be parsed for commerce elements." type="info" showIcon style={{ marginBottom: 16 }} />
        <Table dataSource={dataSource} columns={columns} pagination={false} size="small" />
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setCurrentStep(0)}>Back</Button>
          <Button type="primary" onClick={runAnalysis} loading={loading}>Analyze Commerce Elements</Button>
        </div>
      </Card>
    );
  };

  const renderStep3 = () => {
    return (
      <Card title="Commerce Elements Analysis">
        <Alert message="Review and correct the detected CSS selectors. High confidence (green) are usually correct." type="info" showIcon style={{ marginBottom: 16 }} />
        
        {Object.entries(analysisResults).map(([path, analysis]) => (
          <div key={path} style={{ marginBottom: 32 }}>
            <Title level={5}><Text code>{path}</Text></Title>
            <Row gutter={24}>
              <Col span={8}>
                <Card size="small" title="Product Elements">
                  <Progress percent={Math.round(analysis.confidence.product * 100)} status={getConfidenceColor(analysis.confidence.product)} size="small" />
                  <div style={{ marginTop: 16 }}>
                     <Text type="secondary" style={{ fontSize: 12 }}>Container</Text>
                     <Input size="small" value={analysis.product.container} onChange={e => updateSelector(path, 'product', 'container', e.target.value)} />
                     <Text type="secondary" style={{ fontSize: 12 }}>Title</Text>
                     <Input size="small" value={analysis.product.title} onChange={e => updateSelector(path, 'product', 'title', e.target.value)} />
                     <Text type="secondary" style={{ fontSize: 12 }}>Price</Text>
                     <Input size="small" value={analysis.product.price} onChange={e => updateSelector(path, 'product', 'price', e.target.value)} />
                     <Text type="secondary" style={{ fontSize: 12 }}>Add Button</Text>
                     <Input size="small" value={analysis.product.addBtn} onChange={e => updateSelector(path, 'product', 'addBtn', e.target.value)} />
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="Cart Elements">
                  <Progress percent={Math.round(analysis.confidence.cart * 100)} status={getConfidenceColor(analysis.confidence.cart)} size="small" />
                  <div style={{ marginTop: 16 }}>
                     <Text type="secondary" style={{ fontSize: 12 }}>Container</Text>
                     <Input size="small" value={analysis.cart.container} onChange={e => updateSelector(path, 'cart', 'container', e.target.value)} />
                     <Text type="secondary" style={{ fontSize: 12 }}>Item Row</Text>
                     <Input size="small" value={analysis.cart.item} onChange={e => updateSelector(path, 'cart', 'item', e.target.value)} />
                     <Text type="secondary" style={{ fontSize: 12 }}>Remove Btn</Text>
                     <Input size="small" value={analysis.cart.removeBtn} onChange={e => updateSelector(path, 'cart', 'removeBtn', e.target.value)} />
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="Checkout Elements">
                  <Progress percent={Math.round(analysis.confidence.checkout * 100)} status={getConfidenceColor(analysis.confidence.checkout)} size="small" />
                  <div style={{ marginTop: 16 }}>
                     <Text type="secondary" style={{ fontSize: 12 }}>Form</Text>
                     <Input size="small" value={analysis.checkout.form} onChange={e => updateSelector(path, 'checkout', 'form', e.target.value)} />
                     <Text type="secondary" style={{ fontSize: 12 }}>Email</Text>
                     <Input size="small" value={analysis.checkout.email} onChange={e => updateSelector(path, 'checkout', 'email', e.target.value)} />
                     <Text type="secondary" style={{ fontSize: 12 }}>Submit Btn</Text>
                     <Input size="small" value={analysis.checkout.submitBtn} onChange={e => updateSelector(path, 'checkout', 'submitBtn', e.target.value)} />
                  </div>
                </Card>
              </Col>
            </Row>
            <Divider />
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setCurrentStep(1)}>Back</Button>
          <Space>
            <Button onClick={runAnalysis} loading={loading}>Re-analyze</Button>
            <Button type="primary" onClick={preparePreview}>Generate Bindings & Preview</Button>
          </Space>
        </div>
      </Card>
    );
  };

  const renderStep4 = () => {
    return (
      <Card title="Preview & Import">
        <Alert message="Verify the design is intact. External links and cart logic may not function in this preview." type="warning" showIcon style={{ marginBottom: 16 }} />
        
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text strong>Previewing:</Text>
            <Select style={{ width: 200 }} value={previewPage} onChange={setPreviewPage}>
               {Object.keys(pages).map(p => <Option key={p} value={p}>{p}</Option>)}
            </Select>
        </div>

        <div style={{ height: '60vh', border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
            <iframe 
                srcDoc={getPreviewHtml(previewPage)}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Template Preview"
            />
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setCurrentStep(2)}>Back</Button>
          <Button type="primary" size="large" onClick={async () => {
              const success = await importToCatalog();
              if(success) navigate('../catalog');
          }} loading={loading}>
            Save to Template Catalog
          </Button>
        </div>
      </Card>
    );
  };

  const steps = [
    { title: 'Upload', icon: <InboxOutlined /> },
    { title: 'Pages', icon: <CodeOutlined /> },
    { title: 'Analysis', icon: <CheckCircleOutlined /> },
    { title: 'Import', icon: <PlayCircleOutlined /> }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Import External Template</Title>
        <Button onClick={() => navigate('../catalog')}>Cancel</Button>
      </div>
      
      <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />
      
      {currentStep === 0 && renderStep1()}
      {currentStep === 1 && renderStep2()}
      {currentStep === 2 && renderStep3()}
      {currentStep === 3 && renderStep4()}
    </div>
  );
};

export default TemplateImport;
