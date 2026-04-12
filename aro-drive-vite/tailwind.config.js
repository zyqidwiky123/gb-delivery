/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Original colors
        card: '#262626',
        textPrimary: '#FAFAFA',
        textSecondary: '#A3A3A3',

        // New Gen Z / M3 colors
        "primary-fixed": "#cafd00",
        "primary-container": "#cafd00",
        "surface-container": "#1a1919",
        "outline": "#777575",
        "surface-container-lowest": "#000000",
        "tertiary-fixed": "#fce047",
        "background": "#0e0e0e",
        "inverse-primary": "#516700",
        "on-primary-fixed-variant": "#526900",
        "secondary-fixed": "#ece856",
        "on-secondary": "#565400",
        "on-primary-container": "#4a5e00",
        "outline-variant": "#494847",
        "secondary-fixed-dim": "#ddda49",
        "surface-container-highest": "#262626",
        "on-tertiary-fixed": "#483d00",
        "error": "#ff7351",
        "on-surface": "#ffffff",
        "surface": "#0e0e0e",
        "on-primary-fixed": "#3a4a00",
        "tertiary-dim": "#edd13a",
        "error-dim": "#d53d18",
        "on-background": "#ffffff",
        "surface-variant": "#262626",
        "on-surface-variant": "#adaaaa",
        "on-secondary-fixed-variant": "#605e00",
        "on-tertiary": "#665800",
        "on-error-container": "#ffd2c8",
        "on-error": "#450900",
        "tertiary-fixed-dim": "#edd13a",
        "primary-dim": "#beee00",
        "secondary-dim": "#ddda49",
        "on-tertiary-container": "#5d5000",
        "primary-fixed-dim": "#beee00",
        "tertiary-container": "#fce047",
        "tertiary": "#ffeea5",
        "secondary-container": "#636100",
        "surface-tint": "#f3ffca",
        "on-secondary-fixed": "#434100",
        "secondary": "#ece856",
        "surface-container-high": "#201f1f",
        "surface-dim": "#0e0e0e",
        "error-container": "#b92902",
        "primary": "#f3ffca",
        "on-tertiary-fixed-variant": "#685900",
        "inverse-surface": "#fcf8f8",
        "on-secondary-container": "#fffca4",
        "surface-container-low": "#131313",
        "inverse-on-surface": "#565554",
        "on-primary": "#516700",
        "surface-bright": "#2c2c2c"
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
