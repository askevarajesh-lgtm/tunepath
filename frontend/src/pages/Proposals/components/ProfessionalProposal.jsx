import React from "react";
import { Typography } from "antd";
import { ExportOutlined, SearchOutlined } from "@ant-design/icons";
import { useTheme } from "../../../contexts/ThemeContext";

const { Title } = Typography;
const RUPEE = "\u20b9";

const formatCurrency = (value = 0) =>
  `${RUPEE}${Number(value || 0).toLocaleString("en-IN")}`;

const formatDate = (value) => {
  if (!value) return "N/A";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/A";
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatAddress = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "object") {
    const parts = [
      value.line1,
      value.line2,
      value.city,
      value.state,
      value.pincode,
      value.postalCode,
      value.country,
    ]
      .filter(Boolean)
      .map((part) => String(part).trim())
      .filter(Boolean);
    return parts.join(", ");
  }
  return String(value).trim();
};

const formatWebsiteLabel = (value) => {
  if (!value) return "yourwebsite.com";
  return String(value).trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
};

const toWebsiteUrl = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
};

const truncateText = (value, max = 120) => {
  if (!value) return "";
  const text = String(value).trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

const parseDuration = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!text || /^(n\/a|na|none|-)$/i.test(text)) return null;

  const match = text.match(
    /^(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months|year|years)$/i,
  );
  if (!match) {
    return { days: 0, label: text };
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  let days = amount;
  if (unit.startsWith("week")) days = amount * 7;
  if (unit.startsWith("month")) days = amount * 30;
  if (unit.startsWith("year")) days = amount * 365;

  return { days, label: text };
};

const buildScopeBullets = (items) => {
  const categoryBullets = [];
  const categorySeen = new Set();

  items.forEach((item) => {
    (item?.categories || []).forEach((category) => {
      const label = category?.name || category?.categoryName;
      if (!label && label !== 0) return;
      const count = category?.count;
      const bullet = `${label}: ${count ?? 0}`;
      const key = bullet.toLowerCase();
      if (!categorySeen.has(key)) {
        categorySeen.add(key);
        categoryBullets.push(bullet);
      }
    });
  });

  if (categoryBullets.length > 0) {
    return categoryBullets.slice(0, 3);
  }

  const itemBullets = items
    .map((item, index) => {
      const serviceName = item?.name || `Service ${index + 1}`;
      let detail = "";
      if (item?.description) {
        detail = truncateText(item.description, 80);
      } else if (item?.handlingDuration) {
        detail = item.handlingDuration;
      } else if (item?.isCampaign && item?.campaignDetails?.numberOfDays) {
        detail = `${item.campaignDetails.numberOfDays} day campaign`;
      } else if (Array.isArray(item?.applicableAccess) && item.applicableAccess.length > 0) {
        const firstAccess = item.applicableAccess[0];
        detail = [
          firstAccess?.name,
          firstAccess?.value ? `: ${firstAccess.value}` : "",
        ]
          .filter(Boolean)
          .join("");
      }
      return detail ? `${serviceName}: ${detail}` : serviceName;
    })
    .filter(Boolean);

  if (itemBullets.length > 0) {
    return itemBullets.slice(0, 3);
  }

  return [
    "Strategic planning and scope definition",
    "Execution, review, and delivery milestones",
    "Final handoff and support notes",
  ];
};

const buildDeliverableBullets = (items) => {
  const accessBullets = [];
  const accessSeen = new Set();

  items.forEach((item) => {
    (item?.applicableAccess || []).forEach((access) => {
      const label = access?.name || access?.label;
      const value = access?.value || access?.description || "";
      const bullet = [label, value ? `: ${value}` : ""].filter(Boolean).join("");
      const key = bullet.toLowerCase();
      if (bullet && !accessSeen.has(key)) {
        accessSeen.add(key);
        accessBullets.push(bullet);
      }
    });
  });

  if (accessBullets.length > 0) {
    return accessBullets.slice(0, 3);
  }

  const itemBullets = items
    .map((item, index) => {
      const serviceName = item?.name || `Item ${index + 1}`;
      return `Final deliverable for ${serviceName}`;
    })
    .filter(Boolean);

  if (itemBullets.length > 0) {
    return itemBullets.slice(0, 3);
  }

  return [
    "Approved creative and execution assets",
    "Progress reporting and status updates",
    "Project handoff and next-step recommendations",
  ];
};

const buildTimelineText = (items) => {
  const candidates = items
    .map((item) => {
      if (item?.isCampaign && item?.campaignDetails?.numberOfDays) {
        const days = Number(item.campaignDetails.numberOfDays) || 0;
        return {
          days,
          label: `${days} days`,
        };
      }

      const duration = parseDuration(item?.handlingDuration);
      if (!duration) return null;
      if (/^(n\/a|na|none|-)$/i.test(String(duration.label || "").trim())) {
        return null;
      }
      return duration;
    })
    .filter(Boolean);

  if (candidates.length > 0) {
    const best = candidates.reduce((currentBest, candidate) => {
      if (!currentBest) return candidate;
      return candidate.days > currentBest.days ? candidate : currentBest;
    }, null);
    return `Estimated completion: ${best.label || "4-6 weeks"} from approval`;
  }

  return "Estimated completion: 4-6 weeks from approval";
};

