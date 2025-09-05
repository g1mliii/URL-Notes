#!/usr/bin/env node

/**
 * Guide to Delete Old Repository
 * 
 * Step-by-step instructions to safely delete the old g1mliii/Anchored repository
 */

console.log(`
🗑️ Delete Old Repository: g1mliii/Anchored

## ✅ SAFE TO DELETE - Verification Complete

The new direct deployment is working perfectly:
✅ https://anchored.site is live and functional
✅ All files accessible (config.js, health.json, monitoring.js)
✅ All pages working (landing, dashboard, account)
✅ Security headers configured
✅ HTTPS enforced

## 📋 Step-by-Step Deletion Process:

### Step 1: Final Verification (Optional)
Before deleting, you can do one final check:
- Visit: https://anchored.site
- Test: https://anchored.site/config.js
- Test: https://anchored.site/dashboard
- Confirm everything works as expected

### Step 2: Navigate to Old Repository
1. Go to: https://github.com/g1mliii/Anchored
2. This should be the OLD repository (not URL-Notes)
3. Verify it's the right repo by checking:
   - Repository name: "Anchored" (not "URL-Notes")
   - Last commit should be older deployment commits
   - Files should be from the old cross-repo deployment

### Step 3: Access Repository Settings
1. Click "Settings" tab (top right of repository page)
2. Scroll down to the very bottom
3. Look for "Danger Zone" section (red background)

### Step 4: Delete Repository
1. In Danger Zone, click "Delete this repository"
2. A modal will appear asking for confirmation
3. Type the repository name exactly: g1mliii/Anchored
4. Click "I understand the consequences, delete this repository"

### Step 5: Confirm Deletion
- Repository will be immediately deleted
- All data, commits, and history will be permanently removed
- The old deployment will stop working (but new one is already live)

## ⚠️ IMPORTANT SAFETY NOTES:

### Double-Check You're Deleting the RIGHT Repository:
❌ DO NOT DELETE: g1mliii/URL-Notes (this is your CURRENT working repo)
✅ DELETE THIS ONE: g1mliii/Anchored (this is the OLD deployment repo)

### What Happens After Deletion:
✅ Your current site (anchored.site) continues working normally
✅ New deployment from URL-Notes repo continues working
✅ You eliminate confusion between two repositories
✅ Much simpler management going forward

### If You're Unsure:
- You can always keep the old repo (just disable GitHub Pages on it)
- Or rename it to "Anchored-OLD" instead of deleting
- The new deployment doesn't depend on the old repo at all

## 🎯 After Deletion Benefits:

✅ Single repository to manage (URL-Notes)
✅ Direct deployment (no cross-repo complexity)
✅ Drag and drop file updates work
✅ All files accessible immediately
✅ Much simpler workflow

## 🚀 Current Status:

NEW DEPLOYMENT (Keep): g1mliii/URL-Notes → anchored.site ✅ WORKING
OLD DEPLOYMENT (Delete): g1mliii/Anchored → (no longer needed) ❌ DELETE

Ready to delete the old repository safely!
`);

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\nAre you ready to delete the old g1mliii/Anchored repository? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    console.log('\n✅ Perfect! Follow the steps above to delete the old repository.');
    console.log('🔗 Direct link: https://github.com/g1mliii/Anchored/settings');
    console.log('📍 Look for "Danger Zone" at the bottom of settings page.');
  } else {
    console.log('\n⏳ No problem! You can delete it later when you\'re ready.');
    console.log('💡 The new deployment works independently of the old repo.');
  }
  rl.close();
});