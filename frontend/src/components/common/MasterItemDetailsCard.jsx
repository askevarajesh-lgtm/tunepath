import React from 'react';
import { Card, Descriptions, Tag, Typography } from 'antd';

const { Text } = Typography;

const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return 'N/A';
  return `₹${amount.toLocaleString('en-IN')}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', '');
};

const MasterItemDetailsCard = ({
  service,
  packageName,
  isDark,
  numberOfPosters,
  numberOfVideos,
  numberOfShoots,
  remainingPosters,
  remainingVideos,
  remainingShoots,
  selectedCategories,
  overriddenHandlingAmount,
  overriddenCampaignAmount,
  overriddenBasePrice,
  overriddenTotalAmount
}) => {
  if (!service) return null;

  const cardTitle = packageName ? `Package Details: ${packageName}` : 'Master Item Details';

  const posterCat = selectedCategories?.find(c => {
    const rawName = (c.name || c.categoryName || "").toLowerCase().trim();
    return rawName.includes("poster") || rawName.includes("paster");
  });
  const videoCat = selectedCategories?.find(c => {
    const rawName = (c.name || c.categoryName || "").toLowerCase().trim();
    return rawName.includes("video");
  });
  const shootCat = selectedCategories?.find(c => {
    const rawName = (c.name || c.categoryName || "").toLowerCase().trim();
    return rawName.includes("shoot");
  });

  const effectivePosters = posterCat 
    ? Math.max(0, Number(posterCat.quantity ?? posterCat.count ?? 0))
    : (numberOfPosters !== undefined && numberOfPosters !== null ? numberOfPosters : service.numberOfPosters);
    
  const effectiveRemainingPosters = posterCat
    ? (posterCat.remaining !== undefined && posterCat.remaining !== null ? Math.max(0, Number(posterCat.remaining) || 0) : effectivePosters)
    : remainingPosters;

  const effectiveVideos = videoCat 
    ? Math.max(0, Number(videoCat.quantity ?? videoCat.count ?? 0))
    : (numberOfVideos !== undefined && numberOfVideos !== null ? numberOfVideos : service.numberOfVideos);
    
  const effectiveRemainingVideos = videoCat
    ? (videoCat.remaining !== undefined && videoCat.remaining !== null ? Math.max(0, Number(videoCat.remaining) || 0) : effectiveVideos)
    : remainingVideos;

  const effectiveShoots = shootCat 
    ? Math.max(0, Number(shootCat.quantity ?? shootCat.count ?? 0))
    : (numberOfShoots !== undefined && numberOfShoots !== null ? numberOfShoots : service.numberOfShoots);
    
  const effectiveRemainingShoots = shootCat
    ? (shootCat.remaining !== undefined && shootCat.remaining !== null ? Math.max(0, Number(shootCat.remaining) || 0) : effectiveShoots)
    : remainingShoots;

  const campaignAmt = overriddenCampaignAmount ?? (service.isCampaign ? service.campaignDetails?.campaignAmount : service.campaignAmount);
  const basePrice = overriddenBasePrice ?? service.basePrice ?? service.price ?? service.rate;
  const totalAmount = overriddenTotalAmount ?? service.totalAmount ?? ((basePrice || 0) + (campaignAmt || 0));
  const handlingAmt = overriddenHandlingAmount ?? service.handlingAmount ?? basePrice;

  return (
    <Card
      title={<Text style={{ fontWeight: 600 }}>{cardTitle}</Text>}
      size="small"
      style={{
        marginTop: 16,
        backgroundColor: isDark ? '#0d1526' : '#f8f9fa',
        borderColor: isDark ? '#303030' : '#f0f0f0',
        borderRadius: 8,
      }}
      styles={{ header: { borderBottom: isDark ? '1px solid #303030' : '1px solid #f0f0f0' } }}
    >
      <Descriptions
        bordered
        size="small"
        column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
        style={{ background: isDark ? '#1f1f1f' : '#ffffff', borderRadius: 8, overflow: 'hidden' }}
      >
        {service.description && (
          <Descriptions.Item label="Description" span={2}>
            {service.description}
          </Descriptions.Item>
        )}

        <Descriptions.Item label="Item Type">
          <Tag color="default" style={{ textTransform: 'uppercase' }}>{service.itemType || 'N/A'}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Pricing Model">
          <Tag color="blue" style={{ textTransform: 'uppercase' }}>{service.pricingModel || 'N/A'}</Tag>
        </Descriptions.Item>

        <Descriptions.Item label="Base Price">
          {formatCurrency(basePrice)}
        </Descriptions.Item>
        <Descriptions.Item label="Total Amount">
          {formatCurrency(totalAmount)}
        </Descriptions.Item>

        <Descriptions.Item label="Status">
          <Tag color={service.status === 'active' ? 'success' : 'default'}>
            {service.status ? service.status.charAt(0).toUpperCase() + service.status.slice(1) : 'Active'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Handling Amount">
          {formatCurrency(handlingAmt)}
        </Descriptions.Item>

        <Descriptions.Item label="Handling Duration">
          {service.handlingDuration ?? 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Campaign Amount">
          {formatCurrency(campaignAmt)}
        </Descriptions.Item>

        {effectivePosters > 0 && (
          <Descriptions.Item label="Number of Posters">
            <Text strong>{effectivePosters}</Text>
            {effectiveRemainingPosters !== undefined && effectiveRemainingPosters !== null && (
              <Tag color="cyan" style={{ marginLeft: 8 }}>Remaining: {effectiveRemainingPosters}</Tag>
            )}
          </Descriptions.Item>
        )}

        {effectiveVideos > 0 && (
          <Descriptions.Item label="Number of Videos">
            <Text strong>{effectiveVideos}</Text>
            {effectiveRemainingVideos !== undefined && effectiveRemainingVideos !== null && (
              <Tag color="cyan" style={{ marginLeft: 8 }}>Remaining: {effectiveRemainingVideos}</Tag>
            )}
          </Descriptions.Item>
        )}

        {effectiveShoots > 0 && (
          <Descriptions.Item label="Number of Shoots">
            <Text strong>{effectiveShoots}</Text>
            {effectiveRemainingShoots !== undefined && effectiveRemainingShoots !== null && (
              <Tag color="cyan" style={{ marginLeft: 8 }}>Remaining: {effectiveRemainingShoots}</Tag>
            )}
          </Descriptions.Item>
        )}

        {selectedCategories && selectedCategories.length > 0 && selectedCategories.map((cat, idx) => {
          const rawName = (cat.name || cat.categoryName || "").toLowerCase().trim();
          const isPoster = rawName.includes("poster") || rawName.includes("paster");
          const isVideo = rawName.includes("video");
          const isShoot = rawName.includes("shoot");
          
          // Only skip if the legacy separate fields are actually going to render them
          if (isPoster && effectivePosters > 0) return null;
          if (isVideo && effectiveVideos > 0) return null;
          if (isShoot && effectiveShoots > 0) return null;

          const singularName = rawName.endsWith('s') ? rawName.slice(0, -1) : rawName;
          const formattedName = singularName ? `Number of ${singularName.charAt(0).toUpperCase() + singularName.slice(1)}s` : "Unknown Item";

          return (
            <Descriptions.Item key={`cat-${idx}`} label={formattedName}>
              <Text strong>{cat.quantity ?? cat.count ?? 0}</Text>
              {cat.remaining !== undefined && cat.remaining !== null && (
                <Tag color="cyan" style={{ marginLeft: 8 }}>Remaining: {cat.remaining}</Tag>
              )}
            </Descriptions.Item>
          );
        })}

        {service.applicableAccess && service.applicableAccess.length > 0 && (
          <Descriptions.Item label="Applicable Access / Deliverables" span={2}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {service.applicableAccess.map((access, index) => (
                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: isDark ? '1px solid #303030' : '1px solid #f0f0f0', paddingBottom: 4 }}>
                  <Text strong>{access.name}</Text>
                  <Text>{access.value}</Text>
                </div>
              ))}
            </div>
          </Descriptions.Item>
        )}

        <Descriptions.Item label="Campaign Alone">
          {service.campaignAlone ? 'Yes' : 'No'}
        </Descriptions.Item>
        <Descriptions.Item label="Created At">
          {service.createdAt ? formatDate(service.createdAt) : 'N/A'}
        </Descriptions.Item>

        <Descriptions.Item label="Updated At">
          {service.updatedAt ? formatDate(service.updatedAt) : 'N/A'}
        </Descriptions.Item>

        <Descriptions.Item label="Package Details">
          <Tag color="purple">{packageName || service.name || 'Package'}</Tag>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
};

export default MasterItemDetailsCard;
