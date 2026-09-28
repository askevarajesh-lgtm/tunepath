import React, { useState, useEffect } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import SubAgencySidebar from './SubAgencySidebar';
import Header from './Header';

const { Content } = Layout;

const SubAgencyLayout = () => {
  const [collapsed, setCollapsed] = useState(window.innerWidth < 1300);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1300) {
        setCollapsed(true);
      } else {
        setCollapsed(false);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Layout className="app-root-shell">
      <SubAgencySidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <Layout className="app-main-shell">
        <Header collapsed={collapsed} setCollapsed={setCollapsed} />
        <Content className="app-content">
          <div className="app-content__inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SubAgencyLayout;
