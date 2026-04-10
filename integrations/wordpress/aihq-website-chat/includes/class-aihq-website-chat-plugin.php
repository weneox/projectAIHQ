<?php

if (!defined('ABSPATH')) {
    exit;
}

final class AIHQ_Website_Chat_Plugin
{
    private const SETTINGS_GROUP = 'aihq_website_chat_settings_group';
    private const SETTINGS_SLUG = 'aihq-website-chat';
    private const SETTINGS_ERROR_SLUG = 'aihq_website_chat';

    private static $instance = null;

    public static function boot()
    {
        if (self::$instance instanceof self) {
            return self::$instance;
        }

        self::$instance = new self();

        return self::$instance;
    }

    private function __construct()
    {
        add_action('admin_init', array($this, 'register_settings'));
        add_action('admin_menu', array($this, 'register_admin_page'));
        add_action('wp_footer', array($this, 'maybe_render_loader'), 20);
    }

    public function register_settings()
    {
        register_setting(
            self::SETTINGS_GROUP,
            AIHQ_WEBSITE_CHAT_OPTION,
            array(
                'type' => 'array',
                'sanitize_callback' => array($this, 'sanitize_settings'),
                'default' => $this->default_settings(),
            )
        );
    }

    public function register_admin_page()
    {
        add_options_page(
            'AIHQ Website Chat',
            'AIHQ Website Chat',
            'manage_options',
            self::SETTINGS_SLUG,
            array($this, 'render_settings_page')
        );
    }

