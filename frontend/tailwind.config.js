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
          950: '#090d16', // Deep institutional dark background
          900: '#0f172a', // Primary card surface (Slate 900)
          850: '#151e32', // Secondary elevated surface
          800: '#1e293b', // Standard enterprise border (Slate 800)
          750: '#283548', // Interactive border/hover
          700: '#334155', // Slate 700
          600: '#475569', // Slate 600
          accent: '#0284c7', // Enterprise Sky Blue
          success: '#10b981', // Emerald 500
          warning: '#f59e0b', // Amber 500
          danger: '#ef4444', // Rose/Red 500
          purple: '#6366f1' // Indigo 500
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif']
      }
    },
  },
  plugins: [],
}
