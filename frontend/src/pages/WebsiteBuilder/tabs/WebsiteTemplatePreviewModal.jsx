import React, { useState, useEffect } from "react";
import { Modal, Button, Tag, Typography, Space, Spin } from "antd";
import { X as CloseIcon, Monitor, Tablet, Smartphone, Check, ExternalLink, Globe } from "lucide-react";

const { Title, Text } = Typography;

const WebsiteTemplatePreviewModal = ({ open, template, onClose, onSelect, isSelected = false }) => {
  const [deviceMode, setDeviceMode] = useState("desktop"); // 'desktop' | 'tablet' | 'mobile'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
    }
  }, [open, template]);

  if (!template) return null;

  const getIframeWidth = () => {
    switch (deviceMode) {
      case "mobile":
        return 380;
      case "tablet":
        return 768;
      case "desktop":
      default:
        return "100%";
    }
  };

  const previewUrl = `/api/templates/${template._id}/preview/`;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="100vw"
      style={{ top: 0, padding: 0, maxWidth: "100vw" }}
      bodyStyle={{ padding: 0, height: "100vh", overflow: "hidden", background: "#0f172a", display: "flex", flexDirection: "column" }}
      closeIcon={null}
      destroyOnClose
      className="template-preview-fullmodal"
    >
      {/* Header Bar */}
      <div
        style={{
          height: 64,
          background: "#1e293b",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#fff",
          zIndex: 10
        }}
      >
        {/* Left: Template Info */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff"
            }}
          >
            <Globe size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#f8fafc" }}>{template.name}</span>
              <Tag style={{ background: "rgba(59, 130, 246, 0.2)", border: "1px solid rgba(59, 130, 246, 0.4)", color: "#60a5fa", borderRadius: 6, fontWeight: 600 }}>
                {template.category || "Custom Uploads"}
              </Tag>
              {template.featuresCount && (
                <Tag style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#cbd5e1", borderRadius: 6, fontWeight: 500 }}>
                  {template.featuresCount} Pages
                </Tag>
              )}
            </div>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Full UI Live Interactive Preview</span>
          </div>
        </div>

        {/* Center: Device Switcher */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            padding: 4,
            borderRadius: 10,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            gap: 4
          }}
        >
          <Button
            type="text"
            icon={<Monitor size={18} />}
            onClick={() => setDeviceMode("desktop")}
            style={{
              color: deviceMode === "desktop" ? "#38bdf8" : "#94a3b8",
              background: deviceMode === "desktop" ? "rgba(56, 189, 248, 0.15)" : "transparent",
              borderRadius: 6,
              height: 34,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              fontSize: 13
            }}
          >
            Desktop
          </Button>
          <Button
            type="text"
            icon={<Tablet size={18} />}
            onClick={() => setDeviceMode("tablet")}
            style={{
              color: deviceMode === "tablet" ? "#38bdf8" : "#94a3b8",
              background: deviceMode === "tablet" ? "rgba(56, 189, 248, 0.15)" : "transparent",
              borderRadius: 6,
              height: 34,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              fontSize: 13
            }}
          >
            Tablet
          </Button>
          <Button
            type="text"
            icon={<Smartphone size={18} />}
            onClick={() => setDeviceMode("mobile")}
            style={{
              color: deviceMode === "mobile" ? "#38bdf8" : "#94a3b8",
              background: deviceMode === "mobile" ? "rgba(56, 189, 248, 0.15)" : "transparent",
              borderRadius: 6,
              height: 34,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              fontSize: 13
            }}
          >
            Mobile
          </Button>
        </div>

        {/* Right: Actions */}
        <Space size="middle">
          <Button
            type="primary"
            icon={<Check size={18} />}
            onClick={() => {
              onSelect(template);
              onClose();
            }}
            style={{
              background: isSelected ? "#10b981" : "#0284c7",
              borderColor: "transparent",
              borderRadius: 8,
              height: 40,
              fontWeight: 700,
              padding: "0 20px",
              boxShadow: "0 4px 14px rgba(2, 132, 199, 0.4)"
            }}
          >
            {isSelected ? "Selected" : "Use This Template"}
          </Button>
          <Button
            type="text"
            icon={<CloseIcon size={20} />}
            onClick={onClose}
            style={{
              color: "#cbd5e1",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 8,
              height: 40,
              width: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          />
        </Space>
      </div>

      {/* Preview Content Area */}
      <div
        style={{
          flex: 1,
          position: "relative",
          background: "#0f172a",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
          padding: deviceMode === "desktop" ? 0 : "24px 0"
        }}
      >
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "#0f172a",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              zIndex: 5
            }}
          >
            <Spin size="large" />
            <Text style={{ color: "#94a3b8", fontSize: 14, fontWeight: 500 }}>
              Loading interactive preview of <span style={{ color: "#38bdf8", fontWeight: 700 }}>{template.name}</span>...
            </Text>
          </div>
        )}

        <div
          style={{
            width: getIframeWidth(),
            height: "100%",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: deviceMode === "desktop" ? "none" : "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            borderRadius: deviceMode === "desktop" ? 0 : 16,
            overflow: "hidden",
            border: deviceMode === "desktop" ? "none" : "8px solid #1e293b",
            background: "#ffffff"
          }}
        >
          <iframe
            src={previewUrl}
            title={`Preview of ${template.name}`}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block"
            }}
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </Modal>
  );
};

export default WebsiteTemplatePreviewModal;
