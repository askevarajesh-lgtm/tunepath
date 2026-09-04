const EcommerceProduct = require('./models/EcommerceProduct');
const EcommerceOrder = require('./models/EcommerceOrder');
const EcommerceCustomer = require('./models/EcommerceCustomer');
const EcommercePayment = require('./models/EcommercePayment');
const EcommerceShipping = require('./models/EcommerceShipping');
const EcommerceSettings = require('./models/EcommerceSettings');
const EcommerceStore = require('./models/EcommerceStore');
const EcommerceTemplateCatalog = require('./models/EcommerceTemplateCatalog');

// Helper to construct isolated query — scope by workspace + website + store
const getIsolatedQuery = (req) => {
  if (!req.workspaceId) throw new Error('Unauthorized: Missing workspaceId');
  if (!req.params.websiteId) throw new Error('Bad Request: Missing websiteId');
  if (!req.params.storeId) throw new Error('Bad Request: Missing storeId');
  return {
    workspaceId: req.workspaceId,
    websiteId: req.params.websiteId,
    storeId: req.params.storeId
  };
};

// Helper for Template queries (scoped by workspace + website only)
const getTemplateQuery = (req) => {
  if (!req.workspaceId) throw new Error('Unauthorized: Missing workspaceId');
  if (!req.params.websiteId) throw new Error('Bad Request: Missing websiteId');
  return {
    workspaceId: req.workspaceId,
    websiteId: req.params.websiteId
  };
};

// --- CATALOG ---
exports.getCatalogTemplates = async (req, res, next) => {
  try {
    const catalog = await EcommerceTemplateCatalog.find({ active: true });
    res.json({ success: true, data: catalog });
  } catch (error) { next(error); }
};

exports.getCatalogTemplate = async (req, res, next) => {
  try {
    const template = await EcommerceTemplateCatalog.findOne({ templateId: req.params.templateId });
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (error) { next(error); }
};

// --- STORES (formerly Templates) ---
exports.getStores = async (req, res, next) => {
  try {
    const stores = await EcommerceStore.find(getTemplateQuery(req));
    
    // Map to object keyed by storeId (which uses the templateId field in DB)
    const storeMap = {};
    stores.forEach(s => {
      const sObj = s.toObject();
      sObj.id = sObj.templateId; 
      storeMap[sObj.templateId] = sObj;
    });
    
    res.json({ success: true, data: storeMap });
  } catch (error) { next(error); }
};

exports.createStore = async (req, res, next) => {
  try {
    let pages = req.body.pages || {};
    let assets = req.body.assets || {};
    
    // If a catalogTemplateId is provided, we clone it
    if (req.body.catalogTemplateId) {
      const sourceTpl = await EcommerceTemplateCatalog.findOne({ templateId: req.body.catalogTemplateId });
      if (sourceTpl) {
        pages = sourceTpl.pages || {};
        assets = sourceTpl.assets || {};
      }
    }
    
    const store = new EcommerceStore({
      ...getTemplateQuery(req),
      templateId: req.body.id || `store_${Date.now()}`, // Using templateId field as store ID
      name: req.body.name,
      sourceTemplateId: req.body.catalogTemplateId || null,
      sourceTemplateVersion: 1,
      pages: pages,
      assets: assets
    });
    await store.save();
    
    const sObj = store.toObject();
    sObj.id = sObj.templateId;
    
    res.json({ success: true, data: sObj });
  } catch (error) { next(error); }
};

exports.updateStore = async (req, res, next) => {
  try {
    const query = { ...getTemplateQuery(req), templateId: req.params.storeId || req.params.templateId };
    
    const updateData = req.body;
    if (updateData.id) delete updateData.id;
    if (updateData.templateId) delete updateData.templateId;

    const store = await EcommerceStore.findOneAndUpdate(
      query,
      { $set: updateData },
      { new: true, upsert: true }
    );
    
    const sObj = store.toObject();
    sObj.id = sObj.templateId;
    
    res.json({ success: true, data: sObj });
  } catch (error) { next(error); }
};

exports.deleteStore = async (req, res, next) => {
  try {
    const query = { ...getTemplateQuery(req), templateId: req.params.storeId || req.params.templateId };
    const store = await EcommerceStore.findOneAndDelete(query);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });
    res.json({ success: true, message: 'Store deleted' });
  } catch (error) { next(error); }
};

// --- PRODUCTS ---
exports.getProducts = async (req, res, next) => {
  try {
    const products = await EcommerceProduct.find(getIsolatedQuery(req)).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) { next(error); }
};

