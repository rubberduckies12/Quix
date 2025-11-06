// Global SEO configuration for Quix
export const globalSEO = {
  defaultTitle: "Quix - Automated MTD Tax Compliance Made Simple",
  titleTemplate: "%s | Quix",
  defaultDescription: "Streamline your UK tax compliance with Quix's automated MTD software. Upload spreadsheets, get instant categorization, and submit quarterly returns effortlessly.",
  siteUrl: "https://quix.co.uk",
  siteName: "Quix",
  locale: "en_GB",
  type: "website",
  images: [
    {
      url: "https://quix.co.uk/Quix/Q-logo.png",
      width: 1200,
      height: 630,
      alt: "Quix - MTD Tax Compliance Software",
    },
  ],
  twitter: {
    handle: "@QuixTax",
    site: "@QuixTax",
    cardType: "summary_large_image",
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "https://quix.co.uk",
    siteName: "Quix",
    images: [
      {
        url: "https://quix.co.uk/Quix/Q-logo.png",
        width: 1200,
        height: 630,
        alt: "Quix - MTD Tax Compliance Software",
      },
    ],
  },
  additionalMetaTags: [
    {
      name: "author",
      content: "Quix",
    },
    {
      name: "language",
      content: "en-GB",
    },
    {
      name: "geo.region",
      content: "GB",
    },
    {
      name: "geo.country",
      content: "United Kingdom",
    },
    {
      name: "geo.placename",
      content: "United Kingdom",
    },
    {
      httpEquiv: "x-ua-compatible",
      content: "IE=edge",
    },
  ],
  additionalLinkTags: [
    {
      rel: "icon",
      href: "/Quix/Q-logo.png",
    },
    {
      rel: "apple-touch-icon",
      href: "/Quix/Q-logo.png",
      sizes: "76x76",
    },
    {
      rel: "manifest",
      href: "/manifest.json",
    },
  ],
};

// Page-specific SEO configurations
export const pageSEO = {
  home: {
    title: "Quix - Automated MTD Tax Compliance Made Simple | UK Tax Software",
    description: "Streamline your UK tax compliance with Quix's automated MTD (Making Tax Digital) software. Upload spreadsheets, get instant categorization, and submit quarterly returns effortlessly.",
    keywords: "MTD, Making Tax Digital, UK tax software, automated tax compliance, quarterly returns, VAT returns, HMRC submissions, tax categorization, bookkeeping, small business tax",
  },
  about: {
    title: "About Quix - Simplifying UK Tax Compliance | MTD Software Company",
    description: "Learn about Quix's mission to simplify UK tax compliance through automated MTD software. Discover our story, values, and commitment to helping small businesses with tax submissions.",
    keywords: "About Quix, MTD software company, UK tax compliance, automated bookkeeping, small business solutions, tax technology, HMRC compliance",
  },
  product: {
    title: "Quix MTD Software Features - Automated Tax Compliance | Product Overview",
    description: "Explore Quix's powerful MTD software features: automated transaction categorization, quarterly submissions, HMRC compliance, and seamless spreadsheet integration for UK businesses.",
    keywords: "MTD software features, automated tax categorization, quarterly submissions, HMRC compliance, spreadsheet integration, VAT returns, tax automation",
  },
  waitlist: {
    title: "Join Quix Waitlist - Early Access to MTD Tax Software | Sign Up Now",
    description: "Join the Quix waitlist for early access to our revolutionary MTD tax compliance software. Be among the first to experience automated tax submissions for UK businesses.",
    keywords: "Quix waitlist, early access, MTD software launch, tax software beta, automated compliance, UK business tax",
  },
  login: {
    title: "Login to Quix - Access Your MTD Tax Dashboard | Secure Sign In",
    description: "Sign in to your Quix account to access automated MTD tax compliance features, manage submissions, and track your quarterly returns securely.",
    keywords: "Quix login, MTD account access, tax dashboard login, secure sign in, account management",
  },
  register: {
    title: "Create Quix Account - Start Your MTD Tax Journey | Free Registration",
    description: "Create your free Quix account to access automated MTD tax compliance features. Join thousands of UK businesses simplifying their tax submissions.",
    keywords: "Quix registration, create account, MTD signup, free tax software account, UK business registration",
  },
  privacy: {
    title: "Privacy Policy - Quix MTD Tax Software",
    description: "Read Quix's privacy policy to understand how we collect, use, and protect your personal information when using our MTD tax compliance software.",
    keywords: "privacy policy, data protection, GDPR compliance, personal information, Quix privacy",
    robots: "noindex, nofollow",
  },
  terms: {
    title: "Terms of Service - Quix MTD Tax Software",
    description: "Read Quix's terms of service to understand your rights and responsibilities when using our MTD tax compliance software and services.",
    keywords: "terms of service, user agreement, terms and conditions, service terms, Quix legal",
    robots: "noindex, nofollow",
  },
  cookies: {
    title: "Cookie Policy - Quix MTD Tax Software",
    description: "Learn about how Quix uses cookies and similar technologies to improve your experience with our MTD tax compliance software.",
    keywords: "cookie policy, website cookies, tracking technologies, privacy settings, Quix cookies",
    robots: "noindex, nofollow",
  },
};

// Structured data generators
export const generateOrganizationLD = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Quix",
  "description": "Automated MTD tax compliance software for UK businesses",
  "url": "https://quix.co.uk",
  "logo": "https://quix.co.uk/Quix/Q-logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "areaServed": "GB",
    "availableLanguage": "en"
  },
  "sameAs": [
    // Add social media URLs when available
  ]
});

export const generateWebsiteLD = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Quix",
  "description": "Automated MTD tax compliance software for UK businesses",
  "url": "https://quix.co.uk",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://quix.co.uk/search?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
});

export const generateProductLD = () => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Quix MTD Software",
  "description": "Automated MTD tax compliance software for UK businesses",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "availability": "https://schema.org/OnlineOnly",
    "priceCurrency": "GBP"
  },
  "provider": {
    "@type": "Organization",
    "name": "Quix"
  }
});