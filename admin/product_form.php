<?php
require __DIR__ . '/auth.php'; require_login();

$id = (int)($_GET['id'] ?? 0);
$p = ['category_id'=>'','name'=>'','description'=>'','price'=>'','stock'=>0,'image'=>''];
if ($id) {
    $s = $pdo->prepare('SELECT * FROM products WHERE id=?'); $s->execute([$id]);
    $p = $s->fetch() ?: exit('Product not found');
}
$cats = $pdo->query("SELECT c.id, CONCAT(COALESCE(CONCAT(pc.name,' › '),''), c.name) AS label
  FROM categories c LEFT JOIN categories pc ON pc.id=c.parent_id
  WHERE c.parent_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM categories x WHERE x.parent_id=c.id)
  ORDER BY label")->fetchAll();

function save_upload(&$err) {
    if (empty($_FILES['image']['name'])) return null;
    $f = $_FILES['image'];
    if ($f['error'] !== UPLOAD_ERR_OK) { $err = 'Upload failed.'; return null; }
    if ($f['size'] > 2 * 1024 * 1024) { $err = 'Image must be under 2 MB.'; return null; }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $ext = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$mime] ?? null;
    if (!$ext) { $err = 'Only JPG, PNG or WEBP allowed.'; return null; }
    $name = bin2hex(random_bytes(8)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], __DIR__ . '/../images/products/' . $name)) { $err = 'Could not save image.'; return null; }
    return $name;
}

$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    $name = trim($_POST['name'] ?? ''); $desc = trim($_POST['description'] ?? '');
    $cid = (int)($_POST['category_id'] ?? 0); $price = $_POST['price'] ?? ''; $stock = (int)($_POST['stock'] ?? 0);
    if ($name === '' || !$cid || !is_numeric($price) || $price < 0 || $stock < 0) $err = 'Please fill all fields correctly.';
    if (!$err) {
        $new = save_upload($err);
        if (!$err) {
            $img = $new ?? $p['image'];
            if ($id) {
                $pdo->prepare('UPDATE products SET category_id=?,name=?,description=?,price=?,stock=?,image=? WHERE id=?')
                    ->execute([$cid,$name,$desc,$price,$stock,$img,$id]);
                if ($new && $p['image'] && is_file(__DIR__.'/../images/products/'.basename($p['image']))) @unlink(__DIR__.'/../images/products/'.basename($p['image']));
            } else {
                $pdo->prepare('INSERT INTO products (category_id,name,description,price,stock,image) VALUES (?,?,?,?,?,?)')
                    ->execute([$cid,$name,$desc,$price,$stock,$img]);
            }
            header('Location: index.php'); exit;
        }
    }
    $p = array_merge($p, ['category_id'=>$cid,'name'=>$name,'description'=>$desc,'price'=>$price,'stock'=>$stock]);
}
?><!doctype html><meta charset="utf-8"><link rel="stylesheet" href="style.css">
<div class="box"><h2><?= $id ? 'Edit' : 'Add' ?> product</h2><p class="err"><?= e($err) ?></p>
<form method="post" enctype="multipart/form-data"><input type="hidden" name="csrf" value="<?= e(csrf()) ?>">
Name<input name="name" value="<?= e($p['name']) ?>" required>
Category<select name="category_id" required><option value="">Choose…</option>
<?php foreach ($cats as $c): ?><option value="<?= (int)$c['id'] ?>" <?= $c['id']==$p['category_id']?'selected':'' ?>><?= e($c['label']) ?></option><?php endforeach; ?></select>
Description<textarea name="description" rows="4"><?= e($p['description']) ?></textarea>
Price<input name="price" type="number" step="0.01" min="0" value="<?= e($p['price']) ?>" required>
Stock<input name="stock" type="number" min="0" value="<?= e($p['stock']) ?>" required>
Image (JPG/PNG/WEBP, max 2 MB)<?php if ($p['image']): ?><br><img class="th" src="../images/products/<?= e($p['image']) ?>" alt=""><?php endif; ?>
<input type="file" name="image" accept="image/jpeg,image/png,image/webp">
<button>Save</button> <a class="btn" href="index.php">Cancel</a></form></div>
