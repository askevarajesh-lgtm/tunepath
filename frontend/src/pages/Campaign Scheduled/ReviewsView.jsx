import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Rate,
  Button,
  Modal,
  Input,
  message,
  Space,
  Typography,
  Tag,
  Empty,
  Select,
} from "antd";
import {
  MessageOutlined,
  GoogleOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { campaignScheduledApi } from "./api";

const { Text, Title, Paragraph } = Typography;

export default function ReviewsView({ accounts = [], activeClientId }) {
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const gbpAccounts = accounts.filter(
    (acc) => acc.platform === "google_business",
  );

  useEffect(() => {
    if (gbpAccounts.length > 0 && !selectedAccount) {
      setSelectedAccount(gbpAccounts[0].id);
    }
  }, [gbpAccounts, selectedAccount]);

  useEffect(() => {
    if (selectedAccount) {
      loadReviews(selectedAccount);
    }
  }, [selectedAccount]);

  const loadReviews = async (accountId) => {
    setLoading(true);
    try {
      const res = await campaignScheduledApi.getGoogleBusinessReviews(
        accountId,
        activeClientId,
      );
      setReviews(res.data || []);
    } catch (err) {
      message.error("Failed to load reviews: " + err.message);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReply = (review) => {
    setSelectedReview(review);
    setReplyText(review.reviewReply?.comment || "");
    setReplyModalOpen(true);
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim()) {
      message.warning("Please enter a reply");
      return;
    }

    setSubmittingReply(true);
    try {
      await campaignScheduledApi.replyToGoogleBusinessReview(
        {
          accountId: selectedAccount,
          reviewName: selectedReview.name,
          replyText: replyText.trim(),
        },
        activeClientId,
      );
      message.success("Reply posted successfully");
      setReplyModalOpen(false);
      loadReviews(selectedAccount);
    } catch (err) {
      message.error("Failed to post reply: " + err.message);
    } finally {
      setSubmittingReply(false);
    }
  };

  const columns = [
    {
      title: "Reviewer",
      dataIndex: ["reviewer", "displayName"],
      key: "reviewer",
      render: (text) => <Text strong>{text || "Anonymous"}</Text>,
    },
    {
      title: "Rating",
      dataIndex: "starRating",
      key: "rating",
      render: (rating) => {
        const starMap = {
          STAR_RATING_UNSPECIFIED: 0,
          ONE: 1,
          TWO: 2,
          THREE: 3,
          FOUR: 4,
          FIVE: 5,
        };
        return <Rate disabled defaultValue={starMap[rating] || 0} />;
      },
    },
    {
      title: "Review",
      dataIndex: "comment",
      key: "comment",
      render: (text) => (
        <Paragraph
          ellipsis={{ rows: 2, expandable: true, symbol: "more" }}
          style={{ marginBottom: 0 }}
        >
          {text || (
            <Text type="secondary" italic>
              No comment provided
            </Text>
          )}
        </Paragraph>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) =>
        record.reviewReply ? (
          <Tag color="green">Replied</Tag>
        ) : (
          <Tag color="orange">Pending</Tag>
        ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button
          type="link"
          icon={<MessageOutlined />}
          onClick={() => handleOpenReply(record)}
        >
          {record.reviewReply ? "Edit Reply" : "Reply"}
        </Button>
      ),
    },
  ];

  if (gbpAccounts.length === 0) {
    return (
      <Card className="campaign-scheduler-surface">
        <Empty
          image={<GoogleOutlined style={{ fontSize: 48, color: "#4285f4" }} />}
          description={
            <div style={{ marginTop: 16 }}>
              <Title level={5}>No Google Business Accounts Connected</Title>
              <Text type="secondary">
                Connect your Google Business Profile in the Accounts tab to
                manage reviews.
              </Text>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="reviews-view">
      <Card className="campaign-scheduler-surface" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <Title level={4} style={{ marginBottom: 4 }}>
                Google Business Reviews
              </Title>
              <Text type="secondary">
                Manage and respond to your customer reviews from one place.
              </Text>
            </div>
            <Select
              value={selectedAccount}
              onChange={setSelectedAccount}
              style={{ width: 250 }}
              placeholder="Select Business Location"
            >
              {gbpAccounts.map((acc) => (
                <Select.Option key={acc.id} value={acc.id}>
                  {acc.page_name}
                </Select.Option>
              ))}
            </Select>
          </div>
        </Space>
      </Card>

      <Card className="campaign-scheduler-surface">
        <Table
          columns={columns}
          dataSource={reviews}
          loading={loading}
          rowKey="name"
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <MessageOutlined />
            <span>Reply to Review</span>
          </Space>
        }
        open={replyModalOpen}
        onCancel={() => setReplyModalOpen(false)}
        onOk={handleSubmitReply}
        confirmLoading={submittingReply}
        okText="Post Reply"
        width={500}
      >
        {selectedReview && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                background: "#f8fafc",
                padding: 16,
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <Text strong>{selectedReview.reviewer?.displayName}</Text>
                <Rate
                  disabled
                  defaultValue={
                    {
                      STAR_RATING_UNSPECIFIED: 0,
                      ONE: 1,
                      TWO: 2,
                      THREE: 3,
                      FOUR: 4,
                      FIVE: 5,
                    }[selectedReview.starRating] || 0
                  }
                  style={{ fontSize: 14 }}
                />
              </div>
              <Paragraph style={{ marginBottom: 0 }}>
                {selectedReview.comment}
              </Paragraph>
            </div>

            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Your Response
            </Text>
            <Input.TextArea
              rows={4}
              placeholder="Write your response here..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <Text
              type="secondary"
              style={{ fontSize: 12, marginTop: 8, display: "block" }}
            >
              Your reply will be visible publicly on Google Maps and Search.
            </Text>
          </div>
        )}
      </Modal>
    </div>
  );
}
