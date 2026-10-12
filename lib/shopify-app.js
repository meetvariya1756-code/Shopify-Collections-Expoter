import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion } from '@shopify/shopify-api';

const rawHost = process.env.HOST || 'http://localhost:3000';
const hostName = rawHost.replace(/^https?:\/\//, '').replace(/\/$/, '');

export const shopify = shopifyApi({
  apiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || 'shopify_api_key_placeholder',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || 'shopify_api_secret_placeholder',
  scopes: (process.env.SCOPES || 'read_products,write_products').split(','),
  hostName: hostName || 'localhost:3000',
  hostScheme: rawHost.startsWith('http://') ? 'http' : 'https',
  apiVersion: ApiVersion.October24,
  isEmbeddedApp: true,
});

export default shopify;
