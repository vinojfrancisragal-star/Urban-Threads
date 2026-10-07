<?php
/**
 * GET /api/products
 * Supports: category, subcategory, search, sort, minPrice, maxPrice, sale
 */
require_once __DIR__ . '/../../api/db.php';

$db     = getDB();
$params = [];

$sql = '
    SELECT p.*,
           COALESCE(AVG(r.rating), 0) AS average_rating,
           COUNT(r.id)                AS review_count
    FROM products p
    LEFT JOIN reviews r ON p.id = r.product_id
    WHERE 1=1
';

if (!empty($_GET['category'])) {
    $sql .= ' AND p.category = ?';
    $params[] = $_GET['category'];
}

if (!empty($_GET['subcategory'])) {
    $sql .= ' AND p.subcategory = ?';
    $params[] = $_GET['subcategory'];
}

if (!empty($_GET['search'])) {
    $sql .= ' AND p.name LIKE ?';
    $params[] = '%' . $_GET['search'] . '%';
}

if (isset($_GET['minPrice']) && $_GET['minPrice'] !== '') {
    $sql .= ' AND p.price >= ?';
    $params[] = (float)$_GET['minPrice'];
}

if (isset($_GET['maxPrice']) && $_GET['maxPrice'] !== '') {
    $sql .= ' AND p.price <= ?';
    $params[] = (float)$_GET['maxPrice'];
}

if (($_GET['sale'] ?? '') === 'true') {
    $sql .= ' AND p.discount_percent > 0';
}

$sql .= ' GROUP BY p.id';

$sort = $_GET['sort'] ?? '';
if ($sort === 'price-low')  $sql .= ' ORDER BY p.price ASC';
elseif ($sort === 'price-high') $sql .= ' ORDER BY p.price DESC';
elseif ($sort === 'name')   $sql .= ' ORDER BY p.name ASC';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$products = $stmt->fetchAll();

// Cast numeric fields
foreach ($products as &$p) {
    $p['price']            = (float)$p['price'];
    $p['discount_percent'] = (int)$p['discount_percent'];
    $p['stock']            = (int)$p['stock'];
    $p['average_rating']   = round((float)$p['average_rating'], 1);
    $p['review_count']     = (int)$p['review_count'];
}

jsonSuccess($products);
