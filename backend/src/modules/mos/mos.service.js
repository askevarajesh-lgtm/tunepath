const User = require('../auth/user.model');
const { MosConfig, MosScoreHistory } = require('./mos.model');
const mongoose = require('mongoose');

/**
 * Normalizes a raw score to a 0-100 scale based on some bounds.
 */
function normalizeScore(raw, min, max) {
  if (raw <= min) return 0;
  if (raw >= max) return 100;
  return Math.round(((raw - min) / (max - min)) * 100);
}

/**
 * Calculates scores for all active clients under an agency.
 */
exports.calculateAgencyMOS = async (user, targetClientId = null) => {
  const isAgency = ['agency_super_admin', 'agency_manager'].includes(user.role);
  let brands = [];
  const isSuperAdmin = ['commander_admin', 'supreme_super_admin'].includes(user.role);

  if (isSuperAdmin) {
    brands = await User.find({
      $or: [
        { role: 'agency_super_admin' },
        { role: 'brand_super_admin', isDirect: true }
      ]
    });
  } else {
    const query = { role: { $in: ['brand_super_admin', 'brand_manager', 'agency_client'] } };

    if (isAgency) {
      query.agencyId = user.agencyId || user._id;
    } else {
      query.isDirect = true;
    }

    brands = await User.find(query);

    // Also include the agency itself so their own internal projects/integrations (like Askeva/Tunepath) are scored
    if (isAgency) {
      brands.push(user);
    }
  }

  if (targetClientId) {
    const isSuperAdmin = ['commander_admin', 'supreme_super_admin'].includes(user.role);
    if (isSuperAdmin) {
      // Super admins can calculate for ANY client/agency
      const targetUser = await User.findById(targetClientId);
      if (targetUser) {
        brands = [targetUser];
      } else {
        brands = [];
      }
    } else {
      brands = brands.filter(b => b._id.toString() === targetClientId.toString());
    }
  }

  // Get current weights or use defaults
  const agencyIdForConfig = isAgency ? (user.agencyId || user._id) : user._id;
  let config = await MosConfig.findOne({ agencyId: agencyIdForConfig });
  if (!config) {
    config = {
      weights: {
        website: 15, seo: 25, geo: 10, social: 10, ads: 15, leads: 15, revenue: 10, cx: 0
      }
    };
  }
  const { weights } = config;

  const results = [];
  const monthYear = new Date().toISOString().substring(0, 7); // YYYY-MM

  for (const brand of brands) {
    const brandId = brand._id;
    // In a full implementation, you'd query each module's models here based on brandId (or workspaceId)
    // For now, we simulate pulling from available collections with some jitter or fallback values 
    // to ensure the system is robust even if some collections don't have data yet.

    // 1. Website Score
    let websiteScore = 0;
    try {
      const Website = mongoose.model('Website');
      const websites = await Website.find({ workspaceId: brandId, isDeleted: { $ne: true } });
      if (websites.length > 0) {
        websiteScore = 75;
        const hasPixels = websites.some(w => w.trackingPixels && (w.trackingPixels.ga4Id || w.trackingPixels.metaPixelId));
        if (hasPixels) websiteScore += 15;
        const hasWidget = websites.some(w => w.chatWidgetId);
        if (hasWidget) websiteScore += 10;
        websiteScore = Math.min(100, websiteScore);
      } else {
        websiteScore = 0;
      }
    } catch (e) {
      websiteScore = 0;
    }

    // 2. SEO Score, 3. GEO Score, 4. AEO Score
    let seoScore = 0;
    let geoScore = 0;
    let aeoScore = 0;

    try {
      const SemrushProject = mongoose.model('SemrushProject');
      const OptimizationScore = mongoose.model('OptimizationScore');

      const projects = await SemrushProject.find({ clientId: brandId, isActive: true });
      const projectIds = projects.map(p => p._id);

      if (projectIds.length > 0) {
        const scores = await OptimizationScore.find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 });

        let totalSeo = 0, totalGeo = 0, totalAeo = 0;
        let countSeo = 0, countGeo = 0, countAeo = 0;

        // We only take the latest score per project
        const latestScoresMap = new Map();
        for (const s of scores) {
          if (!latestScoresMap.has(s.projectId.toString())) {
            latestScoresMap.set(s.projectId.toString(), s);
          }
        }

        latestScoresMap.forEach(scoreDoc => {
          if (scoreDoc.seoScore !== undefined) {
            totalSeo += scoreDoc.seoScore;
            countSeo++;
          }
          if (scoreDoc.geoScore !== undefined) {
            totalGeo += scoreDoc.geoScore;
            countGeo++;
          }
          if (scoreDoc.aeoScore !== undefined) {
            totalAeo += scoreDoc.aeoScore;
            countAeo++;
          }
        });

        if (countSeo > 0) seoScore = Math.round(totalSeo / countSeo);
        if (countGeo > 0) geoScore = Math.round(totalGeo / countGeo);
        if (countAeo > 0) aeoScore = Math.round(totalAeo / countAeo);
      }
    } catch (e) {
      seoScore = 0;
      geoScore = 0;
      aeoScore = 0;
    }

    // 5. Performance Ads Score
    let adsScore = 0;
    try {
      const PerformanceAd = mongoose.model('PerformanceAd');
      const perfAd = await PerformanceAd.findOne({ agency: brandId });

      if (perfAd) {
        const hasCampaigns = perfAd.activeCampaigns && perfAd.activeCampaigns.length > 0;
        const metrics = perfAd.metrics || {};
        const spend = parseFloat(metrics.adSpendMTD || 0);
        const leads = parseInt(metrics.totalLeads || 0, 10);

        if (hasCampaigns || spend > 0) {
          adsScore = 60; // Base active score
          if (leads > 0) adsScore += Math.min(25, leads * 2);
          if (metrics.roas && parseFloat(metrics.roas) > 0) adsScore += Math.min(15, parseFloat(metrics.roas) * 5);
          adsScore = Math.min(100, Math.round(adsScore));
        }
      }
    } catch (e) {
      adsScore = 0;
    }

    // 6. Leads Score (using Deal model)
    let leadsScore = 0;
    try {
      const Deal = mongoose.model('Deal');
      const deals = await Deal.find({ clientId: brandId });
      if (deals.length > 0) {
        leadsScore = 70;
        const wonDeals = deals.filter(d => d.stage === 'Won' || d.stage?.toLowerCase() === 'won' || d.status === 'Won' || d.status?.toLowerCase() === 'won');
        if (wonDeals.length > 0) {
          leadsScore += Math.min(30, Math.round((wonDeals.length / deals.length) * 30));
        } else {
          leadsScore += Math.min(20, deals.length * 5);
        }
      }
    } catch (e) {
      leadsScore = 0;
    }

    // 7. Revenue Score (using Invoice model)
    let revenueScore = 0;
    try {
      const Invoice = mongoose.model('Invoice');
      const invoices = await Invoice.find({ clientId: brandId, isDeleted: { $ne: true } });
      if (invoices.length > 0) {
        const paid = invoices.filter(i => i.paymentStatus === 'Paid' || i.invoiceStatus === 'Paid');
        revenueScore = Math.round((paid.length / invoices.length) * 100);
        revenueScore = Math.max(50, revenueScore);
      }
    } catch (e) {
      revenueScore = 0;
    }

    // 8. Social & CX
    const socialScore = 0;
    const cxScore = 0;

    const rawScores = {
      website: websiteScore,
      seo: seoScore,
      aeo: aeoScore,
      geo: geoScore,
      social: socialScore,
      ads: adsScore,
      leads: leadsScore,
      revenue: revenueScore,
      cx: cxScore
    };

    // Calculate final weighted score
    let overallMos = 0;
    Object.keys(weights).forEach(key => {
      // weight is a percentage (e.g. 15 for 15%)
      overallMos += (rawScores[key] * (weights[key] / 100));
    });

    overallMos = Math.round(overallMos);

    // Identify weakest signals
    const sortedSignals = Object.entries(rawScores)
      .sort(([, a], [, b]) => a - b)
      .slice(0, 3); // top 3 weakest

    const weakestSignals = sortedSignals.map(([signal, score]) => {
      return {
        signalName: signal.charAt(0).toUpperCase() + signal.slice(1),
        score,
        priority: score < 50 ? 'High' : 'Medium',
        actions: [`Review ${signal} strategy`, `Audit ${signal} performance`],
        points: ['+5 pts', '+3 pts']
      };
    });

    // Save to history for the month
    // We use findOneAndUpdate to keep only the latest snapshot per month per client
    const updatedHistory = await MosScoreHistory.findOneAndUpdate(
      { clientId: brandId, monthYear },
      {
        clientId: brandId,
        agencyId: brand.agencyId || agencyIdForConfig,
        signals: rawScores,
        weakestSignals,
        overallMos,
        monthYear
      },
      { upsert: true, returnDocument: 'after' }
    );

    results.push({
      client: brand.companyName || brand.name,
      clientId: brand._id,
      overallMos,
      signals: rawScores,
      weakestSignals
    });
  }

  return results;
};
