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
          panel: 'rgba(28, 28, 32, 0.45)',
          panelHover: 'rgba(40, 40, 46, 0.55)',
          border: 'rgba(255, 255, 255, 0.08)',
          borderHover: 'rgba(255, 255, 255, 0.15)',
          text: 'rgba(255, 255, 255, 0.9)',
          textMuted: 'rgba(255, 255, 255, 0.4)',
          textDim: 'rgba(255, 255, 255, 0.2)',
          accent: 'hsl(215, 90%, 68%)',
          accentMuted: 'hsla(215, 90%, 68%, 0.15)',
          user: 'rgba(55, 115, 220, 0.65)',
          userText: 'rgba(255, 255, 255, 0.95)',
          assistant: 'rgba(255, 255, 255, 0.05)',
          assistantBorder: 'rgba(255, 255, 255, 0.08)',
          hairline: 'rgba(255, 255, 255, 0.06)',
          session: 'rgba(255, 255, 255, 0.04)',
          sessionHover: 'rgba(255, 255, 255, 0.07)',
          pill: 'rgba(35, 35, 40, 0.7)',
          pillBorder: 'rgba(255, 255, 255, 0.1)',
          pillFocus: 'rgba(55, 115, 220, 0.4)',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        'pill': '9999px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        'micro': '0 2px 8px rgba(0, 0, 0, 0.25)',
        'pill': '0 4px 24px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'pill-focus': '0 4px 24px rgba(55, 115, 220, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        'bubble': '0 2px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      },
      animation: {
        'spring-in': 'springIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        springIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      spacing: {
        'island': '20px',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
