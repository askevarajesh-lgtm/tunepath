import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Card,
  Col,
  Row,
  Table,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Image,
  Spin,
  InputNumber,
  DatePicker,
  Upload,
  Typography,
  Tabs,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  UploadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { Icon } from "@iconify/react";
import {
  useGetAllPaymentsQuery,
  useVerifyPaymentMutation,
  useRejectPaymentMutation,
} from "../../api/paymentApi";
import {
  useGetAllDomainPurchasesQuery,
  useDeleteDomainPurchaseMutation,
} from "../../api/domainPurchaseApi";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import DebouncedSearchInput from "../../components/common/DebouncedSearchInput";
import usePagination from "../../hooks/usePagination";
import { MASTER_ITEM_NAME_OPTIONS } from "../../constants/masterItemNames";
import DomainPurchaseForm from "./DomainPurchaseForm";

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

const TransactionsPage = () => {
  const navigate = useNavigate();
  const [rejectForm] = Form.useForm();
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState(null);
  const [activeTab, setActiveTab] = useState("payments");
  const [itemNameFilter, setItemNameFilter] = useState(undefined);
  const [selectedPaymentMonth, setSelectedPaymentMonth] = useState(null);
  const [domainPurchaseFormVisible, setDomainPurchaseFormVisible] =
    useState(false);
  const [selectedDomainPurchaseId, setSelectedDomainPurchaseId] =
    useState(null);
  const { user: currentUser } = useAuth();
  const selectedClientId = null; // Removed redux dependency
  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "sales_manager";
  const {
    pagination: paginationState,
    queryParams,
    handleTableChange,
    handleSearchChange,
    setPagination,
  } = usePagination({ defaultPageSize: 10 });

  // Reset to page 1 whenever the global client scope changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, [selectedClientId]);

  const paymentMonthParams = useMemo(() => {
    if (!selectedPaymentMonth) return {};
    return {
      startDate: selectedPaymentMonth.startOf("month").toISOString(),
      endDate: selectedPaymentMonth.endOf("month").toISOString(),
    };
  }, [selectedPaymentMonth]);

  const paymentQueryParams = useMemo(
    () => ({
      ...queryParams,
      ...paymentMonthParams,
      ...(itemNameFilter && { itemName: itemNameFilter }),
      ...(selectedClientId ? { companyId: selectedClientId } : {}),
    }),
    [queryParams, paymentMonthParams, itemNameFilter, selectedClientId],
  );

  const { data, isLoading, error } = useGetAllPaymentsQuery(
    paymentQueryParams,
    {
      skip: activeTab !== "payments",
    },
  );
  const {
    data: domainPurchasesData,
    isLoading: isLoadingDomainPurchases,
    refetch: refetchDomainPurchases,
  } = useGetAllDomainPurchasesQuery(
    {
      ...queryParams,
      ...(selectedClientId ? { companyId: selectedClientId } : {}),
    },
    { skip: activeTab !== "domain-purchases" },
  );

  const handleItemNameFilterChange = useCallback(
    (value) => {
      setItemNameFilter(value || undefined);
      setPagination((prev) => ({ ...prev, current: 1 }));
    },
    [setPagination],
  );

  const handlePaymentMonthChange = useCallback(
    (date) => {
      setSelectedPaymentMonth(date);
      setPagination((prev) => ({ ...prev, current: 1 }));
    },
    [setPagination],
  );
  const [verifyPayment, { isLoading: isVerifying }] =
    useVerifyPaymentMutation();
  const [rejectPayment, { isLoading: isRejecting }] =
    useRejectPaymentMutation();
  const [deleteDomainPurchase, { isLoading: isDeletingDomainPurchase }] =
    useDeleteDomainPurchaseMutation();

  // Handle paginated response
  const paginationData = data?.pagination || data?.data?.pagination;
  const payments = Array.isArray(data?.data) ? data.data : (data?.data?.data || data?.data?.payments || data?.payments || []);
  
  const totalRef = React.useRef(0);
  if (paginationData?.total !== undefined) {
    totalRef.current = paginationData.total;
  }
  const total = paginationData?.total || payments.length || totalRef.current;

  // Domain purchases data
  const domainPurchasesPaginationData = domainPurchasesData?.pagination || domainPurchasesData?.data?.pagination;
  const domainPurchases = Array.isArray(domainPurchasesData?.data)
    ? domainPurchasesData.data
    : (domainPurchasesData?.data?.data || domainPurchasesData?.data?.domainPurchases || domainPurchasesData?.domainPurchases || []);
  const domainPurchasesTotal = domainPurchasesPaginationData?.total || domainPurchases.length;

  const handleVerify = async (paymentId) => {
    try {
      await verifyPayment({ id: paymentId }).unwrap();
      message.success("Payment verified successfully");
    } catch (error) {
      message.error(error?.data?.message || "Failed to verify payment");
    }
  };

  const handleReject = async (values) => {
    try {
      await rejectPayment({
        id: selectedPaymentId,
        rejectionNotes: values.rejectionNotes,
      }).unwrap();
      message.success("Payment rejected");
      setIsRejectModalVisible(false);
      setSelectedPaymentId(null);
      rejectForm.resetFields();
    } catch (error) {
      message.error(error?.data?.message || "Failed to reject payment");
    }
  };

  const openRejectModal = (paymentId) => {
    setSelectedPaymentId(paymentId);
    setIsRejectModalVisible(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "orange",
      verified: "green",
      rejected: "red",
    };
    return colors[status?.toLowerCase()] || "default";
  };

  const getPaymentModeLabel = (mode) => {
    const labels = {
      cash: "Cash",
      bank_transfer: "Bank Transfer",
      upi: "UPI",
      cheque: "Cheque",
      other: "Other",
      razorpay: "Razorpay"
    };
    return labels[mode?.toLowerCase()] || mode;
  };

  const columns = [
    {
      title: "Date",
      dataIndex: "paymentDate",
      key: "paymentDate",
      render: (date) => dayjs(date).format("DD/MM/YYYY"),
      sorter: (a, b) => new Date(a.paymentDate) - new Date(b.paymentDate),
    },
    {
      title: "Closing Invoice Date",
      dataIndex: "closingInvoiceDate",
      key: "closingInvoiceDate",
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "N/A"),
    },
    {
      title: "Invoice",
      key: "invoice",
      render: (_, record) => {
        if (record.marketplacePurchaseId) {
          const modName = record.marketplacePurchaseId.moduleName || 'Module';
          return <Tag color="blue">Marketplace - {modName.toUpperCase()}</Tag>;
        }
        return (
          <Button
            type="link"
            onClick={() => navigate(`/agency/invoices/${record.invoiceId?._id}/view`)}
          >
            {record.invoiceId?.invoiceNumber || "N/A"}
          </Button>
        );
      },
    },
    {
      title: "Company",
      key: "company",
      render: (_, record) => record.companyId?.name || record.companyId?.companyName || "N/A",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (amount) => `₹${amount?.toLocaleString("en-IN") || 0}`,
      sorter: (a, b) => (a.amount || 0) - (b.amount || 0),
    },
    {
      title: "Mode",
      dataIndex: "paymentMethod",
      key: "paymentMethod",
      render: (mode) => <Tag>{getPaymentModeLabel(mode)}</Tag>,
    },
    {
      title: "Reference",
      dataIndex: "referenceNumber",
      key: "referenceNumber",
      render: (ref) => ref || "N/A",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={getStatusColor(status)}>{status?.toUpperCase()}</Tag>
      ),
      filters: [
        { text: "Pending", value: "pending" },
        { text: "Verified", value: "verified" },
        { text: "Rejected", value: "rejected" },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Screenshot",
      key: "screenshot",
      render: (_, record) => {
        if (!record.paymentScreenshotUrl) return "N/A";
        return (
          <Image
            width={50}
            height={50}
            src={record.paymentScreenshotUrl}
            preview={{
              mask: <EyeOutlined />,
            }}
            style={{ objectFit: "cover", borderRadius: 4 }}
          />
        );
      },
    },
    {
      title: "Recorded By",
      key: "recordedBy",
      render: (_, record) => record.recordedBy?.name || "N/A",
    },
    {
      title: "Verified By",
      key: "verifiedBy",
      render: (_, record) => record.verifiedBy?.name || "N/A",
    },
    {
      title: "Actions",
      key: "actions",
      fixed: window.innerWidth <= 768 ? false : "right",
      width: 180,
      render: (_, record) => {
        if (!isAdmin) return "N/A";
        if (record.status === "verified" || record.status === "rejected") {
          return "N/A";
        }
        return (
          <Space>
            <Popconfirm
              title="Verify Payment"
              description="Are you sure you want to verify this payment?"
              onConfirm={() => handleVerify(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="link"
                icon={<CheckOutlined />}
                style={{ color: "#52c41a" }}
                loading={isVerifying}
              >
                Verify
              </Button>
            </Popconfirm>
            <Button
              type="link"
              danger
              icon={<CloseOutlined />}
              onClick={() => openRejectModal(record._id)}
              loading={isRejecting}
            >
              Reject
            </Button>
          </Space>
        );
      },
    },
  ];

  const handleDeleteDomainPurchase = async (id) => {
    try {
      await deleteDomainPurchase(id).unwrap();
      message.success("Domain purchase deleted successfully");
    } catch (error) {
      message.error(error?.data?.message || "Failed to delete domain purchase");
    }
  };

  const domainPurchaseColumns = [
    {
      title: "S.No",
      key: "sno",
      render: (_, __, index) => {
        const current = domainPurchasesPaginationData?.page || 1;
        const pageSize = domainPurchasesPaginationData?.limit || 10;
        return (current - 1) * pageSize + index + 1;
      },
      width: 80,
    },
    {
      title: "Company Name",
      key: "company",
      render: (_, record) => record.companyId?.name || "N/A",
      sorter: (a, b) =>
        (a.companyId?.name || "").localeCompare(b.companyId?.name || ""),
    },
    {
      title: "Contact Person",
      dataIndex: "contactPerson",
      key: "contactPerson",
      render: (text) => text || "N/A",
    },
    {
      title: "Contact Number",
      dataIndex: "contactNumber",
      key: "contactNumber",
      render: (text) => text || "N/A",
    },
    {
      title: "Domain Name",
      dataIndex: "domainName",
      key: "domainName",
      sorter: (a, b) => (a.domainName || "").localeCompare(b.domainName || ""),
    },
    {
      title: "Expiry Date",
      dataIndex: "expiryDate",
      key: "expiryDate",
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "N/A"),
      sorter: (a, b) =>
        new Date(a.expiryDate || 0) - new Date(b.expiryDate || 0),
    },
    {
      title: "Product",
      dataIndex: "product",
      key: "product",
      render: (text) => text || "N/A",
    },
    {
      title: "Paid Amount",
      dataIndex: "paidAmount",
      key: "paidAmount",
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
      sorter: (a, b) => (a.paidAmount || 0) - (b.paidAmount || 0),
    },
    {
      title: "Balance",
      dataIndex: "balance",
      key: "balance",
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
      sorter: (a, b) => (a.balance || 0) - (b.balance || 0),
    },
    {
      title: "Payment Date",
      dataIndex: "paymentDate",
      key: "paymentDate",
      render: (date) => dayjs(date).format("DD/MM/YYYY"),
      sorter: (a, b) => new Date(a.paymentDate) - new Date(b.paymentDate),
    },
    {
      title: "GST",
      dataIndex: "gst",
      key: "gst",
      render: (amount) => `₹${(amount || 0).toLocaleString("en-IN")}`,
    },
    {
      title: "Total Amount",
      key: "totalAmount",
      render: (_, record) => {
        const total = (record.paidAmount || 0) + (record.gst || 0);
        return (
          <span style={{ fontWeight: 600, color: "#1677ff" }}>
            ₹{total.toLocaleString("en-IN")}
          </span>
        );
      },
      sorter: (a, b) =>
        ((a.paidAmount || 0) + (a.gst || 0)) -
        ((b.paidAmount || 0) + (b.gst || 0)),
    },
    {
      title: "Screenshot",
      key: "screenshot",
      render: (_, record) => {
        if (!record.paymentScreenshotUrl) return "N/A";
        return (
          <Image
            width={50}
            height={50}
            src={record.paymentScreenshotUrl}
            preview={{
              mask: <EyeOutlined />,
            }}
            style={{ objectFit: "cover", borderRadius: 4 }}
          />
        );
      },
    },
    {
      title: "Payment Detail",
      dataIndex: "paymentDetail",
      key: "paymentDetail",
      render: (text) => text || "N/A",
      ellipsis: true,
    },
    {
      title: "Payment Remarks",
      dataIndex: "paymentRemarks",
      key: "paymentRemarks",
      render: (text) => text || "N/A",
      ellipsis: true,
    },
    {
      title: "Actions",
      key: "actions",
      fixed: window.innerWidth <= 768 ? false : "right",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedDomainPurchaseId(record._id);
              setDomainPurchaseFormVisible(true);
            }}
          >
            Edit
          </Button>
          {(isAdmin || currentUser?.role === "coordinator") && (
            <Popconfirm
              title="Delete Domain Purchase"
              description="Are you sure you want to delete this domain purchase?"
              onConfirm={() => handleDeleteDomainPurchase(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                loading={isDeletingDomainPurchase}
              >
                Delete
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: "payments",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon icon="carbon:purchase" width="22" height="22" />
          Payments
        </span>
      ),
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={10} lg={10}>
                <DebouncedSearchInput
                  placeholder="Search transactions by invoice number, company name, amount, or reference number..."
                  onChange={handleSearchChange}
                  debounceDelay={500}
                />
              </Col>
              <Col xs={24} md={7} lg={7}>
                <Select
                  placeholder="Filter by Item"
                  allowClear
                  showSearch
                  style={{ width: "100%" }}
                  value={itemNameFilter}
                  onChange={handleItemNameFilterChange}
                  filterOption={(input, option) =>
                    (option?.label ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={MASTER_ITEM_NAME_OPTIONS.map((name) => ({
                    value: name,
                    label: name,
                  }))}
                />
              </Col>
              <Col xs={24} md={7} lg={7}>
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <span style={{ fontWeight: 500, fontSize: 12 }}>
                    Filter by Month
                  </span>
                  <DatePicker
                    picker="month"
                    placeholder="Select month"
                    allowClear
                    style={{ width: "100%" }}
                    value={selectedPaymentMonth}
                    onChange={handlePaymentMonthChange}
                  />
                </Space>
              </Col>
            </Row>
          </Card>
          <Card>
            <Spin spinning={isLoading}>
              <Table
                columns={columns}
                dataSource={payments}
                rowKey="_id"
                pagination={{
                  current: paginationData?.page || 1,
                  pageSize: paginationData?.limit || 10,
                  total: total,
                  showSizeChanger: true,
                  showTotal: (total, range) =>
                    `${range[0]}-${range[1]} of ${total} transactions`,
                  pageSizeOptions: ["10", "20", "50", "100"],
                }}
                onChange={handleTableChange}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: "No transactions found" }}
              />
            </Spin>
          </Card>
        </>
      ),
    },
    {
      key: "domain-purchases",
      label: (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon icon="bx:purchase-tag" width="22" height="22" />
          Domain Purchases
        </span>
      ),
      children: (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <DebouncedSearchInput
                placeholder="Search domain purchases by domain name, company, contact person..."
                onChange={handleSearchChange}
                debounceDelay={500}
                style={{ flex: 1, marginRight: 16 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setSelectedDomainPurchaseId(null);
                  setDomainPurchaseFormVisible(true);
                }}
              >
                Create Domain Purchase
              </Button>
            </div>
          </Card>
          <Card>
            <Spin spinning={isLoadingDomainPurchases}>
              <Table
                columns={domainPurchaseColumns}
                dataSource={domainPurchases}
                rowKey="_id"
                pagination={{
                  current: domainPurchasesPaginationData?.page || 1,
                  pageSize: domainPurchasesPaginationData?.limit || 10,
                  total: domainPurchasesTotal,
                  showSizeChanger: true,
                  showTotal: (total, range) =>
                    `${range[0]}-${range[1]} of ${total} domain purchases`,
                  pageSizeOptions: ["10", "20", "50", "100"],
                }}
                onChange={handleTableChange}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: "No domain purchases found" }}
              />
            </Spin>
          </Card>
        </>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={2}>Transactions</Title>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>

      {/* Reject Payment Modal */}
      <Modal
        title="Reject Payment"
        open={isRejectModalVisible}
        onCancel={() => {
          setIsRejectModalVisible(false);
          setSelectedPaymentId(null);
          rejectForm.resetFields();
        }}
        footer={null}
        width={600}
        centered
        styles={{ body: { height: "600px", overflowY: "auto" } }}
      >
        <Form
          form={rejectForm}
          layout="vertical"
          onFinish={handleReject}
          autoComplete="off"
        >
          <Form.Item
            name="rejectionNotes"
            label="Rejection Reason"
            rules={[
              { required: true, message: "Please enter rejection reason" },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Enter reason for rejecting this payment"
            />
          </Form.Item>

          <Form.Item style={{ textAlign: "end" }}>
            <Space>
              <Button
                type="primary"
                danger
                htmlType="submit"
                loading={isRejecting}
              >
                Reject Payment
              </Button>
              <Button
                onClick={() => {
                  setIsRejectModalVisible(false);
                  setSelectedPaymentId(null);
                  rejectForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Domain Purchase Form Modal */}
      <DomainPurchaseForm
        visible={domainPurchaseFormVisible}
        onCancel={() => {
          setDomainPurchaseFormVisible(false);
          setSelectedDomainPurchaseId(null);
        }}
        domainPurchaseId={selectedDomainPurchaseId}
        onSuccess={() => {
          if (refetchDomainPurchases) {
            refetchDomainPurchases();
          }
        }}
      />
    </div>
  );
};

export default TransactionsPage;
