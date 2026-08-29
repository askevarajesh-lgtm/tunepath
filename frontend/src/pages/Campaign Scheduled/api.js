const BASE = "/api/campaign-scheduled";
export function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return match[2];
  return null;
}

function getAuthHeaders(extra = {}) {
  const token = getCookie("token") || localStorage.getItem("token");
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };

  const selectedClient = localStorage.getItem('selectedClient');
  if (selectedClient) {
    try {
      const parsed = JSON.parse(selectedClient);
      if (parsed?._id) {
        headers['x-selected-client-id'] = parsed._id;
      }
    } catch (e) {
      console.error('Failed to parse selectedClient from localStorage', e);
    }
  }

  return headers;
}

function buildScopedUrl(path, clientCompanyId) {
  if (!clientCompanyId) return `${BASE}${path}`;
  const sep = path.includes("?") ? "&" : "?";
  return `${BASE}${path}${sep}clientCompanyId=${encodeURIComponent(clientCompanyId)}`;
}

async function request(path, options = {}) {
  const clientCompanyId = options.clientCompanyId || null;
  const { clientCompanyId: _omit, ...rest } = options;
  const res = await fetch(buildScopedUrl(path, clientCompanyId), {
    credentials: "include",
    cache: "no-store",
    headers: getAuthHeaders({
      "Content-Type": "application/json",
      ...(rest.headers || {}),
    }),
    ...rest,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || "Request failed");
  }
  return data;
}

function normalizePost(post) {
  return {
    id: post.id,
    caption: post.caption,
    campaign: post.campaign,
    mediaUrl: post.media_url,
    status: post.status,
    type: post.type,
    postMode: post.postMode || "scheduled",
    scheduledDate: post.scheduled_date,
    scheduledTime: post.scheduled_time,
    scheduledISO: post.scheduled_iso,
    platforms: post.platforms || [],
    likes: Number(post.likes) || 0,
    comments: Number(post.comments) || 0,
    shares: Number(post.shares) || 0,
    publishedAt: post.published_at || null,
    errorMessage: post.error_message || null,
    platform_publications: post.platform_publications || {},
    boards: post.boards || {},
  };
}

