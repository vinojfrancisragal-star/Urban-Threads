<?php
/**
 * GET /api/reviews  — all reviews (global testimonials feed)
 */
require_once __DIR__ . '/../../api/db.php';

$db   = getDB();
$stmt = $db->query('
    SELECT r.*, p.name AS product_name
    FROM reviews r
    JOIN products p ON r.product_id = p.id
    ORDER BY r.created_at DESC
');
jsonSuccess($stmt->fetchAll());
