require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { initDatabase, dbRun, dbAll, dbGet } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 8000;

// Rate Limiters
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 checkout session requests per windowMs
  message: { error: 'Too many checkouts initiated from this IP, please try again in 15 minutes.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit login/register requests
  message: { error: 'Too many login attempts, please try again in 15 minutes.' }
});

// Configure Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
});

// Helper to send order email
async function sendOrderEmail(toEmail, orderDetails) {
  const itemsText = orderDetails.items.map(item => `- ${item.name} (${item.size} / ${item.color}) x${item.quantity}: LKR ${item.price}`).join('\n');
  const discountText = orderDetails.discountAmount > 0 
    ? `Subtotal: LKR ${orderDetails.subtotal}\nDiscount Applied: LKR ${orderDetails.discountAmount} (Code: ${orderDetails.couponCode})\n` 
    : "";

  const trackingLink = `http://localhost:8000/track-order.html?id=UT-${orderDetails.id}&email=${encodeURIComponent(toEmail)}`;

  const mailOptions = {
    from: `"Urban Threads" <no-reply@urbanthreads.lk>`,
    to: toEmail,
    subject: `Urban Threads Order Confirmation (UT-${orderDetails.id})`,
    text: `Thank you for your order!

Order ID: UT-${orderDetails.id}
${discountText}Shipping Delivery: LKR ${orderDetails.delivery}
Total: LKR ${orderDetails.total}

Items Ordered:
${itemsText}

You can track your order status live at any time using the link below:
${trackingLink}

We are processing your order and will notify you when it ships. Thank you for shopping with us!
`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Order email sent: ' + info.response);
  } catch (err) {
    console.log('Email sending failed: ' + err.message);
    console.log('--- Mock Order Email Summary ---');
    console.log(`To: ${toEmail}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(mailOptions.text);
    console.log('--------------------------------');
  }
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url} - Session User: ${req.session?.userId || 'Guest'}`);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Configure Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'urbanthreads-super-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

// Initialize DB and ensure Admin exists
async function startServer() {
  await initDatabase();

  // Create default admin account if not exists
  const adminEmail = 'admin@urbanthreads.lk';
  const admin = await dbGet('SELECT * FROM users WHERE email = ?', [adminEmail]);
  if (!admin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await dbRun(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Store Manager', adminEmail, hashedPassword, 'admin']
    );
    console.log('Default Admin Account Created:');
    console.log(`Email: ${adminEmail}`);
    console.log('Password: admin123');
  }

  app.listen(PORT, () => {
    console.log(`Urban Threads v2 running at http://127.0.0.1:${PORT}`);
  });
}

// ==========================================
// AUTH API ENDPOINTS
// ==========================================

// Register User
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide all details' });
  }

  try {
    const existing = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    // Auto-login
    req.session.userId = result.lastID;
    req.session.userRole = 'customer';
    req.session.userName = name;

    res.status(201).json({ success: true, user: { id: result.lastID, name, email, role: 'customer' } });
  } catch (err) {
    res.status(500).json({ error: 'Database error registering user' });
  }
});

// Login User
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.userName = user.name;

    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Database error logging in' });
  }
});

// Logout User
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Get Current Logged-in User Session info
app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) {
    return res.json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    user: {
      id: req.session.userId,
      name: req.session.userName,
      role: req.session.userRole
    }
  });
});

// Middleware to protect routes (auth required)
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in to continue' });
  }
  next();
};

