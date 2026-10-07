<?php
/**
 * GET /api/admin/orders          — list all orders
 * PUT /api/admin/orders/:id      — update order status
 */
require_once __DIR__ . '/../../api/db.php';

requireAdmin();
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt   = $db->query('SELECT * FROM orders ORDER BY created_at DESC');
    $orders = $stmt->fetchAll();

    foreach ($orders as &$order) {
        $stmt2 = $db->prepare('
            SELECT oi.quantity, oi.price, oi.size, oi.color, p.name
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        ');
        $stmt2->execute([$order['id']]);
        $order['items'] = $stmt2->fetchAll();
    }

    jsonSuccess($orders);
}

if ($method === 'PUT') {
    $parts = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
    $id    = (int)end($parts);
    $body  = getBody();

    if (!$id) jsonError('Order ID required');
    if (empty($body['status'])) jsonError('Status required');

    $db->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute([$body['status'], $id]);
    jsonSuccess();
}

jsonError('Method not allowed', 405);
