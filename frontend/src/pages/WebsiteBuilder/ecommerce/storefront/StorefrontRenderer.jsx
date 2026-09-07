import React, { useState } from 'react';
import { Drawer, Badge, List, Button, Typography, Space, Spin } from 'antd';
import { ShoppingCart } from 'lucide-react';
import { StorefrontProvider, useStorefront } from './StorefrontContext';
import ProductListPage from './pages/ProductListPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import StorefrontPage from './pages/StorefrontPage';
import ProductGrid from './components/ProductGrid';
import { formatCurrency } from '../utils/currency';
import { useParams } from 'react-router-dom';

const { Text } = Typography;

class StorefrontErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Storefront Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', color: '#ff4d4f' }}>
          <h3>Something went wrong in the storefront.</h3>
          <p>Please try refreshing the page.</p>
        </div>
      );
    }
    return this.props.children; 
  }
}

const StorefrontRendererContent = () => {
  const { template, isLoading, currentPageId, cart, wishlist, workspaceId, websiteId, navigateTo } = useStorefront();

  // Intercept navigation events emitted by StorefrontPage
  React.useEffect(() => {
    const handleNavigate = (e) => {
      const href = e.detail || '';
      const lowerHref = href.toLowerCase();
      const pages = Object.values(template?.pages || {});
      
      // Dynamically resolve Cart navigation
      if (lowerHref.includes('cart') || lowerHref === 'cart' || lowerHref.includes('basket')) {
        const cartPage = pages.find(p => 
          String(p.role || '').toLowerCase() === 'cart' ||
          String(p.name || '').toLowerCase().includes('cart') ||
          String(p.fileName || p.filename || '').toLowerCase().includes('cart') ||
          String(p.fileName || p.filename || '').toLowerCase().includes('basket')
        );
        if (cartPage) {
          return navigateTo(cartPage.id || Object.keys(template.pages).find(k => template.pages[k] === cartPage));
        } else {
          console.warn('Storefront navigation: Cart page not found in template.');
          return;
        }
      }
      
      // Dynamically resolve Checkout navigation
      if (lowerHref.includes('checkout') || lowerHref === 'checkout' || lowerHref.includes('cheackout') || lowerHref.includes('chackout')) {
        const checkoutPage = pages.find(p => 
          String(p.role || '').toLowerCase() === 'checkout' ||
          String(p.name || '').toLowerCase().includes('checkout') ||
          String(p.fileName || p.filename || '').toLowerCase().includes('checkout') ||
          String(p.fileName || p.filename || '').toLowerCase().includes('cheackout') ||
          String(p.fileName || p.filename || '').toLowerCase().includes('chackout')
        );
        if (checkoutPage) {
          return navigateTo(checkoutPage.id || Object.keys(template.pages).find(k => template.pages[k] === checkoutPage));
        } else {
          console.warn('Storefront navigation: Checkout page not found in template');
        }
      }

      // Strip leading ./ and # hashes to find the page ID
      const targetPath = href.replace(/^\.\//, '').split('#')[0];
      
      if (template?.pages?.[targetPath]) {
        return navigateTo(targetPath);
      }
      
      // Fallback: search by fileName
      const matchingPage = pages.find(p => p.fileName === targetPath || p.filename === targetPath);
      if (matchingPage) {
        return navigateTo(matchingPage.id || Object.keys(template.pages).find(k => template.pages[k] === matchingPage));
      }
      
      // Fallback: search by role or name for wishlist
      if (lowerHref.includes('wishlist')) {
        const wishlistPage = pages.find(p => p.role === 'Wishlist' || p.name === 'Wishlist' || String(p.id).toLowerCase() === 'wishlist');
        if (wishlistPage) {
          return navigateTo(wishlistPage.id || Object.keys(template.pages).find(k => template.pages[k] === wishlistPage));
        }
      }
    };
    window.addEventListener('storefront_navigate', handleNavigate);
    return () => window.removeEventListener('storefront_navigate', handleNavigate);
  }, [template, navigateTo]);

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin size="large" /></div>;
  }

  if (!template) {
    return <div style={{ padding: 40, textAlign: 'center' }}>No template active.</div>;
  }

  const page = template.pages[currentPageId];
  if (!page) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Page not found.</div>;
  }

  const isImported = template?.templateId?.startsWith('import-') || template?.sourceTemplateId?.startsWith('import-') || template?.metadata?.importedFrom === 'zip-upload';

  let PageComponent = null;

  if (page.role === 'Product Listing') {
    PageComponent = <ProductListPage isImported={isImported} />;
  } else if (page.role === 'Product Detail') {
    PageComponent = <ProductDetailPage isImported={isImported} />;
  } else if (page.role === 'Cart') {
    PageComponent = <CartPage isImported={isImported} />;
  } else if (page.role === 'Checkout') {
    PageComponent = <CheckoutPage isImported={isImported} />;
  } else {
    // Generic page (works for both built-in and imported templates)
    const hasGrid = page.html?.includes('data-commerce="product-grid"') || page.html?.includes('data-commerce="product-card"') || page.mapping?.productGrid || page.mapping?.productCard;
    const hasWishlistGrid = page.html?.includes('data-commerce="wishlist-grid"') || page.html?.includes('data-commerce="wishlist"');
    
    if (hasGrid) {
      PageComponent = (
        <StorefrontPage 
          page={page} 
          assets={template.assets} 
          isImported={isImported}
          portalSelector={`[data-commerce="product-grid"]${page.mapping?.productGrid ? `, ${page.mapping.productGrid}` : ''}`}
        >
          <ProductGrid mapping={page.mapping} html={page.html} />
        </StorefrontPage>
      );
    } else if (hasWishlistGrid) {
      const selector = page.html?.includes('data-commerce="wishlist-grid"') ? '[data-commerce="wishlist-grid"]' : '[data-commerce="wishlist"]';
      PageComponent = (
        <StorefrontPage 
          page={page} 
          assets={template.assets} 
          isImported={isImported}
          portalSelector={selector}
        >
          <ProductGrid mapping={page.mapping} html={page.html} items={wishlist} />
        </StorefrontPage>
      );
    } else {
      PageComponent = <StorefrontPage page={page} assets={template.assets} isImported={isImported} />;
    }
  }

  const totalQuantity = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>


      <div style={{ flex: 1, position: 'relative', overflowY: 'auto', transform: 'translate(0)' }}>
        {PageComponent}
      </div>


    </div>
  );
};

const StorefrontRenderer = ({ templateId: propTemplateId }) => {
  const { templateId: paramTemplateId } = useParams();
  const targetTemplateId = paramTemplateId || propTemplateId;

  return (
    <StorefrontProvider templateId={targetTemplateId}>
      <StorefrontErrorBoundary>
        <StorefrontRendererContent />
      </StorefrontErrorBoundary>
    </StorefrontProvider>
  );
};

export default StorefrontRenderer;
