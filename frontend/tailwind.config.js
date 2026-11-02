/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          950: '#070b14',
          900: '#0b1325',
          850: '#0f1b33',
          800: '#142343',
          700: '#1e335f',
          accent: '#06b6d4', // Cyan
          success: '#10b981', // Emerald
          warning: '#f59e0b', // Amber
          danger: '#ef4444', // Rose/Red
          purple: '#8b5cf6'
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace', 'ui-monospace'],
        sans: ['"Inter"', 'sans-serif', 'system-ui']
      }
    },
  },
  plugins: [],
}
