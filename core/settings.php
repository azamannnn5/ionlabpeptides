<?php
/* Site Settings: edit contact details, brand name, prices, banner and a pop-up from wp-admin. No deploy needed. */
if (!defined('ABSPATH')) exit;

function ionlab_site_defaults() {
    return array(
        'email' => 'support@ionlabpeptides.com', 'phone' => '', 'address' => '',
        'brand' => 'Ion Peptide', 'fee' => '3', 'free_over' => '250',
        'banner_on' => '1', 'banner_text' => 'Please allow 2 extra days for order processing!',
        'popup_on' => '', 'popup_title' => '', 'popup_text' => '', 'popup_button' => 'OK', 'popup_ver' => '1',
    );
}
function ionlab_site($key = null) {
    $d = ionlab_site_defaults();
    $o = get_option('ionlab_site', array());
    if (!is_array($o)) $o = array();
    $all = array_merge($d, array_filter($o, function ($v) { return $v !== null; }));
    foreach (array('email', 'brand', 'fee', 'free_over', 'banner_text') as $k) {
        if (trim((string) $all[$k]) === '') $all[$k] = $d[$k];
    }
    if (!isset($o['banner_on'])) $all['banner_on'] = '1';
    return $key === null ? $all : (isset($all[$key]) ? $all[$key] : '');
}
function ionlab_fmt_money($n) { $n = (float) $n; return '$' . (abs($n - round($n)) < 0.005 ? number_format($n, 0) : number_format($n, 2)); }

