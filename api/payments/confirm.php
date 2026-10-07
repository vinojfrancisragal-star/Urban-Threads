<?php
/**
 * POST /api/payments/confirm
 *
 * Confirms a payment session: creates the actual order, deducts stock,
 * and returns order + items for the receipt page.
 */
require_once __DIR__ . '/../../api/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$body      = getBody();
$sessionId = trim($body['sessionId'] ?? '');

if (!$sessionId) jsonError('Session ID required');

$db = getDB();

// Find pending session
$stmt = $db->prepare('SELECT * FROM payment_sessions WHERE id = ? AND status = ?');
$stmt->execute([$sessionId, 'paid']);
$session = $stmt->fetch();

if (!$session) {
    jsonError('Payment session not found or not paid. Please try again.');
}

// Prevent double-confirm
if ($session['order_id']) {
    // Already confirmed — just return the order
    $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute([$session['order_id']]);
    $order = $stmt->fetch();

    $stmt = $db->prepare('
        SELECT oi.quantity, oi.price, oi.size, oi.color, p.name, p.image
        FROM order_items oi JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    ');
    $stmt->execute([$order['id']]);
    $items = $stmt->fetchAll();

    jsonSuccess(['success' => true, 'order' => $order, 'items' => $items]);
}

$items = json_decode($session['items_json'], true) ?: [];

// Calculate amounts
$subtotal = 0;
foreach ($items as $item) {
    $stmt = $db->prepare('SELECT price FROM products WHERE id = ?');
    $stmt->execute([(int)$item['id']]);
    $p = $stmt->fetch();
    if ($p) $subtotal += $p['price'] * (int)$item['quantity'];
}

$discount = 0;
$promo    = $session['promo_code'];
if ($promo) {
    $coupons = getCoupons();
    if (isset($coupons[$promo])) {
        $discount = round($subtotal * ($coupons[$promo]['value'] / 100));
    }
}
$delivery = 550;
$total    = $subtotal - $discount + $delivery;
$userId   = $_SESSION['user_id'] ?? null;

$db->beginTransaction();
try {
    // Create order
    $stmt = $db->prepare('
        INSERT INTO orders
          (user_id, customer_name, customer_email, delivery_address, phone,
           payment_method, subtotal, delivery, total, status, payment_status,
           coupon_code, discount_amount)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ');
    $stmt->execute([
        $userId, $session['customer_name'], $session['customer_email'],
        $session['delivery_address'], $session['phone'],
        'Credit / Debit Card', $subtotal, $delivery, $total,
        'pending', 'Paid', $promo ?: null, $discount
    ]);
    $orderId = (int)$db->lastInsertId();

    // Insert order items & deduct stock
    foreach ($items as $item) {
        $stmt = $db->prepare('SELECT price FROM products WHERE id = ?');
        $stmt->execute([(int)$item['id']]);
        $p = $stmt->fetch();

        $db->prepare('
            INSERT INTO order_items (order_id, product_id, size, color, quantity, price)
            VALUES (?,?,?,?,?,?)
        ')->execute([$orderId, (int)$item['id'], $item['size'] ?? '', $item['color'] ?? '',
                     (int)$item['quantity'], $p['price']]);

        $db->prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
           ->execute([(int)$item['quantity'], (int)$item['id']]);
    }

    // Clear cart if logged in
    if ($userId) {
        $db->prepare('DELETE FROM cart_items WHERE user_id = ?')->execute([$userId]);
    }

    // Mark session as completed
    $db->prepare('UPDATE payment_sessions SET status = ?, order_id = ? WHERE id = ?')
       ->execute(['completed', $orderId, $sessionId]);

    $db->commit();

    // Fetch the created order for receipt
    $stmt = $db->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute([$orderId]);
    $order = $stmt->fetch();

    $stmt = $db->prepare('
        SELECT oi.quantity, oi.price, oi.size, oi.color, p.name, p.image
        FROM order_items oi JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    ');
    $stmt->execute([$orderId]);
    $orderItems = $stmt->fetchAll();

    jsonSuccess(['success' => true, 'order' => $order, 'items' => $orderItems]);

} catch (Throwable $e) {
    $db->rollBack();
    error_log('Payment confirm error: ' . $e->getMessage());
    jsonError('Could not complete order. Please contact support.');
}
