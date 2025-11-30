
import React, { useState, useEffect } from 'react';
import { motion, Variants, useReducedMotion } from 'framer-motion';
import { SparklesIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import Header from '../../components/header';
import Footer from '../../components/footer';

const Waitlist = () => {
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const shouldReduceMotion = useReducedMotion();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    organisationName: ''
  });

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('https://quix-mkgv.onrender.com/api/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setIsSubmitted(true);
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          organisationName: ''
        });
      } else {
        setError(result.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Unable to connect to server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">Q</span>
          </div>
          <p className="text-gray-600">Loading waitlist...</p>
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
      <section className="relative px-4 sm:px-6 pt-16 sm:pt-20 lg:pt-24 pb-12 sm:pb-16 lg:pb-20 lg:px-8 overflow-hidden">
        <div className="mx-auto max-w-4xl relative z-10">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="text-center mb-8 sm:mb-12"
          >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4 sm:mb-6">
              Join the <span className="text-green-600">Quix</span> Waitlist
            </h1>
            <p className="text-lg sm:text-xl text-gray-700 max-w-2xl mx-auto">
              Be the first to experience seamless MTD compliance. Keep your Excel workflow, bridge to HMRC effortlessly.
            </p>
          </motion.div>

          {/* Success Message */}
          {isSubmitted && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto mb-8 p-6 bg-white rounded-2xl shadow-xl border border-green-100"
            >
              <div className="text-center">
                <CheckCircleIcon className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-black mb-2">You're on the list!</h3>
                <p className="text-gray-600">
                  Thanks for joining our waitlist. We'll be in touch soon with early access to Quix.
                </p>
              </div>
            </motion.div>
          )}

          {/* Form */}
          {!isSubmitted && (
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={snapIn}
              className="max-w-md mx-auto"
            >
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-green-100">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                        placeholder="Smith"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="organisationName" className="block text-sm font-medium text-gray-700 mb-2">
                      Organisation Name <span className="text-gray-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      id="organisationName"
                      name="organisationName"
                      value={formData.organisationName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                      placeholder="Your Company Ltd"
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-xl transition-colors duration-200 flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                        Joining...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-5 h-5 mr-2" />
                        Join the Waitlist
                      </>
                    )}
                  </button>

                  <p className="text-xs text-gray-500 text-center">
                    We'll only use your email to notify you about Quix updates and early access.
                  </p>
                </form>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Waitlist;