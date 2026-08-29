const express = require("express");
const axios = require("axios");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_12345';
const authMiddleware = require("../../middlewares/authMiddleware");
// Removed missing tenantMiddleware
const User = require("../auth/user.model");
const Post = require("./campaignScheduled.post.model");
const Account = require("./campaignScheduled.account.model");
const ClientCompany = require("../auth/user.model");

// Temporary Discovery Schema to handle cross-domain session issues
const DiscoverySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  data: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now, expires: 600 },
});
const Discovery =
  mongoose.models.Discovery || mongoose.model("Discovery", DiscoverySchema);
const cloudinary = require("../../config/cloudinary");
async function uploadAnyFileToCloudinary(filePath, folder = "campaign-posts", _options, extra = {}) {
  let resource_type = "auto";
  if (extra.mimetype && extra.mimetype.startsWith("video/")) {
    resource_type = "video";
  } else if (extra.mimetype && extra.mimetype.startsWith("image/")) {
    resource_type = "image";
  }
  return await cloudinary.uploader.upload(filePath, { resource_type, folder });
}
const {
  REDIRECT_URI,
  LINKEDIN_REDIRECT_URI,
  YOUTUBE_REDIRECT_URI,
  PINTEREST_SCOPES,
  PINTEREST_REDIRECT_URI,
  META_GRAPH,
  FB_SCOPES,
  LINKEDIN_SCOPES,
  YOUTUBE_SCOPES,
  FRONTEND_URL,
  sseClients,
  schedulerLogRef,
  setSchedulerLog,
  hasMetaCredentials,
  hasLinkedInCredentials,
  hasYoutubeCredentials,
  hasPinterestCredentials,
  toIST,
  toISO,
  toDisplayDate,
  buildConnectionStatus,
  broadcastSSE,
  getAllPosts,
  getAllAccounts,
  buildScopeQuery,
  // seedDemoPosts,
  upsertAccount,
  dispatchPost,
  refreshPublishedPostMetrics,
  getPostYoutubeComments,
  getYoutubeCredentialsForScope,
  migrateLinkedInPublishedPostMetrics,
  migrateLegacyPosts,
  processDuePosts,
} = require("./campaignScheduled.service");

const router = express.Router();
const os = require("os");
const path = require("path");
const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  }),
});

// Google Business Profile routes
const gbpRoutes = require("./googleBusiness.routes");
router.use("/", gbpRoutes);

function buildScopedAccountId(platformPrefix, companyId, providerId) {
  return `${platformPrefix}-${String(companyId)}-${String(providerId)}`;
}

async function resolveUserFromToken(token) {
  console.log("[OAuth Debug] Token received:", token ? "Exists" : "Empty", "JWT_SECRET exists:", !!JWT_SECRET);
  if (!token || !JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // auth.controller signs with _id (not id), so check both
    const userId = decoded._id || decoded.id;
    console.log("[OAuth Debug] Token decoded userId:", userId);
    const user = await User.findById(userId).select("-password").lean();
    console.log("[OAuth Debug] User found:", user ? user._id : "null");
    return user;
  } catch (err) {
    console.error("[OAuth Debug] JWT Verify Error:", err.message);
    return null;
  }
}

async function resolveClientCompanyId(rawClientId, companyId) {
  const value = String(rawClientId || "").trim();
  if (!value) return null;

  const orQuery = [{ userId: value }];
  if (mongoose.Types.ObjectId.isValid(value)) {
    orQuery.unshift({ _id: value });
  }

  const scopedClient = await ClientCompany.findOne({
    $or: orQuery,
  })
    .select("_id agencyId adminId brandId workspaceId companyId")
    .lean()
    .catch(() => null);

  if (!scopedClient) return null;

  // Temporarily bypass strict isMatch check since authMiddleware already validates user scope
  return String(scopedClient._id);
}

async function resolveCompanyIdFromQueryToken(req) {
  const rawToken = String(req.query?.token || "").trim();
  console.log("[OAuth Debug] resolveCompanyIdFromQueryToken rawToken exists:", !!rawToken);
  const user = await resolveUserFromToken(rawToken);
  
  const companyId = user?.companyId || user?.agencyId || user?.brandId || user?.workspaceId || user?.adminId || user?._id;
  console.log("[OAuth Debug] companyId resolved as:", companyId);
  
  if (!user || !companyId) return null;
  const requestedClientCompanyId = String(
    req.query?.clientCompanyId || "",
  ).trim();
  let clientCompanyId = null;
  const isClientRole = ["client", "agency_client", "brand_super_admin", "brand_manager", "brand_team_user"].includes(user.role) || (user.role === "user" && user.brandId);
  const userClientId = user.clientId || user.brandId || user._id;

  let resolvedCompanyId = companyId;

  if (isClientRole && userClientId) {
    clientCompanyId = await resolveClientCompanyId(
      userClientId,
      companyId,
    );
  } else if (requestedClientCompanyId) {
    clientCompanyId = await resolveClientCompanyId(
      requestedClientCompanyId,
      companyId,
    );
    if (clientCompanyId) {
       const clientData = await ClientCompany.findById(clientCompanyId).select("agencyId").lean().catch(() => null);
       if (clientData && clientData.agencyId) {
          resolvedCompanyId = clientData.agencyId;
       }
    }
  }

  return {
    companyId: String(resolvedCompanyId),
    clientCompanyId,
  };
}

function buildPublicationMap(deliveries = []) {
  const map = {};
  for (const item of deliveries) {
    if (!item?.accountId) continue;
    map[item.accountId] = {
      platform: item.platform,
      externalId: item.externalId,
      ...(item.url ? { url: item.url } : {}),
    };
  }
  return map;
}

// seedDemoPosts().catch(() => {});

// ── DEBUG: Token resolution diagnostic endpoint ──
router.get("/auth/debug-token", async (req, res) => {
  const rawToken = String(req.query?.token || "").trim();
  const jwt_secret_exists = !!JWT_SECRET;
  const token_exists = !!rawToken;

  if (!rawToken) {
    return res.json({ ok: false, step: "no_token", msg: "No token provided in query ?token=..." });
  }

  let decoded = null;
  try {
    decoded = jwt.verify(rawToken, JWT_SECRET);
  } catch (err) {
    return res.json({ ok: false, step: "jwt_verify_failed", msg: err.message, jwt_secret_exists });
  }

  const userId = decoded._id || decoded.id;
  if (!userId) {
    return res.json({ ok: false, step: "no_user_id_in_token", decoded, jwt_secret_exists });
  }

  let user = null;
  try {
    user = await User.findById(userId).select("-password").lean();
  } catch (err) {
    return res.json({ ok: false, step: "db_lookup_failed", userId, msg: err.message });
  }

  if (!user) {
    return res.json({ ok: false, step: "user_not_found", userId });
  }

  const companyId = user?.companyId || user?.agencyId || user?.brandId || user?.workspaceId || user?._id;

  return res.json({
    ok: true,
    step: "success",
    userId,
    user_id_in_db: String(user._id),
    role: user.role,
    companyId: companyId ? String(companyId) : null,
    agencyId: user.agencyId ? String(user.agencyId) : null,
    brandId: user.brandId ? String(user.brandId) : null,
    workspaceId: user.workspaceId ? String(user.workspaceId) : null,
    token_keys: Object.keys(decoded),
  });
});

router.get("/events", async (req, res) => {
  const scope = await resolveCompanyIdFromQueryToken(req);
  if (!scope?.companyId) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const posts = await getAllPosts(scope.companyId, scope.clientCompanyId);
  const accounts = await getAllAccounts(scope.companyId, scope.clientCompanyId);
  res.write('event: connected\ndata: {"status":"connected"}\n\n');
  res.write(`event: posts_sync\ndata: ${JSON.stringify(posts)}\n\n`);
  res.write(
    `event: accounts_sync\ndata: ${JSON.stringify(accounts)}\n\n`,
  );

  const client = {
    res,
    companyId: scope.companyId,
    clientCompanyId: scope.clientCompanyId || null,
  };
  sseClients.add(client);
  
  // Keep the connection alive to prevent ECONNRESET from proxy/timeout
  const pingInterval = setInterval(() => {
    res.write('event: ping\ndata: "ping"\n\n');
  }, 15000);

  req.on("close", () => {
    clearInterval(pingInterval);
    sseClients.delete(client);
  });
});

router.get("/auth/facebook", (req, res) => {


  if (!hasMetaCredentials()) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(
        "Meta credentials not configured",
      )}`,
    );
    return;
  }

  (async () => {
    const scope = await resolveCompanyIdFromQueryToken(req);
    if (!scope?.companyId) {
      res.redirect(
        `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=unauthorized`,
      );
      return;
    }

    const platform = req.query.platform || "facebook";
    const context = {
      companyId: scope.companyId,
      clientCompanyId: scope.clientCompanyId || null,
      redirectUri: REDIRECT_URI,
      platform,
    };
    const encodedState = Buffer.from(JSON.stringify(context)).toString(
      "base64",
    );
    
    // We can still keep the session variables for fallback just in case
    req.session.campaignScheduledOauthState = encodedState;
    req.session.campaignScheduledOauthRedirectUri = REDIRECT_URI;
    req.session.campaignScheduledCompanyId = scope.companyId;
    req.session.campaignScheduledClientCompanyId =
      scope.clientCompanyId || null;

    const url = new URL("https://www.facebook.com/v20.0/dialog/oauth");
    url.searchParams.set("client_id", process.env.META_APP_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("scope", FB_SCOPES);
    url.searchParams.set("state", encodedState);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("auth_type", "rerequest");

    res.redirect(url.toString());
  })();
});

router.get("/auth/instagram", (req, res) => {
  if (!hasMetaCredentials()) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(
        "Meta credentials not configured",
      )}`,
    );
    return;
  }
  const tokenQuery = req.query?.token
    ? `token=${encodeURIComponent(String(req.query.token))}`
    : "";
  const clientQuery = req.query?.clientCompanyId
    ? `clientCompanyId=${encodeURIComponent(String(req.query.clientCompanyId))}`
    : "";
  const query = [tokenQuery, clientQuery, "platform=instagram"].filter(Boolean).join("&");
  res.redirect(
    `/api/campaign-scheduled/auth/facebook${query ? `?${query}` : ""}`,
  );
});

