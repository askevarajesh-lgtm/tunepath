import React, { useEffect, useRef, useMemo } from 'react';
import { useStorefront } from '../StorefrontContext';
import { formatCurrency } from '../../utils/currency';

const CartItem = ({ item, templateHtml, mapping }) => {
  const { updateQty, removeFromCart, workspaceId, websiteId, storeId } = useStorefront();
  const containerRef = useRef(null);

  // Parse template and inject cart item data into the original DOM structure
  const processedHtml = useMemo(() => {
    if (!templateHtml) return '';
    
    let htmlToParse = templateHtml;
    const isTr = templateHtml.trim().toLowerCase().startsWith('<tr');
    if (isTr) {
      htmlToParse = `<table><tbody>${templateHtml}</tbody></table>`;
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlToParse, 'text/html');
    const itemEl = isTr ? doc.querySelector('tr') : doc.body.firstElementChild;
    if (!itemEl) return '';

    const cols = isTr ? Array.from(itemEl.querySelectorAll('td, th')) : Array.from(itemEl.children);

    const replaceDeepText = (el, newText) => {
      if (!el) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      let node;
      let replaced = false;
      while (node = walker.nextNode()) {
        if (node.textContent.trim() !== '') {
          node.textContent = newText;
          replaced = true;
          break;
        }
      }
    };

    // Image
    let imgEls = [];
    if (mapping?.cart?.image) imgEls = Array.from(itemEl.querySelectorAll(mapping.cart.image));
    if (imgEls.length === 0) imgEls = Array.from(itemEl.querySelectorAll('img, [class*="thumb"], [class*="img"]'));
    
    if (imgEls.length === 0 && cols.length > 0) {
      const img = doc.createElement('img');
      img.style.width = '50px';
      img.style.height = '50px';
      img.style.objectFit = 'cover';
      img.style.marginRight = '10px';
      cols[0].insertBefore(img, cols[0].firstChild);
      imgEls = [img];
    }
    imgEls.forEach(img => {
      if (img.tagName === 'IMG') {
        img.src = item.image || '';
        img.alt = item.name;
      }
    });

    // Name
    let nameNode;
    let nameReplaced = false;
    if (mapping?.cart?.name) {
       const mappedName = itemEl.querySelector(mapping.cart.name);
       if (mappedName) {
         replaceDeepText(mappedName, item.name);
         nameReplaced = true;
       }
    }
    
    if (!nameReplaced) {
      const nameWalker = document.createTreeWalker(cols[0] || itemEl, NodeFilter.SHOW_TEXT, null, false);
      while (nameNode = nameWalker.nextNode()) {
      const txt = nameNode.textContent.trim();
      if (txt !== '') {
        if (!nameReplaced) {
          nameNode.textContent = item.name;
          nameReplaced = true;
        } else {
          const lowerTxt = txt.toLowerCase();
          if (lowerTxt.includes('product') || lowerTxt.includes('name') || lowerTxt === item.name.toLowerCase()) {
            nameNode.textContent = '';
          }
        }
      }
    }
    }
    // If we didn't find any text node to replace, inject a span for the name
    if (!nameReplaced && (cols[0] || itemEl)) {
      const span = doc.createElement('span');
      span.textContent = item.name;
      (cols[0] || itemEl).appendChild(span);
    }

    // Price
    let priceEls = [];
    if (mapping?.cart?.price) {
        const found = itemEl.querySelector(mapping.cart.price);
        if (found) priceEls.push(found);
    }
    if (mapping?.cart?.lineTotal) {
        const found = itemEl.querySelector(mapping.cart.lineTotal);
        if (found) priceEls.push(found);
    }
    
    if (priceEls.length === 0) {
      priceEls = Array.from(itemEl.querySelectorAll('[class*="price"]'));
      if (priceEls.length === 0) {
        if (cols.length >= 2) priceEls.push(cols[1]);
        if (cols.length >= 4) priceEls.push(cols[3]); // Total
      }
    }
    
    if (priceEls.length > 0) {
      replaceDeepText(priceEls[0], formatCurrency(item.price, workspaceId, websiteId, storeId));
      if (priceEls.length > 1) { 
        replaceDeepText(priceEls[1], formatCurrency(item.price * item.quantity, workspaceId, websiteId, storeId));
      }
    }

    // Quantity Input
    let inputEls = [];
    if (mapping?.cart?.quantityInput) {
       inputEls = Array.from(itemEl.querySelectorAll(mapping.cart.quantityInput));
    }
    if (inputEls.length === 0) {
       inputEls = Array.from(itemEl.querySelectorAll('input[type="number"], input[name="quantity"], [class*="qty"] input'));
    }
    
    if (inputEls.length === 0) {
      const anyInputs = itemEl.querySelectorAll('input');
      if (anyInputs.length > 0) {
        inputEls = Array.from(anyInputs);
      } else if (cols.length >= 3) {
        cols[2].innerHTML = '';
        const input = doc.createElement('input');
        input.type = 'number';
        input.style.width = '60px';
        cols[2].appendChild(input);
        inputEls.push(input);
      }
    }
    inputEls.forEach(input => {
      if (input.tagName === 'INPUT') {
        input.setAttribute('value', item.quantity);
        input.value = item.quantity; // Set property as well
        if (item.stock) input.setAttribute('max', item.stock);
        input.setAttribute('min', '1');
        input.setAttribute('data-cart-action', 'update-qty');
      }
    });

    // Remove Button
    let removeEls = [];
    if (mapping?.cart?.removeBtn) {
       removeEls = Array.from(itemEl.querySelectorAll(mapping.cart.removeBtn));
    }
    if (removeEls.length === 0) {
       removeEls = Array.from(itemEl.querySelectorAll('[class*="remove"], [class*="delete"], .btn-remove'));
    }
    
    if (removeEls.length === 0 && cols.length >= 5) {
      let btn = cols[4].querySelector('button, a');
      if (!btn) {
        cols[4].innerHTML = '';
        btn = doc.createElement('button');
        btn.textContent = 'Remove';
        btn.className = 'btn btn-danger btn-sm';
        cols[4].appendChild(btn);
      }
      removeEls.push(btn);
    }
    removeEls.forEach(btn => {
      btn.setAttribute('data-cart-action', 'remove');
      if (btn.tagName === 'A' && !btn.getAttribute('href')) btn.href = '#';
    });

    itemEl.setAttribute('data-cart-item-id', item.id);
    
    const attrs = {};
    Array.from(itemEl.attributes).forEach(attr => {
      if (attr.name === 'class') attrs.className = attr.value;
      else if (attr.name !== 'style') attrs[attr.name] = attr.value;
    });

    return {
      tagName: itemEl.tagName.toLowerCase(),
      innerHtml: itemEl.innerHTML,
      attrs
    };
  }, [templateHtml, item, workspaceId, websiteId, storeId]);

  // Bind native event listeners to the injected HTML
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e) => {
      const removeBtn = e.target.closest('[data-cart-action="remove"]');
      if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        removeFromCart(item.id);
      }
    };

    const handleChange = (e) => {
      const input = e.target.closest('[data-cart-action="update-qty"]');
      if (input) {
        const val = parseInt(input.value, 10);
        if (val > 0) {
          updateQty(item.id, val);
        }
      }
    };

    container.addEventListener('click', handleClick);
    container.addEventListener('change', handleChange); // input event better for number inputs
    container.addEventListener('input', handleChange);

    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('change', handleChange);
      container.removeEventListener('input', handleChange);
    };
  }, [item, removeFromCart, updateQty]);

  if (!processedHtml) return null;

  const Wrapper = processedHtml.tagName;
  const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
  const isVoid = voidElements.includes(Wrapper);

  if (isVoid) {
    return (
      <Wrapper 
        ref={containerRef}
        {...processedHtml.attrs}
      />
    );
  }

  return (
    <Wrapper 
      ref={containerRef}
      {...processedHtml.attrs}
      dangerouslySetInnerHTML={{ __html: processedHtml.innerHtml }} 
    />
  );
};

export default CartItem;
