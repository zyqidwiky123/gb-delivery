import Fuse from 'fuse.js';

let fuse;

// Listen for messages from the main thread
self.onmessage = function (e) {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    // Initialize Fuse with the provided data and options
    const { items, options } = payload;
    
    // Default options for fuzzy search
    const fuseOptions = {
      keys: ['name', 'category', 'keywords'],
      threshold: 0.3, // 0.0 is perfect match, 1.0 is matches anything
      distance: 100,
      ignoreLocation: true,
      minMatchCharLength: 2,
      ...options,
    };
    
    fuse = new Fuse(items, fuseOptions);
    
    self.postMessage({ type: 'INIT_DONE', payload: { count: items.length } });
  } 
  
  else if (type === 'SEARCH') {
    // Perform search
    const { query } = payload;
    
    if (!fuse) {
      self.postMessage({ type: 'SEARCH_RESULTS', payload: { results: [], query } });
      return;
    }

    if (!query || query.trim() === '') {
      self.postMessage({ type: 'SEARCH_RESULTS', payload: { results: [], query } });
      return;
    }

    // Measure time for debugging/monitoring
    const start = performance.now();
    const results = fuse.search(query).map(result => result.item);
    const end = performance.now();

    self.postMessage({ 
      type: 'SEARCH_RESULTS', 
      payload: { 
        results, 
        query,
        timeMs: (end - start).toFixed(2)
      } 
    });
  }
};
