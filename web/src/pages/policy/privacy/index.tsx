import Head from 'next/head';
import { GetStaticProps } from 'next';
import Privacy from './privacy';

interface PrivacyPageProps {
  metadata: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
  };
}

export default function Index({ metadata }: PrivacyPageProps) {
  return (
    <>
      <Head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta name="keywords" content={metadata.keywords} />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={metadata.canonicalUrl} />
        
        {/* Additional SEO */}
        <meta name="author" content="Quix" />
        <meta name="language" content="en-GB" />
      </Head>
      <Privacy />
    </>
  );
}

export const getStaticProps: GetStaticProps<PrivacyPageProps> = async () => {
  const metadata = {
    title: "Privacy Policy - Quix MTD Tax Software",
    description: "Read Quix's privacy policy to understand how we collect, use, and protect your personal information when using our MTD tax compliance software.",
    keywords: "privacy policy, data protection, GDPR compliance, personal information, Quix privacy",
    canonicalUrl: "https://quix.co.uk/policy/privacy"
  };

  return {
    props: {
      metadata
    },
    revalidate: 86400 // Revalidate daily for legal content
  };
};