/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
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
  plugins: [],
};
