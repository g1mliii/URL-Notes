#!/usr/bin/env node

/**
 * Anchored Web Application - Deployment Fix and Verification
 * 
 * This script diagnoses and fixes common deployment issues.
 */

const https = require('https');
const fs = require('fs').promises;
const { execSync } = require('child_process');

class DeploymentFixer {
  constructor() {
    this.baseUrl = 'https://anchored.site';
    this.issues = [];
    this.fixes = [];
  }

  async diagnoseAndFix() {
    console.log('🔧 Diagnosing Deployment Issues...\n');
    
    try {
      // Check file accessibility
      await this.checkFileAccessibility();
      
      // Check deployment status
      await this.checkDeploymentStatus();
      
      // Apply fixes if needed
      if (this.issues.length > 0) {
        await this.applyFixes();
      }
      
      // Verify fixes
      await this.verifyFixes();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Deployment fix failed:', error.message);
      process.exit(1);
    }
  }

  async checkFileAccessibility() {
    console.log('📁 Checking file accessibility...');
    
    const criticalFiles = [
      '/config.js',
      '/health.json',
      '/js/monitoring.js',
      '/js/auth.js',
      '/js/app.js'
    ];
    
    for (const file of criticalFiles) {
      try {
        const response = await this.makeRequest(`${this.baseUrl}${file}`);
        
        if (response.statusCode === 404) {
          this.issues.push({
            type: 'missing_file',
            file: file,
            message: `File ${file} is not accessible (404)`
          });
          console.log(`❌ ${file}: Not accessible (404)`);
        } else if (response.statusCode === 200) {
          console.log(`✅ ${file}: Accessible (${response.body.length} bytes)`);
        } else {
          this.issues.push({
            type: 'file_error',
            file: file,
            message: `File ${file} returned status ${response.statusCode}`
          });
          console.log(`⚠️  ${file}: Status ${response.statusCode}`);
        }
      } catch (error) {
        this.issues.push({
          type: 'network_error',
          file: file,
          message: `Network error accessing ${file}: ${error.message}`
        });
        console.log(`❌ ${file}: Network error`);
      }
    }
  }

  async checkDeploymentStatus() {
    console.log('\n🚀 Checking deployment status...');
    
    try {
      // Check if files exist locally
      const localFiles = [
        'web-app/config.js',
        'web-app/health.json',
        'web-app/js/monitoring.js'
      ];
      
      for (const file of localFiles) {
        try {
          await fs.access(file);
          console.log(`✅ Local file exists: ${file}`);
        } catch (error) {
          this.issues.push({
            type: 'missing_local_file',
            file: file,
            message: `Local file missing: ${file}`
          });
          console.log(`❌ Local file missing: ${file}`);
        }
      }
      
      // Check git status
      try {
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
        if (gitStatus.trim()) {
          this.issues.push({
            type: 'uncommitted_changes',
            message: 'There are uncommitted changes that may not be deployed'
          });
          console.log('⚠️  Uncommitted changes detected');
        } else {
          console.log('✅ Git repository is clean');
        }
      } catch (error) {
        console.log('⚠️  Could not check git status');
      }
      
    } catch (error) {
      console.log(`⚠️  Deployment status check failed: ${error.message}`);
    }
  }

  async applyFixes() {
    console.log('\n🔧 Applying fixes...\n');
    
    for (const issue of this.issues) {
      switch (issue.type) {
        case 'missing_file':
          await this.fixMissingFile(issue);
          break;
        case 'missing_local_file':
          await this.fixMissingLocalFile(issue);
          break;
        case 'uncommitted_changes':
          await this.fixUncommittedChanges(issue);
          break;
        default:
          console.log(`⚠️  No automatic fix available for: ${issue.message}`);
      }
    }
  }

  async fixMissingFile(issue) {
    console.log(`🔧 Fixing missing file: ${issue.file}`);
    
    // The file exists locally but not on the server - this is a deployment issue
    // We need to trigger a new deployment
    this.fixes.push({
      type: 'redeploy_needed',
      message: `File ${issue.file} needs redeployment`
    });
    
    console.log(`  ✅ Marked for redeployment: ${issue.file}`);
  }

  async fixMissingLocalFile(issue) {
    console.log(`🔧 Fixing missing local file: ${issue.file}`);
    
    if (issue.file === 'web-app/js/monitoring.js') {
      // We already created this file, so it should exist
      console.log('  ⚠️  Monitoring file should exist - check file system');
    }
    
    // For other missing files, we'd need to create them
    console.log(`  ⚠️  Manual intervention needed for: ${issue.file}`);
  }

  async fixUncommittedChanges(issue) {
    console.log('🔧 Fixing uncommitted changes...');
    
    try {
      // Add all changes
      execSync('git add .', { stdio: 'pipe' });
      
      // Commit changes
      execSync('git commit -m "Fix deployment issues: Update configuration and monitoring"', { stdio: 'pipe' });
      
      this.fixes.push({
        type: 'committed_changes',
        message: 'Committed pending changes'
      });
      
      console.log('  ✅ Changes committed');
      
      // Push changes to trigger deployment
      console.log('  🚀 Pushing changes to trigger deployment...');
      execSync('git push origin main', { stdio: 'inherit' });
      
      this.fixes.push({
        type: 'deployment_triggered',
        message: 'Deployment triggered via git push'
      });
      
      console.log('  ✅ Deployment triggered');
      
    } catch (error) {
      console.log(`  ❌ Failed to commit/push changes: ${error.message}`);
    }
  }

  async verifyFixes() {
    console.log('\n⏳ Waiting for deployment to complete...');
    
    // Wait for deployment if we triggered one
    const deploymentTriggered = this.fixes.some(fix => fix.type === 'deployment_triggered');
    
    if (deploymentTriggered) {
      console.log('  Waiting 2 minutes for GitHub Actions deployment...');
      await new Promise(resolve => setTimeout(resolve, 120000)); // Wait 2 minutes
      
      console.log('\n🔍 Verifying deployment fixes...');
      
      // Re-check critical files
      const criticalFiles = ['/config.js', '/health.json'];
      
      for (const file of criticalFiles) {
        try {
          const response = await this.makeRequest(`${this.baseUrl}${file}`);
          
          if (response.statusCode === 200) {
            console.log(`✅ ${file}: Now accessible`);
          } else {
            console.log(`❌ ${file}: Still not accessible (${response.statusCode})`);
          }
        } catch (error) {
          console.log(`❌ ${file}: Still has network error`);
        }
      }
    }
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

  printResults() {
    console.log('\n📊 Deployment Fix Results');
    console.log('==========================');
    
    if (this.issues.length === 0) {
      console.log('✅ No deployment issues found');
    } else {
      console.log(`🔍 Issues found: ${this.issues.length}`);
      this.issues.forEach(issue => {
        console.log(`  - ${issue.message}`);
      });
    }
    
    if (this.fixes.length === 0) {
      console.log('ℹ️  No fixes applied');
    } else {
      console.log(`🔧 Fixes applied: ${this.fixes.length}`);
      this.fixes.forEach(fix => {
        console.log(`  - ${fix.message}`);
      });
    }
    
    console.log('\n🌐 Application URL: https://anchored.site');
    
    if (this.fixes.some(fix => fix.type === 'deployment_triggered')) {
      console.log('⏳ Deployment in progress - check again in a few minutes');
    }
  }
}

// Run fix if called directly
if (require.main === module) {
  const fixer = new DeploymentFixer();
  fixer.diagnoseAndFix().catch(error => {
    console.error('Fix failed:', error);
    process.exit(1);
  });
}

module.exports = DeploymentFixer;