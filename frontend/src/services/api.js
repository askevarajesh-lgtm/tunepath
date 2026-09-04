import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:5500/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  const selectedClient = localStorage.getItem('selectedClient');
  if (selectedClient) {
    try {
      const parsed = JSON.parse(selectedClient);
      if (parsed?._id) {
        config.headers['x-selected-client-id'] = parsed._id;
      }
    } catch (e) {
      console.error('Failed to parse selectedClient from localStorage', e);
    }
  }

  // If the request data is FormData, remove the Content-Type header so
  // axios can automatically set multipart/form-data with the correct boundary.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle 401/403 session expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      const errorMsg = String(error.response.data?.error || error.response.data?.message || "").toLowerCase();
      if (error.response.status === 401 || errorMsg.includes("expired") || errorMsg.includes("suspended")) {
        console.warn("[API] 401 Unauthorized received. Clearing expired token.");
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('selectedClient');
        if (window.location.pathname !== '/signin') {
          window.location.href = '/signin';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Patch global fetch to include x-selected-client-id header for all /api requests
// This ensures that legacy or third-party code using native fetch still respects the client context.
const originalFetch = window.fetch;
window.fetch = async function () {
  let [resource, config] = arguments;
  
  if (typeof resource === 'string' && resource.startsWith('/api')) {
    config = config || {};
    
    // Convert Headers object to plain object if needed, or initialize it
    let headers = config.headers || {};
    if (headers instanceof Headers) {
      const plainHeaders = {};
      headers.forEach((value, key) => {
        plainHeaders[key] = value;
      });
      headers = plainHeaders;
    }
    
    // Add token if not present
    const token = localStorage.getItem('token');
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add selected client ID
    const selectedClient = localStorage.getItem('selectedClient');
    if (selectedClient) {
      try {
        const parsed = JSON.parse(selectedClient);
        if (parsed?._id) {
          headers['x-selected-client-id'] = parsed._id;
        }
      } catch (e) {}
    }
    
    config.headers = headers;
    return originalFetch.apply(this, [resource, config]);
  }
  
  return originalFetch.apply(this, arguments);
};
