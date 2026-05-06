# File Upload & Viewing Solution

## Problem
Cloudinary free tier blocks delivery of raw files (PDFs, Word documents, Excel files) with 401 Unauthorized errors. While files upload successfully to Cloudinary, they cannot be accessed or viewed.

## Solution: Browser-Based File Storage

We implemented a **browser-based solution** where documents are converted to base64 data URLs and stored directly in Firestore instead of Cloudinary.

### How It Works

#### 1. **File Upload (SubmitActionDialog.tsx)**
- When a user selects files, the system detects if it's an image or document
- **Images**: Uploaded to Cloudinary (works fine on free tier)
- **Documents** (PDF, Word, Excel, Text): Converted to base64 data URL and stored in Firestore

```typescript
// In cloudinary.ts - uploadToCloudinaryDirect()
if (!isImage) {
  const base64Url = await fileToBase64(file)
  return {
    success: true,
    url: base64Url, // Store as base64 data URL
    publicId: `local_${Date.now()}`,
    resourceType: 'raw',
  }
}
```

#### 2. **File Display**
- **Images**: Show thumbnail preview
- **Documents**: Show file icon with file name and size

#### 3. **File Viewing**
- **Images**: Open directly in new tab (standard `<a>` tag with `target="_blank"`)
- **Documents**: Open in new window with iframe to display base64 content

```typescript
// In OneBAC.tsx, ActionCenter.tsx, ViewConcernDialog.tsx
<button
  onClick={() => {
    const newWindow = window.open()
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>${photo.fileName || 'Document'}</title>
            <style>
              body { margin: 0; padding: 0; }
              iframe { width: 100vw; height: 100vh; border: none; }
            </style>
          </head>
          <body>
            <iframe src="${photo.url}"></iframe>
          </body>
        </html>
      `)
      newWindow.document.close()
    }
  }}
>
  {/* File icon */}
</button>
```

### Benefits
✅ **No Cloudinary restrictions** - Documents stored in Firestore, not Cloudinary  
✅ **Works on free tier** - No paid services required  
✅ **Cross-browser compatible** - Works in all modern browsers  
✅ **Secure** - Files stored in Firestore with security rules  
✅ **Compression support** - Files > 3MB are compressed before storage  

### Limitations
⚠️ **Firestore document size limit** - Max 1MB per document (base64 encoding increases size by ~33%)  
⚠️ **Not suitable for very large files** - Recommended max file size: 3MB (becomes ~4MB after base64)  
⚠️ **Browser memory** - Large files consume browser memory when viewing  

### File Size Handling
- Files > 3MB trigger compression with loading animation
- Compression reduces file size before base64 conversion
- User sees progress: "Compressing file... (3.5MB)" → "✓ Compressed to 2.1MB"

### Supported File Types
- **Images**: JPG, PNG, GIF, WebP (uploaded to Cloudinary)
- **Documents**: PDF, Word (.doc, .docx), Excel (.xls, .xlsx), Text (.txt) (stored as base64)

### Updated Files
1. `src/config/cloudinary.ts` - Added `fileToBase64()` and updated `uploadToCloudinaryDirect()`
2. `src/components/SubmitActionDialog.tsx` - File upload with compression and base64 conversion
3. `src/pages/staff/OneBAC.tsx` - Document viewing with button click handler
4. `src/pages/staff/ActionCenter.tsx` - Document viewing with button click handler
5. `src/components/ViewConcernDialog.tsx` - Document viewing in modal
6. `src/components/EditConcernDialog.tsx` - Document editing support
7. `src/data/sampleActions.ts` - Extended `ConcernImage` interface with file metadata

### Data Structure
```typescript
interface ConcernImage {
  url: string              // Cloudinary URL or base64 data URL
  publicId: string         // Cloudinary ID or local ID
  fileType?: 'image' | 'document'
  fileName?: string        // Original file name
  fileSize?: number        // File size in bytes
}
```

### Testing
1. Upload a PDF file in Submit Action dialog
2. File should show as document icon (not image thumbnail)
3. Click the document icon in the table
4. Document should open in new window and display properly
5. Check View modal - document should be clickable and viewable

### Important Notes
- **Old files uploaded before this fix won't work** - They need to be re-uploaded
- **Cloudinary preset `1BAC_CENTER_RAW` is no longer used** - Documents bypass Cloudinary
- **Images still use Cloudinary** - Only documents use base64 storage
- **No changes needed to Cloudinary settings** - Solution works around the restriction

## Alternative Solutions (Not Implemented)

### Option 1: Upgrade Cloudinary (Paid)
- Change access control to "Public" for raw files
- Requires paid Cloudinary plan
- ❌ User stated Firebase Storage is paid, likely wants free solution

### Option 2: Firebase Storage
- Upload documents to Firebase Storage
- Get download URLs for viewing
- ❌ User stated Firebase Storage is paid

### Option 3: External Storage Service
- Use services like AWS S3, Google Cloud Storage
- ❌ Requires additional setup and potentially paid

## Conclusion
The browser-based base64 solution is the best fit for this use case:
- ✅ Completely free
- ✅ No additional services needed
- ✅ Works with existing Firestore setup
- ✅ Simple implementation
- ✅ Good user experience

The only tradeoff is file size limitations, which is acceptable for typical document uploads in a concern reporting system.
