<?php
/**
 * GET /api/admin/stats
 */
require_once __DIR__ . '/../../api/db.php';

requireAdmin();
$db = getDB();

$sales    = $db->query("SELECT SUM(total) AS totalSales, COUNT(*) AS totalOrders FROM orders WHERE status != 'Cancelled'")->fetch();
$products = $db->query("SELECT COUNT(*) AS totalProducts FROM products")->fetch();
$users    = $db->query("SELECT COUNT(*) AS totalCustomers FROM users WHERE role = 'customer'")->fetch();

jsonSuccess([
    'totalSales'     => (float)($sales['totalSales']       ?? 0),
    'totalOrders'    => (int)($sales['totalOrders']        ?? 0),
    'totalProducts'  => (int)($products['totalProducts']   ?? 0),
    'totalCustomers' => (int)($users['totalCustomers']     ?? 0),
]);