router.get("/auth/instagram/direct", (req, res) => {
  if (!hasMetaCredentials()) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=Meta credentials not configured`,
    );
    return;
  }
  (async () => {
    const scope = await resolveCompanyIdFromQueryToken(req);
    if (!scope?.companyId) {
      res.redirect(
        `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=unauthorized`,
      );
      return;
    }
    const state = randomUUID();
    req.session.campaignScheduledOauthState = state;
    req.session.campaignScheduledCompanyId = scope.companyId;
    req.session.campaignScheduledClientCompanyId =
      scope.clientCompanyId || null;

    // Using Instagram direct authorization URL
    // This typically uses the Instagram Basic Display API or the newer Instagram Login for Graph API
    const url = new URL("https://api.instagram.com/oauth/authorize");
    url.searchParams.set("client_id", process.env.META_APP_ID);
    url.searchParams.set(
      "redirect_uri",
      `${process.env.APP_URL}/api/campaign-scheduled/auth/instagram/direct/callback`,
    );
    url.searchParams.set("scope", "user_profile,user_media");
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    res.redirect(url.toString());
  })();
});

router.get("/auth/instagram/direct/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const companyId = req.session.campaignScheduledCompanyId || null;
  const clientCompanyId = req.session.campaignScheduledClientCompanyId || null;

  if (error) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(error)}`,
    );
    return;
  }

  try {
    // Exchange code for short-lived token
    const tokenRes = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      new URLSearchParams({
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_SECRET,
        grant_type: "authorization_code",
        redirect_uri: `${process.env.APP_URL}/api/campaign-scheduled/auth/instagram/direct/callback`,
        code,
      }),
    );

    const { access_token: shortToken, user_id: igUserId } = tokenRes.data;

    // Exchange for long-lived token
    const llRes = await axios.get("https://graph.instagram.com/access_token", {
      params: {
        grant_type: "ig_exchange_token",
        client_secret: process.env.META_SECRET,
        access_token: shortToken,
      },
    });

    const longToken = llRes.data.access_token;
    const expiresAt =
      Math.floor(Date.now() / 1000) + (llRes.data.expires_in || 5184000);

    // Get profile info
    const profileRes = await axios.get(`https://graph.instagram.com/me`, {
      params: { fields: "id,username,account_type", access_token: longToken },
    });
    const profile = profileRes.data;

    await upsertAccount(
      {
        id: buildScopedAccountId("ig_direct", companyId, profile.id),
        platform: "instagram",
        page_id: null,
        page_name: profile.username,
        ig_user_id: profile.id,
        username: profile.username,
        access_token: longToken,
        token_type: "instagram_direct",
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
      },
      companyId,
      clientCompanyId,
    );

    const accounts = await getAllAccounts(companyId, clientCompanyId);
    broadcastSSE("accounts_sync", accounts, { companyId, clientCompanyId });
    delete req.session.campaignScheduledOauthState;
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=success&platform=InstagramDirect`,
    );
  } catch (err) {
    console.error(
      "[IG Direct Callback] Error:",
      err.response?.data || err.message,
    );
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(err.message)}`,
    );
  }
});

router.get("/auth/facebook/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(error)}`,
    );
    return;
  }

  if (!state) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=missing_state`,
    );
    return;
  }

  let decodedContext;
  try {
    const jsonStr = Buffer.from(state, "base64").toString("utf8");
    decodedContext = JSON.parse(jsonStr);
  } catch (e) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=invalid_state_format`,
    );
    return;
  }

  const companyId = decodedContext.companyId;
  const clientCompanyId = decodedContext.clientCompanyId || null;

  if (!companyId) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=missing_company_context`,
    );
    return;
  }

  try {
    const redirectUriUsedInDialog = decodedContext.redirectUri || REDIRECT_URI;
    const requestToken = (redirectUriValue) =>
      axios.get(`${META_GRAPH}/oauth/access_token`, {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_SECRET,
          redirect_uri: redirectUriValue,
          code,
        },
      });

    let tokenRes;
    try {
      tokenRes = await requestToken(redirectUriUsedInDialog);
    } catch (primaryErr) {
      const msg = primaryErr?.response?.data?.error?.message || "";
      const maybeRedirectMismatch =
        /redirect_uri.*identical|validating verification code/i.test(msg);
      if (!maybeRedirectMismatch) throw primaryErr;

      const alternateRedirectUri = redirectUriUsedInDialog.endsWith("/")
        ? redirectUriUsedInDialog.replace(/\/+$/, "")
        : `${redirectUriUsedInDialog}/`;

      if (
        !alternateRedirectUri ||
        alternateRedirectUri === redirectUriUsedInDialog
      )
        throw primaryErr;
      tokenRes = await requestToken(alternateRedirectUri);
    }
    const shortToken = tokenRes.data.access_token;

    const llRes = await axios.get(`${META_GRAPH}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_SECRET,
        fb_exchange_token: shortToken,
      },
    });
    const longToken = llRes.data.access_token;
    const expiresAt =
      Math.floor(Date.now() / 1000) + (llRes.data.expires_in || 5184000);

    // Store token in client configuration if in client scope
    if (clientCompanyId) {
      await ClientCompany.findOneAndUpdate(
        { _id: clientCompanyId, companyId: companyId },
        {
          $set: {
            "configuration.campaignScheduled.facebook.accessToken": longToken,
            "configuration.campaignScheduled.facebook.updatedAt": new Date(),
            "configuration.campaignScheduled.instagram.accessToken": longToken,
            "configuration.campaignScheduled.instagram.updatedAt": new Date(),
          },
        },
      ).catch((err) =>
        console.error(
          "[FB Callback] Failed to save client config:",
          err.message,
        ),
      );
    }

    // Fetch the pages they just authorized so we can list them in the frontend
    let discoveredPages = [];
    try {
      const accountsRes = await axios.get(`${META_GRAPH}/me/accounts`, {
        params: {
          access_token: longToken,
          fields: "id,name,access_token,instagram_business_account{id,username,name}",
        },
      });
      discoveredPages = accountsRes.data?.data || [];
    } catch (fetchErr) {
      console.warn("[FB Callback] Failed to auto-discover pages:", fetchErr.message);
    }

    // Auto-connect discovered pages
    if (discoveredPages.length > 0) {
      for (const fbPageData of discoveredPages) {
        if (fbPageData && fbPageData.id) {
          const facebookAccountId = buildScopedAccountId("fb", companyId, fbPageData.id);
          await upsertAccount(
            {
              id: facebookAccountId,
              platform: "facebook",
              page_id: fbPageData.id,
              page_name: fbPageData.name,
              username: fbPageData.name,
              access_token: fbPageData.access_token,
              token_type: "page",
              expires_at: expiresAt,
              connected_at: new Date().toISOString(),
            },
            companyId,
            clientCompanyId,
          );

          // If there's an associated Instagram account, connect it too
          if (fbPageData.instagram_business_account && fbPageData.instagram_business_account.id) {
            const igData = fbPageData.instagram_business_account;
            const igAccountId = buildScopedAccountId("ig", companyId, igData.id);
            await upsertAccount(
              {
                id: igAccountId,
                platform: "instagram",
                page_id: fbPageData.id,
                page_name: fbPageData.name,
                ig_user_id: igData.id,
                username: igData.username || igData.name,
                access_token: fbPageData.access_token, // IG uses the page's token
                token_type: "instagram",
                expires_at: expiresAt,
                connected_at: new Date().toISOString(),
              },
              companyId,
              clientCompanyId,
            );
          }
        }
      }

      const accounts = await getAllAccounts(companyId, clientCompanyId);
      broadcastSSE("accounts_sync", accounts, { companyId, clientCompanyId });
    }

    const platform = decodedContext.platform || "facebook";
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=success&platform=${platform}`,
    );
  } catch (err) {
    const msg =
      err?.response?.data?.error?.message || err?.message || "Unknown error";
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(msg)}`,
    );
  }
});

