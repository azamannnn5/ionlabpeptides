<?php
/* Ionlab core logic. Loaded by the loader plugin "Ionlab Core". */
if (!defined('ABSPATH')) exit;

define('IONLAB_THEME_DIR', WP_CONTENT_DIR . '/themes/ionlab');
define('IONLAB_RUNTIME_CACHE', 'ionlab_rt_' . substr(md5(@filemtime(__FILE__)), 0, 8));
require_once __DIR__ . '/orders.php';

/* ---------- Legacy data (original runtime.js) ---------- */
function ionlab_legacy() {
    static $d = null;
    if ($d !== null) return $d;
    $d = array('products' => array(), 'bySlug' => array(), 'cards' => array(), 'cardBySlug' => array());
    $f = IONLAB_THEME_DIR . '/data/runtime.js';
    if (!is_file($f)) return $d;
    $s = file_get_contents($f);
    $j = json_decode(substr($s, strpos($s, '{'), strrpos($s, '}') - strpos($s, '{') + 1), true);
    if (!is_array($j)) return $d;
    $d['products'] = $j['products'] ?? array();
    foreach ($d['products'] as $id => $p) $d['bySlug'][$p['slug']] = $p;
    $d['cards'] = $j['cards'] ?? array();
    foreach ($d['cards'] as $c) {
        if (preg_match('~href="product/([^"]+)\.html"~', $c['html'], $m)) $d['cardBySlug'][$m[1]] = $c;
    }
    return $d;
}

function ionlab_money($n) {
    return '<span class="woocommerce-Price-amount amount"><span class="woocommerce-Price-currencySymbol">$</span>' . number_format((float) $n, 2) . '</span>';
}

function ionlab_img_ref($product_or_var, $legacy_img) {
    $img_id = $product_or_var->get_image_id();
    if (!$img_id) return $legacy_img;
    $src = get_post_meta($img_id, '_ion_src', true);
    $legacy_rel = $legacy_img ? preg_replace('~^(\.\./)+~', '', $legacy_img) : '';
    if ($src && $legacy_rel && $src === $legacy_rel) return $legacy_img;
    return wp_get_attachment_url($img_id) ?: $legacy_img;
}

/* ---------- WooCommerce product -> original data shape ---------- */
function ionlab_build_runtime() {
    $legacy = ionlab_legacy();
    $products = array();
    $cards = array();
    if (!function_exists('wc_get_products')) return array('products' => $legacy['products'], 'cards' => $legacy['cards']);

    $list = wc_get_products(array('limit' => -1, 'status' => 'publish', 'orderby' => 'menu_order', 'order' => 'ASC'));
    $default_tiers = array(array('min' => 4, 'max' => 5, 'pct' => 10), array('min' => 6, 'max' => 9, 'pct' => 16), array('min' => 10, 'max' => 999999, 'pct' => 25));
    foreach ($list as $p) {
        $slug = $p->get_slug();
        $lp = $legacy['bySlug'][$slug] ?? null;
        $legacy_id = (int) get_post_meta($p->get_id(), '_ion_legacy_id', true);
        $key = $legacy_id ?: ($lp['id'] ?? $p->get_id());
        $is_var = $p->is_type('variable');
        $in_stock = $p->is_in_stock();
        $entry = array(
            'id' => (int) $key, 'slug' => $slug, 'name' => html_entity_decode($p->get_name(), ENT_QUOTES, 'UTF-8'),
            'type' => $is_var ? 'variable' : 'simple', 'url' => 'product/' . $slug . '.html',
            'price' => 0, 'inStock' => (bool) $in_stock, 'vars' => array(),
            'tiers' => $lp ? $lp['tiers'] : ($is_var ? $default_tiers : array()),
            'image' => ionlab_img_ref($p, $lp['image'] ?? ''),
        );
        $prices = array();
        if ($is_var) {
            $attr_key = get_post_meta($p->get_id(), '_ion_attr_key', true) ?: 'attribute_variant';
            $lvars = $lp['vars'] ?? array();
            $i = 0;
            foreach ($p->get_children() as $vid) {
                $v = wc_get_product($vid);
                if (!$v || $v->get_status() !== 'publish') continue;
                $vattrs = $v->get_attributes();
                $val = $vattrs ? reset($vattrs) : '';
                $lv = $lvars[$i] ?? null;
                foreach ($lvars as $cand) { if (isset($cand['attr'][$attr_key]) && $cand['attr'][$attr_key] === $val) { $lv = $cand; break; } }
                $vlegacy = (int) get_post_meta($vid, '_ion_legacy_var_id', true);
                $price = (float) $v->get_price();
                $prices[] = $price;
                $entry['vars'][] = array(
                    'id' => $vlegacy ?: $vid, 'attr' => array($attr_key => $val), 'price' => $price,
                    'max' => (int) ($lv['max'] ?? 999), 'min' => 1, 'inStock' => (bool) $v->is_in_stock(),
                    'image' => ionlab_img_ref($v, $lv['image'] ?? '') ?: $entry['image'],
                );
                $i++;
            }
            $entry['price'] = $prices ? min($prices) : 0;
        } else {
            $entry['price'] = (float) $p->get_price();
            $prices[] = $entry['price'];
        }
        $products[(string) $key] = $entry;

        /* shop card */
        $cat_terms = get_the_terms($p->get_id(), 'product_cat') ?: array();
        $cats = array();
        foreach ($cat_terms as $t) if ($t->slug !== 'uncategorized') $cats[] = $t->slug;
        $cards[] = array(
            'id' => (int) $key, 'title' => $entry['name'], 'cats' => $cats,
            'min' => $prices ? min($prices) : 0, 'max' => $prices ? max($prices) : 0,
            'html' => ionlab_card_html($p, $entry, $cats, $cat_terms, $legacy),
        );
    }
    return array('products' => (object) $products, 'cards' => $cards);
}

