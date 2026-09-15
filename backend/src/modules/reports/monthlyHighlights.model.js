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
