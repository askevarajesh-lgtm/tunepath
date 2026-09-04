const mongoose = require('mongoose');
const { buildAnalyticsDashboard } = require('./services/metrics.service');
const { toAnalyticsResponseDto } = require('./dto/analyticsResponse.dto');
const analyticsCache = require('./services/analyticsCache.service');
const { resolveDateRange } = require('./utils/dateRange');
const AnalyticsProject = require('./models/analyticsProject.model');

exports.getAnalytics = async (req, res, next) => {
  try {
    const agencyId = req.companyId || (req.user && (req.user.agencyId || req.user.workspaceId || req.user.agency));

    if (!agencyId || !mongoose.Types.ObjectId.isValid(agencyId)) {
      return res.status(400).json({ success: false, message: 'Agency ID missing or invalid on user token' });
    }

    const { projectId, dateRange, bypassCache } = req.query;
    const range = resolveDateRange(dateRange);

    if (bypassCache === 'true') {
      await analyticsCache.invalidate({ agencyId, projectId, start: range.ga4Start, end: range.ga4End });
      // Also invalidate 'undefined' or 'all' project cache when refreshing a specific project
      if (projectId) {
         await analyticsCache.invalidate({ agencyId, projectId: undefined, start: range.ga4Start, end: range.ga4End });
      }
    }

    let targetProjectId = projectId;
    
    // Ignore "All Domains" and invalid inputs
    if (!targetProjectId || targetProjectId === 'All Domains' || targetProjectId === 'All Clients' || targetProjectId === 'undefined') {
      targetProjectId = null;
    }

    if (!targetProjectId) {
      // Find the first project available to this user
      let projectQuery = { isDeleted: false };
      if (req.isClientRole) {
        projectQuery.clientId = req.clientUserId;
      } else {
        projectQuery.companyId = agencyId;
      }
      
      const firstProject = await AnalyticsProject.findOne(projectQuery).lean();
      if (firstProject) {
        targetProjectId = firstProject._id.toString();
      } else {
        targetProjectId = 'none'; // No project available
      }
    } else {
      // Ensure that if a client requests a specific project, it belongs to them
      if (req.isClientRole && targetProjectId !== 'none') {
        const clientProject = await AnalyticsProject.findOne({ _id: targetProjectId, clientId: req.clientUserId, isDeleted: false }).lean();
        if (!clientProject) {
          targetProjectId = 'none'; // Not authorized to view this project
        }
      }
    }

    const dashboard = await analyticsCache.getOrCompute(
      { agencyId, projectId: targetProjectId, start: range.ga4Start, end: range.ga4End },
      () => buildAnalyticsDashboard({ 
        agencyId, 
        projectId: targetProjectId, 
        rawDateRange: dateRange,
        clientUserId: req.isClientRole ? req.clientUserId : null 
      })
    );

    res.status(200).json({
      success: true,
      data: toAnalyticsResponseDto(dashboard),
      message: 'Analytics data fetched successfully'
    });
  } catch (error) {
    next(error);
  }
};

exports.getProjects = async (req, res, next) => {
  try {
    const agencyId = req.companyId || (req.user && (req.user.agencyId || req.user.workspaceId || req.user.agency));
    const clientId = req.isClientRole ? req.clientUserId : null;

    if (!agencyId) {
      return res.status(400).json({ success: false, message: 'Agency ID missing' });
    }

    const filter = { companyId: agencyId, isDeleted: false };
    if (clientId) filter.clientId = clientId;
    else if (req.query.clientId) filter.clientId = req.query.clientId;

    const projects = await AnalyticsProject.find(filter).sort({ createdAt: -1 }).lean();

    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    next(error);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const agencyId = req.companyId || (req.user && (req.user.agencyId || req.user.workspaceId || req.user.agency));
    if (!agencyId) {
      return res.status(400).json({ success: false, message: 'Agency ID missing' });
    }

    const { domain, name, ga4PropertyId } = req.body;
    
    // In many SaaS models, the agency creates projects for clients, or for themselves.
    // Default clientId to agencyId unless provided differently by frontend in future, or if the user is a client themselves.
    const clientId = req.isClientRole ? req.clientUserId : agencyId;

    const existing = await AnalyticsProject.findOne({ domain, companyId: agencyId, isDeleted: false });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Project with this domain already exists' });
    }

    const project = new AnalyticsProject({
      companyId: agencyId,
      clientId,
      createdBy: req.user._id,
      domain,
      name,
      credentials: {
        ga4PropertyId: ga4PropertyId || ''
      }
    });

    await project.save();

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

exports.updateGa4Property = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ga4PropertyId } = req.body;

    const project = await AnalyticsProject.findById(id);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    project.credentials = project.credentials || {};
    project.credentials.ga4PropertyId = ga4PropertyId;
    await project.save();

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    next(error);
  }
};

exports.sendReportEmail = async (req, res, next) => {
  try {
    const { recipientEmail, subject, executiveSummary, pdfBase64, dateRangeText } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ success: false, message: 'Recipient email is required' });
    }

    const sendpulseService = require('../../utils/sendpulse.service');

    const emailSubject = subject || 'Google Analytics & SEO Performance Report';
    const htmlMessage = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333333; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background: #1890ff; color: #ffffff; padding: 24px 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700;">Performance & Analytics Report</h2>
          ${dateRangeText ? `<p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">${dateRangeText}</p>` : ''}
        </div>
        <div style="padding: 24px 20px;">
          <p style="font-size: 15px; line-height: 1.5; color: #4a5568;">Hello,</p>
          <p style="font-size: 15px; line-height: 1.5; color: #4a5568;">Please find your website's performance and search analytics report attached to this email.</p>
          
          ${executiveSummary ? `
            <div style="background: #f7fafc; border-left: 4px solid #1890ff; padding: 14px 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
              <h4 style="margin: 0 0 6px 0; color: #2d3748; font-size: 14px; font-weight: 700;">Executive Summary & Notes:</h4>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #4a5568; white-space: pre-wrap;">${executiveSummary}</p>
            </div>
          ` : ''}

          <p style="font-size: 14px; color: #718096; margin-top: 24px;">If you have any questions regarding the metrics or insights in this report, feel free to reach out to our team.</p>
        </div>
        <div style="background: #f8fafc; padding: 16px 20px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #a0aec0;">
          Sent automatically via Tunepath Analytics
        </div>
      </div>
    `;

    // Send email using SendPulse
    await sendpulseService.sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html: htmlMessage,
      text: executiveSummary || `Google Analytics Report for ${dateRangeText || 'recent period'}`
    });

    res.status(200).json({
      success: true,
      message: `Report email successfully queued for ${recipientEmail}`
    });
  } catch (error) {
    console.error('Error in sendReportEmail:', error);
    next(error);
  }
};