    public function sanitize_settings($input)
    {
        $input = is_array($input) ? $input : array();
        $existing = $this->get_settings();
        $settings = $existing;
        $settings['enabled'] = !empty($input['enabled']);

        $packageJson = trim(wp_unslash(isset($input['package_json']) ? $input['package_json'] : ''));

        if ($packageJson !== '') {
            $decoded = json_decode($packageJson, true);
            if (!is_array($decoded)) {
                $settings['package_json'] = $packageJson;
                add_settings_error(
                    self::SETTINGS_ERROR_SLUG,
                    'invalid_package_json',
                    'Paste a valid AIHQ WordPress package JSON before enabling Website Chat.',
                    'error'
                );
                $settings['enabled'] = false;

                return $settings;
            }

            $package = $this->sanitize_package($decoded);
            if (is_wp_error($package)) {
                $settings['package_json'] = $packageJson;
                add_settings_error(
                    self::SETTINGS_ERROR_SLUG,
                    'invalid_package_payload',
                    $package->get_error_message(),
                    'error'
                );
                $settings['enabled'] = false;

                return $settings;
            }

            $settings = array_merge($settings, $package);
            $settings['package_json'] = wp_json_encode($package['package_payload'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        }

        if (!$this->is_ready_config($settings)) {
            if ($settings['enabled']) {
                add_settings_error(
                    self::SETTINGS_ERROR_SLUG,
                    'not_ready',
                    'Website Chat can only be enabled with a production-ready package generated from AIHQ.',
                    'error'
                );
            }
            $settings['enabled'] = false;

            return $settings;
        }

        if (!$this->site_matches_verified_domain($settings)) {
            if ($settings['enabled']) {
                add_settings_error(
                    self::SETTINGS_ERROR_SLUG,
                    'domain_mismatch',
                    sprintf(
                        'This WordPress site host does not match the verified AIHQ domain %s. Update the site host or generate a matching package before enabling Website Chat.',
                        esc_html($settings['verified_domain'])
                    ),
                    'error'
                );
            }
            $settings['enabled'] = false;

            return $settings;
        }

        add_settings_error(
            self::SETTINGS_ERROR_SLUG,
            'settings_saved',
            $settings['enabled']
                ? 'AIHQ Website Chat is enabled on this WordPress site.'
                : 'AIHQ Website Chat settings were saved.',
            'updated'
        );

        return $settings;
    }

    public function render_settings_page()
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        $settings = $this->get_settings();
        $siteHost = $this->current_site_host();
        $matchesDomain = $this->site_matches_verified_domain($settings);
        ?>
        <div class="wrap">
            <h1>AIHQ Website Chat</h1>
            <p>Paste the WordPress package JSON generated from the AIHQ Website Chat drawer, then enable the widget for this verified site.</p>
            <?php settings_errors(self::SETTINGS_ERROR_SLUG); ?>

            <form method="post" action="options.php">
                <?php settings_fields(self::SETTINGS_GROUP); ?>
                <table class="form-table" role="presentation">
                    <tbody>
                        <tr>
                            <th scope="row">Current site host</th>
                            <td><code><?php echo esc_html($siteHost !== '' ? $siteHost : 'unknown'); ?></code></td>
                        </tr>
                        <tr>
                            <th scope="row">Verified domain</th>
                            <td><code><?php echo esc_html($settings['verified_domain'] !== '' ? $settings['verified_domain'] : 'Not configured'); ?></code></td>
                        </tr>
                        <tr>
                            <th scope="row">Widget ID</th>
                            <td><code><?php echo esc_html($settings['widget_id'] !== '' ? $settings['widget_id'] : 'Not configured'); ?></code></td>
                        </tr>
                        <tr>
                            <th scope="row">Loader script URL</th>
                            <td><code><?php echo esc_html($settings['loader_script_url'] !== '' ? $settings['loader_script_url'] : 'Not configured'); ?></code></td>
                        </tr>
                        <tr>
                            <th scope="row">Readiness</th>
                            <td>
                                <strong><?php echo esc_html($settings['readiness_status'] !== '' ? $settings['readiness_status'] : 'not_ready'); ?></strong>
                                <?php if ($settings['readiness_message'] !== '') : ?>
                                    <p class="description"><?php echo esc_html($settings['readiness_message']); ?></p>
                                <?php endif; ?>
                                <?php if ($settings['verified_at'] !== '') : ?>
                                    <p class="description">Verified at: <?php echo esc_html($settings['verified_at']); ?></p>
                                <?php endif; ?>
                                <?php if ($settings['generated_at'] !== '') : ?>
                                    <p class="description">Package generated at: <?php echo esc_html($settings['generated_at']); ?></p>
                                <?php endif; ?>
                                <?php if ($settings['verified_domain'] !== '' && !$matchesDomain) : ?>
                                    <p class="description">This site host must match the verified domain before the widget can be enabled.</p>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">
                                <label for="aihq-website-chat-package-json">WordPress package JSON</label>
                            </th>
                            <td>
                                <textarea
                                    id="aihq-website-chat-package-json"
                                    name="<?php echo esc_attr(AIHQ_WEBSITE_CHAT_OPTION); ?>[package_json]"
                                    rows="16"
                                    class="large-text code"
                                ><?php echo esc_textarea($settings['package_json']); ?></textarea>
                                <p class="description">Generate this package from AIHQ only after Website Chat is production-ready and domain ownership is verified.</p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">Enable Website Chat</th>
                            <td>
                                <label for="aihq-website-chat-enabled">
                                    <input
                                        id="aihq-website-chat-enabled"
                                        type="checkbox"
                                        name="<?php echo esc_attr(AIHQ_WEBSITE_CHAT_OPTION); ?>[enabled]"
                                        value="1"
                                        <?php checked(!empty($settings['enabled'])); ?>
                                    />
                                    Load Website Chat on the public site footer when this package is valid and the site host matches the verified domain.
                                </label>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <?php submit_button('Save Website Chat settings'); ?>
            </form>
        </div>
        <?php
    }

    public function maybe_render_loader()
    {
        if (is_admin() || is_feed() || is_preview()) {
            return;
        }

        $settings = $this->get_settings();
        if (empty($settings['enabled'])) {
            return;
        }

        if (!$this->is_ready_config($settings) || !$this->site_matches_verified_domain($settings)) {
            return;
        }

        printf(
            "\n<!-- AIHQ Website Chat -->\n<script src=\"%1\$s\" data-widget-id=\"%2\$s\" data-api-base=\"%3\$s\" async></script>\n",
            esc_url($settings['loader_script_url']),
            esc_attr($settings['widget_id']),
            esc_attr($settings['api_base'])
        );
    }

    private function sanitize_package(array $package)
    {
        $packageType = $this->normalize_string(isset($package['packageType']) ? $package['packageType'] : '');
        $verifiedDomain = $this->normalize_domain(isset($package['verifiedDomain']) ? $package['verifiedDomain'] : '');
        $widgetId = $this->normalize_string(isset($package['widgetId']) ? $package['widgetId'] : '');
        $loaderScriptUrl = esc_url_raw(isset($package['loaderScriptUrl']) ? $package['loaderScriptUrl'] : '');
        $apiBase = esc_url_raw(isset($package['apiBase']) ? $package['apiBase'] : '');
        $generatedAt = $this->normalize_string(isset($package['generatedAt']) ? $package['generatedAt'] : '');
        $readiness = isset($package['readiness']) && is_array($package['readiness']) ? $package['readiness'] : array();
        $productionInstallReady = !empty($package['ready']) && !empty($readiness['productionInstallReady']);

        if ($packageType !== 'wordpress') {
            return new WP_Error('invalid_package_type', 'Paste a WordPress-specific package generated from AIHQ.');
        }

        if (!$productionInstallReady) {
            return new WP_Error('package_not_ready', 'This package is not marked production-ready. Complete domain verification in AIHQ first.');
        }

        if ($verifiedDomain === '' || $widgetId === '' || $loaderScriptUrl === '' || $apiBase === '') {
            return new WP_Error('package_incomplete', 'This package is missing required install fields. Generate a fresh WordPress package from AIHQ.');
        }

        $sanitizedPackage = $package;
        $sanitizedPackage['verifiedDomain'] = $verifiedDomain;
        $sanitizedPackage['widgetId'] = $widgetId;
        $sanitizedPackage['loaderScriptUrl'] = $loaderScriptUrl;
        $sanitizedPackage['apiBase'] = $apiBase;

        return array(
            'enabled' => false,
            'verified_domain' => $verifiedDomain,
            'widget_id' => $widgetId,
            'loader_script_url' => $loaderScriptUrl,
            'api_base' => $apiBase,
            'readiness_status' => $this->normalize_string(isset($readiness['status']) ? $readiness['status'] : ''),
            'readiness_message' => $this->normalize_string(isset($readiness['message']) ? $readiness['message'] : ''),
            'verified_at' => $this->normalize_string(isset($readiness['verifiedAt']) ? $readiness['verifiedAt'] : ''),
            'generated_at' => $generatedAt,
            'package_payload' => $sanitizedPackage,
        );
    }

    private function get_settings()
    {
        $settings = get_option(AIHQ_WEBSITE_CHAT_OPTION, array());

        return wp_parse_args(
            is_array($settings) ? $settings : array(),
            $this->default_settings()
        );
    }

    private function default_settings()
    {
        return array(
            'enabled' => false,
            'verified_domain' => '',
            'widget_id' => '',
            'loader_script_url' => '',
            'api_base' => '',
            'readiness_status' => '',
            'readiness_message' => '',
            'verified_at' => '',
            'generated_at' => '',
            'package_json' => '',
        );
    }

    private function normalize_string($value)
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }

