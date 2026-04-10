<?php
/**
 * Plugin Name: AIHQ Website Chat
 * Description: Installs a verified AIHQ Website Chat widget on a production-ready WordPress site.
 * Version: 0.1.0
 * Author: AIHQ
 * License: Proprietary
 */

if (!defined('ABSPATH')) {
    exit;
}

define('AIHQ_WEBSITE_CHAT_VERSION', '0.1.0');
define('AIHQ_WEBSITE_CHAT_OPTION', 'aihq_website_chat_settings');
define('AIHQ_WEBSITE_CHAT_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once AIHQ_WEBSITE_CHAT_PLUGIN_DIR . 'includes/class-aihq-website-chat-plugin.php';

AIHQ_Website_Chat_Plugin::boot();
