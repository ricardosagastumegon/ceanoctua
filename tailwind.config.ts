import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#077e84',
          d: '#055a5f',
          l: '#d0eced',
        },
        sand: {
          DEFAULT: '#e6dfbf',
          d: '#d4cba0',
          l: '#f5f2e8',
        },
        rust: {
          DEFAULT: '#bf4609',
          l: '#f7e6de',
        },
        dark: {
          DEFAULT: '#321201',
          2: '#5c3a20',
          3: '#9c7a5a',
        },
        gold: {
          DEFAULT: '#9e7a1a',
          light: '#f5f0d8',
        },
        blue: {
          DEFAULT: '#0b5c6e',
          light: '#ddeef1',
        },
        aqua: '#00b4c5',
        coral: '#e05c3a',
        green: '#2a6e24',
        purple: '#5a3472',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        heading: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: ['14px', '1.5'],
      },
      borderRadius: {
        card: '20px',
      },
      maxWidth: {
        shell: '1400px',
      },
    },
  },
  plugins: [],
};

export default config;
