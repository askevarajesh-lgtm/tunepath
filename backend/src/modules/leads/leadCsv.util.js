/**
 * Minimal CSV parse/stringify for lead import/export (RFC4180-style quotes).
 */

const normalizeNewlines = (text) =>
  String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

const parseCsv = (text) => {
  const s = normalizeNewlines(text);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      if (row.some((x) => String(x).trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((x) => String(x).trim() !== "")) {
    rows.push(row);
  }
  return rows;
};

const escapeCsvField = (value) => {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const EXPORT_HEADERS = [
  "Name",
  "Phone Number",
  "Email",
  "Lead Date",
  "Form Name",
  "Lead Source",
  "Status",
  "Assigned To",
  "Assigned Department",
  "Notes",
];

const fullNameFromLead = (lead) => {
  const fn = (lead.fullName && String(lead.fullName).trim()) || "";
  if (fn) return fn;
  const legacy = `${lead.firstName || ""} ${lead.lastName || ""}`.trim();
  return legacy || "";
};

const phoneFromLead = (lead) => {
  const p = (lead.phoneNumber && String(lead.phoneNumber).trim()) || "";
  if (p) return p;
  return (lead.mobile && String(lead.mobile).trim()) || "";
};

const formatLeadDate = (lead) => {
  const customDate = lead?.customData?.created_time || lead?.customData?.createdTime || lead?.customData?.createdtime;
  const dateStr = customDate || lead?.createdAt;
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const getFormName = (lead) => {
  return lead?.customData?.form_name || lead?.customData?.formName || lead?.formName || "";
};

const leadsToCsv = (leads) => {
  const lines = [EXPORT_HEADERS.join(",")];
  for (const lead of leads) {
    const row = [
      fullNameFromLead(lead),
      phoneFromLead(lead),
      (lead.email && String(lead.email).trim()) || "",
      formatLeadDate(lead),
      (getFormName(lead) && String(getFormName(lead)).trim()) || "",
      (lead.source && String(lead.source).trim()) || "",
      (lead.status && String(lead.status).trim()) || "new",
      (lead.assignedTo && String(lead.assignedTo).trim()) || "",
      (lead.assignedDepartment && String(lead.assignedDepartment).trim()) || "",
      (lead.notes && String(lead.notes).trim()) || "",
    ].map(escapeCsvField);
    lines.push(row.join(","));
  }
  return lines.join("\n");
};

const normalizeHeaderKey = (h) =>
  String(h || "")
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ");

/** Maps normalized header label -> canonical field key */
const HEADER_TO_FIELD = {
  name: "fullName",
  "full name": "fullName",
  fullname: "fullName",
  "first name": "fullName",
  firstname: "fullName",
  "last name": "lastName",
  lastname: "lastName",
  "customer name": "fullName",
  "client name": "fullName",
  "lead name": "fullName",
  "contact name": "fullName",
  "company name": "companyName",
  companyname: "companyName",
  company: "companyName",
  organization: "companyName",
  org: "companyName",
  "phone number": "phoneNumber",
  phonenumber: "phoneNumber",
  phone: "phoneNumber",
  mobile: "phoneNumber",
  "mobile number": "phoneNumber",
  "contact number": "phoneNumber",
  contact: "phoneNumber",
  tel: "phoneNumber",
  telephone: "phoneNumber",
  email: "email",
  "e mail": "email",
  "email address": "email",
  "project type": "projectType",
  projecttype: "projectType",
  project: "projectType",
  service: "projectType",
  "lead source": "source",
  source: "source",
  "lead date": "leadDate",
  date: "leadDate",
  "created date": "leadDate",
  "created time": "leadDate",
  createdtime: "leadDate",
  created_time: "leadDate",
  "form name": "formName",
  formname: "formName",
  form: "formName",
  status: "status",
  "lead status": "status",
  "assigned to": "assignedTo",
  assignedto: "assignedTo",
  assigned: "assignedTo",
  owner: "assignedTo",
  bde: "assignedTo",
  "assigned department": "assignedDepartment",
  assigneddepartment: "assignedDepartment",
  department: "assignedDepartment",
  dept: "assignedDepartment",
  notes: "notes",
  note: "notes",
  message: "notes",
  comments: "notes",
  description: "notes",
};

const ALLOWED_STATUS = new Set([
  "new",
  "in_progress",
  "follow_up",
  "contacted",
  "converted",
  "closed",
  "lost",
  "junk",
  "hot",
  "warm",
  "cold",
]);

const normalizeStatus = (raw) => {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, "_");
  if (ALLOWED_STATUS.has(t)) return t;
  const compact = t.replace(/_/g, "");
  if (compact === "inprogress") return "in_progress";
  if (compact === "followup") return "follow_up";
  return null;
};

const buildHeaderIndexMap = (headerRow) => {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const key = HEADER_TO_FIELD[normalizeHeaderKey(cell)];
    if (key && map[key] === undefined) {
      map[key] = idx;
    }
  });
  return map;
};

const cellAt = (row, colMap, field, required) => {
  const idx = colMap[field];
  if (idx === undefined) {
    return required ? undefined : "";
  }
  const v = row[idx];
  return v === undefined || v === null ? "" : String(v).trim();
};

module.exports = {
  parseCsv,
  leadsToCsv,
  EXPORT_HEADERS,
  buildHeaderIndexMap,
  cellAt,
  normalizeStatus,
};
