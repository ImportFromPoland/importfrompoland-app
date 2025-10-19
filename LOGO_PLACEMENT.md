# Logo Placement Instructions

## 📁 Where to Place Your Logo

**Save your logo file here:**
```
C:\Users\micha\importfrompoland-app\public\logo.png
```

**Important:**
- File MUST be named exactly: `logo.png`
- Format: PNG with transparent background (recommended)
- Location: `public/` folder in project root
- This works for both local development AND when deployed online

---

## ✅ Logo Has Been Integrated

Your logo is already integrated throughout the app in:

### **1. Login Page** (`/login`)
- Displayed above the login form
- 300px × 150px size
- Centered

### **2. Onboarding Page** (`/onboarding`)
- Displayed above the registration form
- 300px × 150px size
- Centered

### **3. Password Reset Page** (`/reset-password`)
- Displayed above the reset form
- 300px × 150px size
- Centered

### **4. Client Dashboard** (`/` - main dashboard)
- Displayed in header (top left)
- 200px × 80px size
- Clickable - links back to dashboard
- Shows company name next to it

### **5. Order Pages** (`/orders/new`, `/orders/[id]`, `/orders/[id]/edit`)
- Displayed in header (top left)
- 180px × 70px size
- Clickable - links back to dashboard

### **6. Admin Panel** (`/admin/*`)
- Displayed in header (top left)
- 180px × 70px size
- Not clickable in admin (shows "Admin Panel" label)

---

## 🎨 Logo Component

A reusable `<Logo>` component has been created with these features:

**Props:**
- `width` - Logo width in pixels (default: 200)
- `height` - Logo height in pixels (default: 100)
- `linkToDashboard` - Make logo clickable to dashboard (default: false)
- `showText` - Show "ImportFromPoland" text next to logo (default: false)
- `className` - Additional CSS classes

**Example Usage:**
```tsx
import { Logo } from "@/components/Logo";

// Simple logo
<Logo />

// Custom size
<Logo width={300} height={150} />

// Clickable logo
<Logo linkToDashboard={true} />

// With text
<Logo showText={true} />
```

---

## 📏 Recommended Logo Specifications

For best results, your logo file should be:

- **Format:** PNG with transparent background
- **Dimensions:** At least 600px × 300px (will be scaled down)
- **Aspect Ratio:** Approximately 2:1 (width:height)
- **File Size:** Under 500KB for fast loading
- **Colors:** Red (#E94444 or similar) on transparent background

---

## 🚀 Deployment Note

When you deploy to production (Vercel, Netlify, etc.):

1. **The logo will automatically work** - no changes needed
2. The `public/` folder contents are served at the root URL
3. So `/logo.png` will be accessible at `https://yourdomain.com/logo.png`
4. Next.js Image component optimizes it automatically

---

## ✨ Next.js Image Optimization

The logo uses Next.js `<Image>` component which provides:

- ✅ Automatic image optimization
- ✅ Lazy loading (images load when needed)
- ✅ Responsive sizes
- ✅ WebP format conversion (modern browsers)
- ✅ Priority loading on important pages (login, dashboard)

---

**Just drop your logo file in `/public/logo.png` and refresh the browser!** 🎨