add_action('admin_menu', function () {
    add_menu_page('Site Settings', 'Site Settings', 'manage_options', 'ionlab-site', 'ionlab_site_page', 'dashicons-admin-generic', 3);
});
add_action('admin_init', function () {
    register_setting('ionlab_site_group', 'ionlab_site', array('sanitize_callback' => 'ionlab_site_sanitize'));
});
function ionlab_site_sanitize($in) {
    $old = get_option('ionlab_site', array());
    if (!is_array($old)) $old = array();
    $out = array();
    $email = isset($in['email']) ? sanitize_email($in['email']) : '';
    if ($email !== '' && !is_email($email)) {
        add_settings_error('ionlab_site', 'bad_email', 'That email address does not look right, so the old one was kept.', 'error');
        $email = isset($old['email']) ? $old['email'] : '';
    }
    $out['email'] = $email;
    $out['phone'] = isset($in['phone']) ? sanitize_text_field($in['phone']) : '';
    $out['address'] = isset($in['address']) ? implode("\n", array_map('sanitize_text_field', array_slice(preg_split('/\r\n|\r|\n/', trim($in['address'])), 0, 3))) : '';
    $out['brand'] = isset($in['brand']) ? sanitize_text_field($in['brand']) : '';
    foreach (array('fee', 'free_over') as $k) {
        $v = isset($in[$k]) ? str_replace(array('$', ','), '', trim($in[$k])) : '';
        if ($v === '') { $out[$k] = ''; continue; }
        if (!is_numeric($v) || $v < 0) {
            add_settings_error('ionlab_site', 'bad_' . $k, 'One of the prices was not a number, so the old price was kept.', 'error');
            $out[$k] = isset($old[$k]) ? $old[$k] : '';
        } else { $out[$k] = (string) round((float) $v, 2); }
    }
    $out['banner_on'] = !empty($in['banner_on']) ? '1' : '0';
    $out['banner_text'] = isset($in['banner_text']) ? sanitize_text_field($in['banner_text']) : '';
    $out['popup_on'] = !empty($in['popup_on']) ? '1' : '';
    $out['popup_title'] = isset($in['popup_title']) ? sanitize_text_field($in['popup_title']) : '';
    $out['popup_text'] = isset($in['popup_text']) ? sanitize_textarea_field($in['popup_text']) : '';
    $out['popup_button'] = isset($in['popup_button']) ? sanitize_text_field($in['popup_button']) : '';
    $ver = isset($old['popup_ver']) ? (int) $old['popup_ver'] : 1;
    $changed = (($old['popup_title'] ?? '') !== $out['popup_title']) || (($old['popup_text'] ?? '') !== $out['popup_text']) || (($old['popup_on'] ?? '') !== $out['popup_on'] && $out['popup_on']);
    $out['popup_ver'] = (string) ($changed ? $ver + 1 : $ver);
    return $out;
}
function ionlab_site_page() {
    if (!current_user_can('manage_options')) return;
    $raw = get_option('ionlab_site', array());
    if (!is_array($raw)) $raw = array();
    $d = ionlab_site_defaults();
    $get = function ($k) use ($raw, $d) { return array_key_exists($k, $raw) ? $raw[$k] : ($k === 'banner_on' ? '1' : ''); };
    $n = 'ionlab_site';
    $f = function ($k, $extra = '') use ($get, $n) {
        printf('<input type="text" name="%s[%s]" value="%s" class="regular-text" %s>', $n, esc_attr($k), esc_attr($get($k)), $extra);
    };
    ?>
    <style>
      .epw{max-width:860px}.epw .card{background:#fff;border:1px solid #dcdcde;border-radius:8px;padding:20px 24px;margin:18px 0}
      .epw .card h2{margin:0 0 4px;font-size:18px}.epw .how{color:#50575e;margin:0 0 14px}
      .epw .row{display:grid;grid-template-columns:200px 1fr;gap:6px 18px;align-items:start;padding:10px 0;border-top:1px solid #f0f0f1}
      .epw .row:first-of-type{border-top:0}.epw .row label.t{font-weight:600;padding-top:6px}
      .epw .hint{display:block;color:#646970;font-size:13px;margin-top:4px}
      .epw input.regular-text,.epw textarea{width:100%;max-width:520px}.epw .price{display:flex;align-items:center;gap:6px}.epw .price input{width:110px}
      .epw .savebar{position:sticky;bottom:0;background:#f6f7f7;border-top:1px solid #dcdcde;padding:12px 0;margin-top:10px}
      @media(max-width:782px){.epw .row{grid-template-columns:1fr}}
    </style>
    <div class="wrap epw">
      <h1>Site Settings</h1>
      <p style="font-size:14px">Change what shows on your website here. Type the new value, press <strong>Save Changes</strong> at the bottom, and the website updates <strong>straight away</strong>. You do not need to publish or deploy anything.</p>
      <p><a class="button" href="<?php echo esc_url(home_url('/')); ?>" target="_blank">Open my website in a new tab</a> <span class="description">Tip: after saving, refresh that tab to see the change.</span></p>
      <?php settings_errors('ionlab_site'); ?>
      <form method="post" action="options.php">
        <?php settings_fields('ionlab_site_group'); ?>
        <div class="card"><h2>1. Contact details</h2><p class="how">The email is used on the whole site and as the sender and inbox for orders and messages. Phone and address show in the footer when filled in.</p>
          <div class="row"><label class="t">Contact email</label><div><?php $f('email'); ?><span class="hint">Orders and contact messages are sent here. Empty = <?php echo esc_html($d['email']); ?></span></div></div>
          <div class="row"><label class="t">Phone number (optional)</label><div><?php $f('phone'); ?><span class="hint">Example: +1 307 555 0123. Leave empty to show no phone.</span></div></div>
          <div class="row"><label class="t">Mailing address (optional)</label><div><textarea name="<?php echo $n; ?>[address]" rows="2"><?php echo esc_textarea($get('address')); ?></textarea><span class="hint">Street on the first line, city, state and ZIP on the second. Leave empty to show no address.</span></div></div>
        </div>
        <div class="card"><h2>2. Brand name</h2><p class="how">The store name shown in page titles, text and emails.</p>
          <div class="row"><label class="t">Brand name</label><div><?php $f('brand'); ?><span class="hint">Empty = <?php echo esc_html($d['brand']); ?>. The logo picture is not changed by this.</span></div></div>
        </div>
        <div class="card"><h2>3. Prices</h2><p class="how">Type numbers only, like <code>3</code>. You do not need to type the $ sign.</p>
          <div class="row"><label class="t">Shipping protection fee</label><div class="price">$ <?php $f('fee', 'inputmode="decimal"'); ?></div><span></span><span class="hint" style="margin:0">Added to every order at checkout. Empty = <?php echo esc_html($d['fee']); ?>. Enter 0 for no fee.</span></div>
          <div class="row"><label class="t">Free shipping over</label><div class="price">$ <?php $f('free_over', 'inputmode="decimal"'); ?></div><span></span><span class="hint" style="margin:0">Changes the amount in the shipping policy text. Empty = <?php echo esc_html($d['free_over']); ?>.</span></div>
        </div>
        <div class="card"><h2>4. Banner and pop-up</h2><p class="how">The banner is the thin strip at the very top of every page.</p>
          <div class="row"><label class="t">Show banner</label><div><label><input type="checkbox" name="<?php echo $n; ?>[banner_on]" value="1" <?php checked($get('banner_on'), '1'); ?>> Yes, show the banner</label></div></div>
          <div class="row"><label class="t">Banner text</label><div><?php $f('banner_text'); ?><span class="hint">Empty = original text.</span></div></div>
          <p class="how" style="margin-top:20px"><strong>Announcement pop-up</strong> (optional message for visitors, such as a sale or a delay notice)</p>
          <div class="row"><label class="t">Show it?</label><div><label><input type="checkbox" name="<?php echo $n; ?>[popup_on]" value="1" <?php checked($get('popup_on'), '1'); ?>> Yes, show the pop-up</label><span class="hint">Each visitor sees it once. If you change the title or text, everyone sees it again.</span></div></div>
          <div class="row"><label class="t">Title</label><div><?php $f('popup_title'); ?></div></div>
          <div class="row"><label class="t">Message</label><div><textarea name="<?php echo $n; ?>[popup_text]" rows="3"><?php echo esc_textarea($get('popup_text')); ?></textarea></div></div>
          <div class="row"><label class="t">Button text</label><div><?php $f('popup_button'); ?></div></div>
        </div>
        <div class="savebar"><?php submit_button('Save Changes', 'primary large', 'submit', false); ?><span class="description" style="margin-left:12px">Empty a text box and save to go back to the original.</span></div>
      </form>
    </div>
    <?php
}

/* ---------- apply the settings to the pages ---------- */
function ionlab_apply_site($html) {
    $v = ionlab_site(); $d = ionlab_site_defaults();
    if ($v['email'] !== $d['email']) $html = str_replace($d['email'], esc_html($v['email']), $html);
    if ($v['brand'] !== $d['brand']) $html = str_replace($d['brand'], esc_html($v['brand']), $html);
    if ((string) (float) $v['free_over'] !== (string) (float) $d['free_over']) {
        $amt = ionlab_fmt_money($v['free_over']);
        $html = str_replace('$' . $d['free_over'], $amt, $html);
    }
    /* banner */
    if ($v['banner_on'] !== '1') {
        $html = preg_replace('~<div id="ion-promo-topbar".*?</div>\s*</div>~s', '', $html, 1);
    } elseif ($v['banner_text'] !== $d['banner_text']) {
        $html = str_replace($d['banner_text'], esc_html($v['banner_text']), $html);
    }
    $cfg = '<script>window.IONCMS=window.IONCMS||{};window.IONCMS.promoCfg=' . wp_json_encode(array('topbarEnabled' => $v['banner_on'] === '1', 'topbarHtml' => esc_html($v['banner_text']))) . ';</script>';
    $pos = stripos($html, '</head>');
    $html = ($pos !== false) ? substr($html, 0, $pos) . $cfg . substr($html, $pos) : $cfg . $html;
    /* contact page phone: shown only when a phone is set */
    if (trim($v['phone']) === '') {
        $html = preg_replace('~<div[^>]*data-ion-phone[^>]*>.*?</div>~s', '', $html, 1);
    } else {
        $tel = esc_attr('tel:' . preg_replace('/[^0-9+]/', '', $v['phone']));
        $html = preg_replace_callback('~(<div[^>]*data-ion-phone[^>]*>.*?)<a href="tel:">phone</a>~s', function ($m) use ($tel, $v) { return $m[1] . '<a href="' . $tel . '">' . esc_html($v['phone']) . '</a>'; }, $html, 1);
    }
    /* footer contact lines */
    $lines = array();
    $addr = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', (string) $v['address'])));
    if ($addr) $lines[] = esc_html(implode(', ', $addr));
    if (trim($v['phone']) !== '') $lines[] = '<a href="tel:' . esc_attr(preg_replace('/[^0-9+]/', '', $v['phone'])) . '" style="color:inherit">' . esc_html($v['phone']) . '</a>';
    if ($lines) {
        $block = '<p class="ion-footer-contact" style="margin:0 0 10px;font-size:14px;opacity:.9;text-align:center">' . implode(' &middot; ', $lines) . '</p>';
        $html = preg_replace_callback('~<div class="ion-footer-bottom">~', function ($m) use ($block) { return $block . $m[0]; }, $html, 1);
    }
    /* announcement pop-up */
    if ($v['popup_on'] === '1' && (trim($v['popup_title']) !== '' || trim($v['popup_text']) !== '')) {
        $data = wp_json_encode(array('t' => $v['popup_title'], 'm' => $v['popup_text'], 'b' => $v['popup_button'], 'v' => $v['popup_ver']));
        $js = '<script>(function(){var D=' . $data . ';try{if(localStorage.getItem("ion_popup_seen")===D.v)return}catch(e){}'
            . 'function show(){if(document.getElementById("ion-announce"))return;var o=document.createElement("div");o.id="ion-announce";o.setAttribute("role","dialog");o.setAttribute("aria-modal","true");'
            . 'o.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px";'
            . 'var b=document.createElement("div");b.style.cssText="background:#fff;color:#222;max-width:440px;width:100%;border-radius:12px;padding:28px 24px;text-align:center;font-family:inherit;box-shadow:0 10px 40px rgba(0,0,0,.3)";'
            . 'if(D.t){var h=document.createElement("h3");h.textContent=D.t;h.style.cssText="margin:0 0 10px;font-size:20px";b.appendChild(h)}'
            . 'if(D.m){var p=document.createElement("p");p.textContent=D.m;p.style.cssText="margin:0 0 18px;line-height:1.5;white-space:pre-line";b.appendChild(p)}'
            . 'var k=document.createElement("button");k.type="button";k.textContent=D.b||"OK";k.style.cssText="padding:10px 28px;border:0;border-radius:8px;background:#0a74ff;color:#fff;font-size:15px;cursor:pointer";'
            . 'k.onclick=function(){try{localStorage.setItem("ion_popup_seen",D.v)}catch(e){}o.remove()};b.appendChild(k);o.appendChild(b);document.body.appendChild(o)}'
            . 'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(show,900)});else setTimeout(show,900)})();</script>';
        $pos = strripos($html, '</body>');
        $html = ($pos !== false) ? substr($html, 0, $pos) . $js . substr($html, $pos) : $html . $js;
    }
    return $html;
}
