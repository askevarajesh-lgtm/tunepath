import React from 'react';
import { Card, Form, Input, InputNumber, Select, Button, Space, Row, Col, message, Divider, Switch } from 'antd';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Typography } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useGetDepartmentsDynamicQuery } from '../../api/accessControlApi';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const MasterItemForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const location = useLocation();
  const [loading, setLoading] = React.useState(false);

  const { data: deptData } = useGetDepartmentsDynamicQuery();
  const departmentOptions = React.useMemo(() => {
    if (!deptData) return [];
    if (Array.isArray(deptData.data?.departments)) return deptData.data.departments;
    if (Array.isArray(deptData.departments)) return deptData.departments;
    if (Array.isArray(deptData.data)) return deptData.data;
    if (Array.isArray(deptData)) return deptData;
    return [];
  }, [deptData]);

  const getBaseRoute = () => {
    if (location.pathname.startsWith("/client")) return "/client/workspace";
    if (location.pathname.startsWith("/agency")) return "/agency";
    if (location.pathname.startsWith("/user")) return "/user/workspace";
    return "/workspace";
  };

  React.useEffect(() => {
    if (isEditing) {
      fetchMasterItem();
    }
  }, [id]);

  const fetchMasterItem = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/master-items/${id}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const item = data.data;
        
        // Transform backend categories to form fields
        const categories = item.categories?.map(c => c.name) || [];
        const categoryCounts = {};
        item.categories?.forEach(c => {
          categoryCounts[c.name] = c.count;
        });

        // Set form values
        form.setFieldsValue({
          departmentId: item.departmentId?._id || item.departmentId || undefined,
          department: item.department || item.departmentId?.name || undefined,
          name: item.name,
          description: item.description,
          price: item.price,
          status: item.status,
          categories,
          categoryCounts,
          applicableAccess: item.applicableAccess || [],
          handlingDuration: item.handlingDuration || "1 Month",
          isCampaign: item.isCampaign || false,
          campaignDetails: item.campaignDetails || { numberOfDays: 0, dailyBudget: 0, campaignAmount: 0 }
        });
      } else {
        message.error("Failed to load item");
      }
    } catch (error) {
      console.error(error);
      message.error("Error loading item");
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = (deptId, option) => {
    const deptObj = departmentOptions.find(d => (typeof d === 'object' ? (d._id || d.id || d.name) === deptId : d === deptId));
    const deptName = typeof deptObj === 'object' ? (deptObj.name || deptObj.title || deptObj.slug) : (deptObj || option?.children || null);
    form.setFieldsValue({
      departmentId: deptId,
      department: deptName
    });
  };

  const onFinish = async (values) => {
    try {
      setLoading(true);
      
      // Transform form categories back to backend format
      const formattedCategories = (values.categories || []).map(catName => ({
        name: catName,
        count: values.categoryCounts?.[catName] || 0
      }));

      const selectedDeptObj = departmentOptions.find(d => (typeof d === 'object' ? (d._id || d.id || d.name) === values.departmentId : d === values.departmentId));
      const resolvedDeptName = values.department || (typeof selectedDeptObj === 'object' ? selectedDeptObj.name : selectedDeptObj) || null;

      const payload = {
        departmentId: values.departmentId || null,
        department: resolvedDeptName,
        name: values.name,
        categories: formattedCategories,
        applicableAccess: values.applicableAccess || [],
        description: values.description,
        price: values.price,
        status: values.status,
        handlingDuration: values.handlingDuration,
        isCampaign: values.isCampaign || false,
        campaignDetails: values.isCampaign ? values.campaignDetails : undefined
      };

      const token = localStorage.getItem("token");
      const res = await fetch(isEditing ? `/api/master-items/${id}` : "/api/master-items", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        message.success(isEditing ? "Master Item updated" : "Master Item created");
        navigate(`${getBaseRoute()}/master-items`);
      } else {
        message.error(data.message || data.error || "Failed to save Master Item");
      }
    } catch (error) {
      console.error(error);
      message.error("Error saving Master Item");
    } finally {
      setLoading(false);
    }
  };

  const selectedCategories = Form.useWatch('categories', form) || [];
  const isCampaignChecked = Form.useWatch('isCampaign', form) || false;
  
  // Auto-calculate campaign amount when days or budget change
  const handleCampaignValuesChange = (changedValues, allValues) => {
    if (changedValues.campaignDetails && ('numberOfDays' in changedValues.campaignDetails || 'dailyBudget' in changedValues.campaignDetails)) {
      const days = allValues.campaignDetails?.numberOfDays || 0;
      const budget = allValues.campaignDetails?.dailyBudget || 0;
      form.setFieldsValue({
        campaignDetails: {
          ...allValues.campaignDetails,
          campaignAmount: days * budget
        }
      });
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>{isEditing ? "Edit Master Item" : "Create Master Item"}</Title>
        <Button onClick={() => navigate(`${getBaseRoute()}/master-items`)}>Back</Button>
      </div>
      <Card loading={loading}>
        <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={handleCampaignValuesChange}>
          <Form.Item
            label="Department"
            name="departmentId"
            rules={[{ required: true, message: 'Please select a department' }]}
          >
            <Select
              placeholder="Select Department"
              onChange={handleDepartmentChange}
              allowClear
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children || '').toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {departmentOptions.map((dept) => {
                const idVal = typeof dept === 'object' ? (dept._id || dept.id || dept.name) : dept;
                const labelVal = typeof dept === 'object' ? (dept.name || dept.title || dept.slug) : dept;
                return (
                  <Option key={idVal} value={idVal}>
                    {labelVal}
                  </Option>
                );
              })}
            </Select>
          </Form.Item>
          <Form.Item name="department" hidden>
            <Input />
          </Form.Item>

          <Form.Item label="Item Name" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          
          <Form.Item label="Select Categories" name="categories">
            <Select mode="tags" style={{ width: '100%' }} placeholder="Select or type categories (e.g. Poster, Banner)" />
          </Form.Item>

          {selectedCategories.length > 0 && (
            <div style={{ marginBottom: 24, paddingLeft: 16 }}>
              {selectedCategories.map((cat) => (
                <Row key={cat} style={{ marginBottom: 16 }} align="middle" gutter={16}>
                  <Col span={6}>
                    <Text strong>{cat}</Text>
                  </Col>
                  <Col span={18}>
                    <Form.Item 
                      label={`Number of ${cat}`} 
                      name={['categoryCounts', cat]} 
                      initialValue={0}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber style={{ width: '100%' }} min={0} />
                    </Form.Item>
                  </Col>
                </Row>
              ))}
            </div>
          )}

          <Form.Item name="isCampaign" valuePropName="checked">
            <Switch checkedChildren="Campaign Enabled" unCheckedChildren="Campaign Disabled" />
          </Form.Item>

          {isCampaignChecked && (
            <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <Title level={5} style={{ marginTop: 0 }}>Campaign Details</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="Number of Days" name={['campaignDetails', 'numberOfDays']} rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} min={0} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Daily Budget" name={['campaignDetails', 'dailyBudget']} rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} min={0} prefix="₹" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Campaign Amount" name={['campaignDetails', 'campaignAmount']} rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} min={0} prefix="₹" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          )}

          <Divider orientation="left">Applicable Access / Deliverables</Divider>
          <Form.List name="applicableAccess">
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

          <Form.Item label="Description" name="description">
            <TextArea rows={4} />
          </Form.Item>

          <Form.Item label="Service Price" name="price" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} prefix="₹" />
          </Form.Item>

          <Form.Item label="Handling Duration" name="handlingDuration" rules={[{ required: true }]}>
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

          <Form.Item label="Status" name="status" initialValue="active">
            <Select>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Form.Item>

          <Space style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
            <Button onClick={() => navigate(`${getBaseRoute()}/master-items`)} disabled={loading}>Cancel</Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default MasterItemForm;
