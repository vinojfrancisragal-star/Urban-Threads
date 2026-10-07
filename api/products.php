<?php
// GET /api/products.php?category=men&subcategory=tops  |  ?id=5
// Returns JSON; output is safe for JS (json_encode escapes by default).
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/db.php';

// Shared SELECT — adds compat fields expected by app.js card renderer
$base = "
    SELECT
        p.id,
        p.name,
        p.description,
        CAST(p.price AS DECIMAL(10,2))   AS price,
        p.stock,
        p.image,
        0                                AS discount_percent,
        0.0                              AS average_rating,
        0                                AS review_count,
        COALESCE(pc.name, c.name)        AS category_name,
        COALESCE(pc.name, c.name)        AS category_label,
        COALESCE(pc.slug, c.slug)        AS category_slug,
        c.name                           AS subcategory_name,
        c.slug                           AS subcategory_slug
    FROM products p
    JOIN  categories c  ON c.id  = p.category_id
    LEFT JOIN categories pc ON pc.id = c.parent_id
";

$where = [];
$args  = [];

try {
    // ── Single product by ID ──────────────────────────────────────────────────
    if (isset($_GET['id'])) {
        $stmt = $pdo->prepare($base . ' WHERE p.id = ?');
        $stmt->execute([(int)$_GET['id']]);
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            exit;
        }
        echo json_encode($row);
        exit;
    }

    // ── Category / subcategory filters ────────────────────────────────────────
    if (!empty($_GET['category'])) {
        $where[] = 'COALESCE(pc.slug, c.slug) = ?';
        $args[]  = $_GET['category'];
    }
    if (!empty($_GET['subcategory'])) {
        $where[] = 'c.slug = ? AND c.parent_id IS NOT NULL';
        $args[]  = $_GET['subcategory'];
    }

    // ── Keyword search ────────────────────────────────────────────────────────
    if (!empty($_GET['search'])) {
        $where[] = '(p.name LIKE ? OR p.description LIKE ?)';
        $kw = '%' . $_GET['search'] . '%';
        $args[] = $kw;
        $args[] = $kw;
    }

    // ── Price range ───────────────────────────────────────────────────────────
    if (isset($_GET['minPrice']) && $_GET['minPrice'] !== '') {
        $where[] = 'p.price >= ?';
        $args[]  = (float)$_GET['minPrice'];
    }
    if (isset($_GET['maxPrice']) && $_GET['maxPrice'] !== '') {
        $where[] = 'p.price <= ?';
        $args[]  = (float)$_GET['maxPrice'];
    }

    if ($where) {
        $base .= ' WHERE ' . implode(' AND ', $where);
    }

    $base .= ' GROUP BY p.id';

    // ── Sorting ───────────────────────────────────────────────────────────────
    $allowed_sorts = [
        'price-low'  => 'p.price ASC',
        'price-high' => 'p.price DESC',
        'name'       => 'p.name ASC',
    ];
    $sort  = $_GET['sort'] ?? '';
    $base .= ' ORDER BY ' . ($allowed_sorts[$sort] ?? 'p.created_at DESC, p.id DESC');

    $stmt = $pdo->prepare($base);
    $stmt->execute($args);
    echo json_encode($stmt->fetchAll());

} catch (Throwable $e) {
    error_log('api/products.php error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
