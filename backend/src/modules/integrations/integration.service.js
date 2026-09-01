const Integration = require("./integration.model");
const logger = console;
const whatsappService = require("../../utils/whatsapp.service");
const twilioService = require("../../utils/twilio.service");
const sendpulseService = require("../../utils/sendpulse.service");
const axios = require("axios");
const User = require("../auth/user.model");
const Company = User;
const {
  resolveCompanyIntegrations,
} = require("../../utils/companyIntegrations");
const leadService = require("../leads/lead.service");
const Lead = require("../leads/lead.model");
const ClientCompany = User;
const {
  getEffectivePackageIntegrations,
} = require("../packages/packageAccess.service");
const { isSupportedProductIntegration } = require("../../utils/supportedIntegrations");

const assertIntegrationEnabledForCompany = async (
  companyId,
  integrationType,
) => {
  if (!companyId || !integrationType) return;

  const company = await Company.findById(companyId)
    .select("name integrations")
    .lean();
  if (!company) {
    throw new Error("Company not found for integration validation");
  }

  const integrations = await resolveCompanyIntegrations(company);
  if (!integrations[integrationType]) {
    throw new Error(
      `${integrationType.toUpperCase()} integration is disabled for this company by Super Admin.`,
    );
  }
};

// Roles that manage/configure integrations and packages at the platform
// level. These roles are never restricted by Package-level entitlement --
// they're the ones assigning packages/integrations to everyone else.
// Mirrors the identical bypass list already used throughout this file for
// the existing companyId-scoping logic (see getAllIntegrations, etc).
const PLATFORM_ADMIN_ROLES = [
  "super_admin",
  "supreme_super_admin",
  "commander_admin",
];

/**
 * Package-level entitlement guard (Layer 2 -- see
 * backend/src/modules/packages/packageAccess.service.js and
 * backend/src/utils/integrationAccess.js for the two-layer model).
 *
 * Layer 1 (assertIntegrationEnabledForCompany / resolveCompanyIntegrations,
 * above) is untouched and still governs whether a company has an
 * integration "switched on" at all. This is an ADDITIONAL, independent
 * check: does the Package assigned to the requesting user's company permit
 * this integration type to be used, regardless of whether it's configured?
 *
 * Platform admins (PLATFORM_ADMIN_ROLES) are never restricted here -- they
 * are the ones who configure integrations/packages for everyone else, so
 * package entitlement is not meaningful for their own requests.
 *
 * A package that doesn't resolve, or has no `integrations` set (legacy
 * packages predating this feature), is treated as an empty entitlement list
 * -- i.e. no integrations allowed -- for any consuming (non-admin) user.
 * This is a deliberate default-deny; existing agencies/brands must have
 * their packages explicitly backfilled with `integrations` for their
 * currently-configured integrations to keep working.
 */
const assertPackageEntitlement = async (user, role, integrationType) => {
  if (PLATFORM_ADMIN_ROLES.includes(role)) return;
  if (!integrationType) return;

  const allowed = await getEffectivePackageIntegrations(user);
  if (!allowed.includes(integrationType)) {
    throw new Error(
      `The "${integrationType}" integration is not included in your current package. Please contact your administrator to upgrade your plan.`,
    );
  }
};

const extractEmail = (record) => {
  if (!record || typeof record !== "object") return null;
  // Common direct fields
  const direct =
    record.email ||
    record.staffEmail ||
    record.employeeEmail ||
    record.userEmail ||
    record.mail ||
    record.emailId ||
    null;

  if (direct) return direct;

  // employeeId may be nested object for some Ekta response shapes
  const empId = record.employeeId;
  if (empId && typeof empId === "object") {
    return (
      empId.email ||
      empId.emailId ||
      empId.mail ||
      empId.userEmail ||
      empId.employeeEmail ||
      null
    );
  }

  return null;
};

const extractEmployeeCodeFromStaff = (record) => {
  if (!record || typeof record !== "object") return null;
  const empId = record.employeeId;
  if (!empId) return record.employeeCode || record.employee_id || null;
  if (typeof empId === "string") return empId;
  if (typeof empId === "object") return empId.employeeId || empId.code || null;
  return null;
};

const extractEmployeeCodeFromAttendance = (record) => {
  if (!record || typeof record !== "object") return null;
  const empId = record.employeeId;
  if (!empId) return record.employeeCode || record.employee_id || null;
  if (typeof empId === "string") return empId;
  if (typeof empId === "object") return empId.employeeId || empId.code || null;
  return null;
};

const getTenantUserEmails = async (companyId) => {
  if (!companyId) return null; // Return null to indicate no filtering (global)
  const query = {
    $or: [
      { _id: companyId },
      { agencyId: companyId },
      { brandId: companyId },
      { adminId: companyId },
    ],
  };
  const users = await User.find(query).select("email").lean();
  return new Set(
    users
      .map((u) => u?.email?.toLowerCase?.())
      .filter((e) => typeof e === "string" && e.length > 0),
  );
};

const filterStaffByTenantUsers = (staffArr, userEmailSet) => {
  if (!Array.isArray(staffArr)) return [];
  if (userEmailSet === null) return staffArr; // Skip filtering if global
  if (!userEmailSet || userEmailSet.size === 0) return [];

  return staffArr.filter((s) => {
    const email = extractEmail(s);
    if (!email) return false;
    return userEmailSet.has(email.toLowerCase());
  });
};

/**
 * Call Ekta HR API.
 * - Supports absolute URLs in endpoint, or relative paths appended to EKTA_BASE_URL.
 * - Uses both Authorization and x-api-key headers to maximize compatibility.
 */
