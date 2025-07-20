import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Brain, Sparkles } from 'lucide-react';
import FloatingParticles from './FloatingParticles';

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <FloatingParticles />
      
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl"
          animate={{
            x: [0, -80, 0],
            y: [0, 60, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="container mx-auto px-6 text-center relative z-10">
        {/* Floating 3D Logo */}
        <motion.div
          className="mb-8 flex justify-center"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <div className="relative">
            <motion.div
              className="w-24 h-24 bg-gradient-to-r from-teal-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-2xl"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Brain className="w-12 h-12 text-white" />
            </motion.div>
            <motion.div
              className="absolute -top-2 -right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-3 h-3 text-white" />
            </motion.div>
          </div>
        </motion.div>

        {/* Main Headlines */}
        <motion.h1
          className="text-6xl md:text-8xl font-bold mb-6 leading-tight"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
        >
          <span className="bg-gradient-to-r from-teal-400 to-purple-500 bg-clip-text text-transparent block">The Future of</span>
          <span className="text-gray-900 dark:text-white block">Learning is</span>
          <span className="bg-gradient-to-r from-purple-500 to-teal-400 bg-clip-text text-transparent block">Here</span>
        </motion.h1>

        <motion.p
          className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
        >
          AI-Powered STEM Tutor That Adapts to Your Emotions
          <br />
          <span className="text-lg opacity-80">Experience personalized learning that understands how you feel</span>
        </motion.p>

        {/* CTA Button */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
        >
          <Link href="/login">
            <button className="group bg-gradient-to-r from-teal-400 to-teal-500 text-white px-12 py-6 rounded-2xl text-xl font-semibold shadow-2xl hover:shadow-teal-400/50 transition-all duration-500 relative overflow-hidden hover:scale-105">
              <span className="relative z-10 flex items-center gap-3">
                Start Learning Now
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-teal-300 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </button>
          </Link>
        </motion.div>

        {/* Floating Dashboard Preview */}
        <motion.div
          className="relative max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
        >
          <div className="bg-white/10 dark:bg-gray-800/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20 dark:border-white/10">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl h-80 flex items-center justify-center relative overflow-hidden">
              {/* Dashboard mockup content */}
              <div className="text-center">
                <div className="w-32 h-32 bg-gradient-to-r from-teal-400/20 to-purple-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Brain className="w-16 h-16 text-teal-400 animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">AI Learning Dashboard</h3>
                <p className="text-gray-600 dark:text-gray-300">Your personalized learning experience</p>
              </div>
              
              {/* Floating UI elements */}
              <motion.div
                className="absolute top-4 right-4 bg-white/10 backdrop-blur-lg rounded-xl p-3"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="w-3 h-3 bg-teal-400 rounded-full animate-pulse" />
              </motion.div>
              
              <motion.div
                className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-lg rounded-xl px-4 py-2"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">98% accuracy</span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
