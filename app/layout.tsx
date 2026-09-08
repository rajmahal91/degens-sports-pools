import './globals.css';

export const metadata = {
  title: 'Degens Sports Pools',
  description: 'Multi-sport survivor, pick’em, bracket and prize draw platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
