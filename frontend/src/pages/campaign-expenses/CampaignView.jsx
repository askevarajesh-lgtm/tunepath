import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Tag,
  Button,
  Space,
  message,
  Descriptions,
  Table,
  Form,
  InputNumber,
  DatePicker,
  Modal,
  Divider,
  Typography,
  Input,
  Select,
  Tabs,
} from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Tooltip } from "antd";
import {
  useGetCampaignByIdQuery,
  useAddDailyDataMutation,
  useUpdatePaymentMutation,
  useReconcilePaymentMutation,
  useAddGlobalRechargeMutation,
  useUpdateCampaignMutation,
  useUpdateGlobalRechargeMutation,
  useGetClientCampaignSummaryQuery,
  useGetGlobalRechargesQuery,
} from "../../api/campaignApi";
import { useGetCompaniesQuery } from "../../api/companyApi";
import Icon, {
  DollarOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import {
  canPerformAction,
  canViewAmounts as canViewAmountsUtil,
  canManageClientAmount,
} from "../../utils/roleAccess";
import dayjs from "dayjs";
import { formatPlatformName } from "./CampaignList";

const { TextArea } = Input;
const { Text, Title } = Typography;

const CampaignView = ({ isClientView: propIsClientView = false }) => {
  const { user: currentUser } = useAuth();
  const isClientView =
    propIsClientView ||
    currentUser?.role === "client";
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [paymentForm] = Form.useForm();
  const [reconcileForm] = Form.useForm();
  const [rechargeForm] = Form.useForm();
  const { data, isLoading, refetch } = useGetCampaignByIdQuery(id);
  const { data: clientsData } = useGetCompaniesQuery();
  const [addDailyData, { isLoading: isAdding }] = useAddDailyDataMutation();
  const [updatePayment, { isLoading: isUpdatingPayment }] =
    useUpdatePaymentMutation();
  const [reconcilePayment, { isLoading: isReconciling }] =
    useReconcilePaymentMutation();
  const [updateCampaign, { isLoading: isUpdatingStatus }] =
    useUpdateCampaignMutation();
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [isReconcileModalVisible, setIsReconcileModalVisible] = useState(false);
  const [isRechargeModalVisible, setIsRechargeModalVisible] = useState(false);
  const [editingRechargeId, setEditingRechargeId] = useState(null);
  const [addGlobalRecharge, { isLoading: isAddingSingleRecharge }] = useAddGlobalRechargeMutation();
  const [updateGlobalRecharge, { isLoading: isUpdatingRecharge }] = useUpdateGlobalRechargeMutation();

  const campaign = data?.data?.campaign;

  // Handle paginated response for clients
  const clients = clientsData?.data?.data || clientsData?.data?.companies || [];

  // Use role-based access utilities
  const canViewAmounts = canViewAmountsUtil(currentUser?.role);
  const canManagePayments = canPerformAction(
    currentUser?.role,
    "campaigns",
    "managePayments",
  );
  const canEditCampaign = canPerformAction(
    currentUser?.role,
    "campaigns",
    "edit",
  );
  const canManageClientAmountValue = canManageClientAmount(currentUser?.role);

  const onAddDailyData = async (values) => {
    try {
      await addDailyData({
        id,
        date: values.date.toDate(),
        spend: values.spend,
        leads: values.leads || 0,
        reach: values.reach || 0,
        impressions: values.impressions || 0,
        clicks: values.clicks || 0,
        insights: values.insights || "",
      }).unwrap();
      message.success("Daily data added");
      form.resetFields();
      refetch();
    } catch (error) {
      message.error(error?.data?.message || "Failed to add daily data");
    }
  };

  const handleUpdatePayment = async (values) => {
    try {
      await updatePayment({
        id,
        amountPaidByClient: values.amountPaidByClient,
        paymentStatus: values.paymentStatus,
        paidDate: values.paidDate ? values.paidDate.toDate() : null,
        gstAmount: values.gstAmount || 0,
      }).unwrap();
      message.success("Payment updated successfully");
      setIsPaymentModalVisible(false);
      paymentForm.resetFields();
      refetch();
    } catch (error) {
      message.error(error?.data?.message || "Failed to update payment");
    }
  };

  const handleReconcilePayment = async (values) => {
    try {
      await reconcilePayment({
        id,
        type: values.type,
        notes: values.notes || "",
        discrepancyAmount: values.discrepancyAmount || 0,
      }).unwrap();
      message.success("Payment reconciled successfully");
      setIsReconcileModalVisible(false);
      reconcileForm.resetFields();
      refetch();
    } catch (error) {
      message.error(error?.data?.message || "Failed to reconcile payment");
    }
  };

  const handleAddRecharge = async (values) => {
    try {
      const clientId =
        campaign.clientCompanyId?._id ||
        campaign.clientCompanyId ||
        campaign.clientId?._id ||
        campaign.clientId;

      if (editingRechargeId) {
        await updateGlobalRecharge({
          id: editingRechargeId,
          platform: values.platform,
          rechargeDate: values.rechargeDate,
          activeCampaignsCount: values.activeCampaignsCount,
          clientCompanyIds: [clientId],
          clientDetails: values.clientDetails,
          notes: values.notes || "",
        }).unwrap();
        message.success("Campaign recharge updated successfully");
      } else {
        await addGlobalRecharge({
          platform: values.platform,
          rechargeDate: values.rechargeDate,
          activeCampaignsCount: values.activeCampaignsCount,
          clientCompanyIds: [clientId],
          clientDetails: values.clientDetails,
          notes: values.notes || "",
        }).unwrap();
        message.success("Campaign recharge added successfully");
      }
      setIsRechargeModalVisible(false);
      setEditingRechargeId(null);
      rechargeForm.resetFields();
      refetch();
    } catch (error) {
      message.error(error?.data?.message || "Failed to process recharge");
    }
  };

  const handleEditRecharge = (record) => {
    setEditingRechargeId(record._id);
    const clientId =
      campaign.clientCompanyId?._id ||
      campaign.clientCompanyId ||
      campaign.clientId?._id ||
      campaign.clientId;

    rechargeForm.setFieldsValue({
      platform: campaign.platform?.replace("_", " ").toUpperCase(),
      rechargeDate: dayjs(record.rechargeDate || record.rechargedAt),
      activeCampaignsCount: record.activeCampaignsCount,
      clientCompanyIds: [clientId],
      clientDetails: {
        [clientId]: {
          dailyAmountSpent: record.dailyAmountSpent,
          dailyBudget: record.dailyBudget,
          rechargeAmount: record.rechargeAmount,
        },
      },
      notes: record.notes,
    });
    setIsRechargeModalVisible(true);
  };

  const { data: globalRechargesData, isLoading: isLoadingRecharges } = useGetGlobalRechargesQuery({
    clientCompanyId: campaign?.clientId?._id || campaign?.clientId || campaign?.clientCompanyId?._id || campaign?.clientCompanyId,
    platform: campaign?.platform
  }, { skip: !campaign });

  const clientRechargeHistory = useMemo(() => {
    const rawRecharges = globalRechargesData?.data?.data || [];
    const currentClientId = campaign?.clientId?._id || campaign?.clientId || campaign?.clientCompanyId?._id || campaign?.clientCompanyId;
    
    return rawRecharges.map(record => {
      // Find this client's breakdown in the batch record
      const breakdown = record.clientRecharges?.find(cr => 
        (cr.clientId?._id || cr.clientId)?.toString() === currentClientId?.toString()
      );
      
      return {
        ...record,
        // Use individual breakdown if available, otherwise fallback to record total (for single recharges)
        rechargeAmount: breakdown ? breakdown.rechargeAmount : record.rechargeAmount,
        dailyAmountSpent: breakdown ? breakdown.dailyAmountSpent : record.dailyAmountSpent,
        dailyBudget: breakdown ? breakdown.dailyBudget : record.dailyBudget,
      };
    });
  }, [globalRechargesData, campaign]);

  // Watch spent for auto-calc
  const rechargeSpent = Form.useWatch("dailyAmountSpent", rechargeForm);
  const { data: clientSummary } = useGetClientCampaignSummaryQuery(
    campaign?.clientId?._id || campaign?.clientId || campaign?.clientCompanyId?._id || campaign?.clientCompanyId,
    { skip: !campaign }
  );

  useEffect(() => {
    if (rechargeSpent !== undefined) {
      const recharge = Number((rechargeSpent * 1.18).toFixed(2));
      rechargeForm.setFieldValue("rechargeAmount", recharge);
      
      if (clientSummary?.data) {
        const balance = clientSummary.data.remainingBalance;
        rechargeForm.setFieldValue("clientAmount", Number((balance - recharge).toFixed(2)));
      }
    }
  }, [rechargeSpent, clientSummary, rechargeForm]);

  const handleStatusChange = async (newStatus) => {
    try {
      await updateCampaign({
        id,
        status: newStatus,
      }).unwrap();
      message.success("Campaign status updated successfully");
      refetch();
    } catch (error) {
      message.error(error?.data?.message || "Failed to update campaign status");
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (!campaign) return <div>Campaign not found</div>;

  const dailyDataColumns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: "Spend",
      dataIndex: "spend",
      key: "spend",
      render: (spend) => `₹${spend || 0}`,
    },
    {
      title: "Leads",
      dataIndex: "leads",
      key: "leads",
    },
    {
      title: "Reach",
      dataIndex: "reach",
      key: "reach",
    },
    {
      title: "Impressions",
      dataIndex: "impressions",
      key: "impressions",
    },
    {
      title: "Clicks",
      dataIndex: "clicks",
      key: "clicks",
    },
  ];

  const rechargeHistoryColumns = [
    {
      title: "Date",
      dataIndex: "rechargeDate",
      key: "rechargeDate",
      render: (date, record) =>
        dayjs(date || record.rechargedAt).format("DD/MM/YYYY"),
    },
    {
      title: "Amount",
      dataIndex: "rechargeAmount",
      key: "rechargeAmount",
      render: (amount) => `₹${amount || 0}`,
    },
    {
      title: "Daily Budget",
      dataIndex: "dailyBudget",
      key: "dailyBudget",
      render: (amount) => `₹${amount || 0}`,
    },
    {
      title: "Recharged By",
      dataIndex: "rechargedBy",
      key: "rechargedBy",
      render: (user) => user?.name || "N/A",
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
    },
    ...(canManageClientAmountValue
      ? [
          {
            title: "Actions",
            key: "actions",
            fixed: window.innerWidth <= 768 ? false : "right",
            width: 80,
            render: (_, record) => (
              <Button
                type="text"
                icon={<Icon icon="lucide:edit" />}
                onClick={() => handleEditRecharge(record)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() =>
              navigate(isClientView ? "/client/accounts/campaign-expenses" : "/agency/accounts/campaign-expenses")
            }
          >
            Back
          </Button>
          <Title
            level={2}
            style={{ margin: 0, fontWeight: "bold", fontSize: "24px" }}
          >
            Campaign: {formatPlatformName(campaign.platform)}
          </Title>
          {campaign.isInternal && (
            <Tag color="purple" style={{ fontWeight: 700, fontSize: 13, padding: "2px 10px", borderRadius: 6 }}>
              Own Brand Marketing
            </Tag>
          )}
        </Space>
      </div>
      <Card>
        <Descriptions
          bordered
          column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
          style={{ fontSize: "14px" }}
        >
          <Descriptions.Item label={campaign.isInternal ? "Brand / Entity" : "Client"}>
            <Space>
              <span>{campaign.ownBrandName || campaign.clientCompanyId?.name || campaign.clientId?.name || "Agency Own Brand"}</span>
              {campaign.isInternal && (
                <Tag color="purple" style={{ fontWeight: 600, fontSize: 11 }}>
                  Own Brand
                </Tag>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Platform">
            {formatPlatformName(campaign.platform)}
          </Descriptions.Item>
          <Descriptions.Item label="Start Date">
            {new Date(campaign.startDate).toLocaleDateString()}
          </Descriptions.Item>
          <Descriptions.Item label="End Date">
            {new Date(campaign.endDate).toLocaleDateString()}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            {canEditCampaign ? (
              <Select
                value={
                  ["active", "paused", "completed"].includes(campaign.status)
                    ? campaign.status
                    : "planned"
                }
                onChange={handleStatusChange}
                loading={isUpdatingStatus}
                style={{ width: "120px" }}
              >
                <Select.Option value="planned">Planned</Select.Option>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="paused">Inactive</Select.Option>
                <Select.Option value="completed">Complete</Select.Option>
              </Select>
            ) : (
              <Tag
                color={
                  campaign.status === "active"
                    ? "green"
                    : campaign.status === "paused"
                      ? "orange"
                      : campaign.status === "completed"
                        ? "blue"
                        : "default"
                }
              >
                {campaign.status === "paused"
                  ? "INACTIVE"
                  : campaign.status === "completed"
                    ? "COMPLETE"
                    : ["active", "planned"].includes(campaign.status)
                      ? campaign.status.toUpperCase()
                      : "PLANNED"}
              </Tag>
            )}
            {["planned", "active", "completed"].includes(campaign.status) && (
              <Tooltip title="Status is automatically managed based on Start and End dates.">
                <InfoCircleOutlined
                  style={{
                    marginLeft: 8,
                    cursor: "pointer",
                    color: "var(--accent-primary)",
                  }}
                />
              </Tooltip>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Campaign Days">
            {campaign.campaignDays}
          </Descriptions.Item>
          {canViewAmounts && (
            <>
              <Descriptions.Item label="Daily Budget">
                ₹{campaign.dailyBudget}
              </Descriptions.Item>
              <Descriptions.Item label={campaign.isInternal ? "Campaign Budget" : "Campaign Amount (from Invoice)"}>
                ₹{campaign.campaignAmount}
              </Descriptions.Item>
              <Descriptions.Item label="Actual Spend">
                ₹{campaign.actualSpend || 0}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>

        {/* Client-Side Payment Information */}
        <Divider>{campaign.isInternal ? "Own Brand Expense & Recharge Information" : "Client-Side Payment Information"}</Divider>
        <Descriptions
          bordered
          column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
          style={{ marginTop: 16, fontSize: "14px" }}
        >
          <Descriptions.Item label={campaign.isInternal ? "Campaign Budget" : "Campaign Amount (Invoice)"}>
            ₹{(campaign.campaignAmount || 0).toLocaleString("en-IN")}
          </Descriptions.Item>
          <Descriptions.Item label="Total Campaign Value">
            ₹{(campaign.totalCampaignValue || campaign.campaignAmount || 0).toLocaleString("en-IN")}
          </Descriptions.Item>
          <Descriptions.Item
            label={
              <span>
                Balance Campaign Amount{" "}
                <Tooltip title="Campaign Amount from Invoice minus Total Campaign Value. Shows how much invoice budget is still unused.">
                  <InfoCircleOutlined style={{ color: "var(--accent-primary)" }} />
                </Tooltip>
              </span>
            }
          >
            {(() => {
              const invoiceAmt = campaign.campaignAmount || 0;
              const usedAmt = campaign.totalCampaignValue || campaign.campaignAmount || 0;
              const balance = invoiceAmt - usedAmt;
              const isNegative = balance < 0;
              const isZero = balance === 0;
              return (
                <Text
                  strong
                  style={{
                    color: isNegative ? "#cf1322" : isZero ? "#faad14" : "#389e0d",
                    fontSize: 15,
                  }}
                >
                  ₹{Math.abs(balance).toLocaleString("en-IN")}
                  {isNegative && (
                    <Tag color="red" style={{ marginLeft: 8, fontSize: 11 }}>
                      Over Budget
                    </Tag>
                  )}
                  {isZero && (
                    <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>
                      Fully Used
                    </Tag>
                  )}
                  {!isNegative && !isZero && (
                    <Tag color="green" style={{ marginLeft: 8, fontSize: 11 }}>
                      Available
                    </Tag>
                  )}
                </Text>
              );
            })()}
          </Descriptions.Item>
          <Descriptions.Item label="Amount Paid by Client">
            ₹{(campaign.amountPaidByClient || 0).toLocaleString("en-IN")}
          </Descriptions.Item>
          <Descriptions.Item label="Remaining Recharge Balance">
            <Text
              strong
              style={{
                color:
                  (clientSummary?.data?.remainingBalance || 0) > 0
                    ? "#389e0d"
                    : "#cf1322",
                fontSize: 15,
              }}
            >
              ₹{(clientSummary?.data?.remainingBalance || 0).toLocaleString(
                "en-IN",
              )}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label=""></Descriptions.Item>
        </Descriptions>


        {/* Admin-Side Payment Management */}
        {canManagePayments && (
          <>
            <Divider>Admin Payment Management</Divider>
            <Descriptions
              bordered
              column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
              style={{ marginTop: 16, fontSize: "14px" }}
            >
              <Descriptions.Item label="Payment Status">
                <Tag
                  color={
                    campaign.paymentStatus === "paid"
                      ? "green"
                      : campaign.paymentStatus === "partial"
                        ? "orange"
                        : campaign.paymentStatus === "overdue"
                          ? "red"
                          : "default"
                  }
                >
                  {campaign.paymentStatus || "pending"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="GST Amount">
                ₹{campaign.gstAmount || 0}
              </Descriptions.Item>
              <Descriptions.Item label="Paid Date">
                {campaign.paidDate
                  ? dayjs(campaign.paidDate).format("DD/MM/YYYY")
                  : "Not paid yet"}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Reconciliation">
                <Tag
                  color={
                    campaign.paymentReconciliation?.type === "reconciled"
                      ? "green"
                      : campaign.paymentReconciliation?.type === "discrepancy"
                        ? "red"
                        : "default"
                  }
                >
                  {campaign.paymentReconciliation?.type || "pending"}
                </Tag>
              </Descriptions.Item>
              {campaign.paymentReconciliation?.reconciledAt && (
                <Descriptions.Item label="Reconciled At">
                  {dayjs(campaign.paymentReconciliation.reconciledAt).format(
                    "DD/MM/YYYY HH:mm",
                  )}
                </Descriptions.Item>
              )}
              {campaign.paymentReconciliation?.discrepancyAmount > 0 && (
                <Descriptions.Item label="Discrepancy Amount">
                  <Text type="danger">
                    ₹{campaign.paymentReconciliation.discrepancyAmount}
                  </Text>
                </Descriptions.Item>
              )}
              {campaign.paymentReconciliation?.notes && (
                <Descriptions.Item label="Reconciliation Notes" span={2}>
                  {campaign.paymentReconciliation.notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Space style={{ marginTop: 16 }}>
              <Button
                type="default"
                icon={<ReloadOutlined />}
                onClick={() => {
                  const clientId =
                    campaign.clientCompanyId?._id ||
                    campaign.clientCompanyId ||
                    campaign.clientId?._id ||
                    campaign.clientId;

                  rechargeForm.setFieldsValue({
                    platform: campaign.platform
                      ?.replace("_", " ")
                      .toUpperCase(),
                    rechargeDate: dayjs(),
                    activeCampaignsCount: undefined,
                    clientCompanyIds: [clientId],
                    clientDetails: {
                      [clientId]: {
                        dailyAmountSpent: 0,
                        dailyBudget: campaign.dailyBudget || 0,
                        rechargeAmount: 0,
                      },
                    },
                    notes: "",
                  });
                  setIsRechargeModalVisible(true);
                }}
              >
                Campaign Recharge
              </Button>
              <Button
                type="primary"
                icon={<DollarOutlined />}
                onClick={() => {
                  paymentForm.setFieldsValue({
                    amountPaidByClient: campaign.amountPaidByClient || 0,
                    paymentStatus: campaign.paymentStatus || "pending",
                    paidDate: campaign.paidDate
                      ? dayjs(campaign.paidDate)
                      : null,
                    gstAmount: campaign.gstAmount || 0,
                  });
                  setIsPaymentModalVisible(true);
                }}
              >
                Update Payment
              </Button>
              <Button
                icon={<CheckCircleOutlined />}
                onClick={() => {
                  reconcileForm.setFieldsValue({
                    type: campaign.paymentReconciliation?.type || "reconciled",
                    notes: campaign.paymentReconciliation?.notes || "",
                    discrepancyAmount:
                      campaign.paymentReconciliation?.discrepancyAmount || 0,
                  });
                  setIsReconcileModalVisible(true);
                }}
              >
                Reconcile Payment
              </Button>
            </Space>
          </>
        )}

        {!isClientView && (
          <div style={{ marginTop: 24 }}>
            <h3>Add Daily Data</h3>
            <Form form={form} layout="inline" onFinish={onAddDailyData}>
              <Form.Item name="date" rules={[{ required: true }]}>
                <DatePicker placeholder="Date" />
              </Form.Item>
              <Form.Item name="spend" rules={[{ required: true }]}>
                <InputNumber prefix="₹" placeholder="Spend" min={0} />
              </Form.Item>
              <Form.Item name="leads">
                <InputNumber placeholder="Leads" min={0} />
              </Form.Item>
              <Form.Item name="reach">
                <InputNumber placeholder="Reach" min={0} />
              </Form.Item>
              <Form.Item name="impressions">
                <InputNumber placeholder="Impressions" min={0} />
              </Form.Item>
              <Form.Item name="clicks">
                <InputNumber placeholder="Clicks" min={0} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={isAdding}>
                  Add
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <Tabs
            defaultActiveKey="daily"
            items={[
              {
                key: "daily",
                label: "Daily Campaign Data",
                children: (
                  <Table
                    columns={dailyDataColumns}
                    dataSource={campaign.dailyData || []}
                    rowKey={(record, index) => index}
                    pagination={false}
                  />
                ),
              },
              {
                key: "recharge",
                label: "Recharge History",
                children: (
                  <Table
                    columns={rechargeHistoryColumns}
                    dataSource={clientRechargeHistory}
                    loading={isLoadingRecharges}
                    rowKey={(record, index) => record._id || index}
                    pagination={false}
                    locale={{ emptyText: "No recharge history found" }}
                  />
                ),
              },
            ]}
          />
        </div>
      </Card>

      {/* Update Payment Modal */}
      <Modal
        title="Update Campaign Payment"
        open={isPaymentModalVisible}
        onCancel={() => {
          setIsPaymentModalVisible(false);
          paymentForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={paymentForm}
          layout="vertical"
          onFinish={handleUpdatePayment}
        >
          <Form.Item
            name="amountPaidByClient"
            label="Amount Paid by Client (excl GST)"
            rules={[{ required: true, message: "Please enter amount paid" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              prefix="₹"
              min={0}
              placeholder="Amount paid by client"
            />
          </Form.Item>

          <Form.Item
            name="paymentStatus"
            label="Payment Status"
            rules={[
              { required: true, message: "Please select payment status" },
            ]}
          >
            <Select placeholder="Select payment status">
              <Select.Option value="pending">Pending</Select.Option>
              <Select.Option value="partial">Partial</Select.Option>
              <Select.Option value="paid">Paid</Select.Option>
              <Select.Option value="overdue">Overdue</Select.Option>
              <Select.Option value="refunded">Refunded</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="paidDate" label="Paid Date">
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="gstAmount" label="GST Amount">
            <InputNumber
              style={{ width: "100%" }}
              prefix="₹"
              min={0}
              placeholder="GST amount"
            />
          </Form.Item>

          <Form.Item style={{ textAlign: "end" }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isUpdatingPayment}
              >
                Update Payment
              </Button>
              <Button
                onClick={() => {
                  setIsPaymentModalVisible(false);
                  paymentForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reconcile Payment Modal */}
      <Modal
        title="Reconcile Campaign Payment"
        open={isReconcileModalVisible}
        onCancel={() => {
          setIsReconcileModalVisible(false);
          reconcileForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={reconcileForm}
          layout="vertical"
          onFinish={handleReconcilePayment}
        >
          <Form.Item
            name="type"
            label="Reconciliation Status"
            rules={[
              {
                required: true,
                message: "Please select reconciliation status",
              },
            ]}
          >
            <Select placeholder="Select reconciliation status">
              <Select.Option value="reconciled">Reconciled</Select.Option>
              <Select.Option value="discrepancy">
                Discrepancy Found
              </Select.Option>
              <Select.Option value="pending">Pending</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="discrepancyAmount"
            label="Discrepancy Amount (if any)"
          >
            <InputNumber
              style={{ width: "100%" }}
              prefix="₹"
              min={0}
              placeholder="Enter discrepancy amount"
            />
          </Form.Item>

          <Form.Item name="notes" label="Reconciliation Notes">
            <TextArea rows={4} placeholder="Enter reconciliation notes" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={isReconciling}>
                Reconcile Payment
              </Button>
              <Button
                onClick={() => {
                  setIsReconcileModalVisible(false);
                  reconcileForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Campaign Recharge Modal */}
      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon
              icon={editingRechargeId ? "lucide:edit" : "mdi:flash"}
              width="24"
            />
            <span>
              {editingRechargeId
                ? "Edit Campaign Recharge"
                : "Campaign Recharge"}
            </span>
          </div>
        }
        open={isRechargeModalVisible}
        onCancel={() => {
          setIsRechargeModalVisible(false);
          setEditingRechargeId(null);
          rechargeForm.resetFields();
        }}
        footer={null}
        width={800}
        styles={{
          body: {
            paddingTop: 10,
            maxHeight: "75vh",
            overflowY: "auto",
          },
        }}
      >
        <Form
          form={rechargeForm}
          layout="vertical"
          onFinish={handleAddRecharge}
        >
          <Form.Item label="Platform">
            <Input
              value={formatPlatformName(campaign.platform)}
              disabled
            />
          </Form.Item>
          <Form.Item label="Client">
            <Input
              value={campaign.clientCompanyId?.name || campaign.clientId?.name}
              disabled
            />
          </Form.Item>

          <Form.Item
            name="rechargeDate"
            label="Date"
            rules={[{ required: true, message: "Please select date" }]}
          >
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item
            name="dailyAmountSpent"
            label="Daily Amount Spent"
            rules={[
              { required: true, message: "Please enter daily amount spent" },
            ]}
          >
            <InputNumber
              style={{ width: "100%" }}
              prefix="₹"
              min={0}
              precision={2}
              step={0.01}
              placeholder="Enter daily amount spent"
            />
          </Form.Item>

          <Form.Item
            name="dailyBudget"
            label="Daily Budget (Received)"
            rules={[{ required: true, message: "Please enter daily budget" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              prefix="₹"
              min={0}
              precision={2}
              step={0.01}
              placeholder="Enter daily budget received"
            />
          </Form.Item>

          {canManageClientAmountValue && (
            <Form.Item
              name="clientAmount"
              label="Client Amount (Remaining Balance)"
            >
              <InputNumber
                style={{ width: "100%", fontWeight: "bold", color: "var(--accent-primary)" }}
                prefix="₹"
                readOnly
                disabled
                variant="borderless"
                precision={2}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              />
            </Form.Item>
          )}

          <Form.Item
            name="rechargeAmount"
            label="Recharge Amount (Spent + 18% GST)"
            rules={[
              { required: true, message: "Please enter recharge amount" },
            ]}
          >
            <InputNumber
              style={{ width: "100%", backgroundColor: '#f0f5ff', fontWeight: 'bold' }}
              prefix="₹"
              min={0}
              precision={2}
              step={0.01}
              readOnly
              variant="filled"
              placeholder="Auto-calculated"
            />
          </Form.Item>

          <Form.Item name="notes" label="Notes (Optional)">
            <TextArea
              rows={3}
              placeholder="Enter any notes about this recharge"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={isAddingSingleRecharge || isUpdatingRecharge}
              >
                {editingRechargeId ? "Update Recharge" : "Submit Recharge"}
              </Button>
              <Button
                onClick={() => {
                  setIsRechargeModalVisible(false);
                  setEditingRechargeId(null);
                  rechargeForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CampaignView;
