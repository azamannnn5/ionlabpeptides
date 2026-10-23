<?php
if (!defined('ABSPATH')) exit;

add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('woocommerce');
});
add_filter('show_admin_bar', '__return_false');

/* ---------- Rewrite rules (original .html URLs) ---------- */
add_action('init', function () {
    add_rewrite_rule('^product/([A-Za-z0-9_-]+)\.html/?$', 'index.php?post_type=product&name=$matches[1]', 'top');
    add_rewrite_rule('^peptide-information/([A-Za-z0-9_-]+)\.html/?$', 'index.php?pagename=peptide-information/$matches[1]', 'top');
    add_rewrite_rule('^([A-Za-z0-9_-]+)\.html/?$', 'index.php?pagename=$matches[1]', 'top');
    add_rewrite_rule('^(assets|admin)/(.+)$', 'index.php?ion_static=$matches[1]/$matches[2]', 'top');
    add_rewrite_rule('^data/(.+)$', 'index.php?ion_static=data/$matches[1]', 'top');
});
add_filter('query_vars', function ($v) { $v[] = 'ion_static'; return $v; });
add_action('after_switch_theme', function () { flush_rewrite_rules(); });

/* ---------- Links keep the .html style ---------- */
add_filter('page_link', function ($link, $id) {
    if ((int) get_option('page_on_front') === (int) $id) return home_url('/');
    $uri = get_page_uri($id);
    return $uri ? home_url('/' . $uri . '.html') : $link;
}, 10, 2);
add_filter('post_type_link', function ($link, $post) {
    if ($post && $post->post_type === 'product') return home_url('/product/' . $post->post_name . '.html');
    return $link;
}, 10, 2);
add_filter('user_trailingslashit', function ($url) {
    return preg_match('~\.html/?(\?.*)?$~', $url) ? preg_replace('~\.html/(\?|$)~', '.html$1', $url) : $url;
});
add_filter('redirect_canonical', function ($redirect, $requested) {
    if (get_query_var('ion_static')) return false;
    return preg_match('~\.html(\?.*)?$~', $requested) ? false : $redirect;
}, 10, 2);

/* ---------- Legacy redirects ---------- */
add_action('template_redirect', function () {
    $path = trim(parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/');
    $base = trim(parse_url(home_url('/'), PHP_URL_PATH), '/');
    if ($base !== '' && strpos($path, $base) === 0) $path = trim(substr($path, strlen($base)), '/');
    if ($path === 'index.html') { wp_redirect(home_url('/'), 301); exit; }
    if ($path === 'product.html' && !empty($_GET['slug'])) {
        wp_redirect(home_url('/product/' . sanitize_title($_GET['slug']) . '.html'), 301); exit;
    }
}, 0);

/* ---------- Template choice ---------- */
function ionlab_match_file() {
    $name = null;
    if (is_front_page()) $name = 'index';
    elseif (is_singular('product')) $name = 'product/' . get_post_field('post_name', get_queried_object_id());
    elseif (is_page()) $name = get_page_uri(get_queried_object_id());
    if (!$name) return null;
    $file = IONLAB_DIR . '/' . $name . '.html';
    return is_file($file) ? $file : null;
}
add_filter('template_include', function ($tpl) {
    if (get_query_var('ion_static')) { ionlab_serve_static(get_query_var('ion_static')); exit; }
    $file = ionlab_match_file();
    if ($file) { $GLOBALS['ionlab_file'] = $file; return IONLAB_DIR . '/render.php'; }
    return $tpl;
}, 99);

/* ---------- Static files (assets, admin, data) ---------- */
function ionlab_serve_static($rel) {
    $rel = ltrim(str_replace(array('\\', '..'), '', $rel), '/');
    if (!preg_match('~^(assets|admin|data)/~', $rel)) { status_header(404); exit; }
    if ($rel === 'data/runtime.js') {
        $js = apply_filters('ionlab_runtime_js', null);
        if (is_string($js)) {
            header('Content-Type: application/javascript; charset=UTF-8');
            header('Cache-Control: public, max-age=60');
            echo $js; exit;
        }
    }
    $path = IONLAB_DIR . '/' . $rel;
    if (!is_file($path)) { status_header(404); exit; }
    $types = array('css' => 'text/css', 'js' => 'application/javascript', 'json' => 'application/json', 'svg' => 'image/svg+xml',
        'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'gif' => 'image/gif', 'ico' => 'image/x-icon',
        'woff2' => 'font/woff2', 'woff' => 'font/woff', 'ttf' => 'font/ttf', 'html' => 'text/html', 'csv' => 'text/csv', 'pdf' => 'application/pdf');
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
    header('Cache-Control: public, max-age=31536000');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}
