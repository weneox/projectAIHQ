function readCssVar(name, fallback) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }

  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();

  return value || fallback;
}

function rgbVar(name, fallback) {
  return `rgb(${readCssVar(name, fallback)})`;
}

function rgbaVar(name, alpha, fallback) {
  return `rgba(${readCssVar(name, fallback)}, ${alpha})`;
}

function pxVar(name, fallback) {
  const raw = readCssVar(name, String(fallback));
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getAntdTheme() {
  return {
    cssVar: false,
    hashed: false,
    token: {
      colorPrimary: rgbVar("--color-brand", "46 96 255"),
      colorInfo: rgbVar("--color-info", "46 96 255"),
      colorSuccess: rgbVar("--color-success", "21 128 61"),
      colorWarning: rgbVar("--color-warning", "180 83 9"),
      colorError: rgbVar("--color-danger", "190 24 93"),

      colorText: rgbVar("--color-text", "15 23 42"),
      colorTextSecondary: rgbVar("--color-text-muted", "71 85 105"),
      colorTextTertiary: rgbVar("--color-text-subtle", "100 116 139"),

      colorBgBase: rgbVar("--color-canvas", "246 247 249"),
      colorBgLayout: rgbVar("--color-canvas", "246 247 249"),
      colorBgContainer: rgbVar("--color-surface", "255 255 255"),
      colorBgElevated: rgbVar("--color-surface", "255 255 255"),
      colorFillAlter: rgbVar("--color-surface-muted", "250 251 252"),

      colorBorder: rgbVar("--color-line", "222 226 232"),
      colorBorderSecondary: rgbVar("--color-line-soft", "234 237 241"),
      colorSplit: rgbVar("--color-line-soft", "234 237 241"),

      borderRadius: pxVar("--radius-md", 10),
      borderRadiusSM: pxVar("--radius-sm", 8),
      borderRadiusLG: pxVar("--radius-lg", 12),
      borderRadiusXS: pxVar("--radius-xs", 6),

      fontFamily: readCssVar(
        "--font-sans",
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ),
      fontSize: 14,

      controlHeight: pxVar("--control-md", 40),
      controlHeightLG: pxVar("--control-lg", 44),

      boxShadow: readCssVar(
        "--shadow-md",
        "0 18px 40px -24px rgba(15,23,42,0.22), 0 8px 18px -12px rgba(15,23,42,0.12)"
      ),
      boxShadowSecondary: readCssVar(
        "--shadow-sm",
        "0 10px 24px -18px rgba(15,23,42,0.16), 0 4px 10px -8px rgba(15,23,42,0.08)"
      ),

      motionDurationFast: readCssVar("--motion-fast", "120ms"),
      motionDurationMid: readCssVar("--motion-base", "180ms"),
      motionEaseOutCirc: readCssVar(
        "--motion-premium",
        "cubic-bezier(0.22, 1, 0.36, 1)"
      ),
    },

    components: {
      Layout: {
        bodyBg: rgbVar("--color-canvas", "246 247 249"),
        siderBg: rgbVar("--color-surface", "255 255 255"),
        headerBg: rgbVar("--color-surface", "255 255 255"),
      },

      Button: {
        borderRadius: pxVar("--radius-lg", 12),
        controlHeight: pxVar("--control-md", 40),
        controlHeightLG: pxVar("--control-lg", 44),
        primaryShadow: "none",
        defaultShadow: "none",
        fontWeight: 600,
      },

      Input: {
        borderRadius: pxVar("--radius-md", 10),
        activeBorderColor: rgbVar("--color-brand", "46 96 255"),
        hoverBorderColor: rgbVar("--color-line-strong", "198 204 213"),
      },

      InputNumber: {
        borderRadius: pxVar("--radius-md", 10),
        activeBorderColor: rgbVar("--color-brand", "46 96 255"),
        hoverBorderColor: rgbVar("--color-line-strong", "198 204 213"),
      },

      Select: {
        borderRadius: pxVar("--radius-md", 10),
        activeBorderColor: rgbVar("--color-brand", "46 96 255"),
        hoverBorderColor: rgbVar("--color-line-strong", "198 204 213"),
      },

      Dropdown: {
        borderRadiusLG: pxVar("--radius-xl", 14),
        paddingBlock: 6,
      },

      Tooltip: {
        borderRadius: pxVar("--radius-sm", 8),
        colorBgSpotlight: rgbaVar("--color-surface-inverse", 0.96, "12 18 28"),
        fontSize: 11,
      },

      Table: {
        borderColor: rgbVar("--color-line-soft", "234 237 241"),
        headerBg: rgbVar("--color-surface-muted", "250 251 252"),
        rowHoverBg: rgbVar("--color-surface-muted", "250 251 252"),
      },

      Modal: {
        borderRadiusLG: pxVar("--radius-xl", 14),
        contentBg: rgbVar("--color-surface", "255 255 255"),
        headerBg: rgbVar("--color-surface", "255 255 255"),
      },

      Drawer: {
        borderRadiusLG: pxVar("--radius-xl", 14),
        colorBgElevated: rgbVar("--color-surface", "255 255 255"),
      },

      Tabs: {
        itemColor: rgbVar("--color-text-muted", "71 85 105"),
        itemSelectedColor: rgbVar("--color-text", "15 23 42"),
        itemHoverColor: rgbVar("--color-text", "15 23 42"),
        inkBarColor: rgbVar("--color-brand", "46 96 255"),
      },

      Menu: {
        itemHeight: 38,
        itemMarginBlock: 2,
        itemBorderRadius: pxVar("--radius-md", 10),
        itemSelectedBg: rgbVar("--color-brand-soft", "239 244 255"),
        itemSelectedColor: rgbVar("--color-brand", "46 96 255"),
        itemColor: rgbVar("--color-text-muted", "71 85 105"),
      },

      Result: {
        titleFontSize: 22,
        subtitleFontSize: 14,
      },
    },
  };
}