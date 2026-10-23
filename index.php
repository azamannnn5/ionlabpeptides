<?php
// Fallback template. Normal pages are served by render.php (see inc/router.php).
if (!defined('ABSPATH')) exit;
status_header(404);
include __DIR__ . '/404.php';
