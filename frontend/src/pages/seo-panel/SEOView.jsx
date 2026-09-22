import React, { useState } from "react";
import {
  Card,
  Tag,
  Button,
  Space,
  message,
  Descriptions,
  Spin,
  Divider,
  Typography,
  Row,
  Col,
  Tabs,
  Image,
  Timeline,
  Empty,
} from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  ArrowLeftOutlined,
  EditOutlined,
  FileOutlined,
  LockOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import { Icon } from "@iconify/react";
import { useGetSEOByIdQuery, useGetSEOTimelineQuery } from "../../api/seoApi";
import TimelineView from "../../components/common/TimelineView";
import WorkUpdateModal from "./WorkUpdateModal";
import { useActionPermissions } from "../../hooks/useActionPermissions";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const SEOView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { data, isLoading, refetch } = useGetSEOByIdQuery(id);
  const { data: timelineData, isLoading: isLoadingTimeline } =
    useGetSEOTimelineQuery(id, { skip: !id });
  const [isWorkUpdateModalOpen, setIsWorkUpdateModalOpen] = useState(false);

  const seo = data?.data?.seo;
  const timelineEvents = timelineData?.data?.timelineEvents || [];
  const workUpdates = seo?.workUpdates || [];

  const { canAdd, canEdit } = useActionPermissions("/seo-panel");

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!seo) {
    return (
      <div>
        <Card>
          <Text type="danger">SEO entry not found</Text>
        </Card>
      </div>
    );
  }

  const services = [];
  if (seo.contentWork) services.push("Content Work");
  if (seo.onpageSeo) services.push("On-page SEO");
  if (seo.technicalSeo) services.push("Technical SEO");
  if (seo.localSeo) services.push("Local SEO");
  if (seo.keywordResearch) services.push("Keyword Research");
  if (seo.offPageSeo) services.push("Off-page SEO");

  const workTypeLabels = {
    contentWork: "Content Work",
    onpageSeo: "On-page SEO",
    technicalSeo: "Technical SEO",
    localSeo: "Local SEO",
    keywordResearch: "Keyword Research",
    offPageSeo: "Off-page SEO",
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 24,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("..")}
        >
          Back
        </Button>
        <h1
          style={{ margin: 0, fontSize: "24px", fontWeight: "bold", flex: 1 }}
        >
          SEO Entry Details
        </h1>
        <Space>
          {canEdit && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsWorkUpdateModalOpen(true)}
            >
              Add Work Update
            </Button>
          )}
          {canEdit && (
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`../edit/${id}`)}
            >
              Edit SEO Entry
            </Button>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <Descriptions
          bordered
          column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
          style={{ fontSize: "14px" }}
        >
          <Descriptions.Item label="Website Link">
            <a href={seo.websiteLink} target="_blank" rel="noopener noreferrer">
              {seo.websiteLink}
            </a>
          </Descriptions.Item>
          <Descriptions.Item label="Keywords">
            {seo.keywords || "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Secondary Keywords">
            {seo.secondaryKeywords || "N/A"}
          </Descriptions.Item>
          <Descriptions.Item label="Off-page SEO Count">
            {seo.offPageSeoCount || 0}
          </Descriptions.Item>
          <Descriptions.Item label="Weekly Reports SEO Count">
            {seo.weeklyReportsSeoCount || 0}
          </Descriptions.Item>
          <Descriptions.Item label="Total Websites">
            <Text strong>1</Text> <Text type="secondary">(This entry)</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {dayjs(seo.createdAt).format("DD MMM YYYY, hh:mm A")}
          </Descriptions.Item>
          <Descriptions.Item label="Updated At">
            {dayjs(seo.updatedAt).format("DD MMM YYYY, hh:mm A")}
          </Descriptions.Item>
          {seo.createdBy && (
            <Descriptions.Item label="Created By">
              {seo.createdBy?.name || "N/A"}
            </Descriptions.Item>
          )}
          {seo.updatedBy && (
            <Descriptions.Item label="Updated By">
              {seo.updatedBy?.name || "N/A"}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Tabs defaultActiveKey="details">
        <TabPane
          tab={
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ScheduleOutlined />
              Details
            </span>
          }
          key="details"
        >
          {(seo.keywords || seo.secondaryKeywords) && (
            <Card title="Keywords" style={{ marginBottom: 16 }}>
              <Row gutter={[24, 12]}>
                {/* Primary Keywords */}
                {seo.keywords && (
                  <Col xs={24} md={12}>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>
                      Primary Keywords:
                    </Text>
                    <Space wrap size={[8, 8]}>
                      {seo.keywords
                        .split(/[,\n;]/)
                        .map((k) => k.trim())
                        .filter((k) => k.length > 0)
                        .map((keyword, idx) => (
                          <Tag
                            key={idx}
                            color="blue"
                            style={{ fontSize: 13, padding: "2px 8px" }}
                          >
                            {keyword}
                          </Tag>
                        ))}
                    </Space>
                  </Col>
                )}

                {/* Secondary Keywords */}
                {seo.secondaryKeywords && (
                  <Col xs={24} md={12}>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>
                      Secondary Keywords:
                    </Text>
                    <Space wrap size={[8, 8]}>
                      {seo.secondaryKeywords
                        .split(/[,\n;]/)
                        .map((k) => k.trim())
                        .filter((k) => k.length > 0)
                        .map((keyword, idx) => (
                          <Tag
                            key={idx}
                            color="cyan"
                            style={{ fontSize: 13, padding: "2px 8px" }}
                          >
                            {keyword}
                          </Tag>
                        ))}
                    </Space>
                  </Col>
                )}
              </Row>
            </Card>
          )}

          <Card title="SEO Services" style={{ marginBottom: 16 }}>
            {services.length > 0 ? (
              <Space wrap>
                {services.map((service, idx) => (
                  <Tag
                    key={idx}
                    color="blue"
                    style={{ fontSize: 14, padding: "4px 12px" }}
                  >
                    {service}
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">No services selected</Text>
            )}
          </Card>

          {seo.websiteAuditScreenshot && (
            <Card title="Website Audit Screenshot" style={{ marginBottom: 16 }}>
              <Image
                src={seo.websiteAuditScreenshot}
                alt="Website Audit Screenshot"
                style={{ maxWidth: "100%", borderRadius: 8 }}
                preview={{
                  mask: "View Full Size",
                }}
              />
            </Card>
          )}

          {seo.profileLinkOffPageSeo && (
            <Card title="Off-page SEO" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={1}>
                <Descriptions.Item label="Profile Link">
                  <a
                    href={seo.profileLinkOffPageSeo}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {seo.profileLinkOffPageSeo}
                  </a>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {seo.profileLinkWeeklyReports && (
            <Card title="Weekly Reports SEO" style={{ marginBottom: 16 }}>
              <Descriptions bordered column={1}>
                <Descriptions.Item label="Profile Link">
                  <a
                    href={seo.profileLinkWeeklyReports}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {seo.profileLinkWeeklyReports}
                  </a>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {seo.googleSheetLinks && seo.googleSheetLinks.length > 0 && (
            <Card title="Google Sheet Links" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                {seo.googleSheetLinks.map((link, index) => (
                  <div key={index}>
                    <a href={link} target="_blank" rel="noopener noreferrer">
                      {link}
                    </a>
                  </div>
                ))}
              </Space>
            </Card>
          )}

          {seo.googleSheetLinksWeeklyReports &&
            seo.googleSheetLinksWeeklyReports.length > 0 && (
              <Card
                title="Google Sheet Links (Weekly Reports)"
                style={{ marginBottom: 16 }}
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  {seo.googleSheetLinksWeeklyReports.map((link, index) => (
                    <div key={index}>
                      <a href={link} target="_blank" rel="noopener noreferrer">
                        {link}
                      </a>
                    </div>
                  ))}
                </Space>
              </Card>
            )}

          {seo.credentialsFile && (
            <Card
              title={
                <Space>
                  <LockOutlined />
                  <span>Credentials</span>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Descriptions bordered column={1}>
                <Descriptions.Item label="Credentials File">
                  <div>
                    <Text>{seo.credentialsFileName || "Credentials File"}</Text>
                    <br />
                    <a
                      href={seo.credentialsFile}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginTop: 8, display: "inline-block" }}
                    >
                      <Button type="link" icon={<FileOutlined />}>
                        Download Credentials
                      </Button>
                    </a>
                  </div>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </TabPane>

        <TabPane
          tab={
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon
                icon="material-symbols:work-update-outline-sharp"
                width="22"
              />
              Work Updates
            </span>
          }
          key="work-updates"
        >
          <Card>
            {workUpdates.length > 0 ? (
              <Timeline
                mode="left"
                items={workUpdates
                  .slice()
                  .reverse()
                  .map((update, index) => ({
                    color: "green",
                    dot: <CheckCircleOutlined style={{ fontSize: "16px" }} />,
                    children: (
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          <Space
                            direction="vertical"
                            size="small"
                            style={{ width: "100%" }}
                          >
                            {update.workType && (
                              <Tag color="blue" style={{ marginBottom: 4 }}>
                                {workTypeLabels[update.workType] ||
                                  update.workType}
                              </Tag>
                            )}
                            <Text
                              strong
                              style={{ display: "block", marginBottom: 4 }}
                            >
                              {update.completedWork}
                            </Text>
                            {update.workType === "offPageSeo" &&
                              update.offPageBacklinkCount !== undefined &&
                              update.offPageBacklinkCount !== null && (
                                <div style={{ marginBottom: 8 }}>
                                  <Tag color="green">
                                    Backlinks: {update.offPageBacklinkCount}
                                  </Tag>
                                </div>
                              )}
                            <Space split={<Divider type="vertical" />}>
                              {update.updatedBy && (
                                <Text
                                  type="secondary"
                                  style={{ fontSize: "12px" }}
                                >
                                  <UserOutlined />{" "}
                                  {update.updatedBy?.name || "Unknown"}
                                </Text>
                              )}
                              <Text
                                type="secondary"
                                style={{ fontSize: "12px" }}
                              >
                                {dayjs(update.createdAt).format(
                                  "DD MMM YYYY, hh:mm A",
                                )}
                              </Text>
                            </Space>
                          </Space>
                        </div>
                        {update.screenshots &&
                          update.screenshots.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <Text
                                type="secondary"
                                style={{
                                  fontSize: "12px",
                                  display: "block",
                                  marginBottom: 8,
                                }}
                              >
                                Proof Files ({update.screenshots.length}):
                              </Text>
                              <Row gutter={[8, 8]}>
                                {update.screenshots.map((screenshot, idx) => {
                                  const isImage = screenshot.url.match(
                                    /\.(jpg|jpeg|png|gif|webp|bmp)$/i,
                                  );
                                  return (
                                    <Col
                                      key={idx}
                                      xs={24}
                                      sm={12}
                                      md={8}
                                      lg={6}
                                    >
                                      {isImage ? (
                                        <Image
                                          src={screenshot.url}
                                          alt={`Proof ${idx + 1}`}
                                          style={{
                                            width: "100%",
                                            borderRadius: 4,
                                          }}
                                          preview={{
                                            mask: "View Full Size",
                                          }}
                                        />
                                      ) : (
                                        <div
                                          style={{
                                            padding: "16px",
                                            border: "1px solid #d9d9d9",
                                            borderRadius: 4,
                                            textAlign: "center",
                                            backgroundColor: "#fafafa",
                                          }}
                                        >
                                          <FileOutlined
                                            style={{
                                              fontSize: "24px",
                                              color: "var(--accent-primary)",
                                            }}
                                          />
                                          <div
                                            style={{
                                              marginTop: 8,
                                              fontSize: "12px",
                                            }}
                                          >
                                            <a
                                              href={screenshot.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                            >
                                              {screenshot.fileName ||
                                                `Proof ${idx + 1}`}
                                            </a>
                                          </div>
                                        </div>
                                      )}
                                    </Col>
                                  );
                                })}
                              </Row>
                            </div>
                          )}
                      </div>
                    ),
                  }))}
              />
            ) : (
              <Empty
                description="No work updates yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setIsWorkUpdateModalOpen(true)}
                >
                  Add First Work Update
                </Button>
              </Empty>
            )}
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Icon icon="subway:time-2" width="22" />
              Timeline & History
            </span>
          }
          key="timeline"
        >
          <Card>
            <Spin spinning={isLoadingTimeline}>
              <TimelineView
                events={timelineEvents}
                entityType="seo"
                entityId={id}
              />
            </Spin>
          </Card>
        </TabPane>
      </Tabs>

      <WorkUpdateModal
        open={isWorkUpdateModalOpen}
        onCancel={() => setIsWorkUpdateModalOpen(false)}
        seoId={id}
        onSuccess={() => {
          refetch();
        }}
      />
    </div>
  );
};

export default SEOView;
