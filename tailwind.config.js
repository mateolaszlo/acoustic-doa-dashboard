/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        radar: {
          dark: '#0a0e17',
        },
      },
    },
  },
  plugins: [],
};
