'use client'

import React from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import DarkModeToggle from '../components/landing/DarkModeToggle';
import HeroSection from '../components/landing/HeroSection';
import ProblemSection from '../components/landing/ProblemSection';
import SolutionSection from '../components/landing/SolutionSection';
import Footer from '../components/landing/Footer';

export default function HomePage() {
  const [darkMode, toggleDarkMode] = useDarkMode();

  return (
    <div className="min-h-screen transition-colors duration-700">
      {/* Dark Mode Toggle - Responsive positioning to avoid navbar collision */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50">
        <DarkModeToggle darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      </div>
      
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <Footer />
      </main>
    </div>
  );
}
