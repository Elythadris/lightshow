import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['ui-sans-serif', 'system-ui', 'Inter', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: '#05060a',
        haze: 'rgba(255,255,255,0.06)',
        line: 'rgba(255,255,255,0.09)',
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
export default config;
