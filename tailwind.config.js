/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#25231f',
        paper: '#f6f3eb',
        coral: '#f45d48',
        cobalt: '#3659e3',
        mint: '#8dd8b7',
      },
    },
  },
  plugins: [],
}
