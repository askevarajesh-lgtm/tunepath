import React, { useRef, useMemo } from 'react';
import { useStorefront } from '../StorefrontContext';
import { formatCurrency } from '../../utils/currency';

const CheckoutItem = ({ item, templateHtml, mapping }) => {
  const { workspaceId, websiteId, storeId } = useStorefront();
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
      if (!replaced && el.tagName !== 'IMG' && el.tagName !== 'INPUT') {
        el.textContent = newText;
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
      priceEls = Array.from(itemEl.querySelectorAll('[class*="price"], [class*="total"]'));
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

    // Quantity Text (Read Only for Checkout)
    let qtyEls = [];
    if (mapping?.cart?.quantityInput) {
       qtyEls = Array.from(itemEl.querySelectorAll(mapping.cart.quantityInput));
    }
    if (qtyEls.length === 0) {
       qtyEls = Array.from(itemEl.querySelectorAll('input[type="number"], input[name="quantity"], [class*="qty"]'));
    }
    
    qtyEls.forEach(el => {
      if (el.tagName === 'INPUT') {
         // Replace input with plain text span for checkout summary
         const span = doc.createElement('span');
         span.textContent = item.quantity;
         span.className = el.className;
         if(el.parentElement) el.parentElement.replaceChild(span, el);
      } else {
         // Just replace text containing numbers
         const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
         let node;
         while (node = walker.nextNode()) {
           if (node.textContent.trim().match(/^\d+$/)) {
             node.textContent = item.quantity;
           }
         }
         // Fallback if no specific digit text node
         if (!el.textContent.match(/\d/)) {
            el.innerHTML += ` <span style="margin-left:5px">× ${item.quantity}</span>`;
         }
      }
    });

    // Remove "Remove" Button from Checkout Summary
    let removeEls = [];
    if (mapping?.cart?.removeBtn) {
       removeEls = Array.from(itemEl.querySelectorAll(mapping.cart.removeBtn));
    }
    if (removeEls.length === 0) {
       removeEls = Array.from(itemEl.querySelectorAll('[class*="remove"], [class*="delete"], .btn-remove'));
    }
    removeEls.forEach(btn => btn.remove());

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

export default CheckoutItem;
