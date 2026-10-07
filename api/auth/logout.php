<?php
/**
 * POST /api/auth/logout
 */
require_once __DIR__ . '/../../api/db.php';

session_unset();
session_destroy();

jsonSuccess(['success' => true, 'message' => 'Logged out successfully']);
