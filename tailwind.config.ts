import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1d284d',
          dark: '#141a35',
        },
        accent: {
          DEFAULT: '#9b0a00',
          dark: '#7a0800',
        },
      },
    },
  },
  plugins: [],
};

export default config;
