import Head from 'next/head';
import { GetStaticProps } from 'next';
import Terms from './terms';

interface TermsPageProps {
  metadata: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
  };
}

export default function Index({ metadata }: TermsPageProps) {
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
      <Terms />
    </>
  );
}

export const getStaticProps: GetStaticProps<TermsPageProps> = async () => {
  const metadata = {
    title: "Terms of Service - Quix MTD Tax Software",
    description: "Read Quix's terms of service to understand your rights and responsibilities when using our MTD tax compliance software and services.",
    keywords: "terms of service, user agreement, terms and conditions, service terms, Quix legal",
    canonicalUrl: "https://quix.co.uk/policy/terms"
  };

  return {
    props: {
      metadata
    },
    revalidate: 86400 // Revalidate daily for legal content
  };
};