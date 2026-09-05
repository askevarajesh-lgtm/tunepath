import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveAssetUrls } from '../../utils/zipExtractor';
import { useStorefront } from '../StorefrontContext';

const StorefrontPage = ({ page, assets, children, portalSelector }) => {
  const containerRef = useRef(null);
  const [portalTarget, setPortalTarget] = useState(null);
  const { cart } = useStorefront();

  useEffect(() => {
    if (!page || !containerRef.current) return;
    
    // Resolve assets: for imported templates, HTML is already self-contained (data URIs embedded).
    // For built-in templates, this substitutes relative paths with data URIs from the assets map.
    const html = (assets && Object.keys(assets).length > 0)
      ? resolveAssetUrls(page.html, assets)
      : (page.html || '');
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove common preloaders since stripped JS won't hide them automatically
    const preloaders = doc.querySelectorAll('#preloader, .preloader, #loader, .loader, #spinner, .spinner, .preloading');
    preloaders.forEach(el => el.remove());
    
    // If we have a specific portal target, find it and mark it
    let targetEl = portalSelector ? doc.querySelector(portalSelector) : null;
    
    // Fallback: If grid was not found, but a card was mapped, try to use the card's parent as the grid
    if (!targetEl && page.mapping?.productCard) {
      const cardEl = doc.querySelector(page.mapping.productCard);
      if (cardEl) {
        let current = cardEl;
        let levels = 0;
        // Traverse up to find the column wrapper. Stop when parent has multiple children or is a known grid wrapper.
        // NEVER traverse into BODY or HTML.
        while (
          current.parentElement && 
          current.parentElement.tagName !== 'BODY' &&
          current.parentElement.tagName !== 'HTML' &&
          current.parentElement.children.length === 1 && 
          (!current.parentElement.className || (typeof current.parentElement.className === 'string' && !current.parentElement.className.includes('row') && !current.parentElement.className.includes('grid'))) &&
          levels < 3
        ) {
          current = current.parentElement;
          levels++;
        }
        // The parent of the column wrapper is the grid container!
        targetEl = current.parentElement;
        
        // Safety check: Never wipe the entire body or html
        if (!targetEl || targetEl.tagName === 'BODY' || targetEl.tagName === 'HTML') {
          targetEl = current;
        }
      }
    }
    
    if (targetEl) {
      targetEl.innerHTML = '';
      targetEl.setAttribute('id', 'storefront-react-portal');
    }
    
    // Inject the HTML
    containerRef.current.innerHTML = doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML;
    
    if (targetEl) {
      const mountedTarget = containerRef.current.querySelector('#storefront-react-portal');
      setPortalTarget(mountedTarget);
    }
    
    // Inject CSS globally to ensure it applies
    const existingStyles = document.getElementById('storefront-template-styles');
    if (existingStyles) existingStyles.remove();
    
    const styleContainer = document.createElement('div');
    styleContainer.id = 'storefront-template-styles';
    
    // Extract all link tags (stylesheets, fonts, etc.)
    const links = doc.querySelectorAll('link');
    links.forEach(link => {
       const href = link.getAttribute('href');
       
       // Convert data URI stylesheets directly into <style> tags to avoid CSP issues or loading delays
       if (link.getAttribute('rel') === 'stylesheet' && href && href.startsWith('data:text/css;base64,')) {
           try {
               const base64 = href.split(',')[1];
               const cssText = decodeURIComponent(escape(atob(base64)));
               const newStyle = document.createElement('style');
               newStyle.innerHTML = cssText;
               styleContainer.appendChild(newStyle);
           } catch (e) {
               console.error('Failed to decode CSS data URI', e);
           }
       } else {
           const newLink = document.createElement('link');
           Array.from(link.attributes).forEach(attr => {
               newLink.setAttribute(attr.name, attr.value);
           });
           if (href) {
               newLink.href = href; 
           }
           styleContainer.appendChild(newLink);
       }
       link.remove();
    });
    
    const styleTags = doc.querySelectorAll('style');
    styleTags.forEach(style => {
       const newStyle = document.createElement('style');
       newStyle.innerHTML = style.innerHTML;
       styleContainer.appendChild(newStyle);
       style.remove();
    });
    
    if (page.css) {
       const customStyle = document.createElement('style');
       customStyle.innerHTML = page.css;
       styleContainer.appendChild(customStyle);
    }
    
    document.head.appendChild(styleContainer);
    
    return () => {
      const el = document.getElementById('storefront-template-styles');
      if (el) el.remove();
    };
  }, [page, assets, portalSelector]);

  // Handle internal navigation clicks (just like original preview did)
  useEffect(() => {
    const handleClick = (e) => {
      // Find the closest actionable element
      const actionable = e.target.closest('a, button, [role="button"], [data-cart], [class*="cart"], [id*="cart"]');
      
      if (!actionable) return;
      
      const text = (actionable.textContent || '').toLowerCase().trim();
      // Let Add to Cart buttons be handled by their respective click handlers (e.g., ProductCard)
      if (text.includes('add to cart') || actionable.closest('[data-ecommerce-action="add-to-cart"]')) {
        return;
      }

      const href = actionable.getAttribute('href') || '';
      const className = (actionable.className || '').toString().toLowerCase();
      const id = (actionable.id || '').toLowerCase();
      
      const isCartUrl = [
        'cart.html', './cart.html', '/cart.html', '#cart', 
        'cart', 'shopping-cart', 'shopping_cart', 'basket', '#shopping-cart'
      ].includes(href.toLowerCase());

      const cartKeywords = ['cart', 'shopping-cart', 'shopping_cart', 'basket', 'view cart', 'cart icon', 'shopping bag'];
      const hasCartClassOrId = cartKeywords.some(kw => className.includes(kw) || id.includes(kw));
      const hasCartText = cartKeywords.some(kw => text === kw);
      
      // If it looks like a cart click, dispatch navigation
      if (isCartUrl || hasCartClassOrId || hasCartText) {
         e.preventDefault();
         e.stopPropagation();
         window.dispatchEvent(new CustomEvent('storefront_navigate', { detail: 'cart' }));
         return;
      }

      // Check for checkout clicks
      const hrefLower = href.toLowerCase();
      const isCheckoutUrl = [
        'checkout.html', './checkout.html', '/checkout.html', '#checkout', 
        'checkout', 'cheackout.html', 'chackout.html'
      ].includes(hrefLower) || hrefLower.includes('checkout') || hrefLower.includes('cheackout') || hrefLower.includes('chackout');
      const hasCheckoutText = text === 'checkout';

      if (isCheckoutUrl || hasCheckoutText) {
         e.preventDefault();
         e.stopPropagation();
         window.dispatchEvent(new CustomEvent('storefront_navigate', { detail: 'checkout' }));
         return;
      }
      
      // Fallback for regular links
      if (actionable.tagName === 'A') {
        if (href && !href.startsWith('http') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('storefront_navigate', { detail: href }));
        }
      }
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('click', handleClick);
    }
    return () => {
      if (container) {
        container.removeEventListener('click', handleClick);
      }
    };
  }, []);

  // Sync Cart Badge
  useEffect(() => {
    if (!containerRef.current) return;
    const cartLinks = containerRef.current.querySelectorAll('a[href*="cart"], a[data-commerce-action="cart"]');
    const totalQuantity = cart.reduce((acc, item) => acc + item.quantity, 0);
    
    cartLinks.forEach(link => {
      let badge = link.querySelector('.storefront-cart-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'storefront-cart-badge';
        badge.style.cssText = 'background: #ef4444; color: white; border-radius: 50%; padding: 2px 6px; font-size: 11px; margin-left: 6px; vertical-align: top; display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; font-weight: bold;';
        link.appendChild(badge);
      }
      badge.textContent = totalQuantity;
      badge.style.display = totalQuantity > 0 ? 'inline-flex' : 'none';
    });
  }, [cart]);

  return (
    <>
      <div ref={containerRef} className="storefront-page-wrapper" />
      {portalTarget && children ? createPortal(children, portalTarget) : null}
      {!portalTarget && children}
    </>
  );
};

export default StorefrontPage;
