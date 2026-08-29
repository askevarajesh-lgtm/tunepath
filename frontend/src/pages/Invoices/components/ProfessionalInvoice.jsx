import React, { useState } from "react";
import { Typography, Button, message, Modal, Radio, Input, Space, Tag } from "antd";
import { useTheme } from "../../../contexts/ThemeContext";
import { useGetPaymentIntegrationQuery } from "../../../api/integrationApi";
import {
  MailOutlined,
  PhoneOutlined,
  WalletOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

const formatCurrency = (value = 0) =>
  `\u20b9${Number(value || 0).toLocaleString("en-IN")}`;

const formatDate = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getDisplayName = (entity, fallback) =>
  entity?.companyName || entity?.name || fallback;

const getInitials = (value) => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "A")
    .toUpperCase();
};

const buildRows = (invoice) => {
  const rows = [];
  const masterItems = invoice?.proposalId?.masterItems || [];

  masterItems.forEach((item, index) => {
    rows.push({
      key: item._id ? `${item._id}-service` : `service-${index}`,
      number: rows.length + 1,
      name: item.name || `Service ${index + 1}`,
      description:
        item.description || "Included as part of the approved scope.",
      price: Number(item.price || 0),
      qty: Number(item.quantity || 1),
      tags: [
        ...(item.handlingDuration ? [`Handling: ${item.handlingDuration}`] : []),
        ...(item.category ? [item.category] : []),
        ...(Array.isArray(item.categories)
          ? item.categories
              .map((c) => c?.categoryName || c?.name)
              .filter(Boolean)
          : []),
      ],
    });

    if (item.isCampaign && item.campaignDetails) {
      rows.push({
        key: item._id ? `${item._id}-campaign` : `campaign-${index}`,
        number: rows.length + 1,
        name: `${item.name || `Service ${index + 1}`} - Campaign Execution`,
        description: `Campaign delivery for ${item.campaignDetails.numberOfDays || "n/a"} days. Platform budget is billed separately.`,
        price: Number(item.campaignDetails.campaignAmount || 0),
        qty: 1,
        tags: [
          "Campaign",
          item.campaignDetails.numberOfDays
            ? `${item.campaignDetails.numberOfDays} Days`
            : "",
        ].filter(Boolean),
      });
    }
  });

  return rows;
};

const statusTone = (value = "") => {
  const status = String(value).toLowerCase();
  if (status.includes("paid")) return "paid";
  if (status.includes("partially")) return "partial";
  if (status.includes("sent")) return "sent";
  if (status.includes("draft")) return "draft";
  return "pending";
};

