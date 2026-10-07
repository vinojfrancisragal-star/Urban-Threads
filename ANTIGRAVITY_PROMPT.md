# Paste everything below into Antigravity

I have an existing e-commerce site "Urban Threads" at http://localhost/urban-threads/
(WAMP: Apache + MySQL, plain HTML/CSS/JS, PHP available). Pages are in /public/
(e.g. /public/shop.html). DO NOT create a React/Vite project, DO NOT rename my
pages, and DO NOT redesign anything. Edit my existing files only.

This folder already contains a ready-made database backend I generated:
- setup.sql                  (database "urban_threads": categories, products, users, orders, order_items + all category slugs)
- api/config.php, api/db.php (PDO connection, root / empty password)
- api/products.php           (JSON API: ?category= ?subcategory= ?id=)
- import_products.php        (loads products.csv, skips duplicates, warns about missing images)
- products.csv               (columns: name, category, subcategory, description, price, stock, image)
- admin/                     (login, add/edit/delete products with validated image upload)
- public/shop-db.js          (fetches the API and renders product cards / detail view into #product-grid)
- images/placeholder.svg     (fallback image; I have no product pictures yet)

My menu URLs look like shop.html?category=men&subcategory=tops
Category slugs: men(tops, activewear, underwear), women(dresses, lingerie, sleepwear),
kids(clothing, baby), footwear(athletic, casual, boots, sandals),
accessories(bags, jewelry, watches, belts), festive (no subcategories).

YOUR TASKS
1. Read all my existing files first and show me a short plan. Then proceed.
2. Review the generated PHP files for bugs or security problems and fix them
   (prepared statements only, htmlspecialchars on output, CSRF on admin forms,
   no secrets exposed). Do not change their purpose.
3. Update /public/shop.html:
   - add <div id="product-grid"></div> where my product list currently is
     (remove my hard-coded sample products),
   - include <script src="shop-db.js"></script> before </body>,
   - edit shop-db.js so the generated card and detail markup uses MY existing
     CSS class names and looks identical to my current design.
4. Make sure my "Add to cart" button/cart logic (if I have any) works with
   products loaded from the database (use product id).
5. I have NO product images yet. Leave the image column in products.csv
   empty. Keep /images/placeholder.svg (already provided) as the fallback so
   every product card shows it. Fill products.csv with realistic sample
   products for ALL categories and subcategories (2-3 each, placeholder
   prices/descriptions that I will review).
6. Make sure the admin edit page lets me add an image to any product later.
7. Test: run setup.sql, then import_products.php, then check that
   shop.html, shop.html?category=women&subcategory=dresses and
   shop.html?id=1 all show correct products. Report any errors.
8. Finish by giving me step-by-step instructions for:
   - running setup.sql in phpMyAdmin,
   - running the import,
   - creating the first admin at /urban-threads/admin/create_admin.php,
   - and which files to delete afterwards (import_products.php, admin/create_admin.php).
