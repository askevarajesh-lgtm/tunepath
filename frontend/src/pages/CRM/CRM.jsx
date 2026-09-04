import React, { useState } from 'react';
import { Typography, Tabs, Spin, Button } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import AdminDashboard from './AdminDashboard';
import AdminLeadsList from './AdminLeadsList';
import GenerateLeadReportModal from './components/GenerateLeadReportModal';
import { useGetLeadsQuery } from '../../api/leadApi';

const { Title, Text } = Typography;

const CRM = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  
  const { data: leadsData, isLoading, refetch } = useGetLeadsQuery();
  const leads = leadsData?.data?.leads || [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexShrink: 0 }}>
        <div>
          <Title level={2} style={{ margin: '4px 0 0 0', fontWeight: 800 }}>
            Leads Management Hub
          </Title>
          <Text type="secondary">
            Track lead status, conversion, and pipeline movement across all agencies and clients.
          </Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<FilePdfOutlined />}
          onClick={() => setReportModalOpen(true)}
          style={{
            borderRadius: 8,
            fontWeight: 700,
            background: 'linear-gradient(135deg, #1677ff 0%, #0050b3 100%)',
            border: 'none',
            boxShadow: '0 4px 12px rgba(22, 119, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          Generate MoM Report
        </Button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Spin size="large" />
          </div>
        ) : (
          <Tabs 
            activeKey={activeTab}
            onChange={setActiveTab}
            size="large"
            tabBarStyle={{ marginBottom: 24 }}
            items={[
              {
                key: 'dashboard',
                label: <strong style={{ fontWeight: 600 }}>Dashboard</strong>,
                children: <AdminDashboard leads={leads} onOpenReportModal={() => setReportModalOpen(true)} />
              },
              {
                key: 'leads',
                label: <strong style={{ fontWeight: 600 }}>Leads List</strong>,
                children: <AdminLeadsList leads={leads} refetch={refetch} />
              }
            ]}
          />
        )}
      </div>

      <GenerateLeadReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        leads={leads}
      />
    </motion.div>
  );
};

export default CRM;

