const mongoose = require('mongoose');
const Settings = require('./settings.model');
const Department = require('../departments/department.model');

function getCompanyId(req) {
  return req.companyId || req.user?.agencyId || req.user?._id;
}

exports.getDMTeamSettings = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Company context missing' });
    }

    let settings = await Settings.findOne({ tenantCompanyId: companyId }).lean();
    if (!settings) {
      settings = {
        dmTeam: {
          departmentId: null,
          departmentName: 'Digital Marketing',
          designerDailyLimit: 7,
          videoEditorDailyLimit: 3
        }
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        dmTeam: {
          departmentId: settings.dmTeam?.departmentId || null,
          departmentName: settings.dmTeam?.departmentName || 'Digital Marketing',
          designerDailyLimit: settings.dmTeam?.designerDailyLimit ?? 7,
          videoEditorDailyLimit: settings.dmTeam?.videoEditorDailyLimit ?? 3
        }
      }
    });
  } catch (error) {
    console.error('getDMTeamSettings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch settings', error: error.message });
  }
};

exports.updateDMTeamSettings = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    if (!companyId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Company context missing' });
    }

    const { designerDailyLimit, videoEditorDailyLimit, departmentId } = req.body;

    const designerLimit = Number(designerDailyLimit);
    const videoEditorLimit = Number(videoEditorDailyLimit);

    if (isNaN(designerLimit) || designerLimit < 1 || isNaN(videoEditorLimit) || videoEditorLimit < 1) {
      return res.status(400).json({ success: false, message: 'Limits must be numbers greater than 0' });
    }

    let deptName = 'Digital Marketing';
    if (departmentId) {
      const dept = await Department.findById(departmentId).lean();
      if (dept) deptName = dept.name;
    }

    const updatedSettings = await Settings.findOneAndUpdate(
      { tenantCompanyId: companyId },
      {
        $set: {
          'dmTeam.departmentId': departmentId || null,
          'dmTeam.departmentName': deptName,
          'dmTeam.designerDailyLimit': designerLimit,
          'dmTeam.videoEditorDailyLimit': videoEditorLimit
        }
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: 'Digital Marketing Team settings saved successfully!',
      data: {
        dmTeam: {
          departmentId: updatedSettings.dmTeam.departmentId,
          departmentName: updatedSettings.dmTeam.departmentName,
          designerDailyLimit: updatedSettings.dmTeam.designerDailyLimit,
          videoEditorDailyLimit: updatedSettings.dmTeam.videoEditorDailyLimit
        }
      }
    });
  } catch (error) {
    console.error('updateDMTeamSettings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save settings', error: error.message });
  }
};

exports.getPriorityLevels = async (req, res) => {
  try {
    const priorities = [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' }
    ];
    return res.status(200).json({ success: true, data: priorities });
  } catch (error) {
    console.error('getPriorityLevels error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch priority levels', error: error.message });
  }
};