    private function normalize_domain($value)
    {
        $domain = strtolower($this->normalize_string($value));
        $domain = preg_replace('#^https?://#', '', $domain);
        $domain = preg_replace('#/.*$#', '', $domain);
        $domain = preg_replace('#:\d+$#', '', $domain);
        $domain = preg_replace('/\.+$/', '', $domain);

        if (strpos($domain, 'www.') === 0) {
            $domain = substr($domain, 4);
        }

        return $domain;
    }

    private function current_site_host()
    {
        $host = parse_url(home_url('/'), PHP_URL_HOST);

        return $this->normalize_domain($host);
    }

    private function host_matches($expectedDomain, $siteHost)
    {
        if ($expectedDomain === '' || $siteHost === '') {
            return false;
        }

        if ($expectedDomain === $siteHost) {
            return true;
        }

        return substr($siteHost, -strlen('.' . $expectedDomain)) === '.' . $expectedDomain;
    }

    private function site_matches_verified_domain(array $settings)
    {
        return $this->host_matches(
            $this->normalize_domain(isset($settings['verified_domain']) ? $settings['verified_domain'] : ''),
            $this->current_site_host()
        );
    }

    private function is_ready_config(array $settings)
    {
        return !empty($settings['verified_domain']) &&
            !empty($settings['widget_id']) &&
            !empty($settings['loader_script_url']) &&
            !empty($settings['api_base']) &&
            $this->normalize_string(isset($settings['readiness_status']) ? $settings['readiness_status'] : '') === 'ready';
    }
}
