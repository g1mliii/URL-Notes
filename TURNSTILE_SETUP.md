# Cloudflare Turnstile Setup

## Configuration Steps

1. **Get your Turnstile Site Key**
   - Go to Cloudflare Dashboard → Turnstile
   - Copy your Site Key

2. **Update the HTML files**
   - Replace `YOUR_SITE_KEY_HERE` in `index.html` with your actual site key
   - Find and replace in both login and register forms:
     ```html
     <div class="cf-turnstile" id="loginTurnstile" data-sitekey="YOUR_ACTUAL_SITE_KEY"></div>
     <div class="cf-turnstile" id="registerTurnstile" data-sitekey="YOUR_ACTUAL_SITE_KEY"></div>
     ```

3. **Supabase Configuration**
   - You mentioned you already added the secret key in Supabase
   - Make sure it's configured under: Supabase Dashboard → Authentication → CAPTCHA Protection
   - Provider: Cloudflare Turnstile
   - Secret Key: Your Turnstile secret key

## What Was Integrated

✅ Added Turnstile script to `_layouts/default.html`
✅ Updated CSP to allow Turnstile domains
✅ Added Turnstile widgets to login and signup forms in `index.html`
✅ Updated `js/auth.js` to get and pass captcha tokens
✅ Updated `js/lib/api.js` to send captcha tokens to Supabase

## How It Works

1. User fills out login/signup form
2. Turnstile widget validates user (invisible or visible challenge)
3. On form submit, `getTurnstileToken()` retrieves the token
4. Token is passed to Supabase via `gotrue_meta_security.captcha_token`
5. Supabase validates the token with Cloudflare before allowing auth

## Testing

1. Try to sign in/up - you should see the Turnstile widget
2. Complete the captcha
3. Submit the form
4. Check browser console for any errors

## Troubleshooting

- If captcha doesn't appear: Check CSP headers and Turnstile script loading
- If "Please complete the captcha" error: Widget may not have loaded yet
- If auth fails: Verify secret key is correct in Supabase dashboard