const callEktaApi = async (endpoint, apiKey, params = {}) => {
  if (!endpoint) {
    throw new Error("Ekta endpoint is required");
  }

  const baseUrl = process.env.EKTA_BASE_URL || "";
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${baseUrl.replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (!url || !url.startsWith("http")) {
    throw new Error(
      `Ekta endpoint "${endpoint}" is not a full URL. Please set EKTA_BASE_URL in server env, or provide a full URL in the endpoint field.`,
    );
  }

  // Some Ekta endpoints are saved with `?from=...&to=...` already present.
  // axios won't always override existing query params.
  // Only strip these keys when we actually have replacement params,
  // otherwise we might accidentally remove the only date filter.
  const stripKeys = [
    "from",
    "to",
    "fromDate",
    "toDate",
    "startDate",
    "endDate",
    "dateFrom",
    "dateTo",
  ];
  let urlForRequest = url;
  try {
    const u = new URL(url);
    const shouldStrip = stripKeys.some((k) => params?.[k] !== undefined);
    if (shouldStrip) {
      stripKeys.forEach((k) => u.searchParams.delete(k));
      urlForRequest = u.toString();
    }
  } catch (e) {
    // If URL parsing fails, we fall back to the original url.
    urlForRequest = url;
  }

  const headers = {
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(apiKey ? { "x-api-key": apiKey } : {}),
    "Content-Type": "application/json",
  };

  // IMPORTANT: don't log apiKey. Only log url + non-sensitive params for debugging.
  try {
    if (process.env.NODE_ENV !== "production") {
      logger.info?.("Ekta API request", { url: urlForRequest, params });
    } else {
      // In production, still log to console (you can view it in terminal)
      // eslint-disable-next-line no-console
      console.log("[Ekta] GET", { url: urlForRequest, params });
    }

    const response = await axios.get(urlForRequest, { headers, params });
    return response.data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Ekta] GET failed", {
      url: urlForRequest,
      params,
      status: err?.response?.status,
      data: err?.response?.data,
      message: err?.message,
    });
    throw err;
  }
};

const getAllIntegrations = async (companyId, role, user) => {
  const query = {};

  // Super admin sees platform-level integrations (companyId: null)
  // Others see company-specific integrations
  if (["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    query.$or = [{ companyId: null }];
    if (companyId) query.$or.push({ companyId });
  } else {
    query.companyId = companyId;
    if (role === "user" && user.brandId) {
      query.ownerId = user._id; // Sub-users only see their own integrations
    } else {
      // Admins see all company integrations (ownerId: null or anything)
      // We don't filter by ownerId, so they see sub-users' integrations too
    }
  }

  const integrations = await Integration.find(query).sort({ type: 1 });
  
  // Enforce PRODUCT integration filter for product-level listing API
  const productIntegrations = integrations.filter(integration => 
    isSupportedProductIntegration(integration.type)
  );

  if (["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    // Platform admins configure integrations/packages themselves -- never
    // restricted by either the company-level gate below or Package-level
    // entitlement (Layer 2, applied further down for consuming users only).
    return productIntegrations;
  }


  const company = await Company.findById(companyId)
    .select("name integrations")
    .lean();
  if (!company) {
    return [];
  }
  const allowed = await resolveCompanyIntegrations(company);
  const companyFiltered = productIntegrations.filter((integration) => {
    if (integration.type === 'facebook_leads') {
      return Boolean(allowed['website']);
    }
    return Boolean(allowed[integration.type]);
  });

  // Layer 2 -- Package-level entitlement: intersect with whatever the
  // requesting user's effective Package (`Package.integrations`, snapshotted
  // onto `User.integrations` at agency/brand assignment time) permits. Both
  // this layer and the company-level gate above must pass for an integration
  // to be returned. See packageAccess.service.js / integrationAccess.js.
  const packageIntegrations = await getEffectivePackageIntegrations(user);
  return companyFiltered.filter((integration) => {
    // If the integration is facebook_leads, it's governed by the 'website' package entitlement
    if (integration.type === 'facebook_leads') {
      return packageIntegrations.includes('website');
    }
    return packageIntegrations.includes(integration.type);
  });
};

const getPaymentIntegration = async (companyId) => {
  const query = { type: 'payment' };
  if (companyId && companyId !== 'null') {
    query.companyId = companyId;
  } else {
    query.companyId = null;
  }
  const integration = await Integration.findOne(query);
  return integration;
};

const createIntegration = async (integrationData, companyId, role, user) => {
  // Reject unsupported PRODUCT integration types
  if (!isSupportedProductIntegration(integrationData.type)) {
    throw new Error(`Unsupported integration type: ${integrationData.type}`);
  }

  // Only super admin can create platform-level integrations
  if (integrationData.companyId === null && !["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    throw new Error("Only super admin can create platform-level integrations");
  }

  const finalCompanyId =
    ["super_admin", "supreme_super_admin", "commander_admin"].includes(role) && (integrationData.companyId === null || integrationData.companyId === undefined)
      ? null
      : (integrationData.companyId !== undefined ? integrationData.companyId : companyId);

  if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    await assertIntegrationEnabledForCompany(
      finalCompanyId,
      integrationData.type,
    );
    // Layer 2 -- a consuming agency/brand cannot create (self-configure) an
    // integration type their Package doesn't entitle them to, even though
    // the company-level gate above passed.
    await assertPackageEntitlement(user, role, integrationData.type);
  }

  // Prevent duplicate payment integrations - upsert if one already exists
  if (integrationData.type === 'payment') {
    const existing = await Integration.findOne({ type: 'payment', companyId: finalCompanyId });
    if (existing) {
      Object.assign(existing, { ...integrationData, companyId: finalCompanyId });
      existing.markModified('config');
      await existing.save();
      return existing;
    }
  }

  return await Integration.create({
    ...integrationData,
    companyId: finalCompanyId,
  });
};

const updateIntegration = async (
  integrationId,
  integrationData,
  companyId,
  role,
  user,
) => {
  const query = { _id: integrationId };

  if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    query.companyId = companyId;
  }

  const integration = await Integration.findOne(query);
  if (!integration) {
    throw new Error("Integration not found");
  }

  // Reject modifications to non-product integrations through the generic API
  if (!isSupportedProductIntegration(integration.type)) {
    throw new Error(`Cannot modify internal provider via product integration API: ${integration.type}`);
  }

  if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    await assertIntegrationEnabledForCompany(companyId, integration.type);
    // Layer 2 -- blocks a consuming user from toggling/editing (e.g.
    // isActive: true) an integration their Package no longer/never
    // entitles them to, even via a direct PUT /integrations/:id call.
    await assertPackageEntitlement(user, role, integration.type);
  }

  Object.assign(integration, integrationData);
  if (integrationData.config !== undefined) {
    integration.markModified('config');
  }
  
  // Auto-populate missing required name to prevent Mongoose validation errors on legacy records
  if (!integration.name) {
    integration.name = integration.type 
      ? integration.type.charAt(0).toUpperCase() + integration.type.slice(1) + " Integration" 
      : "Unnamed Integration";
  }

  await integration.save();

  return integration;
};

