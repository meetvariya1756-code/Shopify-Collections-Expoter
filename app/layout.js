import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ShopifyAppBridgeProvider } from '@/components/ShopifyAppBridgeProvider';

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
      <head>
        <meta
          name="shopify-api-key"
          content={process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || ''}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var isInsideShopify = false;
                try {
                  isInsideShopify = window.top !== window.self;
                } catch(e) {
                  isInsideShopify = true;
                }
                var queryParams = window.location.search || '';
                var hasShopifyParams = /[?&](host|shop)=/.test(queryParams);
                if (isInsideShopify || hasShopifyParams) {
                  var script = document.createElement('script');
                  script.src = 'https://cdn.shopify.com/shopifycloud/app-bridge.js';
                  script.async = false;
                  document.head.appendChild(script);
                }
              })();
            `
          }}
        />
      </head>
      <body>
        <ShopifyAppBridgeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ShopifyAppBridgeProvider>
      </body>
    </html>
  );
}