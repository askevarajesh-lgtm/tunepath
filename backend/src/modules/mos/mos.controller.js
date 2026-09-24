const { MosConfig, MosScoreHistory } = require('./mos.model');
const mosService = require('./mos.service');

// Get MOS Dashboard Data
exports.getMosDashboard = async (req, res, next) => {
  try {
    const isAgency = ['agency_super_admin', 'agency_manager'].includes(req.user.role);
    const User = require('../auth/user.model');
    
    const { clientId } = req.query;

    const isSuperAdmin = ['commander_admin', 'supreme_super_admin'].includes(req.user.role);
    
    let validBrandIds = [];
    if (isSuperAdmin) {
      // Super admin sees all agencies and direct brands
      const allClients = await User.find({
        $or: [
          { role: 'agency_super_admin' },
          { role: 'brand_super_admin', isDirect: true }
        ]
      }).select('_id');
      validBrandIds = allClients.map(c => c._id.toString());
    } else {
      const query = { role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] } };
      if (isAgency) {
        query.agencyId = req.user.agencyId || req.user._id;
      } else {
        query.isDirect = true;
      }
      const validBrands = await User.find(query).select('_id');
      validBrandIds = validBrands.map(b => b._id.toString());

      if (isAgency) {
        validBrandIds.push(req.user._id.toString());
      }
    }

    if (clientId && clientId !== 'all') {
      const isSuperAdmin = ['commander_admin', 'supreme_super_admin'].includes(req.user.role);
      if (isSuperAdmin || validBrandIds.includes(clientId.toString())) {
        validBrandIds = [clientId];
      } else {
        return res.status(403).json({ success: false, message: 'Unauthorized client access' });
      }
    }

    // Get current month results
    const monthYear = new Date().toISOString().substring(0, 7);
    
    // Attempt to fetch from DB first (if cron has run)
    const historyQuery = { monthYear, clientId: { $in: validBrandIds } };

    let currentScores = await MosScoreHistory.find(historyQuery).populate('clientId', 'companyName name');
    
    // If no scores for this month yet, or if we have missing clients, calculate them on the fly
    const uniqueHistoryIds = new Set(currentScores.map(c => c.clientId && c.clientId._id ? c.clientId._id.toString() : ''));
    const missingClients = validBrandIds.some(id => !uniqueHistoryIds.has(id.toString()));

    if (currentScores.length === 0 || missingClients) {
      const targetClientId = (clientId && clientId !== 'all') ? clientId : null;
      const calculated = await mosService.calculateAgencyMOS(req.user, targetClientId);
      
      // We still want to map them similarly to what was loaded from history
      currentScores = calculated.map(c => ({
        clientId: { _id: c.clientId, companyName: c.client, name: c.client },
        overallMos: c.overallMos,
        signals: c.signals,
        weakestSignals: c.weakestSignals,
        actionPlan: c.actionPlan
      }));
    }

    // Get trend data (last 12 months averages)
    const trendData = [];
    const date = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      const mY = d.toISOString().substring(0, 7);
      
      const trendQuery = { monthYear: mY, clientId: { $in: validBrandIds } };

      const monthScores = await MosScoreHistory.find(trendQuery);
      let avg = 0;
      if (monthScores.length > 0) {
        avg = monthScores.reduce((sum, s) => sum + s.overallMos, 0) / monthScores.length;
      } else {
        // No data available for this month
        avg = 0;
      }
      
      trendData.push({
        month: d.toLocaleString('default', { month: 'short' }),
        val: Math.round(avg)
      });
    }

    // Get config
    const agencyId = isAgency ? (req.user.agencyId || req.user._id) : req.user._id;
    let config = await MosConfig.findOne({ agencyId });
    if (!config) {
      config = {
        weights: { website: 15, seo: 25, geo: 10, social: 10, ads: 15, leads: 15, revenue: 10, cx: 0 }
      };
    }

    // Deduplicate by clientId to handle any existing ghost records
    const uniqueScores = new Map();
    currentScores.forEach(score => {
      if (score.clientId) {
        const idStr = score.clientId._id ? score.clientId._id.toString() : score.clientId.toString();
        uniqueScores.set(idStr, score);
      }
    });

    // Format for frontend
    const clientsData = Array.from(uniqueScores.values())
      .map(score => {
        return {
          client: score.clientId?.companyName || score.clientId?.name || 'Unknown Client',
          clientId: score.clientId?._id || score.clientId,
          overall: score.overallMos,
          website: score.signals.website,
          seo: score.signals.seo,
          aeo: score.signals.aeo || 0,
          geo: score.signals.geo || 0,
          social: score.signals.social,
          ads: score.signals.ads,
          leads: score.signals.leads,
          rev: score.signals.revenue,
          cx: score.signals.cx,
          mom: '+2', // Mocking MoM for now, can be calculated dynamically
          weakestSignals: score.weakestSignals ? score.weakestSignals.map(s => s.signalName || s) : [],
          actionPlan: score.actionPlan || null
        };
      });

    res.status(200).json({
      success: true,
      data: {
        clients: clientsData,
        trend: trendData,
        config: config.weights
      }
    });

  } catch (error) {
    next(error);
  }
};

