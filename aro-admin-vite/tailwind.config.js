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
        "outline": "#777575",
        "surface-tint": "#f3ffca",
        "surface-variant": "#262626",
        "on-primary-container": "#4a5e00",
        "on-error-container": "#ffd2c8",
        "surface-container-low": "#131313",
        "on-secondary-fixed": "#434100",
        "secondary": "#ece856",
        "surface-container-highest": "#262626",
        "on-error": "#450900",
        "background": "#0e0e0e",
        "tertiary-fixed-dim": "#edd13a",
        "surface-dim": "#0e0e0e",
        "surface": "#0e0e0e",
        "secondary-container": "#636100",
        "on-secondary-fixed-variant": "#605e00",
        "primary-fixed": "#cafd00",
        "surface-container-high": "#201f1f",
        "secondary-dim": "#ddda49",
        "on-primary-fixed": "#3a4a00",
        "error-container": "#b92902",
        "on-background": "#ffffff",
        "on-primary-fixed-variant": "#526900",
        "on-tertiary-fixed-variant": "#685900",
        "error": "#ff7351",
        "primary-dim": "#beee00",
        "primary-fixed-dim": "#beee00",
        "tertiary-fixed": "#fce047",
        "error-dim": "#d53d18",
        "on-secondary-container": "#fffca4",
        "primary": "#f3ffca",
        "on-secondary": "#565400",
        "surface-bright": "#2c2c2c",
        "on-surface": "#ffffff",
        "inverse-primary": "#516700",
        "primary-container": "#cafd00",
        "inverse-on-surface": "#565554",
        "on-surface-variant": "#adaaaa",
        "tertiary-dim": "#edd13a",
        "tertiary-container": "#fce047",
        "tertiary": "#ffeea5",
        "on-tertiary-container": "#5d5000",
        "on-tertiary-fixed": "#483d00",
        "surface-container": "#1a1919",
        "on-tertiary": "#665800",
        "secondary-fixed-dim": "#ddda49",
        "surface-container-lowest": "#000000",
        "secondary-fixed": "#ece856",
        "on-primary": "#516700",
        "inverse-surface": "#fcf8f8",
        "outline-variant": "#494847"
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
        "headline": ["Plus Jakarta Sans", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"]
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
