export const APP_TOKENS = {
  color: {
    canvas: "#f4f6fa",
    canvasMuted: "#eef2f7",

    surface: "#ffffff",
    surfaceMuted: "#fafcfe",
    surfaceSubtle: "#f6f8fb",
    surfaceInverse: "#0d121c",

    text: "#101828",
    textMuted: "#475467",
    textSubtle: "#667085",
    textInverse: "#f8fafc",

    line: "#d6dde6",
    lineStrong: "#c2ccd8",
    lineSoft: "#e4e9f0",

    brand: "#264ca5",
    brandStrong: "#1d3d88",
    brandEmphasis: "#264ca5",
    brandSoft: "#edf2fb",

    info: "#264ca5",
    infoSoft: "#edf2fb",

    success: "#157057",
    successSoft: "#eff9f4",

    warning: "#9a591e",
    warningSoft: "#fbf5eb",

    danger: "#aa2b34",
    dangerSoft: "#fdf1f2",

    focus: "rgba(38, 76, 165, 0.12)",
    overlay: "rgba(12, 16, 24, 0.46)",
  },

  shadow: {
    xs: "0 1px 2px rgba(15, 23, 38, 0.04)",
    sm: "0 6px 18px -10px rgba(15, 23, 38, 0.12), 0 2px 6px -4px rgba(15, 23, 38, 0.06)",
    md: "0 14px 30px -16px rgba(15, 23, 38, 0.14), 0 6px 14px -10px rgba(15, 23, 38, 0.08)",
    lg: "0 24px 48px -24px rgba(15, 23, 38, 0.16), 0 10px 24px -16px rgba(15, 23, 38, 0.10)",
  },

  radius: {
    xs: 6,
    sm: 8,
    md: 10,
    lg: 12,
    xl: 14,
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
    height: 38,
    heightLarge: 42,
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
        borderRadiusLG: 18,
        contentBg: APP_TOKENS.color.surface,
        headerBg: APP_TOKENS.color.surface,
      },
      Drawer: {
        borderRadiusLG: 18,
        colorBgElevated: APP_TOKENS.color.surface,
      },
      Tabs: {
        itemColor: APP_TOKENS.color.textMuted,
        itemSelectedColor: APP_TOKENS.color.text,
        itemHoverColor: APP_TOKENS.color.text,
        inkBarColor: APP_TOKENS.color.brand,
      },
      Menu: {
        itemHeight: 38,
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