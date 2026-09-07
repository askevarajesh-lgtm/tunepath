import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import StorefrontPage from './StorefrontPage';
import PaymentMethodSelector from '../components/PaymentMethodSelector';
import ShippingMethodSelector from '../components/ShippingMethodSelector';
import { useStorefront } from '../StorefrontContext';
import { processCheckout } from '../../utils/storage';
import { formatCurrency } from '../../utils/currency';
import { message } from 'antd';

const CheckoutPage = ({ isImported }) => {
  const { template, currentPageId, cart, settings, workspaceId, websiteId, storeId, navigateTo, clearCart } = useStorefront();
  const page = template?.pages?.[currentPageId];
  
  const [paymentMethod, setPaymentMethod] = useState('');
  const [shippingMethodId, setShippingMethodId] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store the latest state in refs so the submit handler always has the freshest data
  // without needing to be re-attached on every render.
  const stateRef = useRef({ cart, paymentMethod, shippingMethodId, isSubmitting, workspaceId, websiteId, storeId, template, isImported });
  useEffect(() => {
    stateRef.current = { cart, paymentMethod, shippingMethodId, isSubmitting, workspaceId, websiteId, storeId, template, isImported };
  }, [cart, paymentMethod, shippingMethodId, isSubmitting, workspaceId, websiteId, storeId, template, isImported]);

  useEffect(() => {
    if (settings) {
      const enabledPayments = settings.paymentMethods?.filter(m => m.enabled) || [];
      if (enabledPayments.length > 0 && !paymentMethod) {
        setPaymentMethod(enabledPayments[0].id);
      }

      if (settings.shippingEnabled) {
        const enabledShipping = settings.shippingMethods?.filter(m => m.enabled) || [];
        if (enabledShipping.length > 0) {
          const defaultShip = enabledShipping[0];
          if (!shippingMethodId) {
            setShippingMethodId(defaultShip.id);
            setShippingFee(defaultShip.price);
          } else {
             const selected = enabledShipping.find(m => m.id === shippingMethodId);
             if (selected) setShippingFee(selected.price);
          }
        } else {
          setShippingFee(settings.shippingFee || 0);
        }
      }
    }
  }, [settings, paymentMethod, shippingMethodId]);

  useEffect(() => {
    let activeCleanup = null;

    const attachListeners = (activeDoc) => {
      const handleNativeSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        
        const { cart: currentCart, paymentMethod: currentPayment, shippingMethodId: currentShipping, isSubmitting: currentSubmitting, workspaceId: wsId, websiteId: webId, storeId: stId, template: tpl, isImported: currentIsImported } = stateRef.current;
        
        if (currentCart.length === 0) {
          message.warning('Cart is empty');
          return;
        }
        if (currentSubmitting) return;

        // Collect data BEFORE setting any React state to prevent DOM wipe
        let getField = () => '';
        
        const formTarget = e?.target?.tagName === 'FORM' ? e.target : activeDoc.getElementById('storefront-checkout-form');
        
        const scrapeInputByHint = (...hints) => {
          // Try name or id first
          for (const hint of hints) {
            const input = activeDoc.querySelector(`input[name="${hint}" i], input[id="${hint}" i], textarea[name="${hint}" i], input[name*="${hint}" i], input[id*="${hint}" i]`);
            if (input && input.value) return input.value.trim();
          }
          
          // Try placeholder
          for (const hint of hints) {
            const input = activeDoc.querySelector(`input[placeholder*="${hint}" i], textarea[placeholder*="${hint}" i]`);
            if (input && input.value) return input.value.trim();
          }
          
          // Try finding by previous label text or placeholder
          const allInputs = Array.from(activeDoc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea'));
          for (const input of allInputs) {
            if (!input.value) continue;
            
            const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
            const name = (input.getAttribute('name') || '').toLowerCase();
            const id = (input.getAttribute('id') || '').toLowerCase();
            
            // Check label
            let labelText = '';
            if (id) {
              const label = activeDoc.querySelector(`label[for="${id}"]`);
              if (label) labelText = label.textContent.toLowerCase();
            }
            if (!labelText) {
               const parentLabel = input.closest('label');
               if (parentLabel) labelText = parentLabel.textContent.toLowerCase();
            }
            if (!labelText && input.previousElementSibling && ['LABEL', 'SPAN', 'DIV'].includes(input.previousElementSibling.tagName)) {
               labelText = input.previousElementSibling.textContent.toLowerCase();
            }
            
            for (const hint of hints) {
              if (placeholder.includes(hint) || name.includes(hint) || id.includes(hint) || labelText.includes(hint)) {
                 return input.value.trim();
              }
            }
          }
          return '';
        };
        
        if (formTarget) {
          const formData = new FormData(formTarget);
          getField = (...names) => {
            // Try FormData first
            for (const name of names) {
              const val = formData.get(name);
              if (val) return val.trim();
            }
            // Fallback to DOM scraping if FormData misses it (e.g. inputs without 'name' attribute)
            return scrapeInputByHint(...names);
          };
        } else {
          getField = scrapeInputByHint;
        }

        // Prioritize analyzer mapping if available
        const mapped = tpl.pages[currentPageId]?.mapping?.checkout || {};
        const getMappedVal = (field) => {
           const selector = mapped[field];
           if(!selector) return '';
           const input = formTarget ? formTarget.querySelector(selector) : activeDoc.querySelector(selector);
           return input ? (input.value || '').trim() : '';
        };

        const customerDetails = {
          firstName: getMappedVal('firstName') || getField('first name', 'firstname', 'first_name', 'name'),
          lastName: getMappedVal('lastName') || getField('last name', 'lastname', 'last_name'),
          email: getMappedVal('email') || getField('email', 'e-mail', 'mail'),
          phone: getMappedVal('phone') || getField('phone', 'mobile', 'contact', 'cell'),
          address: getMappedVal('address') || getField('address', 'street'),
          city: getMappedVal('city') || getField('city', 'town'),
          state: getMappedVal('state') || getField('state', 'province', 'region'),
          postalCode: getMappedVal('postalCode') || getField('zip', 'postal', 'postcode', 'pin'),
          country: getMappedVal('country') || getField('country', 'nation')
        };
        
        // Combine name if first/last name used
        customerDetails.name = customerDetails.lastName ? `${customerDetails.firstName} ${customerDetails.lastName}`.trim() : customerDetails.firstName;
        
        if (!customerDetails.name) {
           customerDetails.name = 'Guest Customer'; // Fallback to avoid complete failure
        }

        setIsSubmitting(true);

        const result = await processCheckout(wsId, webId, stId, customerDetails, currentCart, currentPayment, currentShipping);
        
        if (result.success) {
          if (result.duplicate) {
            message.info(`Order ${result.orderNumber} is already being processed.`);
          } else {
            message.success(`Order ${result.orderNumber} placed successfully!`);
          }
          
          // Only clear cart if it wasn't a duplicate bounce (or even if it was, they bought it)
          clearCart();
          
          // Dispatch global event so Admin Tabs refresh
          const event = new CustomEvent('ecommerce_data_updated', {
            detail: { entity: 'checkout', storeId: stId, orderId: result.orderId }
          });
          window.dispatchEvent(event);
          
          setIsSubmitting(false);
          
          const successPage = Object.values(tpl.pages).find(p => p.role === 'Success' || p.fileName.includes('success'));
          if (successPage) {
            navigateTo(successPage.id);
          } else {
            // Navigate to Home index safely
            const indexPage = Object.values(tpl.pages).find(p => p.fileName.includes('index') || p.role === 'Home');
            navigateTo(indexPage ? indexPage.id : Object.keys(tpl.pages)[0]); 
          }
        } else {
          message.error(result.message || 'Checkout failed');
          setIsSubmitting(false);
        }
      };

      const handleGlobalClick = (e) => {
        const btn = e.target.closest('button, a, input[type="submit"], input[type="button"]');
        if (!btn) return;
        
        const text = (btn.textContent || btn.value || '').toLowerCase().trim();
        const id = (btn.id || '').toLowerCase();
        const cls = (btn.className || '').toString().toLowerCase();
        
        if (text.includes('place order') || text.includes('submit order') || 
            id.includes('place-order') || cls.includes('place-order')) {
          e.preventDefault();
          e.stopPropagation();
          handleNativeSubmit({ preventDefault: () => {} });
        }
      };

      const form = activeDoc.getElementById('storefront-checkout-form');
      if (form) {
        // Remove any existing listeners first to be absolutely safe
        form.removeEventListener('submit', handleNativeSubmit);
        form.addEventListener('submit', handleNativeSubmit);
      }
      
      // Add global click listener for unmapped Place Order buttons
      activeDoc.addEventListener('click', handleGlobalClick);

      return () => {
        if (form) form.removeEventListener('submit', handleNativeSubmit);
        activeDoc.removeEventListener('click', handleGlobalClick);
      };
    };

    if (isImported) {
      const handleIframeLoaded = (e) => {
        if (activeCleanup) activeCleanup();
        activeCleanup = attachListeners(e.detail);
      };
      
      window.addEventListener('storefront_iframe_loaded', handleIframeLoaded);
      
      // Try to attach if it's already loaded (in case we mounted after the event fired)
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentDocument && iframe.contentDocument.readyState === 'complete' && iframe.contentDocument.body.innerHTML) {
         if (activeCleanup) activeCleanup();
         activeCleanup = attachListeners(iframe.contentDocument);
      }
      
      return () => {
        window.removeEventListener('storefront_iframe_loaded', handleIframeLoaded);
        if (activeCleanup) activeCleanup();
      };
    } else {
      activeCleanup = attachListeners(document);
      return () => {
        if (activeCleanup) activeCleanup();
      };
    }
  }, [isImported]); // Runs once, but actively listens to the iframe lifecycle via events

  const { modifiedPage, itemTemplateHtml } = React.useMemo(() => {
    if (!page) return { modifiedPage: null, itemTemplateHtml: '' };
    const modPage = { ...page };
    const parser = new DOMParser();
    const doc = parser.parseFromString(page.html, 'text/html');
    
    // --- 1. Find Form and setup main React Checkout Portal ---
    // Prioritize explicit binding
    let formEl = doc.querySelector('[data-commerce="checkout"]');
    
    // Fallback to legacy mapping
    if (!formEl && page.mapping && page.mapping.checkoutForm) {
      formEl = doc.querySelector(page.mapping.checkoutForm);
    }
    
    if (formEl) {
      let reactMount = formEl.querySelector('#storefront-react-checkout');
      if (!reactMount) {
        reactMount = doc.createElement('div');
        reactMount.id = 'storefront-react-checkout';
        formEl.appendChild(reactMount);
      }
      formEl.id = 'storefront-checkout-form';
      formEl.removeAttribute('action');
      formEl.removeAttribute('method');
    }

    // --- 2. Find Checkout Summary Product List ---
    let itemTemplateHtml = '<tr></tr>';
    let itemTemplate = null;
    let mountParent = null;

    // Explicit binding
    const explicitContainer = doc.querySelector('[data-commerce="checkout-summary"]');
    if (explicitContainer) {
      itemTemplate = explicitContainer.querySelector('tbody > tr') || 
                     (explicitContainer.tagName === 'TBODY' ? explicitContainer.firstElementChild : null) ||
                     (explicitContainer.tagName === 'TABLE' ? explicitContainer.querySelector('tbody > tr') || explicitContainer.querySelector('tr') : explicitContainer.firstElementChild);
      if (itemTemplate) mountParent = itemTemplate.parentElement;
    }

    // Fallback: search for table-based summary near the form
    if (!itemTemplate) {
      const tables = Array.from(doc.querySelectorAll('table'));
      for (const table of tables) {
        const text = table.textContent.toLowerCase();
        // Typically a checkout summary has product and total/price
        if (text.includes('product') && text.includes('total')) {
          const tbody = table.querySelector('tbody') || table;
          const rows = Array.from(tbody.querySelectorAll('tr'));
          const itemRow = rows.find(r => !r.querySelector('th') && !r.textContent.toLowerCase().includes('total') && !r.textContent.toLowerCase().includes('subtotal') && !r.textContent.toLowerCase().includes('shipping'));
          
          if (itemRow) {
            itemTemplate = itemRow;
            mountParent = tbody;
            break;
          }
        }
      }
    }

    // Fallback: search for div-based summary
    if (!itemTemplate) {
       const allUls = Array.from(doc.querySelectorAll('ul, div, section'));
       for (const el of allUls) {
          const text = el.textContent.toLowerCase().replace(/\s+/g, ' ');
          if (text.includes('product') && (text.includes('total') || text.includes('price')) && text.length < 500) {
             const children = Array.from(el.children);
             const itemRow = children.find(child => {
                const cText = child.textContent.toLowerCase();
                return !cText.includes('subtotal') && !cText.includes('total') && !cText.includes('shipping') && cText.match(/[\$\£\€\₹\d]/);
             });
             if (itemRow) {
                itemTemplate = itemRow;
                mountParent = el;
                break;
             }
          }
       }
    }

    if (itemTemplate && mountParent) {
      itemTemplateHtml = itemTemplate.outerHTML;
      
      const mountPoint = doc.createElement(itemTemplate.tagName === 'TR' ? 'tbody' : 'div');
      mountPoint.id = 'storefront-react-checkout-list';
      if (mountPoint.tagName === 'DIV') mountPoint.style.display = 'contents';
      
      mountParent.insertBefore(mountPoint, itemTemplate);
      
      let current = itemTemplate;
      let count = 0;
      while (current && current.tagName === itemTemplate.tagName && count < 10) {
        let next = current.nextElementSibling;
        const textLower = current.textContent.toLowerCase();
        if (textLower.includes('total') || textLower.includes('subtotal') || textLower.includes('shipping') || textLower.includes('tax')) {
          break; // Stop removing if we hit totals
        }
        current.remove();
        current = next;
        count++;
      }
    }

    // --- 3. Find Totals for Native DOM Updates ---
    const allEls = Array.from(doc.querySelectorAll('td, span, div, strong, b, p, h3, h4, th, tr, li'));
    
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

    const subtotalNode = findAmountNode(['sub total', 'subtotal', 'cart subtotal']);
    if (subtotalNode) subtotalNode.setAttribute('data-cart-subtotal', 'true');

    const shippingNode = findAmountNode(['shipping', 'shipping cost', 'shipping fee', 'delivery']);
    if (shippingNode) shippingNode.setAttribute('data-cart-shipping', 'true');

    let grandtotalNode = findAmountNode(['grand total', 'grandtotal', 'total amount', 'order total']);
    if (!grandtotalNode) {
      grandtotalNode = findAmountNode(['total']);
    }
    if (grandtotalNode) grandtotalNode.setAttribute('data-cart-grandtotal', 'true');

    modPage.html = doc.documentElement.innerHTML;
    return { modifiedPage: modPage, itemTemplateHtml };
  }, [page]);

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const finalTotal = cartTotal + Number(shippingFee);

  // Native DOM update for totals to prevent wiping the DOM with re-renders
  useEffect(() => {
    let activeDoc = document;
    if (isImported) {
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentDocument) {
         activeDoc = iframe.contentDocument;
      } else {
         return; 
      }
    }

    const subtotalNodes = activeDoc.querySelectorAll('[data-cart-subtotal="true"]');
    subtotalNodes.forEach(node => {
      node.textContent = formatCurrency(cartTotal, workspaceId, websiteId, storeId);
    });

    const shippingNodes = activeDoc.querySelectorAll('[data-cart-shipping="true"]');
    shippingNodes.forEach(node => {
      node.textContent = formatCurrency(shippingFee, workspaceId, websiteId, storeId);
    });

    const grandtotalNodes = activeDoc.querySelectorAll('[data-cart-grandtotal="true"]');
    grandtotalNodes.forEach(node => {
      node.textContent = formatCurrency(finalTotal, workspaceId, websiteId, storeId);
    });
  }, [cartTotal, shippingFee, finalTotal, workspaceId, websiteId, storeId, isImported]);

  if (!modifiedPage) return null;

  return (
    <StorefrontPage page={modifiedPage} assets={template.assets} isImported={isImported} portalSelector="#storefront-react-checkout">
      <CheckoutFormPortal 
        settings={settings}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        shippingMethodId={shippingMethodId}
        setShippingMethodId={setShippingMethodId}
        workspaceId={workspaceId}
        websiteId={websiteId}
        isImported={isImported}
      />
      <CheckoutListPortal 
        cart={cart} 
        itemTemplateHtml={itemTemplateHtml} 
        isImported={isImported} 
      />
    </StorefrontPage>
  );
};

