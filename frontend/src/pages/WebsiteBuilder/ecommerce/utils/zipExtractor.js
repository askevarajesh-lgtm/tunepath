import JSZip from 'jszip';

export const processZipFile = async (file) => {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  
  const pages = {};
  const assets = {};

  const filePromises = [];
  
  // Find common root directory to strip it
  const paths = Object.keys(loadedZip.files).filter(p => !loadedZip.files[p].dir && !p.includes('__MACOSX') && !p.includes('.DS_Store'));
  let commonPrefix = '';
  if (paths.length > 0) {
    const splitPaths = paths.map(p => p.split('/'));
    const firstPath = splitPaths[0];
    let i = 0;
    while (i < firstPath.length - 1) { 
      const folder = firstPath[i];
      if (splitPaths.every(p => p[i] === folder)) {
        commonPrefix += folder + '/';
        i++;
      } else {
        break;
      }
    }
  }

  loadedZip.forEach((originalPath, zipEntry) => {
    if (zipEntry.dir || originalPath.includes('__MACOSX') || originalPath.includes('.DS_Store')) return;

    let relativePath = originalPath;
    if (commonPrefix && originalPath.startsWith(commonPrefix)) {
      relativePath = originalPath.substring(commonPrefix.length);
    }

    if (relativePath.endsWith('.html') || relativePath.endsWith('.htm')) {
      filePromises.push(
        zipEntry.async('string').then(content => {
          // SANITIZATION: Strip external ecommerce logic but keep UI
          let sanitizedContent = content;
          
          // Basic script removal for potentially conflicting logic
          const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
          sanitizedContent = sanitizedContent.replace(scriptRegex, (match, scriptContent) => {
            const lowerScript = scriptContent.toLowerCase();
            // Remove scripts that likely interfere with our commerce state
            if (lowerScript.includes('cart') && lowerScript.includes('storage') || 
                lowerScript.includes('checkout') || 
                lowerScript.includes('payment') ||
                lowerScript.includes('addtocart') ||
                lowerScript.includes('localstorage.setitem("cart"')) {
                return ''; // Remove
            }
            return match; // Keep harmless scripts like sliders
          });

          let fileName = relativePath.split('/').pop();
          let baseName = fileName.replace(/\.html?$/, '');
          let lowerName = baseName.toLowerCase();
          
          let role = 'Other';
          let name = baseName.charAt(0).toUpperCase() + baseName.slice(1);

          const normName = lowerName.replace(/[-_]/g, '');
          
          // Enhanced multi-signal detection
          const lowerHtml = sanitizedContent.toLowerCase();
          const titleMatch = sanitizedContent.match(/<title[^>]*>([^<]+)<\/title>/i);
          const title = titleMatch ? titleMatch[1].toLowerCase() : '';
          
          const combinedSignals = `${normName} ${title}`.trim();
          
          if (combinedSignals.includes('index') || combinedSignals.includes('home') || combinedSignals.includes('main')) {
            role = 'Home';
            name = 'Home';
          } else if (combinedSignals.includes('list') || combinedSignals.includes('shop') || combinedSignals.includes('products') || combinedSignals.includes('collection') || combinedSignals.includes('category')) {
            role = 'Shop';
            name = 'Shop';
          } else if (combinedSignals.includes('detail') || combinedSignals.includes('single') || combinedSignals.includes('product') || combinedSignals.includes('item')) {
            role = 'Product Detail';
            name = 'Product Detail';
          } else if (combinedSignals.includes('cart') || combinedSignals.includes('basket') || combinedSignals.includes('bag')) {
            role = 'Cart';
            name = 'Cart';
          } else if (combinedSignals.includes('checkout') || combinedSignals.includes('payment') || combinedSignals.includes('billing')) {
            role = 'Checkout';
            name = 'Checkout';
          } else if (combinedSignals.includes('wishlist') || combinedSignals.includes('favorite') || combinedSignals.includes('favourite')) {
            role = 'Wishlist';
            name = 'Wishlist';
          } else if (combinedSignals.includes('about') || combinedSignals.includes('company') || combinedSignals.includes('story')) {
            role = 'About';
            name = 'About';
          } else if (combinedSignals.includes('contact') || combinedSignals.includes('touch')) {
            role = 'Contact';
            name = 'Contact';
          } else if (combinedSignals.includes('terms') || combinedSignals.includes('conditions')) {
            role = 'Terms';
            name = 'Terms';
          } else if (combinedSignals.includes('privacy')) {
            role = 'Privacy';
            name = 'Privacy';
          }
          
          // Content-based fallback if role is still Other
          if (role === 'Other') {
              if (lowerHtml.includes('billing address') && lowerHtml.includes('payment') && lowerHtml.includes('<form')) {
                  role = 'Checkout';
                  name = 'Checkout';
              } else if (lowerHtml.includes('quantity') && lowerHtml.includes('price') && lowerHtml.includes('total') && (lowerHtml.includes('<table') || lowerHtml.includes('cart'))) {
                  role = 'Cart';
                  name = 'Cart';
              } else if (lowerHtml.includes('add to cart') && lowerHtml.includes('price') && lowerHtml.includes('<img')) {
                  // Heuristic for product detail vs listing: if there's a big add to cart but only one main product area
                  if(lowerHtml.split('add to cart').length < 3) {
                      role = 'Product Detail';
                      name = 'Product Detail';
                  } else {
                      role = 'Shop';
                      name = 'Shop';
                  }
              }
          }

          pages[relativePath] = {
            id: relativePath,
            path: relativePath,
            fileName: fileName,
            name: name,
            role: role,
            html: sanitizedContent,
            css: '',
            mapping: {},
            metadata: {}
          };
        })
      );
    } else {
      // Store asset
      const isText = relativePath.endsWith('.css') || relativePath.endsWith('.js') || relativePath.endsWith('.json') || relativePath.endsWith('.svg');
      filePromises.push(
        zipEntry.async(isText ? 'string' : 'base64').then(content => {
          assets[relativePath] = {
            type: isText ? 'text' : 'base64',
            content: content,
            ext: relativePath.split('.').pop().toLowerCase()
          };
        })
      );
    }
  });

  await Promise.all(filePromises);
  return { pages, assets };
};

