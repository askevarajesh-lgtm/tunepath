import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  DatePicker,
  Spin,
  Button,
  Space,
  Typography,
  message,
  Select,
  Divider,
} from "antd";
import {
  RiseOutlined,
  TrophyOutlined,
  ReloadOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { useGetProfitLossQuery } from "../../api/expenseApi";
import { RESPONSIVE_COLS } from "../../utils/responsive";
import dayjs from "dayjs";
import StarCard from "./StarCard";

const API_BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5500/api';

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const { RangePicker } = DatePicker;
const { MonthPicker } = DatePicker;
const { Title } = Typography;
const { Option } = Select;

// Chart color palette
const COLORS = {
  revenue: "#52c41a",
  expense: "#ff4d4f",
  tunepath: "#ff4d4f",
  includeGst: "#52c41a",
  handling: "#fa8c16",
  campaign: "#eb2f96",
  domain: "var(--accent-primary)",
  profit: "#52c41a",
  profitNegative: "#ff4d4f",
  gst: "#722ed1",
};

const PIE_COLORS = [
  "var(--accent-primary)",
  "#722ed1",
  "#13c2c2",
  "#fa8c16",
  "#eb2f96",
  "#f5222d",
];

const PLDashboard = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const tenantName = currentUser?.companyId?.name || "Company";
  const [monthFilter, setMonthFilter] = useState(dayjs());
  const [dateRange, setDateRange] = useState(null);
  const [filterType, setFilterType] = useState("month");

  const params = {};
  if (filterType === "month" && monthFilter) {
    const startOfMonth = dayjs(monthFilter).startOf("month");
    const endOfMonth = dayjs(monthFilter).endOf("month");
    params.startDate = startOfMonth.toISOString();
    params.endDate = endOfMonth.toISOString();
    params.month = startOfMonth.month() + 1;
    params.year = startOfMonth.year();
  } else if (
    filterType === "dateRange" &&
    dateRange &&
    dateRange.length === 2
  ) {
    params.startDate = dayjs(dateRange[0]).toISOString();
    params.endDate = dayjs(dateRange[1]).toISOString();
  }

  const {
    data: plData,
    isLoading,
    error,
    refetch,
  } = useGetProfitLossQuery(params);
  const pl = plData?.data || {};

  // Extract P&L data
  const totalRevenue = pl.totalRevenue || pl.totalIncome || 0;
  const tunepathRevenue = pl.tunepathRevenue || 0;
  const includeGstRevenue = pl.includeGstRevenue || 0;
  const totalHandlingAmount = pl.totalHandlingAmount || 0;
  const totalCampaignAmount = pl.totalCampaignAmount || 0;
  const totalDomainPurchaseAmount = pl.totalDomainPurchaseAmount || 0;
  const totalGST = pl.totalGST || 0;
  const totalDomainPurchaseGST = pl.totalDomainPurchaseGST || 0;
  const isAskEva = pl.isAskEva || false;
  const totalPendingAmount =
    typeof pl.totalPendingAmount === "number"
      ? pl.totalPendingAmount
      : pl.totalPendingAmount || 0;
  const totalHoldPendingAmount =
    typeof pl.totalHoldPendingAmount === "number"
      ? pl.totalHoldPendingAmount
      : 0;
  const totalCollectedAmount =
    typeof pl.totalCollectedAmount === "number"
      ? pl.totalCollectedAmount
      : pl.totalCollectedAmount || 0;
  const totalExpenses = pl.totalExpenses || 0;
  const profit =
    pl.profit !== undefined ? pl.profit : totalRevenue - totalExpenses;
  const profitPercentage =
    pl.profitPercentage !== undefined
      ? pl.profitPercentage
      : totalRevenue > 0
        ? (profit / totalRevenue) * 100
        : 0;
  const teamBreakdown = pl.teamBreakdown || [];

  // Prepare chart data
  const revenueVsExpenseData = [
    {
      name: "Financial Overview",
      Revenue: totalRevenue,
      Expense: totalExpenses,
      Profit: profit,
    },
  ];

  const revenueBreakdownData = [
    { name: "Company Revenue", value: tunepathRevenue },
    { name: "Included GST Revenue", value: includeGstRevenue },
    { name: "Campaign", value: totalCampaignAmount },
    { name: "Domain Purchase", value: totalDomainPurchaseAmount },
    { name: "GST", value: totalGST },
  ].filter((item) => item.value > 0);

  const includeGstPending = pl.includeGstPending || 0;
  const includeGstCollected = pl.includeGstCollected || 0;
  const tunepathPending = pl.tunepathPending || 0;
  const tunepathCollected = pl.tunepathCollected || 0;

  const includeGstPendingDetails = pl.includeGstPendingDetails || [];
  const tunepathPendingDetails = pl.tunepathPendingDetails || [];

  const pendingInvoiceTableColumns = [
    {
      title: "Type",
      dataIndex: "kind",
      key: "kind",
      width: 96,
      render: (k) => (k === "domain" ? "Domain" : "Invoice"),
    },
    {
      title: "Reference",
      dataIndex: "reference",
      key: "reference",
      ellipsis: true,
    },
    {
      title: "Client",
      dataIndex: "clientName",
      key: "clientName",
      ellipsis: true,
    },
    {
      title: "Pending (₹)",
      dataIndex: "pendingAmount",
      key: "pendingAmount",
      align: "right",
      width: 130,
      render: (v) =>
        typeof v === "number"
          ? v.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "—",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (s) => (typeof s === "string" ? s.replace(/_/g, " ") : "—"),
    },
    {
      title: "Date",
      dataIndex: "invoiceDate",
      key: "invoiceDate",
      width: 112,
      render: (d) => (d ? dayjs(d).format("YYYY-MM-DD") : "—"),
    },
  ];

  const paymentStatusData = [
    { name: "Include GST Collected", value: includeGstCollected, color: COLORS.includeGst },
    { name: "Include GST Pending", value: includeGstPending, color: "#faad14" },
    {
      name: `${tenantName} Collected`,
      value: tunepathCollected,
      color: COLORS.domain,
    },
    {
      name: `${tenantName} Pending`,
      value: tunepathPending,
      color: COLORS.tunepath,
    },
    {
      name: "Hold Pending Amount",
      value: totalHoldPendingAmount,
      color: "#722ed1",
    },
  ].filter((item) => item.value > 0);

  const teamProfitData = teamBreakdown
    .map((team) => ({
      name: team.teamLabel,
      profit: team.profit || 0,
      expense: team.totalExpense || 0,
      revenue: team.revenue || 0,
    }))
    .filter((team) => team.expense > 0 || team.profit !== 0 || team.revenue > 0);

  const handleRecalculate = async () => {
    try {
      await refetch();
      message.success("P&L data refreshed");
    } catch (error) {
      message.error("Failed to refresh P&L data");
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const queryParams = new URLSearchParams();

      if (filterType === "month" && monthFilter) {
        const startOfMonth = dayjs(monthFilter).startOf("month");
        const endOfMonth = dayjs(monthFilter).endOf("month");
        queryParams.append("startDate", startOfMonth.toISOString());
        queryParams.append("endDate", endOfMonth.toISOString());
        queryParams.append("month", (startOfMonth.month() + 1).toString());
        queryParams.append("year", startOfMonth.year().toString());
      } else if (
        filterType === "dateRange" &&
        dateRange &&
        dateRange.length === 2
      ) {
        queryParams.append("startDate", dayjs(dateRange[0]).toISOString());
        queryParams.append("endDate", dayjs(dateRange[1]).toISOString());
      }

      const token =
        localStorage.getItem("token") ||
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1];
      const response = await fetch(
        `${API_BASE_URL}/expenses/profit-loss/pdf?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      let filename = "profit-loss-report.pdf";
      if (filterType === "month" && monthFilter) {
        const month = dayjs(monthFilter);
        filename = `profit-loss-${month.year()}-${String(month.month() + 1).padStart(2, "0")}.pdf`;
      } else if (
        filterType === "dateRange" &&
        dateRange &&
        dateRange.length === 2
      ) {
        const start = dayjs(dateRange[0]).format("YYYY-MM-DD");
        const end = dayjs(dateRange[1]).format("YYYY-MM-DD");
        filename = `profit-loss-${start}-to-${end}.pdf`;
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      message.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error downloading PDF:", error);
      message.error("Failed to download PDF");
    }
  };

  const handleFilterTypeChange = (value) => {
    setFilterType(value);
    if (value === "month") {
      setDateRange(null);
    } else {
      setMonthFilter(null);
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.96)",
            padding: "12px",
            border: "1px solid #e8e8e8",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, marginBottom: "8px" }}>
            {label}
          </p>
          {payload.map((entry, index) => (
            <p
              key={index}
              style={{
                margin: "4px 0",
                color: entry.color,
                fontSize: "13px",
              }}
            >
              {entry.name}: ₹
              {entry.value.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.96)",
            padding: "12px",
            border: "1px solid #e8e8e8",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              color: payload[0].payload.fill,
            }}
          >
            {payload[0].name}
          </p>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
            ₹
            {payload[0].value.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      );
    }
    return null;
  };

  if (error) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Failed to load P&L data</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          P&L Analytics
        </Title>
        <Space>
          <Select
            value={filterType}
            onChange={handleFilterTypeChange}
            style={{ width: 120 }}
          >
            <Option value="dateRange">Date Range</Option>
            <Option value="month">Month</Option>
          </Select>
          {filterType === "month" ? (
            <MonthPicker
              value={monthFilter}
              onChange={setMonthFilter}
              format="MM/YYYY"
              placeholder="Select Month"
            />
          ) : (
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD/MM/YYYY"
            />
          )}
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadPDF}
            type="primary"
          >
            Download
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRecalculate}
            loading={isLoading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      <Spin spinning={isLoading}>
        {/* Row 2: 4 Cards - Profit Percentage & Revenue Breakdown */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <StarCard
              variant="green"
              title="Total Handling"
              value={totalHandlingAmount}
              subtitle="From invoices"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StarCard
              variant="green"
              title="Total Campaign"
              value={totalCampaignAmount}
              subtitle="From invoices"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StarCard
              variant="neutral"
              title="Total Domain Purchase"
              value={totalDomainPurchaseAmount}
              subtitle="From purchases"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StarCard
              variant={profitPercentage >= 0 ? "green" : "red"}
              title="Profit Percentage"
              value={profitPercentage}
              prefix={<TrophyOutlined />}
              suffix="%"
              subtitle=" "
              formatter={(value) => value?.toFixed(2)}
            />
          </Col>
        </Row>

        {/* Charts Section */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {/* Revenue vs Expense Bar Chart */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <span style={{ fontSize: "16px", fontWeight: 600 }}>
                  Revenue vs Expense Overview
                </span>
              }
              style={{ height: "100%" }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueVsExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "13px", paddingTop: "10px" }}
                  />
                  <Bar
                    dataKey="Revenue"
                    fill={COLORS.revenue}
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="Expense"
                    fill={COLORS.expense}
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="Profit"
                    fill={profit >= 0 ? COLORS.profit : COLORS.profitNegative}
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          {/* Revenue Breakdown Pie Chart */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <span style={{ fontSize: "16px", fontWeight: 600 }}>
                  Revenue Breakdown
                </span>
              }
              style={{ height: "100%" }}
            >
              {revenueBreakdownData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={revenueBreakdownData.map((item, index) => ({
                        ...item,
                        total: revenueBreakdownData.reduce(
                          (sum, i) => sum + i.value,
                          0,
                        ),
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) =>
                        `${name}: ₹${value.toLocaleString("en-IN")}`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {revenueBreakdownData.map((entry, index) => {
                        let cellColor = "#8884d8";
                        if (entry.name === "Company Revenue")
                          cellColor = COLORS.tunepath;
                        if (entry.name === "Included GST Revenue")
                          cellColor = COLORS.includeGst;
                        if (entry.name === "Campaign")
                          cellColor = COLORS.campaign;
                        if (entry.name === "Domain Purchase")
                          cellColor = COLORS.domain;
                        if (entry.name === "GST") cellColor = COLORS.gst;

                        return <Cell key={`cell-${index}`} fill={cellColor} />;
                      })}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#999",
                  }}
                >
                  No revenue data available
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Second Row of Charts */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {/* Payment Status Pie Chart */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "16px", fontWeight: 600 }}>
                    Payment Status Distribution
                  </span>
                  <span
                    style={{ fontSize: "14px", fontWeight: 400, color: "#666" }}
                  >
                    Total Amount: ₹
                    {(
                      totalCollectedAmount +
                      totalPendingAmount +
                      totalHoldPendingAmount
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              }
              style={{ height: "100%" }}
            >
              {paymentStatusData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={paymentStatusData.map((item) => ({
                          ...item,
                          total: paymentStatusData.reduce(
                            (sum, i) => sum + i.value,
                            0,
                          ),
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) =>
                          `${name}: ₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div
                  style={{
                    height: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#999",
                  }}
                >
                  No payment data available
                </div>
              )}
            </Card>
          </Col>

          {/* Team Profit Bar Chart */}
          <Col xs={24} lg={12}>
            <Card
              title={
                <span style={{ fontSize: "16px", fontWeight: 600 }}>
                  Team-wise Profit & Expense
                </span>
              }
              style={{ height: "100%" }}
            >
              {teamProfitData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teamProfitData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) =>
                        `₹${(value / 1000).toFixed(0)}K`
                      }
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "13px", paddingTop: "10px" }}
                    />
                    <Bar
                      dataKey="expense"
                      fill={COLORS.expense}
                      name="Expense"
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="profit"
                      fill={COLORS.profit}
                      name="Profit"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#999",
                  }}
                >
                  No team data available
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Pending Invoices Section */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <span style={{ fontSize: "16px", fontWeight: 600 }}>
                  Include GST Pending — line items
                </span>
              }
              style={{ height: "100%" }}
            >
              <Table
                size="small"
                rowKey="id"
                columns={pendingInvoiceTableColumns}
                dataSource={includeGstPendingDetails}
                pagination={
                  includeGstPendingDetails.length > 5 ? { pageSize: 5 } : false
                }
                onRow={(record) => ({
                  onClick: () => {
                    if (record.kind === "invoice") {
                      navigate(`/agency/invoices/${record.id}/view`);
                    }
                  },
                  style: { cursor: record.kind === "invoice" ? "pointer" : "default" },
                })}
                scroll={{ x: 640 }}
                locale={{
                  emptyText: "No AskEva pending invoices in this period",
                }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={
                <span style={{ fontSize: "16px", fontWeight: 600 }}>
                  {tenantName} Pending — line items
                </span>
              }
              style={{ height: "100%" }}
            >
              <Table
                size="small"
                rowKey="id"
                columns={pendingInvoiceTableColumns}
                dataSource={tunepathPendingDetails}
                pagination={
                  tunepathPendingDetails.length > 5 ? { pageSize: 5 } : false
                }
                onRow={(record) => ({
                  onClick: () => {
                    if (record.kind === "invoice") {
                      navigate(`/agency/invoices/${record.id}/view`);
                    }
                  },
                  style: { cursor: record.kind === "invoice" ? "pointer" : "default" },
                })}
                scroll={{ x: 640 }}
                locale={{
                  emptyText: `No ${tenantName} pending invoices in this period`,
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Team-wise Breakdown Table */}
        <Card
          title={
            <span style={{ fontSize: "16px", fontWeight: 600 }}>
              Team-wise Expense & Profit Breakdown
            </span>
          }
        >
          <Table
            columns={[
              {
                title: "Team",
                dataIndex: "teamLabel",
                key: "team",
                width: 200,
              },
              {
                title: "Variable Expense",
                dataIndex: "variableExpense",
                key: "variableExpense",
                render: (value) =>
                  `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                align: "right",
              },
              {
                title: "Fixed Expense Allocated",
                dataIndex: "fixedExpenseAllocated",
                key: "fixedExpenseAllocated",
                render: (value) =>
                  `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                align: "right",
              },
              {
                title: "Total Team Expense",
                dataIndex: "totalExpense",
                key: "totalExpense",
                render: (value) =>
                  `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                align: "right",
                style: { fontWeight: "bold" },
              },
              {
                title: "Team Profit",
                dataIndex: "profit",
                key: "profit",
                render: (value) => {
                  const val = value || 0;
                  return (
                    <span
                      style={{
                        color: val >= 0 ? "#3f8600" : "#cf1322",
                        fontWeight: "bold",
                      }}
                    >
                      ₹
                      {val.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  );
                },
                align: "right",
              },
              {
                title: "Profit Percentage",
                dataIndex: "profitPercentage",
                key: "profitPercentage",
                render: (value, record) => {
                  const profitVal = record.profit || 0;
                  const isNegative = profitVal < 0;
                  const displayValue = (value || 0).toFixed(2);
                  return (
                    <span
                      style={{
                        color: !isNegative ? "#3f8600" : "#cf1322",
                        fontWeight: isNegative ? "bold" : "normal",
                      }}
                    >
                      {displayValue}%
                    </span>
                  );
                },
                align: "right",
              },
            ]}
            dataSource={
              teamBreakdown && teamBreakdown.length > 0 ? teamBreakdown : []
            }
            rowKey="team"
            pagination={false}
            locale={{
              emptyText:
                "No team expense data available. Add expenses to see team breakdown.",
            }}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default PLDashboard;
