'use client';
import React from 'react';
import Header from '../../../components/header';
import Footer from '../../../components/footer';

const Cookies = () => {
  return (
    <div className="min-h-screen bg-emerald-50">
      <Header />
      
      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 pt-20 sm:pt-24 lg:pt-28 pb-8 sm:pb-8 lg:pb-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-6 sm:mb-8 leading-tight">
              Cookie Policy
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto px-2">
              Learn how we use cookies and tracking technologies to improve your experience.
            </p>
          </div>
        </div>
      </section>

      {/* Cookies Content */}
      <section className="py-8 sm:py-12 lg:py-16 bg-white/50 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-12 shadow-xl border border-gray-100">
            
            {/* Document Header */}
            <div className="text-center mb-8 sm:mb-12 pb-6 sm:pb-8 border-b border-gray-200">
              <h2 className="text-2xl sm:text-3xl font-bold text-black mb-4">GRO COOKIE POLICY</h2>
              <p className="text-base sm:text-lg text-gray-600">Last Updated: 04/10/2025</p>
              <p className="text-base sm:text-lg text-gray-600">Effective Date: 04/10/2025</p>
            </div>

            {/* Cookies Content */}
            <div className="prose prose-gray max-w-none space-y-8 sm:space-y-12">
              
              {/* SECTION 1 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">1. INTRODUCTION</h3>
                
                <div className="space-y-6">
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                    This Cookie Policy explains how Gro Equity Ltd (&quot;Gro,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) uses cookies and similar tracking technologies on our website and mobile applications (the &quot;Platform&quot;).
                  </p>
                  
                  <div className="bg-blue-50 rounded-2xl p-4 sm:p-6">
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">Company Details:</h4>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700">
                      <li>• Company Name: Gro Equity Ltd</li>
                      <li>• Company Number: 16762013</li>
                      <li>• Registered Office: Abbey Farm Church Street, Higham, Rochester, England, ME3 7LS</li>
                    </ul>
                  </div>
                  
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                    This policy should be read alongside our Privacy Policy and Terms and Conditions.
                  </p>
                </div>
              </div>

              {/* SECTION 2 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">2. WHAT ARE COOKIES?</h3>
                
                <div className="space-y-6">
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                    Cookies are small text files that are stored on your device (computer, smartphone, tablet) when you visit websites or use apps. They help websites remember information about your visit, making your next visit easier and the site more useful to you.
                  </p>
                  
                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">Cookies can:</h4>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                      <li>• Remember your preferences and settings</li>
                      <li>• Keep you logged in to your account</li>
                      <li>• Understand how you use our Platform</li>
                      <li>• Show you relevant advertisements</li>
                      <li>• Help us improve our services</li>
                    </ul>
                  </div>

                  <div className="bg-emerald-50 rounded-2xl p-4 sm:p-6">
                    <p className="text-base sm:text-lg font-bold text-black mb-2">
                      Important: Cookies are NOT viruses or malware.
                    </p>
                    <p className="text-base sm:text-lg text-gray-700">
                      They cannot access other files on your device or steal personal information beyond what you provide to websites.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 3 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">3. WHAT TYPES OF COOKIES EXIST?</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">3.1 By Duration</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Session Cookies:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• Temporary cookies that expire when you close your browser</li>
                          <li>• Used to maintain your session while using our Platform</li>
                          <li>• Automatically deleted when you log out or close the app</li>
                        </ul>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Persistent Cookies:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• Remain on your device for a set period (from hours to years)</li>
                          <li>• Used to remember your preferences across sessions</li>
                          <li>• Can be deleted manually through your browser settings</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">3.2 By Purpose</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Strictly Necessary Cookies:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• Essential for the Platform to function</li>
                          <li>• Cannot be disabled without breaking core functionality</li>
                          <li>• Examples: login authentication, security tokens, session management</li>
                        </ul>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Performance Cookies:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• Collect information about how you use the Platform</li>
                          <li>• Help us understand which features are most popular</li>
                          <li>• All data is aggregated and anonymous</li>
                        </ul>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Functionality Cookies:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• Remember your preferences and choices</li>
                          <li>• Provide enhanced, personalized features</li>
                          <li>• Examples: language preferences, display settings</li>
                        </ul>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Targeting/Advertising Cookies:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• Track your browsing across different websites</li>
                          <li>• Used to show you relevant advertisements</li>
                          <li>• May be set by our advertising partners</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">3.3 By Origin</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">First-Party Cookies:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• Set directly by Gro</li>
                          <li>• Used for essential functions and analytics</li>
                        </ul>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Third-Party Cookies:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• Set by external services we use (Google, Facebook, TikTok, LinkedIn)</li>
                          <li>• Used for advertising, analytics, and social media integration</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">4. COOKIES WE USE</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">4.1 Strictly Necessary Cookies</h4>
                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-4">
                      These cookies are essential for the Platform to work and cannot be disabled.
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
                            <td className="py-2 font-mono text-xs sm:text-sm">gro_session</td>
                            <td className="py-2">Maintains your login session</td>
                            <td className="py-2">Session</td>
                            <td className="py-2">First-party</td>
                          </tr>
                          <tr className="border-b border-gray-100">
                            <td className="py-2 font-mono text-xs sm:text-sm">gro_auth_token</td>
                            <td className="py-2">Authenticates your account securely</td>
                            <td className="py-2">30 days</td>
                            <td className="py-2">First-party</td>
                          </tr>
                          <tr className="border-b border-gray-100">
                            <td className="py-2 font-mono text-xs sm:text-sm">gro_csrf</td>
                            <td className="py-2">Protects against cross-site request forgery attacks</td>
                            <td className="py-2">Session</td>
                            <td className="py-2">First-party</td>
                          </tr>
                          <tr className="border-b border-gray-100">
                            <td className="py-2 font-mono text-xs sm:text-sm">gro_secure_data</td>
                            <td className="py-2">Encrypts and securely transmits sensitive financial data</td>
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

                    <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6">
                      <h5 className="text-base sm:text-lg font-semibold text-black mb-3">Security Note:</h5>
                      <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                        The <code className="bg-gray-200 px-1 rounded">gro_secure_data</code> cookie is used to encrypt and safely transmit your investment instructions, portfolio data, and financial information between your device and our servers. This cookie does NOT store sensitive data - it only facilitates secure transmission using encryption keys.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">4.2 Performance and Analytics Cookies</h4>
                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-4">
                      These cookies help us understand how you use our Platform to improve performance.
                    </p>

                    <div>
                      <h5 className="text-base sm:text-lg font-semibold text-black mb-3">Google Analytics:</h5>
                      <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 overflow-x-auto mb-4">
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

                      <div className="space-y-3">
                        <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                          <strong>Purpose:</strong> Track page views, session duration, bounce rates, and user journeys to improve Platform usability.
                        </p>
                        <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                          <strong>Data Collected:</strong> Page URLs, time on page, device type, browser, location (city/country level only)
                        </p>
                        <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                          <strong>Third-Party Policy:</strong> <a href="https://policies.google.com/privacy" className="text-blue-600 underline">Google Analytics Privacy Policy</a>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">4.3 Functionality Cookies</h4>
                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-4">
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
                            <td className="py-2 font-mono text-xs sm:text-sm">gro_lang</td>
                            <td className="py-2">Remembers your language preference</td>
                            <td className="py-2">1 year</td>
                            <td className="py-2">First-party</td>
                          </tr>
                          <tr className="border-b border-gray-100">
                            <td className="py-2 font-mono text-xs sm:text-sm">gro_theme</td>
                            <td className="py-2">Remembers dark/light mode preference</td>
                            <td className="py-2">1 year</td>
                            <td className="py-2">First-party</td>
                          </tr>
                          <tr className="border-b border-gray-100">
                            <td className="py-2 font-mono text-xs sm:text-sm">gro_goal_filter</td>
                            <td className="py-2">Remembers your goal display preferences</td>
                            <td className="py-2">90 days</td>
                            <td className="py-2">First-party</td>
                          </tr>
                          <tr>
                            <td className="py-2 font-mono text-xs sm:text-sm">gro_notifications</td>
                            <td className="py-2">Stores notification preferences</td>
                            <td className="py-2">1 year</td>
                            <td className="py-2">First-party</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">4.4 Advertising and Marketing Cookies</h4>
                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-4">
                      These cookies track your activity to show you relevant advertisements and measure campaign effectiveness.
                    </p>

                    <div className="space-y-6">
                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-3">Facebook Pixel:</h5>
                        <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 overflow-x-auto mb-3">
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
                                <td className="py-2 font-mono text-xs sm:text-sm">_fbp</td>
                                <td className="py-2">Tracks visits across websites</td>
                                <td className="py-2">90 days</td>
                                <td className="py-2">Meta/Facebook</td>
                              </tr>
                              <tr>
                                <td className="py-2 font-mono text-xs sm:text-sm">fr</td>
                                <td className="py-2">Delivers and measures ads</td>
                                <td className="py-2">90 days</td>
                                <td className="py-2">Meta/Facebook</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                          <strong>Purpose:</strong> Show you relevant Gro ads on Facebook and Instagram, measure ad campaign performance
                        </p>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-3">TikTok Pixel:</h5>
                        <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 overflow-x-auto mb-3">
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
                                <td className="py-2 font-mono text-xs sm:text-sm">_ttp</td>
                                <td className="py-2">Tracks user interactions</td>
                                <td className="py-2">13 months</td>
                                <td className="py-2">TikTok</td>
                              </tr>
                              <tr>
                                <td className="py-2 font-mono text-xs sm:text-sm">_tt_enable_cookie</td>
                                <td className="py-2">Enables TikTok tracking</td>
                                <td className="py-2">13 months</td>
                                <td className="py-2">TikTok</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                          <strong>Purpose:</strong> Show you relevant Gro ads on TikTok, measure ad campaign performance
                        </p>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-3">LinkedIn Insight Tag:</h5>
                        <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 overflow-x-auto mb-3">
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
                                <td className="py-2 font-mono text-xs sm:text-sm">li_sugr</td>
                                <td className="py-2">Browser ID for tracking</td>
                                <td className="py-2">90 days</td>
                                <td className="py-2">LinkedIn</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 font-mono text-xs sm:text-sm">UserMatchHistory</td>
                                <td className="py-2">LinkedIn Ads ID syncing</td>
                                <td className="py-2">30 days</td>
                                <td className="py-2">LinkedIn</td>
                              </tr>
                              <tr>
                                <td className="py-2 font-mono text-xs sm:text-sm">bcookie</td>
                                <td className="py-2">Browser identification</td>
                                <td className="py-2">1 year</td>
                                <td className="py-2">LinkedIn</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                          <strong>Purpose:</strong> Show you relevant Gro ads on LinkedIn, track professional audience engagement
                        </p>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-3">Google Ads:</h5>
                        <div className="bg-gray-50 rounded-2xl p-4 sm:p-6 overflow-x-auto mb-4">
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
                                <td className="py-2 font-mono text-xs sm:text-sm">_gcl_au</td>
                                <td className="py-2">Stores and tracks conversions</td>
                                <td className="py-2">90 days</td>
                                <td className="py-2">Google</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-2 font-mono text-xs sm:text-sm">IDE</td>
                                <td className="py-2">Measures ad campaign effectiveness</td>
                                <td className="py-2">1 year</td>
                                <td className="py-2">Google</td>
                              </tr>
                              <tr>
                                <td className="py-2 font-mono text-xs sm:text-sm">test_cookie</td>
                                <td className="py-2">Checks if browser accepts cookies</td>
                                <td className="py-2">15 minutes</td>
                                <td className="py-2">Google</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                          <strong>Purpose:</strong> Show you relevant Gro ads on Google Search and Display Network, measure ROI
                        </p>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-3">What Data is Collected:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4 mb-4">
                          <li>• Pages you visit on our Platform</li>
                          <li>• Actions you take (sign up, start goal training, etc.)</li>
                          <li>• Device and browser information</li>
                          <li>• Approximate location (city/country)</li>
                          <li>• Previous interaction with our ads</li>
                        </ul>

                        <h5 className="text-base sm:text-lg font-semibold text-black mb-3">Third-Party Policies:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• <a href="https://www.facebook.com/policies/cookies/" className="text-blue-600 underline">Meta/Facebook Cookie Policy</a></li>
                          <li>• <a href="https://www.tiktok.com/legal/cookie-policy" className="text-blue-600 underline">TikTok Cookie Policy</a></li>
                          <li>• <a href="https://www.linkedin.com/legal/cookie-policy" className="text-blue-600 underline">LinkedIn Cookie Policy</a></li>
                          <li>• <a href="https://policies.google.com/technologies/ads" className="text-blue-600 underline">Google Ads Cookie Policy</a></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 5 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">5. IMPORTANT CLARIFICATIONS</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">5.1 Cookies vs. Secure Data Transmission</h4>
                    
                    <div className="bg-red-50 rounded-2xl p-4 sm:p-6 mb-4">
                      <p className="text-base sm:text-lg font-bold text-black">
                        Cookies DO NOT contain your sensitive data.
                      </p>
                    </div>

                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-4">
                      There&apos;s an important distinction between:
                    </p>

                    <div className="space-y-4">
                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">What Cookies DO:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• Store small identifiers (session IDs, preferences)</li>
                          <li>• Facilitate secure communication</li>
                          <li>• Remember non-sensitive settings</li>
                        </ul>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">What Cookies DO NOT DO:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• Store your passwords in plain text</li>
                          <li>• Store your bank account numbers</li>
                          <li>• Store your National Insurance number</li>
                          <li>• Store your portfolio holdings</li>
                          <li>• Store your investment amounts</li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-blue-50 rounded-2xl p-4 sm:p-6">
                      <h5 className="text-base sm:text-lg font-semibold text-black mb-3">Security Cookies Explained:</h5>
                      <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-3">
                        The <code className="bg-gray-200 px-1 rounded">gro_secure_data</code> cookie facilitates encrypted data transmission. Here&apos;s how it works:
                      </p>
                      <ol className="space-y-2 text-base sm:text-lg text-gray-700 ml-4 list-decimal">
                        <li>You enter sensitive data (e.g., investment amount)</li>
                        <li>The cookie provides an encryption key reference</li>
                        <li>Data is encrypted on your device</li>
                        <li>Encrypted data is sent to our servers</li>
                        <li>Our servers decrypt it using the matching key</li>
                        <li>Cookie is refreshed with a new key for next transmission</li>
                      </ol>
                      <p className="text-base sm:text-lg font-bold text-black mt-3">
                        Your actual sensitive data is NEVER stored in cookies - only encryption references.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">5.2 Mobile App Tracking</h4>
                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-3">
                      Our mobile apps (iOS and Android) use similar tracking technologies:
                    </p>

                    <div className="space-y-4">
                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Mobile Identifiers:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• <strong>iOS:</strong> IDFA (Identifier for Advertisers)</li>
                          <li>• <strong>Android:</strong> AAID (Google Advertising ID)</li>
                        </ul>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Purpose:</h5>
                        <p className="text-base sm:text-lg text-gray-700 leading-relaxed">Same as web cookies - analytics and advertising</p>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Your Control:</h5>
                        <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                          <li>• <strong>iOS:</strong> Settings &gt; Privacy &gt; Tracking &gt; Disable &quot;Allow Apps to Request to Track&quot;</li>
                          <li>• <strong>Android:</strong> Settings &gt; Google &gt; Ads &gt; Opt out of Ads Personalization</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 6 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">6. HOW TO MANAGE COOKIES</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">6.1 Cookie Consent Banner</h4>
                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-3">
                      When you first visit our Platform, you&apos;ll see a cookie consent banner with options:
                    </p>
                    
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4 mb-4">
                      <li>• <strong>Accept All:</strong> Allows all cookies including advertising</li>
                      <li>• <strong>Reject Non-Essential:</strong> Only strictly necessary cookies</li>
                      <li>• <strong>Customize:</strong> Choose which cookie categories to allow</li>
                      <li>• <strong>Cookie Settings:</strong> Access detailed controls</li>
                    </ul>

                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-3">
                      You can change your preferences at any time through:
                    </p>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                      <li>• Cookie banner (appears on first visit)</li>
                      <li>• Account Settings &gt; Privacy &gt; Cookie Preferences</li>
                      <li>• Footer link: &quot;Cookie Settings&quot;</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">6.2 Browser Settings</h4>
                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-3">
                      You can control cookies through your browser settings:
                    </p>

                    <div className="space-y-4">
                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Google Chrome:</h5>
                        <ol className="space-y-1 text-base sm:text-lg text-gray-700 ml-4 list-decimal">
                          <li>Settings &gt; Privacy and security &gt; Cookies and other site data</li>
                          <li>Choose your preferred option or block specific sites</li>
                        </ol>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Safari:</h5>
                        <ol className="space-y-1 text-base sm:text-lg text-gray-700 ml-4 list-decimal">
                          <li>Preferences &gt; Privacy &gt; Manage Website Data</li>
                          <li>Remove specific cookies or block all cookies</li>
                        </ol>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Firefox:</h5>
                        <ol className="space-y-1 text-base sm:text-lg text-gray-700 ml-4 list-decimal">
                          <li>Options &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
                          <li>Manage permissions or clear data</li>
                        </ol>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Edge:</h5>
                        <ol className="space-y-1 text-base sm:text-lg text-gray-700 ml-4 list-decimal">
                          <li>Settings &gt; Cookies and site permissions</li>
                          <li>Manage and delete cookies</li>
                        </ol>
                      </div>

                      <div>
                        <h5 className="text-base sm:text-lg font-semibold text-black mb-2">Mobile Browsers:</h5>
                        <p className="text-base sm:text-lg text-gray-700 ml-4">Similar options available in browser settings menus</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">6.3 Third-Party Opt-Outs</h4>
                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-3">
                      Opt out of targeted advertising:
                    </p>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                      <li>• <a href="http://www.youronlinechoices.com/uk/" className="text-blue-600 underline">Your Online Choices (UK)</a></li>
                      <li>• <a href="https://adssettings.google.com/" className="text-blue-600 underline">Google Ads Settings</a></li>
                      <li>• <a href="https://www.facebook.com/ads/preferences/" className="text-blue-600 underline">Facebook Ad Preferences</a></li>
                      <li>• <a href="https://www.tiktok.com/privacy/ads" className="text-blue-600 underline">TikTok Ad Settings</a></li>
                      <li>• <a href="https://www.linkedin.com/psettings/guest-controls/retargeting-opt-out" className="text-blue-600 underline">LinkedIn Ad Settings</a></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* SECTION 7 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">7. CONSEQUENCES OF DISABLING COOKIES</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">7.1 Strictly Necessary Cookies</h4>
                    <div className="bg-red-50 rounded-2xl p-4 sm:p-6">
                      <p className="text-base sm:text-lg font-bold text-black mb-2">Cannot be disabled.</p>
                      <p className="text-base sm:text-lg text-gray-700 leading-relaxed">Blocking these will break the Platform:</p>
                      <ul className="space-y-2 text-base sm:text-lg text-gray-700 mt-3">
                        <li>• Cannot log in to your account</li>
                        <li>• Cannot make investments or withdrawals</li>
                        <li>• Cannot access secure areas</li>
                        <li>• Cannot save preferences</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">7.2 Performance Cookies</h4>
                    <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6">
                      <p className="text-base sm:text-lg font-bold text-black mb-2">Can be disabled.</p>
                      <p className="text-base sm:text-lg text-gray-700 leading-relaxed">You can still use the Platform, but:</p>
                      <ul className="space-y-2 text-base sm:text-lg text-gray-700 mt-3">
                        <li>• We can&apos;t improve based on your feedback</li>
                        <li>• You may experience slower performance</li>
                        <li>• Some features may not work optimally</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">7.3 Functionality Cookies</h4>
                    <div className="bg-blue-50 rounded-2xl p-4 sm:p-6">
                      <p className="text-base sm:text-lg font-bold text-black mb-2">Can be disabled.</p>
                      <p className="text-base sm:text-lg text-gray-700 leading-relaxed">You can still use the Platform, but:</p>
                      <ul className="space-y-2 text-base sm:text-lg text-gray-700 mt-3">
                        <li>• Settings won&apos;t be remembered between sessions</li>
                        <li>• You&apos;ll need to reset preferences each visit</li>
                        <li>• Personalization won&apos;t work</li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">7.4 Advertising Cookies</h4>
                    <div className="bg-emerald-50 rounded-2xl p-4 sm:p-6">
                      <p className="text-base sm:text-lg font-bold text-black mb-2">Can be disabled.</p>
                      <p className="text-base sm:text-lg text-gray-700 leading-relaxed">You can still use the Platform, and:</p>
                      <ul className="space-y-2 text-base sm:text-lg text-gray-700 mt-3">
                        <li>• You&apos;ll still see ads (just less relevant)</li>
                        <li>• We can&apos;t measure ad campaign effectiveness</li>
                        <li>• You may see the same ads repeatedly</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 8 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">8. DO NOT TRACK (DNT)</h3>
                
                <div className="space-y-6">
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                    Some browsers offer a &quot;Do Not Track&quot; (DNT) signal. Currently, there is no industry standard for how to respond to DNT signals.
                  </p>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">Our Approach:</h4>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                      <li>• We recognize DNT signals where technically feasible</li>
                      <li>• We honor opt-outs through cookie settings and third-party tools</li>
                      <li>• We don&apos;t use DNT as the sole mechanism due to lack of standardization</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* SECTION 9 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">9. CHILDREN&apos;S PRIVACY</h3>
                
                <div className="space-y-6">
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                    Our Platform is not intended for anyone under 18. We do not knowingly use cookies to collect data from children.
                  </p>
                  
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                    If you believe we have inadvertently collected data from a minor, contact us immediately.
                  </p>
                </div>
              </div>

              {/* SECTION 10 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">10. CHANGES TO THIS COOKIE POLICY</h3>
                
                <div className="space-y-6">
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-3">
                    We may update this Cookie Policy to reflect:
                  </p>
                  <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4 mb-4">
                    <li>• New cookies or tracking technologies</li>
                    <li>• Changes in legal requirements</li>
                    <li>• New third-party partners</li>
                    <li>• User feedback</li>
                  </ul>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">We will notify you of material changes via:</h4>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                      <li>• Email notification</li>
                      <li>• In-app notification</li>
                      <li>• Updated &quot;Last Updated&quot; date on this page</li>
                    </ul>
                  </div>

                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                    Your continued use after changes constitutes acceptance.
                  </p>
                </div>
              </div>

              {/* SECTION 11 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">11. CONTACT US</h3>
                
                <div className="space-y-6">
                  <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-4">
                    Questions about cookies or privacy:
                  </p>

                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-2xl p-4 sm:p-6">
                      <h4 className="text-lg font-semibold text-black mb-3">Data Protection Officer:</h4>
                      <ul className="space-y-2 text-base sm:text-lg text-gray-700">
                        <li>• Address: Gro Equity Ltd, Abbey Farm Church Street, Higham, Rochester, England, ME3 7LS</li>
                      </ul>
                    </div>

                    <div className="bg-emerald-50 rounded-2xl p-4 sm:p-6">
                      <h4 className="text-lg font-semibold text-black mb-3">General Support:</h4>
                      <ul className="space-y-2 text-base sm:text-lg text-gray-700">
                        <li>• Address: Gro Equity Ltd, Abbey Farm Church Street, Higham, Rochester, England, ME3 7LS</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 12 */}
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6">12. USEFUL RESOURCES</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">Learn more about cookies:</h4>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                      <li>• <a href="https://www.aboutcookies.org/" className="text-blue-600 underline">About Cookies</a></li>
                      <li>• <a href="https://www.allaboutcookies.org/" className="text-blue-600 underline">All About Cookies</a></li>
                      <li>• <a href="https://ico.org.uk/for-organisations/guide-to-pecr/cookies-and-similar-technologies/" className="text-blue-600 underline">ICO - Cookies Guidance</a></li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-lg sm:text-xl font-semibold text-black mb-3">Manage online advertising:</h4>
                    <ul className="space-y-2 text-base sm:text-lg text-gray-700 ml-4">
                      <li>• <a href="http://www.youronlinechoices.com/" className="text-blue-600 underline">Your Online Choices</a></li>
                      <li>• <a href="http://optout.aboutads.info/" className="text-blue-600 underline">Digital Advertising Alliance</a></li>
                      <li>• <a href="http://optout.networkadvertising.org/" className="text-blue-600 underline">Network Advertising Initiative</a></li>
                    </ul>
                  </div>
                </div>
              </div>
            
              {/* Document Footer */}
              <div className="text-center pt-8 sm:pt-12 border-t border-gray-200">
                <div className="space-y-2 mb-6">
                  <p className="text-base sm:text-lg text-gray-600">Last Updated: 04/10/2025</p>
                  <p className="text-base sm:text-lg text-gray-600">Effective Date: 04/10/2025</p>
                  <p className="text-base sm:text-lg text-gray-600">Version: 1.0</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-black mb-4">END OF COOKIE POLICY</p>
                <p className="text-sm text-gray-600">© 2025 Gro Equity Ltd. All rights reserved.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Cookies;