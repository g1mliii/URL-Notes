#!/usr/bin/env node

/**
 * Cross-Repository Deployment Diagnostics
 * 
 * This script helps diagnose issues with the cross-repository deployment
 * from URL-Notes to Anchored repository.
 */

const { execSync } = require('child_process');
const https = require('https');

class CrossRepoDeploymentDiagnostics {
  constructor() {
    this.sourceRepo = 'g1mliii/URL-Notes';
    this.targetRepo = 'g1mliii/Anchored';
    this.domain = 'anchored.site';
  }

  async runDiagnostics() {
    console.log('🔍 Cross-Repository Deployment Diagnostics\n');
    console.log(`Source Repository: ${this.sourceRepo}`);
    console.log(`Target Repository: ${this.targetRepo}`);
    console.log(`Domain: ${this.domain}\n`);

    try {
      // Check local files
      await this.checkLocalFiles();
      
      // Check GitHub Actions workflow
      await this.checkWorkflowStatus();
      
      // Check target repository
      await this.checkTargetRepository();
      
      // Check deployment status
      await this.checkDeploymentStatus();
      
      // Provide recommendations
      this.provideRecommendations();
      
    } catch (error) {
      console.error('❌ Diagnostics failed:', error.message);
    }
  }

  async checkLocalFiles() {
    console.log('📁 Checking local files in web-app/...');
    
    const criticalFiles = [
      'web-app/index.html',
      'web-app/config.js',
      'web-app/health.json',
      'web-app/js/monitoring.js',
      'web-app/js/auth.js',
      'web-app/js/app.js',
      'web-app/CNAME'
    ];
    
    for (const file of criticalFiles) {
      try {
        const stats = require('fs').statSync(file);
        console.log(`✅ ${file} (${stats.size} bytes)`);
      } catch (error) {
        console.log(`❌ ${file} - Missing`);
      }
    }
    console.log('');
  }

  async checkWorkflowStatus() {
    console.log('🔧 Checking GitHub Actions workflow...');
    
    try {
      // Check if workflow file exists
      const workflowExists = require('fs').existsSync('.github/workflows/deploy.yml');
      console.log(`✅ Workflow file exists: ${workflowExists}`);
      
      // Check recent commits
      const recentCommits = execSync('git log --oneline -3', { encoding: 'utf8' });
      console.log('📝 Recent commits:');
      recentCommits.split('\n').filter(line => line.trim()).forEach(commit => {
        console.log(`   ${commit}`);
      });
      
      // Check if there are any workflow runs (this would require GitHub CLI or API)
      console.log('⚠️  To check workflow runs, visit:');
      console.log(`   https://github.com/${this.sourceRepo}/actions`);
      
    } catch (error) {
      console.log(`❌ Workflow check failed: ${error.message}`);
    }
    console.log('');
  }

  async checkTargetRepository() {
    console.log('🎯 Checking target repository...');
    
    try {
      // Check if target repo is accessible via GitHub API
      const response = await this.makeGitHubAPIRequest(`/repos/${this.targetRepo}`);
      
      if (response.statusCode === 200) {
        const repoData = JSON.parse(response.body);
        console.log(`✅ Target repository exists: ${repoData.full_name}`);
        console.log(`   Default branch: ${repoData.default_branch}`);
        console.log(`   Pages enabled: ${repoData.has_pages ? 'Yes' : 'No'}`);
        
        // Check if it has recent commits
        const commitsResponse = await this.makeGitHubAPIRequest(`/repos/${this.targetRepo}/commits?per_page=3`);
        if (commitsResponse.statusCode === 200) {
          const commits = JSON.parse(commitsResponse.body);
          console.log(`   Recent commits: ${commits.length}`);
          if (commits.length > 0) {
            const lastCommit = commits[0];
            console.log(`   Last commit: ${lastCommit.commit.message.substring(0, 50)}...`);
            console.log(`   Commit date: ${lastCommit.commit.author.date}`);
          }
        }
      } else if (response.statusCode === 404) {
        console.log(`❌ Target repository not found or not accessible`);
      } else {
        console.log(`⚠️  Target repository check returned: ${response.statusCode}`);
      }
    } catch (error) {
      console.log(`❌ Target repository check failed: ${error.message}`);
    }
    console.log('');
  }

  async checkDeploymentStatus() {
    console.log('🌐 Checking deployment status...');
    
    try {
      // Check if the domain resolves
      const response = await this.makeRequest(`https://${this.domain}`);
      console.log(`✅ Domain accessible: ${response.statusCode}`);
      
      // Check specific files that should be deployed
      const testFiles = ['/config.js', '/health.json', '/js/monitoring.js'];
      
      for (const file of testFiles) {
        try {
          const fileResponse = await this.makeRequest(`https://${this.domain}${file}`);
          if (fileResponse.statusCode === 200) {
            console.log(`✅ ${file}: Accessible (${fileResponse.body.length} bytes)`);
          } else {
            console.log(`❌ ${file}: ${fileResponse.statusCode}`);
          }
        } catch (error) {
          console.log(`❌ ${file}: Network error`);
        }
      }
      
    } catch (error) {
      console.log(`❌ Deployment status check failed: ${error.message}`);
    }
    console.log('');
  }

  provideRecommendations() {
    console.log('💡 Recommendations:\n');
    
    console.log('1. Check GitHub Actions workflow runs:');
    console.log(`   https://github.com/${this.sourceRepo}/actions`);
    console.log('');
    
    console.log('2. Verify PAGES_DEPLOY_TOKEN secret:');
    console.log(`   - Go to: https://github.com/${this.sourceRepo}/settings/secrets/actions`);
    console.log('   - Ensure PAGES_DEPLOY_TOKEN exists and has proper permissions');
    console.log('   - Token should have "repo" and "workflow" scopes');
    console.log('');
    
    console.log('3. Check target repository permissions:');
    console.log(`   - Verify you have write access to: ${this.targetRepo}`);
    console.log('   - Check if GitHub Pages is enabled in target repo');
    console.log('');
    
    console.log('4. Manual deployment test:');
    console.log('   - Try triggering workflow manually from Actions tab');
    console.log('   - Check workflow logs for specific error messages');
    console.log('');
    
    console.log('5. Alternative: Direct deployment');
    console.log('   - Consider deploying directly from this repo to GitHub Pages');
    console.log('   - Or use a different deployment method (Netlify, Vercel, etc.)');
    console.log('');
    
    console.log('6. If files are missing from deployment:');
    console.log('   - Check if .gitignore is excluding necessary files');
    console.log('   - Verify all files are committed and pushed');
    console.log('   - Check workflow build step logs');
  }

  makeGitHubAPIRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        port: 443,
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': 'Anchored-Deployment-Diagnostics',
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

// Run diagnostics if called directly
if (require.main === module) {
  const diagnostics = new CrossRepoDeploymentDiagnostics();
  diagnostics.runDiagnostics().catch(error => {
    console.error('Diagnostics failed:', error);
    process.exit(1);
  });
}

module.exports = CrossRepoDeploymentDiagnostics;