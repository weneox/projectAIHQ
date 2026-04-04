export const APP_TOKENS = {
  color: {
    canvas: "#f1f4f8",
    canvasMuted: "#ebeff5",

    surface: "#ffffff",
    surfaceMuted: "#f7f9fc",
    surfaceSubtle: "#f2f5f9",
    surfaceInverse: "#0d121c",

    text: "#0f1726",
    textMuted: "#4f5c6e",
    textSubtle: "#6f7c8d",
    textInverse: "#f8fafc",

    line: "#dce2ea",
    lineStrong: "#c4cdd9",
    lineSoft: "#e8edf3",

    brand: "#24489a",
    brandStrong: "#1b3779",
    brandEmphasis: "#24489a",
    brandSoft: "#ecf1f9",

    info: "#24489a",
    infoSoft: "#ecf1f9",

    success: "#157057",
    successSoft: "#eff9f4",

    warning: "#9a591e",
    warningSoft: "#fbf5eb",

    danger: "#aa2b34",
    dangerSoft: "#fdf1f2",

    focus: "rgba(36, 72, 154, 0.14)",
    overlay: "rgba(12, 16, 24, 0.46)",
  },

  shadow: {
    xs: "0 1px 2px rgba(15, 23, 38, 0.04)",
    sm: "0 10px 26px rgba(15, 23, 38, 0.05)",
    md: "0 18px 42px rgba(15, 23, 38, 0.08)",
    lg: "0 28px 64px rgba(15, 23, 38, 0.10)",
  },

  radius: {
    xs: 6,
    sm: 8,
    md: 10,
    lg: 12,
    xl: 16,
    pill: 12,
  },

  font: {
    sans: [
      '"Manrope"',
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      '"Segoe UI"',
      "sans-serif",
    ].join(", "),
    display: [
      '"Plus Jakarta Sans"',
      '"Manrope"',
      "ui-sans-serif",
      "system-ui",
      "-apple-system",
      '"Segoe UI"',
      "sans-serif",
    ].join(", "),
  },

  control: {
    height: 40,
    heightLarge: 46,
  },

  motion: {
    fast: "0.14s",
    base: "0.2s",
    slow: "0.28s",
    easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  },

  layout: {
    pageMax: 1320,
    pageWide: 1460,
  },
};

export function getAntdTheme() {
  return {
    cssVar: false,
    hashed: false,
    token: {
      colorPrimary: APP_TOKENS.color.brand,
      colorInfo: APP_TOKENS.color.info,
      colorSuccess: APP_TOKENS.color.success,
      colorWarning: APP_TOKENS.color.warning,
      colorError: APP_TOKENS.color.danger,

      colorText: APP_TOKENS.color.text,
      colorTextSecondary: APP_TOKENS.color.textMuted,
      colorTextTertiary: APP_TOKENS.color.textSubtle,

      colorBgBase: APP_TOKENS.color.canvas,
      colorBgContainer: APP_TOKENS.color.surface,
      colorBgElevated: APP_TOKENS.color.surface,
      colorBgLayout: APP_TOKENS.color.canvas,
      colorFillAlter: APP_TOKENS.color.surfaceMuted,

      colorBorder: APP_TOKENS.color.line,
      colorBorderSecondary: APP_TOKENS.color.lineSoft,
      colorSplit: APP_TOKENS.color.lineSoft,

      borderRadius: APP_TOKENS.radius.md,
      borderRadiusSM: APP_TOKENS.radius.sm,
      borderRadiusLG: APP_TOKENS.radius.xl,
      borderRadiusXS: APP_TOKENS.radius.xs,

      fontFamily: APP_TOKENS.font.sans,
      fontSize: 14,

      controlHeight: APP_TOKENS.control.height,
      controlHeightLG: APP_TOKENS.control.heightLarge,

      boxShadow: APP_TOKENS.shadow.sm,
      boxShadowSecondary: APP_TOKENS.shadow.xs,

      motionDurationFast: APP_TOKENS.motion.fast,
      motionDurationMid: APP_TOKENS.motion.base,
      motionEaseOutCirc: APP_TOKENS.motion.easeOut,
    },
    components: {
      Layout: {
        bodyBg: APP_TOKENS.color.canvas,
        siderBg: APP_TOKENS.color.surface,
        headerBg: APP_TOKENS.color.surface,
      },
      Button: {
        borderRadius: APP_TOKENS.radius.lg,
        controlHeight: APP_TOKENS.control.height,
        controlHeightLG: APP_TOKENS.control.heightLarge,
        primaryShadow: "none",
        defaultShadow: "none",
        fontWeight: 700,
      },
      Input: {
        borderRadius: APP_TOKENS.radius.lg,
        activeBorderColor: APP_TOKENS.color.brand,
        hoverBorderColor: APP_TOKENS.color.lineStrong,
      },
      Select: {
        borderRadius: APP_TOKENS.radius.lg,
        activeBorderColor: APP_TOKENS.color.brand,
        hoverBorderColor: APP_TOKENS.color.lineStrong,
      },
      Dropdown: {
        borderRadiusLG: APP_TOKENS.radius.xl,
        paddingBlock: 6,
      },
      Tooltip: {
        borderRadius: APP_TOKENS.radius.md,
        colorBgSpotlight: "rgba(12, 16, 24, 0.94)",
        fontSize: 11,
      },
      Table: {
        borderColor: APP_TOKENS.color.lineSoft,
        headerBg: APP_TOKENS.color.surfaceMuted,
        rowHoverBg: APP_TOKENS.color.surfaceMuted,
      },
      Modal: {
        borderRadiusLG: 20,
        contentBg: APP_TOKENS.color.surface,
        headerBg: APP_TOKENS.color.surface,
      },
      Drawer: {
        borderRadiusLG: 20,
        colorBgElevated: APP_TOKENS.color.surface,
      },
      Tabs: {
        itemColor: APP_TOKENS.color.textMuted,
        itemSelectedColor: APP_TOKENS.color.text,
        itemHoverColor: APP_TOKENS.color.text,
        inkBarColor: APP_TOKENS.color.brand,
      },
      Menu: {
        itemHeight: 40,
        itemMarginBlock: 2,
        itemBorderRadius: APP_TOKENS.radius.lg,
        itemSelectedBg: APP_TOKENS.color.brandSoft,
        itemSelectedColor: APP_TOKENS.color.brandEmphasis,
        itemColor: APP_TOKENS.color.textMuted,
      },
      Result: {
        titleFontSize: 22,
        subtitleFontSize: 14,
      },
    },
  };
}
