import {
  Button,
  DatePicker,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
  Space,
  TimePicker,
  Upload,
  message,
  Row,
  Col,
  Typography,
  Divider,
  Checkbox,
  Radio,
  Alert,
  Tabs,
} from "antd";
import {
  HeartOutlined,
  MessageOutlined,
  SendOutlined,
  UserOutlined,
  UploadOutlined,
  FacebookFilled,
  InstagramFilled,
  LinkedinFilled,
  PinterestFilled,
  YoutubeFilled,
  ShopOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useState, useMemo, useEffect, useRef } from "react";

const cropImage = (file, cropData, containerRatio) => {
  return new Promise((resolve) => {
    if (!file || !cropData) return resolve(file);
    
    const { x, y, zoom } = cropData;
    if (x === 0 && y === 0 && zoom === 1 && !containerRatio) {
      return resolve(file);
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      // Calculate container dimensions to match aspect ratio
      // We assume the image is drawn into a canvas that has the target ratio
      // and the image is scaled by `zoom` and translated by `x, y`
      let canvasWidth = img.width;
      let canvasHeight = img.height;
      
      if (containerRatio) {
        if (img.width / img.height > containerRatio) {
          canvasWidth = img.height * containerRatio;
          canvasHeight = img.height;
        } else {
          canvasWidth = img.width;
          canvasHeight = img.width / containerRatio;
        }
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d");
      
      // Fill background black for padded areas
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // We must perfectly replicate the CSS `object-fit: contain` and `transform` logic
      let fitWidth = canvasWidth;
      let fitHeight = canvasHeight;
      const imgRatio = img.width / img.height;
      const canvasRatio = canvasWidth / canvasHeight;

      if (imgRatio > canvasRatio) {
        // Image is wider than canvas
        fitHeight = canvasWidth / imgRatio;
      } else {
        // Image is taller than canvas
        fitWidth = canvasHeight * imgRatio;
      }
      
      const drawWidth = fitWidth * zoom;
      const drawHeight = fitHeight * zoom;
      
      // CSS translates by x * 100% of the image's fitted size
      const centerX = canvasWidth / 2 + x * fitWidth;
      const centerY = canvasHeight / 2 + y * fitHeight;
      
      const dx = centerX - drawWidth / 2;
      const dy = centerY - drawHeight / 2;
      
      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, drawWidth, drawHeight);
      
      canvas.toBlob((blob) => {
        if (!blob) {
          URL.revokeObjectURL(url);
          return resolve(file);
        }
        const croppedFile = new File([blob], file.name, { type: file.type });
        URL.revokeObjectURL(url);
        resolve(croppedFile);
      }, file.type);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};

const { Text } = Typography;

const PLATFORM_CAPABILITIES = {
  youtube: ["video"],
  instagram: ["image", "video"],
  facebook: ["text", "image", "video"],
  linkedin: ["text", "image", "video"],
  google_business: ["text", "image"],
  pinterest: ["image"],
};

const POST_TYPE_OPTIONS = [
  { label: "Image", value: "image" },
  { label: "Video", value: "video" },
  { label: "Text", value: "text" },
];

const PLATFORM_POST_OPTIONS = {
  youtube: [
    { label: "Video", value: "video_standard" },
    { label: "Shorts", value: "video_short" },
  ],
  facebook: [
    { label: "Feed", value: "feed" },
    { label: "Reel", value: "reel" },
  ],
  instagram: [
    { label: "Feed", value: "feed" },
    { label: "Reel", value: "reel" },
  ],
  linkedin: [{ label: "Feed", value: "feed" }],
  google_business: [
    { label: "Update", value: "update" },
    { label: "Offer", value: "offer" },
    { label: "Announcement", value: "announcement" },
  ],
};

const LOGICAL_POST_OPTIONS = [
  { label: "Standard (Feed / Video)", value: "standard" },
  { label: "Short-form (Reel / Shorts)", value: "short" },
];

const DraggableImage = ({ src, cropData, setCropData }) => {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  
  const currentCrop = cropData || { x: 0, y: 0, zoom: 1 };
  
  const handlePointerDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handlePointerMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Normalize movement to percentage of container size so it scales to full image
    const dx = e.movementX / rect.width;
    const dy = e.movementY / rect.height;
    
    setCropData((prev) => ({
      ...currentCrop,
      x: currentCrop.x + dx,
      y: currentCrop.y + dy,
    }));
  };
  
  const handlePointerUp = () => setIsDragging(false);
  
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomChange = e.deltaY * -0.001;
    const newZoom = Math.max(0.1, Math.min(5, currentCrop.zoom + zoomChange));
    setCropData((prev) => ({
      ...currentCrop,
      zoom: newZoom,
    }));
  };
  
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [currentCrop.zoom]);
  
  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", cursor: isDragging ? "grabbing" : "grab", display: "flex", alignItems: "center", justifyContent: "center" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <img 
        src={src} 
        alt="Preview" 
        draggable={false}
        style={{
          transform: `translate(${currentCrop.x * 100}%, ${currentCrop.y * 100}%) scale(${currentCrop.zoom})`,
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          transition: isDragging ? "none" : "transform 0.1s"
        }}
      />
    </div>
  );
};