export const resolveAssetUrls = (html, assets) => {
  if (!html && !assets) return html;
  
  // Create a deep copy of assets so we can mutate the CSS content
  const processedAssets = JSON.parse(JSON.stringify(assets));
  const assetPaths = Object.keys(processedAssets).sort((a, b) => b.length - a.length);

  const getReplacement = (asset) => {
    if (asset.ext === 'js') return '#';
    if (asset.type === 'text') {
      // Base64 encode text assets to avoid any URI parsing issues
      if (asset.ext === 'css') return `data:text/css;base64,${btoa(unescape(encodeURIComponent(asset.content)))}`;
      if (asset.ext === 'svg') return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(asset.content)))}`;
      if (asset.ext === 'json') return `data:application/json;base64,${btoa(unescape(encodeURIComponent(asset.content)))}`;
    }
    let mime = asset.ext;
    if (asset.ext === 'jpg') mime = 'jpeg';
    if (['woff', 'woff2', 'ttf', 'otf'].includes(asset.ext)) mime = `font/${asset.ext}`;
    else if (['mp4', 'webm'].includes(asset.ext)) mime = `video/${asset.ext}`;
    else mime = `image/${mime}`;
    return `data:${mime};base64,${asset.content}`;
  };

  // Pre-process CSS files to resolve URLs inside them
  assetPaths.forEach(cssPath => {
    if (processedAssets[cssPath].ext === 'css') {
      let cssContent = processedAssets[cssPath].content;
      assetPaths.forEach(assetPath => {
        if (assetPath === cssPath) return; // don't self-replace
        const asset = processedAssets[assetPath];
        const replacement = getReplacement(asset);
        if (replacement && replacement !== '#') {
          const escapedPath = assetPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          // Match url(...) with optional quotes and spaces, and any suffix like ?#
          const regex = new RegExp(`url\\(\\s*['"]?([^'"]*?)(${escapedPath})([^'"]*)['"]?\\s*\\)`, 'gi');
          cssContent = cssContent.replace(regex, `url("${replacement}")`);
        }
      });
      processedAssets[cssPath].content = cssContent;
    }
  });

  if (!html) return html;
  let resolvedHtml = html;

  assetPaths.forEach(assetPath => {
    const asset = processedAssets[assetPath];
    const replacement = getReplacement(asset);
    
    if (replacement && replacement !== '#') {
      const escapedPath = assetPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      
      const regexPatterns = [
        new RegExp(`src\\s*=\\s*['"]([^'"]*?)(${escapedPath})([^'"]*)['"]`, 'gi'),
        new RegExp(`href\\s*=\\s*['"]([^'"]*?)(${escapedPath})([^'"]*)['"]`, 'gi'),
        new RegExp(`url\\(\\s*['"]?([^'"]*?)(${escapedPath})([^'"]*)['"]?\\s*\\)`, 'gi'),
        new RegExp(`srcset\\s*=\\s*['"]([^'"]*?)(${escapedPath})([^'"]*)['"]`, 'gi')
      ];

      regexPatterns.forEach(regex => {
        resolvedHtml = resolvedHtml.replace(regex, (match, prefix, path, suffix) => {
          const lowerMatch = match.toLowerCase();
          if (lowerMatch.startsWith('src')) return `src="${replacement}"`;
          if (lowerMatch.startsWith('href')) return `href="${replacement}"`;
          if (lowerMatch.startsWith('url')) return `url("${replacement}")`;
          if (lowerMatch.startsWith('srcset')) return `srcset="${replacement}"`; // drop suffix for srcset in MVP
          return match;
        });
      });
    } else if (replacement === '#') {
      // Neutralize JS
      const escapedPath = assetPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const jsRegex = new RegExp(`src\\s*=\\s*['"]([^'"]*?)(${escapedPath})([^'"]*)['"]`, 'gi');
      resolvedHtml = resolvedHtml.replace(jsRegex, `src="#"`);
    }
  });

  return resolvedHtml;
};
