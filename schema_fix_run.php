<?php
/**
 * One-time schema migration script. Run via browser then DELETE this file.
 * URL: http://localhost/urban-threads/schema_fix_run.php
 */
require_once __DIR__ . '/api/db.php';

$db = getDB();
$errors = [];
$success = [];

$statements = [
    // Orders: add missing columns
    "ALTER TABLE orders ADD COLUMN customer_name VARCHAR(200) DEFAULT '' AFTER user_id",
    "ALTER TABLE orders ADD COLUMN customer_email VARCHAR(200) DEFAULT '' AFTER customer_name",
    "ALTER TABLE orders ADD COLUMN delivery_address TEXT AFTER customer_email",
    "ALTER TABLE orders ADD COLUMN phone VARCHAR(30) DEFAULT '' AFTER delivery_address",
    "ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT 'Cash on Delivery' AFTER phone",
    "ALTER TABLE orders ADD COLUMN subtotal DECIMAL(10,2) DEFAULT 0 AFTER payment_method",
    "ALTER TABLE orders ADD COLUMN delivery DECIMAL(10,2) DEFAULT 550 AFTER subtotal",
    "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(20) DEFAULT 'Unpaid' AFTER status",
    "ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(30) DEFAULT NULL AFTER payment_status",
    "ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0 AFTER coupon_code",
    // Order items: add missing columns
    "ALTER TABLE order_items ADD COLUMN size VARCHAR(20) DEFAULT '' AFTER product_id",
    "ALTER TABLE order_items ADD COLUMN color VARCHAR(50) DEFAULT '' AFTER size",
    "ALTER TABLE order_items ADD COLUMN price DECIMAL(10,2) DEFAULT 0 AFTER quantity",
    // Cart items table
    "CREATE TABLE IF NOT EXISTS cart_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        size VARCHAR(20) DEFAULT 'M',
        color VARCHAR(50) DEFAULT 'Default',
        quantity INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )",
    // Reviews table
    "CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        user_id INT DEFAULT NULL,
        reviewer_name VARCHAR(100) NOT NULL,
        rating TINYINT DEFAULT 5,
        review_text TEXT,
        verified TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )",
    // Payment sessions table
    "CREATE TABLE IF NOT EXISTS payment_sessions (
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
    )",
];

header('Content-Type: text/plain; charset=utf-8');
echo "=== Urban Threads Schema Migration ===\n\n";

foreach ($statements as $sql) {
    try {
        $db->exec($sql);
        $short = substr(trim($sql), 0, 60);
        echo "[OK]  $short...\n";
        $success[] = $short;
    } catch (Throwable $e) {
        $msg = $e->getMessage();
        $short = substr(trim($sql), 0, 60);
        // "Duplicate column" is fine — means it already exists
        if (stripos($msg, 'Duplicate column') !== false) {
            echo "[SKIP] $short... (column already exists)\n";
        } else {
            echo "[ERR] $short...\n      $msg\n";
            $errors[] = $msg;
        }
    }
}

echo "\n--- Summary ---\n";
echo "Success: " . count($success) . "\n";
echo "Errors:  " . count($errors) . "\n";

if (empty($errors)) {
    echo "\n✓ All migrations applied successfully!\n";
    echo "  DELETE this file now: schema_fix_run.php\n";
} else {
    echo "\n✗ Some errors occurred. Check above.\n";
}

// Verify
echo "\n--- Table list ---\n";
foreach ($db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t) {
    echo "  • $t\n";
}
