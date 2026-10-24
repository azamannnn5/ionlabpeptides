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

// One-time admin action: move WordPress files from /wp into the domain root.
add_action('admin_init', function () {
    if (empty($_GET['ionlab_move']) || !current_user_can('manage_options')) return;
    $dir  = untrailingslashit(ABSPATH);
    $root = dirname($dir);
    $sub  = basename($dir);
    $log  = array();
    if ($sub !== 'wp') wp_die('Not in /wp, nothing to do.');
    if (defined('WP_HOME') || defined('WP_SITEURL')) $log[] = 'NOTE: WP_HOME/WP_SITEURL defined in wp-config';
    // Root rules: old /wp URLs redirect to the root, then standard WordPress rules.
    $ht = file_exists($root . '/.htaccess') ? file_get_contents($root . '/.htaccess') : '';
    if (strpos($ht, 'ionlab-wp-redirect') === false) {
        $ht = preg_replace('/# BEGIN WordPress/', "# ionlab-wp-redirect\nRewriteEngine On\nRewriteRule ^wp/?(.*)\$ /\$1 [R=301,L]\n# BEGIN WordPress", $ht, 1);
        file_put_contents($root . '/.htaccess', $ht);
    }
    if (file_exists($root . '/index.php') && strpos(file_get_contents($root . '/index.php'), "/wp/wp-blog-header") !== false) {
        unlink($root . '/index.php');
    }
    foreach (scandir($dir) as $f) {
        if ($f === '.' || $f === '..' || $f === '.htaccess') continue;
        if (file_exists("$root/$f")) { $log[] = "skipped $f (exists)"; continue; }
        if (@rename("$dir/$f", "$root/$f")) $log[] = "moved $f"; else $log[] = "FAILED $f";
    }
    $new = 'http://ionlabpeptides.com';
    update_option('siteurl', $new);
    update_option('home', $new);
    @rename("$dir/.htaccess", "$root/.htaccess.old-wp");
    @rmdir($dir);
    wp_die('Move done: ' . esc_html(implode(', ', $log)), 'Done', array('response' => 200));
});
