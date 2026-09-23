/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        conveyor: 'conveyor 2s linear infinite',
      },
      keyframes: {
        conveyor: {
          '0%': { left: '4px', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { left: 'calc(100% - 24px)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