// Update MOS Weights
exports.updateMosConfig = async (req, res, next) => {
  try {
    const agencyId = req.user.agencyId || req.user._id;
    const { weights } = req.body;

    // Validate weights sum to 100
    const total = Object.values(weights).reduce((a, b) => a + Number(b), 0);
    if (total !== 100) {
      return res.status(400).json({ success: false, message: 'Weights must sum up to exactly 100%' });
    }

    let config = await MosConfig.findOne({ agencyId });
    if (config) {
      config.weights = weights;
      config.updatedBy = req.user._id;
      await config.save();
    } else {
      config = await MosConfig.create({
        agencyId,
        weights,
        createdBy: req.user._id
      });
    }

    // Trigger recalculation immediately since weights changed
    await mosService.calculateAgencyMOS(req.user);

    res.status(200).json({ success: true, data: config.weights });
  } catch (error) {
    next(error);
  }
};

// Manually trigger recalculation
exports.triggerRecalculation = async (req, res, next) => {
  try {
    const { clientId } = req.body;
    const targetClientId = (clientId && clientId !== 'all') ? clientId : null;
    const results = await mosService.calculateAgencyMOS(req.user, targetClientId);
    
    // Auto-trigger benchmark aggregation to keep data synced
    const benchmarkService = require('../benchmarking/benchmark.service');
    await benchmarkService.calculateAndAggregateBenchmarks();

    res.status(200).json({ success: true, message: 'Recalculation complete', count: results.length });
  } catch (error) {
    next(error);
  }
};

// Generate AI Action Plan
exports.generateActionPlan = async (req, res, next) => {
  try {
    const { clientId, weakestSignals } = req.body;
    
    const AiSettings = require('../aiStudio/models/aiSettings.model');
    const cryptoUtils = require('../../utils/crypto');
    const AiClientWrapper = require('../../utils/aiClientWrapper');
    const User = require('../auth/user.model');
    
    const isAgency = ['agency_super_admin', 'agency_manager'].includes(req.user.role);
    const workspaceId = isAgency ? (req.user.agencyId || req.user._id) : req.user._id;
    
    let settings = await AiSettings.findOne({ workspaceId, module: 'marketplace' });
    if (!settings || !settings.openaiApiKey) {
      settings = await AiSettings.findOne({ workspaceId, module: 'chatgpt' }) ||
                 await AiSettings.findOne({ workspaceId, module: 'ai_studio' }) ||
                 await AiSettings.findOne({ workspaceId, module: { $exists: false } }) ||
                 await AiSettings.findOne({ workspaceId });
    }
    let openai = null;
    if (settings) {
      if (settings.openaiApiKey) {
        openai = new AiClientWrapper(cryptoUtils.decrypt(settings.openaiApiKey), 'openai');
      }
    }
    
    if (!openai) {
      return res.status(400).json({ success: false, message: 'AI Provider API Key is missing. Please configure it in AI Studio settings.' });
    }
    
    const client = await User.findById(clientId);
    const clientName = client ? (client.companyName || client.name) : 'The Client';
    
    const prompt = `You are a top-tier digital marketing strategist. 
A client named "${clientName}" has poor performance in their Marketing Operating Score (MOS).
Here are their weakest signals out of 100:
${weakestSignals.map(s => `- ${s.signalName}: ${s.score}`).join('\n')}

Create a professional, actionable 30-day turnaround strategy.
Format your response in Markdown. Use headers, bullet points, and bold text for emphasis.
Include:
1. Executive Summary
2. Immediate Fixes (Week 1)
3. Structural Improvements (Week 2-4)
4. Expected Outcomes`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.7,
    });
    
    const actionPlanContent = response.choices[0].message.content;
    const generatedAt = new Date();
    
    const actionPlanObj = {
      prompt,
      content: actionPlanContent,
      generatedAt
    };

    const monthYear = new Date().toISOString().substring(0, 7);
    await MosScoreHistory.findOneAndUpdate(
      { clientId, monthYear },
      { $set: { actionPlan: actionPlanObj } },
      { returnDocument: 'after' }
    );
    
    res.status(200).json({ success: true, data: actionPlanObj });
  } catch (error) {
    next(error);
  }
};
