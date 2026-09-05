import React, { useState } from "react";
import {
  Card,
  Table,
  Tabs,
  Tag,
  Space,
  Typography,
  Spin,
  Empty,
  Input,
  DatePicker,
  Button,
  Row,
  Col,
  Collapse,
  Descriptions,
  Avatar,
  message,
  Modal,
} from "antd";
import {
  FileTextOutlined,
  HistoryOutlined,
  SearchOutlined,
  UserOutlined,
  CalendarOutlined,
  ReloadOutlined,
  BellOutlined,
  LinkOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import {
  useGetAllUsersLatestReportsQuery,
  useGetAllUsersReportHistoryQuery,
  useNotifyMissingYesterdayReportsMutation,
} from "../../api/notepadApi";
import DebouncedSearchInput from "../../components/common/DebouncedSearchInput";
import usePagination from "../../hooks/usePagination";
import dayjs from "dayjs";
import LinkifiedText from "../../components/common/LinkifiedText";

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

const DailyReports = () => {
  const [activeTab, setActiveTab] = useState("reports");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [dateRange, setDateRange] = useState(null);

  // Pagination for Reports tab
  const {
    pagination: reportsPagination,
    queryParams: reportsQueryParams,
    handleTableChange: handleReportsTableChange,
  } = usePagination({ defaultPageSize: 50 });

  // Pagination for History tab
  const {
    pagination: historyPagination,
    queryParams: historyQueryParams,
    handleTableChange: handleHistoryTableChange,
  } = usePagination({ defaultPageSize: 20 });

  // Build query params with search and date filters
  const reportsParams = {
    ...reportsQueryParams,
    ...(searchTerm && { search: searchTerm }),
    ...(selectedDate && { date: selectedDate.format("YYYY-MM-DD") }),
  };

  const historyParams = {
    ...historyQueryParams,
    ...(searchTerm && { search: searchTerm }),
    ...(dateRange &&
      dateRange[0] && { startDate: dateRange[0].format("YYYY-MM-DD") }),
    ...(dateRange &&
      dateRange[1] && { endDate: dateRange[1].format("YYYY-MM-DD") }),
  };

  const {
    data: reportsData,
    isLoading: isLoadingReports,
    refetch: refetchReports,
  } = useGetAllUsersLatestReportsQuery(reportsParams);
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useGetAllUsersReportHistoryQuery(historyParams);
  const [notifyMissingReports, { isLoading: isNotifying }] =
    useNotifyMissingYesterdayReportsMutation();

  const reportsPaginationData = reportsData?.data?.pagination;
  const reports = Array.isArray(reportsData?.data) ? reportsData.data : (reportsData?.data?.reports || []);
  const reportsTotalRef = React.useRef(0);
  if (reportsPaginationData?.total !== undefined) {
    reportsTotalRef.current = reportsPaginationData.total;
  }
  const reportsTotal = reportsPaginationData?.total || reports.length || reportsTotalRef.current;

  const historyPaginationData = historyData?.data?.pagination;
  const userReports = Array.isArray(historyData?.data) ? historyData.data : (historyData?.data?.userReports || []);
  const historyTotalRef = React.useRef(0);
  if (historyPaginationData?.total !== undefined) {
    historyTotalRef.current = historyPaginationData.total;
  }
  const historyTotal = historyPaginationData?.total || userReports.length || historyTotalRef.current;

  // KPI Calculations based on reports list
  const totalEmployees = reportsTotal || reports.length;
  const reportsSubmitted = React.useMemo(() => {
    return reports.filter((r) => Boolean(r.content && r.content.trim())).length;
  }, [reports]);
  const reportsPending = React.useMemo(() => {
    return reports.filter((r) => !r.content || !r.content.trim()).length;
  }, [reports]);

  const containerVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
  };

  const handleSingleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handlePrevDate = () => {
    setSelectedDate((prev) => (prev ? prev.subtract(1, "day") : dayjs().subtract(1, "day")));
  };

  const handleNextDate = () => {
    setSelectedDate((prev) => (prev ? prev.add(1, "day") : dayjs().add(1, "day")));
  };

  const handleTodayDate = () => {
    setSelectedDate(dayjs());
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedDate(dayjs());
    setDateRange(null);
  };

  const handleNotifyMissingReports = async () => {
    try {
      const { data: result, error } = await notifyMissingReports();
      if (error) {
        message.error(error?.message || "Failed to send notifications");
        return;
      }
      const { notifiedCount, notifiedUsers, skippedCount } = result.data;

      // Show success message with details
      Modal.success({
        title: "Notifications Sent",
        width: 600,
        content: (
          <div>
            <p>
              <strong>
                Notifications sent to {notifiedCount} user(s) who haven't
                submitted yesterday's report.
              </strong>
            </p>
            {notifiedCount > 0 && (
              <div style={{ marginTop: 16 }}>
                <p>
                  <strong>Notified Users:</strong>
                </p>
                <ul
                  style={{
                    maxHeight: "200px",
                    overflowY: "auto",
                    paddingLeft: 20,
                  }}
                >
                  {notifiedUsers.map((user, index) => (
                    <li key={user.userId || index}>
                      {user.userName} ({user.userEmail})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {skippedCount > 0 && (
              <p style={{ marginTop: 8, color: "#52c41a" }}>
                {skippedCount} user(s) already submitted their report and were
                skipped.
              </p>
            )}
          </div>
        ),
      });

      // Refresh the reports to show updated status
      refetchReports();
    } catch (error) {
      message.error(error?.data?.message || "Failed to send notifications");
    }
  };

  // Reports Tab Columns
  const reportsColumns = [
    {
      title: "User",
      key: "user",
      width: 200,
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>{record.userName}</div>
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.userEmail}
            </Text>
            <br />
            <Tag color="blue" style={{ fontSize: "11px", marginTop: "4px" }}>
              {record.userRole}
            </Tag>
          </div>
        </Space>
      ),
    },
    {
      title: "Latest Update",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (date) =>
        date ? dayjs(date).format("DD MMM YYYY, hh:mm A") : "N/A",
      sorter: (a, b) => {
        if (!a.updatedAt && !b.updatedAt) return 0;
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;
        return new Date(a.updatedAt) - new Date(b.updatedAt);
      },
    },
    {
      title: "Note Date",
      dataIndex: "noteDate",
      key: "noteDate",
      width: 150,
      render: (date) => (date ? dayjs(date).format("DD MMM YYYY") : "N/A"),
    },
    {
      title: "Content Preview",
      dataIndex: "content",
      key: "content",
      ellipsis: {
        showTitle: false,
      },
      render: (content, record) => {
        if (!content) {
          return (
            <Text type="secondary" italic>
              No report submitted
            </Text>
          );
        }
        const preview =
          content.length > 150 ? `${content.substring(0, 150)}...` : content;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <LinkifiedText
              text={preview}
              style={{ display: "inline-block", maxWidth: "100%" }}
            />
            {record.googleSheetUrl && (
              <div>
                <a href={record.googleSheetUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500, color: '#1890ff' }}>
                  <LinkOutlined /> Google Sheet
                </a>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 120,
      render: (_, record) => {
        if (!record.content) {
          return <Tag color="default">No Report</Tag>;
        }
        if (record.isEditable) {
          return <Tag color="green">Active</Tag>;
        }
        return <Tag color="orange">Locked</Tag>;
      },
    },
  ];

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      <motion.div
        variants={itemVariants}
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
            Daily Reports
          </Title>
          <Text type="secondary">
            Monitor daily employee log submissions, track completion, and notify pending team members.
          </Text>
        </div>
        <Space wrap>
          <Button
            type="primary"
            icon={<BellOutlined />}
            onClick={handleNotifyMissingReports}
            loading={isNotifying}
            style={{ borderRadius: 6, fontWeight: 500 }}
          >
            Notify Missing Reports
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              if (activeTab === "reports") {
                refetchReports();
              } else {
                refetchHistory();
              }
            }}
            style={{ borderRadius: 6 }}
          >
            Refresh
          </Button>
        </Space>
      </motion.div>

      {/* Top Summary KPI Cards */}
      <motion.div variants={itemVariants} style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Card
              bordered={false}
              style={{
                borderRadius: 12,
                background: "var(--bg-card, #ffffff)",
                boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
                border: "1px solid var(--border-color, #f0f0f0)",
              }}
              bodyStyle={{ padding: "20px 24px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Total Employees
                  </Text>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: "var(--text-color, #1f2937)" }}>
                    {totalEmployees}
                  </div>
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "rgba(24, 144, 255, 0.1)",
                    color: "#1890ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  <TeamOutlined />
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={8}>
            <Card
              bordered={false}
              style={{
                borderRadius: 12,
                background: "var(--bg-card, #ffffff)",
                boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
                border: "1px solid var(--border-color, #f0f0f0)",
              }}
              bodyStyle={{ padding: "20px 24px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Reports Submitted
                  </Text>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: "#52c41a" }}>
                    {reportsSubmitted}
                  </div>
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "rgba(82, 196, 26, 0.1)",
                    color: "#52c41a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  <CheckCircleOutlined />
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={8}>
            <Card
              bordered={false}
              style={{
                borderRadius: 12,
                background: "var(--bg-card, #ffffff)",
                boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
                border: "1px solid var(--border-color, #f0f0f0)",
              }}
              bodyStyle={{ padding: "20px 24px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 13, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Reports Pending
                  </Text>
                  <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: "#fa8c16" }}>
                    {reportsPending}
                  </div>
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "rgba(250, 140, 22, 0.1)",
                    color: "#fa8c16",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                  }}
                >
                  <ClockCircleOutlined />
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </motion.div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* Reports Tab - Latest Updates */}
          <TabPane
            tab={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FileTextOutlined />
                Reports ({reportsTotal})
              </span>
            }
            key="reports"
          >
            <Card style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} sm={12} md={10}>
                  <DebouncedSearchInput
                    placeholder="Search by user name, email, or report content..."
                    onChange={handleSearchChange}
                    debounceDelay={500}
                    prefix={<SearchOutlined />}
                  />
                </Col>
                <Col xs={24} sm={12} md={10}>
                  <Space style={{ width: "100%", justifyContent: "flex-start" }} wrap>
                    <Button.Group>
                      <Button icon={<LeftOutlined />} onClick={handlePrevDate} title="Previous Day" />
                      <Button onClick={handleTodayDate} style={{ fontWeight: selectedDate && selectedDate.isSame(dayjs(), "day") ? 600 : 400 }}>
                        Today
                      </Button>
                      <Button icon={<RightOutlined />} onClick={handleNextDate} title="Next Day" />
                    </Button.Group>
                    <DatePicker
                      value={selectedDate}
                      onChange={handleSingleDateChange}
                      format="DD/MM/YYYY"
                      allowClear
                      placeholder="Select Date"
                      style={{ width: 140 }}
                    />
                  </Space>
                </Col>
                <Col xs={24} sm={24} md={4}>
                  <Button onClick={handleClearFilters} block>
                    Clear Filters
                  </Button>
                </Col>
              </Row>
            </Card>

            <Spin spinning={isLoadingReports}>
              {reports.length === 0 ? (
                <Empty
                  description="No reports found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Table
                  columns={reportsColumns}
                  dataSource={reports}
                  rowKey={(record) =>
                    record.userId || record.noteId || Math.random()
                  }
                  pagination={{
                    current: reportsPagination.current,
                    pageSize: reportsPagination.pageSize,
                    total: reportsTotal,
                    showSizeChanger: true,
                    showTotal: (total, range) =>
                      `${range[0]}-${range[1]} of ${total} users`,
                    pageSizeOptions: ["20", "50", "100"],
                  }}
                  onChange={handleReportsTableChange}
                  scroll={{ x: "max-content" }}
                />
              )}
            </Spin>
          </TabPane>

          {/* Report History Tab - User-wise Records */}
          <TabPane
            tab={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <HistoryOutlined />
                Report History ({historyTotal})
              </span>
            }
            key="history"
          >
            <Card style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12} md={10}>
                  <DebouncedSearchInput
                    placeholder="Search by user name, email, or report content..."
                    onChange={handleSearchChange}
                    debounceDelay={500}
                    prefix={<SearchOutlined />}
                  />
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <RangePicker
                    style={{ width: "100%" }}
                    onChange={handleDateRangeChange}
                    value={dateRange}
                    format="DD/MM/YYYY"
                  />
                </Col>
                <Col xs={24} sm={24} md={6}>
                  <Button onClick={handleClearFilters} block>
                    Clear Filters
                  </Button>
                </Col>
              </Row>
            </Card>

            <Spin spinning={isLoadingHistory}>
              {userReports.length === 0 ? (
                <Empty
                  description="No report history found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Collapse
                  accordion={false}
                  expandIconPosition="end"
                  style={{ marginBottom: 16 }}
                >
                  {userReports.map((userReport) => (
                    <Panel
                      key={userReport.userId}
                      header={
                        <Space>
                          <Avatar icon={<UserOutlined />} />
                          <div>
                            <div style={{ fontWeight: 500, display: "inline" }}>
                              {userReport.userName}
                            </div>
                            <Tag color="blue" style={{ marginLeft: 8 }}>
                              {userReport.userRole}
                            </Tag>
                            <Text
                              type="secondary"
                              style={{ marginLeft: 16, fontSize: "12px" }}
                            >
                              {userReport.totalNotes} report(s)
                            </Text>
                            {userReport.latestUpdateDate && (
                              <Text
                                type="secondary"
                                style={{ marginLeft: 8, fontSize: "12px" }}
                              >
                                • Last updated:{" "}
                                {dayjs(userReport.latestUpdateDate).format(
                                  "DD MMM YYYY, hh:mm A",
                                )}
                              </Text>
                            )}
                          </div>
                        </Space>
                      }
                    >
                      {userReport.notes.length === 0 ? (
                        <Empty
                          description="No reports submitted"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          style={{ padding: "20px" }}
                        />
                      ) : (
                        <div>
                          {userReport.notes.map((note, index) => (
                            <Card
                              key={note._id}
                              style={{ marginBottom: 16 }}
                              title={
                                <Space>
                                  <CalendarOutlined />
                                  <span>
                                    {dayjs(note.noteDate).format("DD MMM YYYY")}
                                  </span>
                                  {note.isEditable ? (
                                    <Tag color="green">Active</Tag>
                                  ) : (
                                    <Tag color="orange">Locked</Tag>
                                  )}
                                  {note.updatedAt &&
                                    note.updatedAt !== note.createdAt && (
                                      <Text
                                        type="secondary"
                                        style={{ fontSize: "12px" }}
                                      >
                                        (Updated:{" "}
                                        {dayjs(note.updatedAt).format(
                                          "DD MMM YYYY, hh:mm A",
                                        )}
                                        )
                                      </Text>
                                    )}
                                </Space>
                              }
                            >
                              <Descriptions column={1} bordered size="small">
                                <Descriptions.Item label="Content">
                                  <div
                                    style={{
                                      maxHeight: "300px",
                                      overflowY: "auto",
                                    }}
                                  >
                                    <LinkifiedText text={note.content} />
                                  </div>
                                  {userReport.googleSheetUrl && (
                                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
                                      <Text strong style={{ display: 'block', marginBottom: 4 }}>Google Sheet:</Text>
                                      <a href={userReport.googleSheetUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        <LinkOutlined /> Open Spreadsheet
                                      </a>
                                    </div>
                                  )}
                                </Descriptions.Item>
                                <Descriptions.Item label="Created At">
                                  {dayjs(note.createdAt).format(
                                    "DD MMM YYYY, hh:mm A",
                                  )}
                                </Descriptions.Item>
                                {note.updatedAt &&
                                  note.updatedAt !== note.createdAt && (
                                    <Descriptions.Item label="Last Updated">
                                      {dayjs(note.updatedAt).format(
                                        "DD MMM YYYY, hh:mm A",
                                      )}
                                    </Descriptions.Item>
                                  )}
                              </Descriptions>
                            </Card>
                          ))}
                        </div>
                      )}
                    </Panel>
                  ))}
                </Collapse>
              )}

              {userReports.length > 0 && (
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <Text type="secondary">
                    Showing{" "}
                    {(historyPagination.current - 1) *
                      historyPagination.pageSize +
                      1}
                    -
                    {Math.min(
                      historyPagination.current * historyPagination.pageSize,
                      historyTotal,
                    )}{" "}
                    of {historyTotal} users
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <Button
                      disabled={historyPagination.current === 1}
                      onClick={() =>
                        handleHistoryTableChange({
                          current: historyPagination.current - 1,
                          pageSize: historyPagination.pageSize,
                        })
                      }
                      style={{ marginRight: 8 }}
                    >
                      Previous
                    </Button>
                    <Button
                      disabled={
                        historyPagination.current *
                          historyPagination.pageSize >=
                        historyTotal
                      }
                      onClick={() =>
                        handleHistoryTableChange({
                          current: historyPagination.current + 1,
                          pageSize: historyPagination.pageSize,
                        })
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Spin>
          </TabPane>
        </Tabs>
      </Card>
    </motion.div>
  );
};

export default DailyReports;
