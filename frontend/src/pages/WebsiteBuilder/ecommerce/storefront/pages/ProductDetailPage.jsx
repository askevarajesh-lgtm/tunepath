import React, { useState } from 'react';
import { message } from 'antd';
import StorefrontPage from './StorefrontPage';
import { useStorefront } from '../StorefrontContext';
import { formatCurrency } from '../../utils/currency';

const ProductDetailPage = () => {
  const { template, currentPageId, selectedProductId, products, addToCart, workspaceId, websiteId, storeId } = useStorefront();
  const page = template?.pages?.[currentPageId];
  const [qty, setQty] = useState(1);
  
  if (!page || !selectedProductId) return null;
  
  const product = products.find(p => p.id === selectedProductId);
  if (!product) return (
    <div style={{ padding: 40, textAlign: 'center' }}>Product not found.</div>
  );

  const modifiedPage = { ...page };
  
  // Create a copy of the HTML with the product data injected
  const parser = new DOMParser();
  const doc = parser.parseFromString(page.html, 'text/html');
  
  if (page.mapping) {
    // Legacy support for page.mapping if present
    const { productImage, productName, productPrice, addBtn } = page.mapping;
    if (productImage) {
      const imgEls = doc.querySelectorAll(productImage);
      imgEls.forEach(img => {
        if (img.tagName === 'IMG') {
          img.src = product.image || '';
          img.alt = product.name;
        } else {
          img.style.backgroundImage = `url(${product.image || ''})`;
        }
      });
    }
    if (productName) {
      const nameEls = doc.querySelectorAll(productName);
      nameEls.forEach(el => el.textContent = product.name);
    }
    if (productPrice) {
      const priceEls = doc.querySelectorAll(productPrice);
      const displayPrice = product.salePrice ? product.salePrice : product.price;
      priceEls.forEach(el => el.textContent = formatCurrency(displayPrice, workspaceId, websiteId, storeId));
    }
    if (addBtn) {
      const btnEls = doc.querySelectorAll(addBtn);
      btnEls.forEach(btn => {
        btn.setAttribute('id', 'storefront-react-add-btn');
        btn.innerHTML = ''; // We will portal the button here
      });
    }
  }

  // Modern Explicit Bindings
  const explicitImageEls = doc.querySelectorAll('[data-commerce-field="image"]');
  explicitImageEls.forEach(img => {
    if (img.tagName === 'IMG') {
      img.src = product.image || '';
      img.alt = product.name;
    } else {
      img.style.backgroundImage = `url(${product.image || ''})`;
    }
  });

  const explicitNameEls = doc.querySelectorAll('[data-commerce-field="name"]');
  explicitNameEls.forEach(el => el.textContent = product.name);

  const explicitPriceEls = doc.querySelectorAll('[data-commerce-field="price"]');
  const displayPrice = product.salePrice ? product.salePrice : product.price;
  explicitPriceEls.forEach(el => el.textContent = formatCurrency(displayPrice, workspaceId, websiteId, storeId));

  const explicitDescEls = doc.querySelectorAll('[data-commerce-field="description"], .product-description, #description');
  if (explicitDescEls.length > 0 && product.description) {
    explicitDescEls.forEach(el => el.textContent = product.description);
  }

  const explicitBtnEls = doc.querySelectorAll('[data-commerce-action="add-to-cart"]');
  explicitBtnEls.forEach(btn => {
    btn.setAttribute('id', 'storefront-react-add-btn');
    btn.innerHTML = '';
  });

  modifiedPage.html = doc.documentElement.innerHTML;

  return (
    <StorefrontPage page={modifiedPage} assets={template.assets} portalSelector="#storefront-react-add-btn">
      <button 
        onClick={() => {
          addToCart(product, qty);
          message.success(`${product.name} added to cart`);
        }}
        disabled={product.stock === 0}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: product.stock === 0 ? '#ccc' : 'inherit',
          color: 'inherit',
          font: 'inherit',
          cursor: product.stock === 0 ? 'not-allowed' : 'pointer',
          padding: '10px 20px',
          fontWeight: 'bold'
        }}
      >
        {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
      </button>
    </StorefrontPage>
  );
};

export default ProductDetailPage;
