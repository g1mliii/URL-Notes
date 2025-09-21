// Test script to verify Stripe live integration
// Run this in browser console on the account page

async function testStripeLiveIntegration() {
  console.log('🧪 Testing Stripe Live Integration...');
  
  // Test 1: Check config values
  console.log('📋 Config Check:');
  console.log('Product ID:', window.urlNotesConfig?.stripe?.productId);
  console.log('Price ID:', window.urlNotesConfig?.stripe?.premiumPriceId);
  console.log('Monthly Price:', window.urlNotesConfig?.stripe?.monthlyPrice);
  
  // Test 2: Check if subscription manager is available
  console.log('🔧 Subscription Manager Check:');
  console.log('Available:', !!window.subscriptionManager);
  
  // Test 3: Check button visibility
  console.log('🎛️ Button Check:');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const manageBtn = document.getElementById('manageSubscriptionBtn');
  const billingBtn = document.getElementById('viewBillingBtn');
  
  console.log('Upgrade button exists:', !!upgradeBtn);
  console.log('Manage button exists:', !!manageBtn);
  console.log('Billing button exists (should be false):', !!billingBtn);
  
  // Test 4: Check if sync functionality works
  if (window.account && typeof window.account.syncSubscriptionStatus === 'function') {
    console.log('🔄 Sync function available: ✅');
  } else {
    console.log('🔄 Sync function available: ❌');
  }
  
  // Test 5: Check customer portal URL
  console.log('🔗 Customer Portal URL Check:');
  console.log('Should contain live URL (7sY7sN0nf3Vl3IY6gW3oA00)');
  
  console.log('✅ Test completed! Check the values above.');
}

// Run the test
testStripeLiveIntegration();