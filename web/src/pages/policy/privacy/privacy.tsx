'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, Variants, useReducedMotion } from 'framer-motion';
import Header from '../../../components/header';
import Footer from '../../../components/footer';

const Privacy = () => {
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const COMPANY_NAME = 'Quix';
  const SUPPORT_EMAIL = 'tommy.rowe@quixmtd.co.uk';
  const DPO_EMAIL = 'tommy.rowe@quixmtd.co.uk';
  const EFFECTIVE_DATE = 'January 1, 2025';
  const LAST_UPDATED = 'January 1, 2025';

  useEffect(() => {
    setIsClient(true);
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const noAnimation = shouldReduceMotion || isMobile;

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
          <p className="text-gray-600">Loading privacy policy...</p>
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
      <section className="relative px-4 sm:px-6 pt-6 sm:pt-8 lg:pt-12 pb-8 sm:pb-12 lg:pb-16 lg:px-8">
        <div className="mx-auto max-w-4xl relative z-10">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="text-center"
          >
            <motion.h1 
              variants={fadeInUp}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-black mb-4 sm:mb-6 leading-tight"
            >
              Privacy Policy
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-700">
                & Data Protection
              </span>
            </motion.h1>
            
            <motion.p 
              variants={fadeInUp}
              className="text-base sm:text-lg lg:text-xl text-gray-700 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed px-2"
            >
              Effective Date: {EFFECTIVE_DATE} • Last Updated: {LAST_UPDATED}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Privacy Policy Content */}
      <section className="py-8 sm:py-12 lg:py-16 bg-white/80 backdrop-blur-sm relative">
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
        
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.article 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={staggerContainer}
            className="prose prose-slate lg:prose-lg xl:prose-xl max-w-none"
          >
            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">1. Introduction</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-4">
                This Privacy Policy explains how {COMPANY_NAME} collects, uses, and protects your personal information when you use our HMRC MTD Spreadsheet Bridging Tool.
              </p>
              
              <div className="bg-green-50 rounded-2xl p-4 sm:p-6">
                <h4 className="text-lg font-semibold text-black mb-3">Company Details:</h4>
                <ul className="space-y-2 text-base text-gray-700">
                  <li>• Company: {COMPANY_NAME}</li>
                  <li>• Privacy Contact: <a href={`mailto:${DPO_EMAIL}`} className="text-green-600 hover:text-green-700 font-medium underline decoration-green-600/30 hover:decoration-green-700">{DPO_EMAIL}</a></li>
                </ul>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">2. Information We Collect</h2>
              
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">Account Information:</h4>
                  <p className="text-gray-700 text-base">Name, email, business details, VAT number, encrypted passwords</p>
                </div>

                <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">VAT Data (Highly Sensitive):</h4>
                  <p className="text-gray-700 text-base">VAT returns, sales/purchase amounts, HMRC submission data</p>
                </div>

                <div className="bg-green-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">Technical Data:</h4>
                  <p className="text-gray-700 text-base">IP address, device info, usage analytics, error logs</p>
                </div>

                <div className="bg-red-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">HMRC Integration:</h4>
                  <p className="text-gray-700 text-base">Authentication tokens, submission confirmations, API responses</p>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">3. How We Use Your Data</h2>
              
              <div className="space-y-4">
                <div className="bg-green-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">Primary Service Functions:</h4>
                  <ul className="space-y-1 text-base text-gray-700">
                    <li>• Extract and validate VAT data from spreadsheets</li>
                    <li>• Submit VAT returns to HMRC on your behalf</li>
                    <li>• Provide account management and support</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">Legal Compliance:</h4>
                  <ul className="space-y-1 text-base text-gray-700">
                    <li>• Meet HMRC MTD requirements</li>
                    <li>• Comply with tax and anti-money laundering laws</li>
                    <li>• Maintain audit trails and records</li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">Service Improvement:</h4>
                  <p className="text-base text-gray-700">Analyze usage patterns, fix issues, develop new features</p>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">4. Data Sharing</h2>
              
              <div className="space-y-4">
                <div className="bg-red-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">HMRC (Required by Law):</h4>
                  <p className="text-base text-gray-700">VAT return data, business identification, submission references</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">Service Providers:</h4>
                  <p className="text-base text-gray-700">Cloud hosting, security services, analytics (contractually protected)</p>
                </div>

                <div className="bg-green-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">We Never:</h4>
                  <p className="text-base text-gray-700">Sell your data, share for marketing by others, or use for our own business</p>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">5. Data Security</h2>
              
              <div className="bg-green-50 rounded-2xl p-4 sm:p-6">
                <h4 className="text-lg font-semibold text-black mb-3">Security Measures:</h4>
                <ul className="space-y-2 text-base text-gray-700">
                  <li>• All data encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
                  <li>• Multi-factor authentication and role-based access</li>
                  <li>• UK data centers with government-grade security</li>
                  <li>• Regular security audits and penetration testing</li>
                  <li>• HMRC-approved API integration with OAuth 2.0</li>
                </ul>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">6. Data Retention</h2>
              
              <div className="space-y-3">
                <div className="bg-red-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">VAT Records: 6 years</h4>
                  <p className="text-base text-gray-700">Required by HMRC for audit purposes</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">Account Data: 7 years after closure</h4>
                  <p className="text-base text-gray-700">Legal and regulatory compliance</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">Technical Logs: 2 years</h4>
                  <p className="text-base text-gray-700">Security monitoring and support</p>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">7. Your Rights</h2>
              
              <p className="text-gray-700 text-base mb-4">Under UK GDPR, you have rights to:</p>
              
              <div className="bg-green-50 rounded-2xl p-4 sm:p-6">
                <ul className="space-y-2 text-base text-gray-700">
                  <li>• <strong>Access:</strong> Request copies of your data</li>
                  <li>• <strong>Rectification:</strong> Correct inaccurate data</li>
                  <li>• <strong>Erasure:</strong> Delete data (subject to legal requirements)</li>
                  <li>• <strong>Portability:</strong> Transfer data to another provider</li>
                  <li>• <strong>Object:</strong> Stop processing for marketing</li>
                  <li>• <strong>Restrict:</strong> Limit how we process your data</li>
                </ul>
              </div>
              
              <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 mt-4">
                <p className="text-base text-gray-700">
                  <strong>Contact:</strong> <a href={`mailto:${DPO_EMAIL}`} className="text-green-600 hover:text-green-700 underline decoration-green-600/30 hover:decoration-green-700">{DPO_EMAIL}</a> • Response within 30 days
                </p>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">8. Contact & Complaints</h2>
              
              <div className="space-y-4">
                <div className="bg-green-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">Data Protection Officer:</h4>
                  <ul className="space-y-1 text-base text-gray-700">
                    <li>• Email: <a href={`mailto:${DPO_EMAIL}`} className="text-green-600 hover:text-green-700 underline decoration-green-600/30 hover:decoration-green-700">{DPO_EMAIL}</a></li>
                  </ul>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 sm:p-6">
                  <h4 className="text-lg font-semibold text-black mb-2">ICO (Regulatory Authority):</h4>
                  <ul className="space-y-1 text-base text-gray-700">
                    <li>• Website: <a href="https://ico.org.uk" className="text-green-600 hover:text-green-700 underline decoration-green-600/30 hover:decoration-green-700">ico.org.uk</a></li>
                    <li>• Phone: 0303 123 1113</li>
                  </ul>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">9. Changes</h2>
              <p className="text-gray-700 text-base mb-4">
                We may update this policy for legal or service changes. We will notify you 30 days in advance of material changes via email or in-app notification.
              </p>
              <p className="text-gray-700 text-base">
                Continued use after changes constitutes acceptance of the updated policy.
              </p>
            </motion.section>
          </motion.article>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeInUp}
            className="text-center mt-12 sm:mt-16 lg:mt-20"
          >
            <Link href="/">
              <div className="inline-flex items-center rounded-2xl bg-green-600 hover:bg-green-700 px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-semibold text-white shadow-xl cursor-pointer transition-colors duration-200">
                Back to Home
              </div>
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Privacy;