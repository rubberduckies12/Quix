'use client';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheckIcon, ChartBarIcon, ArrowTrendingUpIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { motion, Variants, useReducedMotion } from 'framer-motion';
import Header from '../../components/header';
import Footer from '../../components/footer';

const Home = () => {
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
        <div className="text-center">
          <div className="w-16 h-16 bg-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">Q</span>
          </div>
          <p className="text-gray-600">Loading your MTD solution...</p>
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
              Your spreadsheets,
              <br />
              <span className={`text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-700 ${!noAnimation ? 'animate-pulse' : ''}`}>
                MTD compliant
              </span>
            </motion.h1>
            
            <motion.div
              variants={fadeInUp}
              className="text-lg sm:text-xl lg:text-2xl text-gray-800 mb-4 sm:mb-5 max-w-4xl mx-auto leading-relaxed font-medium px-2"
            >
              <span className="text-green-600 font-bold">Keep</span> • 
              <span className="text-green-600 font-bold mx-2">Bridge</span>• 
              <span className="text-green-600 font-bold"> Comply</span>
            </motion.div>

            <motion.p 
              variants={fadeInUp}
              className="text-base sm:text-lg lg:text-xl text-gray-700 mb-7 sm:mb-9 max-w-3xl mx-auto leading-relaxed px-2"
            >
              Keep your Excel workflow. Bridge to HMRC seamlessly. Stay MTD compliant without changing how you work. Your familiar spreadsheets, now future-proofed.
            </motion.p>
            
            {/* Coming Soon Message */}
            <motion.div 
              variants={fadeInUp}
              className="flex flex-col items-center justify-center mb-8 sm:mb-10 px-2"
            >
              <Link href="/waitlist/joinWaitlist">
                <motion.div
                  animate={noAnimation ? {} : { scale: [1, 1.05, 1] }}
                  transition={noAnimation ? {} : { duration: 2, repeat: Infinity }}
                  className="inline-flex items-center rounded-2xl bg-green-600 hover:bg-green-700 px-5 sm:px-7 lg:px-9 py-3 sm:py-4 lg:py-5 text-sm sm:text-base lg:text-lg font-semibold text-white shadow-2xl mb-3 sm:mb-4 cursor-pointer transition-colors duration-200"
                >
                  <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mr-2 sm:mr-3" />
                  <span>Bridge the gap - Join our waitlist!</span>
                </motion.div>
              </Link>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg text-center">
                Making Tax Digital, Made Simple
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
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
      <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-green-600 mb-3 sm:mb-4">Why change your workflow?</h2>
      <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-6 sm:mb-8 leading-tight">
        MTD compliance without the headache
      </h3>
      <p className="text-base sm:text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto px-2">
        Quix bridges your existing Excel processes to HMRC&apos;s digital requirements. No learning curve, no workflow disruption.
      </p>
    </motion.div>
    
    <motion.div 
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={staggerContainer}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
    >
      <motion.div 
        variants={snapIn}
        whileHover={noAnimation ? {} : { y: -12, scale: 1.03 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="group relative bg-white rounded-3xl p-6 sm:p-8 shadow-xl hover:shadow-2xl border border-green-100/50 text-center md:col-span-2 lg:col-span-1"
      >
        <motion.div 
          whileHover={noAnimation ? {} : { rotate: 15, scale: 1.1 }}
          transition={{ duration: 0.3 }}
          className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-green-600 mb-4 sm:mb-6 shadow-lg group-hover:shadow-green-600/50"
        >
          <ArrowTrendingUpIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
        </motion.div>
        <h4 className="text-xl sm:text-2xl font-bold text-black mb-3 sm:mb-4">
          Keep
        </h4>
        <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
          Your existing Excel templates. Your familiar formulas. Your trusted workflow. Nothing changes except compliance status.
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
          <ChartBarIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
        </motion.div>
        <h4 className="text-xl sm:text-2xl font-bold text-black mb-3 sm:mb-4">
          Bridge
        </h4>
        <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
          Seamless connection between your spreadsheets and HMRC systems. Real-time data sync with zero manual intervention.
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
          <ShieldCheckIcon className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
        </motion.div>
        <h4 className="text-xl sm:text-2xl font-bold text-black mb-3 sm:mb-4">
          Comply
        </h4>
        <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
          Automatic MTD submissions. Error-free digital records. Complete audit trails. Stay compliant while staying productive.
        </p>
      </motion.div>
    </motion.div>
  </div>
</section>

  {/* How It Works */}
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
      <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-green-600 mb-3 sm:mb-4">Zero disruption process</h2>
      <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-6 sm:mb-8 leading-tight">
        From Excel to MTD in 3 clicks
      </h3>
      <p className="text-base sm:text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto px-2">
        No training required. No system migration. Just seamless integration with your existing workflow.
      </p>
    </motion.div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10 lg:gap-12">
      <motion.div 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeInLeft}
        whileHover={noAnimation ? {} : { scale: 1.05, y: -8 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="relative bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl border border-gray-100 group text-center md:col-span-2 lg:col-span-1"
      >
        <motion.div 
          whileHover={noAnimation ? {} : { scale: 1.2, rotate: 10 }}
          whileTap={noAnimation ? {} : { scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl bg-green-600 text-white font-bold text-lg sm:text-xl lg:text-2xl mb-6 sm:mb-8 shadow-lg group-hover:shadow-green-600/50 mx-auto"
        >
          1
        </motion.div>
        <h4 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">Connect your spreadsheet</h4>
        <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
          Point Quix to your existing Excel files. No data migration, no reformatting. 
          Takes 30 seconds.
        </p>
      </motion.div>
      
      <motion.div 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeInUp}
        whileHover={noAnimation ? {} : { scale: 1.05, y: -8 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1], delay: noAnimation ? 0 : 0.1 }}
        className="relative bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl border border-gray-100 group text-center"
      >
        <motion.div 
          whileHover={noAnimation ? {} : { scale: 1.2, rotate: 10 }}
          whileTap={noAnimation ? {} : { scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl bg-green-600 text-white font-bold text-lg sm:text-xl lg:text-2xl mb-6 sm:mb-8 shadow-lg group-hover:shadow-green-600/50 mx-auto"
        >
          2
        </motion.div>
        <h4 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">Auto-sync data</h4>
        <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
          Quix reads your Excel data and formats it for HMRC automatically. Real-time sync, error checking included.
        </p>
      </motion.div>
      
      <motion.div 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeInRight}
        whileHover={noAnimation ? {} : { scale: 1.05, y: -8 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1], delay: noAnimation ? 0 : 0.2 }}
        className="relative bg-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl border border-gray-100 group text-center md:col-span-2 lg:col-span-1"
      >
        <motion.div 
          whileHover={noAnimation ? {} : { scale: 1.2, rotate: 10 }}
          whileTap={noAnimation ? {} : { scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-2xl bg-green-600 text-white font-bold text-lg sm:text-xl lg:text-2xl mb-6 sm:mb-8 shadow-lg group-hover:shadow-green-600/50 mx-auto"
        >
          3
        </motion.div>
        <h4 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">Submit to HMRC</h4>
        <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
          One-click submissions to HMRC. Automatic digital records. Complete audit trails. MTD compliance sorted.
        </p>
      </motion.div>
    </div>
  </div>
</section>

      {/* CTA Section */}
      <motion.section 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={fadeInUp}
        className="py-16 sm:py-24 lg:py-32 bg-green-600 relative overflow-hidden"
      >
        {/* Background animation - Disabled on mobile */}
        <motion.div 
          animate={noAnimation ? {} : { 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.1, 0.3]
          }}
          transition={noAnimation ? {} : { duration: 8, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"
        />
        
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.h2 
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 sm:mb-8 leading-tight"
          >
            Ready to bridge the compliance gap?
          </motion.h2>
          <motion.p 
            variants={fadeInUp}
            className="text-lg sm:text-xl lg:text-2xl text-white/90 mb-8 sm:mb-12 max-w-2xl mx-auto font-medium px-2"
          >
            Join the waitlist for seamless MTD compliance—keep your Excel workflow while meeting HMRC&apos;s digital requirements effortlessly.
          </motion.p>
          
          {/* Coming Soon Message for CTA */}
          <motion.div 
            variants={fadeInUp}
            className="flex justify-center px-2"
          >
            <Link href="/waitlist/joinWaitlist">
              <div className="inline-flex items-center rounded-2xl bg-white text-green-600 hover:bg-gray-50 px-6 sm:px-8 lg:px-10 py-3 sm:py-4 lg:py-5 text-base sm:text-lg lg:text-xl font-bold shadow-2xl cursor-pointer transition-colors duration-200">
                <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 mr-2 sm:mr-3" />
                <span>Bridge the gap - Join our waitlist!</span>
              </div>
            </Link>
          </motion.div>
        </div>
      </motion.section>

      <Footer />
    </div>
  );
};

export default Home;