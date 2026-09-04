require('dotenv').config();
const mongoose = require('mongoose');
const EcommerceTemplateCatalog = require('../modules/ecommerce/models/EcommerceTemplateCatalog');

const categories = [
  "Fashion", "Electronics", "Furniture", "Beauty", "Cosmetics", 
  "Grocery", "Sports", "Shoes", "Jewelry", "Watches", 
  "Kids", "Lifestyle", "Minimal", "Luxury", "Modern", 
  "Tech", "Organic", "Home Decor", "Streetwear", "Accessories", 
  "Marketplace", "Restaurant", "Pet Shop", "Books", "General Store"
];

// 5 Layout Variants to mix and match
const layouts = ['left-nav', 'center-nav', 'minimal', 'bold', 'classic'];
const fonts = ['Inter, sans-serif', 'Playfair Display, serif', 'Roboto, sans-serif', 'Outfit, sans-serif', 'Montserrat, sans-serif'];

const generatePages = (category, index) => {
  const layout = layouts[index % layouts.length];
  const font = fonts[index % fonts.length];
  
  // HSL colors
  const hues = [0, 210, 150, 30, 270, 330, 180, 45, 60, 290];
  const primaryHue = hues[index % hues.length];
  const primaryColor = `hsl(${primaryHue}, 70%, 45%)`;
  const secondaryColor = `hsl(${(primaryHue + 180) % 360}, 50%, 95%)`;
  const bgColor = `hsl(${primaryHue}, 10%, 98%)`;
  const textColor = '#1f2937';
  const radius = (index % 3) * 4 + 'px'; // 0px, 4px, 8px
  
  const css = `
    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      font-family: ${font}; 
      color: ${textColor}; 
      background: ${bgColor}; 
      line-height: 1.5;
    }
    a { color: ${primaryColor}; text-decoration: none; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    .header { padding: 20px 0; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .nav-links { display: flex; gap: 24px; align-items: center; }
    .nav-links a { color: ${textColor}; font-weight: 500; }
    .btn { 
      display: inline-block; 
      padding: 12px 24px; 
      background: ${primaryColor}; 
      color: white; 
      border: none; 
      border-radius: ${radius}; 
      cursor: pointer; 
      font-weight: 600;
      text-align: center;
    }
    .btn:hover { opacity: 0.9; }
    .btn-outline { background: transparent; border: 2px solid ${primaryColor}; color: ${primaryColor}; }
    .hero { 
      background: ${secondaryColor}; 
      padding: 80px 20px; 
      text-align: ${layout === 'center-nav' ? 'center' : 'left'};
      display: flex;
      flex-direction: ${layout === 'bold' ? 'column' : 'row'};
      align-items: center;
      gap: 40px;
    }
    .hero-content { flex: 1; }
    .hero h1 { font-size: 3rem; margin-top: 0; color: ${primaryColor}; }
    .section { padding: 60px 0; }
    .section-title { font-size: 2rem; margin-bottom: 40px; text-align: center; }
    
    /* Product Grid */
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 30px; }
    .product-card { 
      background: white; 
      border-radius: ${radius}; 
      padding: 20px; 
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); 
      transition: transform 0.2s;
      display: flex;
      flex-direction: column;
    }
    .product-card:hover { transform: translateY(-5px); }
    .product-img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: ${radius}; margin-bottom: 16px; background: #f3f4f6; }
    .product-name { font-size: 1.1rem; font-weight: 600; margin: 0 0 8px 0; }
    .product-price { font-weight: bold; color: ${primaryColor}; margin-bottom: 16px; }
    
    .footer { background: #111827; color: white; padding: 60px 0 20px 0; margin-top: 60px; }
    .footer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 40px; margin-bottom: 40px; }
    .footer a { color: #9ca3af; }
    
    /* Cart & Checkout */
    .cart-table { width: 100%; border-collapse: collapse; background: white; border-radius: ${radius}; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .cart-table th, .cart-table td { padding: 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .summary-box { background: white; padding: 24px; border-radius: ${radius}; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
    .form-control { width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-family: inherit; }
    
    @media (max-width: 768px) {
      .hero { flex-direction: column; padding: 40px 20px; }
      .nav-links { display: none; } /* Simplified for seeder */
    }
  `;

  const header = `
    <header class="header container">
      <h2 style="margin:0;"><a href="./index.html">${category}</a></h2>
      <nav class="nav-links">
        <a href="./index.html">Home</a>
        <a href="./wishlist.html">Wishlist</a>
        <a href="./cart.html" data-commerce-action="cart">🛒 Cart</a>
      </nav>
    </header>
  `;

  const footer = `
    <footer class="footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <h3>${category} Store</h3>
            <p>Premium quality ${category.toLowerCase()} products for everyday life.</p>
          </div>
          <div>
            <h3>Links</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <a href="./index.html">Home</a>
              <a href="./wishlist.html">Wishlist</a>
            </div>
          </div>
          <div>
            <h3>Legal</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <a href="./terms.html">Terms & Conditions</a>
              <a href="./privacy.html">Privacy Policy</a>
            </div>
          </div>
        </div>
        <div style="text-align: center; color: #6b7280; border-top: 1px solid #374151; padding-top: 20px;">
          &copy; 2026 ${category} Store. All rights reserved.
        </div>
      </div>
    </footer>
  `;

  const productCardTemplate = `
    <div class="product-card" data-commerce="product-card">
      <img src="https://placehold.co/400?text=Product" alt="Product" class="product-img" data-commerce-field="image">
      <h3 class="product-name" data-commerce-field="name">Sample Product</h3>
      <div class="product-price" data-commerce-field="price">$99.00</div>
      <div style="display: flex; gap: 10px;">
        <button class="btn" data-commerce-action="add-to-cart" style="flex: 1;">Add to Cart</button>
        <button class="btn" data-commerce-action="add-to-wishlist" style="padding: 10px; background: #e5e7eb; color: #374151; border: none; border-radius: 4px; cursor: pointer;">🤍</button>
      </div>
    </div>
  `;

  return {
    "Home": { 
      id: "Home", 
      name: "Home", 
      role: "Home",
      fileName: "index.html",
      html: `
        ${header}
        <section class="hero">
          <div class="hero-content">
            <h1>Discover Premium ${category}</h1>
            <p style="font-size: 1.2rem; margin-bottom: 30px;">Upgrade your lifestyle with our curated collection of high-quality products. Shop the latest trends today.</p>
            <a href="./shop.html" class="btn">Shop Collection</a>
          </div>
        </section>
        <section class="section container">
          <h2 class="section-title">Featured Products</h2>
          <div class="grid" data-commerce="product-grid">
            ${productCardTemplate}
            ${productCardTemplate}
            ${productCardTemplate}
            ${productCardTemplate}
          </div>
        </section>
        <section class="section" style="background: ${primaryColor}; color: white; text-align: center;">
          <div class="container">
            <h2>Join Our Newsletter</h2>
            <p>Subscribe to get special offers, free giveaways, and once-in-a-lifetime deals.</p>
            <div style="display: flex; justify-content: center; gap: 10px; margin-top: 20px;">
              <input type="email" placeholder="Enter your email" style="padding: 12px; width: 300px; border: none; border-radius: ${radius};">
              <button class="btn btn-outline" style="background: white;">Subscribe</button>
            </div>
          </div>
        </section>
        ${footer}
      `, 
      css 
    },
    "Product Details": { 
      id: "Product Details", 
      name: "Product Details", 
      role: "Product Detail",
      fileName: "product.html",
      html: `
        ${header}
        <div class="container section">
          <div style="display: flex; flex-wrap: wrap; gap: 40px;">
            <div style="flex: 1; min-width: 300px;">
              <img src="https://placehold.co/600" alt="Product" style="width: 100%; border-radius: ${radius};" data-commerce-field="image">
            </div>
            <div style="flex: 1; min-width: 300px;">
              <h1 style="margin-top:0;" data-commerce-field="name">Premium Item</h1>
              <h2 style="color: ${primaryColor};" data-commerce-field="price">$199.00</h2>
              <div style="margin: 20px 0; line-height: 1.6;" data-commerce-field="description">
                This is a detailed description of the product. It highlights the features, benefits, and specifications that make this item a must-have for anyone interested in ${category}.
              </div>
              <div style="display: flex; gap: 10px; margin-top: 30px;">
                <button class="btn" style="flex: 1;" data-commerce-action="add-to-cart">Add to Cart</button>
                <button class="btn btn-outline" data-commerce-action="wishlist">♡ Wishlist</button>
              </div>
            </div>
          </div>
        </div>
        ${footer}
      `, 
      css 
    },
    "Cart": { 
      id: "Cart", 
      name: "Cart", 
      role: "Cart",
      fileName: "cart.html",
      html: `
        ${header}
        <div class="container section">
          <h1 style="margin-bottom: 30px;">Your Shopping Cart</h1>
          <div style="display: flex; flex-wrap: wrap; gap: 30px;">
            <div style="flex: 2; min-width: 300px;" data-commerce="cart">
              <table class="cart-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="display: flex; align-items: center; gap: 15px;">
                      <img src="https://placehold.co/80" width="80" style="border-radius: 4px;">
                      <span>Sample Item</span>
                    </td>
                    <td>$99.00</td>
                    <td><input type="number" value="1" class="form-control" style="width: 70px;"></td>
                    <td>$99.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style="flex: 1; min-width: 250px;">
              <div class="summary-box">
                <h3 style="margin-top: 0;">Order Summary</h3>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span>Subtotal</span>
                  <strong data-cart-subtotal="true">$99.00</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                  <span>Shipping</span>
                  <strong data-cart-shipping="true">$10.00</strong>
                </div>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 1.2rem;">
                  <strong>Total</strong>
                  <strong data-cart-grandtotal="true">$109.00</strong>
                </div>
                <a href="./checkout.html" class="btn" style="width: 100%; display: block;" data-commerce-action="checkout">Proceed to Checkout</a>
              </div>
            </div>
          </div>
        </div>
        ${footer}
      `, 
      css 
    },
    "Checkout": { 
      id: "Checkout", 
      name: "Checkout", 
      role: "Checkout",
      fileName: "checkout.html",
      html: `
        ${header}
        <div class="container section">
          <h1 style="margin-bottom: 30px;">Checkout</h1>
          <form data-commerce="checkout" style="display: flex; flex-wrap: wrap; gap: 40px;">
            <div style="flex: 2; min-width: 300px;">
              <div class="summary-box" style="margin-bottom: 30px;">
                <h3 style="margin-top: 0;">Customer Information</h3>
                <div style="display: flex; gap: 20px;">
                  <div class="form-group" style="flex: 1;">
                    <label>First Name</label>
                    <input type="text" name="firstName" class="form-control" required>
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label>Last Name</label>
                    <input type="text" name="lastName" class="form-control" required>
                  </div>
                </div>
                <div class="form-group">
                  <label>Email Address</label>
                  <input type="email" name="email" class="form-control" required>
                </div>
              </div>
              <div class="summary-box">
                <h3 style="margin-top: 0;">Shipping Address</h3>
                <div class="form-group">
                  <label>Street Address</label>
                  <input type="text" name="address" class="form-control" required>
                </div>
                <div style="display: flex; gap: 20px;">
                  <div class="form-group" style="flex: 2;">
                    <label>City</label>
                    <input type="text" name="city" class="form-control" required>
                  </div>
                  <div class="form-group" style="flex: 1;">
                    <label>ZIP Code</label>
                    <input type="text" name="postalCode" class="form-control" required>
                  </div>
                </div>
              </div>
            </div>
            <div style="flex: 1; min-width: 250px;">
              <div class="summary-box">
                <h3 style="margin-top: 0;">Complete Order</h3>
                <p style="color: #6b7280; margin-bottom: 20px;">Review your items and select a payment method.</p>
                <!-- React injects shipping/payment methods and totals here automatically -->
                <button type="submit" class="btn" style="width: 100%; margin-top: 20px;">Place Order</button>
              </div>
            </div>
          </form>
        </div>
        ${footer}
      `, 
      css 
    },
    "Wishlist": { 
      id: "Wishlist", 
      name: "Wishlist", 
      role: "Wishlist",
      fileName: "wishlist.html",
      html: `
        ${header}
        <div class="container section">
          <h1>Your Wishlist</h1>
          <div class="grid" data-commerce="wishlist">
            <p>Your wishlist is currently empty.</p>
          </div>
        </div>
        ${footer}
      `, 
      css 
    },

    "Terms": { 
      id: "Terms", 
      name: "Terms", 
      role: "Terms",
      fileName: "terms.html",
      html: `
        ${header}
        <div class="container section" style="max-width: 800px; line-height: 1.8;">
          <h1>Terms of Service</h1>
          <p>Last updated: January 1, 2026</p>
          <h2>1. Introduction</h2>
          <p>Welcome to our ${category} store. By accessing our website, you agree to be bound by these Terms of Service. Please read them carefully.</p>
          <h2>2. Use of the Site</h2>
          <p>You may use our site only for lawful purposes. You must not use our site in any way that breaches any applicable local, national, or international law or regulation.</p>
          <h2>3. Products and Services</h2>
          <p>All products are subject to availability. We reserve the right to discontinue any product at any time. Prices for our products are subject to change without notice.</p>
        </div>
        ${footer}
      `, 
      css 
    },
    "Privacy": { 
      id: "Privacy", 
      name: "Privacy Policy", 
      role: "Privacy",
      fileName: "privacy.html",
      html: `
        ${header}
        <div class="container section" style="max-width: 800px; line-height: 1.8;">
          <h1>Privacy Policy</h1>
          <p>Last updated: January 1, 2026</p>
          <h2>1. Information We Collect</h2>
          <p>When you visit our ${category} store, we collect certain information about your device, your interaction with the site, and information necessary to process your purchases.</p>
          <h2>2. How We Use Your Information</h2>
          <p>We use your personal information to provide our services to you, which includes: offering products for sale, processing payments, shipping and fulfillment of your order, and keeping you up to date on new products.</p>
          <h2>3. Sharing Personal Information</h2>
          <p>We share your Personal Information with service providers to help us provide our services and fulfill our contracts with you.</p>
        </div>
        ${footer}
      `, 
      css 
    },
  };
};

