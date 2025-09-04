# Anchored Web Application - Deployment Guide

## GitHub Pages Deployment

This document outlines the production deployment configuration for the Anchored Web Application using GitHub Pages.

### Automated Deployment

The application is configured for automatic deployment to GitHub Pages using GitHub Actions. The deployment workflow is triggered on every push to the `main` branch.

#### Deployment Process

1. **Build Process**: The GitHub Actions workflow copies the web application files to a build directory
2. **Static Assets**: All CSS, JS, and HTML files are deployed as static assets
3. **Security Configuration**: HTTPS is enforced and security headers are configured
4. **SEO Optimization**: Robots.txt and sitemap.xml are automatically generated

#### Configuration Files

- `.github/workflows/deploy.yml` - GitHub Actions deployment workflow
- `web-app/config.js` - Environment-specific configuration
- `web-app/_headers` - Security headers configuration

### Environment Configuration

The application automatically detects the environment based on the hostname:

- **Production**: `anchored.site` (HTTPS enforced)
- **Development**: `localhost` (HTTP allowed for local development)

### Security Features

#### HTTPS Enforcement
- Automatic redirect from HTTP to HTTPS in production
- Strict Transport Security headers
- Secure cookie configuration

#### Content Security Policy
- Restricts script sources to self and Supabase
- Prevents XSS attacks with strict CSP rules
- Blocks unsafe inline scripts except where necessary

#### Additional Security Headers
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Enables XSS filtering
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information

### Supabase Configuration

The application connects to the existing Supabase instance:
- **URL**: `https://kqjcorjjvunmyrnzvqgr.supabase.co`
- **Environment**: Production-ready configuration
- **Authentication**: Supabase Auth with email/password and OAuth
- **Database**: PostgreSQL with Row Level Security enabled

### Performance Optimization

#### Caching Strategy
- Static assets (CSS/JS) cached for 1 year with immutable flag
- HTML files not cached to ensure fresh content delivery
- Service worker implementation for offline functionality (future enhancement)

#### Asset Optimization
- Minified CSS and JavaScript (manual optimization)
- Optimized images and icons
- Lazy loading for large content sections

### Monitoring and Analytics

#### Error Tracking
- Client-side error logging to browser console
- Supabase Edge Functions for server-side error tracking
- Performance monitoring through browser DevTools

#### SEO Configuration
- Automatic sitemap.xml generation
- Robots.txt for search engine crawling
- Meta tags for social media sharing
- Structured data markup (future enhancement)

### Deployment Checklist

Before deploying to production, ensure:

- [ ] All environment variables are configured
- [ ] HTTPS is enforced in production
- [ ] Security headers are properly set
- [ ] Supabase configuration is correct
- [ ] All static assets are optimized
- [ ] Error handling is implemented
- [ ] Performance metrics are acceptable

### Manual Deployment Steps

If manual deployment is needed:

1. **Prepare Build Directory**:
   ```bash
   mkdir -p _site
   cp -r web-app/* _site/
   ```

2. **Configure Security**:
   ```bash
   # Ensure _headers file is in place
   cp web-app/_headers _site/
   ```

3. **Deploy to GitHub Pages**:
   - Push changes to `main` branch
   - GitHub Actions will automatically deploy
   - Monitor deployment in Actions tab

### Troubleshooting

#### Common Issues

1. **HTTPS Redirect Loop**:
   - Check GitHub Pages settings
   - Ensure custom domain is properly configured
   - Verify DNS settings if using custom domain

2. **CSP Violations**:
   - Check browser console for CSP errors
   - Update `config.js` security configuration
   - Whitelist necessary domains in CSP

3. **Supabase Connection Issues**:
   - Verify Supabase URL and API key
   - Check network connectivity
   - Review CORS settings in Supabase dashboard

4. **Asset Loading Failures**:
   - Verify file paths are relative
   - Check for case sensitivity issues
   - Ensure all assets are committed to repository

### Future Enhancements

- Custom domain configuration
- CDN integration for global performance
- Advanced monitoring and alerting
- Automated security scanning
- Performance budgets and monitoring

### Support

For deployment issues:
1. Check GitHub Actions logs
2. Review browser console errors
3. Verify Supabase dashboard for API issues
4. Contact support with specific error messages