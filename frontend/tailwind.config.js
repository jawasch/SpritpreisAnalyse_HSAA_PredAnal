/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          orange:  '#FF6624',
          cyan:    '#00EFEF',
          yellow:  '#FFC433',
          cream:   '#EEE9DF',
          charcoal:'#1C1C1A',
        },
        fuel: {
          e5:     '#3b82f6',
          e10:    '#8b5cf6',
          diesel: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
}