// Middleware to protect admin routes (admin required)
const requireAdmin = (req, res, next) => {
  if (!req.session.userId || req.session.userRole !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  next();
};

// ==========================================
// PRODUCT API ENDPOINTS
// ==========================================

// Get All Products (with filters, search, price range & ratings)
app.get('/api/products', async (req, res) => {
  const { category, subcategory, search, sort, minPrice, maxPrice, sale } = req.query;
  let query = `
    SELECT p.*, 
           COALESCE(AVG(r.rating), 0) AS average_rating, 
           COUNT(r.id) AS review_count
    FROM products p
    LEFT JOIN reviews r ON p.id = r.product_id
    WHERE 1=1
  `;
  const params = [];

  if (category) {
    query += ' AND p.category = ?';
    params.push(category);
  }

  if (subcategory) {
    query += ' AND p.subcategory = ?';
    params.push(subcategory);
  }

  if (search) {
    query += ' AND p.name LIKE ?';
    params.push(`%${search}%`);
  }

  if (minPrice) {
    query += ' AND p.price >= ?';
    params.push(parseFloat(minPrice));
  }

  if (maxPrice) {
    query += ' AND p.price <= ?';
    params.push(parseFloat(maxPrice));
  }

  if (sale === 'true') {
    query += ' AND p.discount_percent > 0';
  }

  query += ' GROUP BY p.id';

  if (sort) {
    if (sort === 'price-low') {
      query += ' ORDER BY p.price ASC';
    } else if (sort === 'price-high') {
      query += ' ORDER BY p.price DESC';
    } else if (sort === 'name') {
      query += ' ORDER BY p.name ASC';
    }
  }

  try {
    const products = await dbAll(query, params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching products' });
  }
});

// Get Single Product with aggregated reviews rating summary
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await dbGet(`
      SELECT p.*, 
             COALESCE(AVG(r.rating), 0) AS average_rating, 
             COUNT(r.id) AS review_count
      FROM products p
      LEFT JOIN reviews r ON p.id = r.product_id
      WHERE p.id = ?
      GROUP BY p.id
    `, [req.params.id]);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching product details' });
  }
});

// ==========================================
// CART API ENDPOINTS
// ==========================================

// Get Cart Items
app.get('/api/cart', requireAuth, async (req, res) => {
  try {
    const items = await dbAll(`
      SELECT p.id, p.name, p.price, p.image, p.category_label, c.size, c.color, c.quantity 
      FROM cart_items c 
      JOIN products p ON c.product_id = p.id 
      WHERE c.user_id = ?
    `, [req.session.userId]);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching cart' });
  }
});

