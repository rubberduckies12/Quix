'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, Variants, useReducedMotion } from 'framer-motion';
import Header from '../../../components/header';
import Footer from '../../../components/footer';

const Cookies = () => {
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const COMPANY_NAME = 'Quix Ltd';
  const SUPPORT_EMAIL = 'support@quix.com';
  const COMPANY_REG = '12345678';
  const COMPANY_ADDRESS = 'London, United Kingdom';
  const EFFECTIVE_DATE = 'January 1, 2025';
  const LAST_UPDATED = 'January 1, 2025';

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
          <p className="text-gray-600">Loading cookie policy...</p>
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
              Cookie Policy
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-700">
                & Data Usage
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

      {/* Cookie Policy Content */}
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
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                This Cookie Policy explains how {COMPANY_NAME} ("Quix," "we," "us," or "our") uses cookies and similar tracking technologies on our website and MTD bridging tool applications (the "Service").
              </p>
              
              <div className="bg-green-50 rounded-2xl p-4 sm:p-6 mt-4">
                <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">Company Details:</h4>
                <ul className="space-y-2 text-base sm:text-lg text-gray-700">
                  <li>• Company Name: {COMPANY_NAME}</li>
                  <li>• Company Number: {COMPANY_REG}</li>
                  <li>• Registered Office: {COMPANY_ADDRESS}</li>
                </ul>
              </div>
              
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg mt-4">
                This policy should be read alongside our Privacy Policy and Terms and Conditions.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">2. What Are Cookies?</h2>
              
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-6">
                Cookies are small text files that are stored on your device (computer, smartphone, tablet) when you visit websites or use apps. They help websites remember information about your visit, making your next visit easier and the site more useful to you.
              </p>
              
              <div>
                <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">Cookies can:</h4>
                <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                  <li>• Remember your preferences and settings</li>
                  <li>• Keep you logged in to your account</li>
                  <li>• Understand how you use our Service</li>
                  <li>• Show you relevant advertisements</li>
                  <li>• Help us improve our services</li>
                </ul>
              </div>

              <div className="bg-green-50 rounded-2xl p-4 sm:p-6 mt-6">
                <p className="text-base sm:text-lg font-bold text-black mb-2">
                  Important: Cookies are NOT viruses or malware.
                </p>
                <p className="text-base sm:text-lg text-gray-700">
                  They cannot access other files on your device or steal personal information beyond what you provide to websites.
                </p>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">3. Types of Cookies We Use</h2>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">3.1 Strictly Necessary Cookies</h4>
                  <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-4">
                    These cookies are essential for the Service to work and cannot be disabled.
                  </p>

                  <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 overflow-x-auto">
                    <table className="w-full text-sm sm:text-base">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 font-semibold text-black">Cookie Name</th>
                          <th className="text-left py-2 font-semibold text-black">Purpose</th>
                          <th className="text-left py-2 font-semibold text-black">Duration</th>
                          <th className="text-left py-2 font-semibold text-black">Type</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        <tr className="border-b border-gray-100">
                          <td className="py-2 font-mono text-xs sm:text-sm">quix_session</td>
                          <td className="py-2">Maintains your login session</td>
                          <td className="py-2">Session</td>
                          <td className="py-2">First-party</td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="py-2 font-mono text-xs sm:text-sm">quix_auth_token</td>
                          <td className="py-2">Authenticates your account securely</td>
                          <td className="py-2">30 days</td>
                          <td className="py-2">First-party</td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="py-2 font-mono text-xs sm:text-sm">quix_csrf</td>
                          <td className="py-2">Protects against cross-site request forgery attacks</td>
                          <td className="py-2">Session</td>
                          <td className="py-2">First-party</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-mono text-xs sm:text-sm">cookie_consent</td>
                          <td className="py-2">Remembers your cookie preferences</td>
                          <td className="py-2">1 year</td>
                          <td className="py-2">First-party</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6 mt-4">
                    <h5 className="text-base sm:text-lg font-semibold text-black mb-3">Security Note:</h5>
                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                      Our security cookies facilitate encrypted transmission of your VAT data and spreadsheet connections to HMRC. These cookies do NOT store sensitive data - they only facilitate secure transmission using encryption keys.
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">3.2 Performance and Analytics Cookies</h4>
                  <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-4">
                    These cookies help us understand how you use our Service to improve performance.
                  </p>

                  <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 overflow-x-auto">
                    <table className="w-full text-sm sm:text-base">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 font-semibold text-black">Cookie Name</th>
                          <th className="text-left py-2 font-semibold text-black">Purpose</th>
                          <th className="text-left py-2 font-semibold text-black">Duration</th>
                          <th className="text-left py-2 font-semibold text-black">Provider</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        <tr className="border-b border-gray-100">
                          <td className="py-2 font-mono text-xs sm:text-sm">_ga</td>
                          <td className="py-2">Distinguishes unique users</td>
                          <td className="py-2">2 years</td>
                          <td className="py-2">Google</td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="py-2 font-mono text-xs sm:text-sm">_gid</td>
                          <td className="py-2">Distinguishes unique users</td>
                          <td className="py-2">24 hours</td>
                          <td className="py-2">Google</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-mono text-xs sm:text-sm">_gat</td>
                          <td className="py-2">Throttles request rate</td>
                          <td className="py-2">1 minute</td>
                          <td className="py-2">Google</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">3.3 Functionality Cookies</h4>
                  <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-4">
                    These cookies remember your preferences to personalize your experience.
                  </p>

                  <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 overflow-x-auto">
                    <table className="w-full text-sm sm:text-base">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 font-semibold text-black">Cookie Name</th>
                          <th className="text-left py-2 font-semibold text-black">Purpose</th>
                          <th className="text-left py-2 font-semibold text-black">Duration</th>
                          <th className="text-left py-2 font-semibold text-black">Type</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700">
                        <tr className="border-b border-gray-100">
                          <td className="py-2 font-mono text-xs sm:text-sm">quix_theme</td>
                          <td className="py-2">Remembers dark/light mode preference</td>
                          <td className="py-2">1 year</td>
                          <td className="py-2">First-party</td>
                        </tr>
                        <tr className="border-b border-gray-100">
                          <td className="py-2 font-mono text-xs sm:text-sm">quix_spreadsheet_settings</td>
                          <td className="py-2">Remembers your spreadsheet connection preferences</td>
                          <td className="py-2">90 days</td>
                          <td className="py-2">First-party</td>
                        </tr>
                        <tr>
                          <td className="py-2 font-mono text-xs sm:text-sm">quix_notifications</td>
                          <td className="py-2">Stores notification preferences</td>
                          <td className="py-2">1 year</td>
                          <td className="py-2">First-party</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">4. How to Manage Cookies</h2>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">4.1 Cookie Consent Banner</h4>
                  <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-3">
                    When you first visit our Service, you'll see a cookie consent banner with options:
                  </p>
                  
                  <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4 mb-4">
                    <li>• <strong>Accept All:</strong> Allows all cookies including analytics</li>
                    <li>• <strong>Reject Non-Essential:</strong> Only strictly necessary cookies</li>
                    <li>• <strong>Customize:</strong> Choose which cookie categories to allow</li>
                    <li>• <strong>Cookie Settings:</strong> Access detailed controls</li>
                  </ul>

                  <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-3">
                    You can change your preferences at any time through:
                  </p>
                  <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                    <li>• Account Settings → Privacy → Cookie Preferences</li>
                    <li>• Footer link: "Cookie Settings"</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">4.2 Browser Settings</h4>
                  <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-3">
                    You can control cookies through your browser settings. Most browsers allow you to block or delete cookies, though this may affect your experience.
                  </p>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">5. Important Clarifications</h2>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">5.1 MTD Data Security</h4>
                  
                  <div className="bg-red-50 rounded-2xl p-4 sm:p-6 mb-4">
                    <p className="text-base sm:text-lg font-bold text-black">
                      Cookies DO NOT contain your VAT or spreadsheet data.
                    </p>
                  </div>

                  <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-4">
                    There's an important distinction between:
                  </p>

                  <div className="space-y-4">
                    <div>
                      <h5 className="text-base sm:text-lg font-semibold text-black mb-2">What Cookies DO:</h5>
                      <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                        <li>• Store small identifiers (session IDs, preferences)</li>
                        <li>• Facilitate secure communication with HMRC</li>
                        <li>• Remember non-sensitive settings</li>
                      </ul>
                    </div>

                    <div>
                      <h5 className="text-base sm:text-lg font-semibold text-black mb-2">What Cookies DO NOT DO:</h5>
                      <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                        <li>• Store your VAT return data</li>
                        <li>• Store your spreadsheet contents</li>
                        <li>• Store your HMRC login credentials</li>
                        <li>• Store your business financial information</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">6. Consequences of Disabling Cookies</h2>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">6.1 Strictly Necessary Cookies</h4>
                  <div className="bg-red-50 rounded-2xl p-4 sm:p-6">
                    <p className="text-base sm:text-lg font-bold text-black mb-2">Cannot be disabled.</p>
                    <p className="text-gray-700 leading-relaxed text-base sm:text-lg">Blocking these will break the Service:</p>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 mt-3">
                      <li>• Cannot log in to your account</li>
                      <li>• Cannot connect spreadsheets to HMRC</li>
                      <li>• Cannot submit VAT returns</li>
                      <li>• Cannot access secure areas</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">6.2 Performance Cookies</h4>
                  <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6">
                    <p className="text-base sm:text-lg font-bold text-black mb-2">Can be disabled.</p>
                    <p className="text-gray-700 leading-relaxed text-base sm:text-lg">You can still use the Service, but:</p>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 mt-3">
                      <li>• We can't improve based on usage patterns</li>
                      <li>• Some features may not work optimally</li>
                      <li>• Error reporting may be limited</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">6.3 Functionality Cookies</h4>
                  <div className="bg-green-50 rounded-2xl p-4 sm:p-6">
                    <p className="text-base sm:text-lg font-bold text-black mb-2">Can be disabled.</p>
                    <p className="text-gray-700 leading-relaxed text-base sm:text-lg">You can still use the Service, but:</p>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 mt-3">
                      <li>• Settings won't be remembered between sessions</li>
                      <li>• You'll need to reset preferences each visit</li>
                      <li>• Spreadsheet connections may need reconfiguration</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">7. Changes to This Policy</h2>
              
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-4">
                We may update this Cookie Policy to reflect new cookies, tracking technologies, or changes in legal requirements. We will notify you of material changes via email or in-app notification.
              </p>

              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                Your continued use after changes constitutes acceptance of the updated policy.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">8. Contact Us</h2>
              
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg mb-4">
                Questions about cookies or privacy:
              </p>

              <div className="bg-green-50 rounded-2xl p-4 sm:p-6">
                <h4 className="text-lg font-semibold text-black mb-3">Contact Information:</h4>
                <ul className="space-y-2 text-base sm:text-lg text-gray-700">
                  <li>• <strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-green-600 hover:text-green-700 font-medium underline decoration-green-600/30 hover:decoration-green-700">{SUPPORT_EMAIL}</a></li>
                  <li>• <strong>Address:</strong> {COMPANY_ADDRESS}</li>
                </ul>
              </div>
            </motion.section>
          </motion.article>

          {/* Back to Home CTA */}
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

export default Cookies;