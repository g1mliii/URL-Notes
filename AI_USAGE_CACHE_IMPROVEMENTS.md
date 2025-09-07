# AI Usage Cache Improvements

## Problem
The AI usage was being cached for 1 hour, which meant:
- Users would see stale usage counts after making AI requests
- Usage counts wouldn't update immediately after successful operations
- Cache wouldn't clear on authentication changes (login/logout)
- Cache wouldn't clear on tier changes (free ↔ premium)

## Solution
Implemented smart cache management that:
- **Caches for UI performance** - avoids repeated API calls when opening modals
- **Clears cache after usage** - ensures fresh data after AI operations
- **Clears cache on auth changes** - ensures correct limits for different users
- **Clears cache on tier changes** - ensures correct limits for free vs premium

## Implementation

### 1. **Cache Clearing After AI Operations**
```javascript
// After successful AI rewrite
await clearAIUsageCache();

// After successful domain summary
await clearAIUsageCache();

// After successful site content summary  
await clearAIUsageCache();
```

### 2. **Cache Clearing on Authentication Changes**
```javascript
async handleAuthChanged(payload) {
  // Clear AI usage cache on auth changes
  await clearAIUsageCache();
  
  // Continue with existing auth handling...
}
```

### 3. **Cache Clearing on Tier Changes**
```javascript
async handleTierChanged(status) {
  // Clear AI usage cache on tier changes (free vs premium have different limits)
  await clearAIUsageCache();
  
  // Continue with existing tier handling...
}
```

### 4. **Existing Cache Logic (Unchanged)**
```javascript
async getCurrentAIUsage(featureName = 'overall') {
  // Check cache first (1 hour expiry)
  const cacheKey = 'cachedAIUsage';
  const result = await chrome.storage.local.get([cacheKey]);
  
  if (result[cacheKey]) {
    const { data, timestamp } = result[cacheKey];
    const cacheAge = Date.now() - timestamp;
    const cacheExpiry = 60 * 60 * 1000; // 1 hour
    
    // Return cached data if still valid
    if (cacheAge < cacheExpiry) {
      return data;
    }
  }
  
  // Fetch fresh data and cache it...
}
```

## User Experience Improvements

### **Before (Stale Cache)**
1. User has 25 AI credits remaining
2. User performs site content summary (uses 20 credits)
3. UI still shows "25 credits remaining" for up to 1 hour
4. User might attempt another operation thinking they have credits

### **After (Smart Cache)**
1. User has 25 AI credits remaining
2. User performs site content summary (uses 20 credits)
3. Cache is cleared immediately after success
4. Next time UI loads, it shows fresh "5 credits remaining"
5. User sees accurate usage information

### **Authentication Scenarios**
- **Login**: Cache cleared → fresh limits loaded for new user
- **Logout**: Cache cleared → no stale data from previous user
- **Tier Change**: Cache cleared → correct limits for new tier (5 vs 500)

## Cache Strategy Summary

| Event | Cache Behavior | Reason |
|-------|---------------|---------|
| **Open AI Modal** | Use cache if < 1 hour old | Performance - avoid API calls |
| **Successful AI Operation** | Clear cache immediately | Accuracy - show updated usage |
| **Authentication Change** | Clear cache immediately | Security - different user limits |
| **Tier Change** | Clear cache immediately | Accuracy - different tier limits |
| **Cache Expiry (1 hour)** | Fetch fresh data | Ensure data isn't too stale |

This ensures the best balance of performance (caching) and accuracy (fresh data when needed).