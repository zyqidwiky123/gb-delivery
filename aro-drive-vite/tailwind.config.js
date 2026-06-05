/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Core Theme (Mapped to CSS Variables)
        "background": "rgb(var(--bg-app) / <alpha-value>)",
        "on-background": "rgb(var(--text-main) / <alpha-value>)",
        "surface": "rgb(var(--surface) / <alpha-value>)",
        "on-surface": "rgb(var(--text-main) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--text-muted) / <alpha-value>)",
        "primary": "rgb(var(--primary) / <alpha-value>)",
        "on-primary": "rgb(var(--primary-fg) / <alpha-value>)",
        "outline": "rgb(var(--border) / <alpha-value>)",
        "surface-container": "rgb(var(--surface) / <alpha-value>)",
        "surface-container-low": "rgb(var(--surface) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--surface) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--bg-app) / <alpha-value>)",
        "primary-container": "rgb(var(--primary) / <alpha-value>)",
        "primary-fixed": "rgb(var(--primary) / <alpha-value>)",

        // Legacy / Static Colors
        card: 'var(--surface)',
        textPrimary: 'var(--text-main)',
        textSecondary: 'var(--text-muted)',
        "tertiary-fixed": "#fce047",
        "error": "#ff7351",
        "secondary": "#ece856",
        "secondary-fixed": "#ece856",
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
        "headline": ["Plus Jakarta Sans", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"],
        "plus-jakarta": ["Plus Jakarta Sans", "sans-serif"],
        "inter": ["Inter", "sans-serif"]
      },
      borderRadius: {
        lg: '.5rem',
        xl: '.75rem',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
