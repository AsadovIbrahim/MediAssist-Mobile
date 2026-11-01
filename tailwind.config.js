const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['RedditSans'],
      },
      colors: {
        primary: { DEFAULT: '#1570EF', soft: '#E8F1FE' },
        ink: { DEFAULT: '#101828', muted: '#667085', light: '#98A2B3' },
        surface: '#FFFFFF',
        canvas: '#F7F8FA',
        field: '#F1F3F6',
        line: '#EEF0F3',
        danger: { DEFAULT: '#EF4444', soft: '#FDECEC' },
      },
    },
  },
  plugins: [
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.text-xs': { fontFamily: 'RedditSans' },
        '.text-sm': { fontFamily: 'RedditSans' },
        '.text-base': { fontFamily: 'RedditSans' },
        '.text-lg': { fontFamily: 'RedditSans' },
        '.text-xl': { fontFamily: 'RedditSans' },
        '.text-2xl': { fontFamily: 'RedditSans' },
        '.text-3xl': { fontFamily: 'RedditSans' },
        '.font-normal': { fontFamily: 'RedditSans', fontWeight: '400' },
        '.font-medium': { fontFamily: 'RedditSans', fontWeight: '500' },
        '.font-semibold': { fontFamily: 'RedditSans', fontWeight: '600' },
        '.font-bold': { fontFamily: 'RedditSans', fontWeight: '700' },
        '.font-extrabold': { fontFamily: 'RedditSans', fontWeight: '800' },
      });
    }),
  ],
};
