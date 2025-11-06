import Head from 'next/head';
import { GetStaticProps } from 'next';
import Home from './home/home';

interface HomePageProps {
  metadata: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
  };
}

export default function Index({ metadata }: HomePageProps) {
  return (
    <>
      <Head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta name="keywords" content={metadata.keywords} />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={metadata.canonicalUrl} />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={metadata.canonicalUrl} />
        <meta property="og:title" content={metadata.title} />
        <meta property="og:description" content={metadata.description} />
        <meta property="og:image" content="https://quix.co.uk/Quix/Q-logo.png" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={metadata.canonicalUrl} />
        <meta property="twitter:title" content={metadata.title} />
        <meta property="twitter:description" content={metadata.description} />
        <meta property="twitter:image" content="https://quix.co.uk/Quix/Q-logo.png" />
        
        {/* Additional SEO */}
        <meta name="author" content="Quix" />
        <meta name="language" content="en-GB" />
        <meta name="geo.region" content="GB" />
        <meta name="geo.country" content="United Kingdom" />
        <meta name="geo.placename" content="United Kingdom" />
        
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Quix",
              "description": metadata.description,
              "url": metadata.canonicalUrl,
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": "https://quix.co.uk/search?q={search_term_string}"
                },
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </Head>
      <Home />
    </>
  );
}

export const getStaticProps: GetStaticProps<HomePageProps> = async () => {
  const metadata = {
    title: "Quix - Automated MTD Tax Compliance Made Simple | UK Tax Software",
    description: "Streamline your UK tax compliance with Quix's automated MTD (Making Tax Digital) software. Upload spreadsheets, get instant categorization, and submit quarterly returns effortlessly.",
    keywords: "MTD, Making Tax Digital, UK tax software, automated tax compliance, quarterly returns, VAT returns, HMRC submissions, tax categorization, bookkeeping, small business tax",
    canonicalUrl: "https://quix.co.uk"
  };

  return {
    props: {
      metadata
    },
    revalidate: 3600 // Revalidate every hour
  };
};