const Template = require('./template.model');

exports.getTemplates = async (req, res, next) => {
  try {
    const { type } = req.query; // 'website', 'form'
    
    let query = { isDeleted: false };
    if (type) {
      query.type = type;
    }

    if (req.user) {
      if (req.user.role !== 'commander_admin') {
        query.$or = [
          { isGlobal: true },
          { agencyId: req.user.agencyId },
          { brandId: req.user.brandId }
        ];
      }
    }

    const templates = await Template.find(query).sort({ createdAt: -1 }).lean();

    const mappedTemplates = templates.map(t => {
      let canDelete = false;
      if (req.user) {
        if (req.user.role === 'commander_admin') {
          canDelete = true;
        } else {
          const isClientSideUpload = !!t.brandId;
          const isAgencySideUpload = !!t.agencyId && !t.brandId;
          const currentIsClientSide = req.isClientRole;
          
          if (isClientSideUpload && currentIsClientSide && t.brandId.toString() === (req.user.brandId?.toString() || req.user._id?.toString())) {
            canDelete = true;
          } else if (isAgencySideUpload && !currentIsClientSide && t.agencyId?.toString() === (req.user.agencyId?.toString() || req.user._id?.toString())) {
            canDelete = true;
          }
        }
      }
      return { ...t, canDelete };
    });

    // Group by category to help frontend UI easily
    const categories = {};
    mappedTemplates.forEach(t => {
      const cat = t.category || 'Uncategorized';
      if (!categories[cat]) {
        categories[cat] = [];
      }
      categories[cat].push(t);
    });

    const categoryList = Object.keys(categories).map(cat => ({
      name: cat,
      count: categories[cat].length
    })).sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      data: {
        templates: mappedTemplates,
        categories: categoryList
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.uploadTemplate = async (req, res, next) => {
  try {
    const { name, type, category, description, featuresCount } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Name and type are required' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No ZIP file uploaded' });
    }

    const template = new Template({
      name,
      type,
      category: category || 'Custom Uploads',
      description: description || '',
      featuresCount: featuresCount ? parseInt(featuresCount) : 1,
      zipUrl: req.file.path && req.file.path.startsWith('http') ? req.file.path : `uploads/templates/${req.file.filename}`, // Local or Cloudinary URL
      zipPublicId: req.file.path && req.file.path.startsWith('http') ? (req.file.filename || '') : '', // Cloudinary public_id (raw resource), used to rebuild a reliable download URL later
      isRealData: true,
      createdBy: req.user ? req.user.userId : null,
      agencyId: req.user ? req.user.agencyId : null,
      brandId: req.user ? req.user.brandId : null,
      isGlobal: req.user && req.user.role === 'commander_admin'
    });

    const savedTemplate = await template.save();

    res.status(201).json({
      success: true,
      data: savedTemplate,
      message: 'Template uploaded successfully'
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    if (req.user.role !== 'commander_admin') {
      const isClientSideUpload = !!template.brandId;
      const isAgencySideUpload = !!template.agencyId && !template.brandId;
      
      const currentIsClientSide = req.isClientRole;
      
      if (isClientSideUpload) {
        if (!currentIsClientSide) {
           return res.status(403).json({ success: false, error: 'This template was uploaded by a client and can only be deleted from the client portal' });
        }
        if (template.brandId.toString() !== (req.user.brandId?.toString() || req.user._id?.toString())) {
           return res.status(403).json({ success: false, error: 'You do not have permission to delete this template' });
        }
      } else if (isAgencySideUpload) {
        if (currentIsClientSide) {
           return res.status(403).json({ success: false, error: 'This template was uploaded by the agency and can only be deleted from the agency portal' });
        }
        if (template.agencyId.toString() !== (req.user.agencyId?.toString() || req.user._id?.toString())) {
           return res.status(403).json({ success: false, error: 'You do not have permission to delete this template' });
        }
      } else {
         return res.status(403).json({ success: false, error: 'You do not have permission to delete this template' });
      }
    }

    template.isDeleted = true;
    await template.save();

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const unzipper = require('unzipper');
const cloudinary = require('../../config/cloudinary');

const PREVIEWS_DIR = path.join(os.tmpdir(), 'tunepath_template_previews');

function findRootHtmlDir(baseDir) {
  const items = fs.readdirSync(baseDir);
  const hasRootHtml = items.some(item => item.toLowerCase().endsWith('.html'));
  if (hasRootHtml) return baseDir;

  const subdirs = items.filter(item => {
    const fullPath = path.join(baseDir, item);
    return fs.statSync(fullPath).isDirectory();
  });

  if (subdirs.length === 1) {
    const subDirPath = path.join(baseDir, subdirs[0]);
    const subItems = fs.readdirSync(subDirPath);
    if (subItems.some(i => i.toLowerCase().endsWith('.html'))) {
      return subDirPath;
    }
  }

  return baseDir;
}

async function getOrExtractTemplateDir(template) {
  const templateDir = path.join(PREVIEWS_DIR, template._id.toString());
  if (fs.existsSync(templateDir) && fs.readdirSync(templateDir).length > 0) {
    return findRootHtmlDir(templateDir);
  }

  fs.mkdirSync(templateDir, { recursive: true });

  let publicId = template.zipPublicId;
  let uploadType = 'upload';
  if (template.zipUrl) {
    const regex = /\/(upload|authenticated)(?:\/s--[a-zA-Z0-9_-]+--)?(?:\/v\d+)?\/(.+)$/;
    const match = template.zipUrl.match(regex);
    if (match) {
      uploadType = match[1];
      publicId = match[2];
    }
  }

  const downloadUrl = cloudinary.utils.private_download_url(publicId, 'zip', {
    resource_type: 'raw',
    type: uploadType
  });

  const zipPath = path.join(os.tmpdir(), `template_${template._id.toString()}.zip`);
  const response = await axios({ method: 'GET', url: downloadUrl, responseType: 'stream' });

  const writer = fs.createWriteStream(zipPath);
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: templateDir })).promise();

  try { fs.unlinkSync(zipPath); } catch (e) {}

  return findRootHtmlDir(templateDir);
}

exports.previewTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await Template.findById(id);

    if (!template || template.isDeleted) {
      return res.status(404).send('Template not found');
    }

    const templateRootDir = await getOrExtractTemplateDir(template);

    let subPath = '';
    if (Array.isArray(req.params.splat)) {
      subPath = path.join(...req.params.splat);
    } else if (typeof req.params.splat === 'string') {
      subPath = req.params.splat;
    }

    if (!subPath || subPath === '.') {
      subPath = 'index.html';
    }

    let filePath = path.normalize(path.join(templateRootDir, subPath));
    if (!filePath.startsWith(templateRootDir)) {
      return res.status(403).send('Forbidden');
    }

    if (!fs.existsSync(filePath)) {
      if (fs.existsSync(path.join(filePath, 'index.html'))) {
        filePath = path.join(filePath, 'index.html');
      } else {
        return res.status(404).send('File not found');
      }
    }

    if (fs.statSync(filePath).isDirectory()) {
      const indexFile = path.join(filePath, 'index.html');
      if (fs.existsSync(indexFile)) {
        filePath = indexFile;
      } else {
        return res.status(404).send('Index file not found');
      }
    }

    if (filePath.toLowerCase().endsWith('.html')) {
      let content = fs.readFileSync(filePath, 'utf-8');
      const baseTag = `<base href="/api/templates/${template._id.toString()}/preview/">`;
      if (!content.includes('<base ')) {
        if (content.includes('<head>')) {
          content = content.replace('<head>', `<head>\n  ${baseTag}`);
        } else if (content.includes('<HEAD>')) {
          content = content.replace('<HEAD>', `<HEAD>\n  ${baseTag}`);
        } else {
          content = `${baseTag}\n${content}`;
        }
      }
      return res.type('html').send(content);
    }

    res.sendFile(filePath);
  } catch (err) {
    console.error('Template preview error:', err);
    res.status(500).send('Error serving template preview');
  }
};