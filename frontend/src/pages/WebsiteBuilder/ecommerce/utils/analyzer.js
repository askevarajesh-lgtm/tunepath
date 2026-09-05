// analyzer.js - Heuristic template analyzer for e-commerce elements
// IMPROVED VERSION for Temporary Import Workflow

export const analyzePageSemantics = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const diagnostics = [];
  
  const result = {
    product: {
      container: '',
      image: '',
      title: '',
      price: '',
      salePrice: '',
      oldPrice: '',
      addBtn: '',
      productLink: '',
      description: '',
      category: '',
      rating: ''
    },
    cart: {
      container: '',
      item: '',
      image: '',
      name: '',
      price: '',
      quantityInput: '',
      incrementBtn: '',
      decrementBtn: '',
      lineTotal: '',
      removeBtn: '',
      subtotal: '',
      shipping: '',
      grandTotal: ''
    },
    checkout: {
      form: '',
      firstName: '',
      lastName: '',
      fullName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      payment: '',
      submitBtn: ''
    },
    confidence: { product: 0, cart: 0, checkout: 0 },
    diagnostics
  };

  const getSelector = (el, stopAt = doc.body) => {
    if (!el || el === doc || el === doc.body || el === doc.documentElement) return '';
    
    // Priority 1: Unique ID
    if (el.id) return `#${el.id}`;
    
    // Priority 2: Unique Data Attribute (e.g. data-product-id)
    if (el.dataset) {
      const dataAttrs = Object.keys(el.dataset);
      for (const key of dataAttrs) {
        if (key.toLowerCase().includes('id') || key.toLowerCase().includes('ref') || key.toLowerCase().includes('product')) {
          const attr = `data-${key.replace(/[A-Z]/g, m => "-" + m.toLowerCase())}`;
          return `[${attr}="${el.dataset[key]}"]`;
        }
      }
    }
    
    // Build path up to a stable parent
    let path = [];
    let current = el;
    while (current && current !== stopAt && current !== doc.body) {
      if (current.id) {
        path.unshift(`#${current.id}`);
        break; // IDs are unique, can stop here
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.split(' ')
          .map(c => c.trim())
          .filter(c => c && !c.includes(':') && !c.match(/^[0-9]/) && !['col', 'row', 'container', 'active', 'show', 'd-flex', 'wrapper', 'item', 'inner'].includes(c));
        
        if (classes.length > 0) {
          // Prefer semantic classes over generic layout ones
          const semantic = classes.find(c => c.includes('product') || c.includes('cart') || c.includes('item') || c.includes('title') || c.includes('price') || c.includes('img') || c.includes('btn') || c.includes('form') || c.includes('checkout'));
          if (semantic) {
            path.unshift(`.${semantic}`);
          } else {
            // Priority 4: Stable class combination (just use the first specific class)
             path.unshift(`.${classes[0]}`);
          }
        } else {
          path.unshift(current.tagName.toLowerCase());
        }
      } else {
        path.unshift(current.tagName.toLowerCase());
      }
      current = current.parentElement;
    }
    
    if (path.length === 0) return el.tagName.toLowerCase();
    
    // Simplify if too long to avoid fragile nth-child or long chains
    if (path.length > 3) {
       path = [path[0], path[path.length - 2], path[path.length - 1]].filter(Boolean);
    }
    
    const selector = path.join(' > ');
    return selector;
  };

  const addDiag = (field, selector, method, confidence) => {
    if(selector) {
      diagnostics.push({ field, selector, method, confidence });
    }
  };

  const isCurrency = (text) => {
    return !!text.match(/[\$\£\€\₹]/) || !!text.match(/\d+(\.\d{2})?\s*(usd|eur|gbp|inr)/i);
  };

  // --- PRODUCT DETECTOR ---
  const detectProducts = () => {
    const elements = Array.from(doc.querySelectorAll('div, li, article, section'));
    const structureMap = new Map();
    
    // Group elements by structural signature
    elements.forEach(el => {
      // Must have some content to be a product card
      if (el.children.length < 2 || el.children.length > 30) return;
      
      const tagPath = Array.from(el.children).map(c => c.tagName).join('>');
      // Also factor in classes of immediate children if available, for more robust grouping
      const classPath = Array.from(el.children).map(c => (c.className || '').toString().split(' ')[0]).join('>');
      
      const signature = `${el.tagName}:${tagPath}:${classPath}`;
      if (!structureMap.has(signature)) structureMap.set(signature, []);
      structureMap.get(signature).push(el);
    });

    let bestGroup = [];
    let bestScore = 0;
    
    for (const [sig, els] of structureMap.entries()) {
      if (els.length < 2) continue; // Need at least 2 repeated items for a grid
      
      let score = Math.min(els.length * 0.2, 2); // Cap repeat bonus
      const sample = els[0];
      const text = sample.textContent.toLowerCase();
      const html = sample.innerHTML.toLowerCase();
      const cls = (sample.className || '').toString().toLowerCase();
      
      // Semantic hints
      if (cls.includes('product') || cls.includes('item') || cls.includes('card')) score += 2;
      
      // Structural hints for products
      if (sample.querySelector('img') || html.includes('background-image')) score += 1.5;
      if (isCurrency(text)) score += 2.5; // Strong signal
      if (sample.querySelector('h1, h2, h3, h4, h5, h6')) score += 1;
      
      // Action hints
      const addBtns = Array.from(sample.querySelectorAll('button, a')).filter(b => {
          const bTxt = b.textContent.toLowerCase();
          return bTxt.includes('cart') || bTxt.includes('bag') || bTxt.includes('buy') || bTxt.includes('add');
      });
      if (addBtns.length > 0) score += 2;
      
      if (score > bestScore) {
        bestScore = score;
        bestGroup = els;
      }
    }

    if (bestGroup.length > 0 && bestScore >= 4) { // Increased threshold
      const card = bestGroup[0];
      const grid = card.parentElement;
      
      result.product.container = getSelector(card, grid);
      result.confidence.product = Math.min(bestScore / 10, 0.98);
      
      addDiag('product.container', result.product.container, 'repeated-structure', result.confidence.product);

      // Extract inner elements
      const img = card.querySelector('img, [class*="img"], [class*="image"], [class*="thumb"]');
      if (img) {
          result.product.image = getSelector(img, card);
          addDiag('product.image', result.product.image, 'tag/class', 0.9);
      }
      
      const titles = Array.from(card.querySelectorAll('h1, h2, h3, h4, h5, h6, .title, .name, .product-title'));
      if (titles.length > 0) {
          result.product.title = getSelector(titles[0], card);
          addDiag('product.title', result.product.title, 'heading/class', 0.95);
      }
      
      // Find prices
      const textEls = Array.from(card.querySelectorAll('*')).filter(el => el.children.length === 0 && el.textContent.trim().length > 0);
      const priceEls = textEls.filter(el => isCurrency(el.textContent));
      
      if (priceEls.length > 0) {
        // If multiple prices, try to distinguish sale vs old
        if (priceEls.length > 1) {
            // Often old price has a strikethrough or 'old' class
            let oldPriceEl = priceEls.find(el => (el.className||'').toLowerCase().includes('old') || window.getComputedStyle?.(el)?.textDecorationLine === 'line-through' || el.tagName.toLowerCase() === 's' || el.tagName.toLowerCase() === 'del');
            let salePriceEl = priceEls.find(el => el !== oldPriceEl);
            
            if(!oldPriceEl) {
                // Heuristic: smaller numerical value is sale price
                const val1 = parseFloat(priceEls[0].textContent.replace(/[^0-9.]/g, ''));
                const val2 = parseFloat(priceEls[1].textContent.replace(/[^0-9.]/g, ''));
                if(val1 > val2) {
                    oldPriceEl = priceEls[0];
                    salePriceEl = priceEls[1];
                } else {
                    oldPriceEl = priceEls[1];
                    salePriceEl = priceEls[0];
                }
            }
            
            if (oldPriceEl) {
                result.product.oldPrice = getSelector(oldPriceEl, card);
                addDiag('product.oldPrice', result.product.oldPrice, 'currency+heuristic', 0.85);
            }
            if (salePriceEl) {
                result.product.salePrice = getSelector(salePriceEl, card);
                result.product.price = result.product.salePrice; // Default to sale
                addDiag('product.salePrice', result.product.salePrice, 'currency+heuristic', 0.85);
            }
        } else {
            result.product.price = getSelector(priceEls[0], card);
            addDiag('product.price', result.product.price, 'currency', 0.95);
        }
      }
      
      // Find buttons
      const addBtns = Array.from(card.querySelectorAll('button, a, [role="button"]')).filter(el => {
          const txt = el.textContent.toLowerCase();
          const cls = (el.className||'').toString().toLowerCase();
          const href = (el.getAttribute('href')||'').toLowerCase();
          const inHtml = el.innerHTML.toLowerCase();
          return txt.includes('cart') || txt.includes('buy') || txt.includes('add') || 
                 cls.includes('cart') || href.includes('cart') || inHtml.includes('cart') || inHtml.includes('bag') || inHtml.includes('basket');
      });
      if (addBtns.length > 0) {
        result.product.addBtn = getSelector(addBtns[0], card);
        addDiag('product.addBtn', result.product.addBtn, 'text/class/href', 0.9);
      }
      
      const links = Array.from(card.querySelectorAll('a')).filter(a => !addBtns.includes(a) && a.href);
      if(links.length > 0) {
          result.product.productLink = getSelector(links[0], card);
      }
    }
  };

  // --- CART DETECTOR ---
  const detectCart = () => {
    let bestCartScore = 0;
    let bestCartContainer = null;
    let bestCartItem = null;
    let isTable = false;

    // 1. Try table-based cart
    const tables = Array.from(doc.querySelectorAll('table'));
    for (const table of tables) {
        const text = table.textContent.toLowerCase();
        let score = 0;
        if (text.includes('product') || text.includes('item')) score++;
        if (text.includes('price')) score++;
        if (text.includes('quantity') || text.includes('qty')) score++;
        if (text.includes('total')) score++;
        if (text.includes('remove') || text.includes('delete') || text.includes('action')) score++;
        
        if (score > bestCartScore && score >= 2) {
            bestCartScore = score;
            bestCartContainer = table;
            const itemRow = Array.from(table.querySelectorAll('tbody tr')).find(tr => !tr.querySelector('th') && tr.textContent.trim().length > 0);
            if(itemRow) bestCartItem = itemRow;
            isTable = true;
        }
    }
    
    // 2. Try div/card-based cart
    if (bestCartScore < 3) {
        const containers = Array.from(doc.querySelectorAll('.cart, .cart-container, .shopping-cart, #cart, [data-cart]'));
        for(const container of containers) {
            const items = Array.from(container.querySelectorAll('.cart-item, .item, [class*="item"], article, div')).filter(el => {
               // Look for qty + price + remove inside
               const text = el.textContent.toLowerCase();
               return (text.includes('qty') || el.querySelector('input[type="number"]')) && isCurrency(text);
            });
            
            if(items.length > 0) {
                let score = 3; // Baseline for explicit class + found items
                if(score > bestCartScore) {
                    bestCartScore = score;
                    bestCartContainer = container;
                    bestCartItem = items[0];
                    isTable = false;
                }
            }
        }
    }
    
    if (bestCartContainer && bestCartItem) {
        result.cart.container = getSelector(bestCartContainer);
        result.cart.item = getSelector(bestCartItem, bestCartContainer);
        result.confidence.cart = Math.min(bestCartScore / 5, 0.95);
        
        addDiag('cart.container', result.cart.container, isTable ? 'table-semantics' : 'class-heuristics', result.confidence.cart);
        addDiag('cart.item', result.cart.item, 'child-of-container', result.confidence.cart);

        // Extract inner fields from item
        const qtyInput = bestCartItem.querySelector('input[type="number"], input[class*="qty"], input[name*="qty"]');
        if(qtyInput) {
            result.cart.quantityInput = getSelector(qtyInput, bestCartItem);
            addDiag('cart.quantity', result.cart.quantityInput, 'input-type/name', 0.9);
        }
        
        const removeBtns = Array.from(bestCartItem.querySelectorAll('button, a')).filter(el => {
            const txt = el.textContent.toLowerCase();
            const cls = (el.className || '').toString().toLowerCase();
            return txt.includes('×') || txt.includes('remove') || txt.includes('delete') || cls.includes('remove') || cls.includes('delete');
        });
        if(removeBtns.length > 0) {
            result.cart.removeBtn = getSelector(removeBtns[0], bestCartItem);
            addDiag('cart.remove', result.cart.removeBtn, 'text/class', 0.9);
        }
        
        const textEls = Array.from(bestCartItem.querySelectorAll('*')).filter(el => el.children.length === 0);
        const priceEls = textEls.filter(el => isCurrency(el.textContent));
        
        if(priceEls.length > 0) { 
            result.cart.price = getSelector(priceEls[0], bestCartItem);
            addDiag('cart.price', result.cart.price, 'currency', 0.85);
            if(priceEls.length > 1) {
                result.cart.lineTotal = getSelector(priceEls[priceEls.length-1], bestCartItem);
            }
        }
    }
  };

  // --- CHECKOUT DETECTOR ---
  const detectCheckout = () => {
    let forms = Array.from(doc.querySelectorAll('form'));
    let bestForm = null;
    let bestScore = 0;
    
    if (forms.length === 0) forms = Array.from(doc.querySelectorAll('.checkout-form, .billing-details, #checkout'));
    
    for (const form of forms) {
        const text = form.textContent.toLowerCase();
        let score = 0;
        const inputs = form.querySelectorAll('input, select, textarea');
        score += inputs.length * 0.1;
        
        // Semantic hints
        if (text.includes('billing')) score += 1;
        if (text.includes('shipping')) score += 1;
        if (text.includes('payment')) score += 1;
        if (text.includes('order')) score += 0.5;
        if (text.includes('name') && text.includes('email') && text.includes('address')) score += 2;
        if (form.className && typeof form.className === 'string' && form.className.toLowerCase().includes('checkout')) score += 2;
        
        if (score > bestScore && inputs.length >= 3) {
            bestScore = score;
            bestForm = form;
        }
    }
    
    if (bestForm) {
        result.checkout.form = getSelector(bestForm);
        result.confidence.checkout = Math.min(bestScore / 7, 0.95);
        addDiag('checkout.form', result.checkout.form, 'form-semantics', result.confidence.checkout);
        
        const inputs = Array.from(bestForm.querySelectorAll('input, select, textarea'));
        inputs.forEach(input => {
           const name = (input.name || '').toLowerCase();
           const id = (input.id || '').toLowerCase();
           const placeholder = (input.placeholder || '').toLowerCase();
           const type = (input.type || '').toLowerCase();
           const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
           
           let labelText = '';
           if(id) {
               const label = doc.querySelector(`label[for="${id}"]`);
               if(label) labelText = label.textContent.toLowerCase();
           }
           if(!labelText && input.parentElement && input.parentElement.tagName === 'LABEL') {
               labelText = input.parentElement.textContent.toLowerCase();
           }
           
           const combined = `${name} ${id} ${placeholder} ${labelText} ${autocomplete}`.trim();
           const selector = getSelector(input, bestForm);
           
           // Match based on combined signals
           if(!result.checkout.firstName && (combined.includes('first') && combined.includes('name') || autocomplete === 'given-name')) {
               result.checkout.firstName = selector; addDiag('checkout.firstName', selector, 'signal-match', 0.9);
           }
           else if(!result.checkout.lastName && (combined.includes('last') && combined.includes('name') || autocomplete === 'family-name')) {
               result.checkout.lastName = selector; addDiag('checkout.lastName', selector, 'signal-match', 0.9);
           }
           else if(!result.checkout.fullName && ((combined.includes('full') && combined.includes('name')) || name === 'name' || autocomplete === 'name')) {
               result.checkout.fullName = selector; addDiag('checkout.fullName', selector, 'signal-match', 0.8);
           }
           else if(!result.checkout.email && (combined.includes('email') || type === 'email' || autocomplete === 'email')) {
               result.checkout.email = selector; addDiag('checkout.email', selector, 'signal-match', 0.95);
           }
           else if(!result.checkout.phone && (combined.includes('phone') || combined.includes('mobile') || type === 'tel' || autocomplete === 'tel')) {
               result.checkout.phone = selector; addDiag('checkout.phone', selector, 'signal-match', 0.9);
           }
           else if(!result.checkout.address && (combined.includes('address') || combined.includes('street') || autocomplete.includes('street-address'))) {
               result.checkout.address = selector; addDiag('checkout.address', selector, 'signal-match', 0.9);
           }
           else if(!result.checkout.city && (combined.includes('city') || combined.includes('town') || autocomplete === 'address-level2')) {
               result.checkout.city = selector; addDiag('checkout.city', selector, 'signal-match', 0.9);
           }
           else if(!result.checkout.state && (combined.includes('state') || combined.includes('province') || autocomplete === 'address-level1')) {
               result.checkout.state = selector; addDiag('checkout.state', selector, 'signal-match', 0.9);
           }
           else if(!result.checkout.country && (combined.includes('country') || combined.includes('nation') || autocomplete === 'country')) {
               result.checkout.country = selector; addDiag('checkout.country', selector, 'signal-match', 0.9);
           }
           else if(!result.checkout.postalCode && (combined.includes('zip') || combined.includes('postal') || autocomplete === 'postal-code')) {
               result.checkout.postalCode = selector; addDiag('checkout.postalCode', selector, 'signal-match', 0.9);
           }
        });
        
        const submitBtns = Array.from(bestForm.querySelectorAll('button, input[type="submit"], a')).filter(el => {
            const txt = (el.value || el.textContent || '').toLowerCase();
            return txt.includes('place order') || txt.includes('checkout') || txt.includes('confirm') || txt.includes('submit') || txt.includes('pay') || el.type === 'submit';
        });
        if(submitBtns.length > 0) {
            result.checkout.submitBtn = getSelector(submitBtns[0], bestForm);
            addDiag('checkout.submit', result.checkout.submitBtn, 'button-semantics', 0.9);
        }
    }
  };

  detectProducts();
  detectCart();
  detectCheckout();

  return result;
};

// Backward compatible export for existing EcommerceStoreBuilder
export const analyzePageElements = (html) => {
    const semantics = analyzePageSemantics(html);
    return {
        ...semantics,
        header: '',
        footer: '',
        productGrid: '',
        productCard: semantics.product.container,
        productImage: semantics.product.image,
        productName: semantics.product.title,
        productPrice: semantics.product.price,
        salePrice: semantics.product.salePrice,
        productDescription: semantics.product.description,
        productLink: semantics.product.productLink,
        addBtn: semantics.product.addBtn,
        cartContainer: semantics.cart.container,
        cartItem: semantics.cart.item,
        cartTotal: '', 
        checkoutForm: semantics.checkout.form,
        checkoutSummary: ''
    };
};
