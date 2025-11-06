import Head from 'next/head';
import { GetStaticProps } from 'next';
import Product from './product';

interface ProductPageProps {
  metadata: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
  };
}

export default function Index({ metadata }: ProductPageProps) {
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
        <meta property="og:type" content="product" />
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
              "@type": "Product",
              "name": "Quix MTD Software",
              "description": metadata.description,
              "url": metadata.canonicalUrl,
              "brand": {
                "@type": "Brand",
                "name": "Quix"
              },
              "offers": {
                "@type": "Offer",
                "availability": "https://schema.org/OnlineOnly",
                "priceCurrency": "GBP"
              }
            })
          }}
        />
      </Head>
      <Product />
    </>
  );
}

export const getStaticProps: GetStaticProps<ProductPageProps> = async () => {
  const metadata = {
    title: "Quix MTD Software Features - Automated Tax Compliance | Product Overview",
    description: "Explore Quix's powerful MTD software features: automated transaction categorization, quarterly submissions, HMRC compliance, and seamless spreadsheet integration for UK businesses.",
    keywords: "MTD software features, automated tax categorization, quarterly submissions, HMRC compliance, spreadsheet integration, VAT returns, tax automation",
    canonicalUrl: "https://quix.co.uk/product"
  };

  return {
    props: {
      metadata
    },
    revalidate: 3600
  };
};