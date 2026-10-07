<?php
/**
 * GET    /api/admin/products         — list all products
 * POST   /api/admin/products         — add new product
 * PUT    /api/admin/products/:id     — update price/stock
 * DELETE /api/admin/products/:id     — delete product
 */
require_once __DIR__ . '/../../api/db.php';

requireAdmin();
$db     = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// Parse ID from URL path (if present)
$parts     = explode('/', trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$lastPart  = end($parts);
$productId = is_numeric($lastPart) ? (int)$lastPart : 0;

// ── GET ───────────────────────────────────────────────────────────────────────
if ($method === 'GET') {
    $stmt = $db->query('SELECT * FROM products ORDER BY created_at DESC');
    $rows = $stmt->fetchAll();
    foreach ($rows as &$p) {
        $p['price'] = (float)$p['price'];
        $p['stock'] = (int)$p['stock'];
    }
    jsonSuccess($rows);
}

// ── POST — create ─────────────────────────────────────────────────────────────
if ($method === 'POST') {
    $body        = getBody();
    $name        = trim($body['name']        ?? '');
    $category    = strtolower(trim($body['category'] ?? ''));
    $subcategory = strtolower(trim($body['subcategory'] ?? ''));
    $price       = (float)($body['price']    ?? 0);
    $stock       = (int)($body['stock']      ?? 15);
    $image       = trim($body['image']       ?? '');
    $description = trim($body['description'] ?? '');

    if (!$name || !$category || !$price || !$image) {
        jsonError('name, category, price, and image are required');
    }

    $labels = ['men' => 'Men', 'women' => 'Women', 'kids' => 'Kids', 'accessories' => 'Accessories'];
    $categoryLabel = $labels[$category] ?? ucfirst($category);

    $countRow = $db->query('SELECT COUNT(*) FROM products')->fetchColumn();
    $slug     = $category . '-' . ($countRow + 1);
    $desc     = $description ?: "A beautiful addition to our {$categoryLabel} collection.";

    $db->prepare('
        INSERT INTO products (name,slug,description,price,category,category_label,subcategory,image,stock)
        VALUES (?,?,?,?,?,?,?,?,?)
    ')->execute([$name, $slug, $desc, $price, $category, $categoryLabel, $subcategory, $image, $stock]);

    jsonSuccess(['success' => true], 201);
}

// ── PUT — update ──────────────────────────────────────────────────────────────
if ($method === 'PUT') {
    if (!$productId) jsonError('Product ID required');
    $body  = getBody();
    $price = $body['price'] ?? null;
    $stock = $body['stock'] ?? null;

    if ($price === null && $stock === null) jsonError('Nothing to update');

    if ($price !== null && $stock !== null) {
        $db->prepare('UPDATE products SET price=?, stock=? WHERE id=?')
           ->execute([(float)$price, (int)$stock, $productId]);
    } elseif ($price !== null) {
        $db->prepare('UPDATE products SET price=? WHERE id=?')->execute([(float)$price, $productId]);
    } else {
        $db->prepare('UPDATE products SET stock=? WHERE id=?')->execute([(int)$stock, $productId]);
    }

    jsonSuccess();
}

// ── DELETE ────────────────────────────────────────────────────────────────────
if ($method === 'DELETE') {
    if (!$productId) jsonError('Product ID required');
    $db->prepare('DELETE FROM products WHERE id = ?')->execute([$productId]);
    jsonSuccess();
}

jsonError('Method not allowed', 405);
