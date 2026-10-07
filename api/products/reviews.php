<?php
/**
 * GET  /api/products/:id/reviews
 * POST /api/products/:id/reviews
 */
require_once __DIR__ . '/../../api/db.php';

$productId = (int)($_GET['id'] ?? 0);
if (!$productId) jsonError('Product ID required');

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC');
    $stmt->execute([$productId]);
    jsonSuccess($stmt->fetchAll());
}

if ($method === 'POST') {
    $userId = requireAuth();
    $body   = getBody();
    $name   = trim($body['name']   ?? '');
    $rating = (int)($body['rating'] ?? 5);
    $text   = trim($body['text']   ?? '');

    if (!$name || !$text) jsonError('Please provide name, rating, and review text.');
    $stars = max(1, min(5, $rating));

    // Verified buyer check
    $stmt = $db->prepare("
        SELECT COUNT(*) FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = ? AND oi.product_id = ? AND o.payment_status = 'Paid'
    ");
    $stmt->execute([$userId, $productId]);
    if ((int)$stmt->fetchColumn() === 0) {
        jsonError('Only verified buyers can leave a review.', 403);
    }

    // Already reviewed?
    $stmt = $db->prepare('SELECT COUNT(*) FROM reviews WHERE user_id = ? AND product_id = ?');
    $stmt->execute([$userId, $productId]);
    if ((int)$stmt->fetchColumn() > 0) {
        jsonError('You have already reviewed this product.');
    }

    $db->prepare('INSERT INTO reviews (product_id, user_id, reviewer_name, rating, review_text, verified) VALUES (?,?,?,?,?,1)')
       ->execute([$productId, $userId, $name, $stars, $text]);

    jsonSuccess();
}

jsonError('Method not allowed', 405);
