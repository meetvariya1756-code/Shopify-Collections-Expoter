import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Shopify Collections — Excel Exporter & Importer',
  description: 'Export all Shopify collections (Smart & Manual) with rules, product tags, and images to Excel (.xlsx), then import them into any Shopify store.',
  keywords: ['Shopify', 'collections', 'export', 'import', 'Excel', 'migration', 'product tags'],
  openGraph: {
    title: 'Shopify Collections Excel Exporter & Importer',
    description: 'Zero data-loss Shopify collection migration via Excel spreadsheets.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
