'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRightIcon, ShieldCheckIcon, ChartBarIcon, ArrowTrendingUpIcon, SparklesIcon, RocketLaunchIcon, HomeIcon, EyeIcon, BoltIcon, CpuChipIcon, StarIcon, UserGroupIcon, BeakerIcon, MapIcon, CalendarIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { motion, Variants, useReducedMotion, AnimatePresence } from 'framer-motion';
import Header from '../../components/header';
import Footer from '../../components/footer';

const About = () => {
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setIsClient(true);
    
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Disable all animations on mobile
  const noAnimation = shouldReduceMotion || isMobile;

  // Animation variants - disabled on mobile
  const fadeInUp: Variants = {
    hidden: { opacity: noAnimation ? 1 : 0, y: noAnimation ? 0 : 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: noAnimation ? 0 : 0.4, 
        ease: [0.4, 0, 0.2, 1] 
      }
    }
  };

  const fadeInLeft: Variants = {
    hidden: { opacity: noAnimation ? 1 : 0, x: noAnimation ? 0 : -30 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { 
        duration: noAnimation ? 0 : 0.4, 
        ease: [0.4, 0, 0.2, 1] 
      }
    }
  };

  const fadeInRight: Variants = {
    hidden: { opacity: noAnimation ? 1 : 0, x: noAnimation ? 0 : 30 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { 
        duration: noAnimation ? 0 : 0.4, 
        ease: [0.4, 0, 0.2, 1] 
      }
    }
  };

  const staggerContainer: Variants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: noAnimation ? 0 : 0.1,
        delayChildren: noAnimation ? 0 : 0.1
      }
    }
  };

  const snapIn: Variants = {
    hidden: { opacity: noAnimation ? 1 : 0, scale: noAnimation ? 1 : 0.8, y: noAnimation ? 0 : 20 },
    visible: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: noAnimation ? { duration: 0 } : { 
        duration: 0.35, 
        ease: [0.34, 1.56, 0.64, 1],
        type: "spring",
        damping: 20,
        stiffness: 300
      }
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        {/* Excel Grid Background */}
        <div className="fixed inset-0 opacity-10 pointer-events-none">
          <div 
            className="w-full h-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, #22c55e 1px, transparent 1px),
                linear-gradient(to bottom, #22c55e 1px, transparent 1px)
              `,
              backgroundSize: '40px 30px'
            }}
          />
        </div>
        <div className="text-center relative z-10">
          <div className="w-16 h-16 bg-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">Q</span>
          </div>
          <p className="text-gray-600">Loading about Quix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 relative">
      {/* Excel Grid Background */}
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div 
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, #22c55e 1px, transparent 1px),
              linear-gradient(to bottom, #22c55e 1px, transparent 1px)
            `,
            backgroundSize: '40px 30px'
          }}
        />
      </div>
      
      <Header />
      
      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 pt-6 sm:pt-8 lg:pt-12 pb-12 sm:pb-16 lg:pb-20 lg:px-8 overflow-hidden">
        {/* Background decorations - Disabled on mobile */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            animate={noAnimation ? {} : { rotate: 360 }}
            transition={noAnimation ? {} : { 
              duration: 20, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute top-1/4 left-1/4 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 bg-green-200/30 rounded-full blur-3xl"
          />
          <motion.div 
            animate={noAnimation ? {} : { rotate: -360 }}
            transition={noAnimation ? {} : { 
              duration: 25, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute bottom-1/4 right-1/4 w-48 sm:w-72 lg:w-96 h-48 sm:h-72 lg:h-96 bg-green-300/20 rounded-full blur-3xl"
          />
        </div>

        <div className="mx-auto max-w-6xl relative z-10">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="text-center"
          >
            <motion.div 
              variants={snapIn}
              className="flex items-center justify-center mb-2 sm:mb-3 lg:mb-4 mt-2 sm:mt-3 lg:mt-4"
            >
              <Image 
                src="/Quix/Quix text (logo).png" 
                alt="Quix Logo" 
                width={600} 
                height={200}
                className="h-32 sm:h-40 md:h-48 lg:h-56 xl:h-64 w-auto"
                priority
              />
            </motion.div>
            
            <motion.h1 
              variants={fadeInUp}
              className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight text-black mb-5 sm:mb-7 leading-tight"
            >
              About <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-700">Quix</span>
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-base sm:text-lg lg:text-xl text-gray-700 mb-7 sm:mb-9 max-w-3xl mx-auto leading-relaxed px-2"
            >
              We&apos;re making MTD compliance simple, seamless, and stress-free. Your spreadsheets deserve better than manual submission.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="py-16 sm:py-24 lg:py-32 bg-white/80 backdrop-blur-sm relative">
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-5">
          <div 
            className="w-full h-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, #22c55e 1px, transparent 1px),
                linear-gradient(to bottom, #22c55e 1px, transparent 1px)
              `,
              backgroundSize: '60px 45px'
            }}
          />
        </div>
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            className="text-center mb-12 sm:mb-16 lg:mb-20"
          >
            <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-green-600 mb-3 sm:mb-4">Our Mission</h2>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-6 sm:mb-8 leading-tight">
              Compliance that works for you
            </h3>
            <div className="max-w-4xl mx-auto space-y-6 text-base sm:text-lg lg:text-xl text-gray-700 leading-relaxed px-2">
              <p>
                Traditional MTD compliance is broken. It&apos;s complex, disruptive, and forces you to abandon workflows you&apos;ve perfected over years. Most solutions expect you to learn new systems.
              </p>
              <p>
                We&apos;re different. Quix bridges your existing Excel processes to HMRC&apos;s digital requirements—no training, no migration, no workflow disruption.
              </p>
              <p className="font-semibold text-green-600">
                Keep your spreadsheets. Stay compliant. Work the way you always have. That&apos;s the Quix difference.
              </p>
            </div>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8"
          >
            <motion.div 
              variants={snapIn}
              whileHover={noAnimation ? {} : { y: -12, scale: 1.03 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="group relative bg-white rounded-3xl p-6 sm:p-8 shadow-xl hover:shadow-2xl border border-green-100/50 text-center"
            >
              <motion.div 
                whileHover={noAnimation ? {} : { rotate: 15, scale: 1.1 }}
                transition={{ duration: 0.3 }}
                className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-green-600 mb-4 sm:mb-6 shadow-lg group-hover:shadow-green-600/50"
              >
                <ArrowTrendingUpIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </motion.div>
              <h4 className="text-xl sm:text-2xl font-bold text-black mb-3 sm:mb-4">
                Workflow-Optimized
              </h4>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                Built around your existing Excel processes, not generic MTD requirements.
              </p>
            </motion.div>
            
            <motion.div 
              variants={snapIn}
              whileHover={noAnimation ? {} : { y: -12, scale: 1.03 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="group relative bg-white rounded-3xl p-6 sm:p-8 shadow-xl hover:shadow-2xl border border-green-100/50 text-center"
            >
              <motion.div 
                whileHover={noAnimation ? {} : { rotate: 15, scale: 1.1 }}
                transition={{ duration: 0.3 }}
                className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-green-600 mb-4 sm:mb-6 shadow-lg group-hover:shadow-green-600/50"
              >
                <CpuChipIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </motion.div>
              <h4 className="text-xl sm:text-2xl font-bold text-black mb-3 sm:mb-4">
                Bridge-Powered
              </h4>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                Seamless connection between your spreadsheets and HMRC systems.
              </p>
            </motion.div>
            
            <motion.div 
              variants={snapIn}
              whileHover={noAnimation ? {} : { y: -12, scale: 1.03 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="group relative bg-white rounded-3xl p-6 sm:p-8 shadow-xl hover:shadow-2xl border border-green-100/50 text-center"
            >
              <motion.div 
                whileHover={noAnimation ? {} : { rotate: 15, scale: 1.1 }}
                transition={{ duration: 0.3 }}
                className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-green-600 mb-4 sm:mb-6 shadow-lg group-hover:shadow-green-600/50"
              >
                <SparklesIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </motion.div>
              <h4 className="text-xl sm:text-2xl font-bold text-black mb-3 sm:mb-4">
                Zero Disruption
              </h4>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                Keep your Excel templates. Keep your formulas. Just add compliance.
              </p>
            </motion.div>
            
            <motion.div 
              variants={snapIn}
              whileHover={noAnimation ? {} : { y: -12, scale: 1.03 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="group relative bg-white rounded-3xl p-6 sm:p-8 shadow-xl hover:shadow-2xl border border-green-100/50 text-center"
            >
              <motion.div 
                whileHover={noAnimation ? {} : { rotate: 15, scale: 1.1 }}
                transition={{ duration: 0.3 }}
                className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-green-600 mb-4 sm:mb-6 shadow-lg group-hover:shadow-green-600/50"
              >
                <EyeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </motion.div>
              <h4 className="text-xl sm:text-2xl font-bold text-black mb-3 sm:mb-4">
                Transparent
              </h4>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                See exactly how your data flows to HMRC. No black boxes. No surprises.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Our Founders */}
      <section className="py-16 sm:py-24 lg:py-32 bg-green-50 relative">
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-5">
          <div 
            className="w-full h-full"
            style={{
              backgroundImage: `
                linear-gradient(to right, #22c55e 1px, transparent 1px),
                linear-gradient(to bottom, #22c55e 1px, transparent 1px)
              `,
              backgroundSize: '60px 45px'
            }}
          />
        </div>
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            className="text-center mb-12 sm:mb-16 lg:mb-20"
          >
            <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-green-600 mb-3 sm:mb-4">Our Founders</h2>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-6 sm:mb-8 leading-tight">
              Built by people who get it
            </h3>
            <p className="text-base sm:text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto px-2">
              We&apos;re not MTD consultants. We&apos;re builders who saw a compliance problem and decided to bridge the gap.
            </p>
          </motion.div>
          
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 lg:gap-12 mb-12 sm:mb-16"
          >
            <motion.a
              href="https://www.linkedin.com/in/tommy-rowe-3a720b338"
              target="_blank"
              rel="noopener noreferrer"
              variants={snapIn}
              whileHover={noAnimation ? {} : { y: -12, scale: 1.03 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="group relative bg-white rounded-3xl p-6 sm:p-8 shadow-xl hover:shadow-2xl border border-green-100/50 text-center cursor-pointer block"
            >
              <motion.div 
                whileHover={noAnimation ? {} : { rotate: 15, scale: 1.1 }}
                transition={{ duration: 0.3 }}
                className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-green-600 mb-4 sm:mb-6 shadow-lg group-hover:shadow-green-600/50"
              >
                <span className="text-white font-bold text-xl sm:text-2xl">TR</span>
              </motion.div>
              <h4 className="text-xl sm:text-2xl font-bold text-black mb-2">
                Tommy Rowe
              </h4>
              <p className="text-green-600 font-semibold mb-3 sm:mb-4">The Builder</p>
              <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                Engineer, and student. Tommy leads the company vision while writing the code that makes it happen. He built Quix with the belief that preparing for MTD compliance shouldn&apos;t disrupt the workflows businesses already use.
              </p>
            </motion.a>
            
            <motion.a
              href="https://www.linkedin.com/in/chris-thomson-552024382"
              target="_blank"
              rel="noopener noreferrer"
              variants={snapIn}
              whileHover={noAnimation ? {} : { y: -12, scale: 1.03 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="group relative bg-white rounded-3xl p-6 sm:p-8 shadow-xl hover:shadow-2xl border border-green-100/50 text-center cursor-pointer block"
            >
              <motion.div 
                whileHover={noAnimation ? {} : { rotate: 15, scale: 1.1 }}
                transition={{ duration: 0.3 }}
                className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-green-600 mb-4 sm:mb-6 shadow-lg group-hover:shadow-green-600/50"
              >
                <span className="text-white font-bold text-xl sm:text-2xl">CT</span>
              </motion.div>
              <h4 className="text-xl sm:text-2xl font-bold text-black mb-2">
                Chris Thomson
              </h4>
              <p className="text-green-600 font-semibold mb-3 sm:mb-4">The Strategist</p>
              <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                Chris is on a mission to get Quix to the businesses that need it most. He shapes our strategy, forges key partnerships, and powers our journey from ambitious startup to the MTD bridge everyone relies on.
              </p>
            </motion.a>
            
            <motion.div
              variants={snapIn}
              whileHover={noAnimation ? {} : { y: -12, scale: 1.03 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="group relative bg-white rounded-3xl p-6 sm:p-8 shadow-xl hover:shadow-2xl border border-green-100/50 text-center"
            >
              <motion.div 
                whileHover={noAnimation ? {} : { rotate: 15, scale: 1.1 }}
                transition={{ duration: 0.3 }}
                className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-green-600 mb-4 sm:mb-6 shadow-lg group-hover:shadow-green-600/50"
              >
                <span className="text-white font-bold text-xl sm:text-2xl">FP</span>
              </motion.div>
              <h4 className="text-xl sm:text-2xl font-bold text-black mb-2">
                Finn Perkins
              </h4>
              <p className="text-green-600 font-semibold mb-3 sm:mb-4">The Engineer</p>
              <p className="text-gray-700 leading-relaxed text-sm sm:text-base">
                Builds the technical infrastructure that makes the magic happen. Finn architects the systems that seamlessly connect your spreadsheets to HMRC, ensuring reliability, security, and performance at scale.
              </p>
            </motion.div>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            className="text-center"
          >
            <h4 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">What drives us:</h4>
            <p className="text-base sm:text-lg lg:text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed px-2">
              We believe every business deserves to work the way they want while staying compliant. Your Excel expertise should be an asset, not a liability in the digital age.
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;