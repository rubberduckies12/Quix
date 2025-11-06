import Head from 'next/head';
import { GetStaticProps } from 'next';
import LoginPage from './login';

interface LoginIndexProps {
  metadata: {
    title: string;
    description: string;
    keywords: string;
    canonicalUrl: string;
  };
}

export default function Index({ metadata }: LoginIndexProps) {
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
      </Head>
      <LoginPage />
    </>
  );
}

export const getStaticProps: GetStaticProps<LoginIndexProps> = async () => {
  const metadata = {
    title: "Login to Quix - Access Your MTD Tax Dashboard | Secure Sign In",
    description: "Sign in to your Quix account to access automated MTD tax compliance features, manage submissions, and track your quarterly returns securely.",
    keywords: "Quix login, MTD account access, tax dashboard login, secure sign in, account management",
    canonicalUrl: "https://quix.co.uk/login"
  };

  return {
    props: {
      metadata
    },
    revalidate: 3600
  };
};