function ionlab_card_html($p, $entry, $cats, $cat_terms, $legacy) {
    $slug = $entry['slug'];
    $tpl = $legacy['cardBySlug'][$slug]['html'] ?? '';
    $want_var = $entry['type'] === 'variable';
    if (!$tpl) {
        foreach ($legacy['cards'] as $c) {
            $is_var = strpos($c['html'], 'product-type-variable') !== false;
            if ($is_var === $want_var && strpos($c['html'], 'ion-shop-card-button--disabled') === false) { $tpl = $c['html']; break; }
        }
    }
    if (!$tpl) return '';
    $title = esc_html($entry['name']);
    $url = esc_attr($entry['url']);
    $img = preg_match('~^(https?:)?//~', $entry['image']) ? esc_url($entry['image']) : esc_attr($entry['image']);
    $in = $entry['inStock'];
    $prices = $entry['type'] === 'variable' ? array_column($entry['vars'], 'price') : array($entry['price']);
    $min = $prices ? min($prices) : 0; $max = $prices ? max($prices) : 0;
    $price_html = '<div class="ion-shop-card-price">' . ionlab_money($min);
    if ($max > $min) {
        $price_html .= ' <span aria-hidden="true">&ndash;</span> ' . ionlab_money($max)
            . '<span class="screen-reader-text">Price range: $' . number_format($min, 2) . ' through $' . number_format($max, 2) . '</span>';
    }
    $price_html .= '</div>';
    $desc = trim(wp_strip_all_tags($p->get_short_description()));
    if (strlen($desc) > 90) $desc = rtrim(substr($desc, 0, 90)) . '…';
    $badge = $cat_terms ? esc_html(($cat_terms[0]->name)) : '';
    foreach ($cat_terms as $t) { if (in_array($t->slug, array('lyophilized', 'raw', 'blends', 'lab-supplies'), true)) { $badge = esc_html($t->name); break; } }

    $e = function ($x) { return addcslashes($x, '\\$'); };
    $title = $e($title); $url = $e($url); $img = $e($img); $badge = $e($badge);
    $h = $tpl;
    $h = preg_replace('~data-ion-shop-product-id="\d+"~', 'data-ion-shop-product-id="' . (int) $entry['id'] . '"', $h);
    $h = preg_replace('~post-\d+~', 'post-' . (int) $entry['id'], $h, 1);
    $h = preg_replace('~href="product/[^"]*"~', 'href="' . $url . '"', $h);
    $h = preg_replace('~aria-label="[^"]*"~', 'aria-label="' . $e(esc_attr($entry['name'])) . '"', $h, 1);
    $h = preg_replace('~(<img [^>]*?)src="[^"]*"~', '$1src="' . $img . '"', $h, 1);
    $h = preg_replace('~data-ion-shop-backend-src="[^"]*"~', 'data-ion-shop-backend-src="' . $img . '"', $h);
    $h = preg_replace('~alt="[^"]*"~', 'alt="' . $e(esc_attr($entry['name'])) . '"', $h, 1);
    $h = preg_replace('~<h2><a href="[^"]*">.*?</a></h2>~s', '<h2><a href="' . $url . '">' . $title . '</a></h2>', $h, 1);
    $h = preg_replace('~<span class="ion-shop-card-badge">.*?</span>~s', '<span class="ion-shop-card-badge">' . $badge . '</span>', $h, 1);
    $h = preg_replace('~(<p class="ion-shop-card-description">).*?(</p>)~s', '${1}' . $e(esc_html($desc)) . '${2}', $h, 1);
    $h = preg_replace('~<div class="ion-shop-card-price">.*?</div>~s', $e($price_html), $h, 1);
    $classes = array_map(function ($s) { return 'product_cat-' . $s; }, $cats);
    $h = preg_replace('~(?:product_cat-[A-Za-z0-9_-]+\s*)+~', implode(' ', $classes) . ' ', $h, 1);
    $h = preg_replace('~\b(instock|outofstock)\b~', $in ? 'instock' : 'outofstock', $h, 1);
    /* button */
    $has_disabled = strpos($h, 'ion-shop-card-button--disabled') !== false;
    if (!$in && !$has_disabled) {
        $h = preg_replace('~<a href="[^"]*" class="ion-shop-card-button">.*?</a>~s', '<button class="ion-shop-card-button ion-shop-card-button--disabled" type="button" disabled="">Out of Stock</button>', $h, 1);
    }
    return $h;
}

