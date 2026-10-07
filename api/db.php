<?php
/**
 * api/db.php — Unified PDO connection + helpers for all API endpoints.
 * Used by: auth, cart, orders, coupons, products, wishlist, payments, admin.
 */
require_once __DIR__ . '/config.php';

// ── Session ────────────────────────────────────────────────────────────────────
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => false,
        'httponly'  => true,
        'samesite'  => 'Lax',
    ]);
    session_start();
}

// ── CORS / JSON headers ────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── PDO singleton ──────────────────────────────────────────────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            error_log('DB connection failed: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => 'Service temporarily unavailable']);
            exit;
        }
    }
    return $pdo;
}

// Also expose $pdo for files that use it directly (e.g. api/products.php)
$pdo = getDB();

// ── JSON helpers ───────────────────────────────────────────────────────────────
function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?: [];
}

function jsonSuccess($data = ['success' => true], int $code = 200): void {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function jsonError(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

// ── Auth helper ────────────────────────────────────────────────────────────────
function requireAuth(): int {
    if (empty($_SESSION['user_id'])) {
        jsonError('Login required', 401);
    }
    return (int)$_SESSION['user_id'];
}

function getAuthSession(): array {
    if (empty($_SESSION['user_id'])) {
        return ['loggedIn' => false];
    }
    return [
        'loggedIn' => true,
        'user' => [
            'id'   => $_SESSION['user_id'],
            'name' => $_SESSION['user_name'] ?? '',
            'role' => $_SESSION['user_role'] ?? 'customer',
        ]
    ];
}

// ── Coupons (static list — expand later if you want a DB table) ────────────
function getCoupons(): array {
    return [
        'URBAN10'  => ['type' => 'percent', 'value' => 10],
        'URBAN20'  => ['type' => 'percent', 'value' => 20],
        'WELCOME5' => ['type' => 'percent', 'value' => 5],
        'FESTIVE15'=> ['type' => 'percent', 'value' => 15],
    ];
}
