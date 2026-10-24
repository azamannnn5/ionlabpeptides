<?php
/* Orders, contact form and email for the Ionlab site. No SMTP password is stored: mail goes through the server's own mail system. */
if (!defined('ABSPATH')) exit;

function ionlab_contact_email() { return sanitize_email(get_option('ionlab_contact_email', 'support@ionlabpeptides.com')) ?: 'support@ionlabpeptides.com'; }
function ionlab_brand() { return get_option('ionlab_brand_name', 'Ion Peptide'); }
function ionlab_fee() { $f = get_option('ionlab_shipping_protection', '3'); return is_numeric($f) ? (float) $f : 3.0; }

/* Send from the support address and use it as the envelope sender (helps SPF). */
add_filter('wp_mail_from', function () { return ionlab_contact_email(); });
add_filter('wp_mail_from_name', function () { return ionlab_brand(); });
add_action('phpmailer_init', function ($m) { $m->Sender = ionlab_contact_email(); });

/* WooCommerce's own order emails are off for orders made through this flow (we send our own). */
foreach (array('new_order', 'customer_on_hold_order', 'customer_processing_order', 'customer_completed_order', 'cancelled_order', 'failed_order') as $id) {
    add_filter('woocommerce_email_enabled_' . $id, function ($enabled, $order = null) {
        return ($order && is_object($order) && method_exists($order, 'get_meta') && $order->get_meta('_ion_order')) ? false : $enabled;
    }, 10, 2);
}

function ionlab_rate_limit($bucket, $max) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'x';
    $key = 'ionlab_rl_' . $bucket . '_' . md5($ip);
    $n = (int) get_transient($key);
    if ($n >= $max) return false;
    set_transient($key, $n + 1, HOUR_IN_SECONDS);
    return true;
}
function ionlab_json($ok, $msg = '', $extra = array()) {
    wp_send_json(array_merge(array('ok' => (bool) $ok, 'message' => $msg), $extra));
}
function ionlab_clean($v, $max = 200) { return mb_substr(trim(wp_strip_all_tags((string) $v)), 0, $max); }

function ionlab_money_fmt($n) { return '$' . number_format((float) $n, 2); }

/* ---------- email templates ---------- */
function ionlab_email_html($title, $inner) {
    $brand = esc_html(ionlab_brand());
    return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#1c2333">'
        . '<div style="max-width:620px;margin:0 auto;padding:24px 12px">'
        . '<div style="background:#0a3cff;background:linear-gradient(90deg,#0a2a8f,#0a74ff);color:#fff;padding:18px 24px;border-radius:12px 12px 0 0;font-size:20px;font-weight:bold">' . $brand . '</div>'
        . '<div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e3e7ef;border-top:0">'
        . '<h2 style="margin:0 0 16px;font-size:20px;color:#0a1f5c">' . esc_html($title) . '</h2>' . $inner
        . '<p style="margin:24px 0 0;font-size:12px;color:#6b7385">For laboratory research use only. Not for human or animal use.</p>'
        . '</div></div></body></html>';
}
function ionlab_row($label, $value) {
    return '<div style="margin:0 0 8px"><span style="color:#6b7385;font-size:13px">' . esc_html($label) . '</span><br><span style="font-size:15px">' . $value . '</span></div>';
}
function ionlab_items_html($lines) {
    $h = '';
    foreach ($lines as $l) {
        $h .= '<div style="padding:10px 0;border-bottom:1px solid #eef0f5">'
            . '<div style="float:right;font-weight:bold">' . esc_html(ionlab_money_fmt($l['line'])) . '</div>'
            . '<div><strong>' . esc_html($l['name']) . '</strong>' . ($l['variant'] ? ' <span style="color:#6b7385">(' . esc_html($l['variant']) . ')</span>' : '') . '</div>'
            . '<div style="color:#6b7385;font-size:13px">' . (int) $l['qty'] . ' x ' . esc_html(ionlab_money_fmt($l['unit'])) . '</div><div style="clear:both"></div></div>';
    }
    return $h;
}
function ionlab_totals_html($t) {
    $r = function ($a, $b, $bold = false) { return '<div style="margin:6px 0;' . ($bold ? 'font-weight:bold;font-size:17px;border-top:2px solid #0a1f5c;padding-top:8px' : '') . '"><span style="float:right">' . esc_html($b) . '</span>' . esc_html($a) . '<div style="clear:both"></div></div>'; };
    return '<div style="margin-top:12px">' . $r('Subtotal', ionlab_money_fmt($t['subtotal'])) . $r('Shipping protection', ionlab_money_fmt($t['fee'])) . $r('Total', ionlab_money_fmt($t['total']), true) . '</div>';
}

/* ---------- build an order from the cart, using server prices ---------- */
function ionlab_find_product($legacy_id) {
    $ids = get_posts(array('post_type' => 'product', 'post_status' => 'publish', 'meta_key' => '_ion_legacy_id', 'meta_value' => (int) $legacy_id, 'fields' => 'ids', 'numberposts' => 1));
    $pid = $ids ? (int) $ids[0] : (int) $legacy_id;
    $p = wc_get_product($pid);
    return ($p && $p->get_status() === 'publish') ? $p : null;
}
function ionlab_build_lines($cart) {
    $legacy = ionlab_legacy();
    $lines = array(); $sub = 0.0;
    foreach ((array) $cart as $it) {
        $p = ionlab_find_product((int) ($it['pid'] ?? 0));
        $qty = max(1, min(9999, (int) ($it['qty'] ?? 1)));
        if (!$p) return new WP_Error('item', 'One of the items in your cart is no longer available.');
        $lp = $legacy['bySlug'][$p->get_slug()] ?? null;
        $target = $p; $variant = ''; $maxq = 9999;
        if ($p->is_type('variable')) {
            $vid = (int) ($it['vid'] ?? 0); $found = null;
            foreach ($p->get_children() as $cid) {
                if ((int) get_post_meta($cid, '_ion_legacy_var_id', true) === $vid || $cid === $vid) { $found = wc_get_product($cid); break; }
            }
            if (!$found) return new WP_Error('item', 'Please re-select the size for ' . $p->get_name() . '.');
            $target = $found;
            $a = $found->get_attributes(); $variant = $a ? (string) reset($a) : '';
            foreach (($lp['vars'] ?? array()) as $lv) { if ((int) $lv['id'] === $vid && !empty($lv['max'])) $maxq = (int) $lv['max']; }
        }
        if (!$target->is_in_stock()) return new WP_Error('item', $p->get_name() . ' is out of stock.');
        if ($qty > $maxq) $qty = $maxq;
        $base = (float) $target->get_price();
        $pct = 0;
        foreach (($lp['tiers'] ?? array()) as $tier) if ($qty >= $tier['min'] && $qty <= $tier['max']) $pct = $tier['pct'];
        $unit = round($base * (1 - $pct / 100), 2);
        $line = round($unit * $qty, 2);
        $sub += $line;
        $lines[] = array('wc' => $target, 'name' => html_entity_decode($p->get_name(), ENT_QUOTES, 'UTF-8'), 'variant' => $variant, 'qty' => $qty, 'unit' => $unit, 'line' => $line);
    }
    if (!$lines) return new WP_Error('item', 'Your cart is empty.');
    $fee = ionlab_fee();
    return array('lines' => $lines, 'totals' => array('subtotal' => round($sub, 2), 'fee' => $fee, 'total' => round($sub + $fee, 2)));
}

function ionlab_create_wc_order($c, $b, $payment) {
    if (!function_exists('wc_create_order')) return 0;
    try {
        $order = wc_create_order(array('status' => 'on-hold'));
        foreach ($b['lines'] as $l) {
            $order->add_product($l['wc'], $l['qty'], array('subtotal' => $l['line'], 'total' => $l['line']));
        }
        $fee = new WC_Order_Item_Fee();
        $fee->set_name('Shipping Protection'); $fee->set_amount($b['totals']['fee']); $fee->set_total($b['totals']['fee']); $fee->set_tax_status('none');
        $order->add_item($fee);
        $addr = array('first_name' => $c['first'], 'last_name' => $c['last'], 'email' => $c['email'], 'phone' => $c['phone'],
            'address_1' => $c['address'], 'address_2' => $c['address2'], 'city' => $c['city'], 'state' => $c['state'], 'postcode' => $c['zip'], 'country' => $c['country']);
        $order->set_address($addr, 'billing');
        $order->set_address(array_diff_key($addr, array('email' => 1, 'phone' => 1)), 'shipping');
        $order->set_payment_method_title($payment);
        if ($c['notes'] !== '') $order->set_customer_note($c['notes']);
        $order->update_meta_data('_ion_order', 1);
        $order->update_meta_data('_ion_payment_choice', $payment);
        $order->calculate_totals(false);
        $order->save();
        return $order->get_id();
    } catch (Throwable $e) {
        error_log('ionlab order: ' . $e->getMessage());
        return 0;
    }
}

add_action('wp_ajax_nopriv_ionlab_order', 'ionlab_ajax_order');
add_action('wp_ajax_ionlab_order', 'ionlab_ajax_order');
function ionlab_ajax_order() {
    $in = json_decode(wp_unslash($_POST['payload'] ?? ''), true);
    if (!is_array($in)) ionlab_json(false, 'Something went wrong. Please try again.');
    if (!empty($in['company_website'])) ionlab_json(true, 'ok', array('order' => '0')); /* spam trap */
    if (!ionlab_rate_limit('order', 20)) ionlab_json(false, 'Too many requests. Please try again later.');
    $c = array(
        'first' => ionlab_clean($in['first_name'] ?? '', 60), 'last' => ionlab_clean($in['last_name'] ?? '', 60),
        'email' => sanitize_email($in['email'] ?? ''), 'phone' => ionlab_clean($in['phone'] ?? '', 40),
        'address' => ionlab_clean($in['address'] ?? '', 160), 'address2' => ionlab_clean($in['address2'] ?? '', 160),
        'city' => ionlab_clean($in['city'] ?? '', 80), 'state' => ionlab_clean($in['state'] ?? '', 80), 'zip' => ionlab_clean($in['zip'] ?? '', 20),
        'country' => strtoupper(ionlab_clean($in['country'] ?? 'US', 2)), 'notes' => ionlab_clean($in['notes'] ?? '', 800),
    );
    $payment = ionlab_clean($in['payment'] ?? '', 60) ?: 'Not specified';
    if ($c['first'] === '' || $c['last'] === '' || !is_email($c['email']) || $c['address'] === '' || $c['city'] === '' || $c['zip'] === '') {
        ionlab_json(false, 'Please fill in your name, email and shipping address.');
    }
    $b = ionlab_build_lines($in['cart'] ?? array());
    if (is_wp_error($b)) ionlab_json(false, $b->get_error_message());

    /* 1. Save the order first, so it is safe even if mail fails. */
    $order_id = ionlab_create_wc_order($c, $b, $payment);
    $num = $order_id ?: ('W' . substr(md5(uniqid('', true)), 0, 6));

    /* 2. Send the emails. */
    $full = trim($c['first'] . ' ' . $c['last']);
    $addr_html = esc_html($c['address'] . ($c['address2'] ? ', ' . $c['address2'] : '') . ', ' . $c['city'] . ($c['state'] ? ', ' . $c['state'] : '') . ' ' . $c['zip'] . ', ' . $c['country']);
    $items = ionlab_items_html($b['lines']) . ionlab_totals_html($b['totals']);
    $support = ionlab_contact_email();
    $brand = ionlab_brand();

    $admin_inner = ionlab_row('Customer', esc_html($full)) . ionlab_row('Email', '<a href="mailto:' . esc_attr($c['email']) . '">' . esc_html($c['email']) . '</a>')
        . ionlab_row('Phone', esc_html($c['phone'] ?: 'Not given')) . ionlab_row('Ship to', $addr_html) . ionlab_row('Payment method chosen', esc_html($payment))
        . ($c['notes'] !== '' ? ionlab_row('Notes', esc_html($c['notes'])) : '')
        . '<h3 style="margin:20px 0 4px;font-size:16px">Items</h3>' . $items
        . '<p style="margin:16px 0 0;font-size:13px;color:#6b7385">Press Reply to send payment details to the customer.</p>';
    $ok_admin = wp_mail($support, 'New order #' . $num . ' from ' . $full . ' (' . ionlab_money_fmt($b['totals']['total']) . ')',
        ionlab_email_html('New order #' . $num, $admin_inner),
        array('Content-Type: text/html; charset=UTF-8', 'Reply-To: ' . $full . ' <' . $c['email'] . '>'));

    $cust_inner = '<p style="margin:0 0 14px">Hi ' . esc_html($c['first']) . ', thank you for your order. We received it and will email you payment details shortly.</p>'
        . ionlab_row('Order number', '#' . esc_html($num)) . ionlab_row('Ship to', $addr_html) . ionlab_row('Payment method', esc_html($payment))
        . '<h3 style="margin:20px 0 4px;font-size:16px">Your items</h3>' . $items
        . '<p style="margin:16px 0 0">Questions? Just reply to this email.</p>';
    $ok_cust = wp_mail($c['email'], 'We received your order #' . $num . ' - ' . $brand,
        ionlab_email_html('Thank you for your order', $cust_inner),
        array('Content-Type: text/html; charset=UTF-8', 'Reply-To: ' . $brand . ' <' . $support . '>'));

    if ($order_id && function_exists('wc_get_order')) {
        $o = wc_get_order($order_id);
        if ($o) {
            $o->update_meta_data('_ion_mail_admin', $ok_admin ? 'sent' : 'failed');
            $o->update_meta_data('_ion_mail_customer', $ok_cust ? 'sent' : 'failed');
            $o->add_order_note('Emails: to store ' . ($ok_admin ? 'sent' : 'FAILED') . ', to customer ' . ($ok_cust ? 'sent' : 'FAILED'));
            $o->save();
        }
    }
    /* Never show mail trouble to the customer. */
    ionlab_json(true, 'Order received', array('order' => (string) $num));
}