/**
 * Fetch WhatsApp templates from the configured backend
 */
const fetchWhatsAppTemplates = async (integrationId, companyId, role, user) => {
  const query = { _id: integrationId, type: "whatsapp" };

  if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    query.companyId = companyId;
  } else {
    query.companyId = null;
  }

  const integration = await Integration.findOne(query);
  if (!integration) {
    throw new Error("WhatsApp integration not found");
  }
  if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    await assertIntegrationEnabledForCompany(companyId, integration.type);
    await assertPackageEntitlement(user, role, integration.type);
  }

  if (!integration.config?.backendUrl || !integration.config?.apiToken) {
    throw new Error(
      "WhatsApp integration not configured. Please configure backend URL and API token.",
    );
  }

  try {
    const templates = await whatsappService.fetchTemplates(
      integration.config.backendUrl,
      integration.config.apiToken,
    );

    logger.info(
      `Fetched ${templates?.length || 0} templates from WhatsApp API`,
    );

    // Update integration with fetched templates
    if (!integration.config.templates) {
      integration.config.templates = [];
    }

    // If we got templates, merge them with existing ones (preserve configured mappings)
    if (templates && Array.isArray(templates) && templates.length > 0) {
      // Ensure templates array exists
      if (
        !integration.config.templates ||
        !Array.isArray(integration.config.templates)
      ) {
        integration.config.templates = [];
      }

      const existingTemplateIds = integration.config.templates.map((t) =>
        String(t.id || ""),
      );
      templates.forEach((template) => {
        // Handle the actual API response structure with components
        const templateId = template.id;
        const templateName = template.name;
        const templateCategory = template.category;
        const templateStatus = template.status;
        const templateLanguage = template.language;

        // Extract variables from BODY components
        const bodyComponent = template.components?.find(
          (c) => c.type === "BODY",
        );
        const bodyText = bodyComponent?.text || "";

        // Extract numbered variables like {{1}}, {{2}}
        const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
        const extractedVariables = variableMatches.map((match) => {
          const num = match.replace(/\{\{|\}\}/g, "");
          return parseInt(num);
        });

        const templateIdStr = String(templateId || "");
        if (templateId && !existingTemplateIds.includes(templateIdStr)) {
          integration.config.templates.push({
            id: templateId,
            name: templateName,
            category: templateCategory,
            status: templateStatus,
            language: templateLanguage,
            bodyText: bodyText,
            variables: extractedVariables,
            components: template.components || [],
          });
        } else if (templateId && existingTemplateIds.includes(templateIdStr)) {
          // Update existing template with latest data
          const existingIndex = integration.config.templates.findIndex(
            (t) => String(t.id || "") === templateIdStr || t.id === templateId,
          );
          if (existingIndex !== -1) {
            integration.config.templates[existingIndex] = {
              ...integration.config.templates[existingIndex],
              id: templateId,
              name: templateName,
              category: templateCategory,
              status: templateStatus,
              language: templateLanguage,
              bodyText: bodyText,
              variables: extractedVariables,
              components: template.components || [],
            };
          }
        }
      });

      await integration.save();
      logger.info(`Updated integration with ${templates.length} templates`);
    } else {
      logger.warn(
        "No templates found in API response. Returning existing templates if any.",
      );
    }

    // Return fetched templates or existing ones
    return templates && templates.length > 0
      ? templates
      : integration.config?.templates || [];
  } catch (error) {
    logger.error("Error fetching WhatsApp templates:", error);

    // If templates endpoint doesn't exist, return existing templates instead of throwing
    if (
      error.message?.includes("Template endpoint not found") ||
      error.message?.includes("not have a templates API")
    ) {
      logger.warn("Template API not available, returning existing templates");
      return integration.config?.templates || [];
    }

    throw error;
  }
};

const testTwilioConnection = async (payload) => {
  const { accountSid, authToken } = payload;
  if (!accountSid || !authToken) {
    throw new Error("Account SID and Auth Token are required");
  }
  
  const numbers = await twilioService.testConnection(accountSid, authToken);
  return { success: true, numbers };
};

const saveTwilioIntegration = async (companyId, role, user, payload) => {
  const { accountSid, authToken, phoneNumber } = payload;
  if (!accountSid || !authToken || !phoneNumber) {
    throw new Error("Account SID, Auth Token, and Phone Number are required");
  }

  // Layer 2 -- block save if not entitled to SMS
  await assertPackageEntitlement(user, role, "sms");

  const scopedCompanyId = ["super_admin", "supreme_super_admin", "commander_admin"].includes(role)
    ? null
    : companyId;

  const query = { type: "sms", companyId: scopedCompanyId };
  let integration = await Integration.findOne(query);

  const config = {
    accountSid,
    authToken, // Might want to encrypt in future, but for now store as is (similar to other configs)
    phoneNumber
  };

  if (integration) {
    integration.config = config;
    integration.isActive = true;
    integration.markModified("config");
    await integration.save();
  } else {
    integration = await Integration.create({
      name: "Twilio SMS Integration",
      type: "sms",
      companyId: scopedCompanyId,
      isActive: true,
      config
    });
  }

  return integration;
};

const getTwilioIntegration = async (companyId, role, user) => {
  const scopedCompanyId = ["super_admin", "supreme_super_admin", "commander_admin"].includes(role)
    ? null
    : companyId;

  const integration = await Integration.findOne({ type: "sms", companyId: scopedCompanyId });

  if (!integration || !integration.config || !integration.config.accountSid) {
    return { success: false, isConnected: false };
  }

  return {
    success: true,
    isConnected: true,
    accountSid: integration.config.accountSid,
    authToken: integration.config.authToken, // Return masked token if needed, or real one to populate form
    phoneNumber: integration.config.phoneNumber
  };
};

/**
 * Validate Ekta HR API and create/update the Ekta integration document.
 * Note: Actual external API calls are not implemented yet; this stores credentials and returns capabilities.
 */
