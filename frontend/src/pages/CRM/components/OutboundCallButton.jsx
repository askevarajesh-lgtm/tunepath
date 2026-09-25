import React, { useState } from 'react';
import { Button, Tooltip, message } from 'antd';
import { PhoneOutlined, LoadingOutlined } from '@ant-design/icons';
import { useInitiateOutboundCallMutation } from '../../../api/ivrApi';
import useCompanyIntegrations from '../../../hooks/useCompanyIntegrations';
import MobileDialerModal from './MobileDialerModal';

const OutboundCallButton = ({
  leadId,
  customerPhone,
  leadName = '',
  buttonType = 'text',
  iconOnly = false,
  size = 'middle',
  style = {},
  className = '',
  onCallInitiated,
}) => {
  const [initiateCall, { isLoading }] = useInitiateOutboundCallMutation();
  const { isEntitled, isPlatformAdmin } = useCompanyIntegrations();
  const [isDialerOpen, setIsDialerOpen] = useState(false);

  const isIvrEntitled = isPlatformAdmin || isEntitled('ivr');

  const handleOpenDialer = () => {
    if (!isIvrEntitled) {
      message.warning('IVR Telephony is not included in your current package. Please contact your administrator.');
      return;
    }

    if (!customerPhone && !leadId) {
      message.error('No phone number available for this lead.');
      return;
    }

    setIsDialerOpen(true);
  };

  const handleExecuteCall = async () => {
    try {
      const res = await initiateCall({
        leadId,
        customerPhone,
      });

      if (res?.simulated) {
        message.info(
          `Call simulated (Call ID: ${res.callId}). Configure Sollu IVR in Settings -> Integrations to dial live.`
        );
      } else {
        message.success(`Outbound call initiated! (Call ID: ${res?.callId || '0012'})`);
      }

      if (onCallInitiated) {
        onCallInitiated(res);
      }
      return res;
    } catch (err) {
      message.error(err?.data?.message || err?.message || 'Failed to initiate outbound call');
      throw err;
    }
  };

  const defaultButtonStyle = {
    color: isIvrEntitled ? '#10b981' : '#94a3b8',
    fontWeight: 600,
    ...style,
  };

  const tooltipTitle = !isIvrEntitled
    ? 'IVR calling is not included in your package'
    : `Call ${customerPhone || leadName || 'Lead'}`;

  return (
    <>
      {iconOnly ? (
        <Tooltip title={tooltipTitle}>
          <Button
            type={buttonType}
            shape="circle"
            size={size}
            icon={isLoading ? <LoadingOutlined /> : <PhoneOutlined />}
            style={defaultButtonStyle}
            className={className}
            disabled={isLoading || !isIvrEntitled}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDialer();
            }}
          />
        </Tooltip>
      ) : (
        <Tooltip title={!isIvrEntitled ? 'IVR calling is not included in your package' : ''}>
          <Button
            type={buttonType}
            size={size}
            icon={isLoading ? <LoadingOutlined /> : <PhoneOutlined />}
            loading={isLoading}
            disabled={!isIvrEntitled}
            style={{
              background:
                buttonType === 'primary' && isIvrEntitled
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : undefined,
              borderColor: buttonType === 'primary' && isIvrEntitled ? '#10b981' : undefined,
              fontWeight: 600,
              borderRadius: 8,
              ...style,
            }}
            className={className}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDialer();
            }}
          >
            {isLoading ? 'Calling...' : 'Call'}
          </Button>
        </Tooltip>
      )}

      {/* Unique Mobile Phone Dialer & Active Call View Modal */}
      <MobileDialerModal
        open={isDialerOpen}
        onClose={() => setIsDialerOpen(false)}
        leadName={leadName}
        customerPhone={customerPhone}
        leadId={leadId}
        onInitiateCall={handleExecuteCall}
        isLoading={isLoading}
      />
    </>
  );
};

export default OutboundCallButton;

