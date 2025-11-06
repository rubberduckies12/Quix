import Head from 'next/head';
import { GetStaticProps } from 'next';
import Cookies from './cookies';

interface CookiesPageProps {
  metadata: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
  };
}

export default function Index({ metadata }: CookiesPageProps) {
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
      <Cookies />
    </>
  );
}

export const getStaticProps: GetStaticProps<CookiesPageProps> = async () => {
  const metadata = {
    title: "Cookie Policy - Quix MTD Tax Software",
    description: "Learn about how Quix uses cookies and similar technologies to improve your experience with our MTD tax compliance software.",
    keywords: "cookie policy, website cookies, tracking technologies, privacy settings, Quix cookies",
    canonicalUrl: "https://quix.co.uk/policy/cookies"
  };

  return {
    props: {
      metadata
    },
    revalidate: 86400 // Revalidate daily for legal content
  };
};