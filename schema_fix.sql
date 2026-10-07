USE urban_threads;

-- Fix orders: add missing columns
ALTER TABLE orders ADD COLUMN customer_name VARCHAR(200) DEFAULT '' AFTER user_id;
ALTER TABLE orders ADD COLUMN customer_email VARCHAR(200) DEFAULT '' AFTER customer_name;
ALTER TABLE orders ADD COLUMN delivery_address TEXT AFTER customer_email;
ALTER TABLE orders ADD COLUMN phone VARCHAR(30) DEFAULT '' AFTER delivery_address;
ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT 'Cash on Delivery' AFTER phone;
ALTER TABLE orders ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0 AFTER payment_method;
ALTER TABLE orders ADD COLUMN delivery DECIMAL(10,2) DEFAULT 550 AFTER subtotal;
ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) DEFAULT 'Unpaid' AFTER status;
ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(30) DEFAULT NULL AFTER payment_status;
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0 AFTER coupon_code;

-- Fix order_items: add missing columns
ALTER TABLE order_items ADD COLUMN size VARCHAR(20) DEFAULT '' AFTER product_id;
ALTER TABLE order_items ADD COLUMN color VARCHAR(50) DEFAULT '' AFTER size;
ALTER TABLE order_items ADD COLUMN price DECIMAL(10,2) DEFAULT 0 AFTER quantity;

-- Create cart_items table
CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  size VARCHAR(20) DEFAULT 'M',
  color VARCHAR(50) DEFAULT 'Default',
  quantity INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT DEFAULT NULL,
  reviewer_name VARCHAR(100) NOT NULL,
  rating TINYINT DEFAULT 5,
  review_text TEXT,
  verified TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Create payment_sessions table
CREATE TABLE IF NOT EXISTS payment_sessions (
  id VARCHAR(64) PRIMARY KEY,
  order_id INT DEFAULT NULL,
  customer_name VARCHAR(200),
  customer_email VARCHAR(200),
  delivery_address TEXT,
  phone VARCHAR(30),
  items_json TEXT,
  promo_code VARCHAR(30),
  total DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
