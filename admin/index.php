<?php
require __DIR__ . '/auth.php'; require_login();
$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete'])) {
    check_csrf();
    $id = (int)$_POST['delete'];
    $s = $pdo->prepare('SELECT image FROM products WHERE id=?'); $s->execute([$id]);
    $img = $s->fetchColumn();
    try {
        $pdo->prepare('DELETE FROM products WHERE id=?')->execute([$id]);
        if ($img && is_file(__DIR__ . '/../images/products/' . basename($img))) @unlink(__DIR__ . '/../images/products/' . basename($img));
    } catch (PDOException $ex) { $err = 'Cannot delete: product is used in an order.'; }
}
$rows = $pdo->query("SELECT p.*, c.name AS sub, pc.name AS top FROM products p
  JOIN categories c ON c.id=p.category_id LEFT JOIN categories pc ON pc.id=c.parent_id ORDER BY p.id DESC")->fetchAll();
?><!doctype html><meta charset="utf-8"><link rel="stylesheet" href="style.css">
<div class="box"><p><a class="btn" href="product_form.php">+ Add product</a> <a class="btn" href="logout.php">Logout</a></p>
<h2>Products (<?= count($rows) ?>)</h2><p class="err"><?= e($err) ?></p>
<table><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr>
<?php foreach ($rows as $r): ?>
<tr><td><?php if ($r['image']): ?><img class="th" src="../images/products/<?= e($r['image']) ?>" alt=""><?php endif; ?></td>
<td><?= e($r['name']) ?></td><td><?= e(($r['top'] ? $r['top'].' › ' : '').$r['sub']) ?></td>
<td><?= number_format($r['price'],2) ?></td><td><?= (int)$r['stock'] ?></td>
<td><a class="btn" href="product_form.php?id=<?= (int)$r['id'] ?>">Edit</a>
<form method="post" style="display:inline" onsubmit="return confirm('Delete this product?')">
<input type="hidden" name="csrf" value="<?= e(csrf()) ?>"><button class="danger" name="delete" value="<?= (int)$r['id'] ?>">Delete</button></form></td></tr>
<?php endforeach; ?></table></div>
