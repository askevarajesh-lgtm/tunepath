import React, { useState, useMemo } from 'react';
import { Typography, Tabs, Button, Spin } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import AdminDashboard from './AdminDashboard';
import AdminLeadsList from './AdminLeadsList';
import GenerateLeadReportModal from './components/GenerateLeadReportModal';
import { useGetLeadsQuery, useGetLeadStatsQuery } from '../../api/leadApi';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

const CRM = () => {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  
  const { data: statsData, isLoading: isStatsLoading } = useGetLeadStatsQuery();
  const { data: leadsData, isLoading: isLeadsLoading, refetch } = useGetLeadsQuery(undefined, { skip: activeTab !== 'dashboard' });
  const leads = leadsData?.data?.leads || [];
  const stats = statsData?.data || null;

  const isAgencyClientOrClientUser = useMemo(() => {
    const r = (role || user?.role || '').toLowerCase();
    const ut = (user?.userType || '').toLowerCase();
    const pathname = window.location.pathname;

    if (r === 'agency_client' || ut === 'agency_client' || r === 'client' || ut === 'client') return true;
    if (r.startsWith('brand') || ut.startsWith('brand')) return true;
    if (pathname.startsWith('/client')) return true;
    if ((user?.brandId || user?.clientId) && !['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager', 'agency'].includes(r)) {
      return true;
    }
    return false;
  }, [role, user]);

  const canGenerateMoMReport = useMemo(() => {
    if (isAgencyClientOrClientUser) return false;
    const r = (role || user?.role || '').toLowerCase();
    return ['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager', 'agency', 'admin'].includes(r);
  }, [isAgencyClientOrClientUser, role, user]);

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
        {canGenerateMoMReport && (
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
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Tabs 
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          tabBarStyle={{ marginBottom: 24 }}
          items={[
            {
              key: 'dashboard',
              label: <strong style={{ fontWeight: 600 }}>Dashboard</strong>,
              children: (
                <AdminDashboard 
                  leads={leads} 
                  stats={stats} 
                  isLoading={isLeadsLoading && isStatsLoading} 
                  onOpenReportModal={canGenerateMoMReport ? () => setReportModalOpen(true) : null} 
                />
              )
            },
            {
              key: 'leads',
              label: <strong style={{ fontWeight: 600 }}>Leads List</strong>,
              children: <AdminLeadsList leads={leads} isLoading={isLeadsLoading} refetch={refetch} />
            }
          ]}
        />
      </div>

      {canGenerateMoMReport && (
        <GenerateLeadReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          leads={leads}
        />
      )}
    </motion.div>
  );
};

export default CRM;

