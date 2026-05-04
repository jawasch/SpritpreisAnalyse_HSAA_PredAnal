/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        fuel: {
          e5: '#3b82f6',
          e10: '#8b5cf6',
          diesel: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
}
