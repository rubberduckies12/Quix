import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" href="/Quix/Q-logo.png" />
        <link rel="apple-touch-icon" href="/Quix/Q-logo.png" />
        <meta name="theme-color" content="#22c55e" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
