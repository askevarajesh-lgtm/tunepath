import { useState, useCallback } from 'react';
import { message } from 'antd';
import { processZipFile, resolveAssetUrls } from '../../utils/zipExtractor';
import { analyzePageSemantics } from '../../utils/analyzer';
import api from '../../../../../services/api';

export const useTemplateImport = (websiteId) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [templateMeta, setTemplateMeta] = useState({ name: '', category: 'Fashion' });
  const [pages, setPages] = useState({});
  const [assets, setAssets] = useState({});
  const [analysisResults, setAnalysisResults] = useState({});
  const [previewPage, setPreviewPage] = useState(null);
  
  const handleZipUpload = async (uploadedFile) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    if (!templateMeta.name) {
        setTemplateMeta(prev => ({...prev, name: uploadedFile.name.replace('.zip', '')}));
    }
  };
  
  const processUpload = async () => {
    if (!file) return message.error('Please upload a ZIP file first.');
    if (!templateMeta.name) return message.error('Please provide a template name.');
    
    setLoading(true);
    try {
      const extracted = await processZipFile(file);
      if (Object.keys(extracted.pages).length === 0) {
        throw new Error('No HTML pages found in the ZIP.');
      }
      setPages(extracted.pages);
      setAssets(extracted.assets);
      setCurrentStep(1); // Move to Page Discovery
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Failed to extract ZIP.');
    } finally {
      setLoading(false);
    }
  };
  
  const updatePageRole = (path, newRole) => {
      setPages(prev => ({
          ...prev,
          [path]: { ...prev[path], role: newRole }
      }));
  };
  
  const runAnalysis = async () => {
      setLoading(true);
      try {
          const results = {};
          for (const path in pages) {
              const page = pages[path];
              // Only run full analysis on commerce pages or home
              if (['Home', 'Shop', 'Product Detail', 'Cart', 'Checkout', 'Other'].includes(page.role)) {
                  results[path] = analyzePageSemantics(page.html);
              }
          }
          setAnalysisResults(results);
          setCurrentStep(2);
      } catch (err) {
          console.error(err);
          message.error('Analysis failed.');
      } finally {
          setLoading(false);
      }
  };
  
  const updateSelector = (path, category, field, value) => {
      setAnalysisResults(prev => ({
          ...prev,
          [path]: {
              ...prev[path],
              [category]: {
                  ...prev[path][category],
                  [field]: value
              }
          }
      }));
  };
  
  const generateCommerceBindings = () => {
      const boundPages = {};
      
      for (const path in pages) {
          const page = pages[path];
          let html = page.html;
          const analysis = analysisResults[path];
          
          if (analysis) {
              const parser = new DOMParser();
              const doc = parser.parseFromString(html, 'text/html');
              
              // Apply product bindings
              if (analysis.product.container) {
                  const els = doc.querySelectorAll(analysis.product.container);
                  els.forEach(el => el.setAttribute('data-commerce', 'product-card'));
              }
              if (analysis.product.image) {
                  const els = doc.querySelectorAll(analysis.product.image);
                  els.forEach(el => el.setAttribute('data-commerce-field', 'image'));
              }
              if (analysis.product.title) {
                  const els = doc.querySelectorAll(analysis.product.title);
                  els.forEach(el => el.setAttribute('data-commerce-field', 'name'));
              }
              if (analysis.product.price) {
                  const els = doc.querySelectorAll(analysis.product.price);
                  els.forEach(el => el.setAttribute('data-commerce-field', 'price'));
              }
              if (analysis.product.addBtn) {
                  const els = doc.querySelectorAll(analysis.product.addBtn);
                  els.forEach(el => el.setAttribute('data-commerce-action', 'add-to-cart'));
              }
              
              // Apply cart bindings
              if (analysis.cart.container) {
                  const els = doc.querySelectorAll(analysis.cart.container);
                  els.forEach(el => el.setAttribute('data-commerce', 'cart'));
              }
              
              // Apply checkout bindings
              if (analysis.checkout.form) {
                  const els = doc.querySelectorAll(analysis.checkout.form);
                  els.forEach(el => el.setAttribute('data-commerce', 'checkout'));
              }
              
              html = doc.documentElement.outerHTML;
          }
          
          boundPages[path] = { ...page, html };
      }
      
      return boundPages;
  };
  
  const preparePreview = () => {
      const homePage = Object.values(pages).find(p => p.role === 'Home') || Object.values(pages)[0];
      setPreviewPage(homePage.path);
      setCurrentStep(3);
  };
  
  const getPreviewHtml = (path) => {
      if (!pages[path]) return '';
      // We don't use the bound html for preview yet as bindings might alter some generic styles
      return resolveAssetUrls(pages[path].html, assets);
  };
  
  const importToCatalog = async () => {
      setLoading(true);
      try {
          const boundPages = generateCommerceBindings();
          
          // CRITICAL FIX: Pre-resolve all assets (images, fonts, etc.) into data URIs
          // BEFORE sending to backend. This makes each page's HTML self-contained,
          // ensuring Import Preview === Store Preview (both render from the same resolved HTML).
          //
          // Previously: raw HTML with relative paths was stored, then assets (with binary stripped)
          // were sent separately. StorefrontPage tried to re-resolve but binary content was gone,
          // causing all images/fonts to break in Store Preview.
          const resolvedPages = {};
          for (const path in boundPages) {
              const page = boundPages[path];
              const resolvedHtml = resolveAssetUrls(page.html, assets);
              resolvedPages[path] = { ...page, html: resolvedHtml };
          }
          
          // Only send text assets (CSS) to backend — they are needed by StorefrontPage
          // for the page.css field injection. Binary assets are now embedded in HTML.
          const safeAssets = {};
          
          const payload = {
              templateId: `import-${templateMeta.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`,
              name: templateMeta.name,
              category: templateMeta.category,
              pages: resolvedPages,
              assets: safeAssets,
              commerceBindings: analysisResults,
              metadata: {
                  importedFrom: 'zip-upload',
                  analyzerVersion: '2.0'
              }
          };
          
          const res = await api.post(`/ecommerce/${websiteId}/catalog/import`, payload);
          
          if (res.data.success) {
              message.success('Template imported to catalog successfully!');
              return true;
          } else {
              throw new Error(res.data.message || 'Import failed');
          }
      } catch (err) {
          console.error(err);
          message.error(err.message || 'Import to catalog failed.');
          return false;
      } finally {
          setLoading(false);
      }
  };

  return {
    currentStep, setCurrentStep,
    loading, file, templateMeta, setTemplateMeta,
    pages, assets, analysisResults, previewPage, setPreviewPage,
    handleZipUpload, processUpload, updatePageRole, runAnalysis, updateSelector, preparePreview, getPreviewHtml, importToCatalog
  };
};
