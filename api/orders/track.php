<?php
/**
 * GET /api/orders/track?orderId=UT-123&email=...
 */
require_once __DIR__ . '/../../api/db.php';

$orderId = $_GET['orderId'] ?? '';
$email   = trim($_GET['email'] ?? '');

if (!$orderId || !$email) jsonError('Order ID and Email are required');

$numericId = (int)str_replace('UT-', '', $orderId);
if (!$numericId) jsonError('Invalid order ID format');

$db   = getDB();
$stmt = $db->prepare('SELECT * FROM orders WHERE id = ? AND LOWER(customer_email) = LOWER(?)');
$stmt->execute([$numericId, $email]);
$order = $stmt->fetch();

if (!$order) jsonError('Order not found with those details', 404);

$stmt = $db->prepare('
    SELECT oi.quantity, oi.price, oi.size, oi.color, p.name, p.image
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
');
$stmt->execute([$order['id']]);
$items = $stmt->fetchAll();

jsonSuccess(['order' => $order, 'items' => $items]);