const PostPreview = ({
  title,
  caption,
  media,
  postType,
  platform = "generic",
  aspectRatio,
  cropData,
  setCropData,
}) => {
  const currentRatio = aspectRatio || "1/1";
  
  const ratioNumber = useMemo(() => {
    if (currentRatio === "original" || !currentRatio) return null;
    const parts = currentRatio.split("/");
    if (parts.length !== 2) return null;
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }, [currentRatio]);

  const mediaUrl = useMemo(() => {
    if (!media || media.length === 0) return null;
    const file = media[0];
    if (file.originFileObj) {
      return URL.createObjectURL(file.originFileObj);
    }
    return file.url;
  }, [media]);

  const platformIcon = useMemo(() => {
    switch (platform) {
      case "facebook":
        return <FacebookFilled style={{ color: "#1877f2" }} />;
      case "instagram":
        return <InstagramFilled style={{ color: "#e4405f" }} />;
      case "linkedin":
        return <LinkedinFilled style={{ color: "#0a66c2" }} />;
      case "youtube":
        return <YoutubeFilled style={{ color: "#ff0000" }} />;
      case "google_business":
        return <ShopOutlined style={{ color: "#4285f4" }} />;
      case "pinterest":
        return <PinterestFilled style={{ color: "#E60023" }} />;
      default:
        return null;
    }
  }, [platform]);

  return (
    <div className="post-preview-container">
      <div className="post-preview-card">
        <div className="post-preview-header">
          <div className="post-preview-avatar" style={{ position: "relative" }}>
            <UserOutlined />
            {platformIcon && (
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  background: "#fff",
                  borderRadius: "50%",
                  fontSize: 12,
                  width: 16,
                  height: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 4px rgba(0,0,0,0.2)",
                }}
              >
                {platformIcon}
              </div>
            )}
          </div>
          <div className="post-preview-user-info">
            <span className="post-preview-username">Your Page</span>
            <span className="post-preview-time">
              Just now • {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </span>
          </div>
        </div>

        <div className="post-preview-content">
          {postType !== "text" && (
            <div className="post-preview-media" style={{ 
               position: "relative",
               aspectRatio: currentRatio !== "original" ? currentRatio : "auto",
               height: ratioNumber ? "auto" : undefined,
            }}>
              {mediaUrl ? (
                postType === "video" ? (
                  <video src={mediaUrl} autoPlay muted loop />
                ) : (
                  <DraggableImage 
                    src={mediaUrl} 
                    cropData={cropData} 
                    setCropData={setCropData} 
                  />
                )
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8" }}>
                  <UploadOutlined
                    style={{ fontSize: 32, display: "block", marginBottom: 8 }}
                  />
                  <Text type="secondary">Media placeholder</Text>
                </div>
              )}
            </div>
          )}
          <div className="post-preview-caption">
            {platform === "youtube" && title && (
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: 8,
                  fontSize: 14,
                  color: "#1e293b",
                }}
              >
                {title}
              </div>
            )}
          </div>
        </div>

        <div className="post-preview-footer">
          <HeartOutlined />
          <MessageOutlined />
          <SendOutlined />
        </div>
      </div>
    </div>
  );
};

