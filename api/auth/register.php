<?php
/**
 * POST /api/auth/register
 */
require_once __DIR__ . '/../../api/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$body = getBody();
$name     = trim($body['name']     ?? '');
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if (!$name || !$email || !$password) jsonError('Please provide all details');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonError('Invalid email address');

$db = getDB();

$stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) jsonError('Email already registered');

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $db->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
$stmt->execute([$name, $email, $hash]);
$id = (int)$db->lastInsertId();

$_SESSION['user_id']   = $id;
$_SESSION['user_role'] = 'customer';
$_SESSION['user_name'] = $name;

jsonSuccess(['success' => true, 'user' => ['id' => $id, 'name' => $name, 'email' => $email, 'role' => 'customer']], 201);
