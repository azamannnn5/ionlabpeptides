<?php
// One-time admin action: serve the site from the domain root while WordPress files stay in /wp.
add_action('admin_init', function () {
    if (empty($_GET['ionlab_cutover']) || !current_user_can('manage_options')) return;
    $root = dirname(untrailingslashit(ABSPATH));
    $sub  = basename(untrailingslashit(ABSPATH));
    $log  = array();
    $home = 'http://ionlabpeptides.com';
    $site = $home . '/' . $sub;
    if (!file_exists($root . '/index.php') || strpos(file_get_contents($root . '/index.php'), 'wp-blog-header') === false) {
        foreach (array('index.html', 'index.htm', 'default.html') as $f) {
            if (file_exists("$root/$f")) { rename("$root/$f", "$root/$f.bak"); $log[] = "moved $f"; }
        }
        file_put_contents($root . '/index.php', "<?php\ndefine('WP_USE_THEMES', true);\nrequire __DIR__ . '/$sub/wp-blog-header.php';\n");
        $log[] = 'wrote index.php';
    }
    $ht = file_exists($root . '/.htaccess') ? file_get_contents($root . '/.htaccess') : '';
    if (strpos($ht, '# BEGIN WordPress') === false) {
        $ht .= "\n# BEGIN WordPress\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]\nRewriteBase /\nRewriteRule ^index\\.php$ - [L]\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule . /index.php [L]\n</IfModule>\n# END WordPress\n";
        file_put_contents($root . '/.htaccess', $ht);
        $log[] = 'wrote .htaccess';
    }
    update_option('siteurl', $site);
    update_option('home', $home);
    flush_rewrite_rules(false);
    delete_transient('ionlab_rt_cache');
    wp_die('Cutover done: ' . esc_html(implode(', ', $log)) . '. Site: ' . esc_html($home), 'Done', array('response' => 200));
});