export const campaignScheduledApi = {
  normalizePost,
  async getPosts(clientCompanyId = null) {
    const data = await request("/posts", { clientCompanyId });
    return (data.posts || []).map(normalizePost);
  },
  async getAnalytics(clientCompanyId = null) {
    return request("/analytics", { clientCompanyId });
  },
  async refreshPostMetrics(clientCompanyId = null) {
    const data = await request("/posts/refresh-metrics", {
      method: "POST",
      clientCompanyId,
    });
    return (data.posts || []).map(normalizePost);
  },
  async getPostComments(id, clientCompanyId = null) {
    const data = await request(`/posts/${id}/comments`, { clientCompanyId });
    return {
      comments: data.comments || [],
      commentCount: Number(data.commentCount) || 0,
    };
  },
  async createPost(payload, mediaFile = null, clientCompanyId = null) {
    const { platformMediaFiles, ...restPayload } = payload;
    if (mediaFile || (platformMediaFiles && Object.keys(platformMediaFiles).length > 0)) {
      const formData = new FormData();
      if (mediaFile) formData.append("media", mediaFile);
      
      if (platformMediaFiles) {
        Object.entries(platformMediaFiles).forEach(([id, file]) => {
          formData.append(`media_${id}`, file);
        });
      }

      Object.keys(restPayload).forEach((key) => {
        if (key === "platforms" || key === "boards" || key === "post_option") {
          formData.append(key, JSON.stringify(restPayload[key]));
        } else {
          formData.append(key, restPayload[key]);
        }
      });
      const res = await fetch(buildScopedUrl("/posts", clientCompanyId), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.message || "Request failed");
      }
      return normalizePost(data.post);
    }
    const data = await request("/posts", {
      method: "POST",
      body: JSON.stringify(restPayload),
      clientCompanyId,
    });
    return normalizePost(data.post);
  },
  async updatePost(id, payload, mediaFile = null, clientCompanyId = null) {
    const { platformMediaFiles, ...restPayload } = payload;
    if (mediaFile || (platformMediaFiles && Object.keys(platformMediaFiles).length > 0)) {
      const formData = new FormData();
      if (mediaFile) formData.append("media", mediaFile);
      
      if (platformMediaFiles) {
        Object.entries(platformMediaFiles).forEach(([pId, file]) => {
          formData.append(`media_${pId}`, file);
        });
      }

      Object.keys(restPayload).forEach((key) => {
        if (key === "platforms" || key === "boards" || key === "post_option") {
          formData.append(key, JSON.stringify(restPayload[key]));
        } else {
          formData.append(key, restPayload[key]);
        }
      });
      const res = await fetch(buildScopedUrl(`/posts/${id}`, clientCompanyId), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || data.message || "Request failed");
      }
      return normalizePost(data.post);
    }
    const data = await request(`/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(restPayload),
      clientCompanyId,
    });
    return normalizePost(data.post);
  },
  async publishNow(id, clientCompanyId = null) {
    const data = await request(`/posts/${id}/publish`, {
      method: "POST",
      clientCompanyId,
    });
    return normalizePost(data.post);
  },
  async publishNowWithMedia(id, mediaFile, clientCompanyId = null) {
    const formData = new FormData();
    formData.append("media", mediaFile);
    const res = await fetch(
      buildScopedUrl(`/posts/${id}/publish-with-media`, clientCompanyId),
      {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: formData,
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || data.message || "Request failed");
    }
    return normalizePost(data.post);
  },
  async deletePost(id, clientCompanyId = null) {
    await request(`/posts/${id}`, { method: "DELETE", clientCompanyId });
  },
  async getConnectedAccounts(clientCompanyId = null) {
    return request("/connected-accounts", { clientCompanyId });
  },
  async getAccounts(clientCompanyId = null) {
    console.log("getAccounts requested with clientCompanyId:", clientCompanyId);
    try {
      const data = await request("/accounts", { clientCompanyId });
      console.log("getAccounts returned:", data);
      return data.accounts || [];
    } catch (err) {
      console.error("getAccounts failed:", err);
      return [];
    }
  },
  async disconnectAccount(accountId, clientCompanyId = null) {
    await request(`/accounts/${accountId}`, {
      method: "DELETE",
      clientCompanyId,
    });
  },
  async getMetaStatus(clientCompanyId = null) {
    return request("/meta/status", { clientCompanyId });
  },
  async getConfiguration(clientCompanyId = null) {
    const data = await request("/configuration", { clientCompanyId });
    return data.configuration || {};
  },
  async saveYoutubeConfiguration(payload, clientCompanyId = null) {
    const data = await request("/configuration/youtube", {
      method: "PUT",
      body: JSON.stringify(payload),
      clientCompanyId,
    });
    return data.configuration || {};
  },
  async getSchedulerStatus(clientCompanyId = null) {
    const data = await request("/scheduler/status", { clientCompanyId });
    return data.scheduler;
  },
  startFacebookOAuth(clientCompanyId = null) {
    const token = getCookie("token") || localStorage.getItem("token") || "";
    const selectedClient = localStorage.getItem("selectedClient");
    if (!clientCompanyId && selectedClient) {
      try {
        const parsed = JSON.parse(selectedClient);
        clientCompanyId = parsed?._id;
      } catch (e) {}
    }
    let extra = clientCompanyId
      ? `&clientCompanyId=${encodeURIComponent(clientCompanyId)}`
      : "";
    window.location.href = `${BASE}/auth/facebook?token=${encodeURIComponent(token)}${extra}`;
  },
  async connectFacebookManualPage(pageIds, instaIds, clientCompanyId = null) {
    return request("/auth/facebook/manual-page", {
      method: "POST",
      body: JSON.stringify({ pageIds, instaIds }),
      clientCompanyId,
    });
  },
  async getFacebookDiscovery(clientCompanyId = null) {
    return request("/auth/facebook/discovery", {
      clientCompanyId,
    });
  },
  startInstagramOAuth(clientCompanyId = null) {
    const token = getCookie("token") || localStorage.getItem("token") || "";
    const selectedClient = localStorage.getItem("selectedClient");
    if (!clientCompanyId && selectedClient) {
      try {
        const parsed = JSON.parse(selectedClient);
        clientCompanyId = parsed?._id;
      } catch (e) {}
    }
    const extra = clientCompanyId
      ? `&clientCompanyId=${encodeURIComponent(clientCompanyId)}`
      : "";
    window.location.href = `${BASE}/auth/instagram?token=${encodeURIComponent(token)}${extra}`;
  },
  startInstagramDirectOAuth: (clientCompanyId = "") => {
    const token = getCookie("token") || localStorage.getItem("token") || "";
    const selectedClient = localStorage.getItem("selectedClient");
    if (!clientCompanyId && selectedClient) {
      try {
        const parsed = JSON.parse(selectedClient);
        clientCompanyId = parsed?._id;
      } catch (e) {}
    }
    const query = [
      `token=${encodeURIComponent(token)}`,
      clientCompanyId
        ? `clientCompanyId=${encodeURIComponent(clientCompanyId)}`
        : "",
    ]
      .filter(Boolean)
      .join("&");
    window.location.href = `/api/campaign-scheduled/auth/instagram/direct${query ? `?${query}` : ""}`;
  },
  startLinkedinOAuth: (clientCompanyId = "") => {
    const token = getCookie("token") || localStorage.getItem("token") || "";
    const selectedClient = localStorage.getItem("selectedClient");
    if (!clientCompanyId && selectedClient) {
      try {
        const parsed = JSON.parse(selectedClient);
        clientCompanyId = parsed?._id;
      } catch (e) {}
    }
    const extra = clientCompanyId
      ? `&clientCompanyId=${encodeURIComponent(clientCompanyId)}`
      : "";
    window.location.href = `${BASE}/auth/linkedin?token=${encodeURIComponent(token)}${extra}`;
  },
  startYoutubeOAuth(clientCompanyId = null) {
    const token = getCookie("token") || localStorage.getItem("token") || "";
    const selectedClient = localStorage.getItem("selectedClient");
    if (!clientCompanyId && selectedClient) {
      try {
        const parsed = JSON.parse(selectedClient);
        clientCompanyId = parsed?._id;
      } catch (e) {}
    }
    const extra = clientCompanyId
      ? `&clientCompanyId=${encodeURIComponent(clientCompanyId)}`
      : "";
    window.location.href = `${BASE}/auth/youtube?token=${encodeURIComponent(token)}${extra}`;
  },
  startGoogleBusinessOAuth(clientCompanyId = null) {
    const token = getCookie("token") || localStorage.getItem("token") || "";
    const selectedClient = localStorage.getItem("selectedClient");
    if (!clientCompanyId && selectedClient) {
      try {
        const parsed = JSON.parse(selectedClient);
        clientCompanyId = parsed?._id;
      } catch (e) {}
    }
    const extra = clientCompanyId
      ? `&clientCompanyId=${encodeURIComponent(clientCompanyId)}`
      : "";
    window.location.href = `${BASE}/auth/google-business?token=${encodeURIComponent(token)}${extra}`;
  },
  startPinterestOAuth(clientCompanyId = null) {
    const token = getCookie("token") || localStorage.getItem("token") || "";
    const selectedClient = localStorage.getItem("selectedClient");
    if (!clientCompanyId && selectedClient) {
      try {
        const parsed = JSON.parse(selectedClient);
        clientCompanyId = parsed?._id;
      } catch (e) {}
    }
    const extra = clientCompanyId
      ? `&clientCompanyId=${encodeURIComponent(clientCompanyId)}`
      : "";
    window.location.href = `${BASE}/auth/pinterest?token=${encodeURIComponent(token)}${extra}`;
  },
  async getGoogleBusinessDiscovery(discoveryId, clientCompanyId = null) {
    return request(
      `/auth/google-business/discovery?discoveryId=${encodeURIComponent(discoveryId)}`,
      { clientCompanyId },
    );
  },
  async getPinterestBoards(accountId, clientCompanyId = null) {
    const data = await request(`/pinterest/boards/${encodeURIComponent(accountId)}`, {
      clientCompanyId,
    });
    return data.boards || [];
  },
  async connectGoogleBusinessSelected(
    selectedLocations,
    discoveryId,
    clientCompanyId = null,
  ) {
    return request("/auth/google-business/connect-selected", {
      method: "POST",
      body: JSON.stringify({ selectedLocations, discoveryId }),
      clientCompanyId,
    });
  },
  async getGoogleBusinessReviews(accountId, clientCompanyId = null) {
    return request(`/reviews?accountId=${encodeURIComponent(accountId)}`, {
      clientCompanyId,
    });
  },
  async replyToGoogleBusinessReview(payload, clientCompanyId = null) {
    return request("/reviews/reply", {
      method: "POST",
      body: JSON.stringify(payload),
      clientCompanyId,
    });
  },
  async getLinkedInDiscovery(discoveryId, clientCompanyId = null) {
    return request(
      `/auth/linkedin/discovery?discoveryId=${encodeURIComponent(discoveryId)}`,
      { clientCompanyId },
    );
  },
  async connectLinkedInSelected(
    selectedIds,
    discoveryId,
    clientCompanyId = null,
  ) {
    return request("/auth/linkedin/connect-selected", {
      method: "POST",
      body: JSON.stringify({ selectedIds, discoveryId }),
      clientCompanyId,
    });
  },
  async getYouTubeDiscovery(discoveryId, clientCompanyId = null) {
    return request(
      `/auth/youtube/discovery?discoveryId=${encodeURIComponent(discoveryId)}`,
      { clientCompanyId },
    );
  },
  async connectYouTubeSelected(
    selectedIds,
    discoveryId,
    clientCompanyId = null,
  ) {
    return request("/auth/youtube/connect-selected", {
      method: "POST",
      body: JSON.stringify({ selectedIds, discoveryId }),
      clientCompanyId,
    });
  },
  createEventSource(clientCompanyId = null) {
    const token = getCookie("token") || localStorage.getItem("token") || "";
    const extra = clientCompanyId
      ? `&clientCompanyId=${encodeURIComponent(clientCompanyId)}`
      : "";
    return new EventSource(
      `${BASE}/events?token=${encodeURIComponent(token)}${extra}`,
    );
  },
};
