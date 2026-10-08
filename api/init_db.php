<?php
/**
 * api/init_db.php
 * Run ONCE in browser: http://localhost/urban-threads/api/init_db.php
 * Creates all tables and seeds the 64 catalog products.
 */

require_once __DIR__ . '/../config.php';

header('Content-Type: text/html; charset=utf-8');

// ── Create database if missing ───────────────────────────────────────────────
try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `" . DB_NAME . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `" . DB_NAME . "`");
} catch (PDOException $e) {
    die('<b>Connection failed:</b> ' . $e->getMessage());
}

// ── Schema ────────────────────────────────────────────────────────────────────
$tables = [

"CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `name`          VARCHAR(100) NOT NULL,
  `email`         VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role`          ENUM('customer','admin') NOT NULL DEFAULT 'customer',
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB",

"CREATE TABLE IF NOT EXISTS `products` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `name`             VARCHAR(200) NOT NULL,
  `slug`             VARCHAR(200) NOT NULL UNIQUE,
  `description`      TEXT,
  `price`            DECIMAL(10,2) NOT NULL,
  `discount_percent` TINYINT NOT NULL DEFAULT 0,
  `category`         VARCHAR(100) NOT NULL,
  `category_label`   VARCHAR(100) NOT NULL,
  `subcategory`      VARCHAR(100),
  `subcategory_label` VARCHAR(100),
  `image`            VARCHAR(300) NOT NULL,
  `stock`            INT NOT NULL DEFAULT 15,
  `created_at`       DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB",

"CREATE TABLE IF NOT EXISTS `cart_items` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT NOT NULL,
  `product_id` INT NOT NULL,
  `size`       VARCHAR(10) NOT NULL,
  `color`      VARCHAR(50) NOT NULL,
  `quantity`   INT NOT NULL DEFAULT 1,
  UNIQUE KEY `uq_cart` (`user_id`,`product_id`,`size`,`color`),
  FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB",

