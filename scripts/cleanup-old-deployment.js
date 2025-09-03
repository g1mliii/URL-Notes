#!/usr/bin/env node

/**
 * Cleanup Old Deployment Setup
 * 
 * This script helps you clean up the old cross-repository deployment
 * once the new direct deployment is working.
 */

console.log(`
🧹 Cleanup Old Deployment Setup

## ✅ BEFORE CLEANUP - Verify New Deployment Works:

1. Check new GitHub Pages is live:
   - https://g1mliii.github.io/URL-Notes
   - https://anchored.site

2. Test critical files:
   - https://anchored.site/config.js (should work now!)
   - https://anchored.site/health.json
   - https://anchored.site/js/monitoring.js

## 🗑️ SAFE CLEANUP STEPS:

### Step 1: Remove Old Workflow (Optional)
The old cross-repo workflow in this repository:
- .github/workflows/deploy.yml (can be deleted)
- .github/workflows/deploy-direct.yml (can be deleted)

### Step 2: Delete Old Repository
Once new deployment is confirmed working:
- Go to: https://github.com/g1mliii/Anchored/settings
- Scroll to bottom -> "Delete this repository"
- Type: g1mliii/Anchored
- Confirm deletion

### Step 3: Update DNS (if needed)
Your DNS should now point to:
- CNAME: anchored.site -> g1mliii.github.io
- (GitHub will handle the /URL-Notes path automatically)

## 🎯 BENEFITS AFTER CLEANUP:

✅ Single repository to manage
✅ Direct file editing/drag-drop works
✅ No token permission issues
✅ Simpler deployment process
✅ All files accessible immediately

## ⚠️ IMPORTANT:

- Only delete old repo AFTER confirming new site works
- Keep a backup if you're unsure
- The new approach is much better anyway!

Current status: Ready for cleanup once new deployment is verified.
`);

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\nHave you verified the new GitHub Pages deployment is working? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    console.log('\n✅ Great! You can safely:');
    console.log('1. Delete the old g1mliii/Anchored repository');
    console.log('2. Remove old workflow files from this repo');
    console.log('3. Enjoy the much simpler deployment process!');
  } else {
    console.log('\n⏳ Wait to delete until you confirm:');
    console.log('1. New GitHub Pages is enabled and working');
    console.log('2. https://anchored.site loads correctly');
    console.log('3. All files (config.js, etc.) are accessible');
  }
  rl.close();
});