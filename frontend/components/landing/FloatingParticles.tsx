import React, { useEffect, useRef } from 'react';

const FloatingParticles = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const createParticle = () => {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 20 + 's';
      particle.style.animationDuration = (Math.random() * 10 + 15) + 's';
      
      container.appendChild(particle);

      setTimeout(() => {
        if (container.contains(particle)) {
          container.removeChild(particle);
        }
      }, 25000);
    };

    const interval = setInterval(createParticle, 2000);
    
    // Create initial particles
    for (let i = 0; i < 5; i++) {
      setTimeout(createParticle, i * 1000);
    }

    return () => {
      clearInterval(interval);
    };
  }, []);

  return <div ref={containerRef} className="particles" />;
};

export default FloatingParticles;
