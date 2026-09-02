const axios = require("axios");
const { randomUUID } = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");
const { google } = require("googleapis");
const Account = require("./campaignScheduled.account.model");
const Post = require("./campaignScheduled.post.model");
const ClientCompany = require("../auth/user.model");
const { postToGoogleBusiness } = require("./googleBusiness.service");

const META_APP_ID = process.env.META_APP_ID || "";
const META_SECRET = process.env.META_SECRET || "";
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID || "";
const LINKEDIN_CLIENT_SECRET = (
  process.env.LINKEDIN_CLIENT_SECRET || ""
).replace(/['"]/g, "");
const LINKEDIN_API_VERSION = (
  process.env.LINKEDIN_API_VERSION || "202604"
).trim();
const YOUTUBE_API_KEY =
  process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || "";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const APP_URL = process.env.APP_URL || `https://tunepath.askeva.io`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const APP_BASE_URL = APP_URL.replace(/\/+$/, "");
const REDIRECT_URI = (
  process.env.REDIRECT_URI_FACEBOOK ||
  `${APP_BASE_URL}/api/campaign-scheduled/auth/facebook/callback`
).trim();
const LINKEDIN_REDIRECT_URI = (
  process.env.REDIRECT_URI_LINKEDIN ||
  `${APP_BASE_URL}/api/campaign-scheduled/auth/linkedin/callback`
).trim();
const YOUTUBE_REDIRECT_URI = (
  process.env.REDIRECT_URI_YOUTUBE ||
  `${APP_BASE_URL}/api/campaign-scheduled/auth/youtube/callback`
).trim();
const PINTEREST_CLIENT_ID = process.env.PINTEREST_CLIENT_ID || "";
const PINTEREST_CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET || "";
const PINTEREST_REDIRECT_URI = (
  process.env.REDIRECT_URI_PINTEREST ||
  `${APP_BASE_URL}/api/campaign-scheduled/auth/pinterest/callback`
).trim();
const META_GRAPH = "https://graph.facebook.com/v20.0";

const FB_SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_content_publish",
  "business_management"
].join(",");
const LINKEDIN_SCOPES = [
  "openid",
  "profile",
  "email",
  "w_member_social",
  // "r_member_social",
  "w_organization_social",
  // "r_organization_social",
  "rw_organization_admin",
  "r_ads",
  "rw_ads",
].join(" ");
const YOUTUBE_SCOPES = [
  "openid",
  "profile",
  "email",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
].join(" ");
const PINTEREST_SCOPES = [
  "user_accounts:read",
  "boards:read",
  "boards:write",
  "pins:read",
  "pins:write",
  "ads:read",
  "catalogs:read",
].join(",");

const sseClients = new Set();
let schedulerLog = [];

function buildScopeQuery(companyId, clientCompanyId = null) {
  if (!companyId) return {};
  if (!clientCompanyId) {
    return {
      companyId,
      clientCompanyId: null,
    };
  }

  // When a specific client is requested, we search for:
  // 1. Posts/Accounts explicitly linked to this client under this agency (companyId + clientCompanyId)
  // 2. Posts/Accounts where this client ID is used as the primary companyId (Legacy/Invoice-style pattern)
  // 3. Posts/Accounts where this client ID is just the clientCompanyId (useful when clients fetch their own data)
  return {
    $or: [
      { companyId, clientCompanyId }, 
      { companyId: clientCompanyId },
      { clientCompanyId }
    ],
  };
}

function hasMetaCredentials() {
  return Boolean(
    META_APP_ID && META_SECRET && META_APP_ID !== "YOUR_META_APP_ID",
  );
}

function hasLinkedInCredentials() {
  return Boolean(
    LINKEDIN_CLIENT_ID &&
    LINKEDIN_CLIENT_SECRET &&
    LINKEDIN_CLIENT_ID !== "YOUR_LINKEDIN_CLIENT_ID",
  );
}

function hasYoutubeCredentials() {
  // YouTube credentials can be client-scoped OR global in .env
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function hasPinterestCredentials() {
  return Boolean(PINTEREST_CLIENT_ID && PINTEREST_CLIENT_SECRET);
}

async function getYoutubeCredentialsForScope(
  companyId,
  clientCompanyId = null,
) {
  // 1. Try client-scoped credentials first
  if (clientCompanyId) {
    const clientCompany = await ClientCompany.findOne({
      _id: clientCompanyId,
      companyId,
    })
      .select("configuration.campaignScheduled.youtube")
      .lean();

    const scopedClientId =
      clientCompany?.configuration?.campaignScheduled?.youtube
        ?.googleClientId || "";
    const scopedClientSecret =
      clientCompany?.configuration?.campaignScheduled?.youtube
        ?.googleClientSecret || "";

    if (scopedClientId && scopedClientSecret) {
      return {
        clientId: scopedClientId,
        clientSecret: scopedClientSecret,
        source: "scoped",
      };
    }
  }

  // 2. Fallback to global credentials in .env
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    return {
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      source: "env",
    };
  }

  return {
    clientId: "",
    clientSecret: "",
    source: "none",
  };
}

function toIST(date = new Date()) {
  const d = typeof date === "string" ? new Date(date) : date;
  // Add 5 hours and 30 minutes for IST
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
}

function toISO(dateStr, timeStr) {
  try {
    // If the input doesn't have a timezone, assume IST (+05:30)
    const dateTimeStr = `${dateStr} ${timeStr}`;
    const finalStr = dateTimeStr.match(/Z|[+-]\d{2}:\d{2}$/)
      ? dateTimeStr
      : `${dateTimeStr} +05:30`;
    const d = new Date(finalStr);
    return Number.isNaN(d.getTime())
      ? new Date().toISOString()
      : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function toDisplayDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  const mon = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${mon[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

function buildConnectionStatus(accounts) {
  const list = accounts || [];
  return {
    facebook: list.some((a) => a.platform === "facebook"),
    instagram: list.some((a) => a.platform === "instagram"),
    linkedin: list.some((a) => a.platform === "linkedin"),
    youtube: list.some((a) => a.platform === "youtube"),
    pinterest: list.some((a) => a.platform === "pinterest"),
    any: list.length > 0,
    accounts: list.map((a) => ({
      id: a.id,
      platform: a.platform,
      name: a.page_name || a.username || a.id,
      ig_user_id: a.ig_user_id,
    })),
  };
}

function broadcastSSE(event, data, scope = null) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const scopeQuery =
    scope && typeof scope === "object"
      ? buildScopeQuery(scope.companyId, scope.clientCompanyId)
      : buildScopeQuery(scope, null);
  for (const client of sseClients) {
    try {
      if (
        scopeQuery.companyId &&
        String(client.companyId || "") !== String(scopeQuery.companyId)
      )
        continue;
      if (Object.prototype.hasOwnProperty.call(scopeQuery, "clientCompanyId")) {
        if (
          String(client.clientCompanyId || "") !==
          String(scopeQuery.clientCompanyId || "")
        )
          continue;
      }
      client.res.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function getAllPosts(companyId, clientCompanyId = null) {
  const query = buildScopeQuery(companyId, clientCompanyId);
  return Post.find(query).sort({ createdAt: -1 }).lean();
}

async function getAllAccounts(companyId, clientCompanyId = null) {
  const query = buildScopeQuery(companyId, clientCompanyId);
  return Account.find(query).sort({ createdAt: -1 }).lean().then(res => {
    require('fs').appendFileSync('accounts_debug.log', `getAllAccounts returned ${res.length} items for companyId: ${companyId}, clientCompanyId: ${clientCompanyId}\n`);
    return res;
  });
}

// async function seedDemoPosts() {
//   const existingCount = await Post.countDocuments({});
//   if (existingCount > 0) return;

//   const demoPosts = [
//     {
//       id: "seed-1",
//       caption: "Launch your brand with our summer campaign.",
//       campaign: "Q4 Growth",
//       media_url: "https://picsum.photos/seed/marketing1/400/400",
//       status: "Scheduled",
//       type: "Post Composer",
//       scheduled_date: "Nov 25, 2026",
//       scheduled_time: "09:30 AM",
//       scheduled_iso: "2026-11-25T09:30:00.000Z",
//       platforms: ["demo-fb-1"],
//       created_at: new Date().toISOString(),
//     },
//     {
//       id: "seed-2",
//       caption: "Case study spotlight from this month.",
//       campaign: "Case Studies",
//       media_url: "https://picsum.photos/seed/success1/400/400",
//       status: "Draft",
//       type: "Post Composer",
//       scheduled_date: "Nov 26, 2026",
//       scheduled_time: "11:00 AM",
//       scheduled_iso: "2026-11-26T11:00:00.000Z",
//       platforms: ["demo-fb-1"],
//       created_at: new Date().toISOString(),
//     },
//   ];

//   await Post.insertMany(demoPosts);
// }

async function upsertAccount(data, companyId, clientCompanyId = null) {
  if (!companyId)
    throw new Error("companyId is required for campaign account upsert");
  const payload = {
    ...data,
    companyId,
    clientCompanyId: clientCompanyId || null,
  };
  await Account.findOneAndUpdate(
    { id: data.id, companyId, clientCompanyId: clientCompanyId || null },
    payload,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (clientCompanyId && data.platform === "linkedin") {
    await ClientCompany.updateOne(
      { _id: clientCompanyId },
      {
        $set: {
          "configuration.campaignScheduled.linkedin": {
            accessToken: data.access_token,
            linkedinId: data.page_id,
            updatedAt: new Date(),
          },
        },
      },
    );
  }
}

async function postToFacebook(account, post) {
  const options = post.post_option || {};
  const platformOption =
    options.facebook || options.facebook_standard || options.standard || "feed";
  const isReel =
    platformOption === "reel" ||
    platformOption === "video_short" ||
    platformOption === "short";

  const hasMedia =
    post.media_url &&
    (Array.isArray(post.media_url) ? post.media_url.length > 0 : (post.media_url.startsWith("http") && !post.media_url.includes("picsum")));

  const firstMedia = Array.isArray(post.media_url) ? post.media_url[0] : post.media_url;
  const isVideo =
    hasMedia && /\.(mp4|mov|avi|webm|mkv)$/i.test(firstMedia);

  const isCarousel = Array.isArray(post.media_url) && post.media_url.length > 1;

  if (isVideo && isReel) {
    // Facebook Reels Flow
    const startRes = await axios.post(
      `${META_GRAPH}/${account.page_id}/video_reels`,
      {
        upload_phase: "start",
        access_token: account.access_token,
      },
    );

    const { upload_url, video_reel_id } = startRes.data;

    // Download and upload video to FB
    const videoRes = await axios.get(firstMedia, {
      responseType: "arraybuffer",
    });
    await axios.post(upload_url, videoRes.data, {
      headers: {
        Authorization: `OAuth ${account.access_token}`,
        file_url: firstMedia,
      },
    });

    // Finish publishing
    const finishRes = await axios.post(
      `${META_GRAPH}/${account.page_id}/video_reels`,
      {
        upload_phase: "finish",
        video_reel_id,
        video_state: "PUBLISHED",
        description: post.caption,
        access_token: account.access_token,
      },
    );

    return {
      externalId: video_reel_id,
      url: `https://www.facebook.com/reels/${video_reel_id}/`,
    };
  }

  if (isVideo) {
    // Standard Video Flow
    const res = await axios.post(`${META_GRAPH}/${account.page_id}/videos`, {
      file_url: firstMedia,
      description: post.caption,
      access_token: account.access_token,
    });
    const postId = res.data.id;
    return {
      externalId: postId,
      url: `https://www.facebook.com/${postId}`,
    };
  }

  if (isCarousel) {
    const attached_media = [];
    for (const url of post.media_url) {
      const res = await axios.post(`${META_GRAPH}/${account.page_id}/photos`, {
        url: url,
        published: false,
        access_token: account.access_token,
      });
      attached_media.push({ media_fbid: res.data.id });
    }
    const res = await axios.post(`${META_GRAPH}/${account.page_id}/feed`, {
      message: post.caption,
      attached_media: attached_media,
      access_token: account.access_token,
    });
    const postId = res.data.id;
    return {
      externalId: postId,
      url: `https://www.facebook.com/${postId}`,
    };
  } else if (hasMedia) {
    // Photo Flow
    const res = await axios.post(`${META_GRAPH}/${account.page_id}/photos`, {
      url: firstMedia,
      message: post.caption,
      access_token: account.access_token,
    });
    // For photos, the id returned is the Photo ID, and post_id is the Feed Post ID.
    const postId = res.data.post_id || res.data.id;
    return {
      externalId: postId,
      url: `https://www.facebook.com/${postId}`,
    };
  }

  // Text-only Flow
  const body = {
    message: post.caption,
    access_token: account.access_token,
  };
  const res = await axios.post(`${META_GRAPH}/${account.page_id}/feed`, body);
  const postId = res.data.id;
  return {
    externalId: postId,
    url: `https://www.facebook.com/${postId}`,
  };
}

async function postToInstagram(account, post, options = {}) {
  if (!account.ig_user_id)
    throw new Error("No Instagram user ID linked to this account");

  const hasMedia =
    post.media_url &&
    (Array.isArray(post.media_url) ? post.media_url.length > 0 : (post.media_url.startsWith("http") && !post.media_url.includes("picsum")));

  if (!hasMedia) {
    throw new Error(
      "Instagram requires a valid media URL (image or video) to publish a post. Text-only posts are not supported."
    );
  }

  const isCarousel = Array.isArray(post.media_url) && post.media_url.length > 1;
  const firstMedia = Array.isArray(post.media_url) ? post.media_url[0] : post.media_url;

  // Determine media type from post or options
  let mediaType = "IMAGE";
  if (firstMedia && /\.(mp4|mov|avi|webm|mkv)$/i.test(firstMedia)) {
    mediaType = "VIDEO";
  }
  if (options.mediaType) {
    mediaType = options.mediaType.toUpperCase();
  }

  const containerPayload = {
    caption: post.caption || "",
    access_token: account.access_token,
  };

  const postOptions = post.post_option || {};
  const platformOption =
    postOptions.instagram || postOptions.standard || "feed";
  const isReel =
    platformOption === "reel" ||
    platformOption === "video_short" ||
    platformOption === "short";
    
  const enforceJpegForInstagram = (url) => {
    if (typeof url === 'string' && url.includes('res.cloudinary.com') && !/\.(mp4|mov|avi|webm|mkv)(\?.*)?$/i.test(url)) {
      return url.replace(/\.(png|webp|gif|jpeg)(\?.*)?$/i, '.jpg$2');
    }
    return url;
  };
    
  let creationId;

  if (isCarousel) {
    const childrenIds = [];
    for (const url of post.media_url) {
      const formattedUrl = enforceJpegForInstagram(url);
      const itemRes = await axios.post(`${META_GRAPH}/${account.ig_user_id}/media`, {
        image_url: formattedUrl,
        is_carousel_item: true,
        access_token: account.access_token
      });
      childrenIds.push(itemRes.data.id);
    }
    
    for (const id of childrenIds) {
      let ready = false;
      for (let i = 0; i < 10; i += 1) {
        const statusRes = await axios.get(`${META_GRAPH}/${id}`, { params: { fields: "status_code", access_token: account.access_token }});
        if (statusRes.data.status_code === "FINISHED") { ready = true; break; }
        await new Promise(r => setTimeout(r, 1500));
      }
      if (!ready) throw new Error("Carousel item did not finish processing");
    }

    const carouselRes = await axios.post(`${META_GRAPH}/${account.ig_user_id}/media`, {
      media_type: "CAROUSEL",
      caption: post.caption || "",
      children: childrenIds.join(","),
      access_token: account.access_token
    });
    
    creationId = carouselRes.data.id;
  } else {
    if (mediaType === "VIDEO") {
      containerPayload.media_type = "REELS";
      containerPayload.video_url = firstMedia;
      containerPayload.share_to_feed = true;
    } else {
      containerPayload.image_url = enforceJpegForInstagram(firstMedia);
    }

    const containerRes = await axios.post(
      `${META_GRAPH}/${account.ig_user_id}/media`,
      containerPayload,
    );

    creationId = containerRes.data.id;

    // For videos, poll until status = FINISHED (max ~60s)
    if (mediaType === "VIDEO") {
      const maxAttempts = 20;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await axios.get(`${META_GRAPH}/${creationId}`, {
          params: { fields: "status_code", access_token: account.access_token },
        });
        if (statusRes.data.status_code === "FINISHED") break;
        if (statusRes.data.status_code === "ERROR") {
          throw new Error("Video processing failed on Instagram");
        }
      }
    } else {
      // For images, wait a bit then check status
      let ready = false;
      for (let i = 0; i < 10; i += 1) {
        const statusRes = await axios.get(`${META_GRAPH}/${creationId}`, {
          params: { fields: "status_code", access_token: account.access_token },
        });
        if (statusRes.data.status_code === "FINISHED") {
          ready = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!ready)
        throw new Error("Instagram media container did not finish processing");
    }
  }

  const publishRes = await axios.post(
    `${META_GRAPH}/${account.ig_user_id}/media_publish`,
    {
      creation_id: creationId,
      access_token: account.access_token,
    },
  );
  const mediaId = publishRes.data.id;

  let permalink = null;
  try {
    const mediaInfo = await axios.get(`${META_GRAPH}/${mediaId}`, {
      params: { fields: "permalink", access_token: account.access_token },
    });
    permalink = mediaInfo.data.permalink;
  } catch (err) {
    console.error(
      `[Instagram] Failed to fetch permalink for ${mediaId}:`,
      err.message,
    );
  }

  return {
    externalId: mediaId,
    url: permalink,
  };
}

function getLinkedInRestHeaders(token, extraHeaders = {}) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": LINKEDIN_API_VERSION,
    ...extraHeaders,
  };
}

function getLinkedInPostTitle(post) {
  // Use campaign name if it exists and is not a generic placeholder
  if (
    post.campaign &&
    !["General", "Campaign", "Default", "None"].includes(post.campaign)
  ) {
    return post.campaign;
  }
  // Return null to signify no title should be shown in the media box
  return null;
}

function normalizeLinkedInUploadPartId(etag) {
  if (!etag) return null;
  return String(etag)
    .trim()
    .replace(/^W\//, "")
    .replace(/^"+|"+$/g, "");
}

async function getLinkedInMediaBinary(
  mediaUrl,
  uploadedMedia,
  defaultContentType,
) {
  if (uploadedMedia?.path) {
    const fs = require('fs');
    return {
      mediaBuffer: await fs.promises.readFile(uploadedMedia.path),
      contentType: uploadedMedia.mimetype || defaultContentType,
    };
  }
  if (uploadedMedia?.buffer?.length) {
    return {
      mediaBuffer: uploadedMedia.buffer,
      contentType: uploadedMedia.mimetype || defaultContentType,
    };
  }

  if (!mediaUrl || !mediaUrl.startsWith("http")) {
    throw new Error(
      "LinkedIn publishing requires an uploaded file or a public media URL",
    );
  }

  const mediaRes = await axios.get(mediaUrl, {
    responseType: "arraybuffer",
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  return {
    mediaBuffer: Buffer.from(mediaRes.data),
    contentType: mediaRes.headers["content-type"] || defaultContentType,
  };
}

async function waitForLinkedInVideoAvailability(videoUrn, token) {
  const encodedVideoUrn = encodeURIComponent(videoUrn);
  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log(
      `[LinkedIn Video] Polling availability for ${videoUrn} (Attempt ${attempt + 1}/${maxAttempts})...`,
    );
    const statusRes = await axios.get(
      `https://api.linkedin.com/rest/videos/${encodedVideoUrn}`,
      {
        headers: getLinkedInRestHeaders(token),
      },
    );

    const status = statusRes.data?.status;
    console.log(`[LinkedIn Video] Status: ${status}`);
    if (status === "AVAILABLE") {
      return statusRes.data;
    }
    if (status === "PROCESSING_FAILED") {
      throw new Error(
        statusRes.data?.processingFailureReason ||
          "LinkedIn video processing failed",
      );
    }
  }

  throw new Error(
    "LinkedIn video is still processing and was not ready to publish in time",
  );
}

async function uploadLinkedInVideo(
  authorUrn,
  token,
  post,
  uploadedMedia = null,
) {
  const { mediaBuffer } = await getLinkedInMediaBinary(
    post.media_url,
    uploadedMedia,
    "video/mp4",
  );

  if (!mediaBuffer?.length) {
    throw new Error("LinkedIn video upload failed: empty file received");
  }

  console.log(
    `[LinkedIn Video] Initializing upload for ${authorUrn}, size: ${mediaBuffer.length} bytes`,
  );
  const initializeRes = await axios.post(
    "https://api.linkedin.com/rest/videos?action=initializeUpload",
    {
      initializeUploadRequest: {
        owner: authorUrn,
        fileSizeBytes: mediaBuffer.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    },
    {
      headers: getLinkedInRestHeaders(token),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    },
  );

  const uploadSession = initializeRes.data?.value || {};
  const videoUrn = uploadSession.video;
  const uploadInstructions = Array.isArray(uploadSession.uploadInstructions)
    ? uploadSession.uploadInstructions
    : [];

  console.log(
    `[LinkedIn Video] Initialized. videoUrn: ${videoUrn}, parts: ${uploadInstructions.length}`,
  );

  if (!videoUrn || uploadInstructions.length === 0) {
    throw new Error("LinkedIn did not return valid video upload instructions");
  }

  const uploadedPartIds = [];
  for (const instruction of uploadInstructions) {
    const firstByte = Number(instruction.firstByte);
    const lastByte = Number(instruction.lastByte);
    if (
      !instruction?.uploadUrl ||
      Number.isNaN(firstByte) ||
      Number.isNaN(lastByte)
    ) {
      throw new Error("LinkedIn returned an invalid video upload part");
    }

    const partBuffer = mediaBuffer.subarray(firstByte, lastByte + 1);
    const uploadRes = await axios.put(instruction.uploadUrl, partBuffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": partBuffer.length,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const uploadedPartId = normalizeLinkedInUploadPartId(
      uploadRes.headers?.etag,
    );
    if (!uploadedPartId) {
      throw new Error("LinkedIn video upload succeeded without an ETag");
    }
    uploadedPartIds.push(uploadedPartId);
  }

  const finalizeUploadRequest = {
    video: videoUrn,
    uploadedPartIds,
  };
  if (Object.prototype.hasOwnProperty.call(uploadSession, "uploadToken")) {
    finalizeUploadRequest.uploadToken = uploadSession.uploadToken;
  }

  await axios.post(
    "https://api.linkedin.com/rest/videos?action=finalizeUpload",
    { finalizeUploadRequest },
    {
      headers: getLinkedInRestHeaders(token),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    },
  );

  await waitForLinkedInVideoAvailability(videoUrn, token);
  return { videoUrn, mediaBuffer };
}

async function waitForLinkedInImageAvailability(imageUrn, token) {
  const encodedImageUrn = encodeURIComponent(imageUrn);
  const maxAttempts = 15;
  const delay = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    const statusRes = await axios.get(
      `https://api.linkedin.com/rest/images/${encodedImageUrn}`,
      {
        headers: getLinkedInRestHeaders(token),
      },
    );

    const status = statusRes.data?.status;
    if (status === "AVAILABLE") {
      // Extra safety buffer for LinkedIn CDN to sync
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return statusRes.data;
    }
    if (status === "PROCESSING_FAILED") {
      throw new Error("LinkedIn image processing failed");
    }
  }

  throw new Error(
    "LinkedIn image is still processing and was not ready to publish in time",
  );
}

async function uploadLinkedInImage(
  authorUrn,
  token,
  post,
  uploadedMedia = null,
) {
  const { mediaBuffer, contentType } = await getLinkedInMediaBinary(
    post.media_url,
    uploadedMedia,
    "image/jpeg",
  );

  if (!mediaBuffer?.length) {
    throw new Error("LinkedIn image upload failed: empty file received");
  }

  const initializeRes = await axios.post(
    "https://api.linkedin.com/rest/images?action=initializeUpload",
    {
      initializeUploadRequest: {
        owner: authorUrn,
      },
    },
    {
      headers: getLinkedInRestHeaders(token),
    },
  );

  const { uploadUrl, image: imageUrn } = initializeRes.data?.value || {};
  if (!uploadUrl || !imageUrn) {
    throw new Error("LinkedIn did not return valid image upload instructions");
  }

  await axios.put(uploadUrl, mediaBuffer, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  await waitForLinkedInImageAvailability(imageUrn, token);
  return { imageUrn, mediaBuffer };
}

async function refreshLinkedInToken(account) {
  try {
    const refreshToken = account.refresh_token;
    if (!refreshToken) {
      throw new Error("No refresh token available for this LinkedIn account");
    }

    const res = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    const {
      access_token: accessToken,
      expires_in: expiresIn,
      refresh_token: newRefreshToken,
    } = res.data;
    const expiresAt = Math.floor(Date.now() / 1000) + (expiresIn || 5184000);

    // Update the account document
    await Account.updateOne(
      { _id: account._id },
      {
        $set: {
          access_token: accessToken,
          expires_at: expiresAt,
          ...(newRefreshToken ? { refresh_token: newRefreshToken } : {}),
        },
      },
    );

    console.log(`[LinkedIn] Token refreshed for account: ${account.id}`);
    return accessToken;
  } catch (err) {
    console.error(
      "[LinkedIn Refresh Error]",
      err.response?.status,
      JSON.stringify(err.response?.data || err.message),
    );
    throw new Error(`LinkedIn token refresh failed: ${err.message}`);
  }
}

async function refreshLinkedInTokenIfNeeded(account) {
  // If token is missing expires_at or expires in less than 1 hour, refresh it
  const now = Math.floor(Date.now() / 1000);
  const buffer = 3600; // 1 hour buffer
  if (!account.expires_at || account.expires_at < now + buffer) {
    if (account.refresh_token) {
      return await refreshLinkedInToken(account);
    }
  }
  return account.access_token;
}

async function createLinkedInUgcPost(authorUrn, token, post, media = null) {
  const payload = {
    author: authorUrn,
    commentary: (post.caption || "").trim() || " ",
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    visibility: "PUBLIC",
  };

  if (Array.isArray(media) && media.length > 1) {
    payload.content = {
      multiImage: {
        images: media.map(m => {
          const img = { id: m.id };
          if (m.title) img.title = m.title;
          return img;
        })
      }
    };
  } else if (media && (media.id || (Array.isArray(media) && media[0].id))) {
    const singleMedia = Array.isArray(media) ? media[0] : media;
    const title = singleMedia.title || getLinkedInPostTitle(post);
    payload.content = {
      media: {
        id: singleMedia.id,
      },
    };
    if (title) {
      payload.content.media.title = title;
    }
  }

  try {
    const endpoint = "https://api.linkedin.com/rest/posts";
    console.log(
      `[LinkedIn] Creating post for ${authorUrn}. Payload:`,
      JSON.stringify(payload, null, 2),
    );
    const publishRes = await axios.post(endpoint, payload, {
      headers: getLinkedInRestHeaders(token),
    });

    const postId = publishRes.headers["x-restli-id"] || publishRes.data.id;
    console.log(`[LinkedIn] Success! postId: ${postId}`);
    return postId;
  } catch (err) {
    console.error(
      "[LinkedIn Post Error]",
      err.response?.status,
      JSON.stringify(err.response?.data || err.message),
    );
    throw err;
  }
}

async function postToLinkedIn(account, post, options = {}) {
  // Check and refresh token if needed
  let token = await refreshLinkedInTokenIfNeeded(account);
  let pageId = account.page_id;

  console.log(
    `[LinkedIn] Posting to account: ${account.id}, pageId: ${pageId}, pageName: ${account.page_name}`,
  );
  if (!token && post.clientCompanyId) {
    console.warn(
      `[LinkedIn] Token missing for account ${account.id}, checking ClientCompany fallback...`,
    );
    const clientCompany = await ClientCompany.findById(
      post.clientCompanyId,
    ).lean();
    const linkedinConfig =
      clientCompany?.configuration?.campaignScheduled?.linkedin;
    if (linkedinConfig?.accessToken) {
      console.log(
        `[LinkedIn] Using ClientCompany fallback token and pageId: ${linkedinConfig.linkedinId}`,
      );
      token = linkedinConfig.accessToken;
      if (!pageId) pageId = linkedinConfig.linkedinId;
    }
  }

  const authorUrn =
    account.token_type === "organization"
      ? `urn:li:organization:${pageId}`
      : `urn:li:person:${pageId}`;
  console.log(
    `[LinkedIn] Resolved authorUrn: ${authorUrn} (type: ${account.token_type})`,
  );
  const isCarousel = Array.isArray(post.media_url) && post.media_url.length > 1;
  const firstMedia = Array.isArray(post.media_url) ? post.media_url[0] : post.media_url;
  const mediaUrl = firstMedia;
  const uploadedMedia = options.uploadedMedia || null;
  let mediaBuffer = uploadedMedia?.buffer || options.mediaBuffer || null;

  if (!pageId) {
    throw new Error("LinkedIn Page ID is missing for this account");
  }

  // Detect if media is a video
  const isVideo =
    (mediaUrl &&
      (/\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(mediaUrl) ||
        mediaUrl.includes("/video/upload/"))) ||
    uploadedMedia?.mimetype?.startsWith("video/") ||
    (uploadedMedia?.originalname &&
      /\.(mp4|mov|avi|webm|mkv)$/i.test(uploadedMedia.originalname));

  console.log(`[LinkedIn] Media detected as video: ${isVideo}`);

  // Skip blob/localhost URLs because they are not accessible by the server.
  const isValidMediaUrl =
    mediaUrl &&
    mediaUrl.startsWith("http") &&
    !mediaUrl.includes("localhost") &&
    !mediaUrl.startsWith("blob:");

  const hasMediaContent = Boolean(uploadedMedia) || Boolean(isValidMediaUrl) || isCarousel;

  if (!hasMediaContent) {
    const postId = await createLinkedInUgcPost(authorUrn, token, post);
    if (!postId) {
      throw new Error("LinkedIn returned success without a post id");
    }
    return {
      externalId: postId,
      url: `https://www.linkedin.com/feed/update/${postId}/`,
    };
  }

  if (isVideo) {
    console.log(`[LinkedIn] Starting video upload for ${authorUrn}...`);
    const { videoUrn, mediaBuffer: newBuffer } = await uploadLinkedInVideo(
      authorUrn,
      token,
      post,
      uploadedMedia || (mediaBuffer ? { buffer: mediaBuffer } : null),
    );
    console.log(`[LinkedIn] Video upload complete. videoUrn: ${videoUrn}`);
    if (newBuffer && !mediaBuffer) {
      options.mediaBuffer = newBuffer;
      mediaBuffer = newBuffer;
    }
    const postId = await createLinkedInUgcPost(authorUrn, token, post, {
      id: videoUrn,
      title: getLinkedInPostTitle(post),
    });

    if (!postId) {
      throw new Error("LinkedIn returned success without a post id");
    }

    return {
      externalId: postId,
      url: `https://www.linkedin.com/feed/update/${postId}/`,
    };
  }

  if (isCarousel) {
    console.log(`[LinkedIn] Starting carousel upload for ${authorUrn}...`);
    const mediaUrns = [];
    for (const url of post.media_url) {
      const { imageUrn } = await uploadLinkedInImage(
        authorUrn,
        token,
        { ...post, media_url: url },
        null
      );
      mediaUrns.push({ id: imageUrn, title: getLinkedInPostTitle(post) });
    }
    
    const postId = await createLinkedInUgcPost(authorUrn, token, post, mediaUrns);
    if (!postId) {
      throw new Error("LinkedIn returned success without a post id");
    }

    return {
      externalId: postId,
      url: `https://www.linkedin.com/feed/update/${postId}/`,
    };
  }

  // Versioned image flow
  const { imageUrn, mediaBuffer: newBuffer } = await uploadLinkedInImage(
    authorUrn,
    token,
    { ...post, media_url: firstMedia },
    uploadedMedia || (mediaBuffer ? { buffer: mediaBuffer } : null),
  );
  if (newBuffer && !mediaBuffer) {
    options.mediaBuffer = newBuffer;
  }

  const postId = await createLinkedInUgcPost(authorUrn, token, post, {
    id: imageUrn,
    title: getLinkedInPostTitle(post),
  });

  if (!postId) {
    throw new Error("LinkedIn returned success without a post id");
  }

  return {
    externalId: postId,
    url: `https://www.linkedin.com/feed/update/${postId}/`,
  };
}

async function refreshYoutubeAccessToken(account) {
  if (!account.refresh_token) return account.access_token;
  const creds = await getYoutubeCredentialsForScope(
    account.companyId,
    account.clientCompanyId || null,
  );
  const effectiveClientId = account.youtube_client_id || creds.clientId;
  const effectiveClientSecret =
    account.youtube_client_secret || creds.clientSecret;
  if (!effectiveClientId || !effectiveClientSecret) {
    throw new Error("YouTube credentials are missing for this account scope");
  }

  const tokenRes = await axios.post(
    "https://oauth2.googleapis.com/token",
    new URLSearchParams({
      client_id: effectiveClientId,
      client_secret: effectiveClientSecret,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  const nextToken = tokenRes.data.access_token;
  const expiresAt =
    Math.floor(Date.now() / 1000) + (tokenRes.data.expires_in || 3600);
  await Account.updateOne(
    {
      id: account.id,
      ...(account.companyId ? { companyId: account.companyId } : {}),
      clientCompanyId: account.clientCompanyId || null,
    },
    { $set: { access_token: nextToken, expires_at: expiresAt } },
  );

  // Update ClientCompany configuration as well if in client scope
  if (account.clientCompanyId) {
    await ClientCompany.updateOne(
      { _id: account.clientCompanyId, companyId: account.companyId },
      {
        $set: {
          "configuration.campaignScheduled.youtube.accessToken": nextToken,
          "configuration.campaignScheduled.youtube.updatedAt": new Date(),
        },
      },
    ).catch((err) =>
      console.error(
        "[YouTube Refresh] Failed to update client config:",
        err.message,
      ),
    );
  }

  return nextToken;
}

async function getValidAccessToken(account) {
  if (!account || account.platform !== "youtube") return null;

  // Check if token is expired or about to expire (within 5 mins)
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + 300) {
    return account.access_token;
  }

  // Need to refresh
  if (!account.refresh_token) {
    // If we have no refresh token but the token is expired, we can't do much automatically
    // unless the current access token still happens to work (rare).
    return account.access_token;
  }

  try {
    return await refreshYoutubeAccessToken(account);
  } catch (err) {
    console.error(
      `[YouTube Refresh] Failed for account ${account.id}:`,
      err.message,
    );
    return account.access_token; // Fallback to current token and let the API call fail naturally
  }
}

async function createYoutubeClientForAccount(account) {
  const creds = await getYoutubeCredentialsForScope(
    account.companyId,
    account.clientCompanyId || null,
  );
  const effectiveClientId = account.youtube_client_id || creds.clientId;
  const effectiveClientSecret =
    account.youtube_client_secret || creds.clientSecret;

  if (!effectiveClientId || !effectiveClientSecret) {
    throw new Error("YouTube credentials are missing for this account scope");
  }

  const accessToken = await getValidAccessToken(account);

  const oauth2Client = new google.auth.OAuth2(
    effectiveClientId,
    effectiveClientSecret,
    YOUTUBE_REDIRECT_URI,
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: account.refresh_token || undefined,
  });

  return google.youtube({ version: "v3", auth: oauth2Client });
}

async function postToYoutube(account, post, options = {}) {
  const uploadedMedia = options.uploadedMedia || null;
  let mediaBuffer = uploadedMedia?.buffer || options.mediaBuffer || null;
  if (!mediaBuffer && uploadedMedia?.path) {
    mediaBuffer = await require('fs').promises.readFile(uploadedMedia.path);
  }
  const rawMediaUrl = post.media_url;
  const mediaUrl = Array.isArray(rawMediaUrl) ? rawMediaUrl[0] : rawMediaUrl;

  // Reject blob: or localhost URLs — these are temporary browser URLs the server cannot access
  if (
    mediaUrl &&
    (mediaUrl.startsWith("blob:") || mediaUrl.includes("localhost"))
  ) {
    throw new Error(
      "YouTube publishing failed: the video was not uploaded to cloud storage. Please edit the post and re-upload the video file.",
    );
  }

  if (!uploadedMedia && (!mediaUrl || !mediaUrl.startsWith("http"))) {
    throw new Error(
      "YouTube publishing requires either an uploaded video file or a public video media URL",
    );
  }
  const fileExtMatch = (mediaUrl || "").match(
    /\.(mp4|mov|avi|mkv|webm)(\?|$)/i,
  );
  const fileExt = fileExtMatch ? fileExtMatch[1].toLowerCase() : "mp4";

  try {
    if (!mediaBuffer) {
      if (mediaUrl && mediaUrl.startsWith("http")) {
        const mediaRes = await axios.get(mediaUrl, {
          responseType: "arraybuffer",
        });
        mediaBuffer = Buffer.from(mediaRes.data);
      }
    }

    if (!mediaBuffer) {
      throw new Error("No media content found for YouTube upload");
    }

    const mediaBodyStream = Readable.from(mediaBuffer);

    const postOptions = post.post_option || {};
    const platformOption =
      postOptions.youtube || postOptions.standard || "video_standard";
    const isShort =
      platformOption === "video_short" ||
      platformOption === "short" ||
      platformOption === "video_short";

    let title = (post.campaign || "Campaign Post").slice(0, 100);
    let description = (post.caption || "").slice(0, 5000);

    if (isShort) {
      if (!title.toLowerCase().includes("#shorts")) title = `${title} #Shorts`;
      if (!description.toLowerCase().includes("#shorts"))
        description = `${description}\n\n#Shorts`;
    }

    const youtube = await createYoutubeClientForAccount(account);
    const uploadRes = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description,
        },
        status: { privacyStatus: "public" },
      },
      media: {
        body: mediaBodyStream,
      },
    });
    const videoId = uploadRes.data.id;
    const statsRes = await youtube.videos.list({
      part: ["statistics"],
      id: [videoId],
    });
    const statistics = statsRes.data?.items?.[0]?.statistics || {};
    return {
      externalId: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      mediaBuffer, // Return buffer so it can be reused for next account
      metrics: {
        likes: Number(statistics.likeCount) || 0,
        comments: Number(statistics.commentCount) || 0,
        shares: 0,
      },
    };
  } catch (err) {
    throw err;
  }
}

async function getYoutubeVideoMetrics(account, videoId) {
  if (!account || !videoId) return { likes: 0, comments: 0, shares: 0 };
  const youtube = await createYoutubeClientForAccount(account);
  const statsRes = await youtube.videos.list({
    part: ["statistics"],
    id: [videoId],
  });
  const statistics = statsRes.data?.items?.[0]?.statistics || {};
  let commentCount = Number(statistics.commentCount) || 0;
  if (commentCount === 0) {
    try {
      const commentProbe = await youtube.commentThreads.list({
        part: ["id"],
        videoId,
        maxResults: 1,
      });
      commentCount = Number(commentProbe?.data?.pageInfo?.totalResults) || 0;
    } catch (err) {
      const scopeIssue =
        err?.response?.data?.error?.status === "PERMISSION_DENIED" ||
        err?.response?.data?.error?.details?.some(
          (detail) => detail?.reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
        );
      if (scopeIssue && YOUTUBE_API_KEY) {
        try {
          const publicProbe = await axios.get(
            "https://www.googleapis.com/youtube/v3/commentThreads",
            {
              params: {
                part: "id",
                videoId,
                maxResults: 1,
                key: YOUTUBE_API_KEY,
              },
            },
          );
          commentCount = Number(publicProbe?.data?.pageInfo?.totalResults) || 0;
        } catch {
          // Keep statistics-based count when public probe fails.
        }
      }
    }
  }
  return {
    likes: Number(statistics.likeCount) || 0,
    comments: commentCount,
    shares: 0,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

async function resolveYoutubeVideoIdForPost(account, post) {
  const youtube = await createYoutubeClientForAccount(account);
  const searchRes = await youtube.search.list({
    part: ["snippet"],
    channelId: account.page_id,
    type: ["video"],
    order: "date",
    maxResults: 10,
  });
  const items = searchRes.data?.items || [];
  if (items.length === 0) return null;

  const campaign = String(post?.campaign || "")
    .trim()
    .toLowerCase();
  const caption = String(post?.caption || "")
    .trim()
    .toLowerCase();
  const exact = items.find((item) => {
    const title = String(item?.snippet?.title || "")
      .trim()
      .toLowerCase();
    return (
      (campaign && title === campaign) ||
      (caption &&
        title &&
        (title.includes(caption.slice(0, 40)) || caption.includes(title)))
    );
  });
  const target = exact || items[0];
  return target?.id?.videoId || null;
}

async function getYoutubePublicationTargets(
  post,
  companyId = post?.companyId,
  clientCompanyId = post?.clientCompanyId || null,
) {
  const publications = post?.platform_publications || {};
  const targets = [];
  const targetIds = new Set();

  for (const [accountId, publication] of Object.entries(publications)) {
    if (publication?.platform !== "youtube") continue;
    targetIds.add(accountId);
    targets.push({
      accountId,
      videoId: publication?.externalId || null,
    });
  }

  const platformIds = (post?.platforms || []).filter((platformId) =>
    String(platformId || "").startsWith("yt-"),
  );
  for (const accountId of platformIds) {
    if (targetIds.has(accountId)) continue;
    targets.push({
      accountId,
      videoId: publications?.[accountId]?.externalId || null,
    });
    targetIds.add(accountId);
  }

  if (targets.length === 0) {
    const youtubeAccounts = await Account.find({
      platform: "youtube",
      ...buildScopeQuery(companyId, clientCompanyId),
    }).lean();
    for (const account of youtubeAccounts) {
      targets.push({ accountId: account.id, videoId: null });
    }
  }

  return targets;
}

async function getFacebookPostMetrics(account, externalId) {
  if (!account || !externalId) return { likes: 0, comments: 0, shares: 0 };

  try {
    const postRes = await axios.get(`${META_GRAPH}/${externalId}`, {
      params: {
        fields: "message,created_time",
        access_token: account.access_token,
      },
    });

    const likesRes = await axios.get(`${META_GRAPH}/${externalId}/likes`, {
      params: {
        summary: "true",
        access_token: account.access_token,
      },
    });

    const commentsRes = await axios.get(
      `${META_GRAPH}/${externalId}/comments`,
      {
        params: {
          fields:
            "message,from,created_time,comments.limit(50){message,from,created_time}",
          access_token: account.access_token,
        },
      },
    );

    let totalComments = 0;
    if (commentsRes.data?.data && commentsRes.data.data.length > 0) {
      commentsRes.data.data.forEach((comment) => {
        totalComments++;
        if (comment.comments && comment.comments.data) {
          totalComments += comment.comments.data.length;
        }
      });
    }

    return {
      likes: likesRes.data?.summary?.total_count || 0,
      comments: totalComments,
      shares: 0,
      url: `https://www.facebook.com/${externalId}`,
    };
  } catch (err) {
    console.error(
      `[Facebook Metrics] Error fetching for ${externalId}:`,
      err.message,
    );
    return { likes: 0, comments: 0, shares: 0 };
  }
}

async function getInstagramPostMetrics(account, externalId) {
  if (!account || !externalId) return { likes: 0, comments: 0, shares: 0 };

  try {
    const mediaRes = await axios.get(`${META_GRAPH}/${externalId}`, {
      params: {
        fields: "caption,like_count,comments_count,permalink,timestamp",
        access_token: account.access_token,
      },
    });

    const commentsRes = await axios.get(
      `${META_GRAPH}/${externalId}/comments`,
      {
        params: {
          fields: "text,username,timestamp",
          access_token: account.access_token,
        },
      },
    );

    return {
      likes: mediaRes.data?.like_count || 0,
      comments: mediaRes.data?.comments_count || 0,
      shares: 0,
      url: mediaRes.data?.permalink,
    };
  } catch (err) {
    console.error(
      `[Instagram Metrics] Error fetching for ${externalId}:`,
      err.message,
    );
    return {
      likes: 0,
      comments: 0,
      shares: 0,
      url: `https://www.instagram.com/p/${externalId}/`, // Note: ID might not match permalink precisely without Graph API, but it's a fallback.
    };
  }
}

async function getLinkedInPostMetrics(
  account,
  externalId,
  clientCompanyId = null,
) {
  if (!account || !externalId) return { likes: 0, comments: 0, shares: 0 };

  let token = await refreshLinkedInTokenIfNeeded(account);
  if (clientCompanyId) {
    const clientCompany = await ClientCompany.findById(clientCompanyId).lean();
    const linkedinConfig =
      clientCompany?.configuration?.campaignScheduled?.linkedin;
    if (linkedinConfig?.accessToken) {
      // Note: If the client config token is manually set, it might not have refresh capabilities
      // unless we also store the refresh token in the client configuration.
      token = linkedinConfig.accessToken;
    }
  }

  try {
    const res = await axios.get(
      `https://api.linkedin.com/rest/socialMetadata/${encodeURIComponent(externalId)}`,
      {
        headers: getLinkedInRestHeaders(token),
      },
    );
    const data = res.data;
    const reactionSummaries = data?.reactionSummaries || {};
    const totalReactions = Object.values(reactionSummaries).reduce(
      (sum, item) => sum + (Number(item?.count) || 0),
      0,
    );

    return {
      likes: totalReactions,
      comments: Number(data?.commentSummary?.count) || 0,
      shares: 0,
      url: `https://www.linkedin.com/feed/update/${externalId}/`,
    };
  } catch (err) {
    console.error(
      `[LinkedIn] Failed to fetch metrics for ${externalId}:`,
      err.response?.data || err.message,
    );
    return {
      likes: 0,
      comments: 0,
      shares: 0,
      url: `https://www.linkedin.com/feed/update/${externalId}/`,
    };
  }
}

async function getPinterestPinMetrics(account, pinId) {
  try {
    const token = await refreshPinterestTokenIfNeeded(account);
    const pinRes = await axios.get(`https://api.pinterest.com/v5/pins/${pinId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const pinData = pinRes.data || {};
    // Pinterest API v5 /pins/{pin_id}/analytics requires specific parameters and dates.
    // To keep it simple and within the 'pins:read' scope without date ranges, we can get basic engagement from the pin object if provided,
    // though Pinterest API v5 often needs explicit analytics calls. We will map saves to shares.
    let saves = 0;
    let comments = 0;
    
    // Attempt to grab analytics if Pinterest includes it directly in the pin response (sometimes they include board/pin stats)
    if (pinData.pin_metrics) {
      saves = pinData.pin_metrics.saves || 0;
      comments = pinData.pin_metrics.comments || 0;
    }

    return {
      likes: 0, // Pinterest uses Saves/Pins instead of traditional likes
      comments: comments,
      shares: saves,
      url: `https://www.pinterest.com/pin/${pinId}/`
    };
  } catch (err) {
    console.error(`[Pinterest] Failed to fetch metrics for pin ${pinId}:`, err?.response?.data || err.message);
    return { likes: 0, comments: 0, shares: 0, url: null };
  }
}

async function refreshPostMetrics(
  post,
  companyId = post?.companyId,
  clientCompanyId = post?.clientCompanyId || null,
) {
  if (!post || post.status !== "Published") return post;
  const publications = post.platform_publications || {};

  let likes = 0;
  let comments = 0;
  let shares = 0;
  let touched = false;
  const nextPublications = { ...publications };

  for (const accountId of Object.keys(publications)) {
    const pub = publications[accountId];
    if (!pub.externalId) continue;

    const account = await Account.findOne({
      id: accountId,
      ...buildScopeQuery(companyId, clientCompanyId),
    }).lean();
    if (!account) continue;

    try {
      if (pub.platform === "youtube" || account.platform === "youtube") {
        const metrics = await getYoutubeVideoMetrics(account, pub.externalId);
        likes += metrics.likes;
        comments += metrics.comments;
        shares += metrics.shares;
        nextPublications[accountId].likes = metrics.likes;
        nextPublications[accountId].comments = metrics.comments;
        nextPublications[accountId].shares = metrics.shares;
        if (metrics.url) nextPublications[accountId].url = metrics.url;
        touched = true;
      } else if (
        pub.platform === "linkedin" ||
        account.platform === "linkedin"
      ) {
        const metrics = await getLinkedInPostMetrics(
          account,
          pub.externalId,
          clientCompanyId,
        );
        likes += metrics.likes;
        comments += metrics.comments;
        shares += metrics.shares;
        nextPublications[accountId].likes = metrics.likes;
        nextPublications[accountId].comments = metrics.comments;
        nextPublications[accountId].shares = metrics.shares;
        if (metrics.url) nextPublications[accountId].url = metrics.url;
        touched = true;
      } else if (
        pub.platform === "facebook" ||
        account.platform === "facebook"
      ) {
        const metrics = await getFacebookPostMetrics(account, pub.externalId);
        likes += metrics.likes;
        comments += metrics.comments;
        shares += metrics.shares;
        nextPublications[accountId].likes = metrics.likes;
        nextPublications[accountId].comments = metrics.comments;
        nextPublications[accountId].shares = metrics.shares;
        if (metrics.url) nextPublications[accountId].url = metrics.url;
        touched = true;
      } else if (
        pub.platform === "instagram" ||
        account.platform === "instagram"
      ) {
        const metrics = await getInstagramPostMetrics(account, pub.externalId);
        likes += metrics.likes;
        comments += metrics.comments;
        shares += metrics.shares;
        nextPublications[accountId].likes = metrics.likes;
        nextPublications[accountId].comments = metrics.comments;
        nextPublications[accountId].shares = metrics.shares;
        if (metrics.url) nextPublications[accountId].url = metrics.url;
        touched = true;
      } else if (
        pub.platform === "pinterest" ||
        account.platform === "pinterest"
      ) {
        const metrics = await getPinterestPinMetrics(account, pub.externalId);
        likes += metrics.likes;
        comments += metrics.comments;
        shares += metrics.shares;
        nextPublications[accountId].likes = metrics.likes;
        nextPublications[accountId].comments = metrics.comments;
        nextPublications[accountId].shares = metrics.shares;
        if (metrics.url) nextPublications[accountId].url = metrics.url;
        touched = true;
      }
    } catch (err) {
      console.error(
        `[Metrics] Failed to refresh for ${pub.platform} / ${pub.externalId}:`,
        err.message,
      );
    }
  }

  if (!touched) return post;

  await Post.updateOne(
    { id: post.id, ...buildScopeQuery(companyId, clientCompanyId) },
    {
      $set: {
        likes,
        comments,
        shares,
        platform_publications: nextPublications,
      },
    },
  );
  return await Post.findOne({
    id: post.id,
    ...buildScopeQuery(companyId, clientCompanyId),
  }).lean();
}

async function refreshPublishedPostMetrics(companyId, clientCompanyId = null) {
  const published = await Post.find({
    status: "Published",
    ...buildScopeQuery(companyId, clientCompanyId),
  }).lean();
  const refreshed = [];
  for (const post of published) {
    refreshed.push(
      await refreshPostMetrics(
        post,
        companyId || post.companyId,
        clientCompanyId ?? post.clientCompanyId ?? null,
      ),
    );
  }
  return refreshed;
}

async function getPostYoutubeComments(
  post,
  limit = 20,
  companyId = post?.companyId,
  clientCompanyId = post?.clientCompanyId || null,
) {
  if (!post) return [];
  const publications = post.platform_publications || {};
  const youtubeTargets = await getYoutubePublicationTargets(
    post,
    companyId,
    clientCompanyId,
  );
  if (youtubeTargets.length === 0) return [];

  const comments = [];
  for (const target of youtubeTargets) {
    const accountId = target.accountId;
    const account = await Account.findOne({
      id: accountId,
      ...buildScopeQuery(companyId, clientCompanyId),
    }).lean();
    if (!account) continue;
    let videoId =
      target.videoId || publications?.[accountId]?.externalId || null;
    if (!videoId) {
      videoId = await resolveYoutubeVideoIdForPost(account, post);
    }
    if (!videoId) continue;

    try {
      const youtube = await createYoutubeClientForAccount(account);
      let res = await youtube.commentThreads.list({
        part: ["snippet"],
        videoId,
        maxResults: Math.min(limit, 50),
        order: "time",
        textFormat: "plainText",
      });
      let items = res.data?.items || [];
      if (items.length === 0 && YOUTUBE_API_KEY) {
        const publicRes = await axios.get(
          "https://www.googleapis.com/youtube/v3/commentThreads",
          {
            params: {
              part: "snippet",
              videoId,
              maxResults: Math.min(limit, 50),
              order: "time",
              textFormat: "plainText",
              key: YOUTUBE_API_KEY,
            },
          },
        );
        res = publicRes;
        items = res.data?.items || [];
      }
      for (const item of items) {
        const top = item?.snippet?.topLevelComment?.snippet || {};
        comments.push({
          id: item?.id || `${videoId}-${comments.length}`,
          author: top.authorDisplayName || "YouTube User",
          text: top.textDisplay || "",
          publishedAt: top.publishedAt || null,
          likeCount: Number(top.likeCount) || 0,
          videoId,
          accountId,
        });
      }
    } catch (err) {
      const scopeIssue =
        err?.response?.data?.error?.status === "PERMISSION_DENIED" ||
        err?.response?.data?.error?.details?.some(
          (detail) => detail?.reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
        );
      if (scopeIssue && YOUTUBE_API_KEY) {
        try {
          const publicRes = await axios.get(
            "https://www.googleapis.com/youtube/v3/commentThreads",
            {
              params: {
                part: "snippet",
                videoId,
                maxResults: Math.min(limit, 50),
                order: "time",
                textFormat: "plainText",
                key: YOUTUBE_API_KEY,
              },
            },
          );
          const items = publicRes.data?.items || [];
          for (const item of items) {
            const top = item?.snippet?.topLevelComment?.snippet || {};
            comments.push({
              id: item?.id || `${videoId}-${comments.length}`,
              author: top.authorDisplayName || "YouTube User",
              text: top.textDisplay || "",
              publishedAt: top.publishedAt || null,
              likeCount: Number(top.likeCount) || 0,
              videoId,
              accountId,
            });
          }
        } catch {
          // Continue for other accounts/video mappings.
        }
      }
    }
  }

  return comments.slice(0, limit);
}

function hasLinkedInPublication(post) {
  if (!post) return false;

  const publications = post.platform_publications || {};
  if (
    Object.values(publications).some(
      (publication) => publication?.platform === "linkedin",
    )
  ) {
    return true;
  }

  return (post.platforms || []).some((platformId) =>
    String(platformId || "").startsWith("li-"),
  );
}

async function migrateLinkedInPublishedPostMetrics() {
  const publishedPosts = await Post.find({ status: "Published" }).lean();
  const linkedinPosts = publishedPosts.filter(hasLinkedInPublication);

  let refreshedCount = 0;
  let changedCount = 0;
  let errorCount = 0;
  const failures = [];

  for (const post of linkedinPosts) {
    try {
      const previousLikes = Number(post?.likes) || 0;
      const previousComments = Number(post?.comments) || 0;
      const previousShares = Number(post?.shares) || 0;

      const refreshed = await refreshPostMetrics(
        post,
        post.companyId,
        post.clientCompanyId || null,
      );

      refreshedCount += 1;

      const nextLikes = Number(refreshed?.likes) || 0;
      const nextComments = Number(refreshed?.comments) || 0;
      const nextShares = Number(refreshed?.shares) || 0;

      if (
        nextLikes !== previousLikes ||
        nextComments !== previousComments ||
        nextShares !== previousShares
      ) {
        changedCount += 1;
      }
    } catch (error) {
      errorCount += 1;
      failures.push({
        postId: post.id,
        message: error?.message || "Unknown error",
      });
    }
  }

  return {
    totalPublished: publishedPosts.length,
    totalLinkedIn: linkedinPosts.length,
    refreshedCount,
    changedCount,
    errorCount,
    failures,
  };
}

async function refreshPinterestTokenIfNeeded(account) {
  if (!account.refresh_token) return account.access_token;
  // If expires_at is not missing and is in the future (>5 mins), keep it.
  const now = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > now + 300) {
    return account.access_token;
  }

  const tokenRes = await axios.post(
    "https://api.pinterest.com/v5/oauth/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${PINTEREST_CLIENT_ID}:${PINTEREST_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
    }
  );

  const nextToken = tokenRes.data.access_token;
  const nextRefresh = tokenRes.data.refresh_token || account.refresh_token;
  const expiresAt = now + (tokenRes.data.expires_in || 2592000); // 30 days default

  await Account.updateOne(
    {
      id: account.id,
      ...(account.companyId ? { companyId: account.companyId } : {}),
      clientCompanyId: account.clientCompanyId || null,
    },
    { $set: { access_token: nextToken, refresh_token: nextRefresh, expires_at: expiresAt } }
  );

  return nextToken;
}

async function postToPinterest(account, post, options = {}) {
  const token = await refreshPinterestTokenIfNeeded(account);

  const boardId = post.boards?.[account.id] || post.platform_options?.pinterest?.boardId || post.post_option?.pinterest?.boardId;
  if (!boardId) {
    throw new Error("A Pinterest board must be selected for this account.");
  }

  const mediaUrl = post.media_url;
  const uploadedMedia = options.uploadedMedia || null;

  if (!mediaUrl && !uploadedMedia) {
    throw new Error("Pinterest requires a media image to publish a pin.");
  }

  // Handle media buffer (from file upload or remote URL)
  let mediaBuffer, contentType;
  if (uploadedMedia?.path) {
    mediaBuffer = await fs.promises.readFile(uploadedMedia.path);
    contentType = uploadedMedia.mimetype || "image/jpeg";
  } else if (uploadedMedia?.buffer) {
    mediaBuffer = uploadedMedia.buffer;
    contentType = uploadedMedia.mimetype || "image/jpeg";
  } else if (mediaUrl) {
    // If it's a URL and we don't have it uploaded, we could register a URL based pin, 
    // but Pinterest V5 API also supports downloading and uploading. Let's just pass the URL directly if we can't buffer it easily.
    // Actually Pinterest v5 `media` can be `media_type: "image"` and `url`.
  }

  const payload = {
    title: getLinkedInPostTitle(post) || post.campaign || "Pin",
    description: post.caption || "",
    board_id: boardId,
    media_source: {
      source_type: "image_url",
    }
  };

  if (mediaUrl && mediaUrl.startsWith("http")) {
      payload.media_source.url = mediaUrl;
  } else if (mediaBuffer) {
     // Currently we'll just try to upload binary to cloudinary or something. 
     // Wait, maybe we upload a binary to Cloudinary then get URL?
     // We can just rely on the existing Cloudinary upload in `postToYoutube` or from the server logic.
     // In Tunepath, `post.media_url` is typically an uploaded cloudinary URL. So `mediaUrl` will be present.
     // If we really need binary upload to pinterest:
     throw new Error("Please ensure media is fully uploaded to CDN before posting to Pinterest.");
  } else {
      throw new Error("Could not acquire public image URL for Pinterest");
  }

  // Create Pin in Production
  const pinRes = await axios.post("https://api.pinterest.com/v5/pins", payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return {
    externalId: pinRes.data.id,
    url: `https://www.pinterest.com/pin/${pinRes.data.id}/`,
  };
}

async function dispatchPost(post, options = {}) {
  const accounts = await getAllAccounts(
    post?.companyId,
    post?.clientCompanyId || null,
  );
  if (!post.platforms || post.platforms.length === 0) {
    return { success: false, message: "No platforms selected for this post" };
  }

  const results = [];
  const errors = [];
  const deliveries = [];
  const platformResults = {};
  const aggregateMetrics = { likes: 0, comments: 0, shares: 0 };
  let hasAnyMetrics = false;
  for (const platformId of post.platforms) {
    // Small delay between platforms to avoid spam detection and rate limits
    if (results.length > 0 || errors.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    const account = accounts.find((a) => a.id === platformId);
    console.log(
      `[Dispatch] Platform: ${platformId} -> Account: ${account ? account.id : "NOT FOUND"} (${account ? account.page_name : "N/A"})`,
    );
    if (!account) {
      console.warn(
        `[Dispatch] Account not found. Platforms available in context:`,
        accounts.map((a) => a.id),
      );
      errors.push(`Account "${platformId}" not connected`);
      continue;
    }
    
    // Determine the media URL for this specific platform
    const effectiveMediaUrl = post.platform_media_urls?.[account.id] || post.media_url;
    // Create a copy of the post object with the effective media URL to avoid mutating the original
    const platformPost = { ...(post.toObject ? post.toObject() : post) };
    if (platformPost._doc) {
      Object.assign(platformPost, platformPost._doc);
    }
    platformPost.media_url = effectiveMediaUrl;

    try {
      if (account.platform === "facebook") {
        const fbResult = await postToFacebook(account, platformPost);
        results.push(`Facebook/${account.page_name}: ${fbResult.externalId}`);
        platformResults[account.id] = { status: "Published", platform: "facebook", externalId: fbResult.externalId, url: fbResult.url };
        deliveries.push({
          accountId: account.id,
          platform: "facebook",
          externalId: fbResult.externalId,
          url: fbResult.url,
        });
      } else if (account.platform === "instagram") {
        if (account.token_type === "instagram_direct") {
          throw new Error(
            "Direct Instagram connections currently support profile integration only. Publishing requires a Business/Creator account connected via Facebook.",
          );
        }
        const igResult = await postToInstagram(account, platformPost, options);
        results.push(`Instagram/${account.username}: ${igResult.externalId}`);
        platformResults[account.id] = { status: "Published", platform: "instagram", externalId: igResult.externalId, url: igResult.url };
        deliveries.push({
          accountId: account.id,
          platform: "instagram",
          externalId: igResult.externalId,
          url: igResult.url,
        });
      } else if (account.platform === "youtube") {
        const ytResult = await postToYoutube(account, platformPost, options);
        // Reuse buffer for next YouTube account to avoid re-downloading
        if (ytResult.mediaBuffer) {
          options.mediaBuffer = ytResult.mediaBuffer;
        }
        results.push(
          `YouTube/${account.page_name || account.username}: ${ytResult.externalId}`,
        );
        platformResults[account.id] = { status: "Published", platform: "youtube", externalId: ytResult.externalId, url: ytResult.url };
        deliveries.push({
          accountId: account.id,
          platform: "youtube",
          externalId: ytResult.externalId,
          url: ytResult.url,
        });
        if (ytResult.metrics) {
          aggregateMetrics.likes += Number(ytResult.metrics.likes) || 0;
          aggregateMetrics.comments += Number(ytResult.metrics.comments) || 0;
          aggregateMetrics.shares += Number(ytResult.metrics.shares) || 0;
          platformResults[account.id].likes = Number(ytResult.metrics.likes) || 0;
          platformResults[account.id].comments = Number(ytResult.metrics.comments) || 0;
          platformResults[account.id].shares = Number(ytResult.metrics.shares) || 0;
          hasAnyMetrics = true;
        }
      } else if (account.platform === "linkedin") {
        const liResult = await postToLinkedIn(account, platformPost, options);
        results.push(`LinkedIn/${account.page_name}: ${liResult.externalId}`);
        platformResults[account.id] = { status: "Published", platform: "linkedin", externalId: liResult.externalId, url: liResult.url };
        deliveries.push({
          accountId: account.id,
          platform: "linkedin",
          externalId: liResult.externalId,
          url: liResult.url,
        });
      } else if (account.platform === "google_business") {
        const gbpResult = await postToGoogleBusiness(account, platformPost);
        results.push(`GoogleBusiness/${account.page_name}: ${gbpResult.externalId}`);
        platformResults[account.id] = { status: "Published", platform: "google_business", externalId: gbpResult.externalId, url: gbpResult.url };
        deliveries.push({
          accountId: account.id,
          platform: "google_business",
          externalId: gbpResult.externalId,
          url: gbpResult.url,
        });
      } else if (account.platform === "pinterest") {
        const pinResult = await postToPinterest(account, platformPost, options);
        results.push(`Pinterest/${account.page_name || account.username}: ${pinResult.externalId}`);
        platformResults[account.id] = { status: "Published", platform: "pinterest", externalId: pinResult.externalId, url: pinResult.url };
        deliveries.push({
          accountId: account.id,
          platform: "pinterest",
          externalId: pinResult.externalId,
          url: pinResult.url,
        });
      }
    } catch (err) {
      const apiData = err.response?.data;
      const apiMsg = apiData
        ? typeof apiData === "string"
          ? apiData
          : JSON.stringify(apiData)
        : "";
      const coreMsg = err?.message || "Unknown error";
      const fullMsg = apiMsg ? `${coreMsg} - ${apiMsg}` : coreMsg;

      errors.push(
        `${account.platform}/${account.page_name || account.username}: ${fullMsg}`,
      );
      platformResults[account.id] = { status: "Failed", platform: account.platform, error: fullMsg };
    }
  }

  if (errors.length > 0 && results.length === 0) {
    return { success: false, message: errors.join(" | ") };
  }
  const msg = results.length
    ? `Published: ${results.join(", ")}${errors.length ? ` | Errors: ${errors.join(", ")}` : ""}`
    : `Failed: ${errors.join(" | ")}`;

  return {
    success: results.length > 0 || errors.length === 0,
    message: msg,
    deliveries,
    platformResults,
    metrics: hasAnyMetrics ? aggregateMetrics : null,
  };
}

async function processDuePosts() {
  const now = new Date().toISOString();
  try {
    const duePosts = await Post.find({
      status: "Scheduled",
      scheduled_iso: { $lte: now },
    }).lean();

    if (duePosts.length > 0) {
      console.log(
        `[Campaign Scheduled] Found ${duePosts.length} due posts at ${toIST(new Date()).toISOString().replace("Z", "")} IST`,
      );
    }

    const changedScopes = new Set();
    for (const p of duePosts) {
      // Atomic lock to prevent double processing (e.g. by concurrent cron runs or manual triggers)
      const post = await Post.findOneAndUpdate(
        { _id: p._id, status: "Scheduled" },
        { $set: { status: "Publishing" } },
        { returnDocument: 'after' },
      ).lean();

      if (!post) {
        console.log(
          `[Campaign Scheduled] Post ${p.id} is already being processed or has been published. Skipping.`,
        );
        continue;
      }

      console.log(
        `[Campaign Scheduled] Processing post: ${post.id} (${post.caption.slice(0, 30)}...)`,
      );

      const scopeQuery = buildScopeQuery(
        post.companyId,
        post.clientCompanyId || null,
      );
      const scopeKey = `${String(post.companyId)}::${String(post.clientCompanyId || "")}`;
      changedScopes.add(scopeKey);

      const result = await dispatchPost(post);
      if (result.success || Object.keys(result.platformResults || {}).length > 0) {
        const publicationMap = result.platformResults || {};
        await Post.updateOne(
          { _id: post._id },
          {
            $set: {
              status: result.success ? "Published" : "Failed",
              published_at: new Date().toISOString(),
              error_message: result.success ? null : result.message,
              platform_publications: publicationMap,
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
        const updated = await Post.findById(post._id).lean();
        const log = {
          id: randomUUID(),
          type: result.success ? "published" : "failed",
          postId: post.id,
          caption: post.caption,
          timestamp: new Date().toISOString(),
          message: result.message,
        };
        schedulerLog.unshift(log);
        if (result.success) {
          broadcastSSE("post_published", { post: updated, log }, scopeQuery);
          console.log(`[Campaign Scheduled] Successfully published post: ${post.id}`);
        } else {
          broadcastSSE("post_failed", { post: updated, log }, scopeQuery);
          console.error(`[Campaign Scheduled] Completely or partially failed post: ${post.id} - ${result.message}`);
        }
      }
    }

    if (changedScopes.size > 0) {
      for (const scopeKey of changedScopes) {
        const [companyId, clientCompanyIdRaw] = scopeKey.split("::");
        const clientCompanyId = clientCompanyIdRaw || null;
        const syncedPosts = await getAllPosts(companyId, clientCompanyId);
        broadcastSSE("posts_sync", syncedPosts, { companyId, clientCompanyId });
      }
    }
    if (schedulerLog.length > 50) schedulerLog = schedulerLog.slice(0, 50);
  } catch (err) {
    console.error("[Campaign Scheduled] Cron error:", err.message);
  }
}

async function migrateLegacyPosts() {
  const posts = await Post.find({}).lean();
  let migratedCount = 0;

  console.log(`[Migration] Starting migration for ${posts.length} posts...`);

  for (const post of posts) {
    let touched = false;
    const nextPlatforms = [];
    const nextPublications = { ...(post.platform_publications || {}) };

    // Fetch accounts for this scope to resolve platform names to IDs
    const accounts = await Account.find({
      companyId: post.companyId,
      clientCompanyId: post.clientCompanyId || null,
    }).lean();

    for (const p of post.platforms || []) {
      if (["facebook", "instagram", "linkedin", "youtube"].includes(p)) {
        // This is a legacy platform name, try to resolve to an account ID
        const account = accounts.find((a) => a.platform === p);
        if (account) {
          nextPlatforms.push(account.id);
          // If we had a publication for the platform name, move it to the account ID
          if (nextPublications[p]) {
            nextPublications[account.id] = nextPublications[p];
            delete nextPublications[p];
            touched = true;
          }
          touched = true;
        } else {
          nextPlatforms.push(p); // Keep as is if no account found
        }
      } else {
        nextPlatforms.push(p);
      }
    }

    // Check for publications that are keyed by platform name but not in platforms array
    for (const key of Object.keys(nextPublications)) {
      if (["facebook", "instagram", "linkedin", "youtube"].includes(key)) {
        const account = accounts.find((a) => a.platform === key);
        if (account) {
          nextPublications[account.id] = nextPublications[key];
          delete nextPublications[key];
          touched = true;
        }
      }
    }

    if (touched) {
      await Post.updateOne(
        { _id: post._id },
        {
          $set: {
            platforms: nextPlatforms,
            platform_publications: nextPublications,
          },
        },
      );
      migratedCount++;
    }
  }

  console.log(
    `[Migration] Migrated ${migratedCount} posts. Refreshing metrics...`,
  );

  // Also trigger a metrics refresh for all published posts to ensure URLs are populated
  try {
    const published = await Post.find({ status: "Published" });
    for (const p of published) {
      await refreshPostMetrics(p).catch(() => {});
    }
  } catch (err) {
    console.error("[Migration] Metrics refresh failed:", err.message);
  }

  return migratedCount;
}

function startCampaignScheduler() {
  console.log('[Campaign Scheduled] Scheduler started. Checking for due posts every 30 seconds.');
  setInterval(processDuePosts, 30000);
}

module.exports = {
  REDIRECT_URI,
  META_GRAPH,
  FB_SCOPES,
  LINKEDIN_SCOPES,
  LINKEDIN_REDIRECT_URI,
  YOUTUBE_SCOPES,
  YOUTUBE_REDIRECT_URI,
  PINTEREST_SCOPES,
  PINTEREST_REDIRECT_URI,
  FRONTEND_URL,
  sseClients,
  schedulerLogRef: () => schedulerLog,
  setSchedulerLog: (value) => {
    schedulerLog = value;
  },
  hasMetaCredentials,
  hasLinkedInCredentials,
  hasYoutubeCredentials,
  hasPinterestCredentials,
  getYoutubeCredentialsForScope,
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
  migrateLinkedInPublishedPostMetrics,
  processDuePosts,
  startCampaignScheduler,
  getValidAccessToken,
  refreshYoutubeAccessToken,
  migrateLegacyPosts,
};
