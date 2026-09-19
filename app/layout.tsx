import './globals.css';
import './install.css';
import InstallApp from '@/components/InstallApp';
import NativeAppBridge from '@/components/NativeAppBridge';

export const metadata = {
  title: 'Sports Syndicate Fantasy',
  description: 'Multi-sport survivor, pick’em, bracket and prize draw platform',
  applicationName: 'Sports Syndicate Fantasy',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black' as const, title: 'Sports Syndicate Fantasy' },
  formatDetection: { telephone: false },
};

export const viewport = { themeColor: '#080a0f', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><NativeAppBridge/>{children}<InstallApp/></body></html>;
}
