/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        radar: {
          dark: '#0a0e17',
          card: '#121826',
          border: '#1f293d',
          grid: '#00ff66',
          beam: '#00ffaa',
          alert: '#ff3366',
          warn: '#ffbb00',
        },
      },
    },
  },
  plugins: [],
};
