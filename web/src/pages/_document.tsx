import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en-GB">
      <Head>
        {/* Favicon and Icons */}
        <link rel="icon" href="/Quix/Q-logo.png" />
        <link rel="apple-touch-icon" href="/Quix/Q-logo.png" />
        <link rel="shortcut icon" href="/Quix/Q-logo.png" />
        
        {/* Theme and Browser Config */}
        <meta name="theme-color" content="#22c55e" />
        <meta name="msapplication-TileColor" content="#22c55e" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Preconnect to External Domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        
        {/* Global Site Verification (if needed) */}
        {/* <meta name="google-site-verification" content="your-verification-code" /> */}
        
        {/* Security Headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        
        {/* DNS Prefetch for Performance */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//www.google-analytics.com" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
