# Anchored Webhook Server

Simple Vercel serverless function to handle Stripe webhooks for Anchored.

## Setup

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy to Vercel:
```bash
cd webhook-server
npm install
vercel --prod
```

3. Set environment variables in Vercel dashboard:
- `SUPABASE_URL`: https://kqjcorjjvunmyrnzvqgr.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

4. Update Stripe webhook URL to your Vercel deployment:
```
https://your-deployment.vercel.app/api/stripe-webhook
```

## Benefits

- ✅ No authentication issues
- ✅ Simple deployment
- ✅ Free hosting on Vercel
- ✅ Reliable webhook processing
- ✅ Easy to debug and monitor