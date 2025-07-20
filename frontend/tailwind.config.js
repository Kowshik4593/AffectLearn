/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'Inter', 'sans-serif'],
      },
      colors: {
        // Light mode palette
        navy: '#0A0E27',
        'electric-blue': '#00D4FF',
        'neon-green': '#00FF88',
        'purple-start': '#6366F1',
        'purple-end': '#8B5CF6',
        'bg-light': '#FAFBFF',
        
        // Dark mode palette
        'deep-space': '#0A0A0A',
        'neon-orange': '#FF6B6B',
        
        // Enhanced color scales - extend defaults instead of override
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#00D4FF', // custom electric blue
          500: '#00B8D4',
          600: '#0091A3',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        purple: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#8B5CF6', // custom purple
          600: '#7C3AED',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        gray: {
          50: '#FAFBFF', // custom light background
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1a202c', // custom dark
          900: '#0A0A0A', // custom deep space
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'liquid': 'liquid 8s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'pulse-glow': 'pulse-glow 6s ease-in-out infinite',
        'particle-float': 'particle-float 20s linear infinite',
        'grid-shift': 'grid-shift 20s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(0, 212, 255, 0.8)' },
        },
        liquid: {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '50%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
        },
        'pulse-glow': {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(0, 212, 255, 0.4)',
            transform: 'scale(1)'
          },
          '50%': { 
            boxShadow: '0 0 40px rgba(0, 212, 255, 0.8)',
            transform: 'scale(1.02)'
          },
        },
        'particle-float': {
          '0%': {
            transform: 'translateY(100vh) rotate(0deg)',
            opacity: '0',
          },
          '10%': {
            opacity: '1',
          },
          '90%': {
            opacity: '1',
          },
          '100%': {
            transform: 'translateY(-100vh) rotate(360deg)',
            opacity: '0',
          },
        },
        'grid-shift': {
          '0%': { 
            backgroundPosition: '0% 0%' 
          },
          '100%': { 
            backgroundPosition: '100% 100%' 
          },
        },
      },
      backdropBlur: {
        'xs': '2px',
        'xl': '24px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
