/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#10b981", // Emerald 500
        secondary: "#059669", // Emerald 600
        dark: "#0a0a0a",
        surface: "#171717",
        accent: "#34d399", // Emerald 400
      },
      fontFamily: {
        body: ['Inter', 'sans-serif'],
        headline: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}