import React, { useMemo } from 'react';
import { useStorefront } from '../StorefrontContext';
import ProductCard from './ProductCard';

const ProductGrid = ({ mapping, html, items }) => {
  const { products: storeProducts } = useStorefront();
  const displayItems = items || storeProducts;

  // Parse the template HTML once to extract the card template
  const cardTemplateHtml = useMemo(() => {
    let templateStr = '<div></div>'; // fallback
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Prioritize explicit data-commerce binding
    let cardEl = doc.querySelector('[data-commerce="product-card"]');
    
    // Fallback to legacy mapping
    if (!cardEl && mapping?.productCard) {
      cardEl = doc.querySelector(mapping.productCard);
    }
      if (cardEl) {
        let rootCard = cardEl;
        let levels = 0;
        // Traverse up to find the true grid column wrapper (stops when parent has multiple columns/children)
        while (
          rootCard.parentElement && 
          rootCard.parentElement.tagName !== 'BODY' &&
          rootCard.parentElement.tagName !== 'HTML' &&
          rootCard.parentElement.children.length === 1 && 
          levels < 4
        ) {
          rootCard = rootCard.parentElement;
          levels++;
        }
        templateStr = rootCard.outerHTML;
      }

    return templateStr;
  }, [html, mapping]);

  if (!displayItems || displayItems.length === 0) {
    return (
      <div style={{ 
        gridColumn: '1 / -1', 
        padding: '60px 20px', 
        textAlign: 'center', 
        background: 'rgba(0,0,0,0.02)', 
        borderRadius: '8px', 
        border: '1px dashed rgba(0,0,0,0.1)',
        width: '100%',
        margin: '20px 0'
      }}>
        <h3 style={{ margin: '0 0 10px 0', opacity: 0.8 }}>No products available yet</h3>
        <p style={{ margin: 0, opacity: 0.6 }}>Check back later or browse other categories.</p>
      </div>
    );
  }

  // We return a Fragment here. 
  // StorefrontPage creates a Portal that injects these children directly into the 
  // template's grid container. This preserves the template's original grid layout CSS.
  return (
    <>
      {displayItems.map(product => (
        <ProductCard 
          key={product.id || product._id} 
          product={product} 
          templateHtml={cardTemplateHtml} 
          mapping={mapping} 
        />
      ))}
    </>
  );
};

export default ProductGrid;
