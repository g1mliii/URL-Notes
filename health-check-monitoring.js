
// Production Health Check Validation
// Add this to your external monitoring service

const healthChecks = {
  endpoints: [
    'https://anchored.site',
    'https://anchored.site/dashboard.html',
    'https://anchored.site/account.html'
  ],
  
  async checkEndpoint(url) {
    try {
      const response = await fetch(url);
      return {
        url,
        status: response.status,
        ok: response.ok,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        url,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  },
  
  async runAllChecks() {
    const results = [];
    for (const endpoint of this.endpoints) {
      const result = await this.checkEndpoint(endpoint);
      results.push(result);
    }
    return results;
  }
};

// Usage: healthChecks.runAllChecks().then(console.log);