const ProfessionalInvoice = ({ invoice }) => {
  const { isDark } = useTheme();
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [transactionId, setTransactionId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!invoice) return null;

  const agencySource = invoice?.agencyId || invoice?.brandId || invoice?.adminId;
  const agencyName = getDisplayName(agencySource, "Your Agency");
  const agencyIndustry = agencySource?.industry || "Agency & Consultancy Services";
  const agencyEmail = agencySource?.email || "";
  const agencyPhone = agencySource?.phone || "";
  const agencyLogo = isDark
    ? agencySource?.logoDark || agencySource?.logo
    : agencySource?.logo || agencySource?.logoDark;
  const agencyInitials = getInitials(agencyName);

  const clientName = getDisplayName(invoice.clientId, "Client Name");
  const clientEmail = invoice.clientId?.email || "";
  const clientPhone = invoice.clientId?.phone || "";
  const clientAddress = invoice.clientId?.address || "";

  const companyId =
    agencySource?._id ||
    invoice?.agencyId ||
    invoice?.brandId?._id ||
    invoice?.brandId ||
    invoice?.adminId?._id ||
    invoice?.adminId;

  const { data: paymentData } = useGetPaymentIntegrationQuery(companyId, {
    skip: !companyId,
  });
  const paymentIntegration = paymentData?.data?.integration;
  const paymentConfig = paymentIntegration?.isActive ? paymentIntegration.config : null;

  const rows = buildRows(invoice);
  const itemsTotal = rows.reduce((sum, row) => sum + (row.price || 0) * (row.qty || 1), 0);
  const subtotal = Number(invoice.amount || 0);
  const grandTotal = Number(invoice.grandTotal || 0);
  const totalPaid = Number(invoice.totalPaid || 0);
  const pendingAmount = Number(
    invoice.pendingAmount ?? Math.max(grandTotal - totalPaid, 0),
  );
  const hasAdjustment = rows.length > 0 && itemsTotal !== subtotal;

  const invoiceDate = invoice.invoiceDate || invoice.createdAt;
  const invoiceStatus = invoice.invoiceStatus || (invoice.paymentStatus === "Paid" ? "Paid" : "Pending");
  const paymentStatus = invoice.paymentStatus || "Pending";
  const settled = statusTone(paymentStatus) === "paid";
  const paymentStatusClass = statusTone(paymentStatus);

  const themePrimary = "var(--accent-primary)";
  const themePrimarySoft = "color-mix(in srgb, var(--accent-primary) 12%, var(--bg-secondary))";
  const themeAccent = "color-mix(in srgb, var(--accent-secondary) 75%, var(--accent-primary))";
  const sheetBackground = isDark
    ? "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.98) 100%)";

  const handlePaymentSubmit = async () => {
    if (paymentMethod === "bank_transfer" && !transactionId.trim()) {
      return message.error("Please enter a transaction ID.");
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/invoices/${invoice._id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentMode: paymentMethod === "razorpay" ? "Razorpay" : "Bank Transfer",
          transactionId:
            paymentMethod === "razorpay"
              ? `pay_mock_${Math.random().toString(36).slice(2, 9)}`
              : transactionId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        message.success("Payment recorded successfully!");
        setIsPaymentModalVisible(false);
        setTimeout(() => window.location.reload(), 900);
      } else {
        message.error(data.message || "Failed to process payment");
      }
    } catch (error) {
      console.error(error);
      message.error("An error occurred while processing payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="professional-invoice"
      id="printable-invoice"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 92%, white) 0%, var(--bg-primary) 100%)",
        padding: 24,
      }}
    >
      <div
        className="invoice-sheet"
        style={{
          maxWidth: 930,
          margin: "0 auto",
          background: sheetBackground,
          border: "1px solid var(--border-color)",
          borderRadius: 18,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.10)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "30px 36px 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 24,
              alignItems: "flex-start",
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 4,
                  background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeAccent} 100%)`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 800,
                  flex: "0 0 auto",
                  boxShadow: "0 10px 20px rgba(16, 185, 129, 0.14)",
                  overflow: "hidden",
                }}
              >
                {agencyLogo ? (
                  <img
                    src={agencyLogo}
                    alt={`${agencyName} logo`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      background: "#fff",
                    }}
                  />
                ) : (
                  agencyInitials
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    letterSpacing: 1.8,
                    fontWeight: 800,
                    color: themePrimary,
                    textTransform: "uppercase",
                  }}
                >
                  {agencyName}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {agencyIndustry}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                  {formatDate(invoiceDate)}
                </div>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <Title
                level={1}
                style={{
                  margin: 0,
                  fontSize: 42,
                  lineHeight: 0.9,
                  fontWeight: 900,
                  letterSpacing: -1.8,
                  color: "var(--text-primary)",
                }}
              >
                INVOICE
              </Title>
              <Text style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
                #{invoice.invoiceNumber}
              </Text>
              <div style={{ marginTop: 10 }}>
                <Tag
                  bordered={false}
                  style={{
                    margin: 0,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "color-mix(in srgb, var(--accent-primary) 12%, white)",
                    color: themePrimary,
                    border: "1px solid color-mix(in srgb, var(--accent-primary) 20%, var(--border-color))",
                    fontWeight: 800,
                    letterSpacing: 0.6,
                  }}
                >
                  {invoiceStatus.toUpperCase()}
                </Tag>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 270px",
              gap: 16,
              alignItems: "stretch",
              marginBottom: 22,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1.8,
                  color: themePrimary,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Invoice To:
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>
                {clientName}
              </div>
              {clientEmail && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {clientEmail}
                </div>
              )}
              {clientPhone && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {clientPhone}
                </div>
              )}
              {clientAddress && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {clientAddress}
                </div>
              )}
            </div>

            <div
              style={{
                background:
                  "linear-gradient(90deg, color-mix(in srgb, var(--accent-primary) 15%, white) 0%, color-mix(in srgb, var(--bg-tertiary) 90%, white) 12%, var(--bg-tertiary) 100%)",
                border: "1px solid var(--border-color)",
                borderRadius: 4,
                display: "grid",
                gridTemplateColumns: "6px 1fr",
                overflow: "hidden",
              }}
            >
              <div style={{ background: themePrimary }} />
              <div style={{ padding: "16px 16px 14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Invoice Number
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                      {invoice.invoiceNumber}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Date Information
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                      {formatDate(invoiceDate)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1.7fr 120px 90px 120px",
                alignItems: "center",
                background: `linear-gradient(90deg, ${themePrimary} 0%, ${themeAccent} 100%)`,
                color: "#fff",
                borderRadius: "4px 4px 0 0",
                overflow: "hidden",
                textTransform: "uppercase",
                letterSpacing: 1,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              <div style={{ padding: "12px 14px" }}>No</div>
              <div style={{ padding: "12px 14px" }}>Item Description</div>
              <div style={{ padding: "12px 14px", textAlign: "right" }}>Price</div>
              <div style={{ padding: "12px 14px", textAlign: "right" }}>Qty</div>
              <div style={{ padding: "12px 14px", textAlign: "right" }}>Total</div>
            </div>

            <div style={{ border: "1px solid var(--border-color)", borderTop: "none" }}>
              {rows.length > 0 ? (
                rows.map((row, index) => (
                  <div
                    key={row.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 1.7fr 120px 90px 120px",
                      alignItems: "start",
                      minHeight: 64,
                      background: index % 2 === 0 ? "var(--bg-tertiary)" : "transparent",
                      borderTop: index === 0 ? "none" : "1px solid var(--border-color)",
                    }}
                  >
                    <div style={{ padding: "14px", fontSize: 12, color: "var(--text-secondary)" }}>
                      {String(row.number).padStart(2, "0")}
                    </div>
                    <div style={{ padding: "14px" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
                        {row.name}
                      </div>
                      {row.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            marginTop: 4,
                            lineHeight: 1.45,
                          }}
                        >
                          {row.description}
                        </div>
                      )}
                      {row.tags?.length > 0 && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          {row.tags.slice(0, 3).map((tag) => (
                            <Tag
                              key={`${row.key}-${tag}`}
                              bordered={false}
                              style={{
                                margin: 0,
                                borderRadius: 999,
                                background: "color-mix(in srgb, var(--accent-primary) 11%, white)",
                                color: themePrimary,
                                border: "1px solid color-mix(in srgb, var(--accent-primary) 18%, var(--border-color))",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 8px",
                              }}
                            >
                              {tag}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        padding: "14px",
                        textAlign: "right",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {formatCurrency(row.price)}
                    </div>
                    <div
                      style={{
                        padding: "14px",
                        textAlign: "right",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {row.qty}
                    </div>
                    <div
                      style={{
                        padding: "14px",
                        textAlign: "right",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      {formatCurrency((row.price || 0) * (row.qty || 1))}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: 18, textAlign: "center", color: "var(--text-secondary)" }}>
                  No line items found.
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.25fr 0.95fr",
              gap: 20,
              marginTop: 22,
            }}
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 1.4,
                    color: themePrimary,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Payment Method
                </div>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                  Bank Account
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Bank Fullname
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Bank Code
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 1.4,
                    color: themePrimary,
                    textTransform: "uppercase",
                    marginBottom: 6,
                  }}
                >
                  Terms & Condition
                </div>
                <Paragraph
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.55,
                  }}
                >
                  Please review the invoice carefully. Payment is due by the due date unless otherwise specified. Late payments may be subject to a fee.
                </Paragraph>
              </div>

              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonummy nibh euismod
                tincidunt ut laoreet dolore magna aliquam erat volutpat.
              </div>

              <div>
                <div style={{ height: 44 }} />
                <div
                  style={{
                    width: 140,
                    height: 56,
                    marginBottom: 8,
                    position: "relative",
                  }}
                >
                  {agencySource?.invoiceSignature ? (
                    <img 
                      src={agencySource.invoiceSignature} 
                      alt="Signature" 
                      style={{
                        position: "absolute",
                        left: 10,
                        bottom: 4,
                        maxHeight: 60,
                        maxWidth: 120,
                        objectFit: "contain"
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        left: 18,
                        top: 12,
                        fontFamily: "cursive",
                        fontSize: 28,
                        color: isDark ? "rgba(255,255,255,0.8)" : "#111",
                      }}
                    >
                      sign
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
                  {agencyName}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  Accounting Manager
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <div style={{ display: "grid", gap: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>Sub Total:</span>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {formatCurrency(subtotal)}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>Tax. Vit (15%):</span>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {invoice.tax > 0 ? formatCurrency(invoice.tax) : formatCurrency(0)}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>Discount 5%:</span>
                    <strong style={{ color: "#ef4444" }}>
                      {invoice.discount > 0 ? `- ${formatCurrency(invoice.discount)}` : formatCurrency(0)}
                    </strong>
                  </div>

                  {hasAdjustment && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "var(--text-secondary)" }}>Items Total:</span>
                      <strong style={{ color: "var(--text-primary)" }}>
                        {formatCurrency(itemsTotal)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div
                  style={{
                    background: `linear-gradient(90deg, ${themePrimary} 0%, ${themeAccent} 100%)`,
                    color: "#fff",
                    borderRadius: 2,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  <span>Grand Total:</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    Payment Status
                  </div>
                  <Tag
                    bordered={false}
                    style={{
                      margin: "6px 0 0",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background:
                        paymentStatusClass === "paid"
                          ? "color-mix(in srgb, var(--accent-primary) 14%, white)"
                          : "color-mix(in srgb, var(--accent-warning) 18%, white)",
                      color:
                        paymentStatusClass === "paid"
                          ? themePrimary
                          : "var(--accent-warning)",
                      border:
                        paymentStatusClass === "paid"
                          ? "1px solid color-mix(in srgb, var(--accent-primary) 22%, var(--border-color))"
                          : "1px solid color-mix(in srgb, var(--accent-warning) 28%, var(--border-color))",
                      fontWeight: 800,
                    }}
                  >
                    {paymentStatus.toUpperCase()}
                  </Tag>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
                    Mode: {invoice.paymentMode || "Prepaid"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    Invoice Type: {invoice.invoiceType || "One Time"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-end",
              marginTop: 26,
            }}
          >
            <div style={{ maxWidth: 580 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: themePrimary, marginBottom: 8 }}>
                Thank you for your business!
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.55 }}>
                Please pay the invoice amount within the due date. Late payments may be subject to a fee.
                Thank you for your business!
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {agencyPhone && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: isDark ? "var(--bg-tertiary)" : "rgba(255,255,255,0.9)",
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                    color: "var(--text-primary)",
                  }}
                >
                  <PhoneOutlined style={{ color: themePrimary }} />
                  {agencyPhone}
                </span>
              )}
              {agencyEmail && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: isDark ? "var(--bg-tertiary)" : "rgba(255,255,255,0.9)",
                    border: "1px solid var(--border-color)",
                    fontSize: 12,
                    color: "var(--text-primary)",
                  }}
                >
                  <MailOutlined style={{ color: themePrimary }} />
                  {agencyEmail}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {!settled && (
        <div
          className="no-print"
          style={{
            maxWidth: 930,
            margin: "14px auto 0",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            type="primary"
            icon={<WalletOutlined />}
            onClick={() => setIsPaymentModalVisible(true)}
            style={{
              background: themePrimary,
              borderColor: themePrimary,
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            Pay Invoice Now
          </Button>
        </div>
      )}

      <Modal
        title="Pay Invoice"
        open={isPaymentModalVisible}
        onCancel={() => setIsPaymentModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsPaymentModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isSubmitting}
            onClick={handlePaymentSubmit}
            style={{ background: themePrimary, borderColor: themePrimary }}
          >
            Confirm Payment
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ fontSize: 18 }}>
            Amount Due: {formatCurrency(grandTotal)}
          </Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            Select Payment Method:
          </Text>
          <Radio.Group onChange={(e) => setPaymentMethod(e.target.value)} value={paymentMethod}>
            <Space direction="vertical">
              <Radio value="bank_transfer">Bank Transfer / Offline Payment</Radio>
              {paymentConfig?.razorpayKeyId && (
                <Radio value="razorpay">Razorpay (Online Gateway)</Radio>
              )}
            </Space>
          </Radio.Group>
        </div>
        {paymentMethod === "bank_transfer" && (
          <div style={{ marginTop: 16 }}>
            <Text style={{ display: "block", marginBottom: 8 }}>
              Please transfer the amount to the agency&apos;s bank account and enter the transaction reference number below.
            </Text>
            <Input
              placeholder="Enter Transaction ID / Reference No."
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
          </div>
        )}
        {paymentMethod === "razorpay" && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: themePrimarySoft,
              borderRadius: 8,
              border: "1px solid color-mix(in srgb, var(--accent-primary) 18%, var(--border-color))",
            }}
          >
            <Text style={{ color: themePrimary }}>
              Clicking &quot;Confirm Payment&quot; will securely process your payment via Razorpay.
            </Text>
          </div>
        )}
      </Modal>

      <style>{`
        .professional-invoice {
          color: var(--text-primary);
        }

        @media print {
          .no-print,
          .ant-modal,
          .ant-modal-root,
          .ant-btn,
          button {
            display: none !important;
          }

          .professional-invoice {
            background: #fff !important;
            padding: 0 !important;
          }

          .invoice-sheet {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #fff !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        @media (max-width: 900px) {
          .invoice-sheet > div > div:nth-child(1),
          .invoice-sheet > div > div:nth-child(3) {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 760px) {
          .professional-invoice {
            padding: 12px !important;
          }

          .invoice-sheet > div {
            padding: 20px 16px !important;
          }

          .invoice-sheet > div > div:nth-child(2),
          .invoice-sheet > div > div:nth-child(4) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ProfessionalInvoice;
