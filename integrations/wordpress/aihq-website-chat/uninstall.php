<?php

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('aihq_website_chat_settings');
