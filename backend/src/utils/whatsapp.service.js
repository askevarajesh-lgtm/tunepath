class WhatsAppService {
  async fetchTemplates(backendUrl, apiToken) {
    if (!backendUrl || typeof backendUrl !== 'string' || !backendUrl.trim()) {
      throw new Error("Backend URL is required.");
    }

    const trimmedUrl = backendUrl.trim();
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      throw new Error(`Invalid Backend URL "${trimmedUrl}". URL must start with http:// or https://`);
    }

    if (!apiToken || typeof apiToken !== 'string' || !apiToken.trim()) {
      throw new Error("API Token is required.");
    }

    const axios = require('axios');
    const templatesUrl = trimmedUrl.replace('message/send-message', 'templates').replace('{{token}}', apiToken.trim());
    
    try {
      const response = await axios.get(templatesUrl, {
        headers: {
          'Authorization': `Bearer ${apiToken.trim()}`
        },
        timeout: 10000
      });
      
      const templatesData = response.data?.data || response.data?.templates || response.data;
      if (!templatesData || (!Array.isArray(templatesData) && typeof templatesData !== 'object')) {
        throw new Error("Invalid response format received from WhatsApp API backend.");
      }
      return Array.isArray(templatesData) ? templatesData : [];
    } catch (error) {
      console.error('[WhatsAppService] Failed to fetch real templates:', error.response?.data || error.message);
      if (error.response) {
        const status = error.response.status;
        const errDetail = error.response.data?.error?.message || error.response.data?.message || error.response.data?.error || error.message;
        if (status === 401 || status === 403) {
          throw new Error(`Authentication failed (HTTP ${status}): Invalid API Token or unauthorized access.`);
        }
        if (status === 404) {
          throw new Error(`Endpoint not found (HTTP 404): Backend URL "${trimmedUrl}" is invalid or template API endpoint not available.`);
        }
        throw new Error(`WhatsApp API Error (HTTP ${status}): ${errDetail}`);
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ERR_INVALID_URL' || error.message?.includes('Invalid URL')) {
        throw new Error(`Connection failed: Unable to connect to Backend URL "${trimmedUrl}". Please check the URL.`);
      }
      throw new Error(error.message || "Failed to fetch templates from WhatsApp API backend.");
    }
  }

  async sendMessage(backendUrl, apiToken, to, templateId, variables = {}, options = {}) {
    const axios = require('axios');
    const templateName = options.templateName || templateId;
    const languageCode = options.language || 'en';
    
    const parameters = Object.values(variables).map(val => ({ type: 'text', text: String(val) }));
    const components = parameters.length > 0 ? [{ type: 'body', parameters }] : [];

    const payload = {
      messaging_product: 'whatsapp',
      type: 'template',
      to: to.replace(/\D/g, ''),
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components
      }
    };

    const finalUrl = backendUrl.replace('{{token}}', apiToken);

    try {
      const response = await axios.post(finalUrl, payload, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      return { success: true, messageId: response.data?.messages?.[0]?.id };
    } catch (error) {
      console.error('[WhatsAppService] Error sending template message:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || error.response?.data?.error || 'Failed to send template message');
    }
  }

  async sendCustomMessage(backendUrl, apiToken, to, message, variables = {}) {
    const axios = require('axios');
    
    // Replace variables in message text like {{1}}, {{2}} if any
    let finalMessage = message;
    Object.keys(variables).forEach(key => {
      finalMessage = finalMessage.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), variables[key]);
    });

    const payload = {
      messaging_product: 'whatsapp',
      type: 'text',
      to: to.replace(/\D/g, ''),
      text: {
        body: finalMessage
      }
    };

    const finalUrl = backendUrl.replace('{{token}}', apiToken);

    try {
      const response = await axios.post(finalUrl, payload, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      return { success: true, messageId: response.data?.messages?.[0]?.id };
    } catch (error) {
      console.error('[WhatsAppService] Error sending custom message:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || error.response?.data?.error || 'Failed to send custom message');
    }
  }
}

module.exports = new WhatsAppService();