add_filter('ionlab_runtime_js', function ($js) {
    $cached = get_transient(IONLAB_RUNTIME_CACHE);
    if (is_string($cached) && $cached !== '') return $cached;
    $data = ionlab_build_runtime();
    if (empty((array) $data['products'])) return null; /* fall back to the original file */
    $out = 'window.IONDATA = ' . wp_json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ';';
    set_transient(IONLAB_RUNTIME_CACHE, $out, DAY_IN_SECONDS);
    return $out;
});
function ionlab_bust_cache() { delete_transient(IONLAB_RUNTIME_CACHE); }
foreach (array('woocommerce_update_product', 'woocommerce_new_product', 'woocommerce_update_product_variation', 'woocommerce_new_product_variation',
    'woocommerce_delete_product', 'woocommerce_trash_product', 'edited_product_cat', 'created_product_cat', 'delete_product_cat') as $h) add_action($h, 'ionlab_bust_cache');

/* ---------- One-time product import (admin only, run in batches) ---------- */
function ionlab_import_image($rel, $title) {
    $rel = ltrim($rel, '/');
    $src = IONLAB_THEME_DIR . '/' . $rel;
    if (!$rel || !is_file($src)) return 0;
    $found = get_posts(array('post_type' => 'attachment', 'post_status' => 'inherit', 'meta_key' => '_ion_src', 'meta_value' => $rel, 'numberposts' => 1, 'fields' => 'ids'));
    if ($found) return (int) $found[0];
    $up = wp_upload_dir();
    $name = wp_unique_filename($up['path'], basename($src));
    $dest = $up['path'] . '/' . $name;
    if (!copy($src, $dest)) return 0;
    $ft = wp_check_filetype($name);
    $id = wp_insert_attachment(array('post_mime_type' => $ft['type'] ?: 'image/webp', 'post_title' => $title, 'post_status' => 'inherit'), $dest);
    if (is_wp_error($id) || !$id) return 0;
    require_once ABSPATH . 'wp-admin/includes/image.php';
    wp_update_attachment_metadata($id, wp_generate_attachment_metadata($id, $dest));
    update_post_meta($id, '_ion_src', $rel);
    return (int) $id;
}

function ionlab_import_categories() {
    $f = IONLAB_THEME_DIR . '/data/categories.json';
    $cats = is_file($f) ? json_decode(file_get_contents($f), true) : array();
    $map = array();
    foreach (array(true, false) as $top) {
        foreach ($cats as $c) {
            if ($c['slug'] === 'uncategorized') continue;
            if (($c['parent'] == 0) !== $top) continue;
            $term = get_term_by('slug', $c['slug'], 'product_cat');
            if (!$term) {
                $parent = $c['parent'] ? ($map[$c['parent']] ?? 0) : 0;
                $r = wp_insert_term(html_entity_decode($c['name']), 'product_cat', array('slug' => $c['slug'], 'parent' => $parent, 'description' => $c['description'] ?? ''));
                if (is_wp_error($r)) continue;
                $term_id = $r['term_id'];
            } else $term_id = $term->term_id;
            $map[$c['id']] = $term_id;
        }
    }
    return $map;
}

