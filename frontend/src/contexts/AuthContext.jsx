import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  // Role can be 'commander_admin', 'agency', 'client', or null
  const [role, setRole] = useState(() => {
    return localStorage.getItem('userRole') || null;
  });

  const [user, setUser] = useState(() => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  });

  const [features, setFeatures] = useState(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.features || [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Package-level integration entitlements (Layer 2 -- see
  // backend/src/utils/integrationAccess.js). Mirrors `features` above:
  // sourced from `user.integrations`, which the backend already resolves
  // (own snapshot, or the agency/brand's effective package) in
  // auth.controller.js signin/me/impersonate.
  const [integrations, setIntegrations] = useState(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.integrations || [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    if (role) {
      localStorage.setItem('userRole', role);
    } else {
      localStorage.removeItem('userRole');
    }
  }, [role]);

  const login = (user, skipNavigate = false) => {
    setUser(user);
    setRole(user.role);
    setFeatures(user.features || []);
    setIntegrations(user.integrations || []);
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new Event('user-updated'));
    
    if (!skipNavigate) {
      if (user.role === 'supreme_super_admin') {
        navigate('/superadmin/dashboard');
      } else if (user.role === 'commander_admin') {
        navigate('/dashboard');
      } else if (['agency_super_admin', 'agency_manager'].includes(user.role)) {
        navigate('/agency/overview');
      } else if (['agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'client'].includes(user.role) || (user.role === 'user' && user.brandId)) {
        navigate('/client/dashboard');
      } else {
        // Fallback for custom roles (like developer, seo, etc)
        if (user.role === 'superadmin') navigate('/superadmin/dashboard');
        else if (user.role === 'agency') navigate('/agency/overview');
        else if (user.role === 'client') navigate('/client/dashboard');
        else navigate('/user/dashboard');
      }
    }
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    setFeatures([]);
    setIntegrations([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('original_token');
    localStorage.removeItem('original_user');
    window.dispatchEvent(new Event('user-updated'));
    navigate('/signin');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, role, features, setFeatures, integrations, setIntegrations, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);