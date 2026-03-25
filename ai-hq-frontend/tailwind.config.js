/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },

      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 6px)",
        "2xl": "24px",
        "3xl": "32px",
        "4xl": "40px",
      },

      colors: {
        bg: "hsl(var(--bg))",
        fg: "hsl(var(--fg))",
        muted: "hsl(var(--muted))",
        border: "hsl(var(--border))",
        surface: "hsl(var(--surface))",
        brand: "hsl(var(--brand))",
        "brand-fg": "hsl(var(--brand-foreground))",
        ring: "hsl(var(--ring))",

        studio: {
          bg: "#F5F7F8",
          panel: "#F8F8F8",
          line: "#DADFE4",
          text: "#111827",
          subtext: "#6B7280",
          chip: "#FBFBFB",
        },
      },

      boxShadow: {
        "elite-xs": "0 1px 0 rgba(15,23,42,0.04)",
        "elite-sm":
          "0 1px 0 rgba(15,23,42,0.05), 0 10px 30px -24px rgba(15,23,42,0.12)",
        "elite-md":
          "0 1px 0 rgba(15,23,42,0.06), 0 18px 48px -30px rgba(15,23,42,0.16)",
        "elite-lg":
          "0 1px 0 rgba(15,23,42,0.06), 0 28px 70px -36px rgba(15,23,42,0.18)",

        "studio-panel":
          "0 0 0 1px rgba(17,24,39,0.08), 0 10px 30px -22px rgba(15,23,42,0.10)",
        "studio-chip":
          "0 1px 0 rgba(255,255,255,0.92) inset, 0 8px 22px -18px rgba(15,23,42,0.10)",
        "studio-button":
          "0 8px 24px -18px rgba(2,6,23,0.22)",
        "studio-glow":
          "0 28px 80px -26px rgba(110,231,183,0.30), 0 34px 90px -34px rgba(125,211,252,0.24)",
        "studio-glow-soft":
          "0 18px 52px -24px rgba(110,231,183,0.22), 0 22px 58px -30px rgba(125,211,252,0.18)",

        "elite-dark-sm":
          "0 1px 0 rgba(255,255,255,0.05), 0 18px 54px -52px rgba(0,0,0,0.78)",
        "elite-dark-md":
          "0 1px 0 rgba(255,255,255,0.06), 0 30px 96px -66px rgba(0,0,0,0.92)",
        "elite-dark-lg":
          "0 1px 0 rgba(255,255,255,0.06), 0 42px 150px -92px rgba(0,0,0,0.98)",
      },

      maxWidth: {
        "studio-hero": "1120px",
        "studio-panel": "1000px",
      },

      transitionTimingFunction: {
        "studio-out": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};