"CREATE TABLE IF NOT EXISTS `orders` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`          INT,
  `customer_name`    VARCHAR(150) NOT NULL,
  `customer_email`   VARCHAR(150) NOT NULL,
  `delivery_address` TEXT NOT NULL,
  `payment_method`   VARCHAR(50)  NOT NULL DEFAULT 'Cash on Delivery',
  `subtotal`         DECIMAL(12,2) NOT NULL DEFAULT 0,
  `delivery`         DECIMAL(10,2) NOT NULL DEFAULT 550,
  `total`            DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status`           ENUM('Pending','Processing','Shipped','Delivered','Cancelled') NOT NULL DEFAULT 'Pending',
  `payment_status`   ENUM('Unpaid','Paid','Refunded') NOT NULL DEFAULT 'Unpaid',
  `coupon_code`      VARCHAR(50),
  `discount_amount`  DECIMAL(10,2) NOT NULL DEFAULT 0,
  `stripe_session_id` VARCHAR(300),
  `created_at`       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB",

"CREATE TABLE IF NOT EXISTS `order_items` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `order_id`   INT NOT NULL,
  `product_id` INT NOT NULL,
  `size`       VARCHAR(10),
  `color`      VARCHAR(50),
  `quantity`   INT NOT NULL DEFAULT 1,
  `price`      DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (`order_id`)   REFERENCES `orders`(`id`)   ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB",

"CREATE TABLE IF NOT EXISTS `reviews` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `product_id`    INT NOT NULL,
  `user_id`       INT,
  `reviewer_name` VARCHAR(100),
  `rating`        TINYINT NOT NULL DEFAULT 5,
  `review_text`   TEXT,
  `verified`      TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE SET NULL
) ENGINE=InnoDB",

"CREATE TABLE IF NOT EXISTS `wishlist` (
  `user_id`    INT NOT NULL,
  `product_id` INT NOT NULL,
  PRIMARY KEY (`user_id`,`product_id`),
  FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB",

];

echo "<h2>Urban Threads — DB Initializer</h2><pre>";

foreach ($tables as $sql) {
    $pdo->exec($sql);
    echo "✅ Table created/verified\n";
}

// ── Admin account ─────────────────────────────────────────────────────────────
$adminEmail = 'admin@urbanthreads.lk';
$stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
$stmt->execute([$adminEmail]);
if (!$stmt->fetch()) {
    $hash = password_hash('admin123', PASSWORD_DEFAULT);
    $pdo->prepare("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)")
        ->execute(['Store Manager', $adminEmail, $hash, 'admin']);
    echo "✅ Admin account created → admin@urbanthreads.lk / admin123\n";
} else {
    echo "ℹ️  Admin account already exists\n";
}

// ── Seed products ─────────────────────────────────────────────────────────────
$count = $pdo->query("SELECT COUNT(*) FROM products")->fetchColumn();
if ($count > 0) {
    echo "ℹ️  Products already seeded ($count rows). Skipping.\n";
} else {
    $products = [
        // Men: Shirts & Tees (8)
        ['Classic Beige Striped Polo','men-1','Beige polo with premium dark brown collar stripes.',4500,0,'men','Men','shirts-tees','Shirts & Tees','assets/images/polo-stripe-beige.jpg'],
        ['Navy & Gold Striped Polo','men-2','Navy blue polo with clean yellow vertical stripes.',4500,10,'men','Men','shirts-tees','Shirts & Tees','assets/images/shirt-680x920.jpg'],
        ['Burgundy & Cream Trim Polo','men-3','Burgundy polo with soft contrasting cream collar.',4200,0,'men','Men','shirts-tees','Shirts & Tees','assets/images/SHIRT-2_0000s_0008_DSC05197-680x920.jpg'],
        ['Waffle Textured White Polo','men-4','White waffle knit polo with clean black cuff trim.',4800,0,'men','Men','shirts-tees','Shirts & Tees','assets/images/shirt-680x920.jpg'],
        ['Teal Ribbed Zipper Polo','men-5','Teal ribbed polo with a contemporary front zip.',4900,15,'men','Men','shirts-tees','Shirts & Tees','assets/images/SHIRT-2_0000s_0001_DSC04693-680x920.jpg'],
        ['Classic Tan Plaid Flannel','men-6','Warm tan and cream plaid long-sleeve flannel.',5200,0,'men','Men','shirts-tees','Shirts & Tees','assets/images/shirt_0005_DSC04561-680x920.jpg'],
        ['Abercrombie Navy Plaid Flannel','men-7','Heavyweight navy flannel with double chest pockets.',5400,20,'men','Men','shirts-tees','Shirts & Tees','assets/images/SHIRT-2_0000s_0001_DSC04693-680x920.jpg'],
        ['Knitted Biscuit Polo','men-8','Luxurious knitted polo in a neutral biscuit tan.',6200,0,'men','Men','shirts-tees','Shirts & Tees','assets/images/polo-tan.jpg'],
        // Men: Bottoms & Trousers (8)
        ["Signature Men's Formal Trouser",'men-9','Signature formal flat-front trouser.',3800,0,'men','Men','bottoms-trousers','Bottoms & Trousers','assets/images/37_SIGNATURE-MENS-FORMAL-TROUSER-680x920.jpg'],
        ['AeroDry Athletic Joggers','men-10','Moisture-wicking athletic gym track pants.',4200,0,'men','Men','bottoms-trousers','Bottoms & Trousers','assets/images/shirt-680x920.jpg'],
        ['Classic Cotton Chino Trousers','men-11','Slim-fit cotton chinos for clean styling.',4500,0,'men','Men','bottoms-trousers','Bottoms & Trousers','assets/images/37_SIGNATURE-MENS-FORMAL-TROUSER-680x920.jpg'],
        ['Slim Fit Stretch Denim Jeans','men-12','Stretchable indigo denim jeans slim fit.',4900,10,'men','Men','bottoms-trousers','Bottoms & Trousers','assets/images/37_SIGNATURE-MENS-FORMAL-TROUSER-680x920.jpg'],
        ['Active Comfort Gym Shorts','men-13','Flexible gym shorts with deep pockets.',2900,0,'men','Men','bottoms-trousers','Bottoms & Trousers','assets/images/mens-casual-short-1709967629094.webp'],
        ['Linen Drawstring Summer Shorts','men-14','Lightweight linen shorts for sunny outings.',3200,15,'men','Men','bottoms-trousers','Bottoms & Trousers','assets/images/mens-casual-short-17127446078029.webp'],
        ['Premium Cotton Cargo Pants','men-15','Multi-pocket cargo trousers for casual utility.',5200,0,'men','Men','bottoms-trousers','Bottoms & Trousers','assets/images/37_SIGNATURE-MENS-FORMAL-TROUSER-680x920.jpg'],
        ['Tailored Khaki Dress Trousers','men-16','Elegant khaki trousers with a clean front crease.',4600,0,'men','Men','bottoms-trousers','Bottoms & Trousers','assets/images/37_SIGNATURE-MENS-FORMAL-TROUSER-680x920.jpg'],
        // Women: Sarees (4)
        ['Traditional Handloom Cotton Saree','women-1','Vibrant handloom cotton saree for festivals.',8500,0,'women','Women','sarees','Sarees','assets/images/Saree 1.jpeg'],
        ['Embroidered Georgette Saree','women-2','Designer georgette saree with gold embroidery.',9800,10,'women','Women','sarees','Sarees','assets/images/Saree 2.jpeg'],
        ['Pure Silk Bridal Saree','women-3','Premium pure silk saree with heavy zari borders.',16500,0,'women','Women','sarees','Sarees','assets/images/Saree 3.jpeg'],
        ['Vibrant Festive Kanchipuram Saree','women-4','Kanchipuram silk saree with colorful motifs.',7900,15,'women','Women','sarees','Sarees','assets/images/Saree 4.jpeg'],
        // Women: Dresses & Frocks (4)
        ['Floral Summer Day Dress','women-5','Lightweight floral dress with an elegant flared hem.',4200,0,'women','Women','dresses-frocks','Dresses & Frocks','assets/images/Frock 1.jpeg'],
        ['Classic Evening Velvet Gown','women-6','Stunning velvet evening gown for cocktail parties.',6800,0,'women','Women','dresses-frocks','Dresses & Frocks','assets/images/Frock 2.jpeg'],
        ['Embellished Silk Dress','women-7','Hand-woven silk dress for wedding occasions.',8900,20,'women','Women','dresses-frocks','Dresses & Frocks','assets/images/Frock 3.jpeg'],
        ['Linen A-Line Midi Frock','women-8','A-line summer frock with convenient side pockets.',3900,0,'women','Women','dresses-frocks','Dresses & Frocks','assets/images/Frock 4.jpeg.jpg'],
        // Women: Shalwar Sets (4)
        ['Classic Cotton Shalwar Suit','women-9','Lightweight daily comfort cotton shalwar set.',4800,0,'women','Women','shalwar-sets','Shalwar Sets','assets/images/Shalwar 1.jpeg'],
        ['Embroidered Silk Shalwar Set','women-10','Semi-formal shalwar suit with neck embroidery.',6200,0,'women','Women','shalwar-sets','Shalwar Sets','assets/images/Shalwar 2.jpeg'],
        ['Designer Anarkali Shalwar Set','women-11','Flared Anarkali suit with matched dupatta.',7500,15,'women','Women','shalwar-sets','Shalwar Sets','assets/images/Shalwar 3.jpeg'],
        ['Printed Casual Shalwar Kameez','women-12','Daily printed cotton Kameez with classic trousers.',3900,0,'women','Women','shalwar-sets','Shalwar Sets','assets/images/Shalwar 4.jpeg'],
        // Women: Tops (4)
        ['Casual Linen Peplum Top','women-13','Flattering linen peplum top with short sleeves.',2900,0,'women','Women','tops','Tops','assets/images/Women t shirt 1.jpeg'],
        ['Printed Cotton Crewneck Tee','women-14','Premium cotton tee with stylish typography.',1800,0,'women','Women','tops','Tops','assets/images/Women t shirt 2.jpeg'],
        ['Elegant Lace Sleeve Blouse','women-15','Feminine blouse with floral lace embroidery.',3500,10,'women','Women','tops','Tops','assets/images/Women t shirt 3.jpeg'],
        ['Minimalist Ribbed Knit Top','women-16','Fitted ribbed knit top designed for layering.',2400,0,'women','Women','tops','Tops','assets/images/Women t shirt 4.jpeg.jpg'],
        // Kids: Boys Clothing (8)
        ['Boys Colorblock Smart Shirt Set','kids-1','Colorblock shirt with matching chino shorts.',3200,0,'kids','Kids','boys-clothing','Boys Clothing','assets/images/Boys full kit 1.jpg'],
        ['Boys Denim Jacket & Graphic Tee','kids-2','Denim trucker jacket over a printed crewneck tee.',4500,0,'kids','Kids','boys-clothing','Boys Clothing','assets/images/Boys full kit 2.jpg'],
        ['Boys Casual Cotton Short Set','kids-3','Lightweight summer short set for active boys.',2800,10,'kids','Kids','boys-clothing','Boys Clothing','assets/images/Boys full kit 3.jpg'],
        ['Boys Striped Polo & Khakis Set','kids-4','Striped polo paired with soft cotton khakis.',3900,0,'kids','Kids','boys-clothing','Boys Clothing','assets/images/Boys full kit 4.jpg'],
        ['Kids Retro Panelled Polo','kids-5','Cream polo with beige panels and zip collar.',2900,0,'kids','Kids','boys-clothing','Boys Clothing','assets/images/polo-kids.jpg'],
        ['Organic Cotton Baby Romper Set','kids-6','Soft organic cotton romper with snap buttons.',2400,0,'kids','Kids','boys-clothing','Boys Clothing','assets/images/Toddler Boys Colourblock Pocket Patched Shirt & Trousers Without Tee.jpg'],
        ['Kids Casual Checkered Collar Shirt','kids-7','Long-sleeve plaid collar shirt for gatherings.',2600,0,'kids','Kids','boys-clothing','Boys Clothing','assets/images/Kids Shirt 1.jpg'],
        ['Kids Graphic Printed Crewneck Tee','kids-8','Fun graphic printed sports tee in soft cotton.',1800,15,'kids','Kids','boys-clothing','Boys Clothing','assets/images/Kids Shirt 2.jpg'],
        // Kids: Girls Clothing (4)
        ['Girls Floral Summer Frock','kids-9','Floral cotton frock with shoulder bows.',3200,0,'kids','Kids','girls-clothing','Girls Clothing','assets/images/Girls full kit 1.jpg'],
        ['Girls Denim Skirt & Knit Top Set','kids-10','Stretch denim skirt and ribbed knit top set.',3900,10,'kids','Kids','girls-clothing','Girls Clothing','assets/images/Girls full kit 2.jpg'],
        ['Girls Party Tulle Layer Dress','kids-11','Party dress with layered tulle and sparkling belt.',4800,0,'kids','Kids','girls-clothing','Girls Clothing','assets/images/Girls full kit 3.jpg'],
        ['Girls Cotton Tiered Casual Dress','kids-12','Tiered A-line cotton dress for daily play.',2900,0,'kids','Kids','girls-clothing','Girls Clothing','assets/images/Girls full kit 4.jpg'],
        // Kids: Footwear (4)
        ['Kids Sporty Light-Up Sneakers','kids-13','Athletic shoes with LED lights in the soles.',3400,0,'kids','Kids','kids-footwear','Kids Footwear','assets/images/Kids shoes 1.jpg'],
        ['Boys Slip-On Leather Loafers','kids-14','Classic slip-on formal loafers with padded insoles.',2900,0,'kids','Kids','kids-footwear','Kids Footwear','assets/images/Kids shoes 2.jpg'],
        ['Girls Glitter Ballet Flats','kids-15','Sparkling ballet flats with a secure elastic strap.',2800,15,'kids','Kids','kids-footwear','Kids Footwear','assets/images/Kids shoes 3.jpg'],
        ['Toddler Soft-Sole Summer Sandals','kids-16','Open-toe sandals with soft protective soles.',2200,0,'kids','Kids','kids-footwear','Kids Footwear','assets/images/Kids shoes 4.jpg'],
        // Accessories: Hats & Caps (4)
        ['Retro Embroidered Baseball Cap','acc-1','Vintage washed cotton baseball cap with buckle.',1800,0,'accessories','Accessories','hats-caps','Hats & Caps','assets/images/Cap - 1.jpg'],
        ['Sporty Breathable Mesh Cap','acc-2','Running sports cap with mesh ventilation panels.',1500,0,'accessories','Accessories','hats-caps','Hats & Caps','assets/images/Cap - 2.jpg'],
        ['Classic Summer Sun Visor','acc-3','Lightweight sun visor with structured brim.',1600,10,'accessories','Accessories','hats-caps','Hats & Caps','assets/images/Cap - 3.jpg'],
        ['Warm Ribbed Wool Beanie','acc-4','Cozy cuffed knit wool beanie for cold days.',2200,0,'accessories','Accessories','hats-caps','Hats & Caps','assets/images/Cap - 4.jpg'],
        // Accessories: Wallets (4)
        ['Classic Bifold Leather Wallet','acc-5','Full-grain leather bifold with card sleeves.',2800,0,'accessories','Accessories','wallets','Wallets','assets/images/Wallet - 1.jpg'],
        ['Slim Leather Card Holder Wallet','acc-6','Ultra-slim card case with center cash pocket.',1900,10,'accessories','Accessories','wallets','Wallets','assets/images/Wallet - 2.jpg'],
        ['Zipper Around Leather Wallet','acc-7','Security zip wallet in textured pebbled leather.',3200,0,'accessories','Accessories','wallets','Wallets','assets/images/Wallet - 3.jpg'],
        ['Classic Tan Minimalist Wallet','acc-8','Tan leather wallet with RFID protection.',2500,0,'accessories','Accessories','wallets','Wallets','assets/images/Wallet - 4.jpg'],
        // Accessories: Watches (4)
        ['Elegant Gold Mesh Analog Watch','acc-9','Gold-plated minimalist watch for formal wear.',7500,0,'accessories','Accessories','watches','Watches','assets/images/Watch - 1.jpg'],
        ['Minimalist Silver Steel Watch','acc-10','Stainless steel watch with elegant blue dial.',8200,0,'accessories','Accessories','watches','Watches','assets/images/Watch - 2.jpg'],
        ['Smart Fitness Bluetooth Watch','acc-11','Smart watch tracking heart rate and sleep.',5800,15,'accessories','Accessories','watches','Watches','assets/images/Watch - 3.jpg'],
        ['Sporty Chronograph Metal Watch','acc-12','Steel chronograph with rotatable bezel ring.',9500,0,'accessories','Accessories','watches','Watches','assets/images/Watch - 4.jpg'],
        // Accessories: Eyewear (4)
        ['Classic Polarized Aviator Sunglasses','acc-13','Polarized metal aviators for UV protection.',3800,0,'accessories','Accessories','eyewear','Eyewear','assets/images/Sunglass for men - 1.jpg'],
        ['Retro Square Wayfarer Sunglasses','acc-14','Classic acetate frames for all casual looks.',2900,10,'accessories','Accessories','eyewear','Eyewear','assets/images/Sunglass for men - 2.jpg'],
        ['Sporty Wrap-Around Polarized Glasses','acc-15','Aerodynamic sunglasses for sports and cycling.',3200,0,'accessories','Accessories','eyewear','Eyewear','assets/images/Sunglass for men - 3.jpg'],
        ['Modern Round Metal Frame Glasses','acc-16','Retro round frames for fashion and optical.',4200,0,'accessories','Accessories','eyewear','Eyewear','assets/images/Sunglass for men - 4.jpg'],
    ];

    $stmt = $pdo->prepare("
        INSERT INTO products (name,slug,description,price,discount_percent,category,category_label,subcategory,subcategory_label,image,stock)
        VALUES (?,?,?,?,?,?,?,?,?,?,15)
    ");

    foreach ($products as $p) {
        $stmt->execute($p);
    }
    echo "✅ Seeded " . count($products) . " products\n";
}

echo "</pre><hr><b>✅ Database ready!</b> <a href='../public/index.html'>→ Open Shop</a>";
