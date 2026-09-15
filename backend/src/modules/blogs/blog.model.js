const mongoose = require('mongoose');

const options = { discriminatorKey: 'assetType', collection: 'blogassets', timestamps: true };

// Base Schema
const BlogAssetSchema = new mongoose.Schema({
  isDeleted: { type: Boolean, default: false, required: true }
}, options);

const BlogAsset = mongoose.model('BlogAsset', BlogAssetSchema);

// Blog Schema
const Blog = BlogAsset.discriminator('Blog', new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  agencyId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  brandId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  websiteId: { type: mongoose.Schema.Types.ObjectId, default: null }, 
  storeId: { type: mongoose.Schema.Types.ObjectId, default: null }, 
  description: { type: String, default: "" },
  postsPerPage: { type: Number, default: 12, required: true },
  status: { type: String, enum: ['active', 'draft'], default: 'active', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId },
  updatedBy: { type: mongoose.Schema.Types.ObjectId }
}), 'blog');

// Re-add indices that are unique
BlogAssetSchema.index({ workspaceId: 1, slug: 1, assetType: 1 }, { unique: true, sparse: true });

// Blog Category Schema
const BlogCategory = BlogAsset.discriminator('BlogCategory', new mongoose.Schema({
  blogId: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogAsset', required: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  description: { type: String, default: "" }
}), 'category');
BlogAssetSchema.index({ blogId: 1, slug: 1, assetType: 1 }, { unique: true, sparse: true });

// Blog Post Schema
const BlogPost = BlogAsset.discriminator('BlogPost', new mongoose.Schema({
  blogId: { type: mongoose.Schema.Types.ObjectId, ref: 'BlogAsset', required: true, index: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  content: { type: String, default: "" },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', required: true },
  categories: [{ type: String }],
  websiteId: { type: mongoose.Schema.Types.ObjectId, default: null },
  storeId: { type: mongoose.Schema.Types.ObjectId, default: null },
  excerpt: { type: String, default: "" },
  featuredImageUrl: { type: String, default: "" },
  faqs: {
    type: [{
      question: { type: String, default: "", trim: true },
      answer: { type: String, default: "", trim: true },
      _id: false
    }],
    default: []
  },
  layoutJson: { type: mongoose.Schema.Types.Mixed, default: {} },
  html: { type: String, default: "" },
  css: { type: String, default: "" },
  metaTitle: { type: String, default: "" },
  metaDescription: { type: String, default: "" },
  ogTitle: { type: String, default: "" },
  ogDescription: { type: String, default: "" },
  schemaMarkup: { type: mongoose.Schema.Types.Mixed, default: null },
  isFeatured: { type: Boolean, default: false }
}), 'post');
BlogAssetSchema.index({ blogId: 1, status: 1 });

module.exports = { BlogAsset, Blog, BlogCategory, BlogPost };
