import React, { useState, useEffect, useRef } from 'react';
import { Modal } from 'antd';
import {
  PhoneOutlined,
  CloseOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { getCallStatusApi, endCallApi } from '../../../api/ivrApi';
import { useTheme } from '../../../contexts/ThemeContext';

function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(225, 21, 59, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length === 6) {
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

const MobileDialerModal = ({
  open,
  onClose,
  leadName = 'Customer',
  customerPhone = '',
  leadId,
  onInitiateCall,
  isLoading = false,
}) => {
  const { userTheme } = useTheme() || {};
  const primaryColor = userTheme?.primaryColor || '#E1153B';
  const secondaryColor = userTheme?.secondaryColor || '#0ea5e9';

  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'connected' | 'ended'
  const [callDuration, setCallDuration] = useState(0);
  const [callId, setCallId] = useState(null);
  const [endStatusText, setEndStatusText] = useState('Call Ended');
  const [currentTime, setCurrentTime] = useState('9:41');

  const timerRef = useRef(null);
  const pollRef = useRef(null);

  // Live top clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const mins = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Reset state when opening modal
  useEffect(() => {
    if (open) {
      setCallState('idle');
      setCallDuration(0);
      setCallId(null);
      setEndStatusText('');
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [open]);

  // Handle call timer
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Real-time Polling: Check if call was disconnected / completed via webhook from mobile
  useEffect(() => {
    let isMounted = true;

    // Only poll when an active callId exists for this call session
    if (!callId || !open || (callState !== 'calling' && callState !== 'connected')) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await getCallStatusApi(callId);
        if (!isMounted) return;

        if (res?.success && res?.data?.isEnded) {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          setCallState('ended');
          onClose();
        }
      } catch (e) {
        // silently ignore polling error
      }
    };

    // Run status check immediately, then poll every 1.5s
    checkStatus();
    pollRef.current = setInterval(checkStatus, 1500);

    return () => {
      isMounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [callState, callId, open, onClose]);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStartCall = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    if (callState === 'calling' || callState === 'connected') return;

    try {
      setCallState('calling');
      setCallDuration(0);
      setEndStatusText('');
      const res = await onInitiateCall();
      if (res && (res.callId || res.success)) {
        const id = res.callId || res.data?.callId || null;
        if (id) {
          setCallId(id);
        }
        // Transition to connected so live call timer ticks while speaking
        setTimeout(() => {
          setCallState((current) => (current === 'calling' ? 'connected' : current));
        }, 2000);
      } else {
        setTimeout(() => {
          setCallState((current) => (current === 'calling' ? 'connected' : current));
        }, 2000);
      }
    } catch (err) {
      console.error('Call initiation error:', err);
      setCallState('idle');
      onClose();
    }
  };

  const handleEndCall = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    // 1. Immediately clear timers and stop polling
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setCallState('ended');

    // 2. Notify backend to mark call ended
    try {
      endCallApi(callId, { leadId, customerPhone, duration: callDuration });
    } catch (err) {
      console.warn('Error ending call on server:', err);
    }

    // 3. Immediately close modal at that exact moment
    onClose();
  };

  const getInitials = (name) => {
    if (!name) return 'C';
    const parts = name.trim().split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      centered
      width={360}
      rootClassName="mobile-dialer-root"
      modalRender={() => (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'auto' }}>
          {/* Smartphone Shell */}
          <div
            style={{
              width: 340,
              height: 640,
              borderRadius: 48,
              background: 'linear-gradient(180deg, #0d1e3a 0%, #091224 45%, #020617 100%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.95), 0 0 0 3px #1e293b, 0 0 0 6px #0f172a',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              color: '#fff',
              fontFamily: '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              userSelect: 'none',
              pointerEvents: 'auto',
            }}
          >
            {/* Ambient Primary Glow */}
            <div
              style={{
                position: 'absolute',
                top: '25%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 260,
                height: 260,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${hexToRgba(primaryColor, 0.28)} 0%, rgba(0, 0, 0, 0) 70%)`,
                pointerEvents: 'none',
              }}
            />

            {/* Subtle Abstract Wave Dots in Background */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.06,
                backgroundImage: `radial-gradient(${hexToRgba(primaryColor, 0.5)} 1px, transparent 1px)`,
                backgroundSize: '20px 20px',
                pointerEvents: 'none',
              }}
            />

            {/* Top Status Bar & Dynamic Island */}
            <div
              style={{
                height: 44,
                padding: '12px 24px 0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>
                {currentTime}
              </span>

              {/* Dynamic Island */}
              <div
                style={{
                  width: 90,
                  height: 24,
                  background: '#000',
                  borderRadius: 20,
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  top: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background:
                      callState === 'connected'
                        ? '#10b981'
                        : callState === 'calling'
                        ? primaryColor
                        : callState === 'ended'
                        ? '#ef4444'
                        : '#475569',
                    animation: callState === 'calling' ? 'pulse 1.5s infinite' : 'none',
                  }}
                />
              </div>

              {/* Empty placeholder for symmetrical flex layout */}
              <div style={{ width: 32 }} />
            </div>

            {/* Close Button Top Right */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 48,
                right: 18,
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 20,
                backdropFilter: 'blur(8px)',
              }}
              title="Close"
            >
              <CloseOutlined style={{ fontSize: 11 }} />
            </button>

            {/* Main Body */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '24px 20px 32px',
                zIndex: 5,
              }}
            >
              {/* Header Contact Info */}
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontWeight: 500,
                    marginBottom: 6,
                  }}
                >
                  {callState === 'idle' && 'Ready to Call'}
                  {callState === 'calling' && (
                    <span style={{ color: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600 }}>
                      <LoadingOutlined /> Dialing & Connecting Phone...
                    </span>
                  )}
                  {callState === 'connected' && (
                    <span style={{ color: '#34d399', fontWeight: 600 }}>
                      Active Call • {formatTimer(callDuration)}
                    </span>
                  )}
                  {callState === 'ended' && (
                    <span style={{ color: '#f87171', fontWeight: 600 }}>
                      {endStatusText || 'Call Ended'} {callDuration > 0 ? `• ${formatTimer(callDuration)}` : ''}
                    </span>
                  )}
                </div>

                <h2
                  style={{
                    margin: '0 0 4px',
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: -0.4,
                  }}
                >
                  {leadName || 'Customer'}
                </h2>

                <div
                  style={{
                    fontSize: 14,
                    color: 'rgba(255, 255, 255, 0.75)',
                    fontWeight: 500,
                  }}
                >
                  {customerPhone || 'Linked Phone'}
                </div>
              </div>

              {/* Glowing Avatar */}
              <div
                style={{
                  position: 'relative',
                  width: 160,
                  height: 160,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '10px 0',
                }}
              >
                {/* Pulsing Ripple Rings */}
                {(callState === 'calling' || callState === 'connected') && (
                  <>
                    <div
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        border: `1.5px solid ${hexToRgba(primaryColor, 0.6)}`,
                        animation: 'ripple 2s infinite ease-out',
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        width: '125%',
                        height: '125%',
                        borderRadius: '50%',
                        border: `1px solid ${hexToRgba(primaryColor, 0.3)}`,
                        animation: 'ripple 2s infinite ease-out 0.6s',
                        pointerEvents: 'none',
                      }}
                    />
                  </>
                )}

                {/* Glowing Avatar Circle */}
                <div
                  style={{
                    width: 130,
                    height: 130,
                    borderRadius: '50%',
                    padding: 3,
                    background: `linear-gradient(145deg, ${primaryColor}, ${secondaryColor || primaryColor})`,
                    boxShadow:
                      callState === 'connected'
                        ? '0 0 35px rgba(16, 185, 129, 0.5)'
                        : `0 0 35px ${hexToRgba(primaryColor, 0.65)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 42,
                      fontWeight: 800,
                      color: '#ffffff',
                      textShadow: `0 2px 10px ${hexToRgba(primaryColor, 0.5)}`,
                      border: '2px solid rgba(255, 255, 255, 0.12)',
                    }}
                  >
                    {getInitials(leadName)}
                  </div>
                </div>
              </div>

              {/* Dedicated Center Call Action Control */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  marginBottom: 12,
                  width: '100%',
                }}
              >
                {callState === 'idle' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStartCall(e);
                    }}
                    disabled={isLoading}
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      color: '#fff',
                      fontSize: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 10px 28px rgba(16, 185, 129, 0.65), 0 0 0 6px rgba(16, 185, 129, 0.15)',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      zIndex: 100,
                      pointerEvents: 'auto',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) e.currentTarget.style.transform = 'scale(1.08)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading) e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {isLoading ? <LoadingOutlined /> : <PhoneOutlined />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEndCall(e);
                    }}
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      border: 'none',
                      color: '#fff',
                      fontSize: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 10px 28px rgba(239, 68, 68, 0.75), 0 0 0 6px rgba(239, 68, 68, 0.15)',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      zIndex: 100,
                      pointerEvents: 'auto',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <PhoneOutlined style={{ transform: 'rotate(135deg)' }} />
                  </button>
                )}

                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: callState === 'connected' ? '#fca5a5' : '#86efac',
                    letterSpacing: 0.2,
                  }}
                >
                  {callState === 'idle' ? 'Connect Call' : callState === 'calling' ? 'Connecting...' : 'End Call'}
                </span>
              </div>

              {/* Bottom Home Indicator Bar */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                }}
              >
                <div
                  style={{
                    width: 120,
                    height: 4,
                    background: 'rgba(255, 255, 255, 0.35)',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    >
      <style>{`
        .mobile-dialer-root .ant-modal-content {
          background: transparent !important;
          background-color: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: 50px !important;
          border: none !important;
          pointer-events: auto !important;
        }
        .mobile-dialer-root .ant-modal-body {
          padding: 0 !important;
          pointer-events: auto !important;
        }
        .mobile-dialer-root .ant-modal {
          max-width: 360px !important;
          pointer-events: auto !important;
        }
        .mobile-dialer-root .ant-modal-wrap {
          pointer-events: auto !important;
        }
        @keyframes ripple {
          0% {
            transform: scale(0.9);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.35;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.3);
            opacity: 0.6;
          }
        }
      `}</style>
    </Modal>
  );
};

export default MobileDialerModal;