const buildDescription = (projectName, items) => {
  const leadDetail = items[0]?.description ? truncateText(items[0].description, 120) : "";
  if (leadDetail) {
    return `This proposal outlines the scope for ${projectName || "the project"}. ${leadDetail} It keeps the project purpose, key details, and intended direction clear from the start.`;
  }

  return `This proposal outlines the scope for ${projectName || "the project"}. It summarizes the project purpose, key details, and intended direction clearly.`;
};

const ProfessionalProposal = ({ proposal }) => {
  const { isDark } = useTheme();

  if (!proposal) return null;

  const masterItems = Array.isArray(proposal.masterItems)
    ? proposal.masterItems.filter(Boolean)
    : [];

  const client = proposal.clientId || {};
  const agency = proposal.agencyId || proposal.adminId || proposal.createdBy || {};

  const projectName = proposal.name || "Proposal";
  const proposalDate = formatDate(proposal.proposalDate || proposal.createdAt);
  const clientName = client.companyName || client.name || "Name";
  const clientEmail = client.email || "Email";
  const clientAddress = formatAddress(client.address) || "Address";
  const agencyName = agency.companyName || agency.name || "Your Company Name";
  const agencyWebsite = formatWebsiteLabel(agency.domain);
  const agencyWebsiteUrl = toWebsiteUrl(agency.domain);
  const agencyPhone = agency.supportPhone || agency.phone || "+00 000 000";
  const description = buildDescription(projectName, masterItems);
  const scopeBullets = buildScopeBullets(masterItems);
  const deliverableBullets = buildDeliverableBullets(masterItems);
  const timelineText = buildTimelineText(masterItems);
  const grandTotal = formatCurrency(proposal.grandTotal || 0);
  const searchImageUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(
    projectName || clientName || agencyName || "proposal",
  )}`;

  return (
    <div className="proposal-stage">
      <article className="proposal-sheet">
        <div className="proposal-top">
          <div className="proposal-top__left">
            <div className="proposal-top__eyebrow">Project</div>
            <Title level={1} className="proposal-top__title">
              Proposal
            </Title>

            <div className="proposal-top__meta">
              <div className="proposal-top__meta-item">
                <span className="proposal-top__meta-label">Date:</span>
                <span className="proposal-top__meta-value">{proposalDate}</span>
              </div>

              <div className="proposal-top__meta-item proposal-top__meta-item--right">
                <span className="proposal-top__meta-label">Project Name</span>
                <span className="proposal-top__meta-value proposal-top__meta-value--strong">
                  {projectName}
                </span>
              </div>
            </div>
          </div>

          <div className="proposal-company">
            <div className="proposal-company__label">Company Info:</div>
            <div className="proposal-company__value">{clientName}</div>
            <div className="proposal-company__value">{clientEmail}</div>
            <div className="proposal-company__value">{clientAddress}</div>
          </div>
        </div>

        <section className="proposal-section">
          <div className="proposal-section__title">Description</div>
          <p className="proposal-section__body">{description}</p>
        </section>

        <section className="proposal-section">
          <div className="proposal-section__title">Work Scope</div>
          <ul className="proposal-section__list">
            {scopeBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>

        <section className="proposal-section">
          <div className="proposal-section__title">Deliverables</div>
          <div className="proposal-section__note">We will provide the following</div>
          <ul className="proposal-section__list">
            {deliverableBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </section>

        <section className="proposal-section">
          <div className="proposal-section__title">Timeline</div>
          <div className="proposal-section__body">{timelineText}</div>
        </section>

        <section className="proposal-section proposal-section--investment">
          <div className="proposal-section__title">Investment</div>
          <div className="proposal-investment__amount">{grandTotal}</div>
        </section>

        <footer className="proposal-footer">

          <div className="proposal-footer__right">
            <div className="proposal-footer__contact">
              <div
                style={{
                  width: 140,
                  height: 56,
                  marginBottom: 8,
                  position: "relative",
                }}
              >
                {agency.invoiceSignature && (
                  <img
                    src={agency.invoiceSignature}
                    alt="Signature"
                    style={{
                      position: "absolute",
                      left: 10,
                      bottom: 4,
                      maxHeight: 60,
                      maxWidth: 120,
                      objectFit: "contain",
                    }}
                  />
                )}
              </div>
              <div style={{ fontWeight: 600, fontSize: "14px", marginTop: 4, textAlign: 'center', width: 140 }}>
                Signature
              </div>
            </div>
          </div>
        </footer>
      </article>

      <style>{`
        .proposal-stage {
          display: flex;
          justify-content: center;
          padding: 24px 16px 36px;
          overflow: hidden;
        }

        .proposal-sheet {
          position: relative;
          display: flex;
          flex-direction: column;
          width: min(100%, 760px);
          min-height: min(90vh, 980px);
          padding: clamp(30px, 4vw, 50px);
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 34px;
          background: #ffffff;
          color: #101010;
          box-shadow:
            0 30px 80px rgba(0, 0, 0, 0.38),
            0 1px 0 rgba(255, 255, 255, 0.65) inset;
          overflow: hidden;
          gap: 26px;
        }

        .proposal-top {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 220px;
          gap: 28px;
          align-items: start;
        }

        .proposal-top__left {
          min-width: 0;
        }

        .proposal-top__eyebrow {
          margin-bottom: 12px;
          color: #2b2b2b;
          font-size: 18px;
          font-weight: 400;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          line-height: 1;
        }

        .proposal-top__title.ant-typography {
          margin: 0;
          color: #111111;
          font-size: clamp(58px, 9vw, 80px);
          font-weight: 900;
          letter-spacing: -0.08em;
          line-height: 0.9;
        }

        .proposal-top__meta {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 20px;
          margin-top: 12px;
          align-items: end;
        }

        .proposal-top__meta-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .proposal-top__meta-item--right {
          align-items: flex-end;
          text-align: right;
        }

        .proposal-top__meta-label {
          color: #1e1e1e;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .proposal-top__meta-value {
          color: #4a4a4a;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.35;
          word-break: break-word;
        }

        .proposal-top__meta-value--strong {
          color: #111111;
          font-weight: 700;
        }

        .proposal-company {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          min-width: 0;
          text-align: right;
        }

        .proposal-company__label {
          margin-bottom: 8px;
          color: #2c2c2c;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .proposal-company__value {
          color: #444444;
          font-size: 12px;
          line-height: 1.35;
          word-break: break-word;
        }

        .proposal-section {
          max-width: 660px;
        }

        .proposal-section__title {
          margin-bottom: 6px;
          color: #1b1b1b;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .proposal-section__body {
          margin: 0;
          color: #515151;
          font-size: 13px;
          line-height: 1.45;
        }

        .proposal-section__note {
          margin-bottom: 6px;
          color: #555555;
          font-size: 13px;
          line-height: 1.45;
        }

        .proposal-section__list {
          margin: 0;
          padding-left: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          color: #4a4a4a;
        }

        .proposal-section__list li {
          font-size: 13px;
          line-height: 1.4;
        }

        .proposal-section--investment {
          margin-bottom: 4px;
        }

        .proposal-investment__amount {
          color: #111111;
          font-size: clamp(30px, 4vw, 38px);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
        }

        .proposal-footer {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 24px;
          align-items: end;
          margin-top: auto;
          padding-top: 8px;
        }

        .proposal-footer__left {
          display: flex;
          align-items: flex-end;
        }

        .proposal-footer__right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
          text-align: right;
        }

        .proposal-footer__contact {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .proposal-footer__company {
          color: #1f1f1f;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.2;
        }

        .proposal-footer__domain,
        .proposal-footer__phone {
          color: #555555;
          font-size: 12px;
          line-height: 1.2;
        }

        .proposal-cta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          min-height: 46px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          background: rgba(255, 255, 255, 0.94);
          color: #111111;
          text-decoration: none;
          font-size: 15px;
          font-weight: 700;
          line-height: 1;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease;
          white-space: nowrap;
        }

        .proposal-cta svg {
          font-size: 16px;
        }

        .proposal-cta:hover {
          transform: translateY(-1px);
          background: #ffffff;
          border-color: rgba(15, 23, 42, 0.14);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
        }

        .proposal-cta--secondary {
          min-width: 156px;
          justify-content: center;
        }

        .proposal-cta--disabled {
          opacity: 0.45;
          cursor: default;
          pointer-events: none;
        }

        @media (max-width: 900px) {
          .proposal-stage {
            padding: 18px 12px 28px;
          }

          .proposal-sheet {
            width: 100%;
            min-height: auto;
            border-radius: 28px;
            gap: 22px;
          }

          .proposal-top {
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .proposal-company {
            align-items: flex-start;
            text-align: left;
          }

          .proposal-top__meta {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .proposal-top__meta-item--right {
            align-items: flex-start;
            text-align: left;
          }

          .proposal-section {
            max-width: 100%;
          }

          .proposal-footer {
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .proposal-footer__right {
            align-items: flex-start;
            text-align: left;
          }
        }

        @media (max-width: 640px) {
          .proposal-sheet {
            padding: 22px 18px 20px;
          }

          .proposal-top__eyebrow {
            font-size: 14px;
            letter-spacing: 0.14em;
          }

          .proposal-top__title.ant-typography {
            font-size: clamp(46px, 18vw, 64px);
          }

          .proposal-top__meta-label,
          .proposal-company__label,
          .proposal-section__title {
            font-size: 11px;
          }

          .proposal-section__body,
          .proposal-section__note,
          .proposal-section__list li,
          .proposal-top__meta-value,
          .proposal-company__value {
            font-size: 12px;
          }

          .proposal-cta {
            min-height: 44px;
            font-size: 14px;
          }

          .proposal-cta--secondary {
            min-width: 0;
            width: fit-content;
          }
        }

        @media print {
          .proposal-stage {
            background: #ffffff !important;
            padding: 0 !important;
          }

          .proposal-sheet {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .proposal-cta {
            box-shadow: none !important;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ProfessionalProposal;
