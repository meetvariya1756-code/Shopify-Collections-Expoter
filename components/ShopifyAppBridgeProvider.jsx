'use client';

import React, { useEffect } from 'react';
import axios from 'axios';

/**
 * Helper to obtain Shopify session token (idToken) from App Bridge
 */
export async function getShopifyIdToken() {
  if (typeof window === 'undefined') return null;

  try {
    if (window.shopify && typeof window.shopify.idToken === 'function') {
      const token = await window.shopify.idToken();
      return token || null;
    }
  } catch (err) {
    console.warn('[APP_BRIDGE] Unable to retrieve session token:', err?.message || err);
  }

  return null;
}

export function ShopifyAppBridgeProvider({ children }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Setup Axios Request Interceptor for /api/shopify/*
    const axiosInterceptor = axios.interceptors.request.use(async (config) => {
      const url = config.url || '';
      if (url.startsWith('/api/shopify') || url.includes('/api/shopify/')) {
        const token = await getShopifyIdToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers['Authorization'] = `Bearer ${token}`;
        }
      }
      return config;
    });

    // 2. Setup window.fetch Interceptor for SSE streaming & native fetch calls
    const originalFetch = window.fetch;
    window.fetch = async function (input, init = {}) {
      const url = typeof input === 'string' ? input : input?.url || '';

      if (url.includes('/api/shopify/')) {
        const token = await getShopifyIdToken();
        if (token) {
          const headers = new Headers(init.headers || (typeof input === 'object' && input.headers ? input.headers : {}));
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
          }
          init.headers = headers;
        }
      }

      const response = await originalFetch.call(this, input, init);

      // Handle automatic Shopify OAuth re-authorization on 401
      if (
        response.status === 401 &&
        response.headers.get('X-Shopify-API-Request-Failure-Reauthorize') === '1'
      ) {
        const reauthUrl = response.headers.get('X-Shopify-API-Request-Failure-Reauthorize-Url');
        if (reauthUrl) {
          console.warn('[SHOPIFY_AUTH] Session expired or reauthorization required, redirecting top frame...');
          if (window.top) {
            window.top.location.href = reauthUrl;
          } else {
            window.location.href = reauthUrl;
          }
        }
      }

      return response;
    };

    return () => {
      axios.interceptors.request.eject(axiosInterceptor);
      window.fetch = originalFetch;
    };
  }, []);

  return <>{children}</>;
}

export default ShopifyAppBridgeProvider;
