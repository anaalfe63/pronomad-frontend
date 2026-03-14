/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // The "Pronomad Teal" (Primary Brand)
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6', // Main Brand Color
          600: '#0d9488',
          700: '#0f766e',
          900: '#134e4a', // Sidebar Background
        },
        // The "Growth Green" (For Money & Success)
        green: {
          500: '#22c55e',
          600: '#16a34a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Clean, modern font
      }
    },
  },
  plugins: [],
}