router.get("/auth/linkedin", (req, res) => {
  if (!hasLinkedInCredentials()) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(
        "LinkedIn credentials not configured",
      )}`,
    );
    return;
  }

  (async () => {
    const scope = await resolveCompanyIdFromQueryToken(req);
    if (!scope?.companyId) {
      res.redirect(
        `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=unauthorized`,
      );
      return;
    }
    const context = {
      state: randomUUID(),
      companyId: scope.companyId,
      clientCompanyId: scope.clientCompanyId || null,
    };
    const encodedState = Buffer.from(JSON.stringify(context)).toString(
      "base64",
    );
    req.session.campaignScheduledLinkedinOauthState = context.state;
    req.session.campaignScheduledCompanyId = context.companyId;
    req.session.campaignScheduledClientCompanyId = context.clientCompanyId;

    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID);
    url.searchParams.set("redirect_uri", LINKEDIN_REDIRECT_URI);
    url.searchParams.set("scope", LINKEDIN_SCOPES);
    url.searchParams.set("state", encodedState);

    res.redirect(url.toString());
  })();
});

router.get("/auth/linkedin/callback", async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  let companyId = req.session.campaignScheduledCompanyId || null;
  let clientCompanyId = req.session.campaignScheduledClientCompanyId || null;
  let expectedState = req.session.campaignScheduledLinkedinOauthState || null;

  console.log(
    "[LinkedIn Callback] Received. code present:",
    !!code,
    "state present:",
    !!state,
    "error:",
    error || "none",
  );

  if (state) {
    try {
      const decoded = JSON.parse(
        Buffer.from(state, "base64").toString("utf-8"),
      );
      if (decoded.companyId) companyId = decoded.companyId;
      if (decoded.clientCompanyId) clientCompanyId = decoded.clientCompanyId;
      if (decoded.state) expectedState = decoded.state;
      console.log(
        "[LinkedIn Callback] Decoded state: companyId=",
        companyId,
        "clientCompanyId=",
        clientCompanyId,
      );
    } catch (e) {
      console.log("[LinkedIn Callback] State decode failed:", e.message);
    }
  }

  if (error) {
    const reason = errorDescription || error;
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(
        reason,
      )}`,
    );
    return;
  }

  // We only enforce state mismatch if we have an expected state in session
  // or if we decoded one from the state param itself.
  if (expectedState && state) {
    // If state was JSON, we compare the inner state. If not, we compare directly.
    let receivedState = state;
    try {
      receivedState = JSON.parse(
        Buffer.from(state, "base64").toString("utf-8"),
      ).state;
    } catch (e) {}

    if (receivedState !== expectedState) {
      res.redirect(
        `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=state_mismatch`,
      );
      return;
    }
  }

  if (!companyId) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=missing_company_context`,
    );
    return;
  }

  try {
    console.log(
      "[LinkedIn Callback] Attempting token exchange. redirect_uri:",
      LINKEDIN_REDIRECT_URI,
      "code length:",
      code?.length,
    );
    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: LINKEDIN_REDIRECT_URI,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    const {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
    } = tokenRes.data;
    const expiresAt = Math.floor(Date.now() / 1000) + (expiresIn || 5184000);

    const profileRes = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = profileRes.data || {};
    const personId = profile.sub || profile.id || null;
    const displayName =
      profile.name ||
      [profile.given_name, profile.family_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      "LinkedIn User";

    if (!personId) {
      throw new Error("Unable to fetch LinkedIn profile identity");
    }

    const organizations = {};
    try {
      const orgsRes = await axios.get(
        "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&state=APPROVED",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const elements = orgsRes.data?.elements || [];
      const orgUrns = elements.map((el) => el.organization);

      if (orgUrns.length > 0) {
        const orgIds = orgUrns.map((urn) => urn.split(":").pop());
        const orgIdsParam = `List(${orgIds.join(",")})`;
        const orgDetailsRes = await axios.get(
          `https://api.linkedin.com/v2/organizations?ids=${orgIdsParam}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-Restli-Protocol-Version": "2.0.0",
            },
          },
        );
        const results = orgDetailsRes.data?.results || {};
        for (const orgId of Object.keys(results)) {
          organizations[orgId] =
            results[orgId].localizedName || `LinkedIn Page ${orgId}`;
        }
      }
    } catch (orgErr) {
      console.error("[LinkedIn Callback] Discovery failed:", orgErr.message);
    }

    const discoveryId = randomUUID();
    await Discovery.create({
      id: discoveryId,
      data: {
        accessToken,
        refreshToken,
        expiresAt,
        profile: {
          id: personId,
          name: displayName,
          avatar: profile.picture,
        },
        organizations,
        companyId,
        clientCompanyId,
      },
    });

    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=discovery&platform=LinkedIn&discoveryId=${discoveryId}`,
    );
  } catch (err) {
    delete req.session.campaignScheduledCompanyId;
    delete req.session.campaignScheduledClientCompanyId;
    const msg =
      err?.response?.data?.error_description ||
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      "Unknown error";
    console.error(
      "[LinkedIn Callback] Token exchange or account save FAILED:",
      msg,
      "| LinkedIn response:",
      JSON.stringify(err?.response?.data || {}),
    );
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(msg)}`,
    );
  }
});

router.get("/auth/linkedin/discovery", authMiddleware, async (req, res) => {
  const { discoveryId } = req.query;
  if (!discoveryId) {
    return res
      .status(400)
      .json({ success: false, error: "Missing discoveryId" });
  }

  const discovery = await Discovery.findOne({ id: discoveryId });
  if (!discovery) {
    return res
      .status(404)
      .json({
        success: false,
        error: "No pending LinkedIn connection found or it has expired",
      });
  }

  res.json({
    success: true,
    data: {
      profile: discovery.data.profile,
      organizations: discovery.data.organizations,
    },
  });
});

