import React, { useState, useEffect } from 'react';
import { Avatar, Badge, Button, Dropdown, Grid, Layout, Popover, List, Typography, Spin, Select } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import {
    Bell,
    ChevronDown,
    LogOut,
    Menu as MenuIcon,
    Moon,
    Sun,
    User,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLayoutContext } from '../contexts/LayoutContext';
import { useClientContext } from '../contexts/ClientContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

const { Header: AntHeader } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

const Header = ({ collapsed, setCollapsed }) => {
    const { isDark, toggleTheme } = useTheme();
    const { role, user, logout } = useAuth();
    const { toggleMobileMenu } = useLayoutContext();
    const { selectedClient, switchClient, agencyClients } = useClientContext();
    const navigate = useNavigate();
    const location = useLocation();
    const screens = useBreakpoint();

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const [notifsVisible, setNotifsVisible] = useState(false);

    const [draftSelectedClientId, setDraftSelectedClientId] = useState(selectedClient?._id || 'all');

    useEffect(() => {
        setDraftSelectedClientId(selectedClient?._id || 'all');
    }, [selectedClient]);

    useEffect(() => {
        fetchNotifications();
        // In a real app we might set up an interval or websocket here
    }, []);

    const fetchNotifications = async () => {
        try {
            setLoadingNotifs(true);
            const res = await api.get('/tasks/notifications?limit=5');
            if (res.data?.success) {
                setNotifications(res.data.data.notifications || []);
                setUnreadCount(res.data.data.unreadCount || 0);
            }
        } catch (err) {
            console.error("Failed to load notifications", err);
        } finally {
            setLoadingNotifs(false);
        }
    };

    const handleNotificationClick = async (notification) => {
        try {
            if (!notification.isRead) {
                await api.put(`/tasks/notifications/${notification._id}/read`);
                setUnreadCount(prev => Math.max(0, prev - 1));
                setNotifications(prev => prev.map(n => n._id === notification._id ? { ...n, isRead: true } : n));
            }
            setNotifsVisible(false);

            if (notification.type?.startsWith('sla_')) {
                const basePath = role.includes('brand') || role === 'client' ? '/client/sla' : '/agency/sla';
                navigate(basePath);
            } else if (notification.taskId) {
                // Handle task click
            }
        } catch (err) {
            console.error("Failed to mark as read", err);
        }
    };

    const getSettingsPath = () => {
        if (['supreme_super_admin', 'superadmin'].includes(role)) return '/superadmin/settings';
        if (['commander_admin'].includes(role)) return '/settings/company';
        if (['agency_super_admin', 'agency_manager', 'agency'].includes(role)) return '/agency/settings';
        if (['brand_super_admin', 'brand_manager', 'agency_client', 'brand_team_user', 'client'].includes(role) || (role === 'user' && user?.brandId)) return '/client/settings/company';
        return '/user/settings';
    };

    const notificationContent = (
        <div style={{ width: 300 }}>
            {loadingNotifs ? (
                <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
            ) : (
                <List
                    dataSource={notifications}
                    locale={{ emptyText: "No new notifications" }}
                    renderItem={(item) => (
                        <List.Item
                            style={{ cursor: 'pointer', opacity: item.isRead ? 0.6 : 1, padding: '12px 0' }}
                            onClick={() => handleNotificationClick(item)}
                        >
                            <List.Item.Meta
                                title={<span style={{ fontWeight: item.isRead ? 'normal' : 'bold' }}>{item.title}</span>}
                                description={<Text type="secondary" style={{ fontSize: 12 }}>{item.message}</Text>}
                            />
                        </List.Item>
                    )}
                />
            )}
            <Button type="link" block onClick={() => {
                setNotifsVisible(false);
                navigate(getSettingsPath(), { state: { activeTab: '4' } });
            }}>
                View All Notifications
            </Button>
        </div>
    );

    const handleRevertImpersonation = () => {
        const origToken = localStorage.getItem('original_token');
        const origUserStr = localStorage.getItem('original_user');
        if (origToken && origUserStr) {
            localStorage.setItem('token', origToken);
            localStorage.setItem('user', origUserStr);

            const parsedUser = JSON.parse(origUserStr);
            localStorage.setItem('userRole', parsedUser.role);

            localStorage.removeItem('original_token');
            localStorage.removeItem('original_user');

            if (parsedUser.role === 'supreme_super_admin') {
                window.location.href = '/superadmin/dashboard';
            } else if (parsedUser.role === 'commander_admin') {
                window.location.href = '/dashboard';
            } else if (['agency_super_admin', 'agency_manager'].includes(parsedUser.role)) {
                window.location.href = '/agency/overview';
            } else if (['agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'client'].includes(parsedUser.role) || (parsedUser.role === 'user' && parsedUser.brandId)) {
                window.location.href = '/client/dashboard';
            } else {
                window.location.href = '/';
            }
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        return name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase();
    };

    const roleDefaults = {
        supreme_super_admin: { name: 'Supreme Admin', subtitle: 'M1 Platform', eyebrow: 'Platform Control' },
        superadmin: { name: 'Super Admin', subtitle: 'M1 Platform', eyebrow: 'Platform Control' },
        commander_admin: { name: 'Arjun Raj', subtitle: 'Agency Commander', eyebrow: 'Agency Growth OS' },
        agency_super_admin: { name: 'Agency Admin', subtitle: 'Alpha Partners', eyebrow: 'Agency Portal' },
        agency_manager: { name: 'Agency Manager', subtitle: 'Alpha Partners', eyebrow: 'Agency Portal' },
        agency: { name: 'Agency Manager', subtitle: 'Alpha Partners', eyebrow: 'Agency Portal' },
        agency_client: { name: 'Delhi Ghosh', subtitle: 'Executive', eyebrow: 'Executive Portal' },
        brand_super_admin: { name: 'Delhi Ghosh', subtitle: 'Brand Admin', eyebrow: 'Executive Portal' },
        brand_manager: { name: 'Delhi Ghosh', subtitle: 'Executive', eyebrow: 'Executive Portal' },
        brand_team_user: { name: 'Delhi Ghosh', subtitle: 'Brand Team', eyebrow: 'Executive Portal' },
        client: { name: 'Delhi Ghosh', subtitle: 'Executive', eyebrow: 'Executive Portal' },
    };

    const defaultDetails = roleDefaults[role] || { name: 'User', subtitle: 'Workspace', eyebrow: 'M1 Platform' };
    const displayName = user?.name || user?.fullName || defaultDetails.name;

    const getRoleDisplayName = (userObj, roleStr) => {
        if (userObj?.roleName) return userObj.roleName;
        if (userObj?.designation) return userObj.designation;
        if (userObj?.title) return userObj.title;

        const r = userObj?.role || roleStr || '';
        const roleMap = {
            supreme_super_admin: 'Supreme Admin',
            superadmin: 'Super Admin',
            commander_admin: 'Commander Admin',
            agency_super_admin: 'Agency Admin',
            agency_manager: 'Agency Manager',
            agency: 'Agency Manager',
            agency_client: 'Client',
            brand_super_admin: 'Brand Admin',
            brand_manager: 'Brand Manager',
            brand_team_user: 'Brand Team',
            client: 'Client',
            user: 'User'
        };

        if (roleMap[r]) return roleMap[r];

        return r
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const roleLabel = getRoleDisplayName(user, role);
    const nameWithRole = roleLabel ? `${displayName} (${roleLabel})` : displayName;

    // Use dynamically fetched data if available
    const dynamicSubtitle = user?.brandName || user?.agencyName || user?.companyName || user?.designation || user?.title || defaultDetails.subtitle;
    const dynamicEyebrow = user?.roleName || defaultDetails.eyebrow;

    const userDetails = {
        name: nameWithRole,
        rawName: displayName,
        roleLabel: roleLabel,
        subtitle: dynamicSubtitle,
        initial: getInitials(displayName),
        eyebrow: dynamicEyebrow,
    };

    const getHeaderCopy = () => {
        if (location.pathname.startsWith('/client')) {
            if (role === 'brand_super_admin') {
                return {
                    eyebrow: 'Executive Portal',
                    title: `Brand Administration (${roleLabel})`,
                    subtitle: 'Manage your workspace, billing, team access, and marketing operations.',
                };
            }
            return {
                eyebrow: userDetails.eyebrow,
                title: `${getGreeting()}, ${userDetails.name} 👋`,
                subtitle: "Here's your marketing performance overview.",
            };
        }

        if (location.pathname.startsWith('/agency')) {
            return {
                eyebrow: userDetails.eyebrow,
                title: `${getGreeting()}, ${userDetails.name} 👋`,
                subtitle: 'Track client momentum, delivery health, and agency operations.',
            };
        }

        if (location.pathname.startsWith('/superadmin')) {
            return {
                eyebrow: 'Platform Control',
                title: `Super Admin Command Center (${roleLabel})`,
                subtitle: 'Monitor companies, subscriptions, integrations, and platform health.',
            };
        }

        if (location.pathname.startsWith('/user')) {
            return {
                eyebrow: 'Personal Workspace',
                title: `${getGreeting()}, ${userDetails.name} 👋`,
                subtitle: 'Review your tasks, updates, and workspace settings.',
            };
        }

        return {
            eyebrow: userDetails.eyebrow,
            title: `${getGreeting()}, ${userDetails.name} 👋`,
            subtitle: "Here's your agency performance overview.",
        };
    };

    const headerCopy = getHeaderCopy();

    const origUserStr = localStorage.getItem('original_user');
    const origUser = origUserStr ? JSON.parse(origUserStr) : null;
    let revertPanelName = '';
    if (origUser) {
        if (origUser.role === 'commander_admin') revertPanelName = 'Commander Admin';
        else if (origUser.role === 'agency_manager' || origUser.role === 'agency') revertPanelName = 'Agency Manager';
        else if (origUser.role === 'brand_manager') revertPanelName = 'Brand Manager';
        else if (origUser.role === 'agency_super_admin') revertPanelName = 'Agency Admin';
        else if (origUser.role === 'brand_super_admin') revertPanelName = 'Brand Admin';
        else if (origUser.role === 'superadmin' || origUser.role === 'supreme_super_admin') revertPanelName = 'Super Admin';
        else revertPanelName = 'Original Panel';
    }

    const userMenuItems = [
        { key: 'profile', label: 'My Profile', icon: <User size={16} /> },
        { type: 'divider' },
        { key: 'logout', label: 'Logout', danger: true, icon: <LogOut size={16} /> },
    ];

    const handleUserMenuClick = ({ key }) => {
        if (key === 'profile') {
            navigate(getSettingsPath(), { state: { activeTab: '9' } });
        }
        if (key === 'logout') logout();
    };

    return (
        <AntHeader className="app-header">
            <div className="app-header__left">
                {setCollapsed && (
                    <Button
                        type="text"
                        icon={collapsed ? <MenuUnfoldOutlined style={{ fontSize: '18px' }} /> : <MenuFoldOutlined style={{ fontSize: '18px' }} />}
                        onClick={() => setCollapsed(!collapsed)}
                        className="app-header__icon-button"
                        aria-label="Toggle sidebar"
                        style={{ marginRight: 16 }}
                    />
                )}

                <div className="app-header__title-block">
                    <span>{headerCopy.eyebrow}</span>
                    <h1>{headerCopy.title}</h1>
                    {screens.sm && <p>{headerCopy.subtitle}</p>}
                </div>
            </div>

            <div className="app-header__actions">
                {['agency_manager', 'agency'].includes(role) && (
                    <div style={{ marginRight: 16, display: 'flex', alignItems: 'center' }}>
                        <Select
                            showSearch
                            placeholder="All Clients"
                            optionFilterProp="children"
                            value={draftSelectedClientId}
                            onChange={(val) => setDraftSelectedClientId(val)}
                            style={{ width: 220 }}
                        >
                            <Select.Option value="all">All Clients</Select.Option>
                            {agencyClients.map(c => (
                                <Select.Option key={c._id} value={c._id}>
                                    {c.name || c.companyName}
                                </Select.Option>
                            ))}
                        </Select>
                        <Button
                            type="primary"
                            style={{ marginLeft: 8 }}
                            onClick={() => {
                                if (draftSelectedClientId === 'all') {
                                    switchClient(null);
                                } else {
                                    const client = agencyClients.find(c => c._id === draftSelectedClientId);
                                    switchClient(client);
                                }
                            }}
                        >
                            Switch
                        </Button>
                    </div>
                )}

                {origUser && (
                    <Button
                        type="primary"
                        onClick={handleRevertImpersonation}
                        style={{ background: '#d9363e', borderColor: '#d9363e' }}
                        className="app-header__super-button"
                    >
                        Back to {revertPanelName}
                    </Button>
                )}

                <Button
                    type="text"
                    icon={isDark ? <Sun size={19} /> : <Moon size={19} />}
                    onClick={toggleTheme}
                    className="app-header__icon-button"
                    aria-label="Toggle theme"
                />

                <Popover
                    content={notificationContent}
                    title="Notifications"
                    trigger="click"
                    open={notifsVisible}
                    onOpenChange={(v) => {
                        setNotifsVisible(v);
                        if (v) fetchNotifications();
                    }}
                    placement="bottomRight"
                >
                    <Badge count={unreadCount} offset={[-5, 5]}>
                        <Button
                            type="text"
                            icon={<Bell size={19} />}
                            className="app-header__icon-button"
                            aria-label="Notifications"
                        />
                    </Badge>
                </Popover>

                <Dropdown
                    menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
                    trigger={['click']}
                    placement="bottomRight"
                >
                    <button type="button" className="app-header__user">
                        <Avatar src={user?.avatar} className="app-header__avatar">{!user?.avatar && userDetails.initial}</Avatar>
                        {screens.sm && (
                            <span className="app-header__user-copy">
                                <strong>{userDetails.name}</strong>
                                <small>{userDetails.subtitle}</small>
                            </span>
                        )}
                        {screens.sm && <ChevronDown size={15} />}
                    </button>
                </Dropdown>
            </div>
        </AntHeader>
    );
};

export default Header;
