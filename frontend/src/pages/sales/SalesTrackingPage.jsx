import React, { useState } from "react";
import {
  Card,
  Table,
  Space,
  Tag,
  message,
  DatePicker,
  Select,
  Input,
  Row,
  Col,
  Statistic,
  Spin,
} from "antd";
import { DollarOutlined, UserOutlined, RiseOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import { useGetInvoicesQuery } from "../../api/invoiceApi";
import { useGetUsersQuery } from "../../api/userApi";
import { RESPONSIVE_COLS } from "../../utils/responsive";
import dayjs from "dayjs";

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

const SalesTrackingPage = () => {
  const navigate = useNavigate();
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [dateRange, setDateRange] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: invoicesData, isLoading: invoicesLoading } =
    useGetInvoicesQuery({ status: "paid" });
  const { data: usersData } = useGetUsersQuery({ role: "salesperson" });

  // Handle paginated response (data?.data?.data) or legacy format
  const invoices =
    invoicesData?.data?.data || invoicesData?.data?.invoices || [];
  const employees = usersData?.data?.data || usersData?.data?.users || [];

  // Calculate sales data from invoices
  const calculateSalesData = () => {
    let filteredInvoices = invoices;

    if (selectedEmployee !== "all") {
      filteredInvoices = filteredInvoices.filter(
        (inv) =>
          inv.salespersonId?._id === selectedEmployee ||
          inv.salespersonId === selectedEmployee,
      );
    }

    if (dateRange && dateRange.length === 2) {
      const start = dayjs(dateRange[0]).startOf("day");
      const end = dayjs(dateRange[1]).endOf("day");
      filteredInvoices = filteredInvoices.filter((inv) => {
        const invDate = dayjs(inv.createdAt);
        return invDate.isAfter(start) && invDate.isBefore(end);
      });
    }

    // Group by employee
    const salesByEmployee = {};
    filteredInvoices.forEach((inv) => {
      const empId = inv.salespersonId?._id || inv.salespersonId;
      const empName = inv.salespersonId?.name || "Unknown";

      if (!salesByEmployee[empId]) {
        salesByEmployee[empId] = {
          _id: empId,
          employeeName: empName,
          totalSales: 0,
          salesCount: 0,
          sales: [],
        };
      }

      salesByEmployee[empId].totalSales += inv.total || 0;
      salesByEmployee[empId].salesCount += 1;
      salesByEmployee[empId].sales.push(inv);
    });

    const totalSales = Object.values(salesByEmployee).reduce(
      (sum, emp) => sum + emp.totalSales,
      0,
    );

    const salesData = Object.values(salesByEmployee).map((emp) => ({
      ...emp,
      averageSale: emp.salesCount > 0 ? emp.totalSales / emp.salesCount : 0,
      contribution: totalSales > 0 ? (emp.totalSales / totalSales) * 100 : 0,
    }));

    return { salesData, totalSales };
  };

  const { salesData, totalSales } = calculateSalesData();

  // Daily sales breakdown
  const dailySales = invoices
    .filter((inv) => {
      if (selectedEmployee !== "all") {
        const empId = inv.salespersonId?._id || inv.salespersonId;
        if (empId !== selectedEmployee) return false;
      }
      if (dateRange && dateRange.length === 2) {
        const start = dayjs(dateRange[0]).startOf("day");
        const end = dayjs(dateRange[1]).endOf("day");
        const invDate = dayjs(inv.createdAt);
        if (!invDate.isAfter(start) || !invDate.isBefore(end)) return false;
      }
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const empName = inv.salespersonId?.name || "";
        const companyName = inv.companyId?.name || "";
        if (
          !empName.toLowerCase().includes(searchLower) &&
          !companyName.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      return true;
    })
    .map((inv) => ({
      _id: inv._id,
      date: dayjs(inv.createdAt).format("DD/MM/YYYY"),
      employeeName: inv.salespersonId?.name || "Unknown",
      amount: inv.total || 0,
      companyName: inv.companyId?.name || "N/A",
    }));

  const salesColumns = [
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
      width: 150,
      ellipsis: true,
    },
    {
      title: "Department",
      dataIndex: "department",
      key: "department",
      width: 120,
      responsive: ["md"],
      render: (dept) => <Tag>{dept || "N/A"}</Tag>,
    },
    {
      title: "Total Sales",
      dataIndex: "totalSales",
      key: "totalSales",
      width: 120,
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
      sorter: (a, b) => (a.totalSales || 0) - (b.totalSales || 0),
    },
    {
      title: "Number of Sales",
      dataIndex: "salesCount",
      key: "salesCount",
      width: 120,
      responsive: ["md"],
      sorter: (a, b) => (a.salesCount || 0) - (b.salesCount || 0),
    },
    {
      title: "Average Sale Value",
      dataIndex: "averageSale",
      key: "averageSale",
      width: 140,
      responsive: ["lg"],
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
    },
    {
      title: "Contribution %",
      dataIndex: "contribution",
      key: "contribution",
      width: 120,
      render: (percent) => (
        <Tag
          color={percent >= 20 ? "green" : percent >= 10 ? "orange" : "default"}
        >
          {percent?.toFixed(1) || 0}%
        </Tag>
      ),
      sorter: (a, b) => (a.contribution || 0) - (b.contribution || 0),
    },
  ];

  const dailySalesColumns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 100,
    },
    {
      title: "Employee",
      dataIndex: "employeeName",
      key: "employeeName",
      width: 150,
      ellipsis: true,
    },
    {
      title: "Sales Amount",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
    },
    {
      title: "Company",
      dataIndex: "companyName",
      key: "companyName",
      width: 150,
      ellipsis: true,
      responsive: ["md"],
    },
  ];

  return (
    <div>
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Sales Tracking
        </Title>
        <Space className="sales-filters" wrap>
          <RangePicker onChange={setDateRange} className="sales-filter-date" />
          <Select
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            className="sales-filter-select"
            allowClear
          >
            <Option value="all">All Employees</Option>
            {employees.map((emp) => (
              <Option key={emp._id} value={emp._id}>
                {emp.name}
              </Option>
            ))}
          </Select>
          <Search
            placeholder="Search by employee or company"
            className="sales-filter-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onSearch={setSearchTerm}
          />
        </Space>
      </div>

      {/* Summary Statistics */}
      <Row gutter={[16, 16]} className="sales-stats-row">
        <Col {...RESPONSIVE_COLS.threeCols}>
          <Card>
            <Statistic
              title="Total Sales"
              value={totalSales}
              prefix={<DollarOutlined />}
              className="sales-stat-total"
              precision={2}
              formatter={(value) => `₹${value?.toLocaleString("en-IN") || 0}`}
            />
          </Card>
        </Col>
        <Col {...RESPONSIVE_COLS.threeCols}>
          <Card>
            <Statistic
              title="Active Salespersons"
              value={salesData.length}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col {...RESPONSIVE_COLS.threeCols}>
          <Card>
            <Statistic
              title="Average Sales per Employee"
              value={salesData.length > 0 ? totalSales / salesData.length : 0}
              prefix={<RiseOutlined />}
              className="sales-stat-average"
              precision={2}
              formatter={(value) => `₹${value?.toLocaleString("en-IN") || 0}`}
            />
          </Card>
        </Col>
      </Row>

      {/* Employee-wise Sales */}
      <Card
        title="Employee-wise Sales Performance"
        className="sales-table-card"
      >
        <Spin spinning={invoicesLoading}>
          <div className="sales-table-wrapper">
            <Table
              columns={salesColumns}
              dataSource={salesData}
              rowKey="_id"
              pagination={{
                defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
                responsive: true,
              }}
              scroll={{ x: "max-content" }}
              size="small"
              locale={{
                emptyText:
                  "No sales data available. Sales data will appear here once invoices are created.",
              }}
            />
          </div>
        </Spin>
      </Card>

      {/* Daily Sales Breakdown */}
      <Card title="Daily Sales Breakdown" className="sales-table-card">
        <Spin spinning={invoicesLoading}>
          <div className="sales-table-wrapper">
            <Table
              columns={dailySalesColumns}
              dataSource={dailySales}
              rowKey="_id"
              pagination={{
                defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
                responsive: true,
              }}
              scroll={{ x: "max-content" }}
              size="small"
              locale={{ emptyText: "No daily sales data available" }}
            />
          </div>
        </Spin>
      </Card>
    </div>
  );
};

export default SalesTrackingPage;
