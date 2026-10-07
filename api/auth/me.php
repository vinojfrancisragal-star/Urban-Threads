<?php
/**
 * GET /api/auth/me
 */
require_once __DIR__ . '/../../api/db.php';

if (empty($_SESSION['user_id'])) {
    jsonSuccess(['loggedIn' => false]);
}

jsonSuccess([
    'loggedIn' => true,
    'user' => [
        'id'   => $_SESSION['user_id'],
        'name' => $_SESSION['user_name'],
        'role' => $_SESSION['user_role'],
    ],
]);
