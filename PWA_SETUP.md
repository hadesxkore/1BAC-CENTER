# PWA Setup Guide - 1BAC Center

## Progressive Web App Features

The 1BAC Center is now a fully functional Progressive Web App (PWA) that can be installed on any device and works offline.

### ✨ Features

#### 📱 Install as Native App
- **Desktop**: Click the install button in the browser address bar or use the in-app prompt
- **Mobile**: Tap "Add to Home Screen" from the browser menu or use the in-app prompt
- **Standalone Mode**: Runs in its own window without browser UI
- **App Icon**: Custom Bataan logo icon on home screen/desktop

#### 🌙 Dark Mode Toggle
- **Persistent Theme**: Your theme preference is saved across sessions
- **System Preference**: Automatically detects your system's dark mode preference
- **Smooth Transitions**: Animated icon transitions between sun and moon
- **Available Everywhere**: Toggle in header (staff pages) and login page

#### 📴 Offline Support
- **Service Worker**: Caches app shell and assets for offline access
- **Image Caching**: Cloudinary and Firebase Storage images cached for 30 days
- **Auto-Update**: Automatically updates when new version is available
- **Offline Ready**: Core functionality works without internet

#### ⚡ Performance
- **Fast Loading**: Cached assets load instantly
- **Background Sync**: Updates happen in the background
- **Optimized Images**: Smart caching strategy for images
- **Reduced Data Usage**: Only downloads new content

---

## Installation Instructions

### For Users

#### Desktop (Chrome, Edge, Brave)
1. Visit the 1BAC Center website
2. Look for the install icon (⊕) in the address bar
3. Click "Install" or wait for the in-app prompt
4. The app will open in its own window

#### Mobile (Android)
1. Open the website in Chrome
2. Tap the menu (⋮) in the top-right
3. Select "Add to Home Screen"
4. Tap "Add" to confirm
5. Find the app icon on your home screen

#### Mobile (iOS/Safari)
1. Open the website in Safari
2. Tap the Share button (□↑)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm
5. Find the app icon on your home screen

---

## Technical Details

### PWA Configuration

**Manifest** (`vite.config.ts`):
- Name: "1BAC Center - Bataan Action Center"
- Short Name: "1BAC Center"
- Theme Color: `#2563eb` (Blue)
- Background Color: `#ffffff` (White)
- Display: Standalone
- Icons: 192x192 and 512x512 (Bataan logo)

**Service Worker** (Workbox):
- Auto-update strategy
- Cache-first for images (Firebase Storage, Cloudinary)
- 30-day cache expiration for images
- Max 100 cached images per source

**Caching Strategy**:
```javascript
// Firebase Storage Images
urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i
handler: 'CacheFirst'
maxEntries: 100
maxAgeSeconds: 30 days

// Cloudinary Images
urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i
handler: 'CacheFirst'
maxEntries: 100
maxAgeSeconds: 30 days
```

---

## Development

### Testing PWA Locally

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Preview the build**:
   ```bash
   npm run preview
   ```

3. **Test in browser**:
   - Open Chrome DevTools
   - Go to Application tab
   - Check "Service Workers" and "Manifest"
   - Use Lighthouse to audit PWA score

### PWA Checklist

✅ HTTPS enabled (required for PWA)  
✅ Web App Manifest configured  
✅ Service Worker registered  
✅ Offline fallback page  
✅ Icons (192x192, 512x512)  
✅ Theme color defined  
✅ Viewport meta tag  
✅ Install prompt implemented  
✅ Update notification  

---

## Browser Support

| Browser | Desktop | Mobile | Install |
|---------|---------|--------|---------|
| Chrome  | ✅      | ✅     | ✅      |
| Edge    | ✅      | ✅     | ✅      |
| Safari  | ✅      | ✅     | ✅      |
| Firefox | ✅      | ✅     | ⚠️      |
| Opera   | ✅      | ✅     | ✅      |

⚠️ Firefox supports PWAs but installation is limited

---

## Troubleshooting

### Vercel Deployment Issues

#### Peer Dependency Errors
If you encounter peer dependency errors during deployment:
1. Ensure `.npmrc` file exists with `legacy-peer-deps=true`
2. This allows installation despite peer dependency conflicts with Vite 8

#### Build Cache Size Error
If you see "Assets exceeding the limit" error:
- The `maximumFileSizeToCacheInBytes` is set to 5 MB in `vite.config.ts`
- This accommodates the large bundle size from Firebase and other dependencies
- The main bundle is ~3 MB (gzipped to ~900 KB)

### Install Button Not Showing
- Ensure you're using HTTPS
- Check if already installed
- Try clearing browser cache
- Verify manifest.json is accessible

### Service Worker Not Registering
- Check browser console for errors
- Ensure HTTPS is enabled
- Verify service worker file is accessible
- Try hard refresh (Ctrl+Shift+R)

### Dark Mode Not Persisting
- Check localStorage is enabled
- Verify browser allows local storage
- Clear browser cache and try again

### Images Not Caching
- Check network tab in DevTools
- Verify service worker is active
- Check cache storage in Application tab
- Ensure image URLs match cache patterns

---

## Updates

When a new version is deployed:
1. Service worker detects the update
2. User sees "New content available. Reload?" prompt
3. User clicks "OK" to update
4. App reloads with new version
5. Old cache is cleared automatically

---

## Security

- All data transmitted over HTTPS
- Service worker only works on secure origins
- No sensitive data cached
- Cache cleared on logout
- Regular security audits

---

## Performance Metrics

Target Lighthouse Scores:
- Performance: 90+
- Accessibility: 95+
- Best Practices: 95+
- SEO: 90+
- PWA: 100

---

## Future Enhancements

- [ ] Push notifications for new reports
- [ ] Background sync for offline submissions
- [ ] Periodic background sync
- [ ] Share target API
- [ ] File handling API
- [ ] Shortcuts API

---

## Support

For issues or questions:
- Check browser console for errors
- Review this guide
- Contact system administrator
- Report bugs to development team
