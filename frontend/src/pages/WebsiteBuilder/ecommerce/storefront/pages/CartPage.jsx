import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import StorefrontPage from './StorefrontPage';
import CartItem from '../components/CartItem';
import { useStorefront } from '../StorefrontContext';
import { formatCurrency } from '../../utils/currency';

const CartPage = () => {
  const { template, currentPageId, cart, workspaceId, websiteId, storeId, settings } = useStorefront();
  const page = template?.pages?.[currentPageId];
  
  const { modifiedPage, itemTemplateHtml, hasEmptyState } = useMemo(() => {
    if (!page) return { modifiedPage: null, itemTemplateHtml: '', hasEmptyState: false };

    const modPage = { ...page };
    const parser = new DOMParser();
    const doc = parser.parseFromString(page.html, 'text/html');
    
    let itemTemplateHtml = '<tr></tr>';
    let itemTemplate = null;
    let mountParent = null;
    
    // 0. Explicit data-commerce binding
    const explicitContainer = doc.querySelector('[data-commerce="cart"]');
    if (explicitContainer) {
      // If the container is a wrapper around a table, find the TR inside TBODY
      itemTemplate = explicitContainer.querySelector('tbody > tr') || 
                     (explicitContainer.tagName === 'TBODY' ? explicitContainer.firstElementChild : null) ||
                     (explicitContainer.tagName === 'TABLE' ? explicitContainer.querySelector('tbody > tr') || explicitContainer.querySelector('tr') : explicitContainer.firstElementChild);
      
      if (itemTemplate) {
        mountParent = itemTemplate.parentElement;
      } else {
        // Create an empty template if none exists inside the placeholder
        explicitContainer.innerHTML = '<div></div>';
        itemTemplate = explicitContainer.firstElementChild;
        mountParent = explicitContainer;
      }
    }
    
    // 1. Try explicit mapping first (legacy)
    if (!itemTemplate && page.mapping) {
      const { cartContainer, cartItem } = page.mapping;
      if (cartContainer && cartItem) {
        const container = doc.querySelector(cartContainer);
        if (container) {
          itemTemplate = container.querySelector(cartItem);
          if (itemTemplate) mountParent = itemTemplate.parentElement;
        }
      }
    }

    // 2. Fallback: search for table-based cart
    if (!itemTemplate) {
      const tables = Array.from(doc.querySelectorAll('table'));
      for (const table of tables) {
        const text = table.textContent.toLowerCase();
        if (text.includes('product') && text.includes('price') && (text.includes('quantity') || text.includes('qty'))) {
          const tbody = table.querySelector('tbody') || table;
          const rows = Array.from(tbody.querySelectorAll('tr'));
          const itemRow = rows.find(r => !r.querySelector('th') && !r.textContent.toLowerCase().includes('cart is empty') && !r.textContent.toLowerCase().includes('cart empty') && !r.textContent.toLowerCase().includes('total'));
          
          mountParent = tbody;
          if (itemRow) {
            itemTemplate = itemRow;
          } else {
            const tr = doc.createElement('tr');
            tr.innerHTML = `
              <td class="product-name" style="padding: 15px;">Product</td>
              <td class="product-price" style="padding: 15px;">$0.00</td>
              <td class="product-quantity" style="padding: 15px;"><input type="number" value="1" min="1" style="width:60px" /></td>
              <td class="product-subtotal" style="padding: 15px;">$0.00</td>
              <td class="product-remove" style="padding: 15px;"><button class="btn-remove">X</button></td>
            `;
            tbody.appendChild(tr);
            itemTemplate = tr;
          }
          break;
        }
      }
    }

    // 3. Fallback: search for div-based grid cart
    if (!itemTemplate) {
      const allDivs = Array.from(doc.querySelectorAll('div, section, ul'));
      for (const div of allDivs) {
        const text = div.textContent.toLowerCase().replace(/\s+/g, ' ');
        if (text.includes('product') && text.includes('price') && (text.includes('quantity') || text.includes('qty')) && text.length < 200) {
          let next = div.nextElementSibling;
          mountParent = div.parentElement;
          if (next && (next.tagName === 'DIV' || next.tagName === 'LI' || next.tagName === 'ARTICLE') && !next.textContent.toLowerCase().includes('cart is empty')) {
            itemTemplate = next;
          } else {
            const fallbackDiv = doc.createElement('div');
            fallbackDiv.style.display = 'flex';
            fallbackDiv.style.justifyContent = 'space-between';
            fallbackDiv.style.padding = '15px 0';
            fallbackDiv.style.borderBottom = '1px solid #eee';
            fallbackDiv.innerHTML = `
              <div class="product-name" style="flex:2">Product</div>
              <div class="product-price" style="flex:1">$0.00</div>
              <div class="product-quantity" style="flex:1"><input type="number" value="1" min="1" style="width:60px" /></div>
              <div class="product-subtotal" style="flex:1">$0.00</div>
              <div class="product-remove"><button class="btn-remove">X</button></div>
            `;
            if (div.nextSibling) {
              mountParent.insertBefore(fallbackDiv, div.nextSibling);
            } else {
              mountParent.appendChild(fallbackDiv);
            }
            itemTemplate = fallbackDiv;
          }
          break;
        }
      }
    }

    if (itemTemplate && mountParent) {
      itemTemplateHtml = itemTemplate.outerHTML;
      
      const mountPoint = doc.createElement(itemTemplate.tagName === 'TR' ? 'tbody' : 'div');
      mountPoint.id = 'storefront-react-cart-list';
      if (mountPoint.tagName === 'DIV') mountPoint.style.display = 'contents';
      
      mountParent.insertBefore(mountPoint, itemTemplate);
      
      let current = itemTemplate;
      let count = 0;
      while (current && current.tagName === itemTemplate.tagName && count < 10) {
        let next = current.nextElementSibling;
        const textLower = current.textContent.toLowerCase();
        if (textLower.includes('total') || textLower.includes('subtotal') || textLower.includes('cart is empty') || textLower.includes('cart empty')) {
          break; // Stop removing if we hit totals or empty state
        }
        current.remove();
        current = next;
        count++;
      }
    }

    // 4. Find Totals and Empty State heuristically to mark them for native DOM updates
    let emptyStateFound = false;
    const allEls = Array.from(doc.querySelectorAll('td, span, div, strong, b, p, h3, h4, th, tr, li'));
    for (const el of allEls) {
      const text = el.textContent.toLowerCase().trim();
      
      if (text.includes('cart is empty') || text.includes('cart empty') || text.includes('your cart is empty')) {
         el.setAttribute('data-cart-empty-state', 'true');
         emptyStateFound = true;
      }
    }

    const findAmountNode = (labelKeywords) => {
      for (const el of allEls) {
        if (el.tagName === 'TH' || el.closest('thead')) continue;
        const text = el.textContent.toLowerCase().trim();
        const hasKeyword = labelKeywords.some(kw => text === kw || text === kw + ':');
        if (hasKeyword) {
          let next = el.nextElementSibling;
          if (next && next.textContent.match(/[\$\£\€\₹\d]/)) return next;
          if (el.parentElement && el.parentElement.nextElementSibling) {
            let parentNext = el.parentElement.nextElementSibling;
            if (parentNext.textContent.match(/[\$\£\€\₹\d]/)) return parentNext;
          }
        }
        
        const hasKeywordStart = labelKeywords.some(kw => text.startsWith(kw));
        if (hasKeywordStart && text.match(/[\$\£\€\₹]/)) {
          const children = Array.from(el.querySelectorAll('*'));
          let foundChild = null;
          for (const child of children) {
            if (child.textContent.match(/[\$\£\€\₹\d]/) && !labelKeywords.some(kw => child.textContent.toLowerCase().includes(kw))) {
              foundChild = child;
              break;
            }
          }
          if (foundChild) return foundChild;
          
          el.innerHTML = el.innerHTML.replace(/([\$\£\€\₹]\s*[\d\.,]+)/, '<span class="dynamic-amount">$1</span>');
          const newSpan = el.querySelector('.dynamic-amount');
          if (newSpan) return newSpan;
        }
      }
      return null;
    };

    const subtotalNode = findAmountNode(['sub total', 'subtotal']);
    if (subtotalNode) subtotalNode.setAttribute('data-cart-subtotal', 'true');

    const shippingNode = findAmountNode(['shipping', 'shipping cost', 'shipping fee']);
    if (shippingNode) shippingNode.setAttribute('data-cart-shipping', 'true');

    let grandtotalNode = findAmountNode(['grand total', 'grandtotal', 'total amount']);
    if (!grandtotalNode) {
      // Fallback if the template just uses "Total", but this might catch table headers.
      // We will only accept it if it contains a price pattern in itself or next sibling.
      grandtotalNode = findAmountNode(['total']);
    }
    if (grandtotalNode) grandtotalNode.setAttribute('data-cart-grandtotal', 'true');

    modPage.html = doc.documentElement.innerHTML;
    return { modifiedPage: modPage, itemTemplateHtml, hasEmptyState: emptyStateFound };
  }, [page]);

  const subTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const shipping = settings?.shippingEnabled ? (settings.shippingFee || 0) : 0;
  const grandTotal = subTotal + shipping;

  // Native DOM update for totals to prevent wiping the DOM with re-renders
  useEffect(() => {
    const subtotalNodes = document.querySelectorAll('[data-cart-subtotal="true"]');
    subtotalNodes.forEach(node => {
      node.textContent = formatCurrency(subTotal, workspaceId, websiteId, storeId);
    });

    const shippingNodes = document.querySelectorAll('[data-cart-shipping="true"]');
    shippingNodes.forEach(node => {
      node.textContent = formatCurrency(shipping, workspaceId, websiteId, storeId);
    });

    const grandtotalNodes = document.querySelectorAll('[data-cart-grandtotal="true"]');
    grandtotalNodes.forEach(node => {
      node.textContent = formatCurrency(grandTotal, workspaceId, websiteId, storeId);
    });

    // Handle Empty State Visibility
    const emptyStateNodes = document.querySelectorAll('[data-cart-empty-state="true"]');
    emptyStateNodes.forEach(node => {
      if (cart.length > 0) {
        node.style.display = 'none';
      } else {
        node.style.display = ''; // restore
      }
    });
    
    // Also hide the cart container/table if cart is empty and we have a native empty state
    const cartList = document.getElementById('storefront-react-cart-list');
    if (cartList && emptyStateNodes.length > 0) {
       const table = cartList.closest('table');
       if (table) {
         table.style.display = cart.length === 0 ? 'none' : '';
       }
    }
  }, [cart.length, subTotal, shipping, grandTotal, workspaceId, websiteId, storeId]);

  const { navigateTo } = useStorefront();
  
  // Intercept Proceed to Checkout button clicks on the Cart Page
  useEffect(() => {
    const handleCheckoutClick = (e) => {
      const btn = e.target.closest('a, button');
      if (btn) {
        const text = btn.textContent.toLowerCase();
        const href = btn.getAttribute('href') || '';
        if (text.includes('checkout') || href.toLowerCase().includes('checkout')) {
          e.preventDefault();
          e.stopPropagation();
          const checkoutPageId = Object.keys(template.pages).find(k => template.pages[k].role === 'Checkout');
          if (checkoutPageId) {
            navigateTo(checkoutPageId);
          } else {
            console.warn('Checkout page not found in template');
          }
        }
      }
    };
    
    document.addEventListener('click', handleCheckoutClick, true); // use capture phase to override default links
    return () => document.removeEventListener('click', handleCheckoutClick, true);
  }, [template, navigateTo]);

  if (!modifiedPage) return null;

  return (
    <StorefrontPage page={modifiedPage} assets={template.assets}>
      <CartListPortal cart={cart} itemTemplateHtml={itemTemplateHtml} hasEmptyState={hasEmptyState} />
    </StorefrontPage>
  );
};

const CartListPortal = ({ cart, itemTemplateHtml, hasEmptyState }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  if (!mounted) return null;
  const target = document.getElementById('storefront-react-cart-list');
  if (!target) return null;

  return createPortal(
    <>
      {cart.length === 0 && !hasEmptyState ? (
        <tr><td colSpan="5" style={{ padding: 20, textAlign: 'center' }}>Your cart is empty.</td></tr>
      ) : (
        cart.map(item => <CartItem key={item.id} item={item} templateHtml={itemTemplateHtml} />)
      )}
    </>,
    target
  );
};

export default CartPage;