const validateEktaApi = async (payload, companyId, role, user) => {
  const { integrationId, apiKey } = payload || {};

  if (!apiKey) {
    throw new Error("Ekta API Key is required");
  }

  // Determine the scoped companyId for this role
  const scopedCompanyId = ["super_admin", "supreme_super_admin", "commander_admin"].includes(role)
    ? null
    : companyId;

  // Layer 2 -- a consuming agency/brand can't (re)configure the Ekta HR
  // integration unless their Package entitles them to it.
  await assertPackageEntitlement(user, role, "ekta");

  // Helper: merge config preserving staff/attendance settings
  const buildConfig = (existing) => ({
    ...(existing?.config || {}),
    api: { apiKey },
    staff: {
      ...(existing?.config?.staff || {}),
      ...(payload?.staff || {}),
    },
    attendance: {
      ...(existing?.config?.attendance || {}),
      ...(payload?.attendance || {}),
    },
  });

  // ── 1. Try to find by explicit integrationId first ──────────────────────────
  if (integrationId) {
    const query = { _id: integrationId, type: "ekta" };
    // Non-privileged roles must also match their companyId
    if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
      query.companyId = companyId;
    }

    const integration = await Integration.findOne(query);
    if (!integration) {
      throw new Error("Ekta integration not found");
    }

    integration.config = buildConfig(integration);
    integration.isActive = true;
    integration.markModified("config");
    await integration.save();
    return integration;
  }

  // ── 2. No integrationId — find ANY existing Ekta integration ──────────────
  //    We search WITHOUT companyId filter because the record might have been
  //    stored with a non-null companyId (e.g. workspaceId) on a previous save.
  //    If we find one, update it and re-scope the companyId to the correct value.
  const existing = await Integration.findOne({ type: "ekta" }).sort({ createdAt: -1 });

  if (existing) {
    existing.config = buildConfig(existing);
    existing.isActive = true;
    existing.companyId = scopedCompanyId; // re-scope to the correct tenant
    existing.markModified("config");
    await existing.save();
    return existing;
  }

  // ── 3. Nothing found — create fresh record, with E11000 safety net ──────────
  //    A stale unique index (e.g. integrationId_1) may be present in MongoDB from
  //    a previous schema version. If the INSERT fails with a duplicate key error we
  //    do one final fallback findOne to grab whatever already exists and update it.
  try {
    const created = await Integration.create({
      name: "Ekta HR Integration",
      type: "ekta",
      companyId: scopedCompanyId,
      isActive: true,
      config: {
        api: { apiKey },
        staff: { enabled: false, endpoint: null },
        attendance: { enabled: false, endpoint: null },
      },
    });
    return created;
  } catch (createErr) {
    // E11000 — stale index or race condition: fetch whatever is there and update
    if (createErr.code === 11000) {
      const fallback = await Integration.findOne({ type: "ekta" }).sort({ createdAt: -1 });
      if (fallback) {
        fallback.config = buildConfig(fallback);
        fallback.isActive = true;
        fallback.companyId = scopedCompanyId;
        fallback.markModified("config");
        await fallback.save();
        return fallback;
      }
    }
    throw createErr;
  }
};

/**
 * Sync Ekta staff data (stub implementation).
 * Stores the endpoint + updates lastSyncedAt.
 */
