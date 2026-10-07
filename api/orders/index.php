<?php
/**
 * GET  /api/orders   — user's order history
 * POST /api/orders   — place new order (COD / Bank Transfer / Card)
 */
require_once __DIR__ . '/../../api/db.php';

$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET — order history ───────────────────────────────────────────────────────
if ($method === 'GET') {
    $userId = requireAuth();

    $stmt = $db->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$userId]);
    $orders = $stmt->fetchAll();

    foreach ($orders as &$order) {
        $stmt2 = $db->prepare('
            SELECT oi.quantity, oi.price, oi.size, oi.color, p.name, p.image
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        ');
        $stmt2->execute([$order['id']]);
        $order['items'] = $stmt2->fetchAll();
    }

    jsonSuccess($orders);
}

// ── POST — place order ────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body          = getBody();
    $name          = trim($body['name']          ?? '');
    $email         = trim($body['email']         ?? '');
    $address       = trim($body['address']       ?? '');
    $phone         = trim($body['phone']         ?? '');
    $paymentMethod = trim($body['paymentMethod'] ?? 'Cash on Delivery');
    $items         = $body['items'] ?? [];
    $promoCode     = strtoupper(trim($body['promoCode'] ?? ''));

    if (!$name || !$email || !$address || !$phone || empty($items)) {
        jsonError('All fields and items are required');
    }

    // Calculate subtotal, validate stock
    $subtotal = 0;
    foreach ($items as $item) {
        $stmt = $db->prepare('SELECT price, stock, name FROM products WHERE id = ?');
        $stmt->execute([(int)$item['id']]);
        $product = $stmt->fetch();
        if (!$product) jsonError("Product not found");
        if ($product['stock'] < (int)$item['quantity']) {
            jsonError("Insufficient stock for: " . htmlspecialchars($product['name']));
        }
        $subtotal += $product['price'] * (int)$item['quantity'];
    }

    // Apply coupon
    $discountPercent = 0;
    $couponCode      = null;
    $discountAmount  = 0;

    if ($promoCode) {
        $coupons = getCoupons();
        if (isset($coupons[$promoCode]) && $coupons[$promoCode]['type'] === 'percent') {
            $discountPercent = $coupons[$promoCode]['value'];
            $couponCode      = $promoCode;
            $discountAmount  = round($subtotal * ($discountPercent / 100));
        }
    }

    $delivery = 550;
    $total    = $subtotal - $discountAmount + $delivery;
    $userId   = $_SESSION['user_id'] ?? null;

    $db->beginTransaction();
    try {
        $stmt = $db->prepare('
            INSERT INTO orders
              (user_id, customer_name, customer_email, delivery_address, phone,
               payment_method, subtotal, delivery, total, status, payment_status,
               coupon_code, discount_amount)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ');
        $payStatus = ($paymentMethod === 'Credit / Debit Card') ? 'Paid' : 'Unpaid';
        $stmt->execute([$userId, $name, $email, $address, $phone,
                        $paymentMethod, $subtotal, $delivery, $total,
                        'pending', $payStatus, $couponCode, $discountAmount]);
        $orderId = (int)$db->lastInsertId();

        // Insert order items & deduct stock
        foreach ($items as $item) {
            $stmt = $db->prepare('SELECT price FROM products WHERE id = ?');
            $stmt->execute([(int)$item['id']]);
            $product = $stmt->fetch();

            $db->prepare('
                INSERT INTO order_items (order_id, product_id, size, color, quantity, price)
                VALUES (?,?,?,?,?,?)
            ')->execute([$orderId, (int)$item['id'], $item['size'] ?? '', $item['color'] ?? '',
                         (int)$item['quantity'], $product['price']]);

            $db->prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
               ->execute([(int)$item['quantity'], (int)$item['id']]);
        }

        // Clear cart if logged in
        if ($userId) {
            $db->prepare('DELETE FROM cart_items WHERE user_id = ?')->execute([$userId]);
        }

        $db->commit();
        jsonSuccess(['success' => true, 'orderId' => $orderId], 201);

    } catch (Throwable $e) {
        $db->rollBack();
        error_log('Order error: ' . $e->getMessage());
        jsonError('Could not place order. Please try again.');
    }
}

jsonError('Method not allowed', 405);
