#!/usr/bin/env node

/**
 * Fix Cross-Repository Deployment Issues
 * 
 * This script helps diagnose and fix the cross-repository deployment
 * from URL-Notes to Anchored repository.
 */

const https = require('https');
const { execSync } = require('child_process');

class CrossRepoDeploymentFixer {
  constructor() {
    this.sourceRepo = 'g1mliii/URL-Notes';
    this.targetRepo = 'g1mliii/Anchored';
    this.domain = 'anchored.site';
  }

  async fixDeployment() {
    console.log('🔧 Fixing Cross-Repository Deployment Issues\n');
    console.log(`Source: ${this.sourceRepo}`);
    console.log(`Target: ${this.targetRepo}`);
    console.log(`Domain: ${this.domain}\n`);

    try {
      // Check current deployment status
      await this.checkCurrentStatus();
      
      // Check workflow configuration
      await this.checkWorkflowConfig();
      
      // Provide specific fixes
      await this.provideFixes();
      
      // Test alternative deployment method
      await this.testAlternativeDeployment();
      
    } catch (error) {
      console.error('❌ Fix attempt failed:', error.message);
    }
  }

  async checkCurrentStatus() {
    console.log('🔍 Checking current deployment status...');
    
    try {
      // Check if target repo has recent commits
      const response = await this.makeGitHubAPIRequest(`/repos/${this.targetRepo}/commits?per_page=5`);
      
      if (response.statusCode === 200) {
        const commits = JSON.parse(response.body);
        console.log(`✅ Target repo accessible with ${commits.length} recent commits`);
        
        if (commits.length > 0) {
          const lastCommit = commits[0];
          console.log(`   Last commit: ${lastCommit.commit.message.substring(0, 60)}...`);
          console.log(`   Commit date: ${lastCommit.commit.author.date}`);
          console.log(`   Author: ${lastCommit.commit.author.name}`);
          
          // Check if it's from our deployment
          if (lastCommit.commit.message.includes('deploy:') || 
              lastCommit.commit.message.includes('g1mliii/URL-Notes')) {
            console.log('   ✅ This appears to be from our deployment system');
          } else {
            console.log('   ⚠️  This does not appear to be from our deployment system');
          }
        }
      } else {
        console.log(`❌ Cannot access target repo: ${response.statusCode}`);
      }
      
      // Check domain status
      const domainResponse = await this.makeRequest(`https://${this.domain}`);
      console.log(`✅ Domain accessible: ${domainResponse.statusCode}`);
      
    } catch (error) {
      console.log(`❌ Status check failed: ${error.message}`);
    }
    console.log('');
  }

  async checkWorkflowConfig() {
    console.log('⚙️  Checking workflow configuration...');
    
    try {
      const fs = require('fs');
      const workflowContent = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
      
      // Check for required elements
      const checks = [
        { name: 'personal_token reference', pattern: 'personal_token.*PAGES_DEPLOY_TOKEN' },
        { name: 'external_repository', pattern: 'external_repository.*g1mliii/Anchored' },
        { name: 'publish_dir', pattern: 'publish_dir.*dist' },
        { name: 'cname configuration', pattern: 'cname.*anchored.site' }
      ];
      
      for (const check of checks) {
        const regex = new RegExp(check.pattern, 'i');
        if (regex.test(workflowContent)) {
          console.log(`✅ ${check.name}: Configured`);
        } else {
          console.log(`❌ ${check.name}: Missing or incorrect`);
        }
      }
      
      // Check if files are being copied correctly
      if (workflowContent.includes('cp -r web-app/* dist/')) {
        console.log('✅ File copying: Configured');
      } else {
        console.log('❌ File copying: Missing or incorrect');
      }
      
    } catch (error) {
      console.log(`❌ Workflow config check failed: ${error.message}`);
    }
    console.log('');
  }

  async provideFixes() {
    console.log('💡 Deployment Fix Recommendations:\n');
    
    console.log('1. **Check PAGES_DEPLOY_TOKEN Secret:**');
    console.log('   - Go to: https://github.com/g1mliii/URL-Notes/settings/secrets/actions');
    console.log('   - Verify PAGES_DEPLOY_TOKEN exists');
    console.log('   - Token should have these scopes: repo, workflow, write:packages');
    console.log('   - Token should be a Personal Access Token (classic)');
    console.log('');
    
    console.log('2. **Verify Target Repository Permissions:**');
    console.log('   - Ensure you have write access to g1mliii/Anchored');
    console.log('   - Check if the repository exists and is accessible');
    console.log('   - Verify GitHub Pages is enabled in the target repo');
    console.log('');
    
    console.log('3. **Check Workflow Logs:**');
    console.log('   - Visit: https://github.com/g1mliii/URL-Notes/actions');
    console.log('   - Look for specific error messages in failed runs');
    console.log('   - Common issues: token permissions, repository access, file paths');
    console.log('');
    
    console.log('4. **Alternative: Direct Deployment**');
    console.log('   - Consider deploying directly from URL-Notes repo');
    console.log('   - Enable GitHub Pages in this repo instead');
    console.log('   - Use same custom domain (anchored.site)');
    console.log('');
  }

  async testAlternativeDeployment() {
    console.log('🧪 Testing Alternative Deployment Method...');
    
    // Create a simple direct deployment workflow
    const directWorkflow = `# Direct GitHub Pages Deployment (Alternative)
name: Deploy Direct to Pages

on:
  workflow_dispatch:  # Manual trigger only for testing

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup Pages
        uses: actions/configure-pages@v4
        
      - name: Build
        run: |
          mkdir -p _site
          cp -r web-app/* _site/
          echo "anchored.site" > _site/CNAME
          touch _site/.nojekyll
          
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./_site
          
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`;

    const fs = require('fs');
    fs.writeFileSync('.github/workflows/deploy-direct.yml', directWorkflow);
    
    console.log('✅ Created alternative direct deployment workflow');
    console.log('   File: .github/workflows/deploy-direct.yml');
    console.log('   This can be used if cross-repo deployment continues to fail');
    console.log('');
    
    console.log('📋 To use the alternative deployment:');
    console.log('1. Enable GitHub Pages in this repository (URL-Notes)');
    console.log('2. Set source to "GitHub Actions"');
    console.log('3. Configure custom domain: anchored.site');
    console.log('4. Run the workflow manually from Actions tab');
    console.log('');
  }

  makeGitHubAPIRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        port: 443,
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': 'Anchored-Deployment-Fix',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      const req = https.request({
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'GET',
        timeout: 10000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }
}

// Run fix if called directly
if (require.main === module) {
  const fixer = new CrossRepoDeploymentFixer();
  fixer.fixDeployment().catch(error => {
    console.error('Fix failed:', error);
    process.exit(1);
  });
}

module.exports = CrossRepoDeploymentFixer;