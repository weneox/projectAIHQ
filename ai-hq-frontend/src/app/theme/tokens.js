export const APP_TOKENS = {
  color: {
    canvas: "#f4f7fb",
    canvasMuted: "#ecf1f7",

    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    surfaceSubtle: "#f2f5f9",
    surfaceInverse: "#0f172a",

    text: "#0c1424",
    textMuted: "#4e5d70",
    textSubtle: "#708094",
    textInverse: "#f8fafc",

    line: "#d8e0ea",
    lineStrong: "#c0cbd8",
    lineSoft: "#e7ecf2",

    brand: "#2563eb",
    brandStrong: "#1d4ed8",
    brandEmphasis: "#1d4ed8",
    brandSoft: "#eef4ff",

    info: "#2563eb",
    infoSoft: "#eef4ff",

    success: "#0f766e",
    successSoft: "#f0fdfa",

    warning: "#b45309",
    warningSoft: "#fffbeb",

    danger: "#be185d",
    dangerSoft: "#fff1f2",

    focus: "rgba(37, 99, 235, 0.14)",
    overlay: "rgba(12, 20, 36, 0.48)",
  },

  shadow: {
    xs: "0 1px 2px rgba(12, 20, 36, 0.04)",
    sm: "0 10px 28px rgba(12, 20, 36, 0.06)",
    md: "0 20px 48px rgba(12, 20, 36, 0.10)",
    lg: "0 30px 72px rgba(12, 20, 36, 0.12)",
  },

  radius: {
    xs: 8,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    pill: 999,
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
    height: 44,
    heightLarge: 52,
  },

  motion: {
    fast: "0.14s",
    base: "0.22s",
    slow: "0.32s",
    easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  },

  layout: {
    pageMax: 1320,
    pageWide: 1480,
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

      borderRadius: APP_TOKENS.radius.sm,
      borderRadiusSM: APP_TOKENS.radius.xs,
      borderRadiusLG: APP_TOKENS.radius.md,
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
        borderRadius: APP_TOKENS.radius.md,
        controlHeight: APP_TOKENS.control.height,
        controlHeightLG: APP_TOKENS.control.heightLarge,
        primaryShadow: "none",
        defaultShadow: "none",
        fontWeight: 700,
      },
      Input: {
        borderRadius: APP_TOKENS.radius.md,
        activeBorderColor: APP_TOKENS.color.brand,
        hoverBorderColor: APP_TOKENS.color.lineStrong,
      },
      Select: {
        borderRadius: APP_TOKENS.radius.md,
        activeBorderColor: APP_TOKENS.color.brand,
        hoverBorderColor: APP_TOKENS.color.lineStrong,
      },
      Dropdown: {
        borderRadiusLG: APP_TOKENS.radius.lg,
        paddingBlock: 6,
      },
      Tooltip: {
        borderRadius: 12,
        colorBgSpotlight: "rgba(12, 20, 36, 0.92)",
        fontSize: 12,
      },
      Table: {
        borderColor: APP_TOKENS.color.lineSoft,
        headerBg: APP_TOKENS.color.surfaceMuted,
        rowHoverBg: APP_TOKENS.color.surfaceMuted,
      },
      Modal: {
        borderRadiusLG: APP_TOKENS.radius.lg,
        contentBg: APP_TOKENS.color.surface,
        headerBg: APP_TOKENS.color.surface,
      },
      Drawer: {
        borderRadiusLG: APP_TOKENS.radius.lg,
        colorBgElevated: APP_TOKENS.color.surface,
      },
      Tabs: {
        itemColor: APP_TOKENS.color.textMuted,
        itemSelectedColor: APP_TOKENS.color.text,
        itemHoverColor: APP_TOKENS.color.text,
        inkBarColor: APP_TOKENS.color.brand,
      },
      Menu: {
        itemHeight: 42,
        itemMarginBlock: 2,
        itemBorderRadius: APP_TOKENS.radius.md,
        itemSelectedBg: APP_TOKENS.color.brandSoft,
        itemSelectedColor: APP_TOKENS.color.brandEmphasis,
        itemColor: APP_TOKENS.color.textMuted,
      },
      Result: {
        titleFontSize: 24,
        subtitleFontSize: 14,
      },
    },
  };
}