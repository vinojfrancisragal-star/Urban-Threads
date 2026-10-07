<?php
/**
 * GET /api/products/:id  →  called as /api/products/single.php?id=X
 */
require_once __DIR__ . '/../../api/db.php';

$id = (int)($_GET['id'] ?? 0);
if (!$id) jsonError('Product ID required');

$db   = getDB();
$stmt = $db->prepare('
    SELECT p.*,
           COALESCE(AVG(r.rating), 0) AS average_rating,
           COUNT(r.id)                AS review_count
    FROM products p
    LEFT JOIN reviews r ON p.id = r.product_id
    WHERE p.id = ?
    GROUP BY p.id
');
$stmt->execute([$id]);
$product = $stmt->fetch();

if (!$product) jsonError('Product not found', 404);

$product['price']            = (float)$product['price'];
$product['discount_percent'] = (int)$product['discount_percent'];
$product['stock']            = (int)$product['stock'];
$product['average_rating']   = round((float)$product['average_rating'], 1);
$product['review_count']     = (int)$product['review_count'];

jsonSuccess($product);
