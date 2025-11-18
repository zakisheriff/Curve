# Setup Guide: AI Background Removal

## Quick Setup (5 minutes)

### Step 1: Choose Your Option

**Option A: Best Quality (Recommended)**

- Go to: https://clipdrop.co/api/docs
- Sign up for free
- Copy your API key

**Option B: Good Quality (Free)**

- Go to: https://huggingface.co/settings/tokens
- Create new token
- Copy the token

**Option C: No Setup Needed**

- Just use the built-in AI
- Works instantly with no keys

---

### Step 2: Create Environment File

In your project root (`/Users/afraasheriff/Desktop/curve-cla/curve/`), create a new file:

**File name**: `.env.local`

**Content** (choose one or both):

```env
# Option A: Clipdrop (Professional)
VITE_CLIPDROP_API_KEY=your_api_key_here

# Option B: Hugging Face (High Quality)
VITE_HUGGINGFACE_API_KEY=hf_your_token_here

# Option C: Or use both!
VITE_CLIPDROP_API_KEY=your_clipdrop_key
VITE_HUGGINGFACE_API_KEY=hf_your_token
```

### Step 3: Restart Development Server

```bash
npm run dev
```

### Step 4: Test It!

1. Open the app at `http://localhost:5173`
2. Import an image
3. Click the AI Tools button (⚙️)
4. Click "Remove Background"
5. Watch the magic happen! ✨

---

## What You Get

### With Clipdrop API

- ⭐⭐⭐⭐⭐ Best quality results
- Professional-grade background removal
- Excellent with hair, fur, fine details
- 2-5 second processing

### With Hugging Face API

- ⭐⭐⭐⭐ High quality
- Advanced neural network
- Good detail preservation
- 3-8 second processing

### With Client-Side AI (No Keys)

- ⭐⭐⭐ Good quality
- Instant 1-2 second processing
- Works with any image
- No internet required (runs locally)

---

## Troubleshooting

### "Check API key" Message?

This means no API key is configured. You have two options:

1. **Add an API key** (follow Step 1-3 above)
2. **Use built-in AI** (it will process locally)

### Results Don't Look Right?

- Make sure background is distinct from subject
- Try increasing image contrast first
- Use a different API (app will try all available)

### Getting Rate Limited?

- Clipdrop & HuggingFace have free tier limits
- Wait a moment and try again
- Or remove a key to use the client-side AI

---

## How It Works

When you click "Remove Background":

```
1. Checks if Clipdrop API key exists
   → If yes, uses it (best quality)
   → If no, continues to step 2

2. Checks if HuggingFace API key exists
   → If yes, uses it (good quality)
   → If no, continues to step 3

3. Uses built-in AI (instant, always works)
   → Processes on your device
   → Returns PNG with transparent background
```

---

## API Costs

### Clipdrop

- **Free tier**: 50 API calls/month
- **Paid**: Starting at $5/month for more calls
- **Quality**: Best in class

### Hugging Face

- **Free tier**: Unlimited with rate limits
- **Pro**: $9/month for priority
- **Quality**: Excellent

### Client-Side AI

- **Cost**: Free forever
- **Quality**: Good
- **Bonus**: Works offline!

---

## File Structure

After setup, your project will have:

```
curve/
├── src/
│   ├── api.js (Enhanced with new functions)
│   └── App.jsx (Already has Remove Background button)
├── .env.local (Create this - add your keys)
├── .env.example (Reference file)
├── BACKGROUND_REMOVAL.md (Full documentation)
├── BACKGROUND_REMOVAL_SUMMARY.md (Overview)
└── SETUP_GUIDE.md (This file)
```

---

## Getting API Keys

### Clipdrop (5 minutes)

1. Visit: https://clipdrop.co/api/docs
2. Click "Sign Up"
3. Create account
4. Go to dashboard
5. Copy API key
6. Done! ✅

### Hugging Face (5 minutes)

1. Visit: https://huggingface.co/settings/tokens
2. Click "Login" (or create account)
3. Create new token
4. Give it a name (e.g., "curve-app")
5. Copy the token
6. Done! ✅

---

## Testing

### Test with Client-Side AI (No Setup)

1. Skip Step 1-2
2. Just run `npm run dev`
3. Upload an image with clear background
4. Click AI Tools → Remove Background
5. See results in 1-2 seconds

### Test with Clipdrop

1. Get Clipdrop API key
2. Add to .env.local
3. Restart dev server
4. Should be faster and better quality

### Test with HuggingFace

1. Get HuggingFace token
2. Add to .env.local
3. Restart dev server
4. Results in 3-8 seconds

---

## Advanced Options

### Using Both APIs (Recommended)

```env
VITE_CLIPDROP_API_KEY=clipdrop_key_here
VITE_HUGGINGFACE_API_KEY=hf_huggingface_token
```

**Result**: App tries Clipdrop first (faster), then HuggingFace (fallback)

### For Production

When deploying to production:

1. Add environment variables to your hosting platform
2. For Vercel: Project Settings → Environment Variables
3. For Netlify: Site Settings → Build & Deploy → Environment
4. Add each key separately

---

## Example .env.local

```env
# Clipdrop (Professional background removal)
VITE_CLIPDROP_API_KEY=sk_1234567890abcdef

# Hugging Face (Alternative background removal)
VITE_HUGGINGFACE_API_KEY=hf_abcdefghijklmnopqrstuvwxyz

# Optional: For other features
VITE_OPENAI_API_KEY=sk_test_...
VITE_CLOUDFLARE_ACCOUNT_ID=account_id_here
VITE_CLOUDFLARE_API_KEY=api_key_here
```

---

## Common Questions

**Q: Do I need both API keys?**
A: No! Use whichever you prefer, or none (client-side AI works great).

**Q: Can I use it without internet?**
A: With client-side AI, yes! With API keys, it needs internet for the API call.

**Q: What image formats work?**
A: Any format (JPG, PNG, WebP, etc.). Output is always PNG.

**Q: How big can images be?**
A: Up to 10MB recommended. Larger images may be auto-compressed.

**Q: Is my image data sent to servers?**
A: Only when using API keys (Clipdrop/HuggingFace). Client-side AI never leaves your device.

**Q: Can I remove backgrounds batch?**
A: Currently one at a time. Batch feature coming soon!

---

## Getting Help

- **Full Documentation**: See `BACKGROUND_REMOVAL.md`
- **Implementation Details**: See `BACKGROUND_REMOVAL_SUMMARY.md`
- **Code**: Check `src/api.js` for the implementation
- **Issues**: Create an issue on GitHub

---

**Enjoy your new background removal feature!** 🎨✨

Start with the built-in AI, then add API keys when you want better quality.
