<?php
/* Installs a small loader plugin ("Ionlab Core") that loads core/ionlab-core.php from this theme folder. */
if (!defined('ABSPATH')) exit;

function ionlab_install_loader() {
    $dir = WP_PLUGIN_DIR . '/ionlab-core';
    $file = $dir . '/ionlab-core.php';
    if (!is_file($file)) {
        if (!is_dir($dir)) wp_mkdir_p($dir);
        $code = "<?php\n/*\nPlugin Name: Ionlab Core\nDescription: Orders, contact, email and WooCommerce data for the Ionlab site.\nVersion: 1.0.0\n*/\n"
              . "if (!defined('ABSPATH')) exit;\n"
              . "\$ionlab_core = WP_CONTENT_DIR . '/themes/ionlab/core/ionlab-core.php';\n"
              . "if (is_file(\$ionlab_core)) require_once \$ionlab_core;\n";
        file_put_contents($file, $code);
    }
    if (is_file($file)) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        if (!is_plugin_active('ionlab-core/ionlab-core.php')) activate_plugin('ionlab-core/ionlab-core.php');
    }
}
add_action('after_switch_theme', 'ionlab_install_loader');