export default function PostEditor({
  open,
  post,
  accounts = [],
  onClose,
  onSaved,
  isAdminView,
  activeClientId,
}) {
  const [form] = Form.useForm();
  const [postMode, setPostMode] = useState("immediate");
  const [saving, setSaving] = useState(false);
  const [previewTab, setPreviewTab] = useState("all");
  const [activeMediaTab, setActiveMediaTab] = useState("default");
  const [aspectRatios, setAspectRatios] = useState({ default: "original" });
  const [cropDataMap, setCropDataMap] = useState({ default: { x: 0, y: 0, zoom: 1 } });
  const postType = Form.useWatch("postType", form) || "image";
  const caption = Form.useWatch("caption", form);
  const campaign = Form.useWatch("campaign", form);
  const media = Form.useWatch("media", form);
  const selectedPlatformIds = Form.useWatch("platforms", form) || [];
  
  const hasYoutubeSelected = useMemo(() => {
    return selectedPlatformIds.some(id => {
      const account = accounts.find(a => a.id === id);
      return account && account.platform === "youtube";
    });
  }, [selectedPlatformIds, accounts]);

  const [platformOptions, setPlatformOptions] = useState({});
  const [pinterestBoardsData, setPinterestBoardsData] = useState({});
  const [selectedBoards, setSelectedBoards] = useState({});
  const [loadingBoards, setLoadingBoards] = useState(false);
  const fetchedPinterestAccountIds = useRef(new Set());

  const accountOptions = useMemo(() => {
    const grouped = (accounts || []).reduce((acc, account) => {
      const platformKey = account.platform || "unknown";
      if (!acc[platformKey]) acc[platformKey] = [];
      acc[platformKey].push(account);
      return acc;
    }, {});

    const occupiedPlatforms = new Set(
      (accounts || [])
        .filter((acc) => selectedPlatformIds.includes(acc.id))
        .map((acc) => acc.platform),
    );

    return Object.entries(grouped).map(([platform, platformAccounts]) => ({
      label: platform.charAt(0).toUpperCase() + platform.slice(1),
      options: platformAccounts.map((account) => ({
        label: account.page_name || account.username || account.id,
        value: account.id,
        disabled:
          occupiedPlatforms.has(platform) &&
          !selectedPlatformIds.includes(account.id),
      })),
    }));
  }, [accounts, selectedPlatformIds]);

  const allowedPostTypes = useMemo(() => {
    if (selectedPlatformIds.length === 0) {
      return ["image", "video", "text"];
    }

    const selectedPlatforms = (accounts || [])
      .filter((acc) => selectedPlatformIds.includes(acc.id))
      .map((acc) => acc.platform);

    if (selectedPlatforms.length === 0) return ["image", "video", "text"];

    let common = PLATFORM_CAPABILITIES[selectedPlatforms[0]] || [];
    for (let i = 1; i < selectedPlatforms.length; i++) {
      const caps = PLATFORM_CAPABILITIES[selectedPlatforms[i]] || [];
      common = common.filter((type) => caps.includes(type));
    }
    return common;
  }, [selectedPlatformIds, accounts]);

  const postTypeOptions = useMemo(() => {
    return POST_TYPE_OPTIONS.filter((opt) =>
      allowedPostTypes.includes(opt.value),
    );
  }, [allowedPostTypes]);

  const selectedPlatforms = useMemo(() => {
    const uniquePlatforms = [
      ...new Set(
        (accounts || [])
          .filter((acc) => selectedPlatformIds.includes(acc.id))
          .map((acc) => acc.platform),
      ),
    ];
    return uniquePlatforms;
  }, [selectedPlatformIds, accounts]);

  const availablePostOptions = useMemo(() => {
    return selectedPlatforms.reduce((acc, p) => {
      acc[p] = PLATFORM_POST_OPTIONS[p] || [];
      return acc;
    }, {});
  }, [selectedPlatforms]);

  useEffect(() => {
    const next = { ...platformOptions };
    let changed = false;
    selectedPlatforms.forEach((p) => {
      if (!(p in next)) {
        const defaultOption = (PLATFORM_POST_OPTIONS[p] || [])[0]?.value;
        if (defaultOption !== undefined) {
          next[p] = defaultOption;
          changed = true;
        } else {
          next[p] = null;
          changed = true;
        }
      }
    });
    if (changed) setPlatformOptions(next);
  }, [selectedPlatforms, platformOptions]);

  useEffect(() => {
    let cancelled = false;
    const fetchPinterestBoards = async () => {
      const pinterestAccountIds = (accounts || []).filter(a => selectedPlatformIds.includes(a.id) && a.platform === "pinterest").map(a => a.id);
      
      const missingAccountIds = pinterestAccountIds.filter(id => !fetchedPinterestAccountIds.current.has(id));
      
      if (missingAccountIds.length === 0) return;

      setLoadingBoards(true);
      try {
        const { campaignScheduledApi } = await import("./api.js");
        const newFetchedBoards = {};
        for (const p_id of missingAccountIds) {
          try {
            const boards = await campaignScheduledApi.getPinterestBoards(p_id, activeClientId);
            newFetchedBoards[p_id] = boards || [];
            fetchedPinterestAccountIds.current.add(p_id);
          } catch (err) {
            console.error("Failed to fetch boards for account " + p_id, err);
            newFetchedBoards[p_id] = [];
            fetchedPinterestAccountIds.current.add(p_id);
          }
        }
        if (!cancelled) {
          setPinterestBoardsData(prev => ({ ...prev, ...newFetchedBoards }));
        }
      } catch (err) {
        if (!cancelled) message.error("Failed to fetch Pinterest boards");
      } finally {
        if (!cancelled) setLoadingBoards(false);
      }
    };
    fetchPinterestBoards();
    return () => { cancelled = true; };
  }, [selectedPlatformIds, accounts, activeClientId]);

  useEffect(() => {
    if (
      selectedPlatforms.length > 0 &&
      previewTab !== "all" &&
      !selectedPlatforms.includes(previewTab)
    ) {
      setPreviewTab("all");
    }
  }, [selectedPlatforms, previewTab]);

  const postModeLabel = useMemo(
    () => (postMode === "immediate" ? "Immediate Post" : "Scheduled Post"),
    [postMode],
  );

  useEffect(() => {
    const existingMedia = post?.media_url || post?.mediaUrl || "";
    const inferredPostType = !existingMedia
      ? "text"
      : /\.(mp4|mov|avi|webm|mkv)$/i.test(existingMedia) ||
          existingMedia.includes("/video/upload/")
        ? "video"
        : "image";

    form.setFieldsValue({
      postType: post ? inferredPostType : "image",
      caption: post?.caption || "",
      campaign: post?.campaign || "",
      date: post?.scheduled_iso
        ? dayjs(post.scheduled_iso)
        : post?.scheduledDate
          ? dayjs(post.scheduledDate)
          : dayjs().add(1, "day"),
      time: post?.scheduled_iso
        ? dayjs(post.scheduled_iso)
        : post?.scheduledTime
          ? dayjs(post.scheduledTime, "HH:mm")
          : dayjs("09:00", "HH:mm"),
      platforms: post?.platforms || [],
      media: [],
    });
    setPlatformOptions(post?.post_option || {});
    setSelectedBoards(post?.boards || {});
    setPostMode(post?.post_mode || post?.postMode || "immediate");
  }, [post, form, open, accounts]);

  useEffect(() => {
    if (!allowedPostTypes.includes(postType) && allowedPostTypes.length > 0) {
      form.setFieldValue("postType", allowedPostTypes[0]);
      form.setFieldValue("media", []);
      message.info(
        `Post type reset to ${allowedPostTypes[0]} due to platform restrictions.`,
      );
    }
  }, [allowedPostTypes, postType, form]);

  const buildPostPayload = (values, mode, customMediaFile = null, customPlatformMediaFiles = {}) => {
    const uploadedFile = values.media?.[0];
    const mediaFile = customMediaFile || uploadedFile?.originFileObj || null;
    const mediaUrl =
      values.postType === "text"
        ? undefined
        : customMediaFile
          ? URL.createObjectURL(customMediaFile)
          : uploadedFile?.originFileObj
          ? URL.createObjectURL(uploadedFile.originFileObj)
          : uploadedFile?.url || post?.media_url || post?.mediaUrl || undefined;

    const platformMediaFiles = customPlatformMediaFiles || {};
    
    // Process platform-specific media from values
    const uniqueAccountIds = [...new Set(values.platforms || [])];
    uniqueAccountIds.forEach(id => {
       const pFile = values[`media_${id}`]?.[0];
       if (pFile?.originFileObj && !platformMediaFiles[id]) {
           platformMediaFiles[id] = pFile.originFileObj;
       }
    });

    const isScheduled = mode === "scheduled";
    const resolvedDate = isScheduled ? values.date : dayjs();
    const resolvedTime = isScheduled ? values.time : dayjs();

    return {
      id: post?.id || `p-${Date.now()}`,
      caption: values.caption,
      campaign: values.campaign,
      mediaUrl,
      type: values.postType === "text" ? "Text Post" : "Post Composer",
      status:
        mode === "draft" ? "Draft" : isScheduled ? "Scheduled" : "Scheduled",
      postMode:
        mode === "immediate"
          ? "immediate"
          : mode === "draft"
            ? "draft"
            : "scheduled",
      scheduledDate: resolvedDate.format("YYYY-MM-DD"),
      scheduledTime: resolvedTime.format("HH:mm"),
      scheduledISO: resolvedDate
        .hour(resolvedTime.hour())
        .minute(resolvedTime.minute())
        .second(0)
        .millisecond(0)
        .toISOString(),
      platforms: uniqueAccountIds,
      post_option: platformOptions,
      boards: selectedBoards,
      mediaFile,
      platformMediaFiles,
    };
  };

  const handleCropping = async (values) => {
    let defaultCropped = null;
    let customPlatformMediaFiles = {};

    const defaultRatio = aspectRatios["default"];
    const defaultCrop = cropDataMap["default"];
    const defaultRatioNum = defaultRatio && defaultRatio !== "original" ? parseFloat(defaultRatio.split("/")[0]) / parseFloat(defaultRatio.split("/")[1]) : null;

    if (values.media?.[0]?.originFileObj && values.postType === "image" && defaultCrop) {
      defaultCropped = await cropImage(values.media[0].originFileObj, defaultCrop, defaultRatioNum);
    } else {
      defaultCropped = values.media?.[0]?.originFileObj || null;
    }

    const uniqueAccountIds = [...new Set(values.platforms || [])];
    for (const accountId of uniqueAccountIds) {
      const pFile = values[`media_${accountId}`]?.[0]?.originFileObj;
      if (pFile && values.postType === "image") {
        const pRatio = aspectRatios[accountId] || "original";
        const pCrop = cropDataMap[accountId] || { x: 0, y: 0, zoom: 1 };
        const pRatioNum = pRatio !== "original" ? parseFloat(pRatio.split("/")[0]) / parseFloat(pRatio.split("/")[1]) : null;
        if (pCrop) {
          customPlatformMediaFiles[accountId] = await cropImage(pFile, pCrop, pRatioNum);
        } else {
          customPlatformMediaFiles[accountId] = pFile;
        }
      }
    }
    return { defaultCropped, customPlatformMediaFiles };
  };

  const onSubmit = async (values) => {
    if (saving) return;
    setSaving(true);
    try {
      const { defaultCropped, customPlatformMediaFiles } = await handleCropping(values);
      await onSaved(buildPostPayload(values, postMode, defaultCropped, customPlatformMediaFiles), postMode);
    } finally {
      setSaving(false);
    }
  };

  const onSaveDraft = async () => {
    if (saving) return;
    try {
      await form.validateFields([
        "caption",
        "campaign",
        "platforms",
      ]);
      setSaving(true);
      const allValues = form.getFieldsValue();
      const { defaultCropped, customPlatformMediaFiles } = await handleCropping(allValues);
      await onSaved(buildPostPayload(allValues, "draft", defaultCropped, customPlatformMediaFiles), "draft");
    } catch (err) {
    } finally {
      setSaving(false);
    }
  };

  const handlePrimaryAction = () => {
    if (saving) return;
    form.submit();
  };

  const postActionMenu = {
    items: [
      { key: "immediate", label: "Immediate Post" },
      { key: "scheduled", label: "Scheduled Post" },
    ],
    onClick: ({ key }) => {
      setPostMode(key);
    },
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={post ? "Edit Post" : "Create Post"}
      width={1000}
      centered
      footer={null}
      destroyOnClose
      className="post-editor-modal"
      styles={{
        body: {
          maxHeight: "calc(100vh - 100px)",
          overflowX: "hidden",
          overflowY: "auto",
          padding: 0,
        },
      }}
    >
      <Row gutter={0}>
        <Col
          xs={24}
          lg={14}
          style={{
            padding: 24,
            borderRight: "1px solid #f0f0f0",
            minHeight: "500px",
          }}
        >
          <Form
            layout="vertical"
            form={form}
            onFinish={onSubmit}
          >
            <Form.Item
              label="Accounts"
              name="platforms"
              rules={[
                { required: true, message: "At least one account is required" },
              ]}
            >
              <Select
                mode="multiple"
                options={accountOptions}
                placeholder="Select accounts to publish to"
                optionFilterProp="label"
                onChange={(nextIds) => {
                  form.setFieldValue("platforms", nextIds);
                }}
              />
            </Form.Item>

            {selectedPlatformIds.length > 0 && accounts.some(a => selectedPlatformIds.includes(a.id) && a.platform === "pinterest") && (
              <div style={{ marginBottom: 24 }}>
                <Text strong>Pinterest Boards</Text>
                {selectedPlatformIds.map(accountId => {
                   const account = accounts.find(a => a.id === accountId);
                   if (!account || account.platform !== "pinterest") return null;
                   const pageName = account.page_name || account.username || account.id;
                   const boards = pinterestBoardsData[accountId] || [];
                   return (
                     <div key={accountId} style={{ marginTop: 8 }}>
                       <Text style={{ display: "block", marginBottom: 4 }}>Board for {pageName}</Text>
                       <Select 
                         style={{ width: "100%" }}
                         placeholder="Select a board"
                         loading={loadingBoards}
                         value={selectedBoards[accountId]}
                         onChange={(val) => setSelectedBoards(prev => ({ ...prev, [accountId]: val }))}
                       >
                         {boards.map(b => (
                           <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
                         ))}
                       </Select>
                     </div>
                   );
                })}
              </div>
            )}

            <Form.Item
              label="Post Type"
              name="postType"
              rules={[{ required: true, message: "Post type is required" }]}
            >
              <Select
                options={postTypeOptions}
                onChange={() => form.setFieldValue("media", [])}
              />
            </Form.Item>

            {postType !== "text" && (
              <Form.Item label="Media Upload" required>
                <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {postType === "video" ? "Max video size: 100MB" : "Max image size: 10MB"}
                </div>
                
                {selectedPlatformIds.length > 0 ? (
                  <Tabs
                    type="card"
                    activeKey={activeMediaTab}
                    onChange={setActiveMediaTab}
                    items={[
                      {
                        key: "default",
                        label: "Default Media",
                        children: (
                          <div style={{ padding: '16px 0' }}>
                            <Form.Item
                              name="media"
                              valuePropName="fileList"
                              getValueFromEvent={(e) => e?.fileList || []}
                              rules={[
                                {
                                  validator: async (_, value) => {
                                    if (value && value.length > 0) return Promise.resolve();
                                    const allHaveSpecific = selectedPlatformIds.every(id => {
                                      const specific = form.getFieldValue(`media_${id}`);
                                      return specific && specific.length > 0;
                                    });
                                    if (allHaveSpecific) return Promise.resolve();
                                    return Promise.reject(new Error(`Please upload a default ${postType}`));
                                  }
                                }
                              ]}
                              noStyle
                            >
                              <Upload
                                beforeUpload={() => false}
                                maxCount={1}
                                accept={postType === "video" ? "video/*" : "image/*"}
                                listType="text"
                                onRemove={() => form.setFieldValue("media", [])}
                              >
                                <Button icon={<UploadOutlined />}>
                                  {postType === "video" ? "Upload Default Video" : "Upload Default Image"}
                                </Button>
                              </Upload>
                            </Form.Item>
                          </div>
                        )
                      },
                      ...selectedPlatformIds.map(accountId => {
                        const account = accounts.find(a => a.id === accountId);
                        const accountName = account ? (account.page_name || account.username || account.platform) : accountId;
                        return {
                          key: accountId,
                          label: accountName,
                          children: (
                            <div style={{ padding: '16px 0' }}>
                              <Form.Item
                                name={`media_${accountId}`}
                                valuePropName="fileList"
                                getValueFromEvent={(e) => e?.fileList || []}
                                noStyle
                              >
                                <Upload
                                  beforeUpload={() => false}
                                  maxCount={1}
                                  accept={postType === "video" ? "video/*" : "image/*"}
                                  listType="text"
                                  onRemove={() => form.setFieldValue(`media_${accountId}`, [])}
                                >
                                  <Button icon={<UploadOutlined />}>
                                    Upload specific {postType} for {accountName}
                                  </Button>
                                </Upload>
                              </Form.Item>
                              <div style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                                Optional. If not provided, the Default Media will be used.
                              </div>
                            </div>
                          )
                        };
                      })
                    ]}
                  />
                ) : (
                  <Form.Item
                    name="media"
                    valuePropName="fileList"
                    getValueFromEvent={(e) => e?.fileList || []}
                    rules={[
                      { required: true, message: `Please upload a ${postType}` },
                    ]}
                    noStyle
                  >
                    <Upload
                      beforeUpload={() => false}
                      maxCount={1}
                      accept={postType === "video" ? "video/*" : "image/*"}
                      listType="text"
                      onRemove={() => form.setFieldValue("media", [])}
                    >
                      <Button icon={<UploadOutlined />}>
                        {postType === "video" ? "Upload Video" : "Upload Image"}
                      </Button>
                    </Upload>
                  </Form.Item>
                )}
              </Form.Item>
            )}



            {hasYoutubeSelected && (
              <Form.Item
                label="Title"
                name="campaign"
                rules={[{ required: true, message: "Title is required for YouTube posts" }]}
              >
                <Input placeholder="Enter post title" maxLength={100} showCount />
              </Form.Item>
            )}

            <Form.Item
              label="Caption"
              name="caption"
              rules={[{ required: true, message: "Caption is required" }]}
            >
              <Input.TextArea
                rows={4}
                placeholder="What do you want to talk about?"
                maxLength={5000}
                showCount
              />
            </Form.Item>

            {postMode === "scheduled" && (
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    label="Date"
                    name="date"
                    rules={[{ required: true, message: "Date is required" }]}
                  >
                    <DatePicker style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Time"
                    name="time"
                    rules={[{ required: true, message: "Time is required" }]}
                  >
                    <TimePicker format="HH:mm" style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
            )}
            <Divider style={{ margin: "12px 0 24px" }} />
            <Space wrap>
              <Button onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={onSaveDraft} loading={saving} disabled={saving}>
                Save as Draft
              </Button>
              <Dropdown.Button
                type="primary"
                menu={postActionMenu}
                onClick={handlePrimaryAction}
                loading={saving}
                disabled={saving}
              >
                {postModeLabel}
              </Dropdown.Button>
            </Space>
          </Form>
        </Col>
        <Col
          xs={24}
          lg={10}
          style={{
            padding: 24,
            background: "#fafafa",
            minHeight: "500px",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Text strong type="secondary">
              Post Preview
            </Text>
          </div>
          <Tabs
            activeKey={previewTab}
            onChange={setPreviewTab}
            size="small"
            items={[
              { key: "all", label: "All" },
              ...selectedPlatforms.map((p) => ({
                key: p,
                label: (
                  <Space size={4}>
                    {p === "facebook" && (
                      <FacebookFilled style={{ color: "#1877f2" }} />
                    )}
                    {p === "instagram" && (
                      <InstagramFilled style={{ color: "#e4405f" }} />
                    )}
                    {p === "linkedin" && (
                      <LinkedinFilled style={{ color: "#0a66c2" }} />
                    )}
                    {p === "youtube" && (
                      <YoutubeFilled style={{ color: "#ff0000" }} />
                    )}
                    {p === "google_business" && (
                      <ShopOutlined style={{ color: "#4285f4" }} />
                    )}
                    {p === "pinterest" && (
                      <PinterestFilled style={{ color: "#E60023" }} />
                    )}
                    <span style={{ fontSize: 12, textTransform: "capitalize" }}>
                      {p.replace("_", " ")}
                    </span>
                  </Space>
                ),
              })),
            ]}
          />
          <div style={{ marginTop: 12 }}>
            {previewTab !== "all" && postType !== "text" && (
              <div
                style={{
                  background: "#fff",
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  marginBottom: 16,
                }}
              >
                <Text
                  strong
                  style={{
                    fontSize: 12,
                    display: "block",
                    marginBottom: 8,
                    color: "#64748b",
                  }}
                >
                  POST OPTION
                </Text>
                <Space size={16}>
                  {(PLATFORM_POST_OPTIONS[previewTab] || []).map((opt) => (
                    <Checkbox
                      key={opt.value}
                      checked={platformOptions[previewTab] === opt.value}
                      onChange={() =>
                        setPlatformOptions({
                          ...platformOptions,
                          [previewTab]: opt.value,
                        })
                      }
                      style={{ fontSize: 13 }}
                    >
                      {opt.label}
                    </Checkbox>
                  ))}
                </Space>
              </div>
            )}
            {previewTab === "all" ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 24 }}
              >
                {selectedPlatformIds.length > 0 ? (
                  selectedPlatformIds.map((accountId) => {
                      const account = accounts.find(a => a.id === accountId);
                      const pPlatform = account ? account.platform : "generic";
                      const pMedia = form.getFieldValue(`media_${accountId}`)?.length > 0 ? form.getFieldValue(`media_${accountId}`) : media;
                      const pAspectRatio = aspectRatios[accountId] || aspectRatios["default"] || "1/1";
                      const pCropData = cropDataMap[accountId] || cropDataMap["default"] || { x: 0, y: 0, zoom: 1 };
                      
                      return (
                        <PostPreview
                          key={accountId}
                          title={campaign}
                          caption={caption}
                          media={pMedia}
                          postType={postType}
                          platform={pPlatform}
                          aspectRatio={pAspectRatio}
                          cropData={pCropData}
                          setCropData={(updater) => {
                             setCropDataMap(prev => {
                               const oldCrop = prev[accountId] || { x: 0, y: 0, zoom: 1 };
                               const newCrop = typeof updater === 'function' ? updater(oldCrop) : updater;
                               return { ...prev, [accountId]: newCrop };
                             });
                          }}
                        />
                      );
                  })
                ) : (
                  <PostPreview
                    title={campaign}
                    caption={caption}
                    media={media}
                    postType={postType}
                    platform="generic"
                    aspectRatio={aspectRatios["default"] || "1/1"}
                    cropData={cropDataMap["default"] || { x: 0, y: 0, zoom: 1 }}
                    setCropData={(updater) => {
                        setCropDataMap(prev => {
                          const oldCrop = prev.default || { x: 0, y: 0, zoom: 1 };
                          const newCrop = typeof updater === 'function' ? updater(oldCrop) : updater;
                          return { ...prev, default: newCrop };
                        });
                    }}
                  />
                )}
              </div>
            ) : (() => {
                // If previewTab is a specific platform, we can find the first account that matches it
                // Or better, if previewTab is still platforms, we show all accounts for that platform
                const accountsForPlatform = selectedPlatformIds.filter(id => accounts.find(a => a.id === id)?.platform === previewTab);
                
                return accountsForPlatform.map(accountId => {
                    const account = accounts.find(a => a.id === accountId);
                    const pMedia = form.getFieldValue(`media_${accountId}`)?.length > 0 ? form.getFieldValue(`media_${accountId}`) : media;
                    const pAspectRatio = aspectRatios[accountId] || aspectRatios["default"] || "1/1";
                    const pCropData = cropDataMap[accountId] || cropDataMap["default"] || { x: 0, y: 0, zoom: 1 };
                    
                    return (
                      <PostPreview
                        key={accountId}
                        title={campaign}
                        caption={caption}
                        media={pMedia}
                        postType={postType}
                        platform={previewTab}
                        aspectRatio={pAspectRatio}
                        cropData={pCropData}
                        setCropData={(updater) => {
                           setCropDataMap(prev => {
                             const oldCrop = prev[accountId] || { x: 0, y: 0, zoom: 1 };
                             const newCrop = typeof updater === 'function' ? updater(oldCrop) : updater;
                             return { ...prev, [accountId]: newCrop };
                           });
                        }}
                      />
                    );
                });
            })()}
          </div>
          <div style={{ marginTop: 24 }}>
            <Text type="secondary" size="small">
              * This is a generic preview. Layout may vary slightly by platform.
            </Text>
          </div>
        </Col>
      </Row>
    </Modal>
  );
}
