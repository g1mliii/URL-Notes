#!/usr/bin/env node

/**
 * Anchored Web Application - Production Deployment Verification
 * 
 * This script verifies that the production deployment is working correctly
 * by testing all critical functionality and endpoints.
 */

const https = require('https');
const http = require('http');

class DeploymentVerifier {
  constructor() {
    this.baseUrl = 'https://anchored.site';
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Anchored Web Application Deployment Verification\n');
    
    try {
      // Core Infrastructure Tests
      await this.testDomainResolution();
      await this.testHTTPSRedirect();
      await this.testSecurityHeaders();
      await this.testHealthEndpoint();
      
      // Application Tests
      await this.testMainPages();
      await this.testStaticAssets();
      await this.testSupabaseConnection();
      
      // Performance Tests
      await this.testPageLoadTimes();
      
      // Security Tests
      await this.testCSPHeaders();
      await this.testSSLConfiguration();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Deployment verification failed:', error.message);
      process.exit(1);
    }
  }

  async testDomainResolution() {
    return this.runTest('Domain Resolution', async () => {
      const response = await this.makeRequest(this.baseUrl);
      if (response.statusCode !== 200) {
        throw new Error(`Expected 200, got ${response.statusCode}`);
      }
      return 'Domain resolves correctly';
    });
  }

  async testHTTPSRedirect() {
    return this.runTest('HTTPS Redirect', async () => {
      const httpUrl = this.baseUrl.replace('https:', 'http:');
      const response = await this.makeRequest(httpUrl, { followRedirects: false });
      
      if (response.statusCode !== 301 && response.statusCode !== 302) {
        throw new Error(`HTTP should redirect to HTTPS, got ${response.statusCode}`);
      }
      
      const location = response.headers.location;
      if (!location || !location.startsWith('https:')) {
        throw new Error('Redirect location should be HTTPS');
      }
      
      return 'HTTP correctly redirects to HTTPS';
    });
  }

