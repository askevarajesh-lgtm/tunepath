import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import StorefrontPage from './StorefrontPage';
import PaymentMethodSelector from '../components/PaymentMethodSelector';
import ShippingMethodSelector from '../components/ShippingMethodSelector';
import { useStorefront } from '../StorefrontContext';
import { processCheckout } from '../../utils/storage';
import { formatCurrency } from '../../utils/currency';
import { message } from 'antd';

const CheckoutPage = () => {
  const { template, currentPageId, cart, settings, workspaceId, websiteId, storeId, navigateTo, clearCart } = useStorefront();
  const page = template?.pages?.[currentPageId];
  
  const [paymentMethod, setPaymentMethod] = useState('');
  const [shippingMethodId, setShippingMethodId] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store the latest state in refs so the submit handler always has the freshest data
  // without needing to be re-attached on every render.
  const stateRef = useRef({ cart, paymentMethod, shippingMethodId, isSubmitting, workspaceId, websiteId, storeId, template });
  useEffect(() => {
    stateRef.current = { cart, paymentMethod, shippingMethodId, isSubmitting, workspaceId, websiteId, storeId, template };
  }, [cart, paymentMethod, shippingMethodId, isSubmitting, workspaceId, websiteId, storeId, template]);

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
    const handleNativeSubmit = async (e) => {
      if (e && e.preventDefault) e.preventDefault();
      
      const { cart: currentCart, paymentMethod: currentPayment, shippingMethodId: currentShipping, isSubmitting: currentSubmitting, workspaceId: wsId, websiteId: webId, storeId: stId, template: tpl } = stateRef.current;
      
      if (currentCart.length === 0) {
        message.warning('Cart is empty');
        return;
      }
      if (currentSubmitting) return;

      // Collect data BEFORE setting any React state to prevent DOM wipe
      let getField = () => '';
      
      const formTarget = e?.target?.tagName === 'FORM' ? e.target : document.getElementById('storefront-checkout-form');
      
      const scrapeInputByHint = (...hints) => {
        // Try name or id first
        for (const hint of hints) {
          const input = document.querySelector(`input[name="${hint}" i], input[id="${hint}" i], textarea[name="${hint}" i], input[name*="${hint}" i], input[id*="${hint}" i]`);
          if (input && input.value) return input.value.trim();
        }
        
        // Try placeholder
        for (const hint of hints) {
          const input = document.querySelector(`input[placeholder*="${hint}" i], textarea[placeholder*="${hint}" i]`);
          if (input && input.value) return input.value.trim();
        }
        
        // Try finding by previous label text or placeholder
        const allInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea'));
        for (const input of allInputs) {
          if (!input.value) continue;
          
          const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
          const name = (input.getAttribute('name') || '').toLowerCase();
          const id = (input.getAttribute('id') || '').toLowerCase();
          
          // Check label
          let labelText = '';
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
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
         const input = formTarget ? formTarget.querySelector(selector) : document.querySelector(selector);
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

    const form = document.getElementById('storefront-checkout-form');
    if (form) {
      // Remove any existing listeners first to be absolutely safe
      form.removeEventListener('submit', handleNativeSubmit);
      form.addEventListener('submit', handleNativeSubmit);
    }
    
    // Add global click listener for unmapped Place Order buttons
    document.addEventListener('click', handleGlobalClick);

    return () => {
      if (form) form.removeEventListener('submit', handleNativeSubmit);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []); // Run only once on mount, relies on refs for state

  const modifiedPage = React.useMemo(() => {
    if (!page) return null;
    const modPage = { ...page };
    const parser = new DOMParser();
    const doc = parser.parseFromString(page.html, 'text/html');
    
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

    modPage.html = doc.documentElement.innerHTML;
    return modPage;
  }, [page]);

  if (!modifiedPage) return null;

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const finalTotal = cartTotal + Number(shippingFee);

  return (
    <StorefrontPage page={modifiedPage} assets={template.assets}>
      <CheckoutPortal 
        settings={settings}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        shippingMethodId={shippingMethodId}
        setShippingMethodId={setShippingMethodId}
        cartTotal={cartTotal}
        shippingFee={shippingFee}
        finalTotal={finalTotal}
        workspaceId={workspaceId}
        websiteId={websiteId}
        storeId={storeId}
      />
    </StorefrontPage>
  );
};

const CheckoutPortal = (props) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  if (!mounted) return null;
  const target = document.getElementById('storefront-react-checkout');
  if (!target) return null;

  return createPortal(
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
      
      <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>Subtotal</span>
          <span>{formatCurrency(props.cartTotal, props.workspaceId, props.websiteId, props.storeId)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
          <span>Shipping</span>
          <span>{formatCurrency(props.shippingFee, props.workspaceId, props.websiteId, props.storeId)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem' }}>
          <span>Total</span>
          <span>{formatCurrency(props.finalTotal, props.workspaceId, props.websiteId, props.storeId)}</span>
        </div>
      </div>
    </div>,
    target
  );
};

export default CheckoutPage;
