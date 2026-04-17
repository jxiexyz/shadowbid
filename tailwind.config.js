/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        shadow: {
          bg: '#080808',
          surface: '#0f0f0f',
          card: '#131313',
          border: 'rgba(255,255,255,0.07)',
          'border-hover': 'rgba(255,255,255,0.14)',
          accent: '#c8ff00',
          'accent-dim': 'rgba(200,255,0,0.10)',
          'accent-glow': 'rgba(200,255,0,0.35)',
          muted: 'rgba(255,255,255,0.38)',
          subtle: 'rgba(255,255,255,0.05)',
          live: '#00e676',
          'live-dim': 'rgba(0,230,118,0.12)',
          danger: '#ff4d4d',
          'danger-dim': 'rgba(255,77,77,0.10)',
          'glass-low': 'rgba(255,255,255,0.025)',
          'glass-mid': 'rgba(255,255,255,0.05)',
          'glass-high': 'rgba(255,255,255,0.09)',
          warm: 'rgba(255,220,100,0.06)',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-border': 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))',
        'accent-glow': 'radial-gradient(ellipse at center, rgba(200,255,0,0.18) 0%, transparent 70%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        pulse_live: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.82)' },
        },
        pulse_ring: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        glow_sweep: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        float_up: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        reveal: {
          '0%': { clipPath: 'inset(0 100% 0 0)' },
          '100%': { clipPath: 'inset(0 0% 0 0)' },
        },
        scale_in: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        pulse_live: 'pulse_live 2.2s ease-in-out infinite',
        pulse_ring: 'pulse_ring 2.2s ease-out infinite',
        float_up: 'float_up 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        scale_in: 'scale_in 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
        shimmer: 'shimmer 2s infinite linear',
        glow_sweep: 'glow_sweep 3s ease infinite',
      },
      boxShadow: {
        'glass': '0 2px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-hover': '0 6px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.10)',
        'accent': '0 0 24px rgba(200,255,0,0.28), 0 0 64px rgba(200,255,0,0.08)',
        'accent-sm': '0 0 12px rgba(200,255,0,0.18)',
        'live': '0 0 10px rgba(0,230,118,0.35)',
        'inner-top': 'inset 0 1px 0 rgba(255,255,255,0.08)',
        'card': '0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3)',
        'card-hover': '0 2px 6px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
