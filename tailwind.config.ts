import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Red Matrix Hacker Theme
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        matrix: {
          red: '#ff0000',
          darkred: '#cc0000',
          blood: '#8b0000',
          crimson: '#dc143c',
          black: '#0a0a0a',
          darkgray: '#1a1a1a',
          gray: '#2a2a2a',
        },
        terminal: {
          bg: '#000000',
          text: '#ff0000',
          prompt: '#ff3333',
          cursor: '#ff6666',
          green: '#00ff00',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['JetBrains Mono', 'monospace'],
        display: ['JetBrains Mono', 'monospace'],
        body: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-red': 'pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-line': 'scan-line 8s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'terminal-blink': 'terminal-blink 1s step-end infinite',
        'glitch': 'glitch 0.3s infinite',
      },
      keyframes: {
        'pulse-red': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'terminal-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'glitch': {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
          '100%': { transform: 'translate(0)' },
        },
      },
      boxShadow: {
        'glow-red': '0 0 10px rgba(255, 0, 0, 0.5), 0 0 20px rgba(255, 0, 0, 0.3)',
        'glow-red-lg': '0 0 20px rgba(255, 0, 0, 0.6), 0 0 40px rgba(255, 0, 0, 0.4)',
        'inner-red': 'inset 0 0 20px rgba(255, 0, 0, 0.2)',
      },
      textShadow: {
        'glow-red': '0 0 10px rgba(255, 0, 0, 0.8), 0 0 20px rgba(255, 0, 0, 0.5)',
      },
    },
  },
  plugins: [
    // Text shadow plugin
    function({ addUtilities }: any) {
      const newUtilities = {
        '.text-glow-red': {
          textShadow: '0 0 10px rgba(255, 0, 0, 0.8), 0 0 20px rgba(255, 0, 0, 0.5)',
        },
        '.text-glow-red-sm': {
          textShadow: '0 0 5px rgba(255, 0, 0, 0.6)',
        },
        '.text-glow-red-lg': {
          textShadow: '0 0 15px rgba(255, 0, 0, 1), 0 0 30px rgba(255, 0, 0, 0.7)',
        },
      }
      addUtilities(newUtilities)
    },
  ],
};

export default config;

