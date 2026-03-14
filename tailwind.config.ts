import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink950: '#0A0A0F',
        cyan400: '#22D3EE',
        violet400: '#A78BFA',
        emerald400: '#34D399',
        coral400: '#FB7185',
        rose400: '#F43F5E',
      },
    },
  },
  plugins: [],
};
export default config;
