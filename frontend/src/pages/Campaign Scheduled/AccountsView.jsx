import React from "react";
import {
  Badge,
  Button,
  Card,
  Col,
  Row,
  Space,
  Tag,
  Typography,
  Divider,
} from "antd";
import {
  FacebookFilled,
  GoogleOutlined,
  InstagramFilled,
  LinkedinFilled,
  YoutubeFilled,
  ShopOutlined,
  PinterestFilled,
} from "@ant-design/icons";
import { SOCIAL_ACCOUNTS } from "./socialAccounts";

const { Text } = Typography;

const PLATFORM_ICONS = {
  facebook: <FacebookFilled />,
  instagram: <InstagramFilled />,
  linkedin: <LinkedinFilled />,
  youtube: <YoutubeFilled />,
  google_business: <ShopOutlined />,
  pinterest: <PinterestFilled />,
};

// All platforms support multiple connected accounts

export default function AccountsView({
  connectedPlatforms,
  accounts = [],
  onLogoutAccount,
  onConnectPlatform,
  loadingPlatform,
  disconnectingAccountId,
  enabledIntegrations = {},
}) {
  const visibleAccounts = SOCIAL_ACCOUNTS.filter(account => {
    const integrationKey = account.id === "google_business" ? "googleBusiness" : account.id;
    return enabledIntegrations[integrationKey] !== false;
  });

  return (
    <Row gutter={[16, 16]}>
      {visibleAccounts.map((account) => {
        const connected = connectedPlatforms[account.id];
        const matchingAccounts = accounts.filter(
          (item) => item.platform === account.id,
        );
        if (account.id === 'facebook' || account.id === 'instagram') {
          console.log(`[AccountsView] ${account.id} -> connected:`, connected, 'matching:', matchingAccounts, 'allAccounts:', accounts);
        }

        return (
          <Col xs={24} md={12} key={account.id}>
            <Card className="campaign-scheduler-surface campaign-scheduler-account-card">
              {/* ── Platform Header ── */}
              <Space align="center" size={10} style={{ marginBottom: 10 }}>
                <span
                  className={`campaign-scheduler-account-logo campaign-scheduler-account-logo-${account.id}`}
                >
                  {PLATFORM_ICONS[account.id]}
                </span>
                <Text strong>{account.label}</Text>
                {connected ? (
                  <Tag color="green" bordered={false}>
                    Active
                  </Tag>
                ) : null}
              </Space>

              {/* ── Connected: one sub-card per account/page ── */}
              {connected && matchingAccounts.length > 0 ? (
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  {matchingAccounts.map((acc, idx) => {
                    const pageName =
                      acc.username || acc.page_name || "Connected account";
                    return (
                      <div
                        key={acc.id || idx}
                        style={{
                          border: "1px solid #f0f0f0",
                          borderRadius: 8,
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <Space direction="vertical" size={2}>
                          <Badge status="success" text="Connected and ready" />
                          <Text
                            className="campaign-scheduler-account-name"
                            style={{ fontSize: 13 }}
                          >
                            {account.id === "pinterest" || acc.platform === "pinterest" ? "Profile: " : "Username: "}{pageName}
                          </Text>
                        </Space>
                        <Button
                          danger
                          size="small"
                          loading={disconnectingAccountId === acc.id}
                          onClick={() => {
                            if (acc.id && onLogoutAccount) {
                              onLogoutAccount(
                                acc.id,
                                `${account.label} - ${pageName}`,
                              );
                            }
                          }}
                        >
                          Logout
                        </Button>
                      </div>
                    );
                  })}

                  {/* Add another account button */}
                  <Button
                    size="small"
                    loading={loadingPlatform === account.id}
                    onClick={() => onConnectPlatform?.(account.id)}
                    style={{ marginTop: 4 }}
                    disabled={account.id === "google_business"}
                  >
                    {account.id === "google_business"
                      ? "Coming Soon"
                      : `+ ${
                          account.id === "youtube"
                            ? "Connect Another Channel"
                            : account.id === "pinterest"
                            ? "Connect Another Profile"
                            : "Connect Another Page"
                        }`}
                  </Button>
                </Space>
              ) : (
                /* ── Not connected ── */
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  <Badge status="default" text="Not connected" />
                  <Button
                    type={account.id === "google_business" ? "default" : "primary"}
                    size="small"
                    loading={loadingPlatform === account.id}
                    onClick={() => onConnectPlatform?.(account.id)}
                    disabled={account.id === "google_business"}
                  >
                    {account.id === "google_business" ? "Coming Soon" : "Connect"}
                  </Button>
                </Space>
              )}
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
