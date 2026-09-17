const mongoose = require('mongoose');

const monthlyHighlightsSchema = new mongoose.Schema({
    agencyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Draft', 'Published'],
        default: 'Draft'
    },
    publishedReportTypes: [
        { type: String }
    ],
    hasSocialMediaModule: {
        type: Boolean,
        default: false
    },
    digitalInsights: {
        facebookFollowersIncreased: { type: Number, default: 0 },
        facebookTotalFollowers: { type: Number, default: 0 },
        facebookReach: { type: Number, default: 0 },
        instagramFollowersIncreased: { type: Number, default: 0 },
        instagramTotalFollowers: { type: Number, default: 0 },
        instagramReach: { type: Number, default: 0 }
    },
    socialMediaPostInsights: {
        videoCount: { type: Number, default: 0 },
        postCount: { type: Number, default: 0 },
        totalCount: { type: Number, default: 0 }
    },
    blogs: {
        count: { type: Number, default: 0 },
        notes: { type: String, default: '' }
    },
    brandCommunicationDesign: {
        socialMediaPostDesignsCount: { type: Number, default: 0 },
        videosCount: { type: Number, default: 0 },
        notes: { type: String, default: '' },
        deliverables: [
            {
                name: { type: String, required: true },
                completed: { type: Number, default: 0 },
                total: { type: Number, default: 0 },
                unit: { type: String, default: 'Completed' }
            }
        ]
    },
    offlineCollaterals: {
        type: String,
        default: ''
    },
    specialInitiatives: {
        type: String,
        default: ''
    },
    keywordRankingOverview: [
        {
            month: { type: String, required: true },
            top10: { type: Number, default: 0 },
            top20: { type: Number, default: 0 },
            top30Above: { type: Number, default: 0 }
        }
    ],
    keywordRankingDetails: [
        {
            keyword: { type: String, required: true },
            volume: { type: Number, default: 0 },
            category: { type: String, default: 'General' },
            monthRanks: [
                {
                    month: { type: String, required: true },
                    rank: { type: mongoose.Schema.Types.Mixed, default: '-' }
                }
            ]
        }
    ],
    metaInsightsFacebook: [
        {
            month: { type: String, required: true },
            views: { type: Number, default: 0 },
            reach: { type: Number, default: 0 },
            followers: { type: Number, default: 0 }
        }
    ],
    metaInsightsInstagram: [
        {
            month: { type: String, required: true },
            views: { type: Number, default: 0 },
            reach: { type: Number, default: 0 },
            followers: { type: Number, default: 0 }
        }
    ],
    youTubeReport: [
        {
            month: { type: String, required: true },
            views: { type: Number, default: 0 },
            lastMonthSubscribers: { type: Number, default: 0 },
            totalSubscribers: { type: Number, default: 0 }
        }
    ],
    websiteTrafficOverview: [
        {
            month: { type: String, required: true },
            users: { type: Number, default: 0 },
            newUsers: { type: Number, default: 0 }
        }
    ],
    websiteTrafficLandingPages: [
        {
            pagePath: { type: String, required: true },
            views: { type: Number, default: 0 },
            activeUsers: { type: Number, default: 0 },
            viewsPerActiveUser: { type: Number, default: 0 },
            avgEngagementTime: { type: String, default: '0s' },
            eventCount: { type: Number, default: 0 }
        }
    ],
    websiteTrafficUsersByCity: [
        {
            city: { type: String, required: true },
            activeUsers: { type: Number, default: 0 },
            newUsers: { type: Number, default: 0 },
            engagedSessions: { type: Number, default: 0 },
            engagementRate: { type: String, default: '0.0%' },
            engagedSessionsPerActiveUser: { type: Number, default: 0 },
            avgEngagementTime: { type: String, default: '0s' },
            eventCount: { type: Number, default: 0 },
            keyEvents: { type: Number, default: 0 },
            userKeyEventRate: { type: String, default: '0.0%' }
        }
    ],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    publishedAt: {
        type: Date
    }
}, { timestamps: true });

// Compound index for quick lookups per client and month/year
monthlyHighlightsSchema.index({ clientId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyHighlights', monthlyHighlightsSchema);
