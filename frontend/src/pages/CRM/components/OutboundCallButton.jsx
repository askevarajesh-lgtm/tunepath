import React from 'react';
import { Button, Tooltip, message, Modal } from 'antd';
import { PhoneOutlined, LoadingOutlined } from '@ant-design/icons';
import { useInitiateOutboundCallMutation } from '../../../api/ivrApi';
import useCompanyIntegrations from '../../../hooks/useCompanyIntegrations';

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

  const isIvrEntitled = isPlatformAdmin || isEntitled('ivr');

  const handleTriggerCall = async () => {
    if (!isIvrEntitled) {
      message.warning('IVR Telephony is not included in your current package. Please contact your administrator.');
      return;
    }

    if (!customerPhone && !leadId) {
      message.error('No phone number available for this lead.');
      return;
    }

    Modal.confirm({
      title: `Initiate Outbound Call?`,
      icon: <PhoneOutlined style={{ color: '#10b981' }} />,
      content: (
        <div>
          <p style={{ marginBottom: 4 }}>
            Calling <strong>{leadName || 'Customer'}</strong> at:
          </p>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981', margin: '8px 0' }}>
            {customerPhone || 'Linked Phone'}
          </div>
          <p style={{ color: '#666', fontSize: 12, margin: 0 }}>
            Your agent phone will ring first, then connect to the customer through Sollu IVR.
          </p>
        </div>
      ),
      okText: 'Dial Now',
      okButtonProps: {
        style: {
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          borderColor: '#10b981',
          fontWeight: 600,
        },
      },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const res = await initiateCall({
            leadId,
            customerPhone,
          });

          if (res.simulated) {
            message.info(
              `Call simulated (Call ID: ${res.callId}). Configure Sollu IVR in Settings -> Integrations to dial live.`
            );
          } else {
            message.success(`Outbound call initiated! (Call ID: ${res.callId || '0012'})`);
          }

          if (onCallInitiated) {
            onCallInitiated(res);
          }
        } catch (err) {
          message.error(err?.message || 'Failed to initiate outbound call');
        }
      },
    });
  };

  const defaultButtonStyle = {
    color: isIvrEntitled ? '#10b981' : '#94a3b8',
    fontWeight: 600,
    ...style,
  };

  const tooltipTitle = !isIvrEntitled
    ? 'IVR calling is not included in your package'
    : `Call ${customerPhone || leadName || 'Lead'}`;

  if (iconOnly) {
    return (
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
            handleTriggerCall();
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={!isIvrEntitled ? 'IVR calling is not included in your package' : ''}>
      <Button
        type={buttonType}
        size={size}
        icon={isLoading ? <LoadingOutlined /> : <PhoneOutlined />}
        loading={isLoading}
        disabled={!isIvrEntitled}
        style={{
          background: buttonType === 'primary' && isIvrEntitled ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined,
          borderColor: buttonType === 'primary' && isIvrEntitled ? '#10b981' : undefined,
          fontWeight: 600,
          borderRadius: 8,
          ...style,
        }}
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          handleTriggerCall();
        }}
      >
        {isLoading ? 'Calling...' : 'Call'}
      </Button>
    </Tooltip>
  );
};

export default OutboundCallButton;
