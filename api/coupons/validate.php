<?php
/**
 * GET /api/coupons/validate?code=URBAN10
 */
require_once __DIR__ . '/../../api/db.php';

$code = strtoupper(trim($_GET['code'] ?? ''));
if (!$code) jsonError('Coupon code is required');

$coupons = getCoupons();
if (!isset($coupons[$code])) jsonError('Invalid coupon code', 404);

$coupon = $coupons[$code];
jsonSuccess(['success' => true, 'type' => $coupon['type'], 'value' => $coupon['value']]);
