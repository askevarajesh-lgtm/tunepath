const AiSettings = require('../aiStudio/models/aiSettings.model');
const cryptoUtils = require('../../utils/crypto');

const getWorkspaceId = (req) => {
  const user = req.user;
  if (!user) return req.companyId || req.workspaceId;
  const clientRoles = ['agency_client', 'brand_super_admin', 'brand_manager', 'brand_team_user', 'client'];
  if (clientRoles.includes(user.role)) {
    return user.brandId || user._id;
  }
  return user.agencyId || user._id;
};

exports.getSettingsStatus = async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    if (!workspaceId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let settings = await AiSettings.findOne({ workspaceId, module: 'marketplace' });
    if (!settings) {
      settings = await AiSettings.findOne({ workspaceId, module: { $exists: false } });
    }
    let isAnthropicConfigured = false;
    let maskedAnthropicKey = '';

    if (settings && settings.contentAnthropicApiKey) {
      isAnthropicConfigured = true;
      const decrypted = cryptoUtils.decrypt(settings.contentAnthropicApiKey);
      if (decrypted && decrypted.length > 8) {
        maskedAnthropicKey = decrypted.substring(0, 7) + '...' + decrypted.substring(decrypted.length - 4);
      } else {
        maskedAnthropicKey = 'sk-ant-...';
      }
    } else if (settings && settings.anthropicApiKey) {
      isAnthropicConfigured = true;
      const decrypted = cryptoUtils.decrypt(settings.anthropicApiKey);
      if (decrypted && decrypted.length > 8) {
        maskedAnthropicKey = decrypted.substring(0, 7) + '...' + decrypted.substring(decrypted.length - 4);
      } else {
        maskedAnthropicKey = 'sk-ant-...';
      }
    }

    return res.status(200).json({
      success: true,
      data: { isAnthropicConfigured, maskedAnthropicKey }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveSettings = async (req, res) => {
  try {
    const { anthropicApiKey } = req.body;
    const workspaceId = getWorkspaceId(req);

    if (!workspaceId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const updateFields = {
      module: 'marketplace'
    };
    if (anthropicApiKey !== undefined) {
      if (anthropicApiKey.trim() !== '') {
        updateFields.contentAnthropicApiKey = cryptoUtils.encrypt(anthropicApiKey.trim());
      } else {
        updateFields.contentAnthropicApiKey = null;
      }
    }

    await AiSettings.findOneAndUpdate(
      { workspaceId, module: 'marketplace' },
      { $set: updateFields },
      { upsert: true, returnDocument: 'after' }
    );

    return res.status(200).json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
