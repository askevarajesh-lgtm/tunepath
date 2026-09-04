import React, { createContext, useContext, useState, useEffect } from 'react';
import { getTemplates, getProducts, getSettings, getCart, saveCart, clearCartStorage } from '../utils/storage';
import { useEcommerce } from '../contexts/EcommerceContext';

const StorefrontContext = createContext();

export const StorefrontProvider = ({ children, templateId }) => {
  const { workspaceId, websiteId } = useEcommerce();
  const [template, setTemplate] = useState(null);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [cart, setCart] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [currentPageId, setCurrentPageId] = useState(() => {
    return sessionStorage.getItem(`storefront_page_${workspaceId}_${websiteId}_${templateId}`) || '';
  });
  const [selectedProductId, setSelectedProductId] = useState(() => {
    return sessionStorage.getItem(`storefront_product_${workspaceId}_${websiteId}_${templateId}`) || null;
  });

  useEffect(() => {
    if (currentPageId) sessionStorage.setItem(`storefront_page_${workspaceId}_${websiteId}_${templateId}`, currentPageId);
    if (selectedProductId) sessionStorage.setItem(`storefront_product_${workspaceId}_${websiteId}_${templateId}`, selectedProductId);
  }, [currentPageId, selectedProductId, workspaceId, websiteId, templateId]);

  useEffect(() => {
    if (!workspaceId || !websiteId || !templateId) return;

    const loadStore = async () => {
      const templates = await getTemplates(workspaceId, websiteId);
      const activeTemplate = templates[templateId];

      if (activeTemplate && activeTemplate.pages && !sessionStorage.getItem(`storefront_page_${workspaceId}_${websiteId}_${templateId}`)) {
        setTemplate(activeTemplate);
        setTemplate(activeTemplate);
        
        // 1. Check URL query params for ?page=
        const queryParams = new URLSearchParams(window.location.search);
        const urlPageId = queryParams.get('page');
        
        let startPage = null;
        
        if (urlPageId) {
          // Case-insensitive match against page roles/names/ids
          const lowerUrlId = urlPageId.toLowerCase();
          startPage = Object.keys(activeTemplate.pages).find(k => {
            const p = activeTemplate.pages[k];
            return (p.id && p.id.toLowerCase() === lowerUrlId) ||
                   (p.role && p.role.toLowerCase() === lowerUrlId) ||
                   (p.name && p.name.toLowerCase() === lowerUrlId);
          });
        }
        
        // 2. Fallback to session storage if valid
        if (!startPage && sessionStorage.getItem(`storefront_page_${workspaceId}_${websiteId}_${templateId}`)) {
           const cachedPageId = sessionStorage.getItem(`storefront_page_${workspaceId}_${websiteId}_${templateId}`);
           if (activeTemplate.pages[cachedPageId]) {
             startPage = cachedPageId;
           }
        }
        
        // 3. Fallback to Home/Index
        if (!startPage) {
          startPage = Object.keys(activeTemplate.pages).find(k => k.toLowerCase().includes('index')) || Object.keys(activeTemplate.pages)[0];
        }
        
        setCurrentPageId(startPage || '');
      } else if (activeTemplate) {
        setTemplate(activeTemplate);
      }

      // Load products for this specific store
      const storeProducts = await getProducts(workspaceId, websiteId, templateId);
      setProducts(storeProducts.filter(p => p.status === 'Active'));

      // Load settings for this specific store
      const storeSettings = await getSettings(workspaceId, websiteId, templateId);
      setSettings(storeSettings);

      // Load cart for this specific store
      const savedCart = getCart(workspaceId, websiteId, templateId);
      setCart(savedCart || []);
      
      // Load wishlist
      const savedWishlist = JSON.parse(localStorage.getItem(`ecommerce_${workspaceId}_${websiteId}_${templateId}_wishlist`)) || [];
      setWishlist(savedWishlist);
    };

    loadStore();
  }, [templateId, workspaceId, websiteId]);

  const addToCart = (product, quantity = 1) => {
    setCart(prev => {
      let newCart;
      const pid = product.id || product._id;
      const existing = prev.find(item => item.id === pid);
      if (existing) {
        if (existing.quantity + quantity > product.stock) {
          return prev; // Not enough stock (caller UI should warn)
        }
        newCart = prev.map(item => item.id === pid ? { ...item, quantity: item.quantity + quantity } : item);
      } else {
        if (product.stock < quantity) return prev;
        newCart = [...prev, { ...product, id: pid, quantity }];
      }
      saveCart(workspaceId, websiteId, templateId, newCart);
      return newCart;
    });
  };

  const removeFromCart = (productId) => {
    setCart(prev => {
      const newCart = prev.filter(item => item.id !== productId);
      saveCart(workspaceId, websiteId, templateId, newCart);
      return newCart;
    });
  };

  const updateQty = (productId, quantity) => {
    setCart(prev => {
      const product = products.find(p => p.id === productId);
      if (!product || quantity > product.stock) {
        return prev; // Prevent exceeding stock
      }
      const newCart = prev.map(item => item.id === productId ? { ...item, quantity } : item);
      saveCart(workspaceId, websiteId, templateId, newCart);
      return newCart;
    });
  };

  const clearCart = () => {
    setCart([]);
    clearCartStorage(workspaceId, websiteId, templateId);
  };

  const addToWishlist = (product) => {
    setWishlist(prev => {
      const pid = product.id || product._id;
      if (prev.find(item => (item.id || item._id) === pid)) return prev;
      const newWishlist = [...prev, product];
      localStorage.setItem(`ecommerce_${workspaceId}_${websiteId}_${templateId}_wishlist`, JSON.stringify(newWishlist));
      return newWishlist;
    });
  };

  const removeFromWishlist = (productId) => {
    setWishlist(prev => {
      const newWishlist = prev.filter(item => (item.id || item._id) !== productId);
      localStorage.setItem(`ecommerce_${workspaceId}_${websiteId}_${templateId}_wishlist`, JSON.stringify(newWishlist));
      return newWishlist;
    });
  };

  const navigateTo = (pageId, productId = null) => {
    let targetPageId = pageId;

    if (!pageId && productId && template?.pages) {
      // Find the product detail page if pageId is null
      const detailPageKey = Object.keys(template.pages).find(k => template.pages[k].role === 'Product Detail');
      if (detailPageKey) {
        targetPageId = detailPageKey;
      }
    }

    if (template?.pages?.[targetPageId]) {
      setCurrentPageId(targetPageId);
    }
    
    if (productId) {
      setSelectedProductId(productId);
    } else {
      setSelectedProductId(null);
    }
  };

  return (
    <StorefrontContext.Provider value={{
      template,
      products,
      settings,
      cart,
      addToCart,
      removeFromCart,
      updateQty,
      clearCart,
      wishlist,
      addToWishlist,
      removeFromWishlist,
      currentPageId,
      navigateTo,
      selectedProductId,
      setSelectedProductId,
      workspaceId,
      websiteId,
      storeId: templateId
    }}>
      {children}
    </StorefrontContext.Provider>
  );
};

export const useStorefront = () => useContext(StorefrontContext);
