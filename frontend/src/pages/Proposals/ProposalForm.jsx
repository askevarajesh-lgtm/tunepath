import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Select, Button, Space, Descriptions, Tag, message, Row, Col, Switch, Divider } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Typography } from 'antd';
import dayjs from 'dayjs';
import api from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ProposalForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditing = !!id;

  const [form] = Form.useForm();
  const [clients, setClients] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);

  const selectedMasterItemId = Form.useWatch('masterItems', form);
  const selectedMasterItem = masterItems.find(item => item._id === selectedMasterItemId);

  useEffect(() => {
    const init = async () => {
      await fetchClients();
      const loadedItems = await fetchMasterItems();
      if (isEditing) {
        await fetchProposal(loadedItems);
      }
    };
    init();
  }, [id, isEditing]);

  const fetchProposal = async (loadedMasterItems = []) => {
    try {
      setLoading(true);
      const res = await api.get(`/proposals/${id}`);
      if (res.data?.success) {
        const proposal = res.data.data;
        const proposalMasterItem = proposal.masterItems?.[0];

        // Merge the proposal's master item into the list if not already present
        // (handles custom items that aren't in the global master items list)
        if (proposalMasterItem && typeof proposalMasterItem === 'object') {
          setMasterItems(prev => {
            const alreadyExists = prev.find(i => i._id === proposalMasterItem._id);
            if (!alreadyExists) {
              return [...prev, proposalMasterItem];
            }
            return prev;
          });
        }

        const masterItemId = proposalMasterItem?._id
          ? proposalMasterItem._id
          : (typeof proposalMasterItem === 'string' ? proposalMasterItem : undefined);

        form.setFieldsValue({
          name: proposal.name,
          clientId: proposal.clientId?._id || proposal.clientId,
          masterItems: masterItemId,
          grandTotal: proposal.grandTotal,
          notes: proposal.notes
        });

        // If the master item is custom, switch to customizing mode and populate fields
        if (proposalMasterItem && typeof proposalMasterItem === 'object' && proposalMasterItem.isCustom) {
          setIsCustomizing(true);
          const item = proposalMasterItem;
          const categories = item.categories?.map(c => c.name) || [];
          const categoryCounts = {};
          item.categories?.forEach(c => { categoryCounts[c.name] = c.count; });
          form.setFieldsValue({
            customName: item.name,
            customDescription: item.description,
            customPrice: item.price,
            customCategories: categories,
            customCategoryCounts: categoryCounts,
            customApplicableAccess: item.applicableAccess || [],
            customHandlingDuration: item.handlingDuration,
            customIsCampaign: item.isCampaign || false,
            customCampaignDetails: item.campaignDetails || { numberOfDays: 0, dailyBudget: 0, campaignAmount: 0 }
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMasterItem && !isCustomizing) {
      const basePrice = selectedMasterItem.price || 0;
      const campAmt = selectedMasterItem.isCampaign ? (selectedMasterItem.campaignDetails?.campaignAmount || 0) : 0;
      form.setFieldsValue({ grandTotal: basePrice + campAmt });
    }
  }, [selectedMasterItem, isCustomizing, form]);

  const handleCustomValuesChange = (changedValues, allValues) => {
    if (isCustomizing) {
      let needsRecalc = false;
      if ('customPrice' in changedValues) needsRecalc = true;
      if (changedValues.customCampaignDetails && ('campaignAmount' in changedValues.customCampaignDetails)) needsRecalc = true;
      if ('customIsCampaign' in changedValues) needsRecalc = true;
      
      if (needsRecalc) {
        const cPrice = allValues.customPrice || 0;
        const cCampAmt = allValues.customIsCampaign ? (allValues.customCampaignDetails?.campaignAmount || 0) : 0;
        form.setFieldsValue({ grandTotal: cPrice + cCampAmt });
      }
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('/brands');
      if (res.data?.success) {
        setClients(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchMasterItems = async () => {
    try {
      const res = await api.get('/master-items');
      if (res.data?.success) {
        setMasterItems(res.data.data);
        return res.data.data;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch master items:', error);
      return [];
    }
  };

  const getBaseRoute = () => {
    if (location.pathname.startsWith("/client")) return "/client/workspace";
    if (location.pathname.startsWith("/agency")) return "/agency";
    if (location.pathname.startsWith("/user")) return "/user/workspace";
    return "/workspace";
  };

  const onFinish = async (values) => {
    try {
      setLoading(true);
      
      const payload = {
        name: values.name,
        clientId: values.clientId,
        masterItems: [values.masterItems], // Backend expects array
        subtotal: values.grandTotal, // Mirror total
        grandTotal: values.grandTotal,
        notes: values.notes,
        status: 'Draft'
      };

      if (isCustomizing) {
        const formattedCategories = (values.customCategories || []).map(catName => ({
          name: catName,
          count: values.customCategoryCounts?.[catName] || 0
        }));
        payload.customMasterItem = {
          name: values.customName,
          description: values.customDescription,
          price: values.customPrice,
          handlingDuration: values.customHandlingDuration,
          status: 'active',
          categories: formattedCategories,
          applicableAccess: values.customApplicableAccess || [],
          isCampaign: values.customIsCampaign || false,
          campaignDetails: values.customIsCampaign ? values.customCampaignDetails : undefined
        };
      }

      const url = isEditing ? `/proposals/${id}` : '/proposals';

      let res;
      if (isEditing) {
        res = await api.put(url, payload);
      } else {
        res = await api.post(url, payload);
      }

      if (res.data?.success) {
        message.success(`Proposal ${isEditing ? 'updated' : 'created'} successfully`);
        navigate(`${getBaseRoute()}/proposals`);
      } else {
        message.error(res.data?.message || "Operation failed");
      }
    } catch (error) {
      console.error(error);
      message.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>{isEditing ? "Edit Proposal" : "Create Proposal"}</Title>
        <Button onClick={() => navigate(`${getBaseRoute()}/proposals`)}>Back</Button>
      </div>
      <Card loading={loading}>
        <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={handleCustomValuesChange}>
          <Form.Item label="Proposal Name" name="name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Q3 SEO Campaign" />
          </Form.Item>
          
          <Form.Item label="Client" name="clientId" rules={[{ required: true }]}>
            <Select placeholder="Select Client" loading={clients.length === 0} showSearch optionFilterProp="children">
              {clients.map(c => (
                <Option key={c._id} value={c._id}>{c.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item label="Master Item" name="masterItems" rules={[{ required: true }]}>
            <Select placeholder="Select Master Item" loading={masterItems.length === 0} showSearch optionFilterProp="children">
              {masterItems.map(item => (
                <Option key={item._id} value={item._id}>{item.name}</Option>
              ))}
            </Select>
          </Form.Item>

          {selectedMasterItem && !isCustomizing && (
            <div style={{ marginBottom: 24, padding: 24, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>Package Details: {selectedMasterItem.name}</span>
                <Switch checked={isCustomizing} onChange={(checked) => {
                  setIsCustomizing(checked);
                  if (checked && !form.getFieldValue('customName')) {
                    const categories = selectedMasterItem.categories?.map(c => c.name) || [];
                    const categoryCounts = {};
                    selectedMasterItem.categories?.forEach(c => { categoryCounts[c.name] = c.count; });
                    form.setFieldsValue({
                      customName: selectedMasterItem.name,
                      customDescription: selectedMasterItem.description,
                      customPrice: selectedMasterItem.price,
                      customCategories: categories,
                      customCategoryCounts: categoryCounts,
                      customApplicableAccess: selectedMasterItem.applicableAccess || [],
                      customHandlingDuration: selectedMasterItem.handlingDuration,
                      customIsCampaign: selectedMasterItem.isCampaign || false,
                      customCampaignDetails: selectedMasterItem.campaignDetails || { numberOfDays: 0, dailyBudget: 0, campaignAmount: 0 }
                    });
                  }
                }} checkedChildren="Custom" unCheckedChildren="Original" />
              </div>
              <Descriptions bordered size="small" column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
                <Descriptions.Item label="Description" span={2}>
                  {selectedMasterItem.description || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Department">
                  {selectedMasterItem?.department || selectedMasterItem?.departmentId?.name ? (
                    <Tag color="blue">{selectedMasterItem.department || selectedMasterItem.departmentId?.name}</Tag>
                  ) : (
                    'N/A'
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Item Type">
                  <Tag>PACKAGE</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Pricing Model">
                  <Tag color="blue">FIXED</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Base Price">
                  ₹{selectedMasterItem.price?.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Total Amount">
                  ₹{((selectedMasterItem.price || 0) + (selectedMasterItem.isCampaign ? (selectedMasterItem.campaignDetails?.campaignAmount || 0) : 0)).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={selectedMasterItem.status === 'active' ? 'green' : 'red'}>
                    {selectedMasterItem.status?.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Handling Duration">
                  {selectedMasterItem.handlingDuration || 'N/A'}
                </Descriptions.Item>
                
                {selectedMasterItem.isCampaign && (
                  <Descriptions.Item label="Campaign Details" span={2}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '8px 16px', borderRadius: 6 }}>
                      <Text strong>Number of Days:</Text> {selectedMasterItem.campaignDetails?.numberOfDays} <br />
                      <Text strong>Daily Budget:</Text> ₹{selectedMasterItem.campaignDetails?.dailyBudget?.toLocaleString()} <br />
                      <Text strong>Campaign Amount:</Text> ₹{selectedMasterItem.campaignDetails?.campaignAmount?.toLocaleString()} <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>* Paid directly to Meta.</Text>
                    </div>
                  </Descriptions.Item>
                )}
                
                {selectedMasterItem.categories?.map((cat, index) => (
                  <Descriptions.Item key={cat._id || index} label={`Number of ${cat.name}`}>
                    {cat.count}
                  </Descriptions.Item>
                ))}

                <Descriptions.Item label="Categories">
                  {selectedMasterItem.categories?.map((cat, index) => <Tag key={cat._id || index} color="purple">{cat.name}</Tag>)}
                </Descriptions.Item>

                {selectedMasterItem.applicableAccess?.length > 0 && (
                  <Descriptions.Item label="Applicable Access / Deliverables" span={2}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {selectedMasterItem.applicableAccess.map((access, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 4 }}>
                          <Text strong>{access.name}</Text>
                          <Text>{access.value}</Text>
                        </div>
                      ))}
                    </div>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          )}

          {selectedMasterItem && isCustomizing && (
            <div style={{ marginBottom: 24, padding: 24, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>Customize Package: {selectedMasterItem.name}</span>
                <Switch checked={isCustomizing} onChange={(checked) => setIsCustomizing(checked)} checkedChildren="Custom" unCheckedChildren="Original" />
              </div>

              <Form.Item label="Item Name" name="customName" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              
              <Form.Item label="Select Categories" name="customCategories">
                <Select mode="tags" style={{ width: '100%' }} placeholder="Select or type categories" />
              </Form.Item>

              <Form.Item noStyle dependencies={['customCategories']}>
                {({ getFieldValue }) => {
                  const cats = getFieldValue('customCategories') || [];
                  return cats.length > 0 ? (
                    <div style={{ marginBottom: 24, paddingLeft: 16 }}>
                      {cats.map((cat) => (
                        <Row key={cat} style={{ marginBottom: 16 }} align="middle" gutter={16}>
                          <Col span={6}><Text strong>{cat}</Text></Col>
                          <Col span={18}>
                            <Form.Item label={`Number of ${cat}`} name={['customCategoryCounts', cat]} initialValue={0} style={{ marginBottom: 0 }}>
                              <InputNumber style={{ width: '100%' }} min={0} />
                            </Form.Item>
                          </Col>
                        </Row>
                      ))}
                    </div>
                  ) : null;
                }}
              </Form.Item>

              <Form.Item name="customIsCampaign" valuePropName="checked">
                <Switch checkedChildren="Campaign Enabled" unCheckedChildren="Campaign Disabled" />
              </Form.Item>

              <Form.Item noStyle dependencies={['customIsCampaign']}>
                {({ getFieldValue }) => {
                  const isCamp = getFieldValue('customIsCampaign');
                  return isCamp ? (
                    <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                      <Title level={5} style={{ marginTop: 0 }}>Campaign Details</Title>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item label="Number of Days" name={['customCampaignDetails', 'numberOfDays']} rules={[{ required: true }]}>
                            <InputNumber 
                              style={{ width: '100%' }} 
                              min={0} 
                              onChange={(val) => {
                                const budget = form.getFieldValue(['customCampaignDetails', 'dailyBudget']) || 0;
                                const campAmt = val * budget;
                                form.setFieldsValue({ customCampaignDetails: { campaignAmount: campAmt } });
                                const basePrice = form.getFieldValue('customPrice') || 0;
                                form.setFieldsValue({ grandTotal: basePrice + campAmt });
                              }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="Daily Budget" name={['customCampaignDetails', 'dailyBudget']} rules={[{ required: true }]}>
                            <InputNumber 
                              style={{ width: '100%' }} 
                              min={0} 
                              prefix="₹" 
                              onChange={(val) => {
                                const days = form.getFieldValue(['customCampaignDetails', 'numberOfDays']) || 0;
                                const campAmt = days * val;
                                form.setFieldsValue({ customCampaignDetails: { campaignAmount: campAmt } });
                                const basePrice = form.getFieldValue('customPrice') || 0;
                                form.setFieldsValue({ grandTotal: basePrice + campAmt });
                              }}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item label="Campaign Amount" name={['customCampaignDetails', 'campaignAmount']} rules={[{ required: true }]}>
                            <InputNumber 
                              style={{ width: '100%' }} 
                              min={0} 
                              prefix="₹" 
                              onChange={(val) => {
                                const basePrice = form.getFieldValue('customPrice') || 0;
                                form.setFieldsValue({ grandTotal: basePrice + (val || 0) });
                              }}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  ) : null;
                }}
              </Form.Item>

              <Divider orientation="left">Applicable Access / Deliverables</Divider>
              <Form.List name="customApplicableAccess">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item
                          {...restField}
                          name={[name, 'name']}
                          rules={[{ required: true, message: 'Missing access name' }]}
                        >
                          <Input placeholder="Access Name (e.g., Website Maintenance)" style={{ width: 300 }} />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'value']}
                          rules={[{ required: true, message: 'Missing value' }]}
                        >
                          <Input placeholder="Value (e.g., Yes, Monthly, 1)" style={{ width: 200 }} />
                        </Form.Item>
                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: 'red' }} />
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                        Add Applicable Access Item
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>

              <Form.Item label="Description" name="customDescription">
                <Input.TextArea rows={4} />
              </Form.Item>

              <Form.Item label="Service Price" name="customPrice" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} prefix="₹" min={0} />
              </Form.Item>

              <Form.Item label="Handling Duration" name="customHandlingDuration">
                <Select>
                  <Option value="1 Week">1 Week</Option>
                  <Option value="15 Days">15 Days</Option>
                  <Option value="1 Month">1 Month</Option>
                  <Option value="2 Months">2 Months</Option>
                  <Option value="3 Months">3 Months</Option>
                  <Option value="6 Months">6 Months</Option>
                  <Option value="1 Year">1 Year</Option>
                </Select>
              </Form.Item>


            </div>
          )}

          <Form.Item label="Total Amount" name="grandTotal" rules={[{ required: true }]}>
            <InputNumber 
              style={{ width: '100%' }} 
              prefix="₹" 
              disabled 
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item label="Notes" name="notes">
            <TextArea rows={4} placeholder="Add any additional notes for the client..." />
          </Form.Item>

          <Space style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" loading={loading}>{isEditing ? 'Update' : 'Save'}</Button>
            <Button onClick={() => navigate(`${getBaseRoute()}/proposals`)} disabled={loading}>Cancel</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default ProposalForm;
