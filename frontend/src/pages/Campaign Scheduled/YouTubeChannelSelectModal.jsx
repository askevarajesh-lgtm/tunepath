import React, { useState, useMemo } from "react";
import {
  Modal,
  Input,
  List,
  Avatar,
  Checkbox,
  Typography,
  Empty,
  Alert,
  Button,
} from "antd";
import { SearchOutlined, YoutubeFilled, PlusOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

export default function YouTubeChannelSelectModal({
  open,
  onCancel,
  data,
  onConnect,
  loading,
  onConnectAnother,
}) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const filteredChannels = useMemo(() => {
    if (!data?.channels) return [];
    return data.channels
      .filter((channel) =>
        channel.title.toLowerCase().includes(search.toLowerCase()),
      )
      .map((channel) => channel);
  }, [data, search]);

  // Auto-select all channels on load or when data changes
  React.useEffect(() => {
    if (data?.channels) {
      setSelectedIds(data.channels.map((c) => c.id));
    }
  }, [data]);

  const missingPermissions = useMemo(() => {
    const granted = data?.grantedScopes || "";
    // If they have full 'youtube' scope, they have everything.
    if (granted.includes("https://www.googleapis.com/auth/youtube ")) return [];
    if (granted.endsWith("https://www.googleapis.com/auth/youtube")) return [];

    const required = ["https://www.googleapis.com/auth/youtube.upload"];
    return required.filter((s) => !granted.includes(s));
  }, [data]);

  const toggleSelection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id],
    );
  };

  const handleConnect = () => {
    onConnect(selectedIds);
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <YoutubeFilled style={{ color: "#FF0000", fontSize: 24 }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            Which YouTube channels do you want to connect?
          </span>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button 
          key="connectAnother" 
          onClick={onConnectAnother} 
          icon={<PlusOutlined />}
        >
          Connect Another Channel
        </Button>,
        <Button
          key="connect"
          type="primary"
          onClick={handleConnect}
          loading={loading}
          disabled={selectedIds.length === 0}
        >
          Connect Selected
        </Button>,
      ]}
      width={600}
      centered
    >
      <div style={{ marginBottom: 20, marginTop: 10 }}>
        <Input
          placeholder="Search for YouTube channels"
          prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="large"
          style={{ borderRadius: 8 }}
        />
      </div>

      {missingPermissions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="Required permissions (Upload/Manage) missing. Please reconnect and check all boxes."
            type="warning"
            showIcon
          />
        </div>
      )}

      <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Title
            level={5}
            style={{ margin: 0, fontSize: 14, color: "#595959" }}
          >
            Channel(s)
          </Title>
        </div>
        {filteredChannels.length > 0 ? (
          <List
            dataSource={filteredChannels}
            renderItem={(channel) => (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 16px",
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  marginBottom: 8,
                  cursor: "pointer",
                }}
                onClick={() => toggleSelection(channel.id)}
              >
                <Avatar
                  src={channel.thumbnail}
                  size={40}
                  style={{ marginRight: 12, backgroundColor: "#FF0000" }}
                >
                  {channel.title?.charAt(0).toUpperCase()}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <Text strong style={{ fontSize: 15 }}>
                    {channel.title}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {channel.customUrl || channel.id}
                  </Text>
                </div>
                <Checkbox checked={selectedIds.includes(channel.id)} />
              </div>
            )}
          />
        ) : search ? (
          <Empty
            description="No channels found matching your search"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Alert
            message={
              <span style={{ color: "#cf1322" }}>
                There are no channels associated with this account.
              </span>
            }
            type="error"
            showIcon
            style={{
              background: "#fff1f0",
              border: "1px solid #ffa39e",
              borderRadius: 8,
            }}
          />
        )}
      </div>
    </Modal>
  );
}
