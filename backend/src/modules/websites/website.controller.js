const Website = require('./website.model');
const Page = require('./page.model');
const { extractStylesheetUrls } = require('./website.chrome');
const Template = require('../templates/template.model');
const { Blog } = require('../blogs/blog.model');
const unzipper = require('unzipper');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const cloudinary = require('../../config/cloudinary');
const aiGenerationService = require('./services/websiteAiGeneration.service');
const aiEditService = require('./services/websiteAiEdit.service');

function detectThemeFromContent(htmlContents, cssContents) {
  let fontFamily = null;
  let primaryColor = null;

  // 1) A linked Google Font is the strongest signal of the site's intended font
  for (const html of htmlContents) {
    const fontLinkMatch = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/i);
    if (fontLinkMatch) {
      fontFamily = decodeURIComponent(fontLinkMatch[1]).split(':')[0].replace(/\+/g, ' ');
      break;
    }
  }

  const combinedCss = cssContents.join('\n');

  // 2) Otherwise fall back to the first non-generic font-family declared in the CSS
  if (!fontFamily) {
    const generic = ['sans-serif', 'serif', 'monospace', 'arial', 'helvetica', 'times new roman', 'inherit', 'initial'];
    const fontFamilyMatches = combinedCss.matchAll(/font-family\s*:\s*['"]?([A-Za-z0-9 ]+)['"]?/gi);
    for (const m of fontFamilyMatches) {
      const candidate = m[1].trim();
      if (candidate && !generic.includes(candidate.toLowerCase())) {
        fontFamily = candidate;
        break;
      }
    }
  }

  // 3) An explicit CSS custom property (--primary, --brand-color, etc.) is the strongest color signal
  const varMatch = combinedCss.match(/--(?:primary|brand|theme|accent|main)[a-z-]*\s*:\s*(#[0-9a-fA-F]{3,6})/i);
  if (varMatch) {
    primaryColor = varMatch[1];
  } else {
    // 4) Otherwise use the most frequently used non-grayscale hex color in the CSS
    const hexMatches = combinedCss.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
    const counts = {};
    for (const hex of hexMatches) {
      const normalized = hex.toLowerCase();
      const [r, g, b] = normalized.length === 4
        ? [normalized[1], normalized[2], normalized[3]].map(c => parseInt(c + c, 16))
        : [normalized.slice(1, 3), normalized.slice(3, 5), normalized.slice(5, 7)].map(c => parseInt(c, 16));
      const isGrayscale = (Math.max(r, g, b) - Math.min(r, g, b)) < 15; // catches whites/blacks/grays
      if (isGrayscale) continue;
      counts[normalized] = (counts[normalized] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) primaryColor = sorted[0][0];
  }

  return { fontFamily, primaryColor };
}

// Wrapper used during template zip extraction, where files are still on local disk.
function detectThemeFromTemplateFiles(htmlFiles, cssFiles) {
  const htmlContents = htmlFiles.map(f => {
    try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; }
  });
  const cssContents = cssFiles.map(f => {
    try { return fs.readFileSync(f, 'utf8'); } catch (e) { return ''; }
  });
  return detectThemeFromContent(htmlContents, cssContents);
}

function resolveAssetKey(fromDir, extractedDir, pathStr) {
  const absoluteAssetPath = pathStr.startsWith('/')
    ? path.join(extractedDir, pathStr)
    : path.resolve(fromDir, pathStr);
  return path.relative(extractedDir, absoluteAssetPath).replace(/\\/g, '/');
}

function lookupAssetUrl(assetUrlMap, assetUrlMapLower, key) {
  return assetUrlMap[key] || assetUrlMapLower[key.toLowerCase()];
}

const RAW_ASSET_EXTENSIONS = new Set(['.css', '.js', '.html', '.woff', '.woff2', '.ttf', '.otf', '.eot']);

function resolveBrokenCdnMirror(pathStr) {
  const match = pathStr.match(/^(?:\.\.\/)+([a-z0-9.-]+\.[a-z]{2,})\/(.+)$/i);
  if (!match) return null;
  const [, domain, rest] = match;
  try {
    return `https://${domain}/${decodeURIComponent(rest)}`;
  } catch (e) {
    return `https://${domain}/${rest}`;
  }
}

function stripQueryAndFragment(pathStr) {
  return pathStr.split(/[?#]/)[0];
}

function resolveReference(pathStr, fromDir, extractedDir, assetUrlMap, assetUrlMapLower) {
  const cleanPath = stripQueryAndFragment(pathStr);
  const cdnUrl = resolveBrokenCdnMirror(cleanPath);
  if (cdnUrl) return { url: cdnUrl, recoveredCdn: true };
  const key = resolveAssetKey(fromDir, extractedDir, cleanPath);
  const uploadedUrl = lookupAssetUrl(assetUrlMap, assetUrlMapLower, key);
  return uploadedUrl ? { url: uploadedUrl, recoveredCdn: false } : null;
}

const ASSET_DIR_NAMES = new Set(['img', 'images', 'image', 'css', 'js', 'lib', 'libs', 'assets', 'fonts', 'font', 'media', 'vendor', 'vendors']);
function isInsideAssetDir(relPath) {
  const segments = relPath.split('/').slice(0, -1);
  return segments.some(seg => ASSET_DIR_NAMES.has(seg.toLowerCase()));
}

const IGNORED_ASSET_FILENAMES = new Set([
  'readme.txt', 'readme.md', 'license', 'license.txt', 'license.md',
  'changelog.txt', 'changelog.md', '.gitignore', '.gitkeep', '.ds_store', 'thumbs.db'
]);
function isIgnorableTemplateFile(filePath) {
  return IGNORED_ASSET_FILENAMES.has(path.basename(filePath).toLowerCase());
}

async function detectThemeFromPublishedPages(pages) {
  const htmlContents = pages.map(p => p.html || '');

  const cssUrls = new Set();
  for (const html of htmlContents) {
    const linkMatches = html.matchAll(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi);
    for (const m of linkMatches) cssUrls.add(m[1]);
  }

  const cssContents = [];
  for (const url of cssUrls) {
    try {
      const response = await axios.get(url, { responseType: 'text', timeout: 10000 });
      cssContents.push(typeof response.data === 'string' ? response.data : '');
    } catch (e) {
      // Skip any CSS file that fails to download rather than failing the whole detection
    }
  }

  return detectThemeFromContent(htmlContents, cssContents);
}

async function downloadTemplateZip(templateRecord, zipPath) {
  const attempts = [];

  const tryFetch = async (label, url) => {
    try {
      const response = await axios({ method: 'GET', url, responseType: 'stream' });
      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      return true;
    } catch (err) {
      const status = err.response?.status;
      attempts.push(`${label}${status ? ` (HTTP ${status})` : ''}: ${err.message}`);
      return false;
    }
  };

  let publicId = templateRecord.zipPublicId;
  if (!publicId) {
    const regex = /\/(?:upload|authenticated)(?:\/s--[a-zA-Z0-9_-]+--)?(?:\/v\d+)?\/(.+)$/;
    const match = templateRecord.zipUrl.match(regex);
    publicId = match && match[1] ? match[1] : templateRecord.zipUrl;
  }
  const authenticatedUrl = cloudinary.utils.private_download_url(publicId, 'zip', {
    resource_type: 'raw',
    type: 'authenticated',
  });
  if (await tryFetch('authenticated download URL', authenticatedUrl)) return;

  if (templateRecord.zipPublicId) {
    const signedUrl = cloudinary.url(templateRecord.zipPublicId, {
      resource_type: 'raw',
      type: 'upload',
      sign_url: true,
      secure: true,
    });
    if (await tryFetch('signed upload URL', signedUrl)) return;
  }

  if (await tryFetch('direct zipUrl', templateRecord.zipUrl)) return;

  throw new Error(`All download attempts failed — ${attempts.join('; ')}`);
}

function buildWebsiteAuthQuery(req, baseQuery = {}) {
  const query = { ...baseQuery, isDeleted: false };
  const workspaceId = req.workspaceId;

  if (req.isClientRole || (req.user && ['client', 'agency_client', 'brand_super_admin', 'brand_manager'].includes(req.user.role))) {
    // Strictly isolate client websites. Only return websites that belong to the client.
    query.brandId = req.clientUserId || req.user._id;
  } else if (req.user && req.user.role !== 'commander_admin') {
    if (req.user.agencyId) {
      // Strictly enforce agencyId. 
      // Agency managers should only see agency-level websites (brandId is null)
      query.agencyId = req.user.agencyId;
      query.brandId = { $in: [null, undefined] };
    } else if (req.user.brandId) {
      query.brandId = req.user.brandId;
    } else {
      query.workspaceId = workspaceId;
    }
  } else if (!req.user || req.user.role !== 'commander_admin') {
    query.workspaceId = workspaceId;
  }
  
  return query;
}

// Create Website
exports.createWebsite = async (req, res, next) => {
  try {
    const { name, description, type, industry, businessBrief, tone, templateName } = req.body;
    const workspaceId = req.workspaceId;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Website name is required' });
    }

    const website = new Website({
      workspaceId,
      name,
      description: description || "",
      status: type === 'ai' ? 'Creating' : 'Draft',
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
      agencyId: req.user?.agencyId || null,
      brandId: req.isClientRole ? req.clientUserId : (req.user?.brandId || null)
    });

    const savedWebsite = await website.save();

    if (type === 'ai') {
      const canonicalBrief = businessBrief || description;
      
      // Kick off background generation
      (async () => {
        try {
          const aiGeneratedData = await aiGenerationService.generateWebsite({
            workspaceId,
            user: req.user,
            name,
            industry,
            businessBrief: canonicalBrief,
            tone
          });

          if (aiGeneratedData && aiGeneratedData.site) {
            if (aiGeneratedData.site.fontFamily || aiGeneratedData.site.primaryColor) {
              savedWebsite.theme = {
                fontFamily: aiGeneratedData.site.fontFamily || savedWebsite.theme.fontFamily,
                primaryColor: aiGeneratedData.site.primaryColor || savedWebsite.theme.primaryColor
              };
            }
          }

          if (aiGeneratedData && aiGeneratedData.pages) {
            for (const aiPage of aiGeneratedData.pages) {
              const newPage = new Page({
                websiteId: savedWebsite._id,
                title: aiPage.title,
                path: aiPage.slug === 'home' ? '/home' : `/${aiPage.slug.toLowerCase()}`,
                status: 'Draft',
                isHome: aiPage.isHome || aiPage.slug === 'home',
                html: aiPage.html,
                css: aiPage.css,
                metaTitle: aiPage.metaTitle || '',
                metaDescription: aiPage.metaDescription || '',
                layoutJson: { sections: [] }
              });
              await newPage.save();
            }
          }

          savedWebsite.status = 'Draft';
          await savedWebsite.save();
        } catch (error) {
          console.error("AI Website generation failed:", error.message);
          require('fs').appendFileSync('ai_error.log', new Date().toISOString() + ' ' + (error.stack || error.message) + '\n');
          savedWebsite.status = 'Failed';
          savedWebsite.failReason = error.message || "Unknown error occurred";
          await savedWebsite.save();
        }
      })();

      // Return immediately
      return res.status(201).json({ success: true, data: savedWebsite });
    }


    // If not AI, we continue with normal creation (template or blank)
    let newPages = [];
    let templateImportWarning = null;

    // If template is provided, extract zip and read all html
    if (type === 'template' && templateName) {
      const templateRecord = await Template.findOne({ name: templateName, isDeleted: false });
      if (templateRecord && templateRecord.zipUrl) {
        const tempBaseDir = path.join(os.tmpdir(), 'extracted_templates');
        if (!fs.existsSync(tempBaseDir)) fs.mkdirSync(tempBaseDir, { recursive: true });
        
        const extractSessionId = templateRecord._id.toString() + '-' + Date.now();
        const extractedDir = path.join(tempBaseDir, extractSessionId);
        const zipPath = path.join(tempBaseDir, `${extractSessionId}.zip`);

        try {
          // Determine if it's a Cloudinary URL or local path (for backward compatibility)
          const isCloudinary = templateRecord.zipUrl.startsWith('http');

          if (isCloudinary) {
            // Extract public ID and type from Cloudinary URL reliably using regex
            let publicId = templateRecord.zipUrl;
            let uploadType = 'upload'; // default
            
            const regex = /\/(upload|authenticated)(?:\/s--[a-zA-Z0-9_-]+--)?(?:\/v\d+)?\/(.+)$/;
            const match = templateRecord.zipUrl.match(regex);
            if (match) {
              uploadType = match[1];
              publicId = match[2];
            }

            // Generate an authenticated download URL using the Admin API
            const downloadUrl = cloudinary.utils.private_download_url(publicId, '', {
              resource_type: 'raw',
              type: uploadType
            });

            const response = await axios({
              method: 'GET',
              url: downloadUrl,
              responseType: 'stream'
            });
            
            await new Promise((resolve, reject) => {
              const writer = fs.createWriteStream(zipPath);
              response.data.pipe(writer);
              writer.on('finish', resolve);
              writer.on('error', reject);
            });
          } else {
            // Local fallback
            const localZipPath = path.join(__dirname, '..', '..', templateRecord.zipUrl);
            if (fs.existsSync(localZipPath)) {
              fs.copyFileSync(localZipPath, zipPath);
            } else {
              throw new Error("Local template zip not found");
            }
          }

          // Extract
          fs.mkdirSync(extractedDir, { recursive: true });
          await fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: extractedDir }))
            .promise();

          // Helper to recursively find all files
          const findFiles = (dir, fileList = []) => {
            if (!fs.existsSync(dir)) return fileList;
            const files = fs.readdirSync(dir);
            for (const file of files) {
              const filePath = path.join(dir, file);
              if (fs.statSync(filePath).isDirectory()) {
                findFiles(filePath, fileList);
              } else {
                fileList.push(filePath);
              }
            }
            return fileList;
          };

          const allFiles = findFiles(extractedDir);
          const htmlFiles = [];
          const assetFiles = [];
          
          for (const file of allFiles) {
            if (isIgnorableTemplateFile(file)) continue;
            const relPath = path.relative(extractedDir, file).replace(/\\/g, '/');
            if (file.toLowerCase().endsWith('.html') && !isInsideAssetDir(relPath)) {
              htmlFiles.push(file);
            } else {
              assetFiles.push(file);
            }
          }

          const cssFiles = assetFiles.filter(f => f.toLowerCase().endsWith('.css'));
          const detectedTheme = detectThemeFromTemplateFiles(htmlFiles, cssFiles);
          if (detectedTheme.fontFamily || detectedTheme.primaryColor) {
            savedWebsite.theme = {
              fontFamily: detectedTheme.fontFamily || savedWebsite.theme.fontFamily,
              primaryColor: detectedTheme.primaryColor || savedWebsite.theme.primaryColor
            };
            await savedWebsite.save();
          }

          const assetUrlMap = {}; 
          const assetUrlMapLower = {}; 
          const failedAssets = [];
          const recoveredCdnLinks = new Set();
          const invalidHtmlHrefs = new Set(); 

          const nonCssAssetFiles = assetFiles.filter(f => !f.toLowerCase().endsWith('.css'));

          for (const filePath of nonCssAssetFiles) {
            const relDir = path.relative(extractedDir, filePath).replace(/\\/g, '/');
            const ext = path.extname(filePath).toLowerCase();
            const resourceType = RAW_ASSET_EXTENSIONS.has(ext) ? 'raw' : 'auto';

            try {
              const result = await cloudinary.uploader.upload(filePath, {
                folder: `websites/${savedWebsite._id}`,
                use_filename: true,
                unique_filename: true,
                resource_type: resourceType
              });
              assetUrlMap[relDir] = result.secure_url;
              assetUrlMapLower[relDir.toLowerCase()] = result.secure_url;
            } catch (uploadErr) {
              console.error(`Failed to upload ${relDir}:`, uploadErr);
              failedAssets.push(relDir);
            }
          }

          for (const cssFilePath of cssFiles) {
            const cssDir = path.dirname(cssFilePath);
            const relDir = path.relative(extractedDir, cssFilePath).replace(/\\/g, '/');
            let cssContent = fs.readFileSync(cssFilePath, 'utf8');

            cssContent = cssContent.replace(/url\(\s*['"]?(?!http|\/\/|data:)([^'")]+)['"]?\s*\)/gi, (match, pathStr) => {
              const resolved = resolveReference(pathStr, cssDir, extractedDir, assetUrlMap, assetUrlMapLower);
              if (resolved && resolved.recoveredCdn) recoveredCdnLinks.add(pathStr);
              return resolved ? `url('${resolved.url}')` : match;
            });

            try {
              const tempCssPath = path.join(os.tmpdir(), `${extractSessionId}-${relDir.replace(/[\\/]/g, '_')}`);
              fs.writeFileSync(tempCssPath, cssContent, 'utf8');
              const result = await cloudinary.uploader.upload(tempCssPath, {
                folder: `websites/${savedWebsite._id}`,
                use_filename: true,
                unique_filename: true,
                resource_type: 'raw'
              });
              assetUrlMap[relDir] = result.secure_url;
              assetUrlMapLower[relDir.toLowerCase()] = result.secure_url;
              fs.unlinkSync(tempCssPath);
            } catch (uploadErr) {
              console.error(`Failed to upload ${relDir}:`, uploadErr);
              failedAssets.push(relDir);
            }
          }

          const pageBaseNames = new Set(htmlFiles.map(f => path.basename(f).toLowerCase()));

          for (const filePath of htmlFiles) {
            let htmlContent = fs.readFileSync(filePath, 'utf8');
            const fileDir = path.dirname(filePath);
            
            // Rewrite src and href to Cloudinary URLs
            htmlContent = htmlContent.replace(/(src|href)=["'](?!http|\/\/|data:|#|mailto:|tel:)([^"']+)["']/gi, (match, attr, pathStr) => {
              // If it's a link to another real page, rewrite it to a clean path
              if (attr.toLowerCase() === 'href' && pathStr.toLowerCase().endsWith('.html')) {
                const rawBaseName = pathStr.split('/').pop().toLowerCase();
                if (pageBaseNames.has(rawBaseName)) {
                  const cleanName = rawBaseName.replace(/\.html$/i, '');
                  return `href="/${cleanName === 'index' ? 'home' : cleanName}"`;
                }
                invalidHtmlHrefs.add(pathStr);
              }
              
              const resolved = resolveReference(pathStr, fileDir, extractedDir, assetUrlMap, assetUrlMapLower);
              
              if (resolved) {
                if (resolved.recoveredCdn) recoveredCdnLinks.add(pathStr);
                return `${attr}="${resolved.url}"`;
              }
              
              return match; // Keep original if not uploaded
            });

            // Rewrite srcset (responsive images, icon variants) to Cloudinary URLs
            htmlContent = htmlContent.replace(/srcset=["']([^"']+)["']/gi, (match, srcsetVal) => {
              const rewritten = srcsetVal.split(',').map(entry => {
                const trimmed = entry.trim();
                const spaceIdx = trimmed.search(/\s/);
                const urlPart = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
                const descriptor = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx);
                if (/^(http|\/\/|data:)/i.test(urlPart)) return trimmed;
                const resolved = resolveReference(urlPart, fileDir, extractedDir, assetUrlMap, assetUrlMapLower);
                if (resolved && resolved.recoveredCdn) recoveredCdnLinks.add(urlPart);
                return resolved ? `${resolved.url}${descriptor}` : trimmed;
              }).join(', ');
              return `srcset="${rewritten}"`;
            });

            // Rewrite url('...') in inline styles
            htmlContent = htmlContent.replace(/url\(\s*['"]?(?!http|\/\/|data:)([^'")]+)['"]?\s*\)/gi, (match, pathStr) => {
              const resolved = resolveReference(pathStr, fileDir, extractedDir, assetUrlMap, assetUrlMapLower);
              
              if (resolved) {
                if (resolved.recoveredCdn) recoveredCdnLinks.add(pathStr);
                return `url('${resolved.url}')`;
              }
              return match;
            });

            const fileName = path.basename(filePath);
            const isHome = fileName.toLowerCase() === 'index.html';
            const pageName = fileName.replace(/\.html$/i, '');
            const pagePath = isHome ? '/home' : `/${pageName.toLowerCase()}`;
            const pageTitle = pageName.charAt(0).toUpperCase() + pageName.slice(1);

            const stylesheetUrls = extractStylesheetUrls(htmlContent);

            const newPage = new Page({
              websiteId: savedWebsite._id,
              title: isHome ? 'Home' : pageTitle,
              path: pagePath,
              status: 'Draft',
              isHome,
              html: htmlContent,
              css: '', // CSS is linked via <link> tags from Cloudinary now
              stylesheetUrls,
              layoutJson: { sections: [] }
            });
            await newPage.save();
            newPages.push(newPage);
          }
          
          // Safeguard: If no index.html was found in the template, force the first page to be Home
          if (newPages.length > 0 && !newPages.some(p => p.isHome)) {
            newPages[0].isHome = true;
            newPages[0].path = '/home';
            newPages[0].title = 'Home';
            await newPages[0].save();
          }

          const warningParts = [];

          if (failedAssets.length > 0) {
            const shown = failedAssets.slice(0, 5).join(', ');
            const more = failedAssets.length > 5 ? ` and ${failedAssets.length - 5} more` : '';
            warningParts.push(`${failedAssets.length} asset(s) failed to upload and may be missing (e.g. ${shown}${more})`);
          }

          if (recoveredCdnLinks.size > 0) {
            const shown = [...recoveredCdnLinks].slice(0, 3).join(', ');
            const more = recoveredCdnLinks.size > 3 ? ` and ${recoveredCdnLinks.size - 3} more` : '';
            warningParts.push(`${recoveredCdnLinks.size} broken local reference(s) to CDN libraries (e.g. ${shown}${more}) were pointed back at their real CDN URLs — this template's zip was likely a browser "Save Page As" copy that never included those library files`);
          }

          if (invalidHtmlHrefs.size > 0) {
            const shown = [...invalidHtmlHrefs].join(', ');
            warningParts.push(`${invalidHtmlHrefs.size} link(s) pointed at an .html target that wasn't part of this import (e.g. ${shown}) — this is either a page missing from the template zip itself, or a non-page file mislabeled with an .html extension (e.g. a favicon); worth checking manually`);
          }

          if (warningParts.length > 0) {
            templateImportWarning = `Imported "${templateName}" with some issues: ${warningParts.join('; ')}.`;
          }

          // Clean up temp files
          fs.rmSync(extractedDir, { recursive: true, force: true });
          fs.unlinkSync(zipPath);

        } catch (zipErr) {
          console.error("Error processing template zip:", zipErr);
          templateImportWarning = `Couldn't import pages from the "${templateName}" template (${zipErr.message || 'download/extract failed'}), so this site was created with just a blank Home page instead.`;
        }
      } else {
        templateImportWarning = `Template "${templateName}" was not found or has no uploaded file, so this site was created with just a blank Home page instead.`;
      }
    }

    // If no template or extraction failed, create default home page
    if (newPages.length === 0 && type !== 'ai') {
      const homePage = new Page({
        websiteId: savedWebsite._id,
        title: 'Home',
        path: '/home',
        status: 'Draft',
        isHome: true,
        html: '<div style="padding: 50px; text-align: center; font-family: Inter, sans-serif;"><h1>Welcome to your new site</h1></div>',
        css: '',
        layoutJson: {
          sections: [
            { type: 'hero', content: { headline: `Welcome to ${name}`, subheadline: description || 'Built with AI' } }
          ]
        }
      });
      await homePage.save();
      newPages.push(homePage);
    }

    res.status(201).json({
      success: true,
      warning: templateImportWarning || undefined,
      data: {
        ...savedWebsite.toObject(),
        pages: newPages.map(p => ({ _id: p._id, title: p.title, path: p.path, status: p.status, isHome: p.isHome }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// List Websites
exports.getWebsites = async (req, res, next) => {
  try {
    const workspaceId = req.workspaceId;
    const { search, page = 1, limit = 10, sortBy = 'updatedAt:desc' } = req.query;

    const query = buildWebsiteAuthQuery(req);
    
    if (search) {
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { $or: [{ name: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }] }
        ];
        delete query.$or;
      } else {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
    }

    const sortObj = {};
    const [field, order] = sortBy.split(':');
    sortObj[field] = order === 'asc' ? 1 : -1;

    const total = await Website.countDocuments(query);
    const websites = await Website.find(query)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Map pages count and blogs count onto websites
    const data = await Promise.all(websites.map(async (web) => {
      const pagesCount = await Page.countDocuments({ websiteId: web._id, isDeleted: false });
      const blogsCount = await Blog.countDocuments({ websiteId: web._id, isDeleted: false });
      return {
        ...web.toObject(),
        pagesCount,
        blogsCount
      };
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get Website details + Pages
exports.getWebsiteDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = buildWebsiteAuthQuery(req, { _id: id });
    const website = await Website.findOne(query);
    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    const pages = await Page.find({ websiteId: id, isDeleted: false }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: {
        ...website.toObject(),
        pages
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get Public Website details + Pages (no auth required)
exports.getPublicWebsiteDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const website = await Website.findOne({ _id: id, isDeleted: false });
    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    const pages = await Page.find({ websiteId: id, isDeleted: false }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: {
        ...website.toObject(),
        pages
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get single Page details
exports.getPage = async (req, res, next) => {
  try {
    const { websiteId, pageId } = req.params;
    
    // Optional: Check if website belongs to workspace (using auth query)
    const query = buildWebsiteAuthQuery(req, { _id: websiteId });
    const website = await Website.findOne(query);
    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    const page = await Page.findOne({ _id: pageId, websiteId, isDeleted: false });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    res.json({ success: true, data: page });
  } catch (error) {
    next(error);
  }
};

// Update Website Settings
exports.updateWebsite = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, status, faviconUrl, trackingPixels, chatWidgetId, pages, theme } = req.body;

    const query = buildWebsiteAuthQuery(req, { _id: id });
    const website = await Website.findOne(query);
    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    if (name) website.name = name;
    if (description !== undefined) website.description = description;
    if (status) website.status = status;
    if (faviconUrl !== undefined) website.faviconUrl = faviconUrl;
    if (chatWidgetId !== undefined) website.chatWidgetId = chatWidgetId;
    if (trackingPixels) {
      website.trackingPixels = { ...website.trackingPixels, ...trackingPixels };
    }
    if (theme) {
      website.theme = { ...(website.theme?.toObject ? website.theme.toObject() : website.theme), ...theme };
    }
    website.updatedBy = req.user?._id;

    const saved = await website.save();

    // Synchronize pages if provided
    let finalPages = [];
    if (pages && Array.isArray(pages)) {
      const existingPages = await Page.find({ websiteId: id });
      const incomingPageIds = pages.filter(p => p._id && !p._id.toString().startsWith('temp-')).map(p => p._id.toString());
      
      // HARD DELETE missing pages
      for (const ep of existingPages) {
        if (!incomingPageIds.includes(ep._id.toString())) {
          await Page.deleteOne({ _id: ep._id });
        }
      }

      // CREATE or UPDATE incoming pages
      for (const p of pages) {
        if (!p._id || p._id.toString().startsWith('temp-')) {
          // CREATE
          const newPage = new Page({
            websiteId: id,
            title: p.title,
            path: p.path,
            status: p.status || 'Draft',
            isHome: p.isHome || false,
            layoutJson: p.layoutJson || { sections: [] },
            html: p.html || '',
            css: p.css || '',
            stylesheetUrls: p.stylesheetUrls || [],
            customHeadCode: p.customHeadCode || '',
            customBodyCode: p.customBodyCode || ''
          });
          const savedPage = await newPage.save();
          finalPages.push(savedPage);
        } else {
          // UPDATE
          const updatedPage = await Page.findOneAndUpdate(
            { _id: p._id, websiteId: id },
            {
              $set: {
                title: p.title,
                path: p.path,
                status: p.status,
                isHome: p.isHome,
                customHeadCode: p.customHeadCode || '',
                customBodyCode: p.customBodyCode || ''
              }
            },
            { returnDocument: 'after' }
          );
          if (updatedPage) finalPages.push(updatedPage);
        }
      }
      
      // Sort pages by creation date for consistency
      finalPages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // Update the response payload to include the updated pages
      return res.json({ 
        success: true, 
        data: {
          ...saved.toObject(),
          pages: finalPages
        } 
      });
    }

    res.json({ success: true, data: saved });
  } catch (error) {
    next(error);
  }
};

// Delete Website
exports.deleteWebsite = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const query = buildWebsiteAuthQuery(req, { _id: id });
    const website = await Website.findOneAndDelete(query);
    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    // Hard delete associated pages
    await Page.deleteMany({ websiteId: id });

    res.json({ success: true, message: 'Website and pages deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Clone Website
exports.cloneWebsite = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = buildWebsiteAuthQuery(req, { _id: id });
    const originalWebsite = await Website.findOne(query);
    
    if (!originalWebsite) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    const clonedWebsite = new Website({
      workspaceId: req.workspaceId,
      name: `${originalWebsite.name} (Clone)`,
      description: originalWebsite.description,
      type: originalWebsite.type,
      status: 'Draft',
      createdBy: req.user?._id || originalWebsite.createdBy,
      updatedBy: req.user?._id || originalWebsite.createdBy,
      faviconUrl: originalWebsite.faviconUrl,
      trackingPixels: originalWebsite.trackingPixels,
      chatWidgetId: originalWebsite.chatWidgetId,
      agencyId: req.user?.agencyId || originalWebsite.agencyId || null,
      brandId: req.user?.brandId || originalWebsite.brandId || null
    });

    const savedWebsite = await clonedWebsite.save();

    const originalPages = await Page.find({ websiteId: id, isDeleted: false });
    const clonedPages = originalPages.map(p => ({
      websiteId: savedWebsite._id,
      title: p.title,
      path: p.path,
      status: p.status,
      isHome: p.isHome,
      layoutJson: p.layoutJson,
      html: p.html,
      css: p.css,
      stylesheetUrls: p.stylesheetUrls
    }));

    if (clonedPages.length > 0) {
      await Page.insertMany(clonedPages);
    }

    res.status(201).json({ success: true, data: savedWebsite, message: 'Website cloned successfully' });
  } catch (error) {
    next(error);
  }
};

exports.syncWebsiteTheme = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = buildWebsiteAuthQuery(req, { _id: id });
    const website = await Website.findOne(query);
    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    const pages = await Page.find({ websiteId: id, isDeleted: false });
    if (pages.length === 0) {
      return res.status(400).json({ success: false, error: 'This website has no pages to detect a theme from' });
    }

    const detected = await detectThemeFromPublishedPages(pages);
    if (!detected.fontFamily && !detected.primaryColor) {
      return res.status(200).json({ success: true, data: website, message: 'No distinct font or brand color could be detected from this site\'s pages' });
    }

    website.theme = {
      fontFamily: detected.fontFamily || website.theme.fontFamily,
      primaryColor: detected.primaryColor || website.theme.primaryColor
    };
    website.updatedBy = req.user?._id;
    const saved = await website.save();

    res.json({ success: true, data: saved, message: 'Theme synced from site pages' });
  } catch (error) {
    next(error);
  }
};

// Add Page to Website
exports.addPage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, path } = req.body;

    if (!title || !path) {
      return res.status(400).json({ success: false, error: 'Page title and path are required' });
    }

    const query = buildWebsiteAuthQuery(req, { _id: id });
    const website = await Website.findOne(query);
    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    // Check path format and existence
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const pathExists = await Page.findOne({ websiteId: id, path: cleanPath, isDeleted: false });
    if (pathExists) {
      return res.status(400).json({ success: false, error: 'Page path already exists for this website' });
    }

    const page = new Page({
      websiteId: id,
      title,
      path: cleanPath,
      status: 'Draft',
      isHome: false
    });

    const savedPage = await page.save();
    res.status(201).json({ success: true, data: savedPage });
  } catch (error) {
    next(error);
  }
};

// Duplicate Website Page
exports.duplicatePage = async (req, res, next) => {
  try {
    const { websiteId, pageId } = req.params;

    const page = await Page.findOne({ _id: pageId, websiteId, isDeleted: false });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    let newPath = `${page.path}-copy`;
    let pathExists = true;
    let counter = 1;

    while (pathExists) {
      const check = await Page.findOne({ websiteId, path: newPath, isDeleted: false });
      if (!check) {
        pathExists = false;
      } else {
        newPath = `${page.path}-copy-${counter}`;
        counter++;
      }
    }

    const duplicated = new Page({
      websiteId,
      title: `${page.title} (Copy)`,
      path: newPath,
      status: 'Draft',
      isHome: false,
      layoutJson: page.layoutJson,
      html: page.html,
      css: page.css,
      stylesheetUrls: page.stylesheetUrls,
      customHeadCode: page.customHeadCode,
      customBodyCode: page.customBodyCode
    });

    const saved = await duplicated.save();
    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    next(error);
  }
};

// Update Page
exports.updatePage = async (req, res, next) => {
  try {
    const { websiteId, pageId } = req.params;
    const { title, path, layoutJson, html, css, status, customHeadCode, customBodyCode, stylesheetUrls } = req.body;

    const page = await Page.findOne({ _id: pageId, websiteId, isDeleted: false });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    if (title) page.title = title;
    if (path) {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      if (cleanPath !== page.path) {
        const pathExists = await Page.findOne({ websiteId, path: cleanPath, isDeleted: false });
        if (pathExists) {
          return res.status(400).json({ success: false, error: 'Page path already exists for this website' });
        }
        page.path = cleanPath;
      }
    }
    if (layoutJson !== undefined) page.layoutJson = layoutJson;
    if (html !== undefined) page.html = html;
    if (css !== undefined) page.css = css;
    if (stylesheetUrls !== undefined) page.stylesheetUrls = stylesheetUrls;
    if (status) page.status = status;
    if (customHeadCode !== undefined) page.customHeadCode = customHeadCode;
    if (customBodyCode !== undefined) page.customBodyCode = customBodyCode;

    const saved = await page.save();
    res.json({ success: true, data: saved });
  } catch (error) {
    next(error);
  }
};

// Delete Page
exports.deletePage = async (req, res, next) => {
  try {
    const { websiteId, pageId } = req.params;

    const page = await Page.findOne({ _id: pageId, websiteId, isDeleted: false });
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    if (page.isHome) {
      return res.status(400).json({ success: false, error: 'Cannot delete the home page' });
    }

    page.isDeleted = true;
    await page.save();

    res.json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.aiEditWebsite = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const { prompt, pageId, pageSlug } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    const query = buildWebsiteAuthQuery(req, { _id: websiteId });
    const website = await Website.findOne(query);
    if (!website) {
      return res.status(404).json({ success: false, error: 'Website not found' });
    }

    let pages = [];
    let targetPage = null;

    if (pageId || pageSlug) {
      const pageQuery = { websiteId: website._id, isDeleted: false };
      if (pageId) pageQuery._id = pageId;
      else if (pageSlug) {
        const cleanPath = pageSlug.startsWith('/') ? pageSlug : `/${pageSlug}`;
        pageQuery.path = cleanPath;
      }
      targetPage = await Page.findOne(pageQuery);
      if (!targetPage) {
        return res.status(404).json({ success: false, error: 'Target page not found' });
      }
    } else {
      pages = await Page.find({ websiteId: website._id, isDeleted: false });
    }

    const result = await aiEditService.aiEditWebsite({
      workspaceId: req.workspaceId,
      user: req.user,
      website,
      pages,
      targetPage,
      prompt
    });

    // Apply the operation
    const { operation } = result;
    
    if (operation === 'CREATE_PAGE') {
      const { title, slug, isHome, metaTitle, metaDescription, html, css } = result.page;
      const cleanPath = slug.startsWith('/') ? slug : `/${slug}`;
      const existingPage = await Page.findOne({ websiteId: website._id, path: cleanPath, isDeleted: false });
      
      if (existingPage) {
        return res.status(400).json({ success: false, error: `A page with slug ${slug} already exists.` });
      }
      
      const newPage = new Page({
        websiteId: website._id,
        title,
        path: cleanPath,
        isHome: isHome || false,
        metaTitle: metaTitle || '',
        metaDescription: metaDescription || '',
        html: html || '',
        css: css || '',
        status: 'Draft'
      });
      await newPage.save();
      return res.json({ success: true, operation, data: newPage });
    }
    
    if (operation === 'MODIFY_PAGE') {
      const { pageSlug, html, css, metaTitle, metaDescription } = result;
      const cleanPath = pageSlug.startsWith('/') ? pageSlug : `/${pageSlug}`;
      const pageToUpdate = await Page.findOne({ websiteId: website._id, path: cleanPath, isDeleted: false });
      
      if (!pageToUpdate) {
        return res.status(404).json({ success: false, error: `Page ${pageSlug} not found.` });
      }
      
      if (html !== undefined) pageToUpdate.html = html;
      if (css !== undefined) pageToUpdate.css = css;
      if (metaTitle !== undefined) pageToUpdate.metaTitle = metaTitle;
      if (metaDescription !== undefined) pageToUpdate.metaDescription = metaDescription;
      
      await pageToUpdate.save();
      return res.json({ success: true, operation, data: pageToUpdate });
    }
    
    if (operation === 'MODIFY_SECTION') {
      const { pageSlug, sectionIdentifier, action, html, css } = result;
      const cleanPath = pageSlug.startsWith('/') ? pageSlug : `/${pageSlug}`;
      const pageToUpdate = await Page.findOne({ websiteId: website._id, path: cleanPath, isDeleted: false });
      
      if (!pageToUpdate) {
        return res.status(404).json({ success: false, error: `Page ${pageSlug} not found.` });
      }
      
      pageToUpdate.html = aiEditService.applyModifySection(pageToUpdate.html, sectionIdentifier, action, html);
      // We don't have a safe way to merge CSS without a parser, so we'll append if provided.
      // A more robust solution would be needed if CSS is heavily edited, but this matches generation flow.
      if (css) {
         pageToUpdate.css += '\n' + css;
      }
      
      await pageToUpdate.save();
      return res.json({ success: true, operation, data: pageToUpdate });
    }
    
    if (operation === 'UPDATE_CONTENT') {
      const { pageSlug, changes } = result;
      const cleanPath = pageSlug.startsWith('/') ? pageSlug : `/${pageSlug}`;
      const pageToUpdate = await Page.findOne({ websiteId: website._id, path: cleanPath, isDeleted: false });
      
      if (!pageToUpdate) {
        return res.status(404).json({ success: false, error: `Page ${pageSlug} not found.` });
      }
      
      pageToUpdate.html = aiEditService.applyUpdateContent(pageToUpdate.html, changes);
      await pageToUpdate.save();
      return res.json({ success: true, operation, data: pageToUpdate });
    }
    
    if (operation === 'UPDATE_SEO') {
      const { pageSlug, metaTitle, metaDescription } = result;
      const cleanPath = pageSlug.startsWith('/') ? pageSlug : `/${pageSlug}`;
      const pageToUpdate = await Page.findOne({ websiteId: website._id, path: cleanPath, isDeleted: false });
      
      if (!pageToUpdate) {
        return res.status(404).json({ success: false, error: `Page ${pageSlug} not found.` });
      }
      
      if (metaTitle !== undefined) pageToUpdate.metaTitle = metaTitle;
      if (metaDescription !== undefined) pageToUpdate.metaDescription = metaDescription;
      
      await pageToUpdate.save();
      return res.json({ success: true, operation, data: pageToUpdate });
    }
    
    if (operation === 'UPDATE_THEME') {
      const { theme } = result;
      if (theme && typeof theme === 'object') {
        let hasChanges = false;
        
        if (theme.primaryColor !== undefined) {
          website.theme.primaryColor = theme.primaryColor;
          hasChanges = true;
        }
        
        if (theme.fontFamily !== undefined) {
          website.theme.fontFamily = theme.fontFamily;
          hasChanges = true;
        }
        
        if (theme.tagline !== undefined) {
          website.theme.tagline = theme.tagline;
          hasChanges = true;
        }
        
        if (hasChanges) {
          website.updatedBy = req.user?._id;
          await website.save();
        }
      }
      return res.json({ success: true, operation, data: website });
    }
    
    if (operation === 'DELETE_PAGE') {
      const { pageSlug } = result;
      const cleanPath = pageSlug.startsWith('/') ? pageSlug : `/${pageSlug}`;
      const pageToUpdate = await Page.findOne({ websiteId: website._id, path: cleanPath, isDeleted: false });
      
      if (!pageToUpdate) {
        return res.status(404).json({ success: false, error: `Page ${pageSlug} not found.` });
      }
      
      if (pageToUpdate.isHome) {
        return res.status(400).json({ success: false, error: 'Cannot delete the home page.' });
      }
      
      pageToUpdate.isDeleted = true;
      await pageToUpdate.save();
      return res.json({ success: true, operation, data: { deletedId: pageToUpdate._id } });
    }

    return res.status(400).json({ success: false, error: 'Unsupported operation returned by AI.' });

  } catch (error) {
    next(error);
  }
};

exports.buildWebsiteAuthQuery = buildWebsiteAuthQuery;