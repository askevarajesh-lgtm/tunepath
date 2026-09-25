import React, { useState, useEffect, useRef } from 'react';
import { Modal } from 'antd';
import {
  PhoneOutlined,
  AudioMutedOutlined,
  AudioOutlined,
  PauseOutlined,
  UserAddOutlined,
  SoundOutlined,
  CloseOutlined,
  LoadingOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { getCallStatusApi } from '../../../api/ivrApi';

const MobileDialerModal = ({
  open,
  onClose,
  leadName = 'Customer',
  customerPhone = '',
  leadId,
  onInitiateCall,
  isLoading = false,
}) => {
  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'connected' | 'ended'
  const [callDuration, setCallDuration] = useState(0);
  const [callId, setCallId] = useState(null);
  const [endStatusText, setEndStatusText] = useState('Call Ended');
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
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
      setEndStatusText('Call Ended');
      setIsMuted(false);
      setIsOnHold(false);
      setIsSpeakerOn(false);
      setShowKeypad(false);
      setKeypadInput('');
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

  // Real-time Polling: Check if call was disconnected / completed via webhook
  useEffect(() => {
    if ((callState === 'calling' || callState === 'connected') && open) {
      const checkStatus = async () => {
        try {
          const res = await getCallStatusApi(callId, { leadId, customerPhone });
          if (res?.success && res?.data?.isEnded) {
            const rawStatus = (res.data.status || '').toUpperCase();
            let label = 'Call Disconnected';
            if (rawStatus.includes('BUSY')) label = 'Line Busy';
            else if (rawStatus.includes('NOANSWER') || rawStatus.includes('NO ANSWER')) label = 'No Answer';
            else if (rawStatus.includes('CANCEL')) label = 'Call Cancelled';
            else if (rawStatus.includes('FAILED')) label = 'Call Failed';
            else if (rawStatus.includes('COMPLETED') || rawStatus.includes('ANSWER')) label = 'Call Disconnected';

            setEndStatusText(label);
            if (res.data.callDuration && res.data.callDuration > 0) {
              setCallDuration(res.data.callDuration);
            }
            setCallState('ended');

            if (pollRef.current) clearInterval(pollRef.current);
            if (timerRef.current) clearInterval(timerRef.current);

            // Auto close after brief notice
            setTimeout(() => {
              onClose();
            }, 2500);
          }
        } catch (e) {
          // silently ignore polling error
        }
      };

      // Poll every 2.5 seconds
      pollRef.current = setInterval(checkStatus, 2500);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [callState, callId, leadId, customerPhone, open, onClose]);

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
      const res = await onInitiateCall();
      if (res && (res.callId || res.success)) {
        const id = res.callId || `SOLLU-${Date.now().toString().slice(-6)}`;
        setCallId(id);
        setTimeout(() => {
          setCallState('connected');
        }, 2000);
      } else {
        setCallState('connected');
      }
    } catch (err) {
      console.error('Call initiation error:', err);
      setEndStatusText('Call Failed');
      setCallState('ended');
      setTimeout(() => {
        onClose();
      }, 1800);
    }
  };

  const handleEndCall = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    setEndStatusText('Call Disconnected');
    setCallState('ended');
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => {
      onClose();
    }, 1200);
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
            {/* Ambient Primary Glow (Soft Blue / Cyan light) */}
            <div
              style={{
                position: 'absolute',
                top: '25%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 260,
                height: 260,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.22) 0%, rgba(59, 130, 246, 0) 70%)',
                pointerEvents: 'none',
              }}
            />

            {/* Subtle Abstract Wave Lines in Background */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.05,
                backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
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
                        ? '#38bdf8'
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
                padding: '20px 20px 24px',
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
                    <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <LoadingOutlined /> Connecting IVR...
                    </span>
                  )}
                  {callState === 'connected' && (
                    <span style={{ color: '#34d399', fontWeight: 600 }}>
                      Active Call • {formatTimer(callDuration)}
                    </span>
                  )}
                  {callState === 'ended' && (
                    <span style={{ color: '#f87171', fontWeight: 600 }}>
                      {endStatusText} {callDuration > 0 ? `• ${formatTimer(callDuration)}` : ''}
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
                  width: 150,
                  height: 150,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                        border: '1.5px solid rgba(59, 130, 246, 0.5)',
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
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        animation: 'ripple 2s infinite ease-out 0.6s',
                        pointerEvents: 'none',
                      }}
                    />
                  </>
                )}

                {/* Glowing Avatar Circle */}
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    padding: 3,
                    background: 'linear-gradient(145deg, #3b82f6, #1d4ed8)',
                    boxShadow:
                      callState === 'connected'
                        ? '0 0 35px rgba(16, 185, 129, 0.5)'
                        : '0 0 35px rgba(59, 130, 246, 0.55)',
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
                      fontSize: 38,
                      fontWeight: 800,
                      color: '#93c5fd',
                      textShadow: '0 2px 8px rgba(0,0,0,0.6)',
                      border: '2px solid rgba(255, 255, 255, 0.12)',
                    }}
                  >
                    {getInitials(leadName)}
                  </div>
                </div>
              </div>

              {/* Keypad Overlay or Interactive Dialpad Controls */}
              {showKeypad ? (
                <div
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: 18,
                    padding: '10px 14px',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      height: 20,
                      textAlign: 'center',
                      fontWeight: 600,
                      color: '#38bdf8',
                      marginBottom: 6,
                    }}
                  >
                    {keypadInput || '—'}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 6,
                      textAlign: 'center',
                    }}
                  >
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                      <button
                        key={digit}
                        onClick={() => setKeypadInput((prev) => prev + digit)}
                        style={{
                          padding: '6px 0',
                          borderRadius: 10,
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: '#fff',
                          fontSize: 15,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {digit}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowKeypad(false)}
                    style={{
                      width: '100%',
                      marginTop: 6,
                      padding: 4,
                      borderRadius: 8,
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Close Keypad
                  </button>
                </div>
              ) : (
                /* Ergonomic Arc Control Layout */
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: '100%',
                    gap: 12,
                  }}
                >
                  {/* Top Row: Pause / Speaker */}
                  <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>
                    <button
                      onClick={() => setIsOnHold(!isOnHold)}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: isOnHold ? '#fbbf24' : 'rgba(255, 255, 255, 0.1)',
                        color: isOnHold ? '#000' : '#fff',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(8px)',
                      }}
                      title="Hold"
                    >
                      <PauseOutlined style={{ fontSize: 16 }} />
                    </button>

                    <button
                      onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: isSpeakerOn ? '#fff' : 'rgba(255, 255, 255, 0.1)',
                        color: isSpeakerOn ? '#000' : '#fff',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(8px)',
                      }}
                      title="Speaker"
                    >
                      <SoundOutlined style={{ fontSize: 16 }} />
                    </button>
                  </div>

                  {/* Middle Row: Mute, Big Center Action, Keypad */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 18,
                      width: '100%',
                    }}
                  >
                    {/* Mute */}
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: isMuted ? '#fff' : 'rgba(255, 255, 255, 0.1)',
                        color: isMuted ? '#000' : '#fff',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(8px)',
                      }}
                      title="Mute"
                    >
                      {isMuted ? <AudioMutedOutlined style={{ fontSize: 16 }} /> : <AudioOutlined style={{ fontSize: 16 }} />}
                    </button>

                    {/* Big Center Action Button (Green Dial or Red End Call) */}
                    {callState === 'idle' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartCall(e);
                        }}
                        disabled={isLoading}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          color: '#fff',
                          fontSize: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.6)',
                          transition: 'transform 0.15s ease',
                          position: 'relative',
                          zIndex: 100,
                          pointerEvents: 'auto',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        {isLoading ? <LoadingOutlined /> : <PhoneOutlined />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEndCall(e);
                        }}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          border: 'none',
                          color: '#fff',
                          fontSize: 24,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.7)',
                          transition: 'transform 0.15s ease',
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

                    {/* Keypad */}
                    <button
                      onClick={() => setShowKeypad(true)}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(8px)',
                      }}
                      title="Keypad"
                    >
                      <AppstoreOutlined style={{ fontSize: 16 }} />
                    </button>
                  </div>

                  {/* Bottom Row: Add Call */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#fff',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      title="Add Call"
                    >
                      <UserAddOutlined style={{ fontSize: 15 }} />
                    </button>
                  </div>
                </div>
              )}

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
