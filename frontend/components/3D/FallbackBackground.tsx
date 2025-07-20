'use client'

import React from 'react'

interface SpectacularBackgroundProps {
  darkMode?: boolean
}

const SpectacularBackground: React.FC<SpectacularBackgroundProps> = ({ darkMode = false }) => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Multi-layer animated gradient background */}
      <div className={`absolute inset-0 ${
        darkMode 
          ? 'bg-gradient-to-br from-gray-900 via-purple-900/30 to-blue-900/30' 
          : 'bg-gradient-to-br from-blue-50 via-purple-50/70 to-cyan-50/70'
      }`} />
      
      {/* Secondary animated layer */}
      <div className={`absolute inset-0 liquid-bg opacity-40 ${
        darkMode ? 'mix-blend-overlay' : 'mix-blend-soft-light'
      }`} />
      
      {/* Floating geometric shapes */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`absolute ${
              darkMode 
                ? 'bg-gradient-to-br from-purple-500/20 to-blue-500/20' 
                : 'bg-gradient-to-br from-purple-300/30 to-blue-300/30'
            } animate-float backdrop-blur-sm`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${15 + Math.random() * 50}px`,
              height: `${15 + Math.random() * 50}px`,
              borderRadius: Math.random() > 0.5 ? '50%' : '20%',
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${12 + Math.random() * 8}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        ))}
      </div>
      
      {/* Neural network pattern overlay */}
      <div className={`absolute inset-0 opacity-20 ${
        darkMode ? 'text-purple-400' : 'text-blue-600'
      }`} style={{
        backgroundImage: `
          radial-gradient(circle at 20% 50%, currentColor 2px, transparent 2px),
          radial-gradient(circle at 80% 50%, currentColor 2px, transparent 2px),
          radial-gradient(circle at 40% 20%, currentColor 1px, transparent 1px),
          radial-gradient(circle at 60% 80%, currentColor 1px, transparent 1px),
          linear-gradient(90deg, transparent 48%, currentColor 50%, transparent 52%),
          linear-gradient(180deg, transparent 48%, currentColor 50%, transparent 52%)
        `,
        backgroundSize: '100px 100px, 100px 100px, 60px 60px, 60px 60px, 100px 2px, 2px 100px'
      }} />
      
      {/* Animated light rays */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className={`absolute ${
              darkMode 
                ? 'bg-gradient-to-r from-transparent via-purple-500/15 to-transparent' 
                : 'bg-gradient-to-r from-transparent via-blue-400/25 to-transparent'
            }`}
            style={{
              left: `${-20 + Math.random() * 140}%`,
              top: `${Math.random() * 100}%`,
              width: '300px',
              height: '1px',
              transform: `rotate(${Math.random() * 360}deg)`,
              animation: `shimmer ${6 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>
      
      {/* Pulsing ambient orbs */}
      <div className="absolute inset-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${
              darkMode 
                ? 'bg-gradient-radial from-purple-500/30 to-transparent' 
                : 'bg-gradient-radial from-blue-400/40 to-transparent'
            } animate-pulse-glow`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${100 + Math.random() * 200}px`,
              height: `${100 + Math.random() * 200}px`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${8 + Math.random() * 4}s`,
              filter: 'blur(40px)',
            }}
          />
        ))}
      </div>
      
      {/* Particle stream */}
      <div className="absolute inset-0">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className={`absolute w-1 h-1 rounded-full ${
              darkMode ? 'bg-purple-400' : 'bg-blue-500'
            } animate-particle-float opacity-70`}
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>
      
      {/* Holographic grid overlay */}
      <div className={`absolute inset-0 opacity-5 ${
        darkMode ? 'text-cyan-400' : 'text-blue-500'
      }`} style={{
        backgroundImage: `
          linear-gradient(currentColor 1px, transparent 1px),
          linear-gradient(90deg, currentColor 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        animation: 'grid-shift 20s linear infinite'
      }} />
    </div>
  )
}

export default SpectacularBackground
