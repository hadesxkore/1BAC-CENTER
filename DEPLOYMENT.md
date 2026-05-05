# Deployment Guide - 1BAC Center

## ✅ Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Firebase project set up
- [ ] Cloudinary account configured
- [ ] `.npmrc` file present with `legacy-peer-deps=true`
- [ ] Build tested locally (`npm run build`)
- [ ] Preview tested locally (`npm run preview`)

---

## 🚀 Vercel Deployment

### Initial Setup

1. **Connect Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your Git repository
   - Select the repository

2. **Configure Build Settings**
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Environment Variables**
   Add the following environment variables in Vercel:

   ```
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
   VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Visit your deployment URL

### Subsequent Deployments

Every push to your main branch will automatically trigger a new deployment.

---

## 🔧 Configuration Files

### `.npmrc`
```
legacy-peer-deps=true
```
**Purpose**: Resolves peer dependency conflicts with Vite 8 and vite-plugin-pwa

### `vercel.json`
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```
**Purpose**: 
- Configures Vercel build settings
- Sets up SPA routing (all routes → index.html)
- Optimizes asset caching (1 year cache for immutable assets)

### `vite.config.ts` - PWA Settings
```typescript
workbox: {
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
  // ... other settings
}
```
**Purpose**: Allows caching of large bundle (~3 MB) for offline support

---

## 🐛 Common Deployment Issues

### Issue 1: Peer Dependency Error
```
npm error ERESOLVE could not resolve
npm error While resolving: vite-plugin-pwa@1.2.0
```

**Solution**: 
- Ensure `.npmrc` file exists with `legacy-peer-deps=true`
- Commit and push the file
- Redeploy

### Issue 2: Build Cache Size Error
```
Assets exceeding the limit:
- assets/index-xxx.js is 3.06 MB
```

**Solution**: 
- Already fixed in `vite.config.ts` with `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024`
- If still occurring, increase the value further

### Issue 3: Environment Variables Not Working
```
Firebase: Error (auth/invalid-api-key)
```

**Solution**:
- Check all environment variables are set in Vercel
- Ensure variable names start with `VITE_`
- Redeploy after adding variables

### Issue 4: 404 on Page Refresh
```
404 - Page Not Found
```

**Solution**:
- Ensure `vercel.json` has the rewrite rule
- The rule redirects all routes to `index.html` for SPA routing

### Issue 5: PWA Not Installing
```
Install button not showing
```

**Solution**:
- Ensure deployment is on HTTPS (Vercel provides this automatically)
- Check manifest.json is accessible at `/manifest.webmanifest`
- Verify service worker is registered in browser DevTools

---

## 📊 Build Output

Successful build should show:
```
✓ 4031 modules transformed.
dist/index.html                     0.51 kB
dist/manifest.webmanifest           0.51 kB
dist/assets/index-xxx.css         133.99 kB │ gzip:  21.11 kB
dist/assets/index-xxx.js        3,064.17 kB │ gzip: 898.39 kB

PWA v1.2.0
mode      generateSW
precache  14 entries (3520.95 KiB)
files generated
  dist/sw.js
  dist/workbox-xxx.js
```

**Key Metrics**:
- Main bundle: ~3 MB (uncompressed), ~900 KB (gzipped)
- CSS: ~134 KB (uncompressed), ~21 KB (gzipped)
- Service worker and manifest generated successfully

---

## 🔒 Security Checklist

- [ ] HTTPS enabled (automatic on Vercel)
- [ ] Environment variables not exposed in client code
- [ ] Firebase security rules configured
- [ ] Cloudinary upload preset secured
- [ ] No sensitive data in service worker cache
- [ ] CORS configured for Firebase Storage
- [ ] Authentication required for protected routes

---

## 🎯 Performance Optimization

### Already Implemented
- ✅ Asset caching (1 year for immutable assets)
- ✅ Service worker caching (offline support)
- ✅ Image optimization (Cloudinary)
- ✅ Code splitting (automatic with Vite)
- ✅ Gzip compression (automatic on Vercel)
- ✅ Lazy loading images
- ✅ Memoized components and calculations

### Future Optimizations
- [ ] Dynamic imports for large components
- [ ] Route-based code splitting
- [ ] Image lazy loading with Intersection Observer
- [ ] Preload critical resources
- [ ] Reduce bundle size (analyze with `vite-bundle-visualizer`)

---

## 📈 Monitoring

### Vercel Analytics
- Enable Vercel Analytics in project settings
- Monitor page views, performance, and errors
- Track Core Web Vitals

### Lighthouse Scores
Run Lighthouse audit after deployment:
```bash
npm install -g lighthouse
lighthouse https://your-domain.vercel.app --view
```

Target scores:
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 90+
- PWA: 100

---

## 🔄 Rollback

If deployment fails or has issues:

1. **Vercel Dashboard**
   - Go to Deployments
   - Find previous working deployment
   - Click "..." → "Promote to Production"

2. **Git Revert**
   ```bash
   git revert HEAD
   git push origin main
   ```

---

## 📞 Support

### Vercel Support
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)

### Project Support
- Check `FEATURES_SUMMARY.md` for feature documentation
- Check `PWA_SETUP.md` for PWA-specific issues
- Contact development team for custom issues

---

## ✅ Post-Deployment Verification

After successful deployment:

1. **Test PWA Installation**
   - Visit site on mobile
   - Check for install prompt
   - Install and test offline functionality

2. **Test Dark Mode**
   - Toggle dark mode
   - Refresh page (should persist)
   - Test on different devices

3. **Test Core Features**
   - Login functionality
   - Create new concern/report
   - Upload images
   - Submit actions
   - Export PDF
   - Filter and search

4. **Test Performance**
   - Run Lighthouse audit
   - Check load times
   - Test on slow 3G network
   - Verify image loading

5. **Test Offline**
   - Disconnect internet
   - Navigate between pages
   - Check cached images
   - Verify service worker active

---

**Last Updated**: May 5, 2026  
**Deployment Status**: ✅ Ready for Production
