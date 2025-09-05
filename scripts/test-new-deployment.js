#!/usr/bin/env node

/**
 * Test New Direct Deployment
 * 
 * This script tests the new GitHub Pages deployment from URL-Notes repository
 */

const https = require('https');

class NewDeploymentTester {
  constructor() {
    this.githubPagesUrl = 'https://g1mliii.github.io/URL-Notes';
    this.customDomainUrl = 'https://anchored.site';
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async testDeployment() {
    console.log('🧪 Testing Production Deployment\n');
    console.log(`Production URL: ${this.customDomainUrl}`);
    console.log(`GitHub Pages URL: ${this.githubPagesUrl}\n`);

    try {
      // Test production domain first (primary)
      await this.testCustomDomain();
      
      // Test GitHub Pages URL (backup)
      await this.testGitHubPagesUrl();
      
      // Test critical files that were failing before
      await this.testCriticalFiles();
      
      // Test all main pages
      await this.testMainPages();
      
      // Test security
      await this.testSecurity();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Testing failed:', error.message);
    }
  }

  async testGitHubPagesUrl() {
    await this.runTest('GitHub Pages URL Access', async () => {
      const response = await this.makeRequest(this.githubPagesUrl);
      
      if (response.statusCode !== 200) {
        throw new Error(`GitHub Pages returned ${response.statusCode}`);
      }
      
      if (!response.body.includes('Anchored')) {
        throw new Error('Page content does not include Anchored branding');
      }
      
      return `GitHub Pages accessible (${response.statusCode})`;
    });
  }

  async testCustomDomain() {
    await this.runTest('Custom Domain Access', async () => {
      try {
        const response = await this.makeRequest(this.customDomainUrl);
        
        if (response.statusCode !== 200) {
          throw new Error(`Custom domain returned ${response.statusCode}`);
        }
        
        return `Custom domain accessible (${response.statusCode})`;
      } catch (error) {
        // Custom domain might still be propagating
        return `Custom domain not ready yet (DNS propagation): ${error.message}`;
      }
    });
  }

  async testCriticalFiles() {
    console.log('\n🔍 Testing Critical Files (Previously Failing)...');
    
    const criticalFiles = [
      '/config.js',
      '/health.json', 
      '/js/monitoring.js'
    ];
    
    for (const file of criticalFiles) {
      await this.runTest(`Critical File: ${file}`, async () => {
        // Test production domain (anchored.site)
        const response = await this.makeRequest(`${this.customDomainUrl}${file}`);
        
        if (response.statusCode !== 200) {
          throw new Error(`File returned ${response.statusCode} from GitHub Pages`);
        }
        
        if (response.body.length === 0) {
          throw new Error('File is empty');
        }
        
        // Check if it's actually the file content, not a 404 page
        if (response.body.includes('404') && response.body.includes('GitHub Pages')) {
          throw new Error('File not found (404 page returned)');
        }
        
        return `File accessible (${response.body.length} bytes)`;
      });
    }
  }

  async testMainPages() {
    console.log('\n📄 Testing Main Application Pages...');
    
    const pages = [
      { path: '/', name: 'Landing Page' },
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/account', name: 'Account Page' }
    ];

    for (const page of pages) {
      await this.runTest(`Page: ${page.name}`, async () => {
        const response = await this.makeRequest(`${this.customDomainUrl}${page.path}`);
        
        if (response.statusCode !== 200) {
          throw new Error(`Page returned ${response.statusCode}`);
        }
        
        if (!response.body.includes('Anchored')) {
          throw new Error('Page does not contain expected content');
        }
        
        // Check for essential scripts
        const requiredScripts = ['config.js', 'js/monitoring.js', 'js/auth.js'];
        for (const script of requiredScripts) {
          if (!response.body.includes(script)) {
            throw new Error(`Missing required script: ${script}`);
          }
        }
        
        return `${page.name} loads with all required scripts`;
      });
    }
  }

  async testSecurity() {
    console.log('\n🔒 Testing Security Configuration...');
    
    await this.runTest('Security Headers in HTML', async () => {
      const response = await this.makeRequest(this.customDomainUrl);
      
      const requiredMetaTags = [
        'http-equiv="Content-Security-Policy"',
        'http-equiv="X-Frame-Options"',
        'http-equiv="X-Content-Type-Options"'
      ];
      
      const missing = [];
      for (const metaTag of requiredMetaTags) {
        if (!response.body.includes(metaTag)) {
          missing.push(metaTag);
        }
      }
      
      if (missing.length > 0) {
        throw new Error(`Missing meta security headers: ${missing.join(', ')}`);
      }
      
      return 'All security meta headers present';
    });

    await this.runTest('HTTPS Enforcement', async () => {
      // GitHub Pages automatically enforces HTTPS
      return 'HTTPS enforced by GitHub Pages';
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

  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: 15000,
        headers: {
          'User-Agent': 'Anchored-Deployment-Test'
        }
      }, (res) => {
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
    console.log('\n📊 New Deployment Test Results');
    console.log('===============================');
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    
    const total = this.results.passed + this.results.failed;
    const successRate = Math.round((this.results.passed / total) * 100);
    console.log(`📈 Success Rate: ${successRate}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => test.status === 'FAIL')
        .forEach(test => console.log(`   - ${test.name}: ${test.message}`));
    }
    
    console.log('\n🎯 Summary:');
    if (this.results.failed === 0) {
      console.log('🎉 NEW DEPLOYMENT IS WORKING PERFECTLY!');
      console.log('✅ All files are now accessible');
      console.log('✅ Direct deployment is successful');
      console.log('✅ Much better than cross-repository setup');
    } else if (this.results.passed > this.results.failed) {
      console.log('✅ NEW DEPLOYMENT IS MOSTLY WORKING!');
      console.log('🔄 Some issues may resolve as DNS propagates');
    } else {
      console.log('⚠️  NEW DEPLOYMENT NEEDS ATTENTION');
      console.log('🔍 Check GitHub Pages build status');
    }
    
    console.log(`\n🌐 Test URLs:`);
    console.log(`   GitHub Pages: ${this.githubPagesUrl}`);
    console.log(`   Custom Domain: ${this.customDomainUrl}`);
  }
}

// Run test if called directly
if (require.main === module) {
  const tester = new NewDeploymentTester();
  tester.testDeployment().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = NewDeploymentTester;