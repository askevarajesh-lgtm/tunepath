import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Input, message, Typography } from 'antd';
import { motion } from 'framer-motion';
import { BadgeCheck, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import api from '../../services/api';
import './SignIn.css';

const { Title, Text } = Typography;

const chartBars = [42, 68, 56, 84, 72, 96];

const monitorMetrics = [
  { value: '128', label: 'Open tasks' },
  { value: '14', label: 'Reports sent' },
  { value: '92%', label: 'On-time delivery' },
];

const visualPills = ['SEO systems', 'Creative approvals', 'Client portals'];

const socialProviders = [
  { key: 'google', label: 'Google', badge: 'G' },
  { key: 'microsoft', label: 'Microsoft', badge: 'M' },
  { key: 'github', label: 'GitHub', badge: 'GH' },
];

const shellVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.09,
      delayChildren: 0.08,
    },
  },
};

const panelVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const renderPasswordIcon = (visible) => (
  <span className="bcc-signin-password-toggle" aria-hidden="true">
    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
  </span>
);

const SignIn = () => {
  const { login } = useAuth();
  const { isDark } = useTheme();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [platformLogo, setPlatformLogo] = useState(null);
  const [platformLogoDark, setPlatformLogoDark] = useState(null);

  useEffect(() => {
    const fetchPlatformConfig = async () => {
      try {
        const res = await api.get('/superadmin/platform-config');
        if (res.data.success) {
          if (res.data.data.logo) setPlatformLogo(res.data.data.logo);
          if (res.data.data.logoDark) setPlatformLogoDark(res.data.data.logoDark);
        }
      } catch (err) {
        // Silently fail and fallback to default logo
        console.error("Could not load platform config:", err);
      }
    };
    fetchPlatformConfig();
  }, []);

  useEffect(() => {
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyOverscroll = body.style.overscrollBehavior;
    const previousHtmlOverscroll = documentElement.style.overscrollBehavior;

    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    documentElement.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.overscrollBehavior = previousBodyOverscroll;
      documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, []);

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    const { email, password } = values;

    try {
      const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5500/api';
      const response = await fetch(`${API_URL}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        setError(resData.error || 'Sign in failed. Please check your credentials.');
        return;
      }

      localStorage.setItem('token', resData.token);
      localStorage.setItem('user', JSON.stringify(resData.user));
      login(resData.user);
    } catch (err) {
      console.error('Login error:', err);
      setError('A network error occurred. Please verify your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoClick = (provider) => {
    message.info(`${provider} sign-in is available when SSO is configured for this workspace.`);
  };

  const handleHelpClick = () => {
    message.info('Password resets are handled by your workspace admin.');
  };

  return (
    <div className="bcc-signin-page">
      <span className="bcc-signin-page__glow bcc-signin-page__glow--one" aria-hidden="true" />
      <span className="bcc-signin-page__glow bcc-signin-page__glow--two" aria-hidden="true" />
      <span className="bcc-signin-page__glow bcc-signin-page__glow--three" aria-hidden="true" />

      <motion.section variants={shellVariants} initial="hidden" animate="visible" className="bcc-signin-shell">
        <div className="bcc-signin-frame">
          <motion.aside variants={panelVariants} className="bcc-signin-visual">
            <div className="bcc-signin-visual__content">
              {/* <motion.div variants={itemVariants} className="bcc-signin-visual__header">
                <span className="bcc-signin-visual__brand-tag">M1 Labs</span>
                <span className="bcc-signin-visual__subtag">Agency Growth OS</span>
              </motion.div> */}

              <motion.h1 variants={itemVariants}>Sign in to your growth workspace.</motion.h1>

              <motion.p variants={itemVariants} className="bcc-signin-visual__lede">
                One login for SEO, creative, reporting, and client operations, all under one branded dashboard.
              </motion.p>

              <motion.div variants={itemVariants} className="bcc-signin-visual__chips" aria-label="Workspace highlights">
                {visualPills.map((pill) => (
                  <span key={pill} className="bcc-signin-chip">
                    {pill}
                  </span>
                ))}
              </motion.div>

              <motion.div variants={itemVariants} className="bcc-signin-visual__scene" aria-hidden="true">
                <div className="bcc-signin-scene__halo" />
                <div className="bcc-signin-scene__clock">10:42</div>

                <div className="bcc-signin-scene__card bcc-signin-scene__card--top">
                  <span className="bcc-signin-scene__eyebrow">Campaigns launched</span>
                  <strong>24 live</strong>
                  <div className="bcc-signin-scene__progress">
                    <span />
                  </div>
                </div>

                <div className="bcc-signin-scene__card bcc-signin-scene__card--side">
                  <span className="bcc-signin-scene__eyebrow">Approvals waiting</span>
                  <strong>8 queued</strong>
                  <small>Design + SEO handoff</small>
                </div>

                <div className="bcc-signin-monitor">
                  <div className="bcc-signin-monitor__screen">
                    <div className="bcc-signin-monitor__top">
                      <span>Workspace overview</span>
                      <span>Live</span>
                    </div>

                    <div className="bcc-signin-monitor__chart">
                      {chartBars.map((height, index) => (
                        <span
                          key={`bar-${index}`}
                          className="bcc-signin-monitor__bar"
                          style={{ height: `${height}%`, animationDelay: `${index * 120}ms` }}
                        />
                      ))}
                    </div>

                    <div className="bcc-signin-monitor__metrics">
                      {monitorMetrics.map((metric) => (
                        <div key={metric.label} className="bcc-signin-monitor__metric">
                          <strong>{metric.value}</strong>
                          <span>{metric.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bcc-signin-monitor__base" />

                <div className="bcc-signin-scene__plant">
                  <span className="bcc-signin-scene__leaf bcc-signin-scene__leaf--one" />
                  <span className="bcc-signin-scene__leaf bcc-signin-scene__leaf--two" />
                  <span className="bcc-signin-scene__pot" />
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="bcc-signin-visual__note">
                <ShieldCheck size={16} />
                <span>Encrypted sessions, role-based access, and audit-ready sign-ins.</span>
              </motion.div>
            </div>
          </motion.aside>

          <motion.div variants={panelVariants} className="bcc-signin-panel">
            <Card bordered={false} className="bcc-signin-card" styles={{ body: { padding: 0 } }}>
              <div className="bcc-signin-card__inner">
                <motion.div variants={itemVariants} className="bcc-signin-brand">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                    <img 
                      src={
                        isDark 
                          ? (platformLogoDark || platformLogo || '/logo-dark.png')
                          : (platformLogo || platformLogoDark || '/logo-light.png')
                      } 
                      alt="Logo" 
                      style={{ maxHeight: 64, objectFit: 'contain' }} 
                    />
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="bcc-signin-heading">
                  <Title level={2}>Welcome back</Title>
                  <Text>Enter your email and password to continue.</Text>
                </motion.div>

                {error && (
                  <motion.div variants={itemVariants} style={{ width: '100%' }}>
                    <Alert className="bcc-signin-alert" message={error} type="error" showIcon />
                  </motion.div>
                )}

                <motion.div variants={itemVariants} className="bcc-signin-form__wrap">
                  <Form name="login" layout="vertical" onFinish={onFinish} requiredMark={false} size="large" className="bcc-signin-form">
                    <Form.Item
                      name="email"
                      label={<span className="bcc-signin-field-label">Email address</span>}
                      rules={[
                        { required: true, message: 'Please input your email!' },
                        { type: 'email', message: 'Please enter a valid email!' },
                      ]}
                    >
                      <Input
                        prefix={<Mail size={18} className="bcc-signin-field__icon" aria-hidden="true" />}
                        placeholder="you@bccmartech.com"
                        autoComplete="email"
                        inputMode="email"
                        spellCheck={false}
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      label={<span className="bcc-signin-field-label">Password</span>}
                      rules={[{ required: true, message: 'Please input your password!' }]}
                    >
                      <Input.Password
                        prefix={<Lock size={18} className="bcc-signin-field__icon" aria-hidden="true" />}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        iconRender={renderPasswordIcon}
                      />
                    </Form.Item>

                    <div className="bcc-signin-form__meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="bcc-signin-form__hint">
                        <BadgeCheck size={14} />
                        Role-based access
                      </span>
                      <a href="/forgot-password" style={{ fontSize: '0.875rem', color: 'var(--accent-primary)', fontWeight: 500, textDecoration: 'none' }}>Forgot password?</a>
                    </div>

                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button type="primary" htmlType="submit" block loading={loading} className="bcc-signin-submit">
                        Sign in
                      </Button>
                    </Form.Item>
                  </Form>
                </motion.div>
              </div>
            </Card>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
};

export default SignIn;
