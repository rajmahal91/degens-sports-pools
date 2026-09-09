import './globals.css';
import './install.css';
import InstallApp from '@/components/InstallApp';

export const metadata = {
  title: 'Degens Sports Pools',
  description: 'Multi-sport survivor, pick’em, bracket and prize draw platform',
  applicationName: 'Degens Sports Pools',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent' as const, title: 'Degens Pools' },
  formatDetection: { telephone: false },
};

export const viewport = { themeColor: '#080a0f', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}<InstallApp/></body></html>;
}
