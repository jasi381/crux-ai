import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 2026 "Neural" Palette
        primary: {
          DEFAULT: '#6366F1', // Electric Indigo
          neural: '#818CF8',
          glow: 'rgba(99, 102, 241, 0.5)',
        },
        secondary: {
          DEFAULT: '#2DD4BF', // Neural Teal
          neural: '#5EEAD4',
          glow: 'rgba(45, 212, 191, 0.4)',
        },
        accent: {
          DEFAULT: '#F43F5E', // Cyber Rose
          neural: '#FB7185',
        },
        background: '#07070B',
        surface: {
          DEFAULT: '#11111A',
          glass: 'rgba(255, 255, 255, 0.03)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#94A3B8',
          dim: '#475569',
        },
      },
      animation: {
        'neural-pulse': 'neural-pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'squish': 'squish 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        'float-slow': 'float 8s ease-in-out infinite',
      },
      keyframes: {
        'neural-pulse': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.05)' },
        },
        'squish': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
