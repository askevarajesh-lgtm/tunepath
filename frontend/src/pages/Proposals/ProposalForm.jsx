import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Select, Button, Space, Descriptions, Tag, message, Row, Col, Switch, Divider, Checkbox } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();
  const isEditing = !!id;
  
  const flow = searchParams.get('flow');
  const queryClientId = searchParams.get('clientId');

  const [form] = Form.useForm();
  const [clients, setClients] = useState([]);
  const [masterItems, setMasterItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [taxSettings, setTaxSettings] = useState({ gstPercentage: 18, gstEnabled: false });
  const [gstIncluded, setGstIncluded] = useState(false);

  const selectedMasterItemId = Form.useWatch('masterItems', form);
  const selectedMasterItem = masterItems.find(item => item._id === selectedMasterItemId);

  useEffect(() => {
    const init = async () => {
      await fetchClients();
      await fetchTaxSettings();
      const loadedItems = await fetchMasterItems();
      if (isEditing) {
        await fetchProposal(loadedItems);
      }
    };
    init();
  }, [id, isEditing]);

  useEffect(() => {
    if (queryClientId && flow === 'client-to-proposal' && !isEditing && clients.length > 0) {
      form.setFieldsValue({ clientId: queryClientId });
    }
  }, [queryClientId, flow, isEditing, clients, form]);

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
          subtotal: proposal.subtotal || proposal.grandTotal,
          notes: proposal.notes
        });

        if (proposal.tax > 0) {
          setGstIncluded(true);
        }

        // If the master item is custom, switch to customizing mode and populate fields
        if (proposalMasterItem && typeof proposalMasterItem === 'object' && proposalMasterItem.isCustom) {
          setIsCustomizing(true);
          const item = proposalMasterItem;
          const categories = item.categories?.map(c => c.name) || [];
          const categoryCounts = {};
          item.categories?.forEach(c => { categoryCounts[c.name] = c.count; });
          
          const itemCampAmt = item.isCampaign ? (item.campaignDetails?.campaignAmount || 0) : 0;
          const calculatedSubtotal = (item.price || 0) + itemCampAmt;
          const subtotalVal = (proposal.subtotal && proposal.subtotal >= calculatedSubtotal) 
            ? proposal.subtotal 
            : calculatedSubtotal;

          form.setFieldsValue({
            customName: item.name,
            customDescription: item.description,
            customPrice: item.price,
            customCategories: categories,
            customCategoryCounts: categoryCounts,
            customApplicableAccess: item.applicableAccess || [],
            customHandlingDuration: item.handlingDuration,
            customIsCampaign: item.isCampaign || false,
            customCampaignDetails: item.campaignDetails || { numberOfDays: 0, dailyBudget: 0, campaignAmount: 0 },
            subtotal: subtotalVal
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
      form.setFieldsValue({ subtotal: basePrice + campAmt });
    }
  }, [selectedMasterItem, isCustomizing, form]);

  const handleCustomValuesChange = (changedValues, allValues) => {
    if (isCustomizing) {
      let needsRecalc = false;
      let campAmt = allValues.customCampaignDetails?.campaignAmount || 0;

      if (
        changedValues.customCampaignDetails &&
        ('numberOfDays' in changedValues.customCampaignDetails || 'dailyBudget' in changedValues.customCampaignDetails)
      ) {
        const days = allValues.customCampaignDetails?.numberOfDays || 0;
        const budget = allValues.customCampaignDetails?.dailyBudget || 0;
        campAmt = days * budget;
        form.setFieldsValue({
          customCampaignDetails: {
            ...allValues.customCampaignDetails,
            campaignAmount: campAmt
          }
        });
        needsRecalc = true;
      }

      if (
        'customPrice' in changedValues ||
        'customIsCampaign' in changedValues ||
        (changedValues.customCampaignDetails && 'campaignAmount' in changedValues.customCampaignDetails)
      ) {
        needsRecalc = true;
      }
      
      if (needsRecalc) {
        const cPrice = allValues.customPrice || 0;
        const cCampAmt = allValues.customIsCampaign ? campAmt : 0;
        form.setFieldsValue({ subtotal: cPrice + cCampAmt });
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

  const fetchTaxSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch('/api/agency/settings/profile', {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data?.taxSettings) {
        setTaxSettings(data.data.taxSettings);
      }
    } catch (error) {
      console.error('Failed to fetch tax settings:', error);
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
      
      const subtotalVal = values.subtotal || 0;
      const taxAmount = gstIncluded && taxSettings.gstEnabled ? (subtotalVal * taxSettings.gstPercentage / 100) : 0;
      const finalGrandTotal = subtotalVal + taxAmount;

      const payload = {
        name: values.name,
        clientId: values.clientId,
        masterItems: [values.masterItems], // Backend expects array
        subtotal: subtotalVal,
        tax: taxAmount,
        discount: 0,
        grandTotal: finalGrandTotal,
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
        if (form.getFieldValue('submitAction') === 'approve_and_invoice') {
          const proposalId = isEditing ? id : res.data.data._id;
          const approveRes = await api.post(`/proposals/${proposalId}/approve-and-generate-invoice`);
          if (approveRes.data?.success) {
            message.success('Proposal approved and invoice generated successfully');
            navigate(`${getBaseRoute()}/invoices/${approveRes.data.data.invoice._id}?flow=proposal-to-invoice`);
          } else {
            message.error(approveRes.data?.message || 'Failed to generate invoice');
            if (!isEditing) {
               navigate(`${getBaseRoute()}/proposals/${proposalId}`);
            }
          }
        } else {
          message.success(`Proposal ${isEditing ? 'updated' : 'created'} successfully`);
          navigate(`${getBaseRoute()}/proposals`);
        }
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
                  if (checked) {
                    if (!form.getFieldValue('customName')) {
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
                    const cPrice = form.getFieldValue('customPrice') ?? selectedMasterItem.price ?? 0;
                    const isCamp = form.getFieldValue('customIsCampaign') ?? selectedMasterItem.isCampaign;
                    const campAmt = isCamp ? (form.getFieldValue(['customCampaignDetails', 'campaignAmount']) ?? selectedMasterItem.campaignDetails?.campaignAmount ?? 0) : 0;
                    form.setFieldsValue({ subtotal: cPrice + campAmt });
                  } else if (selectedMasterItem) {
                    const basePrice = selectedMasterItem.price || 0;
                    const campAmt = selectedMasterItem.isCampaign ? (selectedMasterItem.campaignDetails?.campaignAmount || 0) : 0;
                    form.setFieldsValue({ subtotal: basePrice + campAmt });
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
                <Switch checked={isCustomizing} onChange={(checked) => {
                  setIsCustomizing(checked);
                  if (checked) {
                    const cPrice = form.getFieldValue('customPrice') ?? selectedMasterItem.price ?? 0;
                    const isCamp = form.getFieldValue('customIsCampaign') ?? selectedMasterItem.isCampaign;
                    const campAmt = isCamp ? (form.getFieldValue(['customCampaignDetails', 'campaignAmount']) ?? selectedMasterItem.campaignDetails?.campaignAmount ?? 0) : 0;
                    form.setFieldsValue({ subtotal: cPrice + campAmt });
                  } else {
                    const basePrice = selectedMasterItem.price || 0;
                    const campAmt = selectedMasterItem.isCampaign ? (selectedMasterItem.campaignDetails?.campaignAmount || 0) : 0;
                    form.setFieldsValue({ subtotal: basePrice + campAmt });
                  }
                }} checkedChildren="Custom" unCheckedChildren="Original" />
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
                <Switch 
                  checkedChildren="Campaign Enabled" 
                  unCheckedChildren="Campaign Disabled" 
                  onChange={(checked) => {
                    const cPrice = form.getFieldValue('customPrice') || 0;
                    const campAmt = checked ? (form.getFieldValue(['customCampaignDetails', 'campaignAmount']) || 0) : 0;
                    form.setFieldsValue({
                      customIsCampaign: checked,
                      subtotal: cPrice + campAmt
                    });
                  }}
                />
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
                                const campAmt = (val || 0) * budget;
                                form.setFieldsValue({
                                  customCampaignDetails: {
                                    ...form.getFieldValue('customCampaignDetails'),
                                    numberOfDays: val || 0,
                                    campaignAmount: campAmt
                                  },
                                  subtotal: (form.getFieldValue('customPrice') || 0) + (form.getFieldValue('customIsCampaign') ? campAmt : 0)
                                });
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
                                const campAmt = days * (val || 0);
                                form.setFieldsValue({
                                  customCampaignDetails: {
                                    ...form.getFieldValue('customCampaignDetails'),
                                    dailyBudget: val || 0,
                                    campaignAmount: campAmt
                                  },
                                  subtotal: (form.getFieldValue('customPrice') || 0) + (form.getFieldValue('customIsCampaign') ? campAmt : 0)
                                });
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
                                const campAmt = val || 0;
                                form.setFieldsValue({
                                  customCampaignDetails: {
                                    ...form.getFieldValue('customCampaignDetails'),
                                    campaignAmount: campAmt
                                  },
                                  subtotal: (form.getFieldValue('customPrice') || 0) + (form.getFieldValue('customIsCampaign') ? campAmt : 0)
                                });
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
                <InputNumber 
                  style={{ width: '100%' }} 
                  prefix="₹" 
                  min={0} 
                  onChange={(val) => {
                    const isCamp = form.getFieldValue('customIsCampaign');
                    const campAmt = isCamp ? (form.getFieldValue(['customCampaignDetails', 'campaignAmount']) || 0) : 0;
                    form.setFieldsValue({
                      customPrice: val || 0,
                      subtotal: (val || 0) + campAmt
                    });
                  }}
                />
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

          <Form.Item label="Subtotal" name="subtotal" rules={[{ required: true }]}>
            <InputNumber 
              style={{ width: '100%' }} 
              prefix="₹" 
              disabled 
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          {taxSettings.gstEnabled && (
            <div style={{ marginBottom: 24, padding: '16px 24px', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-secondary)' }}>
              <div style={{ marginBottom: 16 }}>
                <Checkbox checked={gstIncluded} onChange={(e) => setGstIncluded(e.target.checked)}>
                  <span style={{ fontWeight: 600 }}>GST Included</span>
                </Checkbox>
              </div>
              {gstIncluded && (
                <div style={{ background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Typography.Text strong>Tax Type: GST (CGST+SGST) ({taxSettings.gstPercentage}%)</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>Tax calculated at {taxSettings.gstPercentage}% as per proposal.</Typography.Text>
                </div>
              )}
            </div>
          )}

          <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.subtotal !== currentValues.subtotal}>
            {() => {
              const subtotalVal = form.getFieldValue('subtotal') || 0;
              const taxAmount = gstIncluded && taxSettings.gstEnabled ? (subtotalVal * taxSettings.gstPercentage / 100) : 0;
              const finalGrandTotal = subtotalVal + taxAmount;
              const cgst = taxAmount / 2;
              const sgst = taxAmount / 2;

              return (
                <div style={{ padding: 24, background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, width: '100%', maxWidth: 400 }}>
                      <span style={{ fontWeight: 600, flex: 1, textAlign: 'right' }}>Subtotal:</span>
                      <span style={{ width: 150, textAlign: 'right' }}>₹{subtotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {gstIncluded && taxSettings.gstEnabled && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, width: '100%', maxWidth: 400 }}>
                          <span style={{ fontWeight: 600, flex: 1, textAlign: 'right' }}>Tax (GST (CGST+SGST) ({taxSettings.gstPercentage}%)):</span>
                          <span style={{ width: 150, textAlign: 'right' }}>₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, width: '100%', maxWidth: 400, color: 'var(--text-secondary)', fontSize: 13 }}>
                          <span style={{ flex: 1, textAlign: 'right' }}>CGST ({taxSettings.gstPercentage / 2}%): ₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | SGST ({taxSettings.gstPercentage / 2}%): ₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span style={{ width: 150 }}></span>
                        </div>
                      </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, width: '100%', maxWidth: 400, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: 800, fontSize: 16, flex: 1, textAlign: 'right' }}>Total (Proposal):</span>
                      <span style={{ width: 150, fontWeight: 800, fontSize: 16, textAlign: 'right' }}>₹{subtotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, width: '100%', maxWidth: 400, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: 800, fontSize: 18, color: '#52c41a', flex: 1, textAlign: 'right' }}>Grand Total (Payable):</span>
                      <span style={{ width: 150, fontWeight: 800, fontSize: 18, color: '#52c41a', textAlign: 'right' }}>₹{finalGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              );
            }}
          </Form.Item>

          <Form.Item label="Notes" name="notes">
            <TextArea rows={4} placeholder="Add any additional notes for the client..." />
          </Form.Item>

          <Space style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" onClick={() => form.setFieldsValue({ submitAction: 'save' })} loading={loading}>{isEditing ? 'Update' : 'Save'}</Button>
            <Button type="primary" htmlType="submit" onClick={() => form.setFieldsValue({ submitAction: 'approve_and_invoice' })} loading={loading} style={{ background: 'var(--accent-secondary, #1890ff)' }}>Approve Proposal & Create Invoice</Button>
            <Button onClick={() => navigate(`${getBaseRoute()}/proposals`)} disabled={loading}>Cancel</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default ProposalForm;