  async testSecurityHeaders() {
    return this.runTest('Security Headers', async () => {
      const response = await this.makeRequest(this.baseUrl);
      const headers = response.headers;
      
      const requiredHeaders = {
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block',
        'referrer-policy': 'strict-origin-when-cross-origin'
      };
      
      const missing = [];
      for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
        if (!headers[header]) {
          missing.push(header);
        } else if (expectedValue && !headers[header].includes(expectedValue)) {
          missing.push(`${header} (incorrect value)`);
        }
      }
      
      if (missing.length > 0) {
        throw new Error(`Missing or incorrect headers: ${missing.join(', ')}`);
      }
      
      return 'All required security headers present';
    });
  }

  async testHealthEndpoint() {
    return this.runTest('Health Endpoint', async () => {
      const response = await this.makeRequest(`${this.baseUrl}/health.json`);
      
      if (response.statusCode !== 200) {
        throw new Error(`Health endpoint returned ${response.statusCode}`);
      }
      
      const health = JSON.parse(response.body);
      
      if (health.status !== 'healthy') {
        throw new Error(`Health status is ${health.status}, expected healthy`);
      }
      
      if (health.environment !== 'production') {
        throw new Error(`Environment is ${health.environment}, expected production`);
      }
      
      return `Health endpoint reports: ${health.status}`;
    });
  }

  async testMainPages() {
    const pages = [
      { path: '/', name: 'Landing Page' },
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/account', name: 'Account Page' }
    ];

    for (const page of pages) {
      await this.runTest(`Page: ${page.name}`, async () => {
        const response = await this.makeRequest(`${this.baseUrl}${page.path}`);
        
        if (response.statusCode !== 200) {
          throw new Error(`Page returned ${response.statusCode}`);
        }
        
        if (!response.body.includes('Anchored')) {
          throw new Error('Page does not contain expected content');
        }
        
        return `${page.name} loads successfully`;
      });
    }
  }

  async testStaticAssets() {
    const assets = [
      '/css/main.css',
      '/css/components.css',
      '/css/responsive.css',
      '/js/app.js',
      '/js/auth.js',
      '/config.js'
    ];

    for (const asset of assets) {
      await this.runTest(`Asset: ${asset}`, async () => {
        const response = await this.makeRequest(`${this.baseUrl}${asset}`);
        
        if (response.statusCode !== 200) {
          throw new Error(`Asset returned ${response.statusCode}`);
        }
        
        if (response.body.length === 0) {
          throw new Error('Asset is empty');
        }
        
        return `Asset loads successfully (${response.body.length} bytes)`;
      });
    }
  }

  async testSupabaseConnection() {
    return this.runTest('Supabase Configuration', async () => {
      const response = await this.makeRequest(`${this.baseUrl}/config.js`);
      
      if (response.statusCode !== 200) {
        throw new Error('Config file not accessible');
      }
      
      if (!response.body.includes('kqjcorjjvunmyrnzvqgr.supabase.co')) {
        throw new Error('Supabase URL not found in config');
      }
      
      if (!response.body.includes('production')) {
        throw new Error('Production environment not configured');
      }
      
      return 'Supabase configuration is correct';
    });
  }

  async testPageLoadTimes() {
    return this.runTest('Page Load Performance', async () => {
      const startTime = Date.now();
      const response = await this.makeRequest(this.baseUrl);
      const loadTime = Date.now() - startTime;
      
      if (response.statusCode !== 200) {
        throw new Error(`Page failed to load: ${response.statusCode}`);
      }
      
      if (loadTime > 3000) {
        throw new Error(`Page load time too slow: ${loadTime}ms`);
      }
      
      return `Page loads in ${loadTime}ms`;
    });
  }

  async testCSPHeaders() {
    return this.runTest('Content Security Policy', async () => {
      const response = await this.makeRequest(this.baseUrl);
      const csp = response.headers['content-security-policy'];
      
      if (!csp) {
        throw new Error('CSP header not found');
      }
      
      const requiredDirectives = [
        "default-src 'self'",
        'https://kqjcorjjvunmyrnzvqgr.supabase.co'
      ];
      
      for (const directive of requiredDirectives) {
        if (!csp.includes(directive)) {
          throw new Error(`CSP missing directive: ${directive}`);
        }
      }
      
      return 'CSP header configured correctly';
    });
  }

  async testSSLConfiguration() {
    return this.runTest('SSL Configuration', async () => {
      return new Promise((resolve, reject) => {
        const req = https.request(this.baseUrl, { method: 'HEAD' }, (res) => {
          const cert = res.socket.getPeerCertificate();
          
          if (!cert || Object.keys(cert).length === 0) {
            reject(new Error('No SSL certificate found'));
            return;
          }
          
          const now = new Date();
          const validFrom = new Date(cert.valid_from);
          const validTo = new Date(cert.valid_to);
          
          if (now < validFrom || now > validTo) {
            reject(new Error('SSL certificate is not valid'));
            return;
          }
          
          const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));
          resolve(`SSL certificate valid (expires in ${daysUntilExpiry} days)`);
        });
        
        req.on('error', (error) => {
          reject(new Error(`SSL test failed: ${error.message}`));
        });
        
        req.end();
      });
    });
  }

  async runTest(name, testFn) {
    try {
      const result = await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASS', message: result });
      console.log(`✅ ${name}: ${result}`);
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAIL', message: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 10000
      };

      const req = client.request(requestOptions, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  printResults() {
    console.log('\n📊 Deployment Verification Results');
    console.log('=====================================');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => test.status === 'FAIL')
        .forEach(test => console.log(`   - ${test.name}: ${test.message}`));
      
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed! Deployment is healthy.');
      process.exit(0);
    }
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new DeploymentVerifier();
  verifier.runAllTests().catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}

module.exports = DeploymentVerifier;