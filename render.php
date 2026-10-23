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
status_header(200);
header('Content-Type: text/html; charset=UTF-8');
echo $html;
exit;
