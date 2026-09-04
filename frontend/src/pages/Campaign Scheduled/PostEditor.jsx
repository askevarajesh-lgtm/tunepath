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
  Carousel,
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

const DraggableImage = ({ src, cropData, setCropData, isOriginalRatio = false }) => {
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
      style={{ 
        width: "100%", 
        height: "100%",
        overflow: "hidden", 
        position: "relative", 
        cursor: isDragging ? "grabbing" : "grab", 
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        userSelect: "none"
      }}
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
          display: "block",
          transform: `translate(${currentCrop.x * 100}%, ${currentCrop.y * 100}%) scale(${currentCrop.zoom})`,
          width: "100%",
          height: "100%",
          objectFit: isOriginalRatio ? "contain" : "cover",
          transition: isDragging ? "none" : "transform 0.1s",
          pointerEvents: "none"
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
  accountId,
  cropDataMap,
  setCropDataMap,
}) => {
  const currentRatio = aspectRatio || "original";
  const [measuredRatios, setMeasuredRatios] = useState({});

  const mediaUrls = useMemo(() => {
    if (!media || media.length === 0) return [];
    return media.map((file) => {
      if (!file) return "";
      if (typeof file === "string" && file) return file;
      if (file instanceof File || file instanceof Blob) {
        return URL.createObjectURL(file);
      }
      if (file.originFileObj && (file.originFileObj instanceof File || file.originFileObj instanceof Blob)) {
        return URL.createObjectURL(file.originFileObj);
      }
      if (file.url && typeof file.url === "string") return file.url;
      if (file.thumbUrl && typeof file.thumbUrl === "string") return file.thumbUrl;
      if (file.type && file.size && file.name) {
        try {
          return URL.createObjectURL(new Blob([file], { type: file.type }));
        } catch (e) {
          return "";
        }
      }
      return "";
    }).filter(Boolean);
  }, [media]);

  useEffect(() => {
    if (!mediaUrls || mediaUrls.length === 0) {
      setMeasuredRatios({});
      return;
    }

    let isMounted = true;
    mediaUrls.forEach((url) => {
      if (!url) return;
      if (postType === "video") {
        const video = document.createElement("video");
        video.onloadedmetadata = () => {
          if (!isMounted) return;
          if (video.videoWidth && video.videoHeight) {
            const r = video.videoWidth / video.videoHeight;
            setMeasuredRatios((prev) => ({ ...prev, [url]: r }));
          }
        };
        video.src = url;
      } else {
        const img = new Image();
        img.onload = () => {
          if (!isMounted) return;
          if (img.naturalWidth && img.naturalHeight) {
            const r = img.naturalWidth / img.naturalHeight;
            setMeasuredRatios((prev) => ({ ...prev, [url]: r }));
          }
        };
        img.src = url;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [mediaUrls, postType]);

  const computedAspectRatio = useMemo(() => {
    if (currentRatio !== "original" && currentRatio) {
      return currentRatio;
    }

    const ratios = mediaUrls
      .map((url) => measuredRatios[url])
      .filter((r) => typeof r === "number" && !isNaN(r) && r > 0);

    if (ratios.length === 0) {
      return "1 / 1";
    }

    if (ratios.length === 1) {
      return `${ratios[0]}`;
    }

    // In a carousel with multiple images, use the highest aspect ratio (widest)
    const maxRatio = Math.max(...ratios);
    return `${maxRatio}`;
  }, [currentRatio, mediaUrls, measuredRatios]);

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
      <style>{`
        .post-preview-media {
          width: 100%;
          aspect-ratio: ${computedAspectRatio};
          background: #000;
          display: block;
          overflow: hidden;
          position: relative;
          border-radius: 8px;
        }
        .post-preview-media .ant-carousel {
          width: 100%;
          height: 100%;
        }
        .post-preview-media .ant-carousel .slick-slider {
          width: 100%;
          height: 100%;
          position: relative;
        }
        .post-preview-media .ant-carousel .slick-list {
          width: 100%;
          height: 100% !important;
          overflow: hidden;
        }
        .post-preview-media .ant-carousel .slick-track {
          height: 100% !important;
          display: flex !important;
        }
        .post-preview-media .ant-carousel .slick-slide {
          height: 100% !important;
          display: block !important;
        }
        .post-preview-media .ant-carousel .slick-slide > div {
          width: 100%;
          height: 100%;
          display: flex !important;
          align-items: center;
          justify-content: center;
        }
        .post-preview-media .ant-carousel .slick-prev,
        .post-preview-media .ant-carousel .slick-next {
          font-size: 0 !important;
          color: transparent !important;
          z-index: 10;
          width: 32px;
          height: 32px;
          background: rgba(0, 0, 0, 0.55);
          border-radius: 50%;
          display: flex !important;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          outline: none;
          cursor: pointer;
        }
        .post-preview-media .ant-carousel .slick-prev:hover,
        .post-preview-media .ant-carousel .slick-next:hover {
          background: rgba(0, 0, 0, 0.85);
          transform: translateY(-50%) scale(1.1);
        }
        .post-preview-media .ant-carousel .slick-prev {
          left: 10px;
        }
        .post-preview-media .ant-carousel .slick-next {
          right: 10px;
        }
        .post-preview-media .ant-carousel .slick-prev > *,
        .post-preview-media .ant-carousel .slick-next > * {
          display: none !important;
        }
        .post-preview-media .ant-carousel .slick-prev::before {
          content: "‹";
          font-size: 24px;
          line-height: 1;
          color: #ffffff;
          display: block;
          margin-top: -2px;
        }
        .post-preview-media .ant-carousel .slick-next::before {
          content: "›";
          font-size: 24px;
          line-height: 1;
          color: #ffffff;
          display: block;
          margin-top: -2px;
        }
        .post-preview-media .ant-carousel .slick-dots {
          bottom: 8px;
          z-index: 10;
          margin: 0;
        }
        .post-preview-media .ant-carousel .slick-dots li {
          vertical-align: middle;
        }
        .post-preview-media .ant-carousel .slick-dots li button {
          background: rgba(255, 255, 255, 0.4);
          height: 4px;
          border-radius: 2px;
          transition: all 0.3s ease;
        }
        .post-preview-media .ant-carousel .slick-dots li.slick-active button {
          background: #ffffff;
          width: 18px;
        }
      `}</style>
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
            <div className="post-preview-media">
              {mediaUrls.length > 0 ? (
                mediaUrls.length === 1 ? (
                  postType === "video" ? (
                    <video 
                      src={mediaUrls[0]} 
                      autoPlay 
                      muted 
                      loop 
                      controls
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} 
                    />
                  ) : (
                    <DraggableImage 
                      src={mediaUrls[0]} 
                      isOriginalRatio={currentRatio === "original"}
                      cropData={cropDataMap[`${accountId}_0`] || cropDataMap[accountId] || { x: 0, y: 0, zoom: 1 }} 
                      setCropData={(updater) => {
                         setCropDataMap(prev => {
                           const oldCrop = prev[`${accountId}_0`] || prev[accountId] || { x: 0, y: 0, zoom: 1 };
                           const newCrop = typeof updater === 'function' ? updater(oldCrop) : updater;
                           return { ...prev, [`${accountId}_0`]: newCrop };
                         });
                      }} 
                    />
                  )
                ) : (
                  <Carousel arrows={true} dots={true} infinite={false} style={{ width: "100%", height: "100%" }}>
                    {mediaUrls.map((url, index) => {
                      return (
                        <div key={index} style={{ width: "100%", height: "100%" }}>
                          {postType === "video" ? (
                            <video 
                              src={url} 
                              autoPlay 
                              muted 
                              loop 
                              controls
                              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} 
                            />
                          ) : (
                            <DraggableImage 
                              src={url} 
                              isOriginalRatio={currentRatio === "original"}
                              cropData={cropDataMap[`${accountId}_${index}`] || cropDataMap[accountId] || { x: 0, y: 0, zoom: 1 }} 
                              setCropData={(updater) => {
                                 setCropDataMap(prev => {
                                   const oldCrop = prev[`${accountId}_${index}`] || prev[accountId] || { x: 0, y: 0, zoom: 1 };
                                   const newCrop = typeof updater === 'function' ? updater(oldCrop) : updater;
                                   return { ...prev, [`${accountId}_${index}`]: newCrop };
                                 });
                              }} 
                            />
                          )}
                        </div>
                      );
                    })}
                  </Carousel>
                )
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "250px", color: "#94a3b8", background: "#f1f5f9" }}>
                  <UploadOutlined
                    style={{ fontSize: 32, display: "block", marginBottom: 8 }}
                  />
                  <Text type="secondary">Media placeholder</Text>
                </div>
              )}
            </div>
          )}
          <div className="post-preview-caption">
            {(platform === "youtube" || platform === "pinterest") && title && (
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
  const [mediaFiles, setMediaFiles] = useState([]);
  const [platformMediaFiles, setPlatformMediaFiles] = useState({});
  const selectedPlatformIds = Form.useWatch("platforms", form) || [];
  
  const needsTitle = useMemo(() => {
    return selectedPlatformIds.some(id => {
      const account = accounts.find(a => a.id === id);
      return account && (account.platform === "youtube" || account.platform === "pinterest");
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
    if (open) {
      form.resetFields();
      setCropDataMap({ default: { x: 0, y: 0, zoom: 1 } });
      setMediaFiles([]);
      setPlatformMediaFiles({});
      setAspectRatios({ default: "original" });
      setPreviewTab("all");
      setActiveMediaTab("default");

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
    }
  }, [post, form, open]);

  useEffect(() => {
    if (!allowedPostTypes.includes(postType) && allowedPostTypes.length > 0) {
      form.setFieldValue("postType", allowedPostTypes[0]);
      form.setFieldValue("media", []);
      message.info(
        `Post type reset to ${allowedPostTypes[0]} due to platform restrictions.`,
      );
    }
  }, [allowedPostTypes, postType, form]);

  const buildPostPayload = (values, mode, customMediaFiles = null, customPlatformMediaFiles = {}) => {
    let mediaFile = customMediaFiles;
    if (!mediaFile && values.media && values.media.length > 0) {
      mediaFile = values.media.map(m => m.originFileObj).filter(Boolean);
      if (mediaFile.length === 0) mediaFile = null;
    }

    const firstMediaFile = Array.isArray(mediaFile) ? mediaFile[0] : mediaFile;
    const uploadedFile = values.media?.[0];
    const mediaUrl =
      values.postType === "text"
        ? undefined
        : firstMediaFile
          ? URL.createObjectURL(firstMediaFile)
          : uploadedFile?.originFileObj
          ? URL.createObjectURL(uploadedFile.originFileObj)
          : uploadedFile?.url || post?.media_url || post?.mediaUrl || undefined;

    const platformMediaFiles = customPlatformMediaFiles || {};
    
    // Process platform-specific media from values
    const uniqueAccountIds = [...new Set(values.platforms || [])];
    uniqueAccountIds.forEach(id => {
       const pFiles = values[`media_${id}`];
       if (pFiles && pFiles.length > 0 && !platformMediaFiles[id]) {
           platformMediaFiles[id] = pFiles.map(f => f.originFileObj).filter(Boolean);
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
    let defaultCropped = [];
    let customPlatformMediaFiles = {};

    const defaultRatio = aspectRatios["default"];
    const defaultRatioNum = defaultRatio && defaultRatio !== "original" ? parseFloat(defaultRatio.split("/")[0]) / parseFloat(defaultRatio.split("/")[1]) : null;

    if (values.media && values.media.length > 0) {
       for (let i = 0; i < values.media.length; i++) {
          const file = values.media[i].originFileObj;
          if (file && values.postType === "image") {
             const defaultCrop = cropDataMap[`default_${i}`] || cropDataMap["default"] || { x: 0, y: 0, zoom: 1 };
             defaultCropped.push(await cropImage(file, defaultCrop, defaultRatioNum));
          } else if (file) {
             defaultCropped.push(file);
          }
       }
    }

    const uniqueAccountIds = [...new Set(values.platforms || [])];
    for (const accountId of uniqueAccountIds) {
      const pFiles = values[`media_${accountId}`] || [];
      if (pFiles.length > 0) {
        customPlatformMediaFiles[accountId] = [];
        const pRatio = aspectRatios[accountId] || "original";
        const pRatioNum = pRatio !== "original" ? parseFloat(pRatio.split("/")[0]) / parseFloat(pRatio.split("/")[1]) : null;
        
        for (let i = 0; i < pFiles.length; i++) {
           const pFile = pFiles[i].originFileObj;
           if (pFile && values.postType === "image") {
             const pCrop = cropDataMap[`${accountId}_${i}`] || cropDataMap[accountId] || { x: 0, y: 0, zoom: 1 };
             customPlatformMediaFiles[accountId].push(await cropImage(pFile, pCrop, pRatioNum));
           } else if (pFile) {
             customPlatformMediaFiles[accountId].push(pFile);
           }
        }
      }
    }
    return { defaultCropped: defaultCropped.length > 0 ? defaultCropped : null, customPlatformMediaFiles };
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
                                maxCount={10}
                                multiple={true}
                                accept={postType === "video" ? "video/*" : "image/*"}
                                listType="text"
                                onChange={(info) => {
                                  setMediaFiles([...(info.fileList || [])]);
                                }}
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
                                  maxCount={10}
                                  multiple={true}
                                  accept={postType === "video" ? "video/*" : "image/*"}
                                  listType="text"
                                  onChange={(info) => {
                                    setPlatformMediaFiles(prev => ({
                                      ...prev,
                                      [accountId]: [...(info.fileList || [])]
                                    }));
                                  }}
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
                      maxCount={10}
                      multiple={true}
                      accept={postType === "video" ? "video/*" : "image/*"}
                      listType="text"
                      onChange={(info) => {
                        setMediaFiles([...(info.fileList || [])]);
                      }}
                    >
                      <Button icon={<UploadOutlined />}>
                        {postType === "video" ? "Upload Video" : "Upload Image"}
                      </Button>
                    </Upload>
                  </Form.Item>
                )}
              </Form.Item>
            )}



            {needsTitle && (
              <Form.Item
                label="Title"
                name="campaign"
                rules={[{ required: true, message: "Title is required" }]}
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
                      const pMedia = platformMediaFiles[accountId]?.length > 0
                        ? platformMediaFiles[accountId]
                        : mediaFiles?.length > 0
                        ? mediaFiles
                        : form.getFieldValue(`media_${accountId}`)?.length > 0
                        ? form.getFieldValue(`media_${accountId}`)
                        : media?.length > 0
                        ? media
                        : [];
                      const pAspectRatio = aspectRatios[accountId] || aspectRatios["default"] || "original";
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
                          accountId={accountId}
                          cropDataMap={cropDataMap}
                          setCropDataMap={setCropDataMap}
                        />
                      );
                  })
                ) : (
                  <PostPreview
                    title={campaign}
                    caption={caption}
                    media={mediaFiles?.length > 0 ? mediaFiles : media || []}
                    postType={postType}
                    platform="generic"
                    aspectRatio={aspectRatios["default"] || "original"}
                    accountId="default"
                    cropDataMap={cropDataMap}
                    setCropDataMap={setCropDataMap}
                  />
                )}
              </div>
            ) : (() => {
                const accountsForPlatform = selectedPlatformIds.filter(id => accounts.find(a => a.id === id)?.platform === previewTab);
                
                return accountsForPlatform.map(accountId => {
                    const account = accounts.find(a => a.id === accountId);
                    const pPlatform = account ? account.platform : "generic";
                    const pMedia = platformMediaFiles[accountId]?.length > 0
                      ? platformMediaFiles[accountId]
                      : mediaFiles?.length > 0
                      ? mediaFiles
                      : form.getFieldValue(`media_${accountId}`)?.length > 0
                      ? form.getFieldValue(`media_${accountId}`)
                      : media?.length > 0
                      ? media
                      : [];
                    const pAspectRatio = aspectRatios[accountId] || aspectRatios["default"] || "original";
                    
                    return (
                      <PostPreview
                        key={accountId}
                        title={campaign}
                        caption={caption}
                        media={pMedia}
                        postType={postType}
                        platform={previewTab}
                        aspectRatio={pAspectRatio}
                        accountId={accountId}
                        cropDataMap={cropDataMap}
                        setCropDataMap={setCropDataMap}
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
