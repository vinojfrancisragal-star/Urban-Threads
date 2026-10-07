<?php
/**
 * GET    /api/wishlist          — list wishlist items
 * POST   /api/wishlist          — add item
 * DELETE /api/wishlist/:id      — remove item
 */
require_once __DIR__ . '/../../api/db.php';

$userId = requireAuth();
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare('
        SELECT p.id, p.name, p.price, p.image, p.category_label, p.stock
        FROM wishlist w
        JOIN products p ON w.product_id = p.id
        WHERE w.user_id = ?
    ');
    $stmt->execute([$userId]);
    $items = $stmt->fetchAll();
    foreach ($items as &$i) { $i['price'] = (float)$i['price']; }
    jsonSuccess($items);
}

if ($method === 'POST') {
    $body      = getBody();
    $productId = (int)($body['productId'] ?? 0);
    if (!$productId) jsonError('Product ID required');

    // Insert if not already in wishlist (ignore duplicate)
    $db->prepare('INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?,?)')
       ->execute([$userId, $productId]);

    jsonSuccess();
}

if ($method === 'DELETE') {
    $parts     = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
    $productId = (int)end($parts);
    if (!$productId) jsonError('Product ID required');

    $db->prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?')
       ->execute([$userId, $productId]);

    jsonSuccess();
}

jsonError('Method not allowed', 405);
