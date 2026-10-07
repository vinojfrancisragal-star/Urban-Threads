<?php
/**
 * GET    /api/cart          — list items
 * POST   /api/cart          — add / update item
 * DELETE /api/cart/:id      — remove item
 */
require_once __DIR__ . '/../../api/db.php';

$userId = requireAuth();
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $stmt = $db->prepare('
        SELECT p.id, p.name, p.price, p.image,
               COALESCE(pc.name, cat.name) AS category_label,
               c.size, c.color, c.quantity
        FROM cart_items c
        JOIN products p ON c.product_id = p.id
        JOIN categories cat ON p.category_id = cat.id
        LEFT JOIN categories pc ON cat.parent_id = pc.id
        WHERE c.user_id = ?
    ');
    $stmt->execute([$userId]);
    $items = $stmt->fetchAll();
    foreach ($items as &$i) { $i['price'] = (float)$i['price']; }
    jsonSuccess($items);
}

// ── POST — add/update ─────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body      = getBody();
    $productId = (int)($body['productId'] ?? 0);
    $size      = trim($body['size']  ?? '');
    $color     = trim($body['color'] ?? '');
    $qty       = (int)($body['quantity'] ?? 1);

    if (!$productId || !$size || !$color) {
        jsonError('Product ID, size, and color required');
    }

    $stmt = $db->prepare('
        SELECT quantity FROM cart_items
        WHERE user_id = ? AND product_id = ? AND size = ? AND color = ?
    ');
    $stmt->execute([$userId, $productId, $size, $color]);
    $existing = $stmt->fetch();

    if ($existing) {
        $newQty = $existing['quantity'] + $qty;
        if ($newQty <= 0) {
            $db->prepare('DELETE FROM cart_items WHERE user_id=? AND product_id=? AND size=? AND color=?')
               ->execute([$userId, $productId, $size, $color]);
        } else {
            $db->prepare('UPDATE cart_items SET quantity=? WHERE user_id=? AND product_id=? AND size=? AND color=?')
               ->execute([$newQty, $userId, $productId, $size, $color]);
        }
    } elseif ($qty > 0) {
        $db->prepare('INSERT INTO cart_items (user_id,product_id,size,color,quantity) VALUES (?,?,?,?,?)')
           ->execute([$userId, $productId, $size, $color, $qty]);
    }

    jsonSuccess();
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    // URL: /api/cart/123?size=M&color=Blue
    $parts     = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
    $productId = (int)end($parts);
    $size      = $_GET['size']  ?? '';
    $color     = $_GET['color'] ?? '';

    if (!$productId || !$size || !$color) jsonError('Product ID, size, and color required');

    $db->prepare('DELETE FROM cart_items WHERE user_id=? AND product_id=? AND size=? AND color=?')
       ->execute([$userId, $productId, $size, $color]);

    jsonSuccess();
}

jsonError('Method not allowed', 405);