const syncEktaStaff = async (integrationId, payload, companyId, role, user) => {
  const { endpoint, fromDate, toDate, limit, offset, page, pageSize } =
    payload || {};
  if (!endpoint) {
    throw new Error("Ekta Staff endpoint is required");
  }

  const query = { _id: integrationId, type: "ekta" };
  if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    query.companyId = companyId;
  }

  const integration = await Integration.findOne(query);
  if (!integration) {
    throw new Error("Ekta integration not found");
  }
  if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    await assertIntegrationEnabledForCompany(companyId, integration.type);
    await assertPackageEntitlement(user, role, integration.type);
  }

  const apiKey = integration.config?.api?.apiKey;
  if (!apiKey) {
    throw new Error("Ekta API key not found in integration config");
  }

  const params = {
    ...(fromDate ? { fromDate, from: fromDate } : {}),
    ...(toDate ? { toDate, to: toDate } : {}),
    ...(fromDate ? { startDate: fromDate } : {}),
    ...(toDate ? { endDate: toDate } : {}),
    ...(fromDate ? { dateFrom: fromDate } : {}),
    ...(toDate ? { dateTo: toDate } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(offset !== undefined ? { offset } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
  };

  const data = await callEktaApi(endpoint, apiKey, params);

  // External Ekta APIs may wrap arrays differently (e.g. `data.staff`, `data.data.staff`).
  // We must always extract the first ARRAY so the frontend AntD `Table` doesn't crash.
  let items = null;
  if (Array.isArray(data)) items = data;
  else if (Array.isArray(data?.staff)) items = data.staff;
  else if (Array.isArray(data?.employees)) items = data.employees;
  else if (Array.isArray(data?.results)) items = data.results;
  else if (Array.isArray(data?.items)) items = data.items;
  else if (data?.data) {
    const inner = data.data;
    if (Array.isArray(inner)) items = inner;
    else if (Array.isArray(inner?.staff)) items = inner.staff;
    else if (Array.isArray(inner?.employees)) items = inner.employees;
    else if (Array.isArray(inner?.results)) items = inner.results;
    else if (Array.isArray(inner?.items)) items = inner.items;
  }

  // Tenant email match filtering:
  // Ekta staff record is returned only if its email exists in User Management (tenant scoped).
  // Use integration.companyId to ensure we filter emails from the same tenant
  // that owns the integration record.
  const userEmailSet = await getTenantUserEmails(integration.companyId);
  const filteredItems = filterStaffByTenantUsers(items, userEmailSet);
  const matchedEmployeeCodes = Array.from(
    new Set(
      (filteredItems || [])
        .map((s) => extractEmployeeCodeFromStaff(s))
        .filter((code) => typeof code === "string" && code.length > 0),
    ),
  );
  const filteredPresent = matchedEmployeeCodes.length > 0;

  // Debug: if Ekta returned staff records but none matched tenant users,
  // log the shape so we can adjust email extraction.
  if (Array.isArray(items) && items.length > 0 && filteredItems.length === 0) {
    const sample = items[0];
    const sampleEmail = extractEmail(sample);
    // eslint-disable-next-line no-console
    console.log("[EktaMatch][staff]", {
      fetchedCount: items.length,
      tenantUserEmailCount: userEmailSet?.size || 0,
      matchedCount: 0,
      sampleHasEmail: Boolean(sampleEmail),
      sampleKeys:
        sample && typeof sample === "object"
          ? Object.keys(sample).slice(0, 10)
          : [],
    });
  }

  integration.isActive = true;
  integration.config = {
    ...(integration.config || {}),
    staff: {
      ...(integration.config?.staff || {}),
      enabled: true,
      endpoint,
      lastSyncedAt: new Date(),
      present: filteredPresent,
      matchedEmployeeCodes,
    },
  };

  await integration.save();

  const originalPagination =
    data?.pagination ||
    data?.data?.pagination ||
    data?.meta?.pagination ||
    null;
  const pagination =
    originalPagination && typeof originalPagination === "object"
      ? { ...originalPagination, total: filteredItems.length }
      : originalPagination;

  return {
    success: true,
    present: filteredPresent,
    staff: filteredItems || [],
    pagination,
    staffSyncedAt: integration.config.staff.lastSyncedAt,
  };
};

/**
 * Sync Ekta attendance data (stub implementation).
 * Stores the endpoint + updates lastSyncedAt.
 */
const syncEktaAttendance = async (integrationId, payload, companyId, role, user) => {
  const { endpoint, fromDate, toDate, limit, offset, page, pageSize } =
    payload || {};
  if (!endpoint) {
    throw new Error("Ekta Attendance endpoint is required");
  }

  const query = { _id: integrationId, type: "ekta" };
  if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    query.companyId = companyId;
  }

  const integration = await Integration.findOne(query);
  if (!integration) {
    throw new Error("Ekta integration not found");
  }
  if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) {
    await assertIntegrationEnabledForCompany(companyId, integration.type);
    await assertPackageEntitlement(user, role, integration.type);
  }

  const apiKey = integration.config?.api?.apiKey;
  if (!apiKey) {
    throw new Error("Ekta API key not found in integration config");
  }

  const params = {
    ...(fromDate ? { fromDate, from: fromDate } : {}),
    ...(toDate ? { toDate, to: toDate } : {}),
    ...(fromDate ? { startDate: fromDate } : {}),
    ...(toDate ? { endDate: toDate } : {}),
    ...(fromDate ? { dateFrom: fromDate } : {}),
    ...(toDate ? { dateTo: toDate } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(offset !== undefined ? { offset } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(pageSize !== undefined ? { pageSize } : {}),
  };

  const data = await callEktaApi(endpoint, apiKey, params);

  // External Ekta APIs may wrap arrays differently (e.g. `data.attendance`, `data.data.attendance`).
  // Extract only the first ARRAY.
  let items = null;
  if (Array.isArray(data)) items = data;
  else if (Array.isArray(data?.attendance)) items = data.attendance;
  else if (Array.isArray(data?.records)) items = data.records;
  else if (Array.isArray(data?.results)) items = data.results;
  else if (Array.isArray(data?.items)) items = data.items;
  else if (data?.data) {
    const inner = data.data;
    if (Array.isArray(inner)) items = inner;
    else if (Array.isArray(inner?.attendance)) items = inner.attendance;
    else if (Array.isArray(inner?.records)) items = inner.records;
    else if (Array.isArray(inner?.results)) items = inner.results;
    else if (Array.isArray(inner?.items)) items = inner.items;
  }

  // Filter attendance to only the tenant-matched staff employees.
  // Prefer the employee codes that were already computed in `syncEktaStaff`
  // (so Attendance corresponds exactly to the Staff records fetched by email).
  const storedEmployeeCodes = Array.isArray(
    integration.config?.staff?.matchedEmployeeCodes,
  )
    ? integration.config.staff.matchedEmployeeCodes
    : [];
  let matchedEmployeeCodeSet = new Set(
    storedEmployeeCodes.filter((c) => typeof c === "string" && c.length > 0),
  );

  // If staff codes were not computed/stored, compute them now by fetching Ekta staff and filtering by tenant emails.
  if (matchedEmployeeCodeSet.size === 0) {
    const userEmailSet = await getTenantUserEmails(integration.companyId);

    const staffEndpoint = integration.config?.staff?.endpoint;
    if (staffEndpoint && userEmailSet.size > 0) {
      // Staff endpoint might internally require date params (especially if stored with `from/to`).
      // We pass the attendance page date range so URL conflicts are resolved consistently.
      const staffParams = {
        ...(fromDate
          ? {
              fromDate,
              from: fromDate,
              startDate: fromDate,
              dateFrom: fromDate,
            }
          : {}),
        ...(toDate
          ? { toDate, to: toDate, endDate: toDate, dateTo: toDate }
          : {}),
      };

      const staffApiData = await callEktaApi(
        staffEndpoint,
        apiKey,
        staffParams,
      );

      // Extract the first ARRAY from the staff API response
      let staffItems = null;
      if (Array.isArray(staffApiData)) staffItems = staffApiData;
      else if (Array.isArray(staffApiData?.staff))
        staffItems = staffApiData.staff;
      else if (Array.isArray(staffApiData?.employees))
        staffItems = staffApiData.employees;
      else if (Array.isArray(staffApiData?.results))
        staffItems = staffApiData.results;
      else if (Array.isArray(staffApiData?.items))
        staffItems = staffApiData.items;
      else if (staffApiData?.data) {
        const inner = staffApiData.data;
        if (Array.isArray(inner)) staffItems = inner;
        else if (Array.isArray(inner?.staff)) staffItems = inner.staff;
        else if (Array.isArray(inner?.employees)) staffItems = inner.employees;
        else if (Array.isArray(inner?.results)) staffItems = inner.results;
        else if (Array.isArray(inner?.items)) staffItems = inner.items;
      }

      const filteredStaffItems = filterStaffByTenantUsers(
        staffItems || [],
        userEmailSet,
      );
      matchedEmployeeCodeSet = new Set(
        filteredStaffItems
          .map((s) => extractEmployeeCodeFromStaff(s))
          .filter((code) => typeof code === "string" && code.length > 0),
      );
    }
  }

  const filteredAttendanceItems = Array.isArray(items)
    ? items.filter((rec) =>
        matchedEmployeeCodeSet.has(extractEmployeeCodeFromAttendance(rec)),
      )
    : [];

  const present = filteredAttendanceItems.length > 0;

  // Debug: if attendance returned but no records matched, log sample shape.
  if (
    Array.isArray(items) &&
    items.length > 0 &&
    filteredAttendanceItems.length === 0
  ) {
    const sample = items[0];
    const sampleEmpCode = extractEmployeeCodeFromAttendance(sample);
    // eslint-disable-next-line no-console
    console.log("[EktaMatch][attendance]", {
      fetchedCount: items.length,
      matchedEmployeeCodeCount: matchedEmployeeCodeSet.size,
      filteredCount: 0,
      sampleEmployeeCodePresent: Boolean(sampleEmpCode),
      sampleKeys:
        sample && typeof sample === "object"
          ? Object.keys(sample).slice(0, 10)
          : [],
    });
  }

  integration.isActive = true;
  integration.config = {
    ...(integration.config || {}),
    attendance: {
      ...(integration.config?.attendance || {}),
      enabled: true,
      endpoint,
      lastSyncedAt: new Date(),
      present,
    },
  };

  await integration.save();

  const originalPagination =
    data?.pagination ||
    data?.data?.pagination ||
    data?.meta?.pagination ||
    null;
  const pagination =
    originalPagination && typeof originalPagination === "object"
      ? { ...originalPagination, total: filteredAttendanceItems.length }
      : originalPagination;

  return {
    success: true,
    present,
    attendance: filteredAttendanceItems || [],
    pagination,
    attendanceSyncedAt: integration.config.attendance.lastSyncedAt,
  };
};

/**
 * Send message via integration
 */
const sendMessage = async (integrationId, messageData, companyId, role, user) => {
  const integration = await Integration.findOne({
    _id: integrationId,
    companyId: companyId || null,
    isActive: true,
  });

  if (!integration) {
    throw new Error("Integration not found or inactive");
  }
  await assertIntegrationEnabledForCompany(companyId, integration.type);
  // Layer 2 -- assertPackageEntitlement no-ops for platform admin roles
  // internally, so this is safe to call even when `role` is undefined
  // (falls through to the entitlement check, matching prior behavior for
  // any caller that isn't an explicit platform admin).
  await assertPackageEntitlement(user, role, integration.type);

  try {
    switch (integration.type) {
      case "whatsapp":
        if (!integration.config?.backendUrl || !integration.config?.apiToken) {
          throw new Error("WhatsApp integration not configured");
        }

        const { to, templateId, variables, message } = messageData;

        if (templateId) {
          // refreshing template name and language
          let templateName = templateId;
          let templateLanguage = "en"; // Default

          // Refresh integration from database to get latest templates
          const freshIntegration = await Integration.findById(integration._id);
          const templates =
            freshIntegration?.config?.templates ||
            integration.config?.templates ||
            [];

          logger.info(
            `Looking for template with ID "${templateId}" in ${templates.length} stored templates`,
          );

          if (templates && Array.isArray(templates) && templates.length > 0) {
            // Try to find by ID first (handle both string and number comparisons)
            let template = templates.find((t) => {
              const tId = String(t.id || "");
              const searchId = String(templateId || "");
              return tId === searchId || t.id === templateId;
            });

            // If not found by ID, try by name
            if (!template) {
              template = templates.find((t) => {
                const tName = String(t.name || "");
                const searchId = String(templateId || "");
                return tName === searchId || t.name === templateId;
              });
            }

            if (template) {
              if (template.name) {
                templateName = template.name;
                templateLanguage = template.language || "en";
                logger.info(
                  `✅ Found template name "${templateName}" and language "${templateLanguage}" for template ID "${templateId}"`,
                );
              } else {
                logger.warn(`Template found but has no name field.`);
              }
            } else {
              logger.warn(
                `❌ Template not found in stored templates for ID "${templateId}".`,
              );
            }
          } else {
            logger.warn(
              "No templates stored in integration config. Attempting to fetch template name from API...",
            );

            // Fallback: Try to fetch template name from API if not found in stored templates
            try {
              const apiTemplates = await whatsappService.fetchTemplates(
                integration.config.backendUrl,
                integration.config.apiToken,
              );

              if (apiTemplates && Array.isArray(apiTemplates)) {
                const apiTemplate = apiTemplates.find(
                  (t) =>
                    String(t.id || "") === String(templateId) ||
                    t.id === templateId,
                );

                if (apiTemplate && apiTemplate.name) {
                  templateName = apiTemplate.name;
                  templateLanguage = apiTemplate.language || "en";
                  logger.info(
                    `✅ Found template name "${templateName}" and language "${templateLanguage}" from API for template ID "${templateId}"`,
                  );

                  // Also save it for future use
                  if (
                    !integration.config.templates ||
                    !Array.isArray(integration.config.templates)
                  ) {
                    integration.config.templates = [];
                  }
                  integration.config.templates.push({
                    id: templateId,
                    name: templateName,
                    category: apiTemplate.category,
                    status: apiTemplate.status,
                    language: apiTemplate.language,
                  });
                  await integration.save();
                } else {
                  logger.warn(
                    `Template ID "${templateId}" not found in API templates either.`,
                  );
                }
              }
            } catch (fetchError) {
              logger.warn(
                `Failed to fetch templates from API as fallback: ${fetchError.message}`,
              );
            }
          }

          // Send template message
          const result = await whatsappService.sendMessage(
            integration.config.backendUrl,
            integration.config.apiToken,
            to,
            templateId,
            variables || {},
            {
              ...(messageData.options || {}),
              templateName: templateName,
              language: templateLanguage, // Pass language to service
            },
          );
          return {
            success: true,
            message: "WhatsApp message sent successfully",
            integrationType: integration.type,
            messageId: result.messageId,
          };
        } else if (message) {
          // Send custom message
          const result = await whatsappService.sendCustomMessage(
            integration.config.backendUrl,
            integration.config.apiToken,
            to,
            message,
            variables || {},
          );
          return {
            success: true,
            message: "WhatsApp message sent successfully",
            integrationType: integration.type,
            messageId: result.messageId,
          };
        } else {
          throw new Error("Either templateId or message is required");
        }

      case "email":
        // Email sending is handled separately via email.service.js
        // This is a placeholder for future direct email sending via integrations
        logger.info(`Email sending via integration`, {
          to: messageData.to,
          subject: messageData.subject,
        });
        return {
          success: true,
          message: "Email sent successfully",
          integrationType: integration.type,
        };

      case "sms":
        // SMS sending placeholder
        logger.info(`SMS sending via integration`, {
          to: messageData.to,
          message: messageData.message,
        });
        return {
          success: true,
          message: "SMS sent successfully",
          integrationType: integration.type,
        };

      default:
        throw new Error(`Unsupported integration type: ${integration.type}`);
    }
  } catch (error) {
    logger.error(`Error sending ${integration.type} message:`, error);
    throw error;
  }
};


const nameKeys = ["fullname", "name", "full_name", "firstfullname", "first_fullname", "customername", "contactname", "firstname", "first_name", "fname"];
const phoneKeys = ["phonenumber", "phone", "mobile", "mobilenumber", "phonemobile", "phone_number", "mobile_number", "contactnumber", "contact", "phone_mobile", "mobileno", "mobile_no"];
const emailKeys = ["email", "emailid", "emailaddress", "email_id", "email_address", "mail"];
const companyKeys = ["companyname", "company", "company_name"];
const projectKeys = ["projecttype", "project", "project_type"];

const findValueCaseInsensitive = (payload, searchKeys) => {
  if (!payload || typeof payload !== "object") return null;
  const keys = Object.keys(payload);
  
  // 1. Exact case-insensitive match
  for (const searchKey of searchKeys) {
    const foundKey = keys.find(k => k.toLowerCase() === searchKey.toLowerCase());
    if (foundKey && payload[foundKey] !== undefined && payload[foundKey] !== null) {
      return payload[foundKey];
    }
  }
  
  // 2. Sub-string matching fallback
  for (const key of keys) {
    const keyLower = key.toLowerCase();
    // Avoid mapping keys containing 'company' to fullName
    if (searchKeys === nameKeys && keyLower.includes("company")) {
      continue;
    }
    for (const searchKey of searchKeys) {
      if (keyLower.includes(searchKey.toLowerCase())) {
        return payload[key];
      }
    }
  }
  return null;
};

/**
 * Handle website lead submission
 */
const submitWebsiteLead = async (apiKey, leadData) => {
  const fs = require('fs');
  fs.appendFileSync('payload_debug.txt', JSON.stringify({ apiKey, leadData }) + "\n");
  console.log("=== RAW PAYLOAD RECEIVED FROM WEBSITE ===", { apiKey, leadData });
  
  // Use the leadData exactly as provided by the user's payload
  const normalizedData = { ...leadData };

  // Map incoming non-standard fields to standard fields if not already present
  if (!normalizedData.fullName) {
    normalizedData.fullName = findValueCaseInsensitive(leadData, nameKeys) || "";
  }
  if (!normalizedData.phoneNumber) {
    normalizedData.phoneNumber = findValueCaseInsensitive(leadData, phoneKeys) || "";
  }
  if (!normalizedData.email) {
    normalizedData.email = findValueCaseInsensitive(leadData, emailKeys) || "";
  }
  if (!normalizedData.companyName) {
    normalizedData.companyName = findValueCaseInsensitive(leadData, companyKeys) || "";
  }
  if (!normalizedData.projectType) {
    normalizedData.projectType = findValueCaseInsensitive(leadData, projectKeys) || "";
  }


  if (!apiKey) {
    throw new Error("API Key is required");
  }

  // 1. Try finding in Global Integrations
  const integration = await Integration.findOne({
    type: "website",
    "config.apiKey": apiKey,
    isActive: true,
  });

  let companyId;
  let clientId = null;
  let clientCompany = null;

  if (integration) {
    companyId = integration.companyId;
    // Verify company has website integration enabled
    await assertIntegrationEnabledForCompany(companyId, "website");
  } else {
    // 2. Try finding in ClientCompany-level Integrations
    clientCompany = await ClientCompany.findOne({
      "integrations.website.apiKey": apiKey,
      "integrations.website.isActive": true,
    });

    if (!clientCompany) {
      throw new Error("Invalid or inactive Integration Key");
    }

    companyId = clientCompany.companyId;
    clientId = clientCompany._id;
  }

  // Find an admin user for this company to act as creator
  const companyAdmin = await User.findOne({
    companyId,
    role: "admin",
    isActive: true,
  });
  if (!companyAdmin) {
    throw new Error(
      "No active admin found for this company to process lead submission",
    );
  }

  // Extract custom fields if configured
  let customFieldsConfig = [];
  if (integration && integration.config && integration.config.customFields) {
    customFieldsConfig = integration.config.customFields;
  } else if (clientCompany && clientCompany.integrations?.website?.customFields) {
    customFieldsConfig = clientCompany.integrations.website.customFields;
  }

  const customData = {};
  if (Array.isArray(customFieldsConfig)) {
    // Create a lowercase map of the incoming payload keys for case-insensitive matching
    const payloadKeysMap = {};
    Object.keys(normalizedData).forEach(key => {
      payloadKeysMap[key.toLowerCase()] = key;
    });

    customFieldsConfig.forEach((field) => {
      if (field.fieldName) {
        const configKeyLower = field.fieldName.toLowerCase();
        const actualPayloadKey = payloadKeysMap[configKeyLower];
        if (actualPayloadKey && normalizedData[actualPayloadKey] !== undefined) {
          customData[field.fieldName] = normalizedData[actualPayloadKey];
        }
      }
    });
  }

  // Create lead
  const lead = await leadService.createLead(
    {
      ...normalizedData,
      customData,
      clientId: clientId || normalizedData.clientId, // Use client ID from integration if found
      isClientLead: !!clientId,
      source: normalizedData.source || "Website",
    },
    companyId,
    clientId && clientCompany?.userId ? clientCompany.userId : companyAdmin._id,
    clientId && clientCompany?.userId
      ? { _id: clientCompany.userId, role: "client" }
      : companyAdmin, // Pass admin as currentUser to satisfy role checks in leadService
  );

  return lead;
};

/**
 * Fetch leads from external WhatsApp endpoint
 */
const fetchWhatsAppLeads = async (integrationId, companyId, role) => {
  const query = { _id: integrationId, type: "website" };
  if (!["super_admin", "supreme_super_admin", "commander_admin"].includes(role)) query.companyId = companyId;

  const integration = await Integration.findOne(query);
  if (!integration) {
    throw new Error("Integration not found");
  }

  const { whatsappLeads } = integration.config || {};
  if (!whatsappLeads || !whatsappLeads.apiUrl || !whatsappLeads.token) {
    throw new Error("WhatsApp lead integration not fully configured");
  }

  try {
    let fetchUrl = whatsappLeads.apiUrl;
    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    // If token is provided, and not already in URL, try both header and query param
    // M1 Labs specifically uses ?token= in the URL
    if (whatsappLeads.token) {
      if (!fetchUrl.includes("token=")) {
        const separator = fetchUrl.includes("?") ? "&" : "?";
        fetchUrl += `${separator}token=${whatsappLeads.token}`;
      }
      config.headers.Authorization = `Bearer ${whatsappLeads.token}`;
    }

    logger.info(`Fetching WhatsApp leads from ${fetchUrl}`);

    const response = await axios.get(fetchUrl, config);

    const externalLeads = response.data;
    let leadsArray = [];

    if (Array.isArray(externalLeads)) {
      leadsArray = externalLeads;
    } else if (externalLeads.data && Array.isArray(externalLeads.data)) {
      leadsArray = externalLeads.data;
    } else if (externalLeads.leads && Array.isArray(externalLeads.leads)) {
      leadsArray = externalLeads.leads;
    } else if (externalLeads.results && Array.isArray(externalLeads.results)) {
      leadsArray = externalLeads.results;
    } else {
      throw new Error("External API did not return an array of leads");
    }

    return await processWhatsAppLeads(
      leadsArray,
      companyId,
      integration.companyId,
    );
  } catch (error) {
    logger.error("Error fetching WhatsApp leads:", error);
    throw new Error(`Failed to fetch leads: ${error.message}`);
  }
};

const processWhatsAppLeads = async (leads, companyId, integrationCompanyId) => {
  const targetCompanyId = integrationCompanyId || companyId || null;

  // Find a user for this company to act as creator
  let companyAdmin = await User.findOne({
    $or: [
      { agencyId: targetCompanyId },
      { brandId: targetCompanyId },
      { workspaceId: targetCompanyId },
    ],
    role: { $in: ["admin", "super_admin", "supreme_super_admin", "commander_admin", "brand_manager", "agency_manager"] },
    isActive: true,
  });

  if (!companyAdmin) {
    companyAdmin = await User.findOne({
      $or: [
        { agencyId: targetCompanyId },
        { brandId: targetCompanyId },
        { workspaceId: targetCompanyId },
      ],
      isActive: true,
    });
  }

  if (!companyAdmin) {
    // Ultimate fallback for global integrations
    companyAdmin = await User.findOne({ role: "super_admin", isActive: true });
  }

  if (!companyAdmin) {
    throw new Error(
      "No active user found to process lead submission",
    );
  }

  let createdCount = 0;
  let skippedCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < leads.length; i++) {
    const leadData = leads[i];

    // Debug logging for the first lead to see the actual structure
    if (i === 0) {
      logger.info(
        "Sample lead structure from WhatsApp API:",
        JSON.stringify(leadData),
      );
    }

    try {
      // Robust key lookup
      const findValue = (obj, searchKeys) => {
        const keys = Object.keys(obj);
        for (const searchKey of searchKeys) {
          // Exact match
          if (obj[searchKey]) return obj[searchKey];

          // Case-insensitive match
          const foundKey = keys.find(
            (k) => k.toLowerCase() === searchKey.toLowerCase(),
          );
          if (foundKey && obj[foundKey]) return obj[foundKey];
        }
        return null;
      };

      const name = findValue(leadData, [
        "fullName",
        "name",
        "full_name",
        "fullname",
        "customerName",
        "contactName",
      ]);
      const phone = findValue(leadData, [
        "fullMobile",
        "phoneNumber",
        "mobile",
        "phone",
        "mobileNumber",
        "phoneNumber",
        "phonenumber",
        "contactNumber",
        "contact",
      ]);
      const email = findValue(leadData, ["email", "emailAddress", "mail"]);
      const notes = findValue(leadData, [
        "notes",
        "description",
        "message",
        "msg",
        "remark",
      ]);

      // Basic validation: must have at least a name or phone
      if (!name && !phone) {
        skippedCount++;
        continue;
      }

      // Check for existing lead with same phone number in this company to avoid duplicates
      if (phone) {
        const existingLead = await Lead.findOne({
          companyId: targetCompanyId,
          phoneNumber: phone,
        });
        if (existingLead) {
          duplicateCount++;
          continue;
        }
      }

      await leadService.createLead(
        {
          fullName: name || "WhatsApp Contact",
          email: email || "",
          phoneNumber: phone,
          companyName: leadData.companyName || leadData.company || "",
          source: "WhatsApp",
          notes: notes || "",
          projectType: leadData.projectType || leadData.project,
        },
        targetCompanyId,
        companyAdmin._id,
        companyAdmin,
      );
      createdCount++;
    } catch (err) {
      logger.error("Failed to create WhatsApp lead:", err.message);
      skippedCount++;
    }
  }

  return {
    success: true,
    message: `Processed ${leads.length} leads: ${createdCount} created, ${duplicateCount} duplicates skipped, ${skippedCount} failed`,
    createdCount,
    duplicateCount,
    skippedCount,
  };
};

module.exports = {
  getAllIntegrations,
  createIntegration,
  updateIntegration,
  sendMessage,
  fetchWhatsAppTemplates,
  validateEktaApi,
  syncEktaStaff,
  syncEktaAttendance,
  submitWebsiteLead,
  fetchWhatsAppLeads,
  syncAllWhatsAppLeads,
  getPaymentIntegration,
  testTwilioConnection,
  saveTwilioIntegration,
  getTwilioIntegration,
};

async function syncAllWhatsAppLeads(requestingCompanyId = null) {
  const integrations = await Integration.find({
    type: "website",
    isActive: true,
    "config.whatsappLeads.apiUrl": { $exists: true, $ne: "" },
    "config.whatsappLeads.token": { $exists: true, $ne: "" },
  });

  logger.info(`Syncing WhatsApp leads for ${integrations.length} integrations`);

  for (const integration of integrations) {
    try {
      await fetchWhatsAppLeads(integration._id, requestingCompanyId || integration.companyId, "admin");
    } catch (err) {
      logger.error(
        `Failed to sync WhatsApp leads for integration ${integration._id}:`,
        err.message,
      );
    }
  }
}