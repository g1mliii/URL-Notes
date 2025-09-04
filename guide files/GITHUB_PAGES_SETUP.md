# GitHub Pages Setup Guide for Anchored Web Application

## Repository Configuration

**Repository**: https://github.com/g1mliii/Anchored  
**Custom Domain**: anchored.site  
**Deployment**: Automated via GitHub Actions

## Initial Setup Steps

### 1. Repository Settings

1. Navigate to **Settings** → **Pages** in your GitHub repository
2. Set **Source** to "GitHub Actions"
3. Configure **Custom domain** to `anchored.site`
4. Enable **Enforce HTTPS** (will be available after DNS configuration)

### 2. DNS Configuration

Configure your DNS provider with the following records:

#### For Root Domain (anchored.site)
```
Type: A
Name: @
Value: 185.199.108.153
```
```
Type: A  
Name: @
Value: 185.199.109.153
```
```
Type: A
Name: @  
Value: 185.199.110.153
```
```
Type: A
Name: @
Value: 185.199.111.153
```

#### For WWW Subdomain (optional)
```
Type: CNAME
Name: www
Value: g1mliii.github.io
```

### 3. GitHub Actions Configuration

The deployment workflow is already configured in `.github/workflows/deploy.yml`. It will:

- Trigger on pushes to the `main` branch
- Build the web application
- Deploy to GitHub Pages with custom domain
- Generate SEO files (robots.txt, sitemap.xml)
- Configure security headers

### 4. Environment Variables

No environment variables are required as the Supabase configuration is included in the application code. The app automatically detects the environment based on the hostname.

## Deployment Process

### Automatic Deployment

1. **Push to Main**: Any push to the `main` branch triggers deployment
2. **Build Process**: GitHub Actions copies web-app files and configures them
3. **Domain Setup**: CNAME file ensures custom domain is maintained
4. **Security**: HTTPS is enforced and security headers are applied

### Manual Deployment Verification

After setup, verify deployment by:

1. **Check Actions**: Monitor the "Deploy to GitHub Pages" workflow
2. **Verify Domain**: Ensure `anchored.site` resolves correctly
3. **Test HTTPS**: Confirm HTTPS redirect works properly
4. **Check Health**: Visit `https://anchored.site/health.json`

## Security Configuration

### HTTPS Enforcement
- Automatic redirect from HTTP to HTTPS
- Strict Transport Security headers
- Custom domain SSL certificate (provided by GitHub)

### Content Security Policy
The application includes a strict CSP that:
- Allows scripts only from self and Supabase
- Prevents XSS attacks
- Blocks unsafe inline content where possible

### Additional Security Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Monitoring and Maintenance

### Deployment Monitoring
- Check GitHub Actions for deployment status
- Monitor repository Insights → Traffic for usage
- Review Issues for user-reported problems

### Performance Monitoring
- Use browser DevTools for performance analysis
- Monitor Core Web Vitals
- Check Lighthouse scores regularly

### Security Monitoring
- Review Dependabot alerts
- Monitor for security vulnerabilities
- Keep Supabase dependencies updated

## Troubleshooting

### Common Issues

#### 1. Custom Domain Not Working
- Verify DNS records are correctly configured
- Wait 24-48 hours for DNS propagation
- Check GitHub Pages settings for domain verification

#### 2. HTTPS Certificate Issues
- Ensure DNS is properly configured first
- Wait for GitHub to provision SSL certificate
- Check that CNAME file contains correct domain

#### 3. Deployment Failures
- Check GitHub Actions logs for specific errors
- Verify all required files are in web-app directory
- Ensure no syntax errors in workflow file

#### 4. Application Not Loading
- Check browser console for JavaScript errors
- Verify Supabase configuration is correct
- Test with different browsers/devices

### Support Resources

- **GitHub Pages Documentation**: https://docs.github.com/en/pages
- **Custom Domain Setup**: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site
- **GitHub Actions**: https://docs.github.com/en/actions

## Post-Deployment Checklist

After successful deployment, verify:

- [ ] `anchored.site` loads correctly
- [ ] HTTPS redirect works (http://anchored.site → https://anchored.site)
- [ ] All pages load without errors (dashboard.html, account.html)
- [ ] Authentication flow works with Supabase
- [ ] Security headers are present (check browser DevTools)
- [ ] SEO files are accessible (robots.txt, sitemap.xml)
- [ ] Health check endpoint responds (health.json)

## Future Enhancements

Consider implementing:
- CDN integration for global performance
- Advanced monitoring and alerting
- Automated security scanning
- Performance budgets
- A/B testing capabilities