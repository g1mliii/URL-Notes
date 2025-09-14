# Stripe Product Migration Implementation Plan

## Current vs Proposed Implementation

### Current Code (Manual Price Creation)
```typescript
// In supabase/functions/subscription-api/index.ts
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  payment_method_types: ['card'],
  line_items: [
    {
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Anchored Premium',
          description: 'Cloud sync, web app access, unlimited exports, and 500 AI tokens per month',
        },
        unit_amount: 250, // $2.50 in cents
        recurring: {
          interval: 'month',
        },
      },
      quantity: 1,
    },
  ],
  // ... rest of session config
})
```

### Proposed Code (Predefined Product)
```typescript
// In supabase/functions/subscription-api/index.ts
const session = await stripe.checkout.sessions.create({
  customer: customerId,
  payment_method_types: ['card'],
  line_items: [
    {
      price: Deno.env.get('STRIPE_PREMIUM_PRICE_ID'), // From environment variable
      quantity: 1,
    },
  ],
  // ... rest of session config (unchanged)
})
```

## Step-by-Step Migration

### Step 1: Create Stripe Product (Manual - Stripe Dashboard)
1. Log into Stripe Dashboard
2. Go to Products → Create Product
3. Set up:
   - **Name**: "Anchored Premium"
   - **Description**: "Cloud sync, web app access, unlimited exports, and 500 AI tokens per month"
   - **Pricing**: $2.50 USD, Monthly recurring
4. Copy the Price ID (starts with `price_`)

### Step 2: Add Environment Variable
Add to Supabase environment variables:
```bash
STRIPE_PREMIUM_PRICE_ID=price_1234567890abcdef
```

### Step 3: Update Code
**File**: `supabase/functions/subscription-api/index.ts`

**Replace this section:**
```typescript
line_items: [
  {
    price_data: {
      currency: 'usd',
      product_data: {
        name: 'Anchored Premium',
        description: 'Cloud sync, web app access, unlimited exports, and 500 AI tokens per month',
      },
      unit_amount: 250, // $2.50 in cents
      recurring: {
        interval: 'month',
      },
    },
    quantity: 1,
  },
],
```

**With:**
```typescript
line_items: [
  {
    price: Deno.env.get('STRIPE_PREMIUM_PRICE_ID'),
    quantity: 1,
  },
],
```

### Step 4: Optional Configuration Enhancement
**File**: `config.js`

Add Stripe configuration section:
```javascript
// Add to window.urlNotesConfig
stripe: {
  // These are public-safe identifiers (not secret keys)
  premiumPriceId: 'price_1234567890abcdef', // For client-side reference if needed
  productName: 'Anchored Premium',
  monthlyPrice: 2.50
},
```

## Benefits After Migration

### Immediate Benefits
1. **Stripe Dashboard Analytics**: Clear revenue tracking by product
2. **Easier Price Changes**: Update pricing from Stripe Dashboard without code deployment
3. **Better Webhooks**: More reliable product identification in webhook events
4. **Professional Setup**: Industry-standard approach

### Future Benefits
1. **Multiple Tiers**: Easy to add Basic ($1.50) or Pro ($4.99) tiers
2. **A/B Testing**: Test different price points for same product
3. **Regional Pricing**: Different prices for different countries
4. **Annual Discounts**: Easy to add annual billing options

## Risk Assessment

### What Stays the Same ✅
- Existing customer subscriptions continue unchanged
- Customer portal functionality unchanged
- Subscription status sync logic unchanged
- Database schema unchanged
- User experience unchanged

### What Changes 🔄
- Checkout session creation uses predefined price
- Stripe Dashboard shows better analytics
- Future pricing changes easier to manage

### Rollback Plan 🔙
If issues arise, simply revert the code change:
1. Change `price: Deno.env.get('STRIPE_PREMIUM_PRICE_ID')` back to `price_data: {...}`
2. Deploy the rollback
3. No customer impact

## Testing Strategy

### Test Cases
1. **New Subscription**: Verify checkout works with predefined price
2. **Existing Customers**: Confirm portal access unchanged
3. **Webhook Processing**: Test subscription events still process correctly
4. **Status Sync**: Verify subscription status sync continues working

### Test Environment
1. Use Stripe test mode first
2. Create test product with test price ID
3. Test complete flow: signup → payment → portal → cancellation
4. Verify all existing functionality works

## Implementation Effort

**Time Estimate**: 2-3 hours
- 30 minutes: Create Stripe product and get price ID
- 30 minutes: Update environment variables
- 30 minutes: Update code and test
- 60 minutes: Testing and verification

**Complexity**: Low
- Single file change
- No database migrations
- No breaking changes
- Easy rollback

## Conclusion

This migration is **highly recommended** because:
- ✅ **Low risk, high reward**
- ✅ **Minimal code changes**
- ✅ **Immediate business benefits**
- ✅ **Future scalability**
- ✅ **Industry best practices**

The current system is already well-architected and fully compatible with Stripe products. This change simply makes it more professional and easier to manage going forward.