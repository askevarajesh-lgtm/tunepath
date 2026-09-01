import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  message,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import ListView from "./ListView";
import PostEditor from "./PostEditor";
import AccountsView from "./AccountsView";
import CalendarView from "./CalendarView";
import CampaignLogsView from "./CampaignLogsView";
import InstagramConnectModal from "./InstagramConnectModal";
import LinkedInPageSelectModal from "./LinkedInPageSelectModal";
import YouTubeChannelSelectModal from "./YouTubeChannelSelectModal";
import GoogleBusinessLocationSelectModal from "./GoogleBusinessLocationSelectModal";
import ReviewsView from "./ReviewsView";
import { campaignScheduledApi, getCookie } from "./api";
import "./campaignScheduled.css";
import { useAuth } from "../../contexts/AuthContext";
import { useClientContext } from "../../contexts/ClientContext";
import NoClientSelected from "./NoClientSelected";
import DashboardView from "./DashboardView";
import useActionPermissions from "../../hooks/useActionPermissions";

const enabledIntegrations = {
  googleBusiness: true,
  facebook: true,
  instagram: true,
  linkedin: true,
  youtube: true,
  pinterest: true
};

export default function CampaignScheduledPage() {
  const { Text, Paragraph } = Typography;
  const [activeTab, setActiveTab] = useState("dashboard");
  const [posts, setPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [metaConfigured, setMetaConfigured] = useState(false);
  const [linkedInConfigured, setLinkedInConfigured] = useState(false);
  const [youtubeConfigured, setYoutubeConfigured] = useState(false);
  const [pinterestConfigured, setPinterestConfigured] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [instagramModalOpen, setInstagramModalOpen] = useState(false);
  const [loadingPlatform, setLoadingPlatform] = useState(null);
  const [disconnectingAccountId, setDisconnectingAccountId] = useState(null);
  const [viewPostOpen, setViewPostOpen] = useState(false);
  const [viewingPost, setViewingPost] = useState(null);
  const [liDiscoveryOpen, setLiDiscoveryOpen] = useState(false);
  const [liDiscoveryData, setLiDiscoveryData] = useState(null);
  const [liDiscoveryId, setLiDiscoveryId] = useState(null);
  const [liConnecting, setLiConnecting] = useState(false);
  const [ytDiscoveryOpen, setYtDiscoveryOpen] = useState(false);
  const [ytDiscoveryData, setYtDiscoveryData] = useState(null);
  const [ytDiscoveryId, setYtDiscoveryId] = useState(null);
  const [ytConnecting, setYtConnecting] = useState(false);
  const [gbDiscoveryOpen, setGbDiscoveryOpen] = useState(false);
  const [gbDiscoveryData, setGbDiscoveryData] = useState(null);
  const [gbDiscoveryId, setGbDiscoveryId] = useState(null);
  const [gbConnecting, setGbConnecting] = useState(false);
  const { user } = useAuth();
  const { selectedClient } = useClientContext();
  const headerSelectedClientId = selectedClient?._id || null;

  const getInitialActiveClientId = () => {
    if (headerSelectedClientId) return headerSelectedClientId;
    const isClientRole = ["client", "agency_client", "brand_super_admin", "brand_manager", "brand_team_user"].includes(user?.role) || (user?.role === "user" && user?.brandId);
    if (isClientRole && (user?.clientId || user?.brandId || user?._id)) return user.clientId || user.brandId || user._id;
    return null;
  };

  const [activeClientId, setActiveClientId] = useState(
    getInitialActiveClientId(),
  );
  const lastAppliedHeaderClientRef = useRef(headerSelectedClientId);
  const lastLoadErrorMessageRef = useRef("");
  const isAdminView = user?.role?.includes("admin") || user?.role?.includes("agency");

  const { canCreate, canEdit, canDelete } = useActionPermissions('/social');

  // Bypassed company integrations check since the API slices were missing from this project
  useEffect(() => {
    if (!isAdminView) return;

    // Sync activeClientId with global header selection
    if (headerSelectedClientId !== lastAppliedHeaderClientRef.current) {
      setActiveClientId(headerSelectedClientId || null);
      if (headerSelectedClientId) {
        localStorage.setItem(
          "campaign_scheduled_active_client_id",
          headerSelectedClientId,
        );
      } else {
        localStorage.removeItem("campaign_scheduled_active_client_id");
      }
      lastAppliedHeaderClientRef.current = headerSelectedClientId;
    }
  }, [isAdminView, headerSelectedClientId]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      const integrationKey = account.platform === "google_business" ? "googleBusiness" : account.platform;
      return enabledIntegrations[integrationKey] !== false;
    });
  }, [accounts, enabledIntegrations]);

  const connectedPlatforms = useMemo(
    () =>
      filteredAccounts.reduce((acc, item) => {
        acc[item.platform] = true;
        return acc;
      }, {}),
    [filteredAccounts],
  );

  const isConnected =
    Object.keys(connectedPlatforms).length > 0;

  const loadInitial = async () => {
    try {
      const [postsData, accountsData, statusData, metaData] = await Promise.all(
        [
          campaignScheduledApi.getPosts(activeClientId),
          campaignScheduledApi.getAccounts(activeClientId),
          campaignScheduledApi.getSchedulerStatus(activeClientId),
          campaignScheduledApi.getMetaStatus(activeClientId),
        ],
      );
      setPosts(postsData);
      setAccounts(accountsData);
      setSchedulerStatus(statusData);
      setMetaConfigured(Boolean(metaData.configured));
      setLinkedInConfigured(Boolean(metaData.linkedInConfigured));
      setYoutubeConfigured(Boolean(metaData.youtubeConfigured));
      setPinterestConfigured(Boolean(metaData.pinterestConfigured));
    } catch (err) {
      const nextErrorMessage = err?.message || "Failed to load scheduler data";
      if (nextErrorMessage !== lastLoadErrorMessageRef.current) {
        message.error(nextErrorMessage);
        lastLoadErrorMessageRef.current = nextErrorMessage;
      }
    }
  };

  const fetchLinkedInDiscovery = async (discoveryId) => {
    try {
      const res = await campaignScheduledApi.getLinkedInDiscovery(
        discoveryId,
        activeClientId,
      );
      setLiDiscoveryData(res.data);
      setLiDiscoveryId(discoveryId);
    } catch (err) {
      message.error("Failed to fetch available LinkedIn pages");
      setLiDiscoveryOpen(false);
    }
  };

  const handleConnectLinkedInSelected = async (selectedIds) => {
    try {
      setLiConnecting(true);
      await campaignScheduledApi.connectLinkedInSelected(
        selectedIds,
        liDiscoveryId,
        activeClientId,
      );
      message.success("LinkedIn accounts connected successfully");
      setLiDiscoveryOpen(false);
      setLiDiscoveryData(null);
      setLiDiscoveryId(null);
      await loadInitial();
    } catch (err) {
      message.error(err.message || "Failed to connect selected accounts");
    } finally {
      setLiConnecting(false);
    }
  };

  const fetchYouTubeDiscovery = async (discoveryId) => {
    try {
      const res = await campaignScheduledApi.getYouTubeDiscovery(
        discoveryId,
        activeClientId,
      );
      setYtDiscoveryData(res.data);
      setYtDiscoveryId(discoveryId);
    } catch (err) {
      message.error("Failed to fetch available YouTube channels");
      setYtDiscoveryOpen(false);
    }
  };

  const handleConnectYouTubeSelected = async (selectedIds) => {
    try {
      setYtConnecting(true);
      await campaignScheduledApi.connectYouTubeSelected(
        selectedIds,
        ytDiscoveryId,
        activeClientId,
      );
      message.success("YouTube channels connected successfully");
      setYtDiscoveryOpen(false);
      setYtDiscoveryData(null);
      setYtDiscoveryId(null);
      await loadInitial();
    } catch (err) {
      message.error(err.message || "Failed to connect selected channels");
    } finally {
      setYtConnecting(false);
    }
  };

  const fetchGoogleBusinessDiscovery = async (discoveryId) => {
    try {
      const res = await campaignScheduledApi.getGoogleBusinessDiscovery(
        discoveryId,
        activeClientId,
      );
      setGbDiscoveryData(res.data);
      setGbDiscoveryId(discoveryId);
    } catch (err) {
      message.error("Failed to fetch available business locations");
      setGbDiscoveryOpen(false);
    }
  };

  const handleConnectGoogleBusinessSelected = async (selectedLocations) => {
    try {
      setGbConnecting(true);
      await campaignScheduledApi.connectGoogleBusinessSelected(
        selectedLocations,
        gbDiscoveryId,
        activeClientId,
      );
      message.success("Google Business locations connected successfully");
      setGbDiscoveryOpen(false);
      setGbDiscoveryData(null);
      setGbDiscoveryId(null);
      await loadInitial();
    } catch (err) {
      message.error(err.message || "Failed to connect selected locations");
    } finally {
      setGbConnecting(false);
    }
  };

  const handleConnectYouTubeAnother = () => {
    // Redirect to the same YouTube auth route but with the current discoveryId
    const token = getCookie("token") || localStorage.getItem("token") || "";
    let url = `/api/campaign-scheduled/auth/youtube?token=${encodeURIComponent(token)}`;
    if (activeClientId)
      url += `&clientCompanyId=${encodeURIComponent(activeClientId)}`;
    if (ytDiscoveryId)
      url += `&discoveryId=${encodeURIComponent(ytDiscoveryId)}`;

    window.location.href = url;
  };

  useEffect(() => {
    loadInitial();

    const events = campaignScheduledApi.createEventSource(activeClientId);
    const updatePosts = (event) => {
      const next = JSON.parse(event.data || "[]");
      setPosts((next || []).map(campaignScheduledApi.normalizePost));
    };
    const updateAccounts = (event) => {
      const next = JSON.parse(event.data || "[]");
      setAccounts(next);
    };
    const refreshStatus = () => {
      campaignScheduledApi
        .getSchedulerStatus(activeClientId)
        .then(setSchedulerStatus)
        .catch(() => {});
    };

    events.addEventListener("posts_sync", updatePosts);
    events.addEventListener("accounts_sync", updateAccounts);
    events.addEventListener("post_published", refreshStatus);
    events.addEventListener("post_failed", refreshStatus);
    events.onerror = () => {};

    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (oauth) {
      if (oauth === "success") {
        message.success("Social account connected successfully");
      } else if (oauth === "error") {
        const reason = params.get("reason");
        if (reason === "rate_limited") {
          message.error("API rate limit exceeded. Please try again later.");
        } else {
          message.error(reason || "OAuth connection failed");
        }
      } else if (oauth === "discovery") {
        const platform = params.get("platform");
        if (platform === "LinkedIn") {
          setLiDiscoveryOpen(true);
          fetchLinkedInDiscovery(params.get("discoveryId"));
        } else if (platform === "YouTube") {
          setYtDiscoveryOpen(true);
          fetchYouTubeDiscovery(params.get("discoveryId"));
        } else if (platform === "GoogleBusiness") {
          setGbDiscoveryOpen(true);
          fetchGoogleBusinessDiscovery(params.get("discoveryId"));
        }
      }
      window.history.replaceState({}, "", window.location.pathname);
      if (oauth !== "discovery") {
        loadInitial();
      }
    }

    return () => {
      events.close();
    };
  }, [activeClientId, isAdminView]);

  const openEditor = (post = null) => {
    setEditingPost(post);
    setEditorOpen(true);
  };

  const handleSavePost = async (post, actionMode = "scheduled") => {
    try {
      const { mediaFile, ...postPayload } = post || {};
      let savedPost = null;
      if (editingPost?.id) {
        savedPost = await campaignScheduledApi.updatePost(
          editingPost.id,
          postPayload,
          mediaFile,
          activeClientId,
        );
      } else {
        savedPost = await campaignScheduledApi.createPost(
          postPayload,
          mediaFile,
          activeClientId,
        );
      }

      if (actionMode === "immediate" && savedPost?.id) {
        if (mediaFile) {
          await campaignScheduledApi.publishNowWithMedia(
            savedPost.id,
            mediaFile,
            activeClientId,
          );
        } else {
          await campaignScheduledApi.publishNow(savedPost.id, activeClientId);
        }
      }

      setEditorOpen(false);
      setEditingPost(null);

      if (actionMode === "immediate") {
        message.success("Post published immediately");
      } else if (actionMode === "draft") {
        message.success("Post saved as draft");
      } else {
        message.success("Post scheduled successfully");
      }

      await loadInitial();
    } catch (err) {
      message.error(err.message || "Failed to save post");
    }
  };

  const handleConnectPlatform = async (platform) => {
    if (!platform) return;
    try {
      setLoadingPlatform(platform);
      if (platform === "facebook" && metaConfigured) {
        campaignScheduledApi.startFacebookOAuth(activeClientId);
        return;
      }
      if (platform === "linkedin" && linkedInConfigured) {
        campaignScheduledApi.startLinkedinOAuth(activeClientId);
        return;
      }
      if (platform === "youtube" && youtubeConfigured) {
        campaignScheduledApi.startYoutubeOAuth(activeClientId);
        return;
      }
      if (platform === "instagram") {
        setInstagramModalOpen(true);
        return;
      }
      if (platform === "google_business") {
        campaignScheduledApi.startGoogleBusinessOAuth(activeClientId);
        return;
      }
      if (platform === "pinterest" && pinterestConfigured) {
        campaignScheduledApi.startPinterestOAuth(activeClientId);
        return;
      }
      if (platform === "facebook" || platform === "instagram") {
        throw new Error(
          "Meta credentials are not configured. Please set META_APP_ID and META_SECRET.",
        );
      }
      if (platform === "linkedin") {
        throw new Error("LinkedIn integration setup is not configured yet");
      }
      if (platform === "youtube") {
        throw new Error(
          "YouTube credentials are not configured in the server. Please check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the .env file.",
        );
      }
      if (platform === "pinterest") {
        throw new Error(
          "Pinterest credentials are not configured in the server. Please check PINTEREST_CLIENT_ID and PINTEREST_CLIENT_SECRET in the .env file.",
        );
      }
    } catch (err) {
      message.error(err.message || "Failed to connect account");
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleViewPost = (post) => {
    if (!post) return;
    setViewingPost(post);
    setViewPostOpen(true);
  };

  const handleDeletePost = async (post) => {
    if (!post?.id) return;
    try {
      await campaignScheduledApi.deletePost(post.id, activeClientId);
      message.success("Post deleted successfully");
      await loadInitial();
    } catch (err) {
      message.error(err.message || "Failed to delete post");
    }
  };

  const handleLogoutAccount = async (accountId, platformLabel) => {
    if (!accountId) return;
    try {
      setDisconnectingAccountId(accountId);
      await campaignScheduledApi.disconnectAccount(accountId, activeClientId);
      message.success(`${platformLabel || "Account"} logged out successfully`);
      await loadInitial();
    } catch (err) {
      message.error(err.message || "Failed to logout account");
    } finally {
      setDisconnectingAccountId(null);
    }
  };

  const renderMain = () => {

    if (activeTab === "accounts")
      return (
        <AccountsView
          connectedPlatforms={connectedPlatforms}
          accounts={filteredAccounts}
          onLogoutAccount={handleLogoutAccount}
          onConnectPlatform={handleConnectPlatform}
          loadingPlatform={loadingPlatform}
          disconnectingAccountId={disconnectingAccountId}
          enabledIntegrations={enabledIntegrations}
        />
      );

    if (activeTab === "calendar")
      return (
        <CalendarView
          posts={posts}
          accounts={filteredAccounts}
          onView={handleViewPost}
          onEdit={openEditor}
        />
      );
    if (activeTab === "campaigns")
      return <CampaignLogsView posts={posts} accounts={filteredAccounts} />;
    if (activeTab === "reviews")
      return (
        <ReviewsView accounts={filteredAccounts} activeClientId={activeClientId} />
      );
    if (activeTab === "dashboard")
      return (
        <DashboardView
          posts={posts}
          accounts={filteredAccounts}
          activeClientId={activeClientId}
        />
      );
    return (
      <ListView
        posts={posts}
        accounts={filteredAccounts}
        onView={handleViewPost}
        onEdit={openEditor}
        onDelete={handleDeletePost}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    );
  };

  useEffect(() => {
    if (activeTab !== "campaigns") return;
    let cancelled = false;

    const refreshMetrics = () => {
      campaignScheduledApi
        .refreshPostMetrics(activeClientId)
        .then((nextPosts) => {
          if (!cancelled) setPosts(nextPosts);
        })
        .catch(() => {});
    };

    refreshMetrics();
    const intervalId = window.setInterval(refreshMetrics, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeTab, activeClientId]);

  return (
    <>
      <Card className="campaign-scheduler-shell" style={{ marginBottom: 16 }}>
        <div className="campaign-scheduler-layout">
          <aside className="campaign-scheduler-sidebar">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
          </aside>
          <main className="campaign-scheduler-main">
            <TopNav
              onCreateClick={() => openEditor(null)}
              onConnectClick={() => setConnectOpen(true)}
              isConnected={isConnected}
              schedulerStatus={schedulerStatus}
              onRefreshClick={loadInitial}
              canCreate={canCreate}
            />
            {renderMain()}
          </main>
        </div>
      </Card>
      <PostEditor
        open={editorOpen}
        post={editingPost}
        accounts={filteredAccounts}
        onClose={() => setEditorOpen(false)}
        onSaved={handleSavePost}
        isAdminView={isAdminView}
        activeClientId={activeClientId}
      />
      <Modal
        open={viewPostOpen}
        onCancel={() => {
          setViewPostOpen(false);
          setViewingPost(null);
        }}
        footer={
          viewingPost?.status === "Published" ? (
            <Button
              onClick={() => {
                setViewPostOpen(false);
                setViewingPost(null);
              }}
            >
              Close
            </Button>
          ) : (
            <Space>
              <Button
                onClick={() => {
                  setViewPostOpen(false);
                  setViewingPost(null);
                }}
              >
                Close
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  setViewPostOpen(false);
                  openEditor(viewingPost);
                }}
              >
                Edit Post
              </Button>
            </Space>
          )
        }
        width={620}
        title={null}
        centered
        className="campaign-scheduler-view-modal"
      >
        <div className="campaign-scheduler-view-header">
          <div>
            <Text className="campaign-scheduler-view-kicker">
              Post Overview
            </Text>
            <h3 className="campaign-scheduler-view-title">
              {viewingPost?.campaign || "Untitled Campaign"}
            </h3>
          </div>
          <Tag
            color={
              viewingPost?.status === "Published"
                ? "green"
                : viewingPost?.status === "Failed"
                  ? "red"
                  : "blue"
            }
          >
            {viewingPost?.status || "Unknown"}
          </Tag>
        </div>

        <div className="campaign-scheduler-view-card">
          <div
            className="campaign-scheduler-view-row"
            style={{ marginBottom: 16 }}
          >
            <Text className="campaign-scheduler-view-label">Title</Text>
            <Paragraph
              className="campaign-scheduler-view-value"
              style={{ fontWeight: 600 }}
            >
              {viewingPost?.campaign || "-"}
            </Paragraph>
          </div>
          <div className="campaign-scheduler-view-row">
            <Text className="campaign-scheduler-view-label">Description</Text>
            <Paragraph
              className="campaign-scheduler-view-value campaign-scheduler-view-caption"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {viewingPost?.caption || "-"}
            </Paragraph>
          </div>

          <div className="campaign-scheduler-view-grid">
            <div className="campaign-scheduler-view-row">
              <Text className="campaign-scheduler-view-label">Scheduled</Text>
              <Text className="campaign-scheduler-view-value">
                {viewingPost?.scheduledDate || "-"}{" "}
                {viewingPost?.scheduledTime || ""}
              </Text>
            </div>
            <div className="campaign-scheduler-view-row">
              <Text className="campaign-scheduler-view-label">Platforms</Text>
              <Text className="campaign-scheduler-view-value">
                {(viewingPost?.platforms || [])
                  .map((id) => {
                    const account = filteredAccounts.find((item) => item.id === id);
                    if (!account) return id;
                    const platform = account.platform
                      ? `${account.platform.charAt(0).toUpperCase()}${account.platform.slice(1)}`
                      : "Platform";
                    const name =
                      account.page_name || account.username || account.id;
                    return `${platform} (${name})`;
                  })
                  .join(", ") || "-"}
              </Text>
            </div>
          </div>
        </div>
      </Modal>
      <InstagramConnectModal
        open={instagramModalOpen}
        onCancel={() => setInstagramModalOpen(false)}
        onConnectStandard={() => {
          setInstagramModalOpen(false);
          campaignScheduledApi.startInstagramOAuth(activeClientId);
        }}
      />
      <LinkedInPageSelectModal
        open={liDiscoveryOpen}
        data={liDiscoveryData}
        loading={liConnecting}
        onCancel={() => setLiDiscoveryOpen(false)}
        onConnect={handleConnectLinkedInSelected}
      />
      <YouTubeChannelSelectModal
        open={ytDiscoveryOpen}
        data={ytDiscoveryData}
        loading={ytConnecting}
        onCancel={() => setYtDiscoveryOpen(false)}
        onConnect={handleConnectYouTubeSelected}
        onConnectAnother={handleConnectYouTubeAnother}
      />
      <GoogleBusinessLocationSelectModal
        open={gbDiscoveryOpen}
        data={gbDiscoveryData}
        loading={gbConnecting}
        onCancel={() => setGbDiscoveryOpen(false)}
        onConnect={handleConnectGoogleBusinessSelected}
      />
    </>
  );
}