/* ---------- contact form ---------- */
add_action('wp_ajax_nopriv_ionlab_contact', 'ionlab_ajax_contact');
add_action('wp_ajax_ionlab_contact', 'ionlab_ajax_contact');
function ionlab_ajax_contact() {
    $in = json_decode(wp_unslash($_POST['payload'] ?? ''), true);
    if (!is_array($in)) ionlab_json(false, 'Sorry, something went wrong. Please try again.');
    if (!empty($in['company_website'])) ionlab_json(true, 'Thank you. Your message has been sent.');
    if (!ionlab_rate_limit('contact', 20)) ionlab_json(false, 'Too many requests. Please try again later.');
    $first = ionlab_clean($in['first_name'] ?? '', 60); $last = ionlab_clean($in['last_name'] ?? '', 60);
    $email = sanitize_email($in['email'] ?? ''); $phone = ionlab_clean($in['phone'] ?? '', 40);
    $order = ionlab_clean($in['order_number'] ?? '', 40); $msg = ionlab_clean($in['message'] ?? '', 4000);
    if ($first === '' || !is_email($email) || $msg === '') ionlab_json(false, 'Please fill in your name, email and message.');
    $full = trim($first . ' ' . $last);
    $support = ionlab_contact_email(); $brand = ionlab_brand();

    /* Save first. */
    $post_id = wp_insert_post(array('post_type' => 'ion_message', 'post_status' => 'private', 'post_title' => $full . ' - ' . ($order ? 'Order ' . $order : 'Contact form'),
        'post_content' => $msg, 'meta_input' => array('_ion_email' => $email, '_ion_phone' => $phone, '_ion_order_number' => $order)));

    $inner = ionlab_row('From', esc_html($full)) . ionlab_row('Email', '<a href="mailto:' . esc_attr($email) . '">' . esc_html($email) . '</a>')
        . ionlab_row('Phone', esc_html($phone ?: 'Not given')) . ($order ? ionlab_row('Order number', esc_html($order)) : '')
        . ionlab_row('Message', nl2br(esc_html($msg))) . '<p style="margin:16px 0 0;font-size:13px;color:#6b7385">Press Reply to answer the customer.</p>';
    $ok1 = wp_mail($support, 'Contact form: ' . ($order ? 'Order ' . $order . ' - ' : '') . $full, ionlab_email_html('New contact message', $inner),
        array('Content-Type: text/html; charset=UTF-8', 'Reply-To: ' . $full . ' <' . $email . '>'));
    $rc = '<p style="margin:0 0 14px">Hi ' . esc_html($first) . ', thank you for contacting us. We received your message and will reply as soon as we can.</p>' . ionlab_row('Your message', nl2br(esc_html($msg)));
    $ok2 = wp_mail($email, 'We received your message - ' . $brand, ionlab_email_html('Thank you for contacting us', $rc),
        array('Content-Type: text/html; charset=UTF-8', 'Reply-To: ' . $brand . ' <' . $support . '>'));
    if ($post_id && !is_wp_error($post_id)) update_post_meta($post_id, '_ion_mail', ($ok1 ? 'sent' : 'failed') . '/' . ($ok2 ? 'sent' : 'failed'));
    ionlab_json(true, 'Thank you. Your message has been sent.');
}

/* Messages are kept in a simple admin screen ("Messages"). */
add_action('init', function () {
    register_post_type('ion_message', array('label' => 'Messages', 'labels' => array('name' => 'Messages', 'singular_name' => 'Message'),
        'public' => false, 'show_ui' => true, 'show_in_menu' => true, 'menu_icon' => 'dashicons-email', 'supports' => array('title', 'editor'),
        'capabilities' => array('create_posts' => 'do_not_allow'), 'map_meta_cap' => true));
});
