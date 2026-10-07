# Urban Threads database package

1. Copy this folder's contents into C:\wamp64\www\urban-threads\ (merge with your existing site; keep your /public pages).
2. Start WAMP (icon green). Open http://localhost/phpmyadmin > Import > choose setup.sql > Go.
3. Put pictures in images/products/ and edit products.csv.
4. Open http://localhost/urban-threads/import_products.php
5. Open http://localhost/urban-threads/admin/create_admin.php to create your admin, then log in at /admin/login.php
6. In public/shop.html add <div id="product-grid"></div> and <script src="shop-db.js"></script>
7. Delete import_products.php and admin/create_admin.php when finished.
