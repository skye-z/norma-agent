/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        norma: {
          bg: 'rgba(15, 15, 18, 0.6)',
          panel: 'rgba(30, 30, 35, 0.5)',
          border: 'rgba(255, 255, 255, 0.1)',
          text: 'rgba(255, 255, 255, 0.9)',
          textMuted: 'rgba(255, 255, 255, 0.4)',
          accent: 'hsl(210, 100%, 70%)',
        }
      },
      animation: {
        'spring-in': 'springIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
      },
      keyframes: {
        springIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
