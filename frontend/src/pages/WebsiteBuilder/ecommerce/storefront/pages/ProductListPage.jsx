import React from 'react';
import StorefrontPage from './StorefrontPage';
import ProductGrid from '../components/ProductGrid';
import { useStorefront } from '../StorefrontContext';

const ProductListPage = () => {
  const { template, currentPageId } = useStorefront();
  const page = template?.pages?.[currentPageId];
  
  if (!page) return null;

  return (
    <StorefrontPage page={page} assets={template.assets} portalSelector={`[data-commerce="product-grid"]${page.mapping?.productGrid ? `, ${page.mapping.productGrid}` : ''}`}>
      <ProductGrid mapping={page.mapping} html={page.html} />
    </StorefrontPage>
  );
};

export default ProductListPage;
