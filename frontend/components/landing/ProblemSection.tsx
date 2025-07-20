import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BookOpen, Brain } from 'lucide-react';

const ProblemSection = () => {
  return (
    <section className="min-h-[60vh] py-20 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: 3D Frustrated Student Animation */}
          <motion.div
            className="text-center lg:text-left"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <div className="relative">
              {/* Main frustrated student illustration */}
              <motion.div
                className="w-80 h-80 mx-auto lg:mx-0 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 rounded-full flex items-center justify-center relative overflow-hidden"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <BookOpen className="w-32 h-32 text-red-500 dark:text-red-400" />
                
                {/* Floating stress indicators */}
                <motion.div
                  className="absolute top-8 right-8 flex items-center gap-2"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <AlertTriangle className="w-6 h-6 text-orange-500" />
                  <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">Stress</span>
                </motion.div>
                
                <motion.div
                  className="absolute bottom-8 left-8 flex items-center gap-2"
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                >
                  <Brain className="w-6 h-6 text-blue-500" />
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">Confusion</span>
                </motion.div>
              </motion.div>
              
              {/* Floating problem bubbles */}
              <motion.div
                className="absolute -top-4 -left-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg"
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 5, repeat: Infinity }}
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">No personalization</span>
              </motion.div>
              
              <motion.div
                className="absolute -bottom-4 -right-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg"
                animate={{ y: [0, 15, 0] }}
                transition={{ duration: 6, repeat: Infinity, delay: 2 }}
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">One-size-fits-all</span>
              </motion.div>
            </div>
          </motion.div>

          {/* Right: Problem Description */}
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <motion.h2
              className="text-5xl md:text-6xl font-bold leading-tight"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <span className="text-red-500 dark:text-red-400 block">Students Are</span>
              <span className="text-gray-900 dark:text-white block">Struggling</span>
            </motion.h2>

            <motion.div
              className="space-y-6 text-lg text-gray-600 dark:text-gray-300"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-3 flex-shrink-0" />
                <p>Traditional learning ignores emotional states, leading to frustration and burnout</p>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-3 flex-shrink-0" />
                <p>One-size-fits-all education fails to adapt to individual learning needs</p>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-3 flex-shrink-0" />
                <p>Students give up when they don't get the support they need at the right moment</p>
              </div>
            </motion.div>

            <motion.div
              className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 border-l-4 border-red-500"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              viewport={{ once: true }}
            >
              <p className="text-lg font-medium text-red-800 dark:text-red-300">
                "I feel overwhelmed and don't know where to start. The material doesn't make sense, and I'm falling behind."
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">- Typical student experience</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