function ionlab_import_batch($offset, $limit) {
    set_time_limit(120);
    $f = IONLAB_THEME_DIR . '/data/store-products.json';
    $items = json_decode(file_get_contents($f), true);
    $legacy = ionlab_legacy();
    ionlab_import_categories();
    $log = array();
    $slice = array_slice($items, $offset, $limit);
    foreach ($slice as $i => $it) {
        $slug = $it['slug'];
        $lp = $legacy['bySlug'][$slug] ?? null;
        $existing = get_page_by_path($slug, OBJECT, 'product');
        $is_var = ($lp && $lp['type'] === 'variable') || $it['type'] === 'variable';
        $p = $existing ? wc_get_product($existing->ID) : ($is_var ? new WC_Product_Variable() : new WC_Product_Simple());
        if (!$p) continue;
        $name = html_entity_decode($it['name'], ENT_QUOTES, 'UTF-8');
        $p->set_name($name);
        $p->set_slug($slug);
        $p->set_status('publish');
        $p->set_catalog_visibility('visible');
        $p->set_description($it['description'] ?? '');
        $p->set_short_description($it['short_description'] ?? '');
        $p->set_menu_order($offset + $i);
        $term_ids = array();
        foreach ($it['categories'] ?? array() as $c) {
            if ($c['slug'] === 'uncategorized') continue;
            $t = get_term_by('slug', $c['slug'], 'product_cat');
            if ($t) $term_ids[] = (int) $t->term_id;
        }
        $p->set_category_ids($term_ids);
        $img_rel = !empty($it['images'][0]['src']) ? $it['images'][0]['src'] : ($lp['image'] ?? '');
        $img_id = ionlab_import_image(preg_replace('~^(\.\./)+~', '', $img_rel), $name);
        if ($img_id) $p->set_image_id($img_id);
        $stock = !empty($it['is_in_stock']) ? 'instock' : 'outofstock';
        if (!$is_var) {
            $price = $lp ? (float) $lp['price'] : ((float) ($it['prices']['price'] ?? 0)) / 100;
            $p->set_regular_price((string) $price);
            $p->set_stock_status($stock);
        } else {
            $attr_key = 'attribute_variant';
            if ($lp && !empty($lp['vars'][0]['attr'])) $attr_key = key($lp['vars'][0]['attr']);
            $opts = array();
            foreach (($lp['vars'] ?? array()) as $v) $opts[] = (string) reset($v['attr']);
            $attr = new WC_Product_Attribute();
            $attr->set_id(0); $attr->set_name('Size'); $attr->set_options($opts); $attr->set_position(0); $attr->set_visible(true); $attr->set_variation(true);
            $p->set_attributes(array($attr));
        }
        $pid = $p->save();
        update_post_meta($pid, '_ion_legacy_id', (int) ($lp['id'] ?? $it['id']));
        if ($is_var) {
            update_post_meta($pid, '_ion_attr_key', $attr_key);
            $have = array();
            foreach ($p->get_children() as $cid) { $cv = wc_get_product($cid); if ($cv) { $a = $cv->get_attributes(); $have[(string) reset($a)] = $cv; } }
            foreach (($lp['vars'] ?? array()) as $v) {
                $val = (string) reset($v['attr']);
                $var = $have[$val] ?? new WC_Product_Variation();
                $var->set_parent_id($pid);
                $var->set_attributes(array('size' => $val));
                $var->set_regular_price((string) $v['price']);
                $var->set_stock_status(!empty($v['inStock']) ? 'instock' : 'outofstock');
                $vimg = ionlab_import_image(preg_replace('~^(\.\./)+~', '', $v['image'] ?? ''), $name);
                if ($vimg) $var->set_image_id($vimg);
                $vid = $var->save();
                update_post_meta($vid, '_ion_legacy_var_id', (int) $v['id']);
            }
            WC_Product_Variable::sync($pid);
            $p = wc_get_product($pid);
            $p->set_stock_status($stock);
            $p->save();
        }
        $log[] = $slug;
    }
    ionlab_bust_cache();
    return array('done' => $offset + count($slice) >= count($items), 'next' => $offset + count($slice), 'total' => count($items), 'imported' => $log);
}

add_action('wp_ajax_ionlab_import', function () {
    if (!current_user_can('manage_options') || !class_exists('WC_Product')) wp_send_json_error('no', 403);
    check_ajax_referer('ionlab_import', 'n');
    wp_send_json_success(ionlab_import_batch((int) ($_REQUEST['offset'] ?? 0), max(1, min(5, (int) ($_REQUEST['limit'] ?? 3)))));
});
add_action('wp_ajax_ionlab_import_nonce', function () {
    if (!current_user_can('manage_options')) wp_send_json_error('no', 403);
    wp_send_json_success(wp_create_nonce('ionlab_import'));
});
