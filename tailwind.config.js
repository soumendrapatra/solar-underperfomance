/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: '#F3F0E8',
        'paper-2': '#EAE6DB',
        ink: '#16150F',
        'ink-2': '#4A473D',
        line: '#D6D1C4',
        accent: '#D9790B',
        fault: '#B4441E',
        warn: '#B98A12',
        ok: '#4F6B2A',
        info: '#2F5D7C',
        console: {
          bg: '#121210',
          panel: '#1A1A17',
          line: '#2C2B26',
          text: '#E9E6DC',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '3px',
        sm: '2px',
        md: '3px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
        '3xl': '4px',
        full: '9999px',
      },
      boxShadow: {
        DEFAULT: 'none',
        sm: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
        '2xl': 'none',
        inner: 'none',
      },
    },
  },
  plugins: [],
}

