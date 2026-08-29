import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, message, Spin } from "antd";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import ProfessionalProposal from "./components/ProfessionalProposal";
import api from "../../services/api";

const ProposalViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchProposal();
    }
  }, [id]);

  useEffect(() => {
    if (proposal) {
      const title = proposal.name || proposal.proposalNumber || "Proposal";
      document.title = `${title} | M1 Labs`;
    }
    return () => {
      document.title = 'M1 Labs'; // Revert back
    };
  }, [proposal]);

  const handleBack = () => {
    navigate(-1);
  };

  const fetchProposal = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/proposals/${id}`);
      if (res.data?.success) {
        setProposal(res.data.data);
      } else {
        message.error("Failed to fetch proposal");
        handleBack();
      }
    } catch (error) {
      console.error("Failed to fetch proposal:", error);
      message.error("Error loading proposal");
      handleBack();
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page-container proposal-view-page" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className="proposal-view-toolbar no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          width: '100%'
        }}
      >
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
          Back
        </Button>

        <Button icon={<PrinterOutlined />} onClick={handlePrint}>
          Print / Save as PDF
        </Button>
      </div>

      <ProfessionalProposal proposal={proposal} />

      <style>{`
        @media print {
          /* Hide layout wrappers */
          .ant-layout-sider, .ant-layout-header, aside, header { display: none !important; }
          /* Hide buttons and spaces */
          .proposal-view-toolbar, .no-print, .ant-btn { display: none !important; }
          
          /* Remove all padding, margin, and backgrounds */
          body, .ant-layout, .ant-layout-content, .page-container {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          
          .ant-card { box-shadow: none !important; border: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ProposalViewPage;
