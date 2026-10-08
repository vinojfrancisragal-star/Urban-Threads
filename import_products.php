<?php
// Run once in browser: http://localhost/urban-threads/import_products.php
// Safe to run twice (skips duplicates). DELETE or protect this file after use.
header('Content-Type: text/plain; charset=utf-8');
require __DIR__ . '/api/db.php';

$file = __DIR__ . '/products.csv';
if (!is_file($file)) exit("products.csv not found\n");

$findSub = $pdo->prepare("SELECT c.id FROM categories c JOIN categories p ON p.id=c.parent_id WHERE p.slug=? AND c.slug=?");
$findTop = $pdo->prepare("SELECT id FROM categories WHERE parent_id IS NULL AND slug=?");
$exists  = $pdo->prepare("SELECT id FROM products WHERE name=? AND category_id=?");
$insert  = $pdo->prepare("INSERT INTO products (category_id,name,description,price,stock,image) VALUES (?,?,?,?,?,?)");

$h = fopen($file, 'r');
$cols = array_map('trim', fgetcsv($h));
$added = $skipped = $errors = 0; $line = 1;

while (($r = fgetcsv($h)) !== false) {
    $line++;
    if (count($r) < count($cols)) { echo "Line $line: wrong column count\n"; $errors++; continue; }
    $row = array_combine($cols, array_map('trim', $r));

    if ($row['subcategory'] !== '') { $findSub->execute([$row['category'], $row['subcategory']]); $cid = $findSub->fetchColumn(); }
    else { $findTop->execute([$row['category']]); $cid = $findTop->fetchColumn(); }
    if (!$cid) { echo "Line $line: unknown category '{$row['category']}/{$row['subcategory']}'\n"; $errors++; continue; }

    $exists->execute([$row['name'], $cid]);
    if ($exists->fetchColumn()) { $skipped++; continue; }

    if ($row['image'] !== '' && !is_file(__DIR__ . '/images/products/' . basename($row['image'])))
        echo "WARNING line $line: image '{$row['image']}' missing in images/products/\n";

    $insert->execute([$cid, $row['name'], $row['description'], (float)$row['price'], (int)$row['stock'], basename($row['image'])]);
    $added++;
}
fclose($h);
echo "Done. Added: $added, skipped (duplicates): $skipped, errors: $errors\n";
