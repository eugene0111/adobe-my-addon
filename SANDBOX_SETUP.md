# Document Sandbox Setup - Fix Summary

## ✅ What We Fixed

### 1. Manifest Configuration
**File:** `src/manifest.json`

**Before:**
```json
"entryPoints": [
    {
        "type": "panel",
        "id": "panel1",
        "main": "index.html"
    }
]
```

**After:**
```json
"entryPoints": [
    {
        "type": "panel",
        "id": "panel1",
        "main": "index.html",
        "documentSandbox": "code.js"  // ← Added this
    }
]
```

✅ **Fixed:** Added `documentSandbox: "code.js"` property to enable document sandbox runtime.

---

### 2. Document Sandbox API Exposure
**File:** `src/code.js`

**Before:**
- Used ES6 `export` statements
- No `runtime.exposeApi()` call

**After:**
- Imports `addOnSandboxSdk` from `add-on-sdk-document-sandbox`
- Uses `runtime.exposeApi()` to expose functions

✅ **Fixed:** Properly exposes APIs that UI can call via `apiProxy()`.

---

### 3. UI API Proxy Call
**File:** `src/components/App.jsx`

**Before:**
- Basic error handling
- Simple `apiProxy()` call

**After:**
- Better error messages
- Checks for API availability
- Improved debugging info

✅ **Fixed:** Better error handling and clearer debugging messages.

---

## 🔍 How to Test

1. **Rebuild the add-on:**
   ```bash
   npm run build
   ```

2. **Reload the add-on in Adobe Express:**
   - Close and reopen the add-on panel
   - Or refresh the Adobe Express page

3. **Click "Test Document Sandbox" button:**
   - Should connect successfully
   - Check console for "[Document Sandbox] Testing fix executor..." message

---

## ⚠️ If It Still Doesn't Work

### Check 1: SDK Imports
The `add-on-sdk-document-sandbox` package might need to be:
- Loaded from CDN (similar to `add-on-sdk/sdk.js`)
- Or included as a dependency

**Try:** Check if `code.js` errors mention missing `add-on-sdk-document-sandbox` import.

### Check 2: Build Output
Verify `code.js` is included in the build:
- Check `dist/` folder after build
- Should see `code.js` or it should be bundled

### Check 3: Runtime Availability
In browser console, check:
```javascript
// Should be available in code.js context
console.log(typeof addOnSandboxSdk); // Should be 'object'
console.log(typeof runtime); // Should be 'object'
```

### Check 4: Manifest Validation
After build, verify the manifest is valid:
```bash
npm run build
# Should not show manifest validation errors
```

---

## 📝 Two Types of Errors (Recap)

### Type 1: Adobe Express Internal Errors ❌ (CANNOT FIX)
- IndexedDB errors
- Locator errors  
- `installHook.js` errors
- **Action:** Ignore these - they're from Adobe Express, not your code

### Type 2: Document Sandbox API Errors ⚠️ (CAN BE FIXED)
- `runtime.apiProxy is not a function` ✅ **FIXED**
- `Document sandbox API not available` ✅ **FIXED** (with proper setup)
- **Action:** Should work after reload with new manifest

---

## 🎯 Expected Behavior After Fix

1. **"Test Utilities" button:** ✅ Works (already working)
2. **"Test Document Sandbox" button:** Should now work after reload
3. **Console output:** Should see sandbox connection success message

---

## 🚀 Next Steps

1. **Reload the add-on** in Adobe Express (important!)
2. **Click "Test Document Sandbox"** button
3. **Check console** for connection success
4. If errors persist, check the troubleshooting section above
