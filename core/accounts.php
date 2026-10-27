<?php
/* Customer accounts: register, login, password reset, orders and saved details. Uses admin-ajax. */
if (!defined('ABSPATH')) exit;

function ionlab_user_payload($u) {
    $g = function ($k) use ($u) { return (string) get_user_meta($u->ID, $k, true); };
    return array(
        'id' => $u->ID, 'email' => $u->user_email, 'first' => $g('first_name'), 'last' => $g('last_name'),
        'phone' => $g('billing_phone'), 'address' => $g('billing_address_1'), 'address2' => $g('billing_address_2'),
        'city' => $g('billing_city'), 'state' => $g('billing_state'), 'zip' => $g('billing_postcode'), 'country' => $g('billing_country') ?: 'US',
    );
}

add_action('wp_ajax_nopriv_ionlab_register', 'ionlab_ajax_register');
add_action('wp_ajax_ionlab_register', 'ionlab_ajax_register');
function ionlab_ajax_register() {
    $in = json_decode(wp_unslash($_POST['payload'] ?? ''), true);
    if (!is_array($in)) ionlab_json(false, 'Something went wrong. Please try again.');
    if (!empty($in['company_website'])) ionlab_json(true, 'ok');
    if (!ionlab_rate_limit('register', 6)) ionlab_json(false, 'Too many attempts. Please try again later.');
    $first = ionlab_clean($in['first_name'] ?? '', 60); $last = ionlab_clean($in['last_name'] ?? '', 60);
    $email = sanitize_email($in['email'] ?? ''); $pass = (string) ($in['password'] ?? '');
    if ($first === '' || !is_email($email)) ionlab_json(false, 'Please enter your name and a valid email.');
    if (strlen($pass) < 8) ionlab_json(false, 'Your password must be at least 8 characters.');
    if (email_exists($email) || username_exists($email)) ionlab_json(false, 'An account with this email already exists. Please log in.');
    $uid = wp_insert_user(array('user_login' => $email, 'user_email' => $email, 'user_pass' => $pass, 'first_name' => $first, 'last_name' => $last,
        'display_name' => trim($first . ' ' . $last), 'role' => 'customer'));
    if (is_wp_error($uid)) ionlab_json(false, 'We could not create your account. Please try again.');
    update_user_meta($uid, 'billing_first_name', $first); update_user_meta($uid, 'billing_last_name', $last); update_user_meta($uid, 'billing_email', $email);
    wp_set_current_user($uid); wp_set_auth_cookie($uid, true);
    $brand = ionlab_brand();
    wp_mail($email, 'Welcome to ' . $brand,
        ionlab_email_html('Welcome, ' . esc_html($first), '<p style="margin:0 0 14px">Your account is ready. You can log in any time to see your orders and save your shipping details.</p><p style="margin:0">Questions? Just reply to this email.</p>'),
        array('Content-Type: text/html; charset=UTF-8', 'Reply-To: ' . $brand . ' <' . ionlab_contact_email() . '>'));
    ionlab_json(true, 'Account created.');
}

add_action('wp_ajax_nopriv_ionlab_login', 'ionlab_ajax_login');
add_action('wp_ajax_ionlab_login', 'ionlab_ajax_login');
function ionlab_ajax_login() {
    $in = json_decode(wp_unslash($_POST['payload'] ?? ''), true);
    if (!is_array($in)) ionlab_json(false, 'Something went wrong. Please try again.');
    if (!ionlab_rate_limit('login', 15)) ionlab_json(false, 'Too many attempts. Please try again later.');
    $u = wp_signon(array('user_login' => sanitize_text_field($in['email'] ?? ''), 'user_password' => (string) ($in['password'] ?? ''), 'remember' => true), is_ssl());
    if (is_wp_error($u)) ionlab_json(false, 'Incorrect email or password.');
    ionlab_json(true, 'Logged in.');
}

add_action('wp_ajax_ionlab_logout', function () { wp_logout(); ionlab_json(true, 'Logged out.'); });
add_action('wp_ajax_nopriv_ionlab_logout', function () { ionlab_json(true, 'Logged out.'); });

add_action('wp_ajax_nopriv_ionlab_forgot', 'ionlab_ajax_forgot');
add_action('wp_ajax_ionlab_forgot', 'ionlab_ajax_forgot');
function ionlab_ajax_forgot() {
    $in = json_decode(wp_unslash($_POST['payload'] ?? ''), true);
    $email = is_array($in) ? sanitize_email($in['email'] ?? '') : '';
    if (!ionlab_rate_limit('forgot', 5)) ionlab_json(false, 'Too many attempts. Please try again later.');
    if (is_email($email) && email_exists($email)) { $_POST['user_login'] = $email; retrieve_password(); }
    ionlab_json(true, 'If an account exists for that email, we sent a link to reset the password.');
}

add_action('wp_ajax_ionlab_account', function () {
    $u = wp_get_current_user();
    $orders = array();
    if (function_exists('wc_get_orders')) {
        foreach (wc_get_orders(array('customer_id' => $u->ID, 'limit' => 50, 'orderby' => 'date', 'order' => 'DESC')) as $o) {
            $items = array();
            foreach ($o->get_items() as $it) $items[] = $it->get_name() . ' x ' . $it->get_quantity();
            $map = array('on-hold' => 'Awaiting payment', 'pending' => 'Pending', 'processing' => 'Processing', 'completed' => 'Completed', 'cancelled' => 'Cancelled', 'refunded' => 'Refunded', 'failed' => 'Failed');
            $orders[] = array('number' => $o->get_order_number(), 'date' => $o->get_date_created() ? $o->get_date_created()->date_i18n('M j, Y') : '',
                'status' => $map[$o->get_status()] ?? ucfirst($o->get_status()), 'total' => (float) $o->get_total(), 'items' => $items);
        }
    }
    ionlab_json(true, 'ok', array('user' => ionlab_user_payload($u), 'orders' => $orders));
});

add_action('wp_ajax_ionlab_profile', function () {
    $in = json_decode(wp_unslash($_POST['payload'] ?? ''), true);
    if (!is_array($in)) ionlab_json(false, 'Something went wrong. Please try again.');
    $uid = get_current_user_id();
    $map = array('first' => 'first_name', 'last' => 'last_name', 'phone' => 'billing_phone', 'address' => 'billing_address_1', 'address2' => 'billing_address_2',
        'city' => 'billing_city', 'state' => 'billing_state', 'zip' => 'billing_postcode', 'country' => 'billing_country');
    foreach ($map as $k => $meta) {
        $val = ionlab_clean($in[$k] ?? '', 160);
        update_user_meta($uid, $meta, $val);
        if (strpos($meta, 'billing_') === 0 && $meta !== 'billing_phone') update_user_meta($uid, str_replace('billing_', 'shipping_', $meta), $val);
    }
    update_user_meta($uid, 'billing_first_name', ionlab_clean($in['first'] ?? '', 60)); update_user_meta($uid, 'billing_last_name', ionlab_clean($in['last'] ?? '', 60));
    wp_update_user(array('ID' => $uid, 'display_name' => trim(ionlab_clean($in['first'] ?? '', 60) . ' ' . ionlab_clean($in['last'] ?? '', 60))));
    ionlab_json(true, 'Saved.');
});

/* Customers use the site pages, not wp-admin. */
add_action('admin_init', function () {
    if (wp_doing_ajax() || current_user_can('edit_posts')) return;
    wp_safe_redirect(home_url('/my-account.html')); exit;
});
