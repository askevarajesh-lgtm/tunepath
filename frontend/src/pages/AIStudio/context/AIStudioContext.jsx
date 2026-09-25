import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../../../services/api';
import { message } from 'antd';

const AIStudioContext = createContext();

export const useAIStudio = () => useContext(AIStudioContext);

export const AIStudioProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState('design');
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  
  // apiKey will store the masked key (e.g. sk-...8TVX) from the server
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState(false);
  
  const [isApiKeyModalVisible, setIsApiKeyModalVisible] = useState(false);

  const checkApiKeyStatus = async () => {
    try {
      const response = await api.get('/ai-studio/settings?module=ai_studio');
      if (response.data.success) {
        const data = response.data.data;
        const configured = data.isConfigured || data.isOpenAiConfigured;
        setIsApiKeyConfigured(configured);
        if (configured) {
          setApiKey(data.maskedOpenAiKey || data.maskedKey);
        } else {
          setApiKey('');
        }
      }
    } catch (error) {
      console.error('Failed to fetch API key status', error);
    }
  };

  const saveApiKey = async (payload) => {
    try {
      const response = await api.post('/ai-studio/settings', {
        ...payload,
        module: 'ai_studio',
        aiProvider: 'openai'
      });
      if (response.data.success) {
        message.success('API Settings saved securely');
        await checkApiKeyStatus();
      }
    } catch (error) {
      console.error('Failed to save API key', error);
      message.error('Failed to save API Settings');
    }
  };

  const fetchAssets = async () => {
    try {
      setLoadingAssets(true);
      const response = await api.get('/ai-studio/assets');
      if (response.data.success) {
        setAssets(response.data.data.assets);
      }
    } catch (error) {
      console.error('Failed to fetch AI assets', error);
      message.error('Failed to load Asset Library');
    } finally {
      setLoadingAssets(false);
    }
  };

  useEffect(() => {
    checkApiKeyStatus();
    fetchAssets();
  }, []);

  const saveAsset = async (type, prompt, url) => {
    try {
      const response = await api.post('/ai-studio/assets', { type, prompt, url });
      if (response.data.success) {
        message.success('Asset saved to library');
        fetchAssets(); // Refresh assets
        return true;
      }
    } catch (error) {
      console.error('Failed to save asset', error);
      message.error('Failed to save asset');
      return false;
    }
  };

  const deleteAsset = async (id) => {
    try {
      const response = await api.delete(`/ai-studio/assets/${id}`);
      if (response.data.success) {
        message.success('Asset deleted');
        fetchAssets(); // Refresh assets
        return true;
      }
    } catch (error) {
      console.error('Failed to delete asset', error);
      message.error('Failed to delete asset');
      return false;
    }
  };

  return (
    <AIStudioContext.Provider
      value={{
        activeTab,
        setActiveTab,
        assets,
        loadingAssets,
        fetchAssets,
        saveAsset,
        deleteAsset,
        apiKey,
        isApiKeyConfigured,
        saveApiKey,
        isApiKeyModalVisible,
        setIsApiKeyModalVisible
      }}
    >
      {children}
    </AIStudioContext.Provider>
  );
};