exports.createProduct = async (req, res, next) => {
  try {
    const query = getIsolatedQuery(req);
    const product = new EcommerceProduct({ ...req.body, ...query });
    await product.save();
    res.json({ success: true, data: product });
  } catch (error) { next(error); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const query = { ...getIsolatedQuery(req), _id: req.params.productId };
    const product = await EcommerceProduct.findOneAndUpdate(query, req.body, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) { next(error); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const query = { ...getIsolatedQuery(req), _id: req.params.productId };
    const product = await EcommerceProduct.findOneAndDelete(query);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) { next(error); }
};

// --- SETTINGS ---
exports.getSettings = async (req, res, next) => {
  try {
    const query = getIsolatedQuery(req);
    let settings = await EcommerceSettings.findOne(query);
    if (!settings) {
      settings = new EcommerceSettings({
        ...query,
        paymentMethods: [
          { id: 'COD', name: 'Cash on Delivery', enabled: true },
          { id: 'Razorpay', name: 'Razorpay', enabled: false },
          { id: 'Stripe', name: 'Stripe', enabled: false }
        ],
        shippingMethods: [
          { id: 'standard', name: 'Standard Delivery', price: 50, enabled: true },
          { id: 'express', name: 'Express Delivery', price: 120, enabled: false }
        ]
      });
      try {
        await settings.save();
      } catch (err) {
        console.warn('Fallback settings save failed in getSettings (legacy index?):', err.message);
      }
    }
    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const query = getIsolatedQuery(req);
    const settings = await EcommerceSettings.findOneAndUpdate(query, req.body, { new: true, upsert: true });
    res.json({ success: true, data: settings });
  } catch (error) { next(error); }
};

// --- READ-ONLY ADMIN ENTITIES ---
exports.getOrders = async (req, res, next) => {
  try {
    const orders = await EcommerceOrder.find(getIsolatedQuery(req)).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) { next(error); }
};

exports.getCustomers = async (req, res, next) => {
  try {
    const customers = await EcommerceCustomer.find(getIsolatedQuery(req)).sort({ createdAt: -1 });
    res.json({ success: true, data: customers });
  } catch (error) { next(error); }
};

exports.getPayments = async (req, res, next) => {
  try {
    const payments = await EcommercePayment.find(getIsolatedQuery(req)).sort({ createdAt: -1 });
    res.json({ success: true, data: payments });
  } catch (error) { next(error); }
};

exports.getShipping = async (req, res, next) => {
  try {
    const shipping = await EcommerceShipping.find(getIsolatedQuery(req)).sort({ createdAt: -1 });
    res.json({ success: true, data: shipping });
  } catch (error) { next(error); }
};

// --- ATOMIC CHECKOUT ---
exports.checkout = async (req, res, next) => {
  try {
    const query = getIsolatedQuery(req);
    const { customerDetails, cart, paymentMethod, shippingMethodId, idempotencyKey } = req.body;

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty or invalid' });
    }
    if (!customerDetails || !customerDetails.name || !customerDetails.email) {
      return res.status(400).json({ success: false, message: 'Valid customer name and email are required' });
    }

    // 1. Idempotency Check (Scoped to workspace+website+store)
    if (idempotencyKey) {
      const existingOrder = await EcommerceOrder.findOne({ ...query, idempotencyKey });
      if (existingOrder) {
        return res.json({ success: true, orderId: existingOrder._id, orderNumber: existingOrder.orderNumber, duplicate: true });
      }
    }

    // 2. Settings Validation & Fallback Creation
    let settings = await EcommerceSettings.findOne(query);
    if (!settings) {
      // Dynamic fallback creation for demo mode stability
      settings = new EcommerceSettings({
        ...query,
        currency: 'USD',
        currencySymbol: '$',
        shippingEnabled: true,
        shippingFee: 10,
        paymentMethods: [{ id: 'COD', name: 'Cash on Delivery', enabled: true }],
        shippingMethods: [{ id: 'standard', name: 'Standard Delivery', price: 10, enabled: true }]
      });
      try {
        await settings.save();
      } catch (err) {
        console.warn('Fallback settings save failed (legacy index?):', err.message);
      }
    }

    // 3. Shipping & Payment Calculation
    let shippingFee = 0;
    let shippingMethodName = 'Standard';
    if (settings.shippingEnabled) {
      let method = null;
      if (settings.shippingMethods && settings.shippingMethods.length > 0) {
        method = settings.shippingMethods.find(m => String(m.id).toLowerCase() === String(shippingMethodId).toLowerCase() && m.enabled)
              || settings.shippingMethods.find(m => m.enabled);
      }
      if (method) {
        shippingFee = method.price;
        shippingMethodName = method.name;
      } else {
        shippingFee = settings.shippingFee || 0;
      }
    }

    const selectedPayment = settings.paymentMethods?.find(m => String(m.id).toLowerCase() === String(paymentMethod).toLowerCase() && m.enabled);
    if (!selectedPayment) {
      return res.status(400).json({ success: false, message: 'Invalid or disabled payment method' });
    }

    // 4. Server-Side Price & Quantity Validation
    let subtotal = 0;
    const validatedItems = [];
    
    for (const item of cart) {
      if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ success: false, message: `Invalid quantity for product ${item.name}` });
      }
      const product = await EcommerceProduct.findOne({ ...query, _id: item.id || item._id, status: 'Active' });
      if (!product) {
        return res.status(400).json({ success: false, message: `Product not found or inactive: ${item.name}` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}. Available: ${product.stock}` });
      }

      const priceToUse = product.salePrice ? product.salePrice : product.price;
      subtotal += priceToUse * item.quantity;
      validatedItems.push({
        productId: product._id,
        name: product.name,
        price: priceToUse,
        quantity: item.quantity,
        image: product.image
      });
    }

    const finalTotal = subtotal + shippingFee;

    // 5. Atomic Stock Deduction with Manual Rollback
    const successfullyDeducted = [];
    let failedProduct = null;
    
    for (const item of validatedItems) {
      const updateRes = await EcommerceProduct.updateOne(
        { ...query, _id: item.productId, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );
      if (updateRes.modifiedCount === 1) {
        successfullyDeducted.push(item);
      } else {
        failedProduct = item;
        break; // Stop immediately upon failure
      }
    }

    if (failedProduct) {
      // Rollback successful deductions
      for (const item of successfullyDeducted) {
        await EcommerceProduct.updateOne(
          { ...query, _id: item.productId },
          { $inc: { stock: item.quantity } }
        );
      }
      return res.status(400).json({ success: false, message: `Checkout failed: Insufficient stock for ${failedProduct.name}. Someone just bought the last item.` });
    }

    // 6. Customer Upsertion
    const normalizedEmail = customerDetails.email.toLowerCase().trim();
    const customer = await EcommerceCustomer.findOneAndUpdate(
      { ...query, email: normalizedEmail },
      {
        $inc: { ordersCount: 1, totalSpent: finalTotal },
        $set: {
          name: customerDetails.name,
          firstName: customerDetails.firstName,
          lastName: customerDetails.lastName,
          phone: customerDetails.phone,
          address: customerDetails.address,
          city: customerDetails.city,
          state: customerDetails.state,
          postalCode: customerDetails.postalCode,
          country: customerDetails.country
        }
      },
      { new: true, upsert: true }
    );

    // 7. Order Creation
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const order = new EcommerceOrder({
      ...query,
      orderNumber,
      idempotencyKey,
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: normalizedEmail,
      customerPhone: customerDetails.phone,
      shippingAddress: customerDetails.address,
      items: validatedItems,
      subtotal,
      shippingFee,
      total: finalTotal,
      paymentMethod: selectedPayment.name,
      shippingMethodId,
      status: 'Pending'
    });
    await order.save();

    // 8. Payment & Shipping Creation
    try {
      const payment = new EcommercePayment({
        ...query,
        orderId: order._id,
        customerName: customer.name,
        method: selectedPayment.name,
        amount: finalTotal,
        status: 'Pending'
      });
      await payment.save();

      if (settings.shippingEnabled) {
        const shipping = new EcommerceShipping({
          ...query,
          orderId: order._id,
          customerName: customer.name,
          address: customerDetails.address || 'N/A',
          methodName: shippingMethodName,
          status: 'Pending',
          trackingId: `TRK${Date.now()}`
        });
        await shipping.save();
      }
    } catch (err) {
      console.error('Error creating payment/shipping records:', err);
    }

    res.json({ success: true, orderId: order._id, orderNumber });
  } catch (error) { next(error); }
};

exports.updateOrderStatus = async (req, res, next) => {
  try {
    const query = getIsolatedQuery(req);
    const { orderId } = req.params;
    const { status } = req.body;
    
    if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

    const order = await EcommerceOrder.findOneAndUpdate(
      { ...query, _id: orderId },
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Sync shipping status if applicable
    if (status === 'Shipped' || status === 'Delivered' || status === 'Returned') {
      await EcommerceShipping.findOneAndUpdate(
        { ...query, orderId: order._id },
        { status }
      );
    }
    
    res.json({ success: true, order });
  } catch (error) { next(error); }
};

exports.updateShippingStatus = async (req, res, next) => {
  try {
    const query = getIsolatedQuery(req);
    const { shippingId } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ success: false, message: 'Status is required' });

    const shipping = await EcommerceShipping.findOneAndUpdate(
      { ...query, _id: shippingId },
      { status },
      { new: true }
    );
    if (!shipping) return res.status(404).json({ success: false, message: 'Shipping record not found' });

    // Sync order status if applicable
    if (status === 'Shipped' || status === 'Delivered' || status === 'Returned') {
      await EcommerceOrder.findOneAndUpdate(
        { ...query, _id: shipping.orderId },
        { status }
      );
    }

    res.json({ success: true, shipping });
  } catch (error) { next(error); }
};

