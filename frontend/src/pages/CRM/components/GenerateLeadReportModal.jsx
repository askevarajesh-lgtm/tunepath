import React, { useState } from 'react';
import { Modal, DatePicker, Button, Form, message, Space, Typography, Tag } from 'antd';
import { FilePdfOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { generateLeadReportPDF } from '../utils/leadReportPdfGenerator';

const { Text } = Typography;

const GenerateLeadReportModal = ({ open, onClose, leads = [] }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values) => {
    try {
      setLoading(true);
      const selectedMonth = values.selectedMonth || dayjs();

      message.loading({ content: 'Generating Month-on-Month Lead Report PDF...', key: 'leadReportGen' });
      
      // Generate and download client PDF
      generateLeadReportPDF(leads, {
        selectedMonth,
        clientName: 'Leads Management Hub',
        agencyName: 'Agency Growth OS'
      });

      message.success({ content: 'Leads Performance PDF Report downloaded successfully!', key: 'leadReportGen' });
      onClose();
    } catch (err) {
      console.error('Failed to generate lead report:', err);
      message.error({ content: err?.message || 'Failed to generate lead report', key: 'leadReportGen' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <Space align="center" style={{ fontSize: 18, fontWeight: 700 }}>
          <FilePdfOutlined style={{ color: '#1677ff' }} />
          <span>Generate Month-on-Month Lead Performance Report</span>
        </Space>
      }
      width={560}
      destroyOnClose
    >
      <div style={{ marginTop: 16 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
          Create a comprehensive 6-page Month-on-Month Lead Analysis report for your client, including status movement, channel conversion breakdown, team workload, and 6-month trends.
        </Text>

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            selectedMonth: dayjs()
          }}
          onFinish={handleFinish}
        >
          <Form.Item
            label="Reporting Month"
            name="selectedMonth"
            rules={[{ required: true, message: 'Please select a reporting month' }]}
            help="The report will compare this month's data against the previous month."
          >
            <DatePicker 
              picker="month" 
              style={{ width: '100%', height: 40 }} 
              format="MMMM YYYY"
              disabledDate={(current) => current && current > dayjs().endOf('month')}
            />
          </Form.Item>

          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginTop: 16, marginBottom: 24, border: '1px solid #e2e8f0' }}>
            <Text strong style={{ display: 'block', marginBottom: 8, color: '#0f172a' }}>Included Report Sections:</Text>
            <Space wrap size={[8, 8]}>
              <Tag color="blue">Page 1: Executive Cover Page</Tag>
              <Tag color="blue">Page 2: Executive Summary & MoM KPIs</Tag>
              <Tag color="purple">Page 3: Lead Sources & Channel Acquisition</Tag>
              <Tag color="green">Page 4: Team Performance & Lead Workload</Tag>
              <Tag color="orange">Page 5: Historical 6-Month MoM Trend</Tag>
              <Tag color="geekblue">Page 6: Recent Leads Audit Log</Tag>
            </Space>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={onClose} style={{ height: 40 }}>
              Cancel
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<DownloadOutlined />}
              style={{ height: 40, paddingLeft: 24, paddingRight: 24, fontWeight: 600 }}
            >
              Generate & Download PDF
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};

export default GenerateLeadReportModal;
