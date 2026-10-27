<?php
if (!defined('ABSPATH')) exit;
$file = $GLOBALS['ionlab_file'] ?? '';
$html = $file && is_file($file) ? file_get_contents($file) : '';
if ($html === '') { status_header(404); include __DIR__ . '/404.php'; exit; }

/* When an SEO plugin is active, let it control title and meta. */
function ionlab_seo_plugin_active() {
    return defined('RANK_MATH_VERSION') || defined('WPSEO_VERSION') || defined('SEOPRESS_VERSION')
        || defined('AIOSEO_VERSION') || function_exists('the_seo_framework');
}
if (ionlab_seo_plugin_active()) {
    ob_start(); do_action('wp_head'); $head = ob_get_clean();
    $keep = '';
    if (preg_match_all('~<title[^>]*>.*?</title>|<meta\s[^>]*>|<link\s[^>]*rel=["\'](?:canonical|prev|next)["\'][^>]*>|<script[^>]*application/ld\+json[^>]*>.*?</script>~is', $head, $m)) {
        $keep = implode("\n", $m[0]);
    }
    if ($keep !== '') {
        $html = preg_replace('~<title[^>]*>.*?</title>~is', '', $html, 1);
        $html = preg_replace('~<meta\s+name=["\'](?:description|robots)["\'][^>]*>~i', '', $html);
        $html = preg_replace('~<meta\s+property=["\']og:[^>]*>~i', '', $html);
        $html = preg_replace('~<link\s[^>]*rel=["\']canonical["\'][^>]*>~i', '', $html);
        $html = preg_replace_callback('~(<head[^>]*>)~i', function ($m) use ($keep) { return $m[1] . "\n" . $keep; }, $html, 1);
    }
}
if (function_exists('ionlab_apply_site')) $html = ionlab_apply_site($html);
/* Cart, checkout and contact glue (admin-ajax, cache-busted by file time). */
$ion_base = untrailingslashit(home_url('/'));
$ion_fee = function_exists('ionlab_fee') ? ionlab_fee() : 3;
$inject = '<link rel="stylesheet" href="' . esc_url($ion_base . '/assets/css/ion-wp.css?ver=' . @filemtime(__DIR__ . '/assets/css/ion-wp.css')) . '">'
    . '<script>window.IONLAB=' . wp_json_encode(array('ajax' => admin_url('admin-ajax.php'), 'root' => trailingslashit(home_url('/')), 'fee' => (float) $ion_fee, 'user' => (is_user_logged_in() && function_exists('ionlab_user_payload')) ? ionlab_user_payload(wp_get_current_user()) : null)) . ';</script>'
    . '<script src="' . esc_url($ion_base . '/assets/js/ion-wp.js?ver=' . @filemtime(__DIR__ . '/assets/js/ion-wp.js')) . '"></script>';
if (stripos($html, '</body>') !== false) {
    $html = preg_replace_callback('~</body>~i', function ($m) use ($inject) { return $inject . '</body>'; }, $html, 1);
} else {
    $html .= $inject;
}
status_header(200);
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-cache, must-revalidate, max-age=0');
echo $html;
exit;