// Add/Update Cart Items
app.post('/api/cart', requireAuth, async (req, res) => {
  const { productId, size, color, quantity } = req.body;
  if (!productId || !size || !color) {
    return res.status(400).json({ error: 'Product ID, size, and color required' });
  }

  const qty = parseInt(quantity) || 1;

  try {
    const existing = await dbGet(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ? AND color = ?',
      [req.session.userId, productId, size, color]
    );

    if (existing) {
      const newQty = existing.quantity + qty;
      if (newQty <= 0) {
        await dbRun(
          'DELETE FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ? AND color = ?',
          [req.session.userId, productId, size, color]
        );
      } else {
        await dbRun(
          'UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ? AND size = ? AND color = ?',
          [newQty, req.session.userId, productId, size, color]
        );
      }
    } else if (qty > 0) {
      await dbRun(
        'INSERT INTO cart_items (user_id, product_id, size, color, quantity) VALUES (?, ?, ?, ?, ?)',
        [req.session.userId, productId, size, color, qty]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error updating cart' });
  }
});

// Remove Item from Cart
app.delete('/api/cart/:productId', requireAuth, async (req, res) => {
  const { size, color } = req.query;
  if (!size || !color) {
    return res.status(400).json({ error: 'Size and color parameters required' });
  }

  try {
    await dbRun(
      'DELETE FROM cart_items WHERE user_id = ? AND product_id = ? AND size = ? AND color = ?',
      [req.session.userId, req.params.productId, size, color]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error deleting item from cart' });
  }
});

// ==========================================
// WISHLIST API ENDPOINTS
// ==========================================

// Get user wishlist
app.get('/api/wishlist', requireAuth, async (req, res) => {
  try {
    const items = await dbAll(`
      SELECT p.id, p.name, p.price, p.image, p.category_label, p.stock
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      WHERE w.user_id = ?
    `, [req.session.userId]);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching wishlist' });
  }
});

// Add to wishlist
app.post('/api/wishlist', requireAuth, async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ error: 'Product ID required' });
  }

  try {
    const existing = await dbGet(
      'SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?',
      [req.session.userId, productId]
    );

    if (!existing) {
      await dbRun(
        'INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)',
        [req.session.userId, productId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error adding to wishlist' });
  }
});

// Delete from wishlist
app.delete('/api/wishlist/:productId', requireAuth, async (req, res) => {
  try {
    await dbRun(
      'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
      [req.session.userId, req.params.productId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error deleting from wishlist' });
  }
});

// ==========================================
// ORDER & PAYMENTS API ENDPOINTS
// ==========================================

// Store discount coupons config
const COUPONS = {
  'URBAN10': { type: 'percent', value: 10 },
  'THREADS20': { type: 'percent', value: 20 },
  'WELCOME30': { type: 'percent', value: 30 }
};

// Validate coupon code
app.get('/api/coupons/validate', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Coupon code is required' });
  }
  const coupon = COUPONS[code.trim().toUpperCase()];
  if (!coupon) {
    return res.status(404).json({ error: 'Invalid coupon code' });
  }
  res.json({ success: true, type: coupon.type, value: coupon.value });
});

// Get order details for public tracking (requires Order ID + email verification)
app.get('/api/orders/track', async (req, res) => {
  const { orderId, email } = req.query;
  if (!orderId || !email) {
    return res.status(400).json({ error: 'Order ID and Email are required' });
  }

  const numericId = orderId.replace('UT-', '');

  try {
    const order = await dbGet(
      'SELECT * FROM orders WHERE id = ? AND LOWER(customer_email) = LOWER(?)',
      [numericId, email.trim()]
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found with those details' });
    }

    const items = await dbAll(`
      SELECT oi.quantity, oi.price, oi.size, oi.color, p.name, p.image 
      FROM order_items oi 
      JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id = ?
    `, [order.id]);

    res.json({ order, items });
  } catch (err) {
    res.status(500).json({ error: 'Database error retrieving tracking details' });
  }
});

// Create Stripe Checkout Session (Upgraded Checkout endpoint)
app.post('/api/payments/create-checkout-session', checkoutLimiter, async (req, res) => {
  const { name, email, address, phone, items, promoCode } = req.body;
  if (!name || !email || !address || !phone || !items || items.length === 0) {
    return res.status(400).json({ error: 'All fields and items are required' });
  }

  try {
    // Calculate subtotal
    let subtotal = 0;
    for (const item of items) {
      const product = await dbGet('SELECT price, stock FROM products WHERE id = ?', [item.id]);
      if (!product) {
        return res.status(400).json({ error: `Product ID ${item.id} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Product ${product.name} has insufficient stock` });
      }
      subtotal += product.price * item.quantity;
    }

    // Process coupon code
    let discountPercent = 0;
    let couponCode = null;
    let discountAmount = 0;

    if (promoCode) {
      const coupon = COUPONS[promoCode.toUpperCase()];
      if (coupon && coupon.type === 'percent') {
        discountPercent = coupon.value;
        couponCode = promoCode.toUpperCase();
        discountAmount = Math.round(subtotal * (discountPercent / 100));
      }
    }

    // Build Stripe line items (recalculating pricing based on coupon)
    const lineItems = [];
    for (const item of items) {
      const product = await dbGet('SELECT price FROM products WHERE id = ?', [item.id]);
      const discountedPrice = Math.round(product.price * (1 - discountPercent / 100));

      lineItems.push({
        price_data: {
          currency: 'lkr',
          product_data: {
            name: `${item.name} (${item.size} / ${item.color})`,
            images: [item.image.startsWith('http') ? item.image : `http://127.0.0.1:8000/${item.image}`],
          },
          unit_amount: discountedPrice * 100, // Stripe expects cents-equivalent
        },
        quantity: item.quantity,
      });
    }

    // Add shipping as a line item
    const delivery = 550;
    lineItems.push({
      price_data: {
        currency: 'lkr',
        product_data: {
          name: 'Delivery Fee',
          description: 'Flat rate shipping fee'
        },
        unit_amount: delivery * 100,
      },
      quantity: 1,
    });

    const total = subtotal - discountAmount + delivery;

    // 2. Temporarily write unpaid order to DB (so we don't lose the metadata details)
    const orderResult = await dbRun(`
      INSERT INTO orders (user_id, customer_name, customer_email, delivery_address, payment_method, subtotal, delivery, total, status, payment_status, coupon_code, discount_amount)
      VALUES (?, ?, ?, ?, 'Credit Card', ?, ?, ?, 'Pending', 'Unpaid', ?, ?)
    `, [req.session.userId || null, name, email, address, subtotal, delivery, total, couponCode, discountAmount]);

    const orderId = orderResult.lastID;

    // Save order items (stock is NOT deducted yet; we deduct upon Stripe validation)
    for (const item of items) {
      const product = await dbGet('SELECT price FROM products WHERE id = ?', [item.id]);
      await dbRun(`
        INSERT INTO order_items (order_id, product_id, size, color, quantity, price)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [orderId, item.id, item.size, item.color, item.quantity, product.price]);
    }

    // Create Stripe Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `http://localhost:8000/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:8000/order-cancel.html`,
      metadata: {
        orderId: orderId.toString(),
        email: email
      }
    });

    // Update order with Stripe Session ID
    await dbRun('UPDATE orders SET stripe_session_id = ? WHERE id = ?', [session.id, orderId]);

    res.json({ success: true, url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

// Verify and Confirm payment status
app.post('/api/payments/confirm', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }

  try {
    // 1. Find the order in SQLite
    const order = await dbGet('SELECT * FROM orders WHERE stripe_session_id = ?', [sessionId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // If order is already paid, just return success
    if (order.payment_status === 'Paid') {
      const orderItems = await dbAll(`
        SELECT oi.quantity, oi.price, oi.size, oi.color, p.name 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = ?
      `, [order.id]);
      return res.json({ success: true, order, items: orderItems });
    }

    // 2. Fetch session from Stripe to verify status
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment has not been completed.' });
    }

    // 3. Mark order as Paid and deduct product stock
    await dbRun('UPDATE orders SET payment_status = "Paid", status = "Processing" WHERE id = ?', [order.id]);

    const orderItems = await dbAll(`
      SELECT oi.product_id, oi.quantity, oi.price, oi.size, oi.color, p.name 
      FROM order_items oi 
      JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id = ?
    `, [order.id]);

    for (const item of orderItems) {
      await dbRun('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    // 4. Clear user's cart
    if (order.user_id) {
      await dbRun('DELETE FROM cart_items WHERE user_id = ?', [order.user_id]);
    }

    // 5. Send confirmation email
    sendOrderEmail(order.customer_email, {
      id: order.id,
      subtotal: order.subtotal,
      delivery: order.delivery,
      total: order.total,
      couponCode: order.coupon_code,
      discountAmount: order.discount_amount,
      items: orderItems
    });

    res.json({ success: true, order, items: orderItems });
  } catch (err) {
    console.error('Confirmation Error:', err);
    res.status(500).json({ error: 'Database or payment confirmation error' });
  }
});

// Place a New Order (Standard Cash on Delivery / Bank Transfer)
app.post('/api/orders', async (req, res) => {
  const { name, email, address, phone, paymentMethod, items, promoCode } = req.body;
  if (!name || !email || !address || !phone || !paymentMethod || !items || items.length === 0) {
    return res.status(400).json({ error: 'All fields and items are required' });
  }

  // Calculate prices
  let subtotal = 0;
  for (const item of items) {
    const product = await dbGet('SELECT price, stock FROM products WHERE id = ?', [item.id]);
    if (!product) {
      return res.status(400).json({ error: `Product ID ${item.id} not found` });
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ error: `Product ${product.name} has insufficient stock` });
    }
    subtotal += product.price * item.quantity;
  }

  // Process coupon code
  let discountPercent = 0;
  let couponCode = null;
  let discountAmount = 0;

  if (promoCode) {
    const coupon = COUPONS[promoCode.toUpperCase()];
    if (coupon && coupon.type === 'percent') {
      discountPercent = coupon.value;
      couponCode = promoCode.toUpperCase();
      discountAmount = Math.round(subtotal * (discountPercent / 100));
    }
  }

  const delivery = 550; // flat rate shipping
  const total = subtotal - discountAmount + delivery;

  try {
    // Save to Database
    const orderResult = await dbRun(`
      INSERT INTO orders (user_id, customer_name, customer_email, delivery_address, payment_method, subtotal, delivery, total, status, payment_status, coupon_code, discount_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Unpaid', ?, ?)
    `, [req.session.userId || null, name, email, address, paymentMethod, subtotal, delivery, total, couponCode, discountAmount]);

    const orderId = orderResult.lastID;

    // Save order items & deduct stock
    for (const item of items) {
      const product = await dbGet('SELECT price FROM products WHERE id = ?', [item.id]);
      await dbRun(`
        INSERT INTO order_items (order_id, product_id, size, color, quantity, price)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [orderId, item.id, item.size, item.color, item.quantity, product.price]);

      // Deduct inventory stock
      await dbRun('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.id]);
    }

    // Clear cart if logged in
    if (req.session.userId) {
      await dbRun('DELETE FROM cart_items WHERE user_id = ?', [req.session.userId]);
    }

    // Fetch full details of the items for sending email confirmation
    const fullItems = await dbAll(`
      SELECT oi.quantity, oi.price, oi.size, oi.color, p.name 
      FROM order_items oi 
      JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id = ?
    `, [orderId]);

    // Send order receipt email
    sendOrderEmail(email, {
      id: orderId,
      subtotal,
      delivery,
      total,
      couponCode,
      discountAmount,
      items: fullItems
    });

    res.status(201).json({ success: true, orderId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error placing order' });
  }
});

// Get Logged-in User's Orders
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const orders = await dbAll('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
    
    // Attach items to each order
    for (const order of orders) {
      order.items = await dbAll(`
        SELECT oi.quantity, oi.price, oi.size, oi.color, p.name, p.image 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = ?
      `, [order.id]);
    }

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching order history' });
  }
});

// ==========================================
// REVIEWS API ENDPOINTS
// ==========================================

// Get all verified reviews (joined with product details for testimonials wall)
app.get('/api/reviews', async (req, res) => {
  try {
    const reviews = await dbAll(`
      SELECT r.*, p.name AS product_name 
      FROM reviews r 
      JOIN products p ON r.product_id = p.id 
      ORDER BY r.created_at DESC
    `);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching reviews feed' });
  }
});

// Get reviews for a specific product
app.get('/api/products/:id/reviews', async (req, res) => {
  try {
    const reviews = await dbAll(
      'SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching product reviews' });
  }
});

// Check if user is eligible to review a product (verified buyer check)
app.get('/api/products/:id/eligibility', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ canReview: false, reason: "Please log in to leave a review." });
  }

  try {
    // Check if they bought the product
    const purchased = await dbGet(`
      SELECT COUNT(*) AS count
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = ? AND oi.product_id = ? AND o.payment_status = 'Paid'
    `, [req.session.userId, req.params.id]);

    if (purchased.count === 0) {
      return res.json({ canReview: false, reason: "Only verified buyers who purchased this product can leave a review." });
    }

    // Check if they already reviewed this product
    const alreadyReviewed = await dbGet(
      'SELECT COUNT(*) AS count FROM reviews WHERE user_id = ? AND product_id = ?',
      [req.session.userId, req.params.id]
    );

    if (alreadyReviewed.count > 0) {
      return res.json({ canReview: false, reason: "You have already reviewed this product." });
    }

    res.json({ canReview: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error checking eligibility' });
  }
});

// Add a product review (verifying purchaser status)
app.post('/api/products/:id/reviews', requireAuth, async (req, res) => {
  const { name, rating, text } = req.body;
  if (!name || !rating || !text) {
    return res.status(400).json({ error: 'Please provide name, rating, and review text.' });
  }

  const productId = req.params.id;
  const stars = Math.min(Math.max(parseInt(rating) || 5, 1), 5);

  try {
    // Double-check purchase history on insertion
    const purchased = await dbGet(`
      SELECT COUNT(*) AS count
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = ? AND oi.product_id = ? AND o.payment_status = 'Paid'
    `, [req.session.userId, productId]);

    if (purchased.count === 0) {
      return res.status(403).json({ error: 'Only verified buyers who purchased this product can leave a review.' });
    }

    // Double-check if already reviewed
    const alreadyReviewed = await dbGet(
      'SELECT COUNT(*) AS count FROM reviews WHERE user_id = ? AND product_id = ?',
      [req.session.userId, productId]
    );

    if (alreadyReviewed.count > 0) {
      return res.status(400).json({ error: 'You have already reviewed this product.' });
    }

    await dbRun(
      'INSERT INTO reviews (product_id, user_id, reviewer_name, rating, review_text, verified) VALUES (?, ?, ?, ?, ?, 1)',
      [productId, req.session.userId, name, stars, text]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error submitting review' });
  }
});

// ==========================================
// ADMIN DASHBOARD ENDPOINTS (PROTECTED)
// ==========================================

// Get Admin Stats
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const sales = await dbGet('SELECT SUM(total) AS totalSales, COUNT(*) AS totalOrders FROM orders WHERE status != "Cancelled"');
    const products = await dbGet('SELECT COUNT(*) AS totalProducts FROM products');
    const users = await dbGet('SELECT COUNT(*) AS totalCustomers FROM users WHERE role = "customer"');

    res.json({
      totalSales: sales.totalSales || 0,
      totalOrders: sales.totalOrders || 0,
      totalProducts: products.totalProducts || 0,
      totalCustomers: users.totalCustomers || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching stats' });
  }
});

// Get All Orders (Admin View)
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await dbAll('SELECT * FROM orders ORDER BY created_at DESC');
    for (const order of orders) {
      order.items = await dbAll(`
        SELECT oi.quantity, oi.price, oi.size, oi.color, p.name 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = ?
      `, [order.id]);
    }
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Database error fetching admin orders' });
  }
});

// Update Order Status
app.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status required' });
  }

  try {
    await dbRun('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error updating status' });
  }
});

// Add New Product
app.post('/api/admin/products', requireAdmin, async (req, res) => {
  const { name, category, price, stock, image, description } = req.body;
  if (!name || !category || !price || !stock || !image) {
    return res.status(400).json({ error: 'Missing product parameters' });
  }

  try {
    const countRow = await dbGet('SELECT COUNT(*) AS count FROM products');
    const index = countRow.count + 1;
    const slug = `${category.toLowerCase()}-${index}`;

    // Look up category label
    const categoryLabels = { men: 'Men', women: 'Women', kids: 'Kids', accessories: 'Accessories' };
    const categoryLabel = categoryLabels[category.toLowerCase()] || 'Men';

    const desc = description || `A beautiful addition to our ${categoryLabel} collection.`;

    await dbRun(`
      INSERT INTO products (name, slug, description, price, category, category_label, image, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, slug, desc, parseFloat(price), category.toLowerCase(), categoryLabel, image, parseInt(stock)]);

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error creating product' });
  }
});

// Update Existing Product Stock/Price
app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
  const { price, stock } = req.body;
  if (price === undefined && stock === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    if (price !== undefined && stock !== undefined) {
      await dbRun('UPDATE products SET price = ?, stock = ? WHERE id = ?', [parseFloat(price), parseInt(stock), req.params.id]);
    } else if (price !== undefined) {
      await dbRun('UPDATE products SET price = ? WHERE id = ?', [parseFloat(price), req.params.id]);
    } else if (stock !== undefined) {
      await dbRun('UPDATE products SET stock = ? WHERE id = ?', [parseInt(stock), req.params.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error updating product' });
  }
});

// Delete Product
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
  try {
    await dbRun('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error deleting product' });
  }
});
// Get detailed analytics for sales dashboard
app.get('/api/admin/dashboard-details', requireAdmin, async (req, res) => {
  try {
    const dailySales = await dbAll(`
      SELECT DATE(created_at) AS date, SUM(total) AS sales, COUNT(*) AS orders 
      FROM orders 
      WHERE status != 'Cancelled' 
      GROUP BY DATE(created_at) 
      ORDER BY date DESC 
      LIMIT 30
    `);

    const bestSellers = await dbAll(`
      SELECT p.name, p.category_label, p.image, SUM(oi.quantity) AS totalSold, SUM(oi.quantity * oi.price) AS revenue 
      FROM order_items oi 
      JOIN products p ON oi.product_id = p.id 
      JOIN orders o ON oi.order_id = o.id 
      WHERE o.status != 'Cancelled' 
      GROUP BY p.id 
      ORDER BY totalSold DESC 
      LIMIT 5
    `);

    const lowStock = await dbAll(`
      SELECT id, name, stock, category_label 
      FROM products 
      WHERE stock <= 5 
      ORDER BY stock ASC
    `);

    res.json({ dailySales, bestSellers, lowStock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error retrieving dashboard details' });
  }
});

// Import products in bulk from CSV
app.post('/api/admin/products/bulk', requireAdmin, async (req, res) => {
  const { csvText } = req.body;
  if (!csvText) {
    return res.status(400).json({ error: 'CSV text content is required' });
  }

  try {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must contain at least a header row and one product row' });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = headers.indexOf('name');
    const catIdx = headers.indexOf('category');
    const priceIdx = headers.indexOf('price');
    const stockIdx = headers.indexOf('stock');
    const imgIdx = headers.indexOf('image');
    const descIdx = headers.indexOf('description');

    if (nameIdx === -1 || catIdx === -1 || priceIdx === -1 || stockIdx === -1) {
      return res.status(400).json({ error: 'CSV headers must include name, category, price, and stock' });
    }

    const categoryLabels = { men: 'Men', women: 'Women', kids: 'Kids', accessories: 'Accessories' };
    let successCount = 0;
    let failCount = 0;

    const countRow = await dbGet('SELECT COUNT(*) AS count FROM products');
    let baseIndex = countRow.count;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Regex splits by comma while respecting quoted values containing commas
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());

      if (values.length < 4) {
        failCount++;
        continue;
      }

      const name = values[nameIdx];
      const category = values[catIdx];
      const price = parseFloat(values[priceIdx]);
      const stock = parseInt(values[stockIdx]);
      const image = imgIdx !== -1 && values[imgIdx] ? values[imgIdx] : 'assets/images/placeholder.jpg';
      const description = descIdx !== -1 && values[descIdx] ? values[descIdx] : '';

      if (!name || !category || isNaN(price) || isNaN(stock)) {
        failCount++;
        continue;
      }

      baseIndex++;
      const slug = `${category.toLowerCase()}-${baseIndex}`;
      const categoryLabel = categoryLabels[category.toLowerCase()] || 'Men';
      const finalDesc = description || `A beautiful addition to our ${categoryLabel} collection.`;

      await dbRun(`
        INSERT INTO products (name, slug, description, price, category, category_label, image, stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [name, slug, finalDesc, price, category.toLowerCase(), categoryLabel, image, stock]);

      successCount++;
    }

    res.json({ success: true, successCount, failCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error importing bulk products' });
  }
});
// Run server
startServer();
