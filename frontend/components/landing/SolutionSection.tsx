import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Heart, Zap, Target } from 'lucide-react';

const SolutionSection = () => {
  const features = [
    {
      icon: Heart,
      title: "Emotion Recognition",
      description: "Advanced AI that understands your emotional state in real-time"
    },
    {
      icon: Brain,
      title: "Adaptive Learning",
      description: "Content that adjusts to your emotional needs and learning pace"
    },
    {
      icon: Zap,
      title: "Instant Response",
      description: "Immediate support when you need it most during learning"
    },
    {
      icon: Target,
      title: "Personalized Path",
      description: "Unique learning journey tailored to your emotional patterns"
    }
  ];

  return (
    <section className="min-h-[80vh] py-20 bg-gradient-to-br from-gray-50 to-purple-50 dark:from-gray-800 dark:to-purple-900/20 relative overflow-hidden">
      <div className="container mx-auto px-6 text-center relative z-10">
        {/* Section Header */}
        <motion.div
          className="mb-20"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-teal-400 to-purple-500 bg-clip-text text-transparent block">AI That Understands</span>
            <span className="text-gray-900 dark:text-white block">Your Emotions</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            AffectLearn revolutionizes education by combining cutting-edge emotion recognition 
            with adaptive learning algorithms to create a truly personalized experience.
          </p>
        </motion.div>

        {/* Central 3D Brain Visualization */}
        <motion.div
          className="mb-16 flex justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <div className="relative">
            <motion.div
              className="w-48 h-48 bg-gradient-to-r from-teal-400 to-purple-500 rounded-full flex items-center justify-center shadow-2xl"
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.05, 1]
              }}
              transition={{ 
                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
              }}
            >
              <Brain className="w-24 h-24 text-white" />
            </motion.div>
            
            {/* Floating emotion indicators */}
            <motion.div
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0 }}
            >
              <Heart className="w-4 h-4 text-white" />
            </motion.div>
            
            <motion.div
              className="absolute -bottom-2 -left-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
            >
              <Zap className="w-4 h-4 text-white" />
            </motion.div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-white/20 dark:border-gray-700/20 hover:shadow-xl transition-all duration-300"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 + 0.3 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <motion.div
                  className="w-16 h-16 bg-gradient-to-r from-teal-400 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-4"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, delay: index * 0.5 }}
                >
                  <Icon className="w-8 h-8 text-white" />
                </motion.div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="bg-gradient-to-r from-teal-400/10 to-purple-500/10 rounded-3xl p-8 border border-teal-400/20">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to Experience the Future of Learning?
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Join thousands of students who are already learning with emotional intelligence
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SolutionSection;
