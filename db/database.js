const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'urbanthreads.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to the SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Helper function to run DB operations with Promises
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const CATEGORY_RANGES = [
  { slug: "men", label: "Men", start: 0, end: 15 },
  { slug: "women", label: "Women", start: 16, end: 31 },
  { slug: "kids", label: "Kids", start: 32, end: 47 },
  { slug: "accessories", label: "Accessories", start: 48, end: 63 },
];

const getCategoryForIndex = (index) =>
  CATEGORY_RANGES.find((category) => index >= category.start && index <= category.end);

// Initialize tables and seed database
async function initDatabase() {
  try {
    const cartInfo = await dbAll("PRAGMA table_info(cart_items)");
    const hasSize = cartInfo.some(col => col.name === 'size');
    if (!hasSize && cartInfo.length > 0) {
      console.log("Schema migration needed: Dropping legacy tables...");
      await dbRun("DROP TABLE IF EXISTS cart_items");
      await dbRun("DROP TABLE IF EXISTS order_items");
      await dbRun("DROP TABLE IF EXISTS orders");
    }

    const productsInfo = await dbAll("PRAGMA table_info(products)");
    const hasSubcategory = productsInfo.some(col => col.name === 'subcategory');
    if (!hasSubcategory && productsInfo.length > 0) {
      console.log("Schema migration needed: Dropping legacy products table for subcategories...");
      await dbRun("DROP TABLE IF EXISTS products");
      await dbRun("DROP TABLE IF EXISTS reviews");
      await dbRun("DROP TABLE IF EXISTS wishlist");
    }

    const reviewsInfo = await dbAll("PRAGMA table_info(reviews)");
    const hasProductId = reviewsInfo.some(col => col.name === 'product_id');
    if (!hasProductId && reviewsInfo.length > 0) {
      console.log("Schema migration needed: Dropping legacy reviews table...");
      await dbRun("DROP TABLE IF EXISTS reviews");
    }

    const ordersInfo = await dbAll("PRAGMA table_info(orders)");
    const hasCouponCode = ordersInfo.some(col => col.name === 'coupon_code');
    if (!hasCouponCode && ordersInfo.length > 0) {
      console.log("Schema migration needed: Dropping legacy orders table...");
      await dbRun("DROP TABLE IF EXISTS orders");
      await dbRun("DROP TABLE IF EXISTS order_items");
    }
  } catch (e) {
    // Table doesn't exist yet
  }

  // 1. Create Users Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Create Products Table (Upgraded with subcategory and discount_percent)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      discount_percent INTEGER DEFAULT 0,
      category TEXT NOT NULL,
      category_label TEXT NOT NULL,
      subcategory TEXT,
      subcategory_label TEXT,
      image TEXT NOT NULL,
      stock INTEGER DEFAULT 15,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 3. Create Cart Items Table (Upgraded with size and color)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS cart_items (
      user_id INTEGER,
      product_id INTEGER,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      PRIMARY KEY (user_id, product_id, size, color),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // 4. Create Orders Table (Upgraded with payment status, stripe session ID, and coupon metadata)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      subtotal REAL NOT NULL,
      delivery REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'Pending',
      payment_status TEXT DEFAULT 'Unpaid',
      stripe_session_id TEXT,
      coupon_code TEXT,
      discount_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 5. Create Order Items Table (Upgraded with size and color)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
    )
  `);

  // 6. Create Reviews Table (Upgraded with product_id, user_id and verified status)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reviewer_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      review_text TEXT NOT NULL,
      verified INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 7. Create Wishlist Table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS wishlist (
      user_id INTEGER,
      product_id INTEGER,
      PRIMARY KEY (user_id, product_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  // Seed products catalog directly with structured counts matching user requirements
  const countRow = await dbGet('SELECT COUNT(*) AS count FROM products');
  if (countRow.count === 0) {
    console.log('Seeding structured catalog products into SQLite...');
    const catalogProducts = [
      // Men: Shirts & Tees (8 products)
      { name: "Classic Beige Striped Polo", slug: "men-1", description: "Beige polo shirt styled with premium dark brown collar stripes.", price: 4500, discount: 0, category: "men", label: "Men", subcat: "shirts-tees", sublabel: "Shirts & Tees", img: "assets/images/polo-stripe-beige.jpg" },
      { name: "Navy & Gold Striped Polo", slug: "men-2", description: "Refined navy blue cotton polo shirt with clean yellow vertical stripes.", price: 4500, discount: 10, category: "men", label: "Men", subcat: "shirts-tees", sublabel: "Shirts & Tees", img: "assets/images/shirt-680x920.jpg" },
      { name: "Burgundy & Cream Trim Polo", slug: "men-3", description: "Classic burgundy polo shirt featuring a soft contrasting cream collar.", price: 4200, discount: 0, category: "men", label: "Men", subcat: "shirts-tees", sublabel: "Shirts & Tees", img: "assets/images/SHIRT-2_0000s_0008_DSC05197-680x920.jpg" },
      { name: "Waffle Textured White Polo", slug: "men-4", description: "White waffle knit polo shirt accented with clean black cuff trim.", price: 4800, discount: 0, category: "men", label: "Men", subcat: "shirts-tees", sublabel: "Shirts & Tees", img: "assets/images/shirt-680x920.jpg" },
      { name: "Teal Ribbed Zipper Polo", slug: "men-5", description: "Sleek teal ribbed polo shirt completed with a contemporary front zip.", price: 4900, discount: 15, category: "men", label: "Men", subcat: "shirts-tees", sublabel: "Shirts & Tees", img: "assets/images/SHIRT-2_0000s_0001_DSC04693-680x920.jpg" },
      { name: "Classic Tan Plaid Flannel", slug: "men-6", description: "Warm tan and cream plaid long-sleeve flannel button-down.", price: 5200, discount: 0, category: "men", label: "Men", subcat: "shirts-tees", sublabel: "Shirts & Tees", img: "assets/images/shirt_0005_DSC04561-680x920.jpg" },
      { name: "Abercrombie Navy Plaid Flannel", slug: "men-7", description: "Heavyweight navy and white checkered flannel shirt with double chest pockets.", price: 5400, discount: 20, category: "men", label: "Men", subcat: "shirts-tees", sublabel: "Shirts & Tees", img: "assets/images/SHIRT-2_0000s_0001_DSC04693-680x920.jpg" },
      { name: "Knitted Biscuit Polo", slug: "men-8", description: "Luxurious knitted polo shirt in a neutral biscuit tan color.", price: 6200, discount: 0, category: "men", label: "Men", subcat: "shirts-tees", sublabel: "Shirts & Tees", img: "assets/images/polo-tan.jpg" },

      // Men: Bottoms & Trousers (8 products)
      { name: "Signature Men's Formal Trouser", slug: "men-9", description: "Signature formal flat-front trouser for men's smart tailoring.", price: 3800, discount: 0, category: "men", label: "Men", subcat: "bottoms-trousers", sublabel: "Bottoms & Trousers", img: "assets/images/37_SIGNATURE-MENS-FORMAL-TROUSER-680x920.jpg" },
      { name: "AeroDry Athletic Joggers", slug: "men-10", description: "Moisture-wicking athletic gym track pants with zip pockets.", price: 4200, discount: 0, category: "men", label: "Men", subcat: "bottoms-trousers", sublabel: "Bottoms & Trousers", img: "assets/images/shirt-680x920.jpg" },
      { name: "Classic Cotton Chino Trousers", slug: "men-11", description: "Slim-fit cotton chinos designed for durable, clean styling.", price: 4500, discount: 0, category: "men", label: "Men", subcat: "bottoms-trousers", sublabel: "Bottoms & Trousers", img: "assets/images/37_SIGNATURE-MENS-FORMAL-TROUSER-680x920.jpg" },
      { name: "Slim Fit Stretch Denim Jeans", slug: "men-12", description: "Stretchable indigo denim jeans in a timeless slim fit.", price: 4900, discount: 10, category: "men", label: "Men", subcat: "bottoms-trousers", sublabel: "Bottoms & Trousers", img: "assets/images/37_SIGNATURE-MENS-FORMAL-TROUSER-680x920.jpg" },
      { name: "Active Comfort Gym Shorts", slug: "men-13", description: "Flexible gym shorts designed with deep pockets.", price: 2900, discount: 0, category: "men", label: "Men", subcat: "bottoms-trousers", sublabel: "Bottoms & Trousers", img: "assets/images/mens-casual-short-1709967629094.webp" },
      { name: "Linen Drawstring Summer Shorts", slug: "men-14", description: "Lightweight breathable linen shorts for sunny outings.", price: 3200, discount: 15, category: "men", label: "Men", subcat: "bottoms-trousers", sublabel: "Bottoms & Trousers", img: "assets/images/mens-casual-short-17127446078029.webp" },
      { name: "Premium Cotton Cargo Pants", slug: "men-15", description: "Multi-pocket cargo trousers tailored for casual utility.", price: 5200, discount: 0, category: "men", label: "Men", subcat: "bottoms-trousers", sublabel: "Bottoms & Trousers", img: "assets/images/37_SIGNATURE-MENS-FORMAL-TROUSER-680x920.jpg" },
      { name: "Tailored Khaki Dress Trousers", slug: "men-16", description: "Elegant khaki trousers tailored with a clean front crease.", price: 4600, discount: 0, category: "men", label: "Men", subcat: "bottoms-trousers", sublabel: "Bottoms & Trousers", img: "assets/images/37_SIGNATURE-MENS-FORMAL-TROUSER-680x920.jpg" },

      // Women: Sarees (4 products)
      { name: "Traditional Handloom Cotton Saree", slug: "women-1", description: "Vibrant traditional handloom cotton saree perfect for local festivals.", price: 8500, discount: 0, category: "women", label: "Women", subcat: "sarees", sublabel: "Sarees", img: "assets/images/Saree 1.jpeg" },
      { name: "Embroidered Georgette Saree", slug: "women-2", description: "Exquisite designer georgette saree featuring detailed gold embroidery.", price: 9800, discount: 10, category: "women", label: "Women", subcat: "sarees", sublabel: "Sarees", img: "assets/images/Saree 2.jpeg" },
      { name: "Pure Silk Bridal Saree", slug: "women-3", description: "Hand-woven premium pure silk saree with heavy zari borders.", price: 16500, discount: 0, category: "women", label: "Women", subcat: "sarees", sublabel: "Sarees", img: "assets/images/Saree 3.jpeg" },
      { name: "Vibrant Festive Kanchipuram Saree", slug: "women-4", description: "Glorious Kanchipuram silk saree featuring colorful motifs.", price: 7900, discount: 15, category: "women", label: "Women", subcat: "sarees", sublabel: "Sarees", img: "assets/images/Saree 4.jpeg" },

      // Women: Dresses & Frocks (4 products)
      { name: "Floral Summer Day Dress", slug: "women-5", description: "Breathable lightweight floral summer dress with an elegant flared hem.", price: 4200, discount: 0, category: "women", label: "Women", subcat: "dresses-frocks", sublabel: "Dresses & Frocks", img: "assets/images/Frock 1.jpeg" },
      { name: "Classic Evening Velvet Gown", slug: "women-6", description: "A stunning velvet evening gown for cocktail parties.", price: 6800, discount: 0, category: "women", label: "Women", subcat: "dresses-frocks", sublabel: "Dresses & Frocks", img: "assets/images/Frock 2.jpeg" },
      { name: "Embellished Silk Dress", slug: "women-7", description: "Exquisite hand-woven silk dress designed for wedding occasions.", price: 8900, discount: 20, category: "women", label: "Women", subcat: "dresses-frocks", sublabel: "Dresses & Frocks", img: "assets/images/Frock 3.jpeg" },
      { name: "Linen A-Line Midi Frock", price: 3900, slug: "women-8", discount: 0, category: "women", label: "Women", subcat: "dresses-frocks", sublabel: "Dresses & Frocks", img: "assets/images/Frock 4.jpeg.jpg", desc: "A-line summer linen frock with convenient side pockets." },

      // Women: Shalwar Sets (4 products)
      { name: "Classic Cotton Shalwar Suit", slug: "women-9", description: "Lightweight and daily comfort cotton printed shalwar set.", price: 4800, discount: 0, category: "women", label: "Women", subcat: "shalwar-sets", sublabel: "Shalwar Sets", img: "assets/images/Shalwar 1.jpeg" },
      { name: "Embroidered Silk Shalwar Set", slug: "women-10", description: "Semi-formal cotton silk shalwar suit detailed with beautiful neck embroidery.", price: 6200, discount: 0, category: "women", label: "Women", subcat: "shalwar-sets", sublabel: "Shalwar Sets", img: "assets/images/Shalwar 2.jpeg" },
      { name: "Designer Anarkali Shalwar Set", slug: "women-11", description: "Stunning flared Anarkali suit with a matched dupatta mesh scarf.", price: 7500, discount: 15, category: "women", label: "Women", subcat: "shalwar-sets", sublabel: "Shalwar Sets", img: "assets/images/Shalwar 3.jpeg" },
      { name: "Printed Casual Shalwar Kameez", slug: "women-12", description: "Comfortable daily wear printed cotton Kameez with classic trousers.", price: 3900, discount: 0, category: "women", label: "Women", subcat: "shalwar-sets", sublabel: "Shalwar Sets", img: "assets/images/Shalwar 4.jpeg" },

      // Women: Tops (4 products)
      { name: "Casual Linen Peplum Top", slug: "women-13", description: "Flattering linen peplum top featuring comfortable short sleeves.", price: 2900, discount: 0, category: "women", label: "Women", subcat: "tops", sublabel: "Tops", img: "assets/images/Women t shirt 1.jpeg" },
      { name: "Printed Cotton Crewneck Tee", slug: "women-14", description: "Premium cotton tee decorated with stylish typography.", price: 1800, discount: 0, category: "women", label: "Women", subcat: "tops", sublabel: "Tops", img: "assets/images/Women t shirt 2.jpeg" },
      { name: "Elegant Lace Sleeve Blouse", slug: "women-15", description: "Feminine smart blouse detailed with floral lace embroidery.", price: 3500, discount: 10, category: "women", label: "Women", subcat: "tops", sublabel: "Tops", img: "assets/images/Women t shirt 3.jpeg" },
      { name: "Minimalist Ribbed Knit Top", slug: "women-16", description: "Comfortable fitted ribbed knit top designed for layering.", price: 2400, discount: 0, category: "women", label: "Women", subcat: "tops", sublabel: "Tops", img: "assets/images/Women t shirt 4.jpeg.jpg" },

      // Kids: Boys Clothing (8 products)
      { name: "Boys Colorblock Smart Shirt Set", slug: "kids-1", description: "Charming casual colorblock shirt with matching chino shorts.", price: 3200, discount: 0, category: "kids", label: "Kids", subcat: "boys-clothing", sublabel: "Boys Clothing", img: "assets/images/Boys full kit 1.jpg" },
      { name: "Boys Denim Jacket & Graphic Tee", slug: "kids-2", description: "Cool denim trucker jacket layered over a printed crewneck tee.", price: 4500, discount: 0, category: "kids", label: "Kids", subcat: "boys-clothing", sublabel: "Boys Clothing", img: "assets/images/Boys full kit 2.jpg" },
      { name: "Boys Casual Cotton Short Set", slug: "kids-3", description: "Daily lightweight summer short set for active boys.", price: 2800, discount: 10, category: "kids", label: "Kids", subcat: "boys-clothing", sublabel: "Boys Clothing", img: "assets/images/Boys full kit 3.jpg" },
      { name: "Boys Striped Polo & Khakis Set", slug: "kids-4", description: "Smart casual striped polo paired with soft cotton khakis.", price: 3900, discount: 0, category: "kids", label: "Kids", subcat: "boys-clothing", sublabel: "Boys Clothing", img: "assets/images/Boys full kit 4.jpg" },
      { name: "Kids Retro Panelled Polo", slug: "kids-5", description: "Cream boys polo shirt featuring beige vertical side panels and zip collar.", price: 2900, discount: 0, category: "kids", label: "Kids", subcat: "boys-clothing", sublabel: "Boys Clothing", img: "assets/images/polo-kids.jpg" },
      { name: "Organic Cotton Baby Romper Set", slug: "kids-6", description: "Soft organic cotton baby romper with convenient snap buttons.", price: 2400, discount: 0, category: "kids", label: "Kids", subcat: "boys-clothing", sublabel: "Boys Clothing", img: "assets/images/Toddler Boys Colourblock Pocket Patched Shirt & Trousers Without Tee.jpg" },
      { name: "Kids Casual Checkered Collar Shirt", slug: "kids-7", description: "Long-sleeve plaid collar shirt perfect for family gatherings.", price: 2600, discount: 0, category: "kids", label: "Kids", subcat: "boys-clothing", sublabel: "Boys Clothing", img: "assets/images/Kids Shirt 1.jpg" },
      { name: "Kids Graphic Printed Crewneck Tee", slug: "kids-8", description: "Fun graphic printed sports tee made of soft breathable cotton.", price: 1800, discount: 15, category: "kids", label: "Kids", subcat: "boys-clothing", sublabel: "Boys Clothing", img: "assets/images/Kids Shirt 2.jpg" },

      // Kids: Girls Clothing (4 products)
      { name: "Girls Floral Summer Frock", slug: "kids-9", description: "Beautifully printed floral cotton frock detailed with shoulder bows.", price: 3200, discount: 0, category: "kids", label: "Kids", subcat: "girls-clothing", sublabel: "Girls Clothing", img: "assets/images/Girls full kit 1.jpg" },
      { name: "Girls Denim Skirt & Knit Top Set", slug: "kids-10", description: "Fashionable girls sets with a stretch denim skirt and ribbed top.", price: 3900, discount: 10, category: "kids", label: "Kids", subcat: "girls-clothing", sublabel: "Girls Clothing", img: "assets/images/Girls full kit 2.jpg" },
      { name: "Girls Party Tulle Layer Dress", slug: "kids-11", description: "Charming party dress with layered tulle skirt and sparkling belt detail.", price: 4800, discount: 0, category: "kids", label: "Kids", subcat: "girls-clothing", sublabel: "Girls Clothing", img: "assets/images/Girls full kit 3.jpg" },
      { name: "Girls Cotton Tiered Casual Dress", slug: "kids-12", description: "Tiered A-line cotton dress designed for comfort and daily play.", price: 2900, discount: 0, category: "kids", label: "Kids", subcat: "girls-clothing", sublabel: "Girls Clothing", img: "assets/images/Girls full kit 4.jpg" },

      // Kids: Kids Footwear (4 products)
      { name: "Kids Sporty Light-Up Sneakers", slug: "kids-13", description: "Athletic running shoes with LED lights embedded in the soles.", price: 3400, discount: 0, category: "kids", label: "Kids", subcat: "kids-footwear", sublabel: "Kids Footwear", img: "assets/images/Kids shoes 1.jpg" },
      { name: "Boys Slip-On Leather Loafers", slug: "kids-14", description: "Classic slip-on formal loafers for boys, padded insoles.", price: 2900, discount: 0, category: "kids", label: "Kids", subcat: "kids-footwear", sublabel: "Kids Footwear", img: "assets/images/Kids shoes 2.jpg" },
      { name: "Girls Glitter Ballet Flats", slug: "kids-15", description: "Sparkling ballet flats detailed with a secure elastic strap.", price: 2800, discount: 15, category: "kids", label: "Kids", subcat: "kids-footwear", sublabel: "Kids Footwear", img: "assets/images/Kids shoes 3.jpg" },
      { name: "Toddler Soft-Sole Summer Sandals", slug: "kids-16", description: "Breathable open-toe sandals designed with soft protective soles.", price: 2200, discount: 0, category: "kids", label: "Kids", subcat: "kids-footwear", sublabel: "Kids Footwear", img: "assets/images/Kids shoes 4.jpg" },

      // Accessories: Hats & Caps (4 products)
      { name: "Retro Embroidered Baseball Cap", slug: "acc-1", description: "Vintage washed cotton baseball cap with adjustable buckle.", price: 1800, discount: 0, category: "accessories", label: "Accessories", subcat: "hats-caps", sublabel: "Hats & Caps", img: "assets/images/Cap - 1.jpg" },
      { name: "Sporty Breathable Mesh Cap", slug: "acc-2", description: "Running sports cap featuring mesh panels for ventilation.", price: 1500, discount: 0, category: "accessories", label: "Accessories", subcat: "hats-caps", sublabel: "Hats & Caps", img: "assets/images/Cap - 2.jpg" },
      { name: "Classic Summer Sun Visor", slug: "acc-3", description: "Lightweight sun protection visor with structured brim.", price: 1600, discount: 10, category: "accessories", label: "Accessories", subcat: "hats-caps", sublabel: "Hats & Caps", img: "assets/images/Cap - 3.jpg" },
      { name: "Warm Ribbed Wool Beanie", slug: "acc-4", description: "Cozy cuffed knit wool beanie to seal out cold drafts.", price: 2200, discount: 0, category: "accessories", label: "Accessories", subcat: "hats-caps", sublabel: "Hats & Caps", img: "assets/images/Cap - 4.jpg" },

      // Accessories: Wallets (4 products)
      { name: "Classic Bifold Leather Wallet", slug: "acc-5", description: "Full-grain leather bifold wallet with multiple card sleeves.", price: 2800, discount: 0, category: "accessories", label: "Accessories", subcat: "wallets", sublabel: "Wallets", img: "assets/images/Wallet - 1.jpg" },
      { name: "Slim Leather Card Holder Wallet", slug: "acc-6", description: "Ultra-slim card sleeve case featuring a center cash pocket.", price: 1900, discount: 10, category: "accessories", label: "Accessories", subcat: "wallets", sublabel: "Wallets", img: "assets/images/Wallet - 2.jpg" },
      { name: "Zipper Around Leather Wallet", slug: "acc-7", description: "Security zip wallet finished with textured pebbled leather.", price: 3200, discount: 0, category: "accessories", label: "Accessories", subcat: "wallets", sublabel: "Wallets", img: "assets/images/Wallet - 3.jpg" },
      { name: "Classic Tan Minimalist Wallet", slug: "acc-8", description: "Branded tan leather wallet built with RFID protection.", price: 2500, discount: 0, category: "accessories", label: "Accessories", subcat: "wallets", sublabel: "Wallets", img: "assets/images/Wallet - 4.jpg" },

      // Accessories: Watches (4 products)
      { name: "Elegant Gold Mesh Analog Watch", slug: "acc-9", description: "Gold-plated minimalist watch matching formal and evening wear.", price: 7500, discount: 0, category: "accessories", label: "Accessories", subcat: "watches", sublabel: "Watches", img: "assets/images/Watch - 1.jpg" },
      { name: "Minimalist Silver Steel Watch", slug: "acc-10", description: "Stainless steel analog watch featuring an elegant blue face dial.", price: 8200, discount: 0, category: "accessories", label: "Accessories", subcat: "watches", sublabel: "Watches", img: "assets/images/Watch - 2.jpg" },
      { name: "Smart Fitness Bluetooth Watch", slug: "acc-11", description: "Smart wearable watch tracking heart rate, sleep, and sports details.", price: 5800, discount: 15, category: "accessories", label: "Accessories", subcat: "watches", sublabel: "Watches", img: "assets/images/Watch - 3.jpg" },
      { name: "Sporty Chronograph Metal Watch", slug: "acc-12", description: "Heavyweight steel chronograph watch featuring rotatable bezel ring.", price: 9500, discount: 0, category: "accessories", label: "Accessories", subcat: "watches", sublabel: "Watches", img: "assets/images/Watch - 4.jpg" },

      // Accessories: Eyewear (4 products)
      { name: "Classic Polarized Aviator Sunglasses", slug: "acc-13", description: "Polarized metal frame aviators designed for modern UV protection.", price: 3800, discount: 0, category: "accessories", label: "Accessories", subcat: "eyewear", sublabel: "Eyewear", img: "assets/images/Sunglass for men - 1.jpg" },
      { name: "Retro Square Wayfarer Sunglasses", slug: "acc-14", description: "Classic acetate frame sunglasses matching all casual looks.", price: 2900, discount: 10, category: "accessories", label: "Accessories", subcat: "eyewear", sublabel: "Eyewear", img: "assets/images/Sunglass for men - 2.jpg" },
      { name: "Sporty Wrap-Around Polarized Glasses", slug: "acc-15", description: "Sleek aerodynamic sunglasses ideal for cycling and sports.", price: 3200, discount: 0, category: "accessories", label: "Accessories", subcat: "eyewear", sublabel: "Eyewear", img: "assets/images/Sunglass for men - 3.jpg" },
      { name: "Modern Round Metal Frame Glasses", slug: "acc-16", description: "Sophisticated retro round frames ideal for fashion and optical fits.", price: 4200, discount: 0, category: "accessories", label: "Accessories", subcat: "eyewear", sublabel: "Eyewear", img: "assets/images/Sunglass for men - 4.jpg" }
    ];

    const insertStmt = db.prepare(`
      INSERT INTO products (name, slug, description, price, discount_percent, category, category_label, subcategory, subcategory_label, image, stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    catalogProducts.forEach(p => {
      insertStmt.run(p.name, p.slug, p.description, p.price, p.discount, p.category, p.label, p.subcat, p.sublabel, p.img, 15);
    });

    insertStmt.finalize();
    console.log('Successfully seeded structured products catalog matching counts exactly.');
  }

  // Seed sample reviews if empty

  // Seed sample reviews if empty
  const reviewCount = await dbGet('SELECT COUNT(*) AS count FROM reviews');
  if (reviewCount.count === 0) {
    console.log('Seeding sample reviews...');
    let user = await dbGet("SELECT id FROM users LIMIT 1");
    if (!user) {
      await dbRun("INSERT INTO users (name, email, password, role) VALUES ('System Reviewer', 'reviewer@urbanthreads.lk', 'reviewer123', 'customer')");
      user = await dbGet("SELECT id FROM users LIMIT 1");
    }
    const userId = user.id;

    await dbRun(`
      INSERT INTO reviews (product_id, user_id, reviewer_name, rating, review_text, verified) VALUES 
      (1, ?, 'Shashika M.', 5, 'Quality pieces and fast delivery. The new store is much easier to browse.', 1),
      (2, ?, 'Lakshitha F.', 4, 'Good prices and a cleaner category flow.', 1),
      (3, ?, 'Tishuni N.', 5, 'The product images and cart make shopping feel straightforward.', 1)
    `, [userId, userId, userId]);
  }
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDatabase
};
