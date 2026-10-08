<?php
// admin/auth.php — Session bootstrap + helpers
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,   // set true when served over HTTPS
    'httponly' => true,    // prevents JS access to the cookie
    'samesite' => 'Strict',
]);
session_start();

require __DIR__ . '/../api/db.php';

header('Content-Type: text/html; charset=utf-8');
header_remove('Access-Control-Allow-Origin');
header_remove('Access-Control-Allow-Methods');
header_remove('Access-Control-Allow-Headers');

/** HTML-escape a value for safe output */
function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

/** Redirect to login if no active admin session */
function require_login(): void {
    if (empty($_SESSION['uid'])) {
        header('Location: login.php');
        exit;
    }
}

/** Generate (once per session) and return a CSRF token */
function csrf(): string {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

/** Abort with 400 if POST token doesn't match session token */
function check_csrf(): void {
    $token    = $_POST['csrf'] ?? '';
    $expected = $_SESSION['csrf'] ?? '';
    if (!$expected || !hash_equals($expected, $token)) {
        http_response_code(400);
        exit('Invalid or missing CSRF token.');
    }
}
