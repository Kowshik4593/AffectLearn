'use client'

import React, { useEffect, useRef } from 'react';

interface CSSParticlesProps {
  darkMode?: boolean;
}

const CSSParticles: React.FC<CSSParticlesProps> = ({ darkMode = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const createParticle = () => {
      const particle = document.createElement('div');
      particle.className = 'css-particle';
      
      // Random starting position
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 25 + 's';
      particle.style.animationDuration = (Math.random() * 20 + 25) + 's';
      
      // Colors based on theme
      const colors = darkMode 
        ? [
            'rgba(0, 255, 136, 0.8)', 
            'rgba(0, 212, 255, 0.7)', 
            'rgba(139, 92, 246, 0.8)',
            'rgba(255, 107, 107, 0.6)'
          ]
        : [
            'rgba(0, 212, 255, 0.6)', 
            'rgba(0, 255, 136, 0.5)', 
            'rgba(99, 102, 241, 0.6)',
            'rgba(139, 92, 246, 0.5)'
          ];
      
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      
      // Variable sizes
      const size = Math.random() * 4 + 2;
      particle.style.width = size + 'px';
      particle.style.height = size + 'px';
      
      // Add glow effect
      particle.style.boxShadow = `0 0 ${size * 2}px ${colors[Math.floor(Math.random() * colors.length)]}`;
      
      container.appendChild(particle);

      // Remove particle after animation
      setTimeout(() => {
        if (container.contains(particle)) {
          container.removeChild(particle);
        }
      }, 45000);
    };

    const interval = setInterval(createParticle, 1000);
    
    // Create initial particles
    for (let i = 0; i < 5; i++) {
      setTimeout(createParticle, i * 300);
    }

    return () => {
      clearInterval(interval);
    };
  }, [darkMode]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {/* CSS-only animated particles */}
      <div className="css-particles-container">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className={`css-particle-static ${darkMode ? 'dark-particle' : 'light-particle'}`}
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default CSSParticles;
