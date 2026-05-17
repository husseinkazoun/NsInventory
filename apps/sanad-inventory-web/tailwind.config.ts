import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ns-navy':        '#0B1A33',
        'ns-navy-soft':   '#1E2A4A',
        'ns-blue':        '#1a72e8',
        'ns-blue-tint':   '#E8F0FE',
        'ns-border-soft': '#E5E7EB',
        'ns-cyan':        '#00D4F5',
        'ns-cyan-light':  '#7AE8F8',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      boxShadow: {
        'ns-card':       '0 1px 2px rgba(15,23,42,.04), 0 4px 12px -4px rgba(15,23,42,.08)',
        'ns-card-elev':  '0 2px 6px rgba(15,23,42,.04), 0 18px 40px -8px rgba(15,23,42,.18)',
        'ns-stat':       '0 1px 2px rgba(15,23,42,.04), 0 6px 16px -4px rgba(15,23,42,.10)',
        'ns-stat-hover': '0 2px 4px rgba(15,23,42,.06), 0 12px 24px -6px rgba(15,23,42,.14)',
      },
    },
  },
  plugins: [],
} satisfies Config
