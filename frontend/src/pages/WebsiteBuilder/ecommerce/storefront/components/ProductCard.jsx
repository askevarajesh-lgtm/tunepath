import React, { useEffect, useRef, useMemo } from 'react';
import { message } from 'antd';
import { useStorefront } from '../StorefrontContext';
import { formatCurrency } from '../../utils/currency';

const ProductCard = ({ product, templateHtml, mapping }) => {
  const { addToCart, addToWishlist, navigateTo, workspaceId, websiteId, storeId } = useStorefront();
  const containerRef = useRef(null);

  // Parse template and inject product data into the original DOM structure
  const processedHtml = useMemo(() => {
    if (!templateHtml) return '';
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(templateHtml, 'text/html');
    const cardEl = doc.body.firstElementChild;
    if (!cardEl) return '';

    // Inject Image
    const explicitImgEls = Array.from(cardEl.querySelectorAll('[data-commerce-field="image"]'));
    const imgEls = Array.from(cardEl.querySelectorAll('img'));
    let mappedEls = [];
    if (mapping?.productImage) {
      mappedEls = Array.from(cardEl.querySelectorAll(mapping.productImage));
    }
    
    // Use a Set to ensure unique elements. Prioritize explicit bindings.
    const allImageTargets = new Set([...explicitImgEls, ...imgEls, ...mappedEls]);
    
    allImageTargets.forEach(el => {
      if (product.image) {
        if (el.tagName === 'IMG') {
          el.src = product.image;
          el.alt = product.name || 'Product';
          el.removeAttribute('srcset'); // Clear lazy load sets
          el.removeAttribute('data-src'); 
          
          // Enforce consistent image sizing so cards align perfectly in the grid
          el.style.width = '100%';
          el.style.aspectRatio = '1 / 1';
          el.style.objectFit = 'cover';
        } else {
          el.style.backgroundImage = `url(${product.image})`;
          el.style.backgroundSize = 'cover';
          el.style.backgroundPosition = 'center';
          el.style.width = '100%';
          el.style.aspectRatio = '1 / 1';
        }
      }
    });

    // Inject Name
    let nameEls = Array.from(cardEl.querySelectorAll('[data-commerce-field="name"]'));
    if (nameEls.length === 0 && mapping?.productName) nameEls = Array.from(cardEl.querySelectorAll(mapping.productName));
    if (nameEls.length === 0) nameEls = Array.from(cardEl.querySelectorAll('h1, h2, h3, h4, h5, h6, .title, .name'));
    
    nameEls.forEach(el => {
      el.textContent = product.name;
      // Enforce consistent text height (truncate at 2 lines)
      el.style.display = '-webkit-box';
      el.style.webkitLineClamp = '2';
      el.style.webkitBoxOrient = 'vertical';
      el.style.overflow = 'hidden';
      el.style.textOverflow = 'ellipsis';
      // Ensure min-height so 1-line text takes the same space as 2-line text if needed? 
      // Usually flexbox handles that, but clamping is enough for most templates.
    });

    // Inject Price
    let priceEls = Array.from(cardEl.querySelectorAll('[data-commerce-field="price"]'));
    if (priceEls.length === 0 && mapping?.productPrice) priceEls = Array.from(cardEl.querySelectorAll(mapping.productPrice));
    if (priceEls.length === 0) priceEls = Array.from(cardEl.querySelectorAll('.price, .amount'));
    
    const displayPrice = product.salePrice ? product.salePrice : product.price;
    priceEls.forEach(el => {
      el.textContent = formatCurrency(displayPrice, workspaceId, websiteId, storeId);
    });

    // Adjust Add to Cart button if out of stock
    let addBtnEls = Array.from(cardEl.querySelectorAll('[data-commerce-action="add-to-cart"]'));
    if (addBtnEls.length === 0 && mapping?.addBtn) {
      addBtnEls = Array.from(cardEl.querySelectorAll(mapping.addBtn));
    }
    
    // Auto-detect if mapping is missing or failed to find the button
    if (addBtnEls.length === 0) {
      addBtnEls = Array.from(cardEl.querySelectorAll('button, a, [role="button"], li')).filter(el => {
        const text = (el.textContent || '').toLowerCase().trim();
        const className = (el.className || '').toString().toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();
        const html = el.innerHTML.toLowerCase();
        
        return text.includes('add to cart') || 
               text.includes('add to bag') ||
               className.includes('add-to-cart') || 
               className.includes('add_to_cart') ||
               className.includes('btn-cart') ||
               href.includes('add-to-cart') ||
               title.includes('add to cart') ||
               html.includes('cart') || 
               html.includes('shopping-bag') || 
               html.includes('basket') || 
               html.includes('fa-shopping-cart') ||
               html.includes('fa-cart-plus') ||
               html.includes('ion-bag');
      });
    }

    addBtnEls.forEach(el => {
      // Tag it so we can find it easily for event binding
      el.setAttribute('data-ecommerce-action', 'add-to-cart');
      if (product.stock <= 0) {
        if (el.children.length === 0) {
          el.textContent = 'Out of Stock';
        }
        el.style.opacity = '0.5';
        el.style.cursor = 'not-allowed';
        if (el.tagName === 'BUTTON') el.disabled = true;
      }
    });

    // Tag the card itself for navigation
    cardEl.setAttribute('data-ecommerce-action', 'view-product');

    return cardEl.outerHTML;
  }, [templateHtml, mapping, product, workspaceId, websiteId, storeId]);

  // Bind native event listeners to the injected HTML
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e) => {
      // Check if clicked element or its parent is the Add to Cart button
      const addBtn = e.target.closest('[data-ecommerce-action="add-to-cart"], [data-commerce-action="add-to-cart"]');
      if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (product.stock > 0) {
          addToCart(product);
          message.success(`${product.name} added to cart`);
        } else {
          message.warning(`${product.name} is out of stock`);
        }
        return;
      }

      const wishlistBtn = e.target.closest('[data-ecommerce-action="add-to-wishlist"], [data-commerce-action="add-to-wishlist"]');
      if (wishlistBtn) {
        e.preventDefault();
        e.stopPropagation();
        addToWishlist(product);
        message.success(`${product.name} added to wishlist`);
        return;
      }

      // Check if clicked element or its parent is the product card link
      const viewBtn = e.target.closest('[data-ecommerce-action="view-product"]');
      if (viewBtn) {
        e.preventDefault();
        e.stopPropagation();
        navigateTo(null, product.id || product._id);
      }
    };

    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [product, addToCart, navigateTo]);

  if (!processedHtml) return null;

  return (
    <div 
      ref={containerRef}
      style={{ display: 'contents' }} 
      dangerouslySetInnerHTML={{ __html: processedHtml }} 
    />
  );
};

export default ProductCard;
