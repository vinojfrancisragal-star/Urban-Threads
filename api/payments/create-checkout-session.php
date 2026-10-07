<?php
/**
 * POST /api/payments/create-checkout-session
 *
 * Simulates a card-payment gateway for local development.
 * Creates a payment_session row and redirects the user to a
 * local "card form" page where they enter (fake) card details.
 * In production you would replace this with Stripe / Razorpay / PayHere.
 */
require_once __DIR__ . '/../../api/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$body    = getBody();
$name    = trim($body['name']    ?? '');
$email   = trim($body['email']   ?? '');
$address = trim($body['address'] ?? '');
$phone   = trim($body['phone']   ?? '');
$items   = $body['items']        ?? [];
$promo   = strtoupper(trim($body['promoCode'] ?? ''));

if (!$name || !$email || !$address || !$phone || empty($items)) {
    jsonError('All fields are required');
}

// Calculate total (same logic as orders API)
$db       = getDB();
$subtotal = 0;
foreach ($items as $item) {
    $stmt = $db->prepare('SELECT price, stock, name FROM products WHERE id = ?');
    $stmt->execute([(int)$item['id']]);
    $p = $stmt->fetch();
    if (!$p) jsonError('Product not found');
    if ($p['stock'] < (int)$item['quantity']) {
        jsonError('Insufficient stock for: ' . htmlspecialchars($p['name']));
    }
    $subtotal += $p['price'] * (int)$item['quantity'];
}

$discount = 0;
if ($promo) {
    $coupons = getCoupons();
    if (isset($coupons[$promo])) {
        $discount = round($subtotal * ($coupons[$promo]['value'] / 100));
    }
}
$delivery = 550;
$total    = $subtotal - $discount + $delivery;

// Create session token
$sessionId = bin2hex(random_bytes(24));

$db->prepare('
    INSERT INTO payment_sessions
      (id, customer_name, customer_email, delivery_address, phone, items_json, promo_code, total, status)
    VALUES (?,?,?,?,?,?,?,?,?)
')->execute([$sessionId, $name, $email, $address, $phone,
             json_encode($items), $promo ?: null, $total, 'pending']);

// Return URL to local card-payment page
$payUrl = '/urban-threads/public/pay.html?session_id=' . urlencode($sessionId);

jsonSuccess(['success' => true, 'url' => $payUrl]);
