'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, Variants, useReducedMotion } from 'framer-motion';
import Header from '../../../components/header';
import Footer from '../../../components/footer';

const TermsAndConditions = () => {
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const COMPANY_NAME = 'Quix';
  const SUPPORT_EMAIL = 'tommy.rowe@quixmtd.co.uk';
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
          <p className="text-gray-600">Loading terms...</p>
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
              Terms & Conditions
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-green-700">
                of Service
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

      {/* Terms Content */}
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
                These Terms and Conditions ("Terms") govern your use of the {COMPANY_NAME} HMRC
                MTD Spreadsheet Bridging Tool (the "Service"), including any associated website,
                spreadsheet add-ins, plugins or digital tools that enable VAT record-keeping and
                submission to HMRC under the Making Tax Digital (MTD) programme. By accessing or
                using the Service you agree to be bound by these Terms. If you do not agree, do not use
                the Service.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">2. About Us</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                The Service is provided by {COMPANY_NAME}. For enquiries
                contact us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-green-600 hover:text-green-700 font-medium underline decoration-green-600/30 hover:decoration-green-700">{SUPPORT_EMAIL}</a>.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">3. Purpose of the Service</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                The Service is designed to help users maintain digital VAT records, bridge spreadsheet
                data (for example Excel or Google Sheets) and submit VAT returns to HMRC using
                HMRC-recognised MTD APIs. The Service does not provide tax, accounting or legal advice.
                You are responsible for the accuracy of your VAT records and for ensuring that any
                returns submitted through the Service are correct and complete.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">4. Eligibility</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                You must be at least 18 years old and authorised to act on behalf of the business or
                entity that will use the Service. Use of the Service must be lawful and in accordance
                with applicable UK legislation and HMRC guidance.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">5. Account Registration</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                To use the Service you may be required to register for an account. You agree to provide
                accurate, complete and up-to-date information during registration and to keep your
                account credentials secure. You must notify us immediately of any unauthorised use or
                security breach related to your account. We may suspend or terminate accounts that
                breach these Terms.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">6. Use of the Service</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                You may use the Service only for lawful purposes and in compliance with HMRC's MTD
                requirements. Prohibited activities include, but are not limited to: using the Service
                for fraudulent or unlawful activity; attempting to bypass security controls; reverse
                engineering the service; or distributing the software without our written permission.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">7. Data Protection & Privacy</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                We process personal and VAT-related data in accordance with the UK General Data
                Protection Regulation (UK GDPR) and the Data Protection Act 2018. We collect only the
                data necessary to operate the Service and to communicate with HMRC. Our Privacy Policy
                sets out full details of how we collect, store and process personal data. Where you
                submit VAT data via the Service you remain the data controller and {COMPANY_NAME} acts
                as a data processor (unless otherwise agreed in writing).
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">8. HMRC Connectivity</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                The Service integrates with HMRC systems using HMRC's approved MTD APIs. While we aim
                to maintain reliable connectivity, we cannot guarantee uninterrupted access to HMRC
                systems, especially during HMRC maintenance windows, outages or changes to the API.
                You remain responsible for submitting returns to HMRC within required timeframes.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">9. Fees & Payment</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                Where fees apply, these will be displayed prior to purchase or subscription. Subscriptions
                renew automatically unless cancelled. Fees are payable in advance and are non-refundable
                except where required by law or as expressly stated in a written agreement.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">10. Intellectual Property</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                All intellectual property rights in the Service, documentation and related materials are
                owned by {COMPANY_NAME} or its licensors. You are granted a limited, non-exclusive,
                non-transferable licence to use the Service for your internal VAT submission purposes
                in accordance with these Terms.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">11. Warranties & Disclaimers</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                The Service is provided "as is" and we make no warranties that it will meet your
                requirements or be error-free. To the fullest extent permitted by law, {COMPANY_NAME}
                excludes all warranties (express or implied), including suitability for a particular
                purpose, accuracy, completeness, and non-infringement.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">12. Limitation of Liability</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                Except as required by law, {COMPANY_NAME}'s liability to you for any claim arising out
                of or in connection with these Terms shall be limited to the total fees you have paid
                to {COMPANY_NAME} in the twelve (12) months preceding the claim. We shall not be liable
                for indirect, special, incidental, or consequential losses, including loss of profit,
                loss of data, or loss of business opportunity. We are not liable for HMRC penalties or
                fines resulting from incorrect data submitted by you.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">13. Service Availability & Updates</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                We may update, modify or discontinue parts of the Service to remain compliant with
                HMRC requirements or to improve functionality. We will use reasonable efforts to notify
                you of significant changes, but we are not required to provide notice for minor updates
                (including security patches and compliance updates).
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">14. Suspension & Termination</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                We may suspend or terminate your access to the Service if you breach these Terms, if we
                suspect unlawful activity, or where required for legal or regulatory reasons. Upon
                termination, your access will cease and we may retain certain data for statutory or
                legitimate business purposes for a reasonable retention period.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">15. Governing Law & Jurisdiction</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                These Terms are governed by the laws of England and Wales. The parties submit to the
                exclusive jurisdiction of the courts of England and Wales in respect of any dispute
                arising out of these Terms.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">16. Contact Information</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                If you have questions about these Terms, please contact us: <br />
                <strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-green-600 hover:text-green-700 font-medium underline decoration-green-600/30 hover:decoration-green-700">{SUPPORT_EMAIL}</a>
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">17. Changes to these Terms</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                We may update these Terms from time to time. When we do, we will publish the updated
                Terms with a revised "Last Updated" date. Continued use of the Service after the date
                of publication constitutes acceptance of the updated Terms.
              </p>
            </motion.section>

            <motion.section variants={fadeInUp} className="mb-8 sm:mb-10 lg:mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4 sm:mb-6">18. Miscellaneous</h2>
              <p className="text-gray-700 leading-relaxed text-base sm:text-lg">
                If any provision of these Terms is found to be invalid or unenforceable, the remaining
                provisions will continue in full force and effect. These Terms constitute the entire
                agreement between you and {COMPANY_NAME} regarding the Service and supersede any prior
                agreements.
              </p>
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

export default TermsAndConditions;
