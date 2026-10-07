<?php
/**
 * GET /api/products/:id/eligibility
 */
require_once __DIR__ . '/../../api/db.php';

$productId = (int)($_GET['id'] ?? 0);
if (!$productId) jsonError('Product ID required');

if (empty($_SESSION['user_id'])) {
    jsonSuccess(['canReview' => false, 'reason' => 'Please log in to leave a review.']);
}

$userId = (int)$_SESSION['user_id'];
$db     = getDB();

$stmt = $db->prepare("
    SELECT COUNT(*) FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = ? AND oi.product_id = ? AND o.payment_status = 'Paid'
");
$stmt->execute([$userId, $productId]);
if ((int)$stmt->fetchColumn() === 0) {
    jsonSuccess(['canReview' => false, 'reason' => 'Only verified buyers can leave a review.']);
}

$stmt = $db->prepare('SELECT COUNT(*) FROM reviews WHERE user_id = ? AND product_id = ?');
$stmt->execute([$userId, $productId]);
if ((int)$stmt->fetchColumn() > 0) {
    jsonSuccess(['canReview' => false, 'reason' => 'You have already reviewed this product.']);
}

jsonSuccess(['canReview' => true]);