const CheckoutFormPortal = (props) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  if (!mounted) return null;
  
  const content = (
    <div style={{ marginTop: 32 }}>
      <ShippingMethodSelector 
        settings={props.settings} 
        selectedMethod={props.shippingMethodId} 
        onSelect={props.setShippingMethodId} 
        workspaceId={props.workspaceId} 
        websiteId={props.websiteId} 
      />
      
      <PaymentMethodSelector 
        settings={props.settings} 
        selectedMethod={props.paymentMethod} 
        onSelect={props.setPaymentMethod} 
      />
    </div>
  );

  if (props.isImported) return content;

  const target = document.getElementById('storefront-react-checkout');
  if (!target) return null;
  return createPortal(content, target);
};

import CheckoutItem from '../components/CheckoutItem';

const CheckoutListPortal = ({ cart, itemTemplateHtml, isImported }) => {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (!isImported) {
      setTarget(document.getElementById('storefront-react-checkout-list'));
      return;
    }

    const handleLoad = (e) => {
      const doc = e.detail;
      if (doc) {
        setTarget(doc.getElementById('storefront-react-checkout-list'));
      }
    };
    
    window.addEventListener('storefront_iframe_loaded', handleLoad);
    
    // Check if already loaded
    const iframe = document.querySelector('iframe');
    if (iframe?.contentDocument?.readyState === 'complete') {
      const el = iframe.contentDocument.getElementById('storefront-react-checkout-list');
      if (el) setTarget(el);
    }
    
    return () => {
      window.removeEventListener('storefront_iframe_loaded', handleLoad);
    };
  }, [isImported]);
  
  if (!target) return null;
  
  const content = (
    <>
      {cart.map(item => <CheckoutItem key={item.id} item={item} templateHtml={itemTemplateHtml} />)}
    </>
  );

  return createPortal(content, target);
};

export default CheckoutPage;