router.post(
  "/auth/linkedin/connect-selected",
  authMiddleware,
  async (req, res) => {
    const { selectedIds, discoveryId } = req.body;

    if (!discoveryId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing discoveryId" });
    }

    const discoveryRecord = await Discovery.findOne({ id: discoveryId });
    if (!discoveryRecord) {
      return res
        .status(400)
        .json({
          success: false,
          error: "No pending LinkedIn connection found or it has expired",
        });
    }

    const discovery = discoveryRecord.data;

    try {
      const {
        accessToken,
        refreshToken,
        expiresAt,
        companyId,
        clientCompanyId,
      } = discovery;

      for (const item of selectedIds) {
        const isOrg = item.type === "organization";
        const pageId = item.id;
        const pageName = isOrg
          ? discovery.organizations[pageId]
          : discovery.profile.name;

        if (clientCompanyId && !isOrg) {
          await ClientCompany.findOneAndUpdate(
            { _id: clientCompanyId, companyId: companyId },
            {
              $set: {
                "configuration.campaignScheduled.linkedin.accessToken":
                  accessToken,
                "configuration.campaignScheduled.linkedin.linkedinId": pageId,
                "configuration.campaignScheduled.linkedin.updatedAt":
                  new Date(),
              },
            },
          ).catch(() => {});
        }

        await upsertAccount(
          {
            id: buildScopedAccountId(
              isOrg ? "li_org" : "li",
              companyId,
              pageId,
            ),
            platform: "linkedin",
            page_id: pageId,
            page_name: pageName,
            ig_user_id: null,
            username: pageName,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: isOrg ? "organization" : "user",
            expires_at: expiresAt,
            connected_at: new Date().toISOString(),
          },
          companyId,
          clientCompanyId,
        );
      }

      await Discovery.deleteOne({ id: discoveryId });
      delete req.session.campaignScheduledLinkedinOauthState;
      delete req.session.campaignScheduledCompanyId;
      delete req.session.campaignScheduledClientCompanyId;

      const accounts = await getAllAccounts(companyId, clientCompanyId);
      const scope = { companyId, clientCompanyId };
      broadcastSSE("accounts_sync", accounts, scope);
      broadcastSSE(
        "connection_changed",
        buildConnectionStatus(accounts),
        scope,
      );

      res.json({
        success: true,
        message: "Selected LinkedIn accounts connected successfully",
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

router.post("/auth/linkedin/manual", authMiddleware, async (req, res) => {
  const {
    accessToken,
    refreshToken,
    linkedinId,
    pageName,
    expiresAt,
    tokenType,
  } = req.body;
  const { companyId } = req.user;
  const clientCompanyId = req.query.clientCompanyId || null;

  if (!accessToken) {
    return res
      .status(400)
      .json({ success: false, error: "Access token is required" });
  }

  try {
    const id = linkedinId || `manual-${randomUUID().slice(0, 8)}`;
    await upsertAccount(
      {
        id: buildScopedAccountId("li_manual", companyId, id),
        platform: "linkedin",
        page_id: id,
        page_name: pageName || "LinkedIn Manual Account",
        ig_user_id: null,
        username: pageName || "Manual User",
        access_token: accessToken,
        refresh_token: refreshToken || null,
        token_type: tokenType || "manual",
        expires_at: expiresAt || Math.floor(Date.now() / 1000) + 5184000,
        connected_at: new Date().toISOString(),
      },
      companyId,
      clientCompanyId,
    );

    const accounts = await getAllAccounts(companyId, clientCompanyId);
    const scope = { companyId, clientCompanyId };
    broadcastSSE("accounts_sync", accounts, scope);
    broadcastSSE("connection_changed", buildConnectionStatus(accounts), scope);

    res.json({ success: true, message: "LinkedIn tokens updated manually" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/auth/youtube", (req, res) => {
  (async () => {
    const { discoveryId } = req.query;
    const scope = await resolveCompanyIdFromQueryToken(req);
    if (!scope?.companyId) {
      res.redirect(
        `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=unauthorized`,
      );
      return;
    }
    const ytCreds = await getYoutubeCredentialsForScope(
      scope.companyId,
      scope.clientCompanyId,
    );
    if (!ytCreds.clientId || !ytCreds.clientSecret) {
      res.redirect(
        `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(
          "YouTube credentials are not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Configuration.",
        )}`,
      );
      return;
    }
    const context = {
      state: randomUUID(),
      companyId: scope.companyId,
      clientCompanyId: scope.clientCompanyId || null,
      ytClientId: ytCreds.clientId,
      ytClientSecret: ytCreds.clientSecret,
      discoveryId: discoveryId || null,
    };
    const encodedState = Buffer.from(JSON.stringify(context)).toString(
      "base64",
    );
    req.session.campaignScheduledYoutubeOauthState = context.state;
    req.session.campaignScheduledCompanyId = context.companyId;
    req.session.campaignScheduledClientCompanyId = context.clientCompanyId;
    req.session.campaignScheduledYoutubeClientId = context.ytClientId;
    req.session.campaignScheduledYoutubeClientSecret = context.ytClientSecret;

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", ytCreds.clientId);
    url.searchParams.set("redirect_uri", YOUTUBE_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", YOUTUBE_SCOPES);
    url.searchParams.set("state", encodedState);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");

    res.redirect(url.toString());
  })();
});

router.get("/oauth/youtube-debug", (_req, res) => {
  const clientId =
    process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", YOUTUBE_REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", YOUTUBE_SCOPES);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");

  res.json({
    success: true,
    youtubeConfigured: hasYoutubeCredentials(),
    appUrl: process.env.APP_URL || null,
    frontendUrl: process.env.FRONTEND_URL || null,
    redirectUri: YOUTUBE_REDIRECT_URI,
    clientIdPrefix: clientId ? `${clientId.slice(0, 12)}...` : null,
    authUrlPreview: authUrl.toString(),
    expectedGoogleRedirectUriEntry: YOUTUBE_REDIRECT_URI,
  });
});

router.get("/auth/youtube/callback", async (req, res) => {
  const { code, state, error } = req.query;
  let companyId = req.session.campaignScheduledCompanyId || null;
  let clientCompanyId = req.session.campaignScheduledClientCompanyId || null;
  let scopedClientId = req.session.campaignScheduledYoutubeClientId || "";
  let scopedClientSecret =
    req.session.campaignScheduledYoutubeClientSecret || "";
  let expectedState = req.session.campaignScheduledYoutubeOauthState || null;
  let discoveryId = null;

  if (state) {
    try {
      const decoded = JSON.parse(
        Buffer.from(state, "base64").toString("utf-8"),
      );
      if (decoded.companyId) companyId = decoded.companyId;
      if (decoded.clientCompanyId) clientCompanyId = decoded.clientCompanyId;
      if (decoded.ytClientId) scopedClientId = decoded.ytClientId;
      if (decoded.ytClientSecret) scopedClientSecret = decoded.ytClientSecret;
      if (decoded.state) expectedState = decoded.state;
      if (decoded.discoveryId) discoveryId = decoded.discoveryId;
      console.log(
        "[YouTube Callback] Decoded state: companyId=",
        companyId,
        "clientCompanyId=",
        clientCompanyId,
        "discoveryId=",
        discoveryId,
      );
    } catch (e) {
      console.log(
        "[YouTube Callback] State decode failed or literal state used:",
        e.message,
      );
    }
  }

  console.log("[YouTube OAuth] Callback hit", {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    hasError: Boolean(error),
    expectedState,
    redirectUri: YOUTUBE_REDIRECT_URI,
  });

  if (error) {
    delete req.session.campaignScheduledYoutubeOauthState;
    console.error("[YouTube OAuth] Provider returned error:", error);
    const errorMsg = typeof error === "string" ? error : JSON.stringify(error);
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(errorMsg)}`,
    );
    return;
  }

  // We only enforce state mismatch if we have an expected state
  if (expectedState && state) {
    let receivedState = state;
    try {
      receivedState = JSON.parse(
        Buffer.from(state, "base64").toString("utf-8"),
      ).state;
    } catch (e) {}

    if (receivedState !== expectedState) {
      delete req.session.campaignScheduledYoutubeOauthState;
      console.error("[YouTube OAuth] State mismatch", {
        receivedState,
        expectedState,
      });
      res.redirect(
        `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=state_mismatch`,
      );
      return;
    }
  }

  if (!companyId) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=missing_company_context`,
    );
    return;
  }

  try {
    if (!scopedClientId || !scopedClientSecret) {
      throw new Error(
        "YouTube credentials are missing for this client. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.",
      );
    }

    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: scopedClientId,
        client_secret: scopedClientSecret,
        redirect_uri: YOUTUBE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const accessToken = tokenRes.data.access_token;
    const refreshToken = tokenRes.data.refresh_token || null;
    const grantedScopes = tokenRes.data.scope || "";
    const expiresAt =
      Math.floor(Date.now() / 1000) + (tokenRes.data.expires_in || 3600);

    // Check if required YouTube scopes were granted
    const requiredScopes = [
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/youtube.upload",
    ];
    const missingScopes = requiredScopes.filter(
      (s) => !grantedScopes.includes(s),
    );
    if (missingScopes.length > 0) {
      console.warn("[YouTube OAuth] Missing required scopes:", missingScopes);
      // We don't necessarily throw here because some basic functionality might still work,
      // but we should ideally warn the user. For now, let's just proceed but log it.
    }

    console.log("[YouTube OAuth] Token exchange success", {
      hasAccessToken: Boolean(accessToken),
      hasRefreshToken: Boolean(refreshToken),
      grantedScopes,
      expiresAt,
    });

    const channelRes = await axios.get(
      "https://www.googleapis.com/youtube/v3/channels",
      {
        params: { part: "id,snippet", mine: "true" },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const channels = (channelRes.data?.items || []).map((item) => ({
      id: item.id,
      title: item.snippet?.title || "YouTube Channel",
      thumbnail: item.snippet?.thumbnails?.default?.url || null,
      customUrl: item.snippet?.customUrl || null,
    }));

    if (channels.length === 0)
      throw new Error("No YouTube channels found for this Google account");

    if (discoveryId) {
      const existing = await Discovery.findOne({ id: discoveryId });
      if (existing) {
        // Aggregate channels and tokens
        const existingData = existing.data;
        const newChannels = channels.filter(
          (nc) => !existingData.channels.some((ec) => ec.id === nc.id),
        );

        const updatedIdentities = existingData.identities || {};
        channels.forEach((ch) => {
          updatedIdentities[ch.id] = {
            accessToken,
            refreshToken,
            expiresAt,
            grantedScopes,
            scopedClientId,
            scopedClientSecret,
          };
        });

        await Discovery.updateOne(
          { id: discoveryId },
          {
            $set: {
              "data.channels": [...existingData.channels, ...newChannels],
              "data.identities": updatedIdentities,
            },
          },
        );
      } else {
        discoveryId = null; // Reset if not found
      }
    }

    if (!discoveryId) {
      discoveryId = randomUUID();
      const identities = {};
      channels.forEach((ch) => {
        identities[ch.id] = {
          accessToken,
          refreshToken,
          expiresAt,
          grantedScopes,
          scopedClientId,
          scopedClientSecret,
        };
      });

      await Discovery.create({
        id: discoveryId,
        data: {
          identities,
          channels,
          companyId,
          clientCompanyId,
        },
      });
    }

    delete req.session.campaignScheduledYoutubeOauthState;
    delete req.session.campaignScheduledCompanyId;
    delete req.session.campaignScheduledClientCompanyId;
    delete req.session.campaignScheduledYoutubeClientId;
    delete req.session.campaignScheduledYoutubeClientSecret;

    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=discovery&platform=YouTube&discoveryId=${discoveryId}`,
    );
  } catch (err) {
    delete req.session.campaignScheduledYoutubeOauthState;
    delete req.session.campaignScheduledCompanyId;
    delete req.session.campaignScheduledClientCompanyId;
    delete req.session.campaignScheduledYoutubeClientId;
    delete req.session.campaignScheduledYoutubeClientSecret;
    console.error("[YouTube OAuth] Callback failed", {
      message: err?.message || "Unknown error",
      response: err?.response?.data || null,
      redirectUri: YOUTUBE_REDIRECT_URI,
      clientIdPrefix: String(scopedClientId || "").slice(0, 12),
    });
    const msg =
      err?.response?.data?.error_description ||
      err?.response?.data?.error ||
      err?.message ||
      "Unknown error";
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(msg)}`,
    );
  }
});

router.get("/auth/youtube/discovery", authMiddleware, async (req, res) => {
  const { discoveryId } = req.query;
  if (!discoveryId) {
    return res
      .status(400)
      .json({ success: false, error: "Missing discoveryId" });
  }

  const discovery = await Discovery.findOne({ id: discoveryId });
  if (!discovery) {
    return res
      .status(404)
      .json({
        success: false,
        error: "No pending YouTube connection found or it has expired",
      });
  }

  res.json({
    success: true,
    data: {
      channels: discovery.data.channels,
      grantedScopes: discovery.data.grantedScopes,
    },
  });
});

router.post(
  "/auth/youtube/connect-selected",
  authMiddleware,
  async (req, res) => {
    const { selectedIds, discoveryId } = req.body;

    if (!discoveryId) {
      return res
        .status(400)
        .json({ success: false, error: "Missing discoveryId" });
    }

    const discoveryRecord = await Discovery.findOne({ id: discoveryId });
    if (!discoveryRecord) {
      return res
        .status(400)
        .json({
          success: false,
          error: "No pending YouTube connection found or it has expired",
        });
    }

    const discovery = discoveryRecord.data;

    try {
      const { companyId, clientCompanyId, identities, channels } = discovery;

      for (const channelId of selectedIds) {
        const channel = channels.find((c) => c.id === channelId);
        if (!channel) continue;

        const iden = identities?.[channelId] || {};
        const channelTitle = channel.title;
        await upsertAccount(
          {
            id: buildScopedAccountId("yt", companyId, channel.id),
            platform: "youtube",
            page_id: channel.id,
            page_name: channelTitle,
            ig_user_id: null,
            username: channel.customUrl || channelTitle,
            access_token: iden.accessToken,
            refresh_token: iden.refreshToken,
            oauth_scopes: iden.grantedScopes,
            youtube_client_id: iden.scopedClientId || null,
            youtube_client_secret: iden.scopedClientSecret || null,
            token_type: "channel",
            expires_at: iden.expiresAt,
            connected_at: new Date().toISOString(),
          },
          companyId,
          clientCompanyId,
        );

        // Store token in client configuration if in client scope (matching LinkedIn flow)
        if (clientCompanyId) {
          await ClientCompany.findOneAndUpdate(
            { _id: clientCompanyId, companyId: companyId },
            {
              $set: {
                "configuration.campaignScheduled.youtube.accessToken":
                  iden.accessToken,
                "configuration.campaignScheduled.youtube.refreshToken":
                  iden.refreshToken,
                "configuration.campaignScheduled.youtube.channelId": channel.id,
                "configuration.campaignScheduled.youtube.updatedAt": new Date(),
              },
            },
          ).catch((err) =>
            console.error(
              "[YouTube Connect] Failed to save client config:",
              err.message,
            ),
          );
        }
      }

      await Discovery.deleteOne({ id: discoveryId });

      const accounts = await getAllAccounts(companyId, clientCompanyId);
      const scope = { companyId, clientCompanyId };
      broadcastSSE("accounts_sync", accounts, scope);
      broadcastSSE(
        "connection_changed",
        buildConnectionStatus(accounts),
        scope,
      );

      res.json({
        success: true,
        message: "Selected YouTube channels connected successfully",
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

router.get("/auth/pinterest", (req, res) => {
  if (!hasPinterestCredentials()) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(
        "Pinterest credentials not configured"
      )}`
    );
    return;
  }
  
  (async () => {
    const scope = await resolveCompanyIdFromQueryToken(req);
    if (!scope?.companyId) {
      res.redirect(
        `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=unauthorized`
      );
      return;
    }

    const context = {
      state: randomUUID(),
      companyId: scope.companyId,
      clientCompanyId: scope.clientCompanyId || null,
    };
    const encodedState = Buffer.from(JSON.stringify(context)).toString("base64");
    
    req.session.campaignScheduledPinterestOauthState = context.state;
    req.session.campaignScheduledPinterestContext = context;
    
    const url = new URL("https://www.pinterest.com/oauth/");
    url.searchParams.set("client_id", process.env.PINTEREST_CLIENT_ID);
    url.searchParams.set("redirect_uri", PINTEREST_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", PINTEREST_SCOPES);
    url.searchParams.set("state", encodedState);
    
    res.redirect(url.toString());
  })();
});

router.get("/auth/pinterest/callback", async (req, res) => {
  const { code, state, error } = req.query;
  let companyId = req.session.campaignScheduledPinterestContext?.companyId || null;
  let clientCompanyId = req.session.campaignScheduledPinterestContext?.clientCompanyId || null;

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
      if (decoded.companyId) companyId = decoded.companyId;
      if (decoded.clientCompanyId) clientCompanyId = decoded.clientCompanyId;
    } catch (e) {
      console.log("[Pinterest Callback] State decode failed:", e.message);
    }
  }

  if (error || !code) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(error || "No auth code")}`
    );
    return;
  }
  
  if (!companyId) {
    res.redirect(
      `${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=missing_company_context`
    );
    return;
  }

  try {
    const tokenRes = await axios.post(
      "https://api.pinterest.com/v5/oauth/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: PINTEREST_REDIRECT_URI,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`
          ).toString("base64")}`,
        },
      }
    );

    const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn } = tokenRes.data;
    const expiresAt = Math.floor(Date.now() / 1000) + (expiresIn || 2592000);

    const userRes = await axios.get("https://api.pinterest.com/v5/user_account", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    const profile = userRes.data;

    await upsertAccount(
      {
        id: buildScopedAccountId("pinterest", companyId, profile.username),
        platform: "pinterest",
        page_id: profile.username,
        page_name: profile.username || "Pinterest User",
        username: profile.username,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "user",
        expires_at: expiresAt,
        connected_at: new Date().toISOString(),
      },
      companyId,
      clientCompanyId,
    );

    const accounts = await getAllAccounts(companyId, clientCompanyId);
    broadcastSSE("accounts_sync", accounts, { companyId, clientCompanyId });
    broadcastSSE("connection_changed", buildConnectionStatus(accounts), { companyId, clientCompanyId });

    delete req.session.campaignScheduledPinterestOauthState;
    delete req.session.campaignScheduledPinterestContext;

    res.redirect(`${FRONTEND_URL}/campaigns-scheduled?oauth=success&platform=Pinterest`);
  } catch (err) {
    const msg = err?.response?.data?.message || err.message;
    res.redirect(`${FRONTEND_URL}/campaigns-scheduled?oauth=error&reason=${encodeURIComponent(msg)}`);
  }
});


router.use(authMiddleware);
router.use(async (req, _res, next) => {
  try {
    const isClientRole = ["client", "agency_client", "brand_super_admin", "brand_manager", "brand_team_user"].includes(req.user?.role) || (req.user?.role === "user" && req.user?.brandId);
    if (isClientRole) {
      req.clientCompanyId = await resolveClientCompanyId(
        req.user?.clientId || req.user?.brandId || req.user?._id || null,
        req.companyId,
      );
      return next();
    }

    const requestedClientCompanyId = String(
      req.query?.clientCompanyId || req.body?.clientCompanyId || req.headers['x-selected-client-id'] || "",
    ).trim();
    if (!requestedClientCompanyId) {
      req.clientCompanyId = null;
      return next();
    }

    req.clientCompanyId = await resolveClientCompanyId(
      requestedClientCompanyId,
      req.companyId,
    );
    return next();
  } catch (err) {
    return next(err);
  }
});

router.get("/configuration", async (req, res) => {
  const clientCompanyId = req.clientCompanyId || null;
  if (!clientCompanyId) {
    res.json({
      success: true,
      configuration: {
        youtube: {
          googleClientId: "",
          hasGoogleClientSecret: false,
        },
      },
    });
    return;
  }

  const clientCompany = await ClientCompany.findOne({
    _id: clientCompanyId,
    companyId: req.companyId,
  })
    .select("configuration.campaignScheduled")
    .lean();

  const config = clientCompany?.configuration?.campaignScheduled || {};
  const youtube = config.youtube || {};
  const facebook = config.facebook || {};
  const instagram = config.instagram || {};
  const linkedin = config.linkedin || {};

  res.json({
    success: true,
    configuration: {
      youtube: {
        googleClientId: youtube.googleClientId || "",
        hasGoogleClientSecret: Boolean(youtube.googleClientSecret),
        updatedAt: youtube.updatedAt || null,
      },
      facebook: {
        hasAccessToken: Boolean(facebook.accessToken),
        updatedAt: facebook.updatedAt || null,
      },
      instagram: {
        hasAccessToken: Boolean(instagram.accessToken),
        updatedAt: instagram.updatedAt || null,
      },
      linkedin: {
        hasAccessToken: Boolean(linkedin.accessToken),
        updatedAt: linkedin.updatedAt || null,
      },
    },
  });
});

router.put("/configuration/youtube", async (req, res) => {
  const googleClientId = String(req.body?.googleClientId || "").trim();
  const googleClientSecret = String(req.body?.googleClientSecret || "").trim();
  if (!googleClientId || !googleClientSecret) {
    res.status(400).json({
      success: false,
      error: "Both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required",
    });
    return;
  }

  const clientCompanyId = req.clientCompanyId || null;
  if (!clientCompanyId) {
    res.status(400).json({
      success: false,
      error: "Client scope is required to save YouTube configuration",
    });
    return;
  }

  const updated = await ClientCompany.findOneAndUpdate(
    { _id: clientCompanyId, companyId: req.companyId },
    {
      $set: {
        "configuration.campaignScheduled.youtube.googleClientId":
          googleClientId,
        "configuration.campaignScheduled.youtube.googleClientSecret":
          googleClientSecret,
        "configuration.campaignScheduled.youtube.updatedAt": new Date(),
      },
    },
    { returnDocument: 'after' },
  )
    .select("configuration.campaignScheduled.youtube")
    .lean();

  if (!updated) {
    res.status(404).json({ success: false, error: "Client company not found" });
    return;
  }

  res.json({
    success: true,
    configuration: {
      youtube: {
        googleClientId:
          updated?.configuration?.campaignScheduled?.youtube?.googleClientId ||
          "",
        hasGoogleClientSecret: Boolean(
          updated?.configuration?.campaignScheduled?.youtube
            ?.googleClientSecret,
        ),
      },
    },
  });
});

router.get("/accounts", async (req, res) => {
  const accounts = await getAllAccounts(req.companyId, req.clientCompanyId);
  console.log("[DEBUG /accounts] req.companyId:", req.companyId);
  console.log("[DEBUG /accounts] req.clientCompanyId:", req.clientCompanyId);
  console.log("[DEBUG /accounts] accounts returned:", accounts.length, accounts);
  res.json({
    success: true,
    accounts,
  });
});

router.delete("/accounts/:id", async (req, res) => {
  const query = buildScopeQuery(req.companyId, req.clientCompanyId);
  query.id = req.params.id;
  await Account.deleteOne(query);
  const accounts = await getAllAccounts(req.companyId, req.clientCompanyId);
  const scope = {
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId,
  };
  broadcastSSE("accounts_sync", accounts, scope);
  broadcastSSE("connection_changed", buildConnectionStatus(accounts), scope);
  res.json({ success: true });
});

router.get("/connected-accounts", async (req, res) => {
  const accounts = await getAllAccounts(req.companyId, req.clientCompanyId);
  res.json({ success: true, ...buildConnectionStatus(accounts) });
});

router.get("/test-facebook", async (req, res) => {
  const fbAccounts = (
    await getAllAccounts(req.companyId, req.clientCompanyId)
  ).filter((a) => a.platform === "facebook");
  if (fbAccounts.length === 0) {
    res.json({
      success: false,
      error: "No Facebook accounts connected yet",
      accounts: [],
    });
    return;
  }

  const results = await Promise.all(
    fbAccounts.map(async (acc) => {
      if (acc.token_type === "demo") {
        return {
          id: acc.id,
          name: acc.page_name,
          mode: "simulation",
          status: "ok",
          message: "Demo account",
        };
      }
      try {
        const r = await axios.get(`${META_GRAPH}/me/accounts`, {
          params: {
            access_token: acc.access_token,
            fields: "id,name,fan_count",
          },
        });
        const page =
          r.data.data?.find((p) => p.id === acc.page_id) || r.data.data?.[0];
        return {
          id: acc.id,
          name: acc.page_name,
          mode: "live",
          status: "ok",
          page_id: page?.id,
          followers: page?.fan_count,
          message: `Token valid for ${page?.name || "page"}`,
        };
      } catch (err) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          "Unknown error";
        return {
          id: acc.id,
          name: acc.page_name,
          mode: "live",
          status: "error",
          message: msg,
        };
      }
    }),
  );

  res.json({ success: true, results });
});

router.get("/preflight-facebook", async (req, res) => {
  const fbAccounts = (
    await getAllAccounts(req.companyId, req.clientCompanyId)
  ).filter((a) => a.platform === "facebook");
  if (fbAccounts.length === 0) {
    res.json({
      success: false,
      error: "No Facebook accounts connected yet",
      ready: false,
      results: [],
    });
    return;
  }

  const appToken = `${process.env.META_APP_ID}|${process.env.META_SECRET}`;
  const requiredScope = "pages_manage_posts";

  const results = await Promise.all(
    fbAccounts.map(async (acc) => {
      if (acc.token_type === "demo") {
        return {
          id: acc.id,
          name: acc.page_name,
          mode: "simulation",
          ready: true,
          hasRequiredScope: true,
          requiredScope,
          message: "Demo account is always ready",
        };
      }

      try {
        const [pageRes, debugRes] = await Promise.all([
          axios.get(`${META_GRAPH}/me/accounts`, {
            params: {
              access_token: acc.access_token,
              fields: "id,name,fan_count",
            },
          }),
          axios.get(`${META_GRAPH}/debug_token`, {
            params: { input_token: acc.access_token, access_token: appToken },
          }),
        ]);

        const page =
          pageRes.data.data?.find((p) => p.id === acc.page_id) ||
          pageRes.data.data?.[0] ||
          null;
        const scopes = debugRes.data?.data?.scopes || [];
        const granularScopes = debugRes.data?.data?.granular_scopes || [];
        const hasRequiredScope = scopes.includes(requiredScope);
        const pageInGrantedTargets = granularScopes
          .filter((g) => g.scope === requiredScope)
          .some((g) => (g.target_ids || []).includes(acc.page_id));

        const ready = Boolean(page && hasRequiredScope && pageInGrantedTargets);
        return {
          id: acc.id,
          name: acc.page_name,
          mode: "live",
          ready,
          page_id: page?.id || null,
          followers: page?.fan_count ?? null,
          requiredScope,
          hasRequiredScope,
          pageInGrantedTargets,
          scopes,
          message: ready
            ? "Ready to publish to this page"
            : "Not ready: missing scope grant on this page or page not accessible by token",
        };
      } catch (err) {
        const msg =
          err?.response?.data?.error?.message ||
          err?.message ||
          "Unknown error";
        return {
          id: acc.id,
          name: acc.page_name,
          mode: "live",
          ready: false,
          requiredScope,
          hasRequiredScope: false,
          pageInGrantedTargets: false,
          message: msg,
        };
      }
    }),
  );

  res.json({
    success: true,
    requiredScope,
    ready: results.some((r) => r.ready),
    results,
  });
});

router.get("/posts", async (req, res) => {
  const posts = await getAllPosts(req.companyId, req.clientCompanyId);
  res.json({ success: true, posts, total: posts.length });
});

router.post("/posts/refresh-metrics", async (req, res) => {
  await refreshPublishedPostMetrics(req.companyId, req.clientCompanyId);
  const posts = await getAllPosts(req.companyId, req.clientCompanyId);
  broadcastSSE("posts_sync", posts, {
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId,
  });
  res.json({ success: true, posts, total: posts.length });
});

router.get("/analytics", async (req, res) => {
  const posts = await getAllPosts(req.companyId, req.clientCompanyId);
  const accounts = await getAllAccounts(req.companyId, req.clientCompanyId);

  const publishedPosts = posts.filter((p) => p.status === "Published");

  const stats = {
    totalPosts: posts.length,
    publishedPosts: publishedPosts.length,
    scheduledPosts: posts.filter((p) => p.status === "Scheduled").length,
    totalLikes: publishedPosts.reduce((sum, p) => sum + (p.likes || 0), 0),
    totalComments: publishedPosts.reduce(
      (sum, p) => sum + (p.comments || 0),
      0,
    ),
    totalShares: publishedPosts.reduce((sum, p) => sum + (p.shares || 0), 0),
  };

  // Engagement by platform
  const platformStats = {};
  publishedPosts.forEach((post) => {
    // If post has platforms array, use it. If not, fallback to platform_publications keys
    const platformIds = post.platforms?.length
      ? post.platforms
      : Object.keys(post.platform_publications || {});

    platformIds.forEach((platformId) => {
      const account = accounts.find((a) => a.id === platformId);
      const platformName = account ? account.platform : "unknown";

      if (!platformStats[platformName]) {
        platformStats[platformName] = {
          likes: 0,
          comments: 0,
          shares: 0,
          count: 0,
        };
      }

      platformStats[platformName].likes += post.likes || 0;
      platformStats[platformName].comments += post.comments || 0;
      platformStats[platformName].shares += post.shares || 0;
      platformStats[platformName].count += 1;
    });
  });

  // Engagement over time (last 30 days)
  const last30Days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    last30Days.push({
      date: dateStr,
      likes: 0,
      comments: 0,
      shares: 0,
      count: 0,
      platforms: {}, // To store platform-specific daily metrics
    });
  }

  publishedPosts.forEach((post) => {
    let dateStr;
    if (post.published_at) {
      dateStr = post.published_at.split("T")[0];
    } else if (post.scheduled_iso) {
      dateStr = post.scheduled_iso.split("T")[0];
    }

    if (dateStr) {
      const day = last30Days.find((d) => d.date === dateStr);
      if (day) {
        day.likes += post.likes || 0;
        day.comments += post.comments || 0;
        day.shares += post.shares || 0;
        day.count += 1;

        // Platform specific daily metrics
        const platformIds = post.platforms?.length
          ? post.platforms
          : Object.keys(post.platform_publications || {});
        platformIds.forEach((platformId) => {
          const account = accounts.find((a) => a.id === platformId);
          const platformName = account ? account.platform : "unknown";

          if (!day.platforms[platformName]) {
            day.platforms[platformName] = {
              likes: 0,
              comments: 0,
              shares: 0,
              count: 0,
            };
          }
          day.platforms[platformName].likes += post.likes || 0;
          day.platforms[platformName].comments += post.comments || 0;
          day.platforms[platformName].shares += post.shares || 0;
          day.platforms[platformName].count += 1;
        });
      }
    }
  });

  res.json({
    success: true,
    stats,
    platformStats,
    engagementOverTime: last30Days,
    topPosts: publishedPosts
      .sort(
        (a, b) =>
          b.likes + b.comments + b.shares - (a.likes + a.comments + a.shares),
      )
      .slice(0, 10),
  });
});

router.get("/posts/:id/comments", async (req, res) => {
  const post = await Post.findOne({
    id: req.params.id,
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId || null,
  }).lean();
  if (!post) {
    res.status(404).json({ success: false, error: "Post not found" });
    return;
  }
  const comments = await getPostYoutubeComments(
    post,
    25,
    req.companyId,
    req.clientCompanyId,
  );
  res.json({ success: true, comments, commentCount: comments.length });
});

router.post(
  "/youtube/upload",
  mediaUpload.single("video"),
  async (req, res) => {
    try {
      const { title, description } = req.body;
      if (!req.file) {
        res
          .status(400)
          .json({ success: false, error: "Video file is required" });
        return;
      }

      const account = await Account.findOne({
        platform: "youtube",
        ...buildScopeQuery(req.companyId, req.clientCompanyId),
      }).lean();

      if (!account) {
        res.status(404).json({
          success: false,
          error:
            "No connected YouTube account found for this client. Please connect YouTube first in Accounts tab.",
        });
        return;
      }

      // Map title/description to campaign/caption for postToYoutube compatibility
      const postPayload = {
        campaign: title || "Direct Upload",
        caption: description || "",
        media_url: req.file.originalname,
      };

      // Use the existing postToYoutube service which handles tokens, upload, and metadata
      const result = await postToYoutube(account, postPayload, {
        uploadedMedia: {
          buffer: req.file.buffer || null,
          path: req.file.path,
          mimetype: req.file.mimetype,
          originalname: req.file.originalname,
        },
      });

      res.json({
        success: true,
        videoId: result.externalId,
        url: result.url,
        message: "Video uploaded successfully to YouTube",
      });
    } catch (err) {
      console.error("[YouTube Direct Upload] Failed:", err);
      res.status(500).json({
        success: false,
        error:
          err.response?.data?.error?.message ||
          err.message ||
          "YouTube upload failed",
      });
    }
  },
);

router.post("/posts", mediaUpload.any(), async (req, res, next) => {
  try {
    const {
      caption,
      campaign,
      mediaUrl,
      media_url,
      status,
      type,
      scheduledDate,
      scheduledTime,
      scheduledISO,
      platforms: rawPlatforms,
      postMode,
      post_option,
      boards,
    } = req.body;

    if (!caption) {
      res.status(400).json({ success: false, error: "caption is required" });
      return;
    }

    // Handle platforms parsing if it comes as a string (multipart/form-data)
    let platforms = [];
    try {
      platforms =
        typeof rawPlatforms === "string"
          ? JSON.parse(rawPlatforms)
          : rawPlatforms || [];
    } catch (e) {
      platforms = [];
    }
    platforms = [
      ...new Set(
        (Array.isArray(platforms) ? platforms : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    ];

    if (platforms.length === 0) {
      res.status(400).json({
        success: false,
        error: "Please select at least one connected platform.",
      });
      return;
    }

    let finalMediaUrl =
      mediaUrl || media_url || "https://picsum.photos/seed/new/400/400";
    let platform_media_urls = {};

    // If files are uploaded via multer, upload them to Cloudinary
    if (req.files && req.files.length > 0) {
      try {
        for (const file of req.files) {
          const uploadRes = await uploadAnyFileToCloudinary(
            file.path,
            "campaign-posts",
            null,
            { mimetype: file.mimetype },
          );
          
          if (file.fieldname === "media") {
            finalMediaUrl = uploadRes.secure_url;
          } else if (file.fieldname.startsWith("media_")) {
            const accountId = file.fieldname.replace("media_", "");
            platform_media_urls[accountId] = uploadRes.secure_url;
          }
        }
      } catch (err) {
        console.error("[Cloudinary] Upload failed:", err);
        res.status(500).json({
          success: false,
          error: `Media upload to Cloudinary failed: ${err.message || "Unknown error"}`,
        });
        return;
      }
    }

    // Reject if finalMediaUrl is a blob or localhost URL — these are not accessible by the scheduler
    if (
      finalMediaUrl &&
      (finalMediaUrl.startsWith("blob:") || finalMediaUrl.includes("localhost"))
    ) {
      res
        .status(400)
        .json({
          success: false,
          error:
            "Invalid media URL. Please upload the file again — browser-generated URLs cannot be used for scheduled publishing.",
        });
      return;
    }

    const dateStr =
      scheduledDate || toDisplayDate(new Date().toISOString().split("T")[0]);
    const timeStr = scheduledTime || "12:00 PM";

    const newPost = await Post.create({
      companyId: req.companyId,
      clientCompanyId: req.clientCompanyId || null,
      id: randomUUID(),
      caption,
      campaign: campaign || "General",
      media_url: finalMediaUrl,
      platform_media_urls,
      status: status || "Scheduled",
      type: type || "Post Composer",
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      // Use frontend-provided UTC ISO (which knows user's timezone) if valid, else fall back to server-side calculation
      scheduled_iso:
        scheduledISO && !isNaN(new Date(scheduledISO).getTime())
          ? new Date(scheduledISO).toISOString()
          : toISO(dateStr, timeStr),
      postMode: postMode || "scheduled",
      platforms: platforms,
      post_option: post_option ? (typeof post_option === "string" ? JSON.parse(post_option) : post_option) : {},
      boards: boards ? (typeof boards === "string" ? JSON.parse(boards) : boards) : {},
      created_at: new Date().toISOString(),
    });

    const nextLog = [
      {
        id: randomUUID(),
        type: "scheduled",
        postId: newPost.id,
        caption: newPost.caption,
        timestamp: new Date().toISOString(),
        message: `Scheduled for ${dateStr} at ${timeStr}`,
      },
      ...schedulerLogRef(),
    ].slice(0, 50);
    setSchedulerLog(nextLog);

    const scope = {
      companyId: req.companyId,
      clientCompanyId: req.clientCompanyId,
    };
    
    if (postMode !== "immediate") {
      broadcastSSE("post_scheduled", { post: newPost }, scope);
      broadcastSSE(
        "posts_sync",
        await getAllPosts(req.companyId, req.clientCompanyId),
        scope,
      );
    }
    
    res.status(201).json({ success: true, post: newPost });
  } catch (err) {
    console.error("[Campaign Scheduled] Create post failed:", err);
    return next(err);
  }
});

router.put("/posts/:id", mediaUpload.any(), async (req, res) => {
  const post = await Post.findOne({
    id: req.params.id,
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId || null,
  });
  if (!post) {
    res.status(404).json({ success: false, error: "Post not found" });
    return;
  }

  const { platforms: rawPlatforms, ...bodyUpdates } = req.body;
  const updates = { ...bodyUpdates };

  // Handle platforms parsing if it comes as a string (multipart/form-data)
  if (rawPlatforms) {
    try {
      const raw =
        typeof rawPlatforms === "string"
          ? JSON.parse(rawPlatforms)
          : rawPlatforms;
      updates.platforms = [
        ...new Set(
          (Array.isArray(raw) ? raw : [])
            .map((v) => String(v || "").trim())
            .filter(Boolean),
        ),
      ];
    } catch (e) {
      // Keep existing platforms if parse fails
    }
  }

  // Parse boards and post_option from multipart/form-data
  if (updates.boards && typeof updates.boards === "string") {
    try { updates.boards = JSON.parse(updates.boards); } catch (e) { delete updates.boards; }
  }
  if (updates.post_option && typeof updates.post_option === "string") {
    try { updates.post_option = JSON.parse(updates.post_option); } catch (e) { delete updates.post_option; }
  }

  updates.platform_media_urls = post.platform_media_urls || {};

  // If files are uploaded via multer, upload them to Cloudinary
  if (req.files && req.files.length > 0) {
    try {
      for (const file of req.files) {
        const uploadRes = await uploadAnyFileToCloudinary(
          file.path,
          "campaign-posts",
          null,
          { mimetype: file.mimetype },
        );
        
        if (file.fieldname === "media") {
          updates.media_url = uploadRes.secure_url;
        } else if (file.fieldname.startsWith("media_")) {
          const accountId = file.fieldname.replace("media_", "");
          updates.platform_media_urls[accountId] = uploadRes.secure_url;
        }
      }
    } catch (err) {
      console.error("[Cloudinary] Update upload failed:", err);
    }
  }
  if (updates.mediaUrl) {
    updates.media_url = updates.mediaUrl;
    delete updates.mediaUrl;
  }
  if (updates.scheduledDate) {
    updates.scheduled_date = updates.scheduledDate;
    delete updates.scheduledDate;
  }
  if (updates.scheduledTime) {
    updates.scheduled_time = updates.scheduledTime;
    delete updates.scheduledTime;
  }
  // Use frontend-provided UTC ISO if valid (fixes IST→UTC timezone offset bug)
  if (
    updates.scheduledISO &&
    !isNaN(new Date(updates.scheduledISO).getTime())
  ) {
    updates.scheduled_iso = new Date(updates.scheduledISO).toISOString();
    delete updates.scheduledISO;
  } else if (updates.scheduled_date || updates.scheduled_time) {
    const d = updates.scheduled_date || post.scheduled_date;
    const t = updates.scheduled_time || post.scheduled_time;
    updates.scheduled_iso = toISO(d, t);
  }

  await Post.updateOne(
    {
      id: req.params.id,
      companyId: req.companyId,
      clientCompanyId: req.clientCompanyId || null,
    },
    { $set: updates },
  );
  const updated = await Post.findOne({
    id: req.params.id,
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId || null,
  }).lean();
  const scope = {
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId,
  };
  if (updated.postMode !== "immediate") {
    broadcastSSE("post_updated", { post: updated }, scope);
    broadcastSSE(
      "posts_sync",
      await getAllPosts(req.companyId, req.clientCompanyId),
      scope,
    );
  }
  res.json({ success: true, post: updated });
});

router.delete("/posts/:id", async (req, res) => {
  const post = await Post.findOne({
    id: req.params.id,
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId || null,
  });
  if (!post) {
    res.status(404).json({ success: false, error: "Post not found" });
    return;
  }
  await Post.deleteOne({
    id: req.params.id,
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId || null,
  });
  const scope = {
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId,
  };
  broadcastSSE("post_deleted", { postId: req.params.id }, scope);
  broadcastSSE(
    "posts_sync",
    await getAllPosts(req.companyId, req.clientCompanyId),
    scope,
  );
  res.json({ success: true });
});

router.post("/posts/:id/publish", async (req, res) => {
  const post = await Post.findOneAndUpdate(
    {
      id: req.params.id,
      companyId: req.companyId,
      clientCompanyId: req.clientCompanyId || null,
      status: { $nin: ["Published", "Publishing"] },
    },
    { $set: { status: "Publishing" } },
    { returnDocument: 'after' },
  ).lean();

  if (!post) {
    const existingPost = await Post.findOne({
      id: req.params.id,
      companyId: req.companyId,
      clientCompanyId: req.clientCompanyId || null,
    }).lean();

    if (!existingPost) {
      return res.status(404).json({ success: false, error: "Post not found" });
    }

    return res.json({
      success: true,
      post: existingPost,
      message: "Publishing already initiated in background...",
    });
  }

  const scope = {
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId,
  };

  // Broadcast the "Publishing" state to the frontend immediately before blocking on dispatchPost
  broadcastSSE(
    "posts_sync",
    await getAllPosts(req.companyId, req.clientCompanyId),
    scope,
  );

  const result = await dispatchPost(post);
  const publicationMap = result.platformResults || {};

  const updateData = {
    platform_publications: publicationMap,
    ...(result.metrics
      ? {
          likes: result.metrics.likes,
          comments: result.metrics.comments,
          shares: result.metrics.shares,
        }
      : {}),
  };

  if (result.success) {
    updateData.status = "Published";
    updateData.published_at = new Date().toISOString();
    updateData.error_message = null;
  } else {
    updateData.status = "Failed";
    updateData.error_message = result.message;
  }

  await Post.updateOne({ _id: post._id }, { $set: updateData });

  const updated = await Post.findOne({
    id: post.id,
    companyId: req.companyId,
    clientCompanyId: req.clientCompanyId || null,
  }).lean();


  if (result.success) {
    broadcastSSE("post_published", { post: updated }, scope);
    broadcastSSE(
      "posts_sync",
      await getAllPosts(req.companyId, req.clientCompanyId),
      scope,
    );
    res.json({ success: true, post: updated, message: result.message });
  } else {
    broadcastSSE("post_failed", { post: updated }, scope);
    broadcastSSE(
      "posts_sync",
      await getAllPosts(req.companyId, req.clientCompanyId),
      scope,
    );
    res
      .status(502)
      .json({ success: false, error: result.message, post: updated });
  }
});

router.post(
  "/posts/:id/publish-with-media",
  mediaUpload.single("media"),
  async (req, res) => {
    const post = await Post.findOneAndUpdate(
      {
        id: req.params.id,
        companyId: req.companyId,
        clientCompanyId: req.clientCompanyId || null,
        status: { $nin: ["Published", "Publishing"] },
      },
      { $set: { status: "Publishing" } },
      { returnDocument: 'after' },
    ).lean();

    if (!post) {
      const existingPost = await Post.findOne({
        id: req.params.id,
        companyId: req.companyId,
        clientCompanyId: req.clientCompanyId || null,
      }).lean();

      if (!existingPost) {
        return res.status(404).json({ success: false, error: "Post not found" });
      }

      return res.json({
        success: true,
        post: existingPost,
        message: "Publishing already initiated in background...",
      });
    }

    let finalMediaUrl = post.media_url;
    const uploadedMedia = req.file
      ? {
          buffer: req.file.buffer || null,
          path: req.file.path,
          mimetype: req.file.mimetype,
          originalname: req.file.originalname,
        }
      : null;

    const scope = {
      companyId: req.companyId,
      clientCompanyId: req.clientCompanyId,
    };

    // Broadcast the "Publishing" state to the frontend immediately before returning
    broadcastSSE(
      "posts_sync",
      await getAllPosts(req.companyId, req.clientCompanyId),
      scope,
    );

    // Send immediate response so Nginx doesn't timeout
    res.json({
      success: true,
      post,
      message: "Publishing initiated in background...",
    });

    // Run the rest asynchronously
    (async () => {
      try {
        if (req.file) {
          try {
            const uploadRes = await uploadAnyFileToCloudinary(
              req.file.path,
              "campaign-posts",
              null,
              { mimetype: req.file.mimetype },
            );
            finalMediaUrl = uploadRes.secure_url;
          } catch (err) {
            console.error("[Cloudinary] Publish upload failed:", err);
          }
        }

        const result = await dispatchPost(post, { uploadedMedia });
        if (result.success) {
          await Post.updateOne(
            { _id: post._id },
            {
              $set: {
                status: "Published",
                media_url: finalMediaUrl,
                published_at: new Date().toISOString(),
                error_message: null,
                platform_publications: result.platformResults || {},
                ...(result.metrics
                  ? {
                      likes: result.metrics.likes,
                      comments: result.metrics.comments,
                      shares: result.metrics.shares,
                    }
                  : {}),
              },
            },
          );
          const updated = await Post.findOne({
            id: post.id,
            companyId: req.companyId,
            clientCompanyId: req.clientCompanyId || null,
          }).lean();
          const scope = {
            companyId: req.companyId,
            clientCompanyId: req.clientCompanyId,
          };
          broadcastSSE("post_published", { post: updated }, scope);
          broadcastSSE(
            "posts_sync",
            await getAllPosts(req.companyId, req.clientCompanyId),
            scope,
          );
        } else {
          await Post.updateOne(
            { _id: post._id },
            { $set: { status: "Failed", error_message: result.message, platform_publications: result.platformResults || {} } },
          );
          const updated = await Post.findOne({
            id: post.id,
            companyId: req.companyId,
            clientCompanyId: req.clientCompanyId || null,
          }).lean();
          const scope = {
            companyId: req.companyId,
            clientCompanyId: req.clientCompanyId,
          };
          broadcastSSE("post_failed", { post: updated }, scope);
          broadcastSSE(
            "posts_sync",
            await getAllPosts(req.companyId, req.clientCompanyId),
            scope,
          );
        }
      } catch (err) {
        console.error("[Background Publish] Error:", err);
        await Post.updateOne(
          { _id: post._id },
          { $set: { status: "Failed", error_message: err.message } },
        );
        const updated = await Post.findOne({
          id: post.id,
          companyId: req.companyId,
          clientCompanyId: req.clientCompanyId || null,
        }).lean();
        const scope = {
          companyId: req.companyId,
          clientCompanyId: req.clientCompanyId,
        };
        broadcastSSE("post_failed", { post: updated }, scope);
        broadcastSSE(
          "posts_sync",
          await getAllPosts(req.companyId, req.clientCompanyId),
          scope,
        );
      }
    })();
  },
);

router.get("/scheduler/status", async (req, res) => {
  const now = new Date();
  const all = await getAllPosts(req.companyId, req.clientCompanyId);
  const pending = all
    .filter((p) => p.status === "Scheduled")
    .sort(
      (a, b) =>
        new Date(a.scheduled_iso).getTime() -
        new Date(b.scheduled_iso).getTime(),
    );
  const nextPost = pending.find((p) => new Date(p.scheduled_iso) > now);
  const overdueCount = pending.filter(
    (p) => new Date(p.scheduled_iso) <= now,
  ).length;

  res.json({
    success: true,
    scheduler: {
      isRunning: true,
      mode: hasMetaCredentials() ? "live" : "simulation",
      hasMetaCredentials: hasMetaCredentials(),
      pendingCount: pending.length,
      overdueCount,
      nextPost: nextPost
        ? {
            id: nextPost.id,
            caption: nextPost.caption.slice(0, 60),
            scheduledISO: nextPost.scheduled_iso,
            scheduledDate: nextPost.scheduled_date,
            scheduledTime: nextPost.scheduled_time,
            platforms: nextPost.platforms,
          }
        : null,
      recentLog: schedulerLogRef().slice(0, 10),
      totalPublished: all.filter((p) => p.status === "Published").length,
      totalFailed: all.filter((p) => p.status === "Failed").length,
      serverTime: toIST(now).toISOString().replace("Z", "") + " IST",
    },
  });
});

router.get("/meta/status", async (req, res) => {
  const configured = hasMetaCredentials();
  const linkedInConfigured = hasLinkedInCredentials();
  const ytCreds = await getYoutubeCredentialsForScope(
    req.companyId,
    req.clientCompanyId || null,
  );
  const youtubeConfigured = Boolean(ytCreds.clientId && ytCreds.clientSecret);
  const pinterestConfigured = hasPinterestCredentials();
  res.json({
    success: true,
    configured,
    linkedInConfigured,
    youtubeConfigured,
    pinterestConfigured,
    appId: process.env.META_APP_ID
      ? `${process.env.META_APP_ID.slice(0, 6)}...`
      : null,
    linkedInClientId: process.env.LINKEDIN_CLIENT_ID
      ? `${process.env.LINKEDIN_CLIENT_ID.slice(0, 6)}...`
      : null,
    oauthUrl: configured ? "/api/campaign-scheduled/auth/facebook" : null,
    linkedInOauthUrl: linkedInConfigured
      ? "/api/campaign-scheduled/auth/linkedin"
      : null,
    youtubeOauthUrl: youtubeConfigured
      ? "/api/campaign-scheduled/auth/youtube"
      : null,
    pinterestOauthUrl: pinterestConfigured
      ? "/api/campaign-scheduled/auth/pinterest"
      : null,
    instructions: configured
      ? []
      : [
          "1. Create Meta App at developers.facebook.com",
          "2. Add META_APP_ID and META_SECRET in server .env",
          `3. Add redirect URI: ${REDIRECT_URI}`,
          "4. Restart backend server",
        ],
    linkedInInstructions: linkedInConfigured
      ? []
      : [
          "1. Create LinkedIn app at developer.linkedin.com",
          "2. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in server .env",
          `3. Add redirect URI: ${LINKEDIN_REDIRECT_URI}`,
          "4. Request openid, profile, w_member_social, r_member_social, w_organization_social, and r_organization_social products/scopes",
          "5. Restart backend server",
        ],
    youtubeInstructions: youtubeConfigured
      ? []
      : [
          "1. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server .env",
          `2. In Google Cloud OAuth app, add redirect URI: ${YOUTUBE_REDIRECT_URI}`,
          "3. Ensure youtube.upload and youtube.readonly scopes are approved",
          "4. Restart backend server",
        ],
  });
});

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    time: new Date().toISOString(),
    mode: hasMetaCredentials() ? "live" : "simulation",
  });
});

router.post("/migrate", async (req, res) => {
  try {
    const count = await migrateLegacyPosts();
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/pinterest/boards/:accountId", async (req, res) => {
  try {
    const account = await Account.findOne({
      id: req.params.accountId,
      companyId: req.companyId,
      clientCompanyId: req.clientCompanyId || null,
    }).lean();
    if (!account) return res.status(404).json({ success: false, error: "Account not found" });

    const boardsRes = await axios.get("https://api.pinterest.com/v5/boards", {
      headers: { Authorization: `Bearer ${account.access_token}` },
    });

    res.json({ success: true, boards: boardsRes.data.items || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err?.response?.data?.message || err.message });
  }
});
router.get("/auth/facebook/discovery", authMiddleware, async (req, res) => {
  try {
    const companyId = req.companyId;
    const tempDoc = await Discovery.findOne({ id: `fb_temp_${companyId}` });
    
    if (!tempDoc || !tempDoc.data) {
      return res.status(200).json({ success: true, discoveredPages: [] });
    }
    
    res.status(200).json({ 
      success: true, 
      discoveredPages: tempDoc.data.discoveredPages || [] 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


router.post("/auth/facebook/manual-page", authMiddleware, async (req, res) => {
  try {
    const { pageIds = [], instaIds = [] } = req.body;
    const companyId = req.companyId;
    const clientCompanyId = req.clientCompanyId || null;

    if (pageIds.length === 0 && instaIds.length === 0) {
      throw new Error("At least one Page ID or Instagram ID is required");
    }

    // Retrieve the temp token from the Discovery DB
    const tempDoc = await Discovery.findOne({ id: `fb_temp_${companyId}` });
    if (!tempDoc || !tempDoc.data || !tempDoc.data.longToken) {
      throw new Error("OAuth session expired. Please connect again.");
    }

    const { longToken, expiresAt, discoveredPages = [] } = tempDoc.data;

    // Connect Facebook Pages
    for (const pageId of pageIds) {
      let fbPageData = null;
      try {
        const manualPageRes = await axios.get(`${META_GRAPH}/${pageId}`, {
          params: { access_token: longToken, fields: "id,name,access_token" },
        });
        fbPageData = manualPageRes.data;
      } catch (err) {
        console.warn(`[FB Manual Page] Failed to fetch page ${pageId}:`, err.message);
        continue;
      }

      if (fbPageData && fbPageData.id) {
        const facebookAccountId = buildScopedAccountId("fb", companyId, fbPageData.id);
        await upsertAccount(
          {
            id: facebookAccountId,
            platform: "facebook",
            page_id: fbPageData.id,
            page_name: fbPageData.name,
            username: fbPageData.name,
            access_token: fbPageData.access_token,
            token_type: "page",
            expires_at: expiresAt,
            connected_at: new Date().toISOString(),
          },
          companyId,
          clientCompanyId,
        );
      }
    }

    // Connect Instagram Accounts
    for (const instaId of instaIds) {
      let finalPageId = null;
      let fallbackToUserToken = false;

      // Check if we discovered the page in oauth callback
      const discoveredPage = discoveredPages.find(p => p.instagram_business_account?.id === instaId);
      if (discoveredPage) {
        finalPageId = discoveredPage.id;
      } else {
        // Try to auto-discover
        try {
          const accountsRes = await axios.get(`${META_GRAPH}/me/accounts`, {
            params: { access_token: longToken, fields: "id,name,access_token,instagram_business_account" },
          });
          const accounts = accountsRes.data?.data || [];
          const matchingPage = accounts.find(p => p.instagram_business_account?.id === instaId);
          if (matchingPage) {
            finalPageId = matchingPage.id;
          } else {
            fallbackToUserToken = true;
          }
        } catch (err) {
          fallbackToUserToken = true;
        }
      }

      let fbPageData = null;
      if (finalPageId) {
        try {
          const manualPageRes = await axios.get(`${META_GRAPH}/${finalPageId}`, {
            params: { access_token: longToken, fields: "id,name,access_token" },
          });
          fbPageData = manualPageRes.data;
        } catch (err) {
          fallbackToUserToken = true;
        }
      }

      const instagramAccountId = buildScopedAccountId("ig", companyId, instaId);
      let igUsername = instaId;
      try {
        const igRes = await axios.get(`${META_GRAPH}/${instaId}`, {
          params: {
            fields: "username,name",
            access_token: fbPageData ? fbPageData.access_token : longToken,
          },
        });
        igUsername = igRes.data.username || igRes.data.name || instaId;
      } catch (err) {
        console.warn(`[FB Manual Page] Failed to fetch explicit IG details for ${instaId}:`, err.message);
      }

      await upsertAccount(
        {
          id: instagramAccountId,
          platform: "instagram",
          page_id: fbPageData ? fbPageData.id : null,
          page_name: fbPageData ? fbPageData.name : null,
          ig_user_id: instaId,
          username: igUsername,
          access_token: fbPageData ? fbPageData.access_token : longToken,
          token_type: fbPageData ? "page" : "user",
          expires_at: expiresAt,
          connected_at: new Date().toISOString(),
        },
        companyId,
        clientCompanyId,
      );
    }

    // Cleanup temp token
    await Discovery.deleteOne({ id: `fb_temp_${companyId}` });

    const accounts = await getAllAccounts(companyId, clientCompanyId);
    const scope = { companyId, clientCompanyId };
    broadcastSSE("accounts_sync", accounts, scope);
    broadcastSSE("connection_changed", buildConnectionStatus(accounts), scope);

    res.json({ success: true });
  } catch (err) {
    console.error("[FB Manual Page Error]:", err.message);
    res.status(500).json({ 
      success: false, 
      error: err?.response?.data?.error?.message || err.message 
    });
  }
});

module.exports = router;

