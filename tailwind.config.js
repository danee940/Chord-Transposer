/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/templates/**/*.html", "./src/js/**/*.ts"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        bg: "#0f172a",
        card: "#1e293b",
        accent: "#6366f1",
        "accent-hover": "#4f46e5",
        muted: "#94a3b8",
        "app-border": "#334155",
        "app-error": "#f87171",
        "app-ok": "#34d399",
        "bg-light": "#f1f5f9",
        "card-light": "#ffffff",
        "muted-light": "#64748b",
        "app-border-light": "#e2e8f0",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
};
