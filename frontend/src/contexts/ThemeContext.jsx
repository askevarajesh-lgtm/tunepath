import React, { createContext, useContext, useState, useEffect } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import api from '../services/api';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'light';
    });

    const [userTheme, setUserTheme] = useState(() => {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            return user?.effectiveTheme || { primaryColor: '#034EA1', secondaryColor: '#0ea5e9' };
        } catch {
            return { primaryColor: '#034EA1', secondaryColor: '#0ea5e9' };
        }
    });

    useEffect(() => {
        const handleUserUpdate = () => {
            try {
                const user = JSON.parse(localStorage.getItem('user'));
                setUserTheme(user?.effectiveTheme || { primaryColor: '#034EA1', secondaryColor: '#0ea5e9' });
            } catch { }
        };
        window.addEventListener('user-updated', handleUserUpdate);
        return () => window.removeEventListener('user-updated', handleUserUpdate);
    }, []);

    useEffect(() => {
        const user = localStorage.getItem('user');
        if (!user) {
            api.get('/auth/theme').then(res => {
                if (res.data && res.data.theme) {
                    setUserTheme(res.data.theme);
                }
            }).catch(err => console.error('Failed to fetch global theme:', err));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        if (userTheme.primaryColor) {
            document.documentElement.style.setProperty('--accent-primary', userTheme.primaryColor);
        }
        if (userTheme.secondaryColor) {
            document.documentElement.style.setProperty('--accent-secondary', userTheme.secondaryColor);
        }
    }, [userTheme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const isDark = theme === 'dark';

    const antdConfig = {
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
            fontFamily: `'Outfit', sans-serif`,
            fontSize: 14,
            colorPrimary: userTheme.primaryColor || '#034EA1',
            colorSuccess: '#10b981',
            colorWarning: '#f59e0b',
            colorError: '#ef4444',
            colorInfo: userTheme.secondaryColor || '#0ea5e9',
            colorText: isDark ? '#f8fafc' : '#071733',
            colorTextSecondary: isDark ? '#c7d2e4' : '#536484',
            colorBorder: isDark ? '#22324b' : '#e5ebf3',
            colorBgLayout: isDark ? '#0b1220' : '#f5f8fc',
            borderRadius: 12,
        },
        components: {
            Typography: {
                fontWeightStrong: 800,
            },
            Card: {
                colorBgContainer: isDark ? '#111c31' : '#ffffff',
                colorBorderSecondary: isDark ? '#22324b' : '#e5ebf3',
            },
            Menu: {
                colorItemBg: 'transparent',
                colorItemBgSelected: 'transparent',
                colorItemTextSelected: userTheme.primaryColor || '#034EA1',
            },
            Layout: {
                colorBgHeader: isDark ? '#0d1526' : '#ffffff',
                colorBgBody: isDark ? '#0b1220' : '#f5f8fc',
            }
        }
    };
    const updatePreviewTheme = (primaryColor, secondaryColor) => {
        setUserTheme(prev => ({
            ...prev,
            ...(primaryColor && { primaryColor }),
            ...(secondaryColor && { secondaryColor })
        }));
    };

    return (
        <ThemeContext.Provider value={{ theme, isDark, toggleTheme, updatePreviewTheme }}>
            <ConfigProvider theme={antdConfig}>
                {children}
            </ConfigProvider>
        </ThemeContext.Provider>
    );
};