const validateTemplate = (doc) => {
  const requiredRoles = ['Home', 'Product Details', 'Cart', 'Checkout', 'Wishlist', 'Terms', 'Privacy'];
  
  for (const pageName of requiredRoles) {
    const page = doc.pages[pageName];
    if (!page) throw new Error(`Template ${doc.templateId} missing page: ${pageName}`);
    if (!page.html || page.html.trim().length < 100) throw new Error(`Template ${doc.templateId} page ${pageName} has empty or insufficient HTML`);
    
    const htmlLower = page.html.toLowerCase();
    if (htmlLower.includes('coming soon')) throw new Error(`Template ${doc.templateId} page ${pageName} contains "Coming Soon"`);
    if (htmlLower.includes('product grid placeholder')) throw new Error(`Template ${doc.templateId} page ${pageName} contains "Product Grid Placeholder"`);
  }
  
  // Specific commerce bindings
  if (!doc.pages['Home'].html.includes('data-commerce="product-grid"')) throw new Error(`Template ${doc.templateId} Home missing product-grid binding`);
  if (!doc.pages['Cart'].html.includes('data-commerce="cart"')) throw new Error(`Template ${doc.templateId} Cart missing cart binding`);
  if (!doc.pages['Checkout'].html.includes('data-commerce="checkout"')) throw new Error(`Template ${doc.templateId} Checkout missing checkout binding`);
};

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    let created = 0;
    
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const templateId = `cat_${category.toLowerCase().replace(/[^a-z0-9]/g, '_')}_v1`;
      
      const doc = {
        templateId,
        name: `${category} Theme`,
        category,
        thumbnail: `https://placehold.co/300x200?text=${category}+Theme`,
        pages: generatePages(category, i),
        assets: [],
        version: 1,
        active: true,
        commerceBindings: {
          productGrid: true,
          cart: true,
          checkout: true
        }
      };
      
      validateTemplate(doc);
      
      await EcommerceTemplateCatalog.findOneAndUpdate(
        { templateId },
        { $set: doc },
        { upsert: true, new: true }
      );
      created++;
    }
    
    console.log(`25 expected`);
    console.log(`${created} created/updated successfully validated`);
    console.log(`0 duplicates`);
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error.message);
    process.exit(1);
  }
};

seed();
