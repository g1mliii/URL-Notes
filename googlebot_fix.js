// Add this function to detect search engine crawlers
function isSearchEngineCrawler() {
  const userAgent = navigator.userAgent.toLowerCase();
  const crawlers = [
    'googlebot',
    'bingbot', 
    'slurp',
    'duckduckbot',
    'baiduspider',
    'yandexbot',
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot'
  ];
  
  return crawlers.some(crawler => userAgent.includes(crawler));
}

// Modify your redirect logic in app.js
function initializeApp() {
  // Skip redirects for search engine crawlers
  if (isSearchEngineCrawler()) {
    console.log('Search engine crawler detected, skipping redirects');
    return;
  }
  
  // Your existing redirect logic here...
  if (window.auth && window.auth.isAuthenticated()) {
    window.location.href = '/dashboard';
  }
}