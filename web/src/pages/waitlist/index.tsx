import Head from 'next/head';
import { GetStaticProps } from 'next';
import Waitlist from './waitlist';

interface WaitlistPageProps {
  metadata: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
  };
}

export default function WaitlistPage({ metadata }: WaitlistPageProps) {
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
        
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              "name": "Join Quix Waitlist",
              "description": metadata.description,
              "url": metadata.canonicalUrl,
              "mainEntity": {
                "@type": "Organization",
                "name": "Quix",
                "url": "https://quix.co.uk"
              }
            })
          }}
        />
      </Head>
      <Waitlist />
    </>
  );
}

export const getStaticProps: GetStaticProps<WaitlistPageProps> = async () => {
  const metadata = {
    title: "Join Quix Waitlist - Early Access to MTD Tax Software | Sign Up Now",
    description: "Join the Quix waitlist for early access to our revolutionary MTD tax compliance software. Be among the first to experience automated tax submissions for UK businesses.",
    keywords: "Quix waitlist, early access, MTD software launch, tax software beta, automated compliance, UK business tax",
    canonicalUrl: "https://quix.co.uk/waitlist"
  };

  return {
    props: {
      metadata
    },
    revalidate: 3600
  };
};