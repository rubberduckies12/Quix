import { GetServerSideProps } from 'next';

const Robots = () => {
  // This component doesn't render anything
  return null;
};

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const robots = `User-agent: *
Allow: /
Disallow: /policy/
Disallow: /api/

Sitemap: https://quix.co.uk/sitemap.xml`;

  res.setHeader('Content-Type', 'text/plain');
  res.write(robots);
  res.end();

  return {
    props: {},
  };
};

export default Robots;