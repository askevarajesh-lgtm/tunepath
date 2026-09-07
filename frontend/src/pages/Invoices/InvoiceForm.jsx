import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Select, Button, Space, Descriptions, Tag, message, DatePicker, Checkbox, Typography } from 'antd';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const InvoiceForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditing = !!id;

  const [form] = Form.useForm();
  const [clients, setClients] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [taxSettings, setTaxSettings] = useState({ gstPercentage: 18, gstEnabled: false });
  const [gstIncluded, setGstIncluded] = useState(false);

  const selectedClientId = Form.useWatch('clientId', form);
  const selectedProposalId = Form.useWatch('proposalId', form);
  
  const filteredProposals = proposals.filter(p => {
    const pClientId = p.clientId?._id || p.clientId;
    return pClientId === selectedClientId;
  });

  const selectedProposal = proposals.find(p => p._id === selectedProposalId);

  useEffect(() => {
    fetchClients();
    fetchProposals();
    fetchTaxSettings();
    if (isEditing) {
      fetchInvoice();
    }
  }, [id, isEditing]);

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

  // When client changes, clear the proposal selection if it doesn't belong to the new client
  useEffect(() => {
    if (selectedClientId && selectedProposal) {
      const pClientId = selectedProposal.clientId?._id || selectedProposal.clientId;
      if (pClientId !== selectedClientId) {
        form.setFieldsValue({ proposalId: undefined, subtotal: undefined });
      }
    }
  }, [selectedClientId]);

  // When proposal is selected, auto-fill the grand total
  useEffect(() => {
    if (selectedProposal) {
      form.setFieldsValue({ subtotal: selectedProposal.grandTotal });
    }
  }, [selectedProposal, form]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/invoices/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const invoice = data.data;
        form.setFieldsValue({
          clientId: invoice.clientId?._id || invoice.clientId,
          proposalId: invoice.proposalId?._id || invoice.proposalId,
          invoiceNumber: invoice.invoiceNumber,
          paymentMode: invoice.paymentMode,
          dueDate: invoice.dueDate ? dayjs(invoice.dueDate) : undefined,
          invoiceDate: invoice.createdAt ? dayjs(invoice.createdAt) : dayjs(),
          subtotal: invoice.amount || 0,
          notes: invoice.notes
        });
        if (invoice.tax > 0) {
          setGstIncluded(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch('/api/brands', {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setClients(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchProposals = async () => {
    try {
      const token = localStorage.getItem("token");
      // Fetch all proposals to filter on the frontend
      const res = await fetch('/api/proposals?limit=1000', {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProposals(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
    }
  };

  const getBaseRoute = () => {
    if (location.pathname.startsWith("/client")) return "/client/workspace";
    if (location.pathname.startsWith("/agency")) return "/agency";
    if (location.pathname.startsWith("/user")) return "/user/workspace";
    return "/workspace";
  };

  const onFinish = async (values, status) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      
      const subtotalVal = values.subtotal || 0;
      const taxAmount = gstIncluded && taxSettings.gstEnabled ? (subtotalVal * taxSettings.gstPercentage / 100) : 0;
      const finalGrandTotal = subtotalVal + taxAmount;

      const payload = {
        clientId: values.clientId,
        proposalId: values.proposalId,
        invoiceNumber: values.invoiceNumber || undefined, // undefined allows backend to auto-generate
        paymentMode: values.paymentMode,
        dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
        amount: subtotalVal,
        subtotal: subtotalVal, 
        tax: taxAmount,
        discount: 0,
        grandTotal: finalGrandTotal,
        notes: values.notes,
        invoiceType: values.invoiceType,
        paymentStatus: 'Pending',
        invoiceStatus: status // 'Sent' or 'Draft'
      };

      const url = isEditing ? `/api/invoices/${id}` : '/api/invoices';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        message.success(`Invoice ${isEditing ? 'updated' : 'created'} successfully`);
        navigate(`${getBaseRoute()}/invoices`);
      } else {
        message.error(data.message || data.error || "Operation failed");
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
        <Title level={3} style={{ margin: 0 }}>{isEditing ? "Edit Invoice" : "Create Invoice"}</Title>
        <Button onClick={() => navigate(`${getBaseRoute()}/invoices`)}>Back</Button>
      </div>
      <Card loading={loading}>
        <Form form={form} layout="vertical" initialValues={{ invoiceDate: dayjs(), invoiceType: 'One Time' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item label="Client" name="clientId" rules={[{ required: true, message: 'Client is required' }]}>
              <Select placeholder="Select Client" loading={clients.length === 0} showSearch optionFilterProp="children">
                {clients.map(c => (
                  <Option key={c._id} value={c._id}>{c.name}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="Proposal" name="proposalId" rules={[{ required: true, message: 'Proposal is required' }]}>
              <Select placeholder="Select Proposal" disabled={!selectedClientId} loading={proposals.length === 0} showSearch optionFilterProp="children" allowClear>
                {filteredProposals.map(p => (
                  <Option key={p._id} value={p._id}>{p.proposalNumber} - {p.name || 'Proposal'}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <Form.Item label="Invoice Number" name="invoiceNumber" extra="Leave blank to auto-generate">
              <Input placeholder="INV-0001" />
            </Form.Item>
            <Form.Item label="Payment Type" name="paymentMode" rules={[{ required: true, message: 'Payment Type is required' }]}>
              <Select placeholder="Select Payment Type">
                <Option value="Prepaid">Prepaid</Option>
                <Option value="Postpaid">Postpaid</Option>
              </Select>
            </Form.Item>

            <Form.Item label="Invoice Type" name="invoiceType" initialValue="One Time" rules={[{ required: true, message: 'Invoice Type is required' }]}>
              <Select placeholder="Select Invoice Type">
                <Option value="One Time">One Time</Option>
                <Option value="Retainer">Retainer</Option>
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item label="Invoice Date" name="invoiceDate" rules={[{ required: true, message: 'Invoice Date is required' }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>

            <Form.Item label="Due Date" name="dueDate" rules={[{ required: true, message: 'Due Date is required' }]}>
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </div>

          {selectedProposal && selectedProposal.masterItems?.map((item, idx) => (
            <div key={item._id || idx} style={{ marginBottom: 24, padding: 24, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ marginBottom: 16, fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>
                Package Details: {item.name}
              </div>
              <Descriptions bordered size="small" column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}>
                <Descriptions.Item label="Description" span={2}>
                  {item.description || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Department">
                  {item?.department || item?.departmentId?.name ? (
                    <Tag color="blue">{item.department || item.departmentId?.name}</Tag>
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
                  ₹{item.price?.toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Total Amount">
                  ₹{((item.price || 0) + (item.isCampaign ? (item.campaignDetails?.campaignAmount || 0) : 0)).toLocaleString()}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={item.status === 'active' ? 'green' : 'red'}>
                    {item.status?.toUpperCase() || 'ACTIVE'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Handling Duration">
                  {item.handlingDuration || '1 Month'}
                </Descriptions.Item>
                
                {item.isCampaign && (
                  <Descriptions.Item label="Campaign Details" span={2}>
                    <div style={{ background: 'var(--bg-secondary)', padding: '8px 16px', borderRadius: 6 }}>
                      <Typography.Text strong>Number of Days:</Typography.Text> {item.campaignDetails?.numberOfDays} <br />
                      <Typography.Text strong>Daily Budget:</Typography.Text> ₹{item.campaignDetails?.dailyBudget?.toLocaleString()} <br />
                      <Typography.Text strong>Campaign Amount:</Typography.Text> ₹{item.campaignDetails?.campaignAmount?.toLocaleString()} <br />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>* Paid directly to Meta.</Typography.Text>
                    </div>
                  </Descriptions.Item>
                )}
                
                {item.categories?.map((cat, index) => (
                  <Descriptions.Item key={cat._id || index} label={`Number of ${cat.name}`}>
                    {cat.count}
                  </Descriptions.Item>
                ))}

                <Descriptions.Item label="Categories">
                  {item.categories?.map((cat, index) => <Tag key={cat._id || index} color="purple">{cat.name}</Tag>)}
                  {(!item.categories || item.categories.length === 0) && 'No categories'}
                </Descriptions.Item>

                {item.applicableAccess && item.applicableAccess.length > 0 && (
                  <Descriptions.Item label="Applicable Access / Deliverables" span={2}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {item.applicableAccess.map((access, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 4 }}>
                          <Typography.Text strong>{access.name}</Typography.Text>
                          <Typography.Text>{access.value}</Typography.Text>
                        </div>
                      ))}
                    </div>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          ))}

          <Form.Item label="Subtotal" name="subtotal" rules={[{ required: true, message: 'Subtotal is required' }]}>
            <InputNumber 
              style={{ width: '100%' }} 
              prefix="₹" 
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
                      <span style={{ fontWeight: 800, fontSize: 16, flex: 1, textAlign: 'right' }}>Total (Invoice):</span>
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
            <Button type="primary" onClick={() => form.validateFields().then(v => onFinish(v, 'Sent'))} loading={loading}>Save (Sent)</Button>
            <Button onClick={() => form.validateFields().then(v => onFinish(v, 'Draft'))} loading={loading}>Save as Draft</Button>
            <Button onClick={() => navigate(`${getBaseRoute()}/invoices`)} disabled={loading} type="text">Cancel</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default InvoiceForm;
