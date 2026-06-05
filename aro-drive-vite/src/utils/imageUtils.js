/**
 * Mengoptimalkan URL gambar merchant agar ukurannya pas dan tidak membebani RAM.
 * 
 * @param {string} url - URL asli gambar
 * @param {object} options - Konfigurasi resize (width, height, quality, fit)
 * @returns {string} URL yang sudah dioptimalkan
 */
export const getOptimizedImageUrl = (url, options = {}) => {
  if (!url || typeof url !== 'string') return url;
  
  // Abaikan jika berupa base64 atau path lokal
  if (url.startsWith('data:') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return url;
  }

  const { width = 400, height = 300, quality = 75, fit = 'cover' } = options;

  try {
    // 1. Unsplash optimization
    if (url.includes('unsplash.com')) {
      const urlObj = new URL(url);
      urlObj.searchParams.set('w', width);
      if (height) urlObj.searchParams.set('h', height);
      urlObj.searchParams.set('q', quality);
      urlObj.searchParams.set('fit', fit);
      urlObj.searchParams.set('auto', 'format');
      return urlObj.toString();
    }

    // 2. Google Maps Places API Photo optimization
    if (url.includes('maps.googleapis.com') && url.includes('/place/photo')) {
      const urlObj = new URL(url);
      urlObj.searchParams.set('maxwidth', width);
      if (height && height > width) {
        urlObj.searchParams.set('maxheight', height);
      }
      return urlObj.toString();
    }

    // 3. CDN/Proxy Fallback untuk raw/large images (Firebase Storage, dll.)
    // Skip proxying for Firebase Storage URLs to prevent access token / 403 issues
    if (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com')) {
      return url;
    }

    // Menggunakan wsrv.nl (Cloudflare backed image proxy)
    const proxyUrl = new URL('https://wsrv.nl/');
    proxyUrl.searchParams.set('url', url);
    proxyUrl.searchParams.set('w', width);
    if (height) proxyUrl.searchParams.set('h', height);
    proxyUrl.searchParams.set('fit', fit);
    proxyUrl.searchParams.set('q', quality);
    proxyUrl.searchParams.set('output', 'webp');
    
    return proxyUrl.toString();
  } catch (error) {
    console.error('Error optimizing image URL:', error);
    return url;
  }
};
