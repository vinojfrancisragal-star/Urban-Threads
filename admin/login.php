<?php
require __DIR__ . '/auth.php';
$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    check_csrf();
    $s = $pdo->prepare("SELECT id,password_hash FROM users WHERE email=? AND role='admin'");
    $s->execute([trim($_POST['email'] ?? '')]);
    $u = $s->fetch();
    if ($u && password_verify($_POST['password'] ?? '', $u['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['uid'] = $u['id'];
        header('Location: index.php'); exit;
    }
    $err = 'Invalid email or password.';
    sleep(1);
}
?><!doctype html><meta charset="utf-8"><link rel="stylesheet" href="style.css">
<div class="box" style="max-width:400px"><h2>Admin login</h2><p class="err"><?= e($err) ?></p>
<form method="post"><input type="hidden" name="csrf" value="<?= e(csrf()) ?>">
Email<input name="email" type="email" required>
Password<input name="password" type="password" required>
<button>Login</button></form></div>
