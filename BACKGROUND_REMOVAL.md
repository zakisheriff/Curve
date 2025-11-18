# Background Removal Feature - Complete Guide

## Overview

The Curve image editor now includes advanced **AI-powered background removal** with multiple levels of sophistication:

### Three-Tier System

#### 1. **Clipdrop API** (Professional Quality - Recommended)

- **Best Quality**: Uses state-of-the-art AI models
- **Fastest Results**: Optimized API
- **Setup**: [Get free API key](https://clipdrop.co/api/docs)
- **Cost**: Free tier available
- **What it does**: Intelligently removes backgrounds while preserving fine details like hair, fur, and transparent objects

#### 2. **Hugging Face BRIA Model** (High Quality)

- **Good Quality**: Advanced neural network
- **Reliable**: Widely used model
- **Setup**: [Get free API key](https://huggingface.co/settings/tokens)
- **Cost**: Free tier available
- **What it does**: Detects and removes backgrounds using BRIA 2.2 ControlNet technology

#### 3. **Advanced Client-Side AI** (Instant, No API Required)

- **Speed**: Instant processing on your device
- **Quality**: Good for simple backgrounds
- **No Setup**: Works out of the box
- **What it does**:
  - Edge detection using Sobel operators
  - Intelligent color clustering
  - Background color palette analysis
  - Smooth alpha blending for natural transitions
  - BFS-based region growing
  - Gaussian smoothing for polished edges

## How It Works

### Selection Priority

When you click "Remove Background", the app automatically tries:

```
Clipdrop API (if configured)
    ↓
Hugging Face API (if configured)
    ↓
Advanced Client-Side AI (always available)
```

### Advanced Client-Side AI Algorithm

This is what runs when no API keys are configured:

```
1. Edge Detection
   └─ Uses Sobel operator to find object boundaries

2. Background Analysis
   └─ Samples 50x50px from each corner
   └─ Clusters colors using k-means
   └─ Builds background color palette

3. Region Growing (Flood Fill)
   └─ Starts from image edges
   └─ Identifies connected background regions
   └─ Marks regions for transparency

4. Edge Smoothing
   └─ Applies Gaussian blur to alpha channel
   └─ Creates smooth, natural transitions
   └─ Prevents harsh, aliased edges
```

## Setup Instructions

### Option 1: Professional Quality (Clipdrop)

1. **Create Account**: Visit https://clipdrop.co/api/docs
2. **Get API Key**: Copy your API key from the dashboard
3. **Add to `.env.local`**:
   ```
   VITE_CLIPDROP_API_KEY=your_api_key_here
   ```
4. **Restart Dev Server**: `npm run dev`

### Option 2: High Quality (Hugging Face)

1. **Create Account**: Visit https://huggingface.co/settings/tokens
2. **Generate Token**: Create a new access token with read permissions
3. **Add to `.env.local`**:
   ```
   VITE_HUGGINGFACE_API_KEY=hf_your_token_here
   ```
4. **Restart Dev Server**: `npm run dev`

### Option 3: Use Both (Recommended for Best Results)

```env
VITE_CLIPDROP_API_KEY=your_clipdrop_key
VITE_HUGGINGFACE_API_KEY=your_hf_token
```

The app will use Clipdrop first (faster), then Hugging Face as backup.

## Features

### What It Can Remove

✅ Solid uniform backgrounds
✅ Gradient backgrounds  
✅ Complex textures
✅ Hair and fur (with good API quality)
✅ Transparent areas
✅ Semi-transparent objects

### What Works Best

- **Images with clear subject-background separation**
- **Professional photography**
- **Product images**
- **Portraits**
- **Graphics with solid backgrounds**

### Limitations

❌ Very complex scenes (many overlapping objects)
❌ Subject touching image edges
❌ Extremely transparent objects
❌ Very small details (for client-side mode)

## Usage in App

1. **Load Image**: Import an image using the upload button
2. **Open AI Tools**: Click the AI icon in the bottom toolbar
3. **Click "Remove Background"**: The app will automatically:
   - Process your image with best available method
   - Show a toast notification with the result
   - Display the processed image (usually in 1-3 seconds)
4. **Export**: Download the result with transparent background as PNG

## Performance

### Response Times

- **Clipdrop API**: 2-5 seconds
- **Hugging Face API**: 3-8 seconds
- **Client-Side AI**: 1-2 seconds

### File Sizes

- Input: Any size (auto-optimized)
- Output: PNG with transparency (lossless)

## Troubleshooting

### "Background removed (Mock mode - Check API key)"

- **Cause**: No API key configured
- **Solution**: Add one of the API keys from setup instructions, or use the built-in client-side AI

### Results Are Too Aggressive/Conservative

- **Too Transparent**: Subject boundaries are being removed
  - Try another API (click again)
  - Adjust your image contrast
- **Not Transparent Enough**: Background not fully removed
  - Image background might be too similar to subject
  - Try pre-processing: adjust contrast, saturation first

### API Returns Error

- **Check Rate Limit**: Both Clipdrop and Hugging Face have free tier limits
- **Check API Key**: Verify key is correct in `.env.local`
- **Check Image Size**: Ensure image isn't too large (>10MB)

## Advanced Tips

### Best Practices

1. **Increase Contrast**: Images with clear subject-background separation work better
2. **Solid Backgrounds**: Uniform backgrounds are easiest to remove
3. **Good Lighting**: Well-lit images process better
4. **Higher Resolution**: Larger images = better detail preservation

### Pre-Processing Workflow

1. Load image
2. Adjust brightness/contrast if needed
3. Remove background
4. Fine-tune with other editing tools
5. Export as PNG

### Combining with Other Tools

```
Load Image
  ↓
Enhance Quality (AI → Enhance)
  ↓
Remove Background
  ↓
Add Border/Effects
  ↓
Export PNG
```

## Technical Details

### Client-Side Algorithm Components

**Sobel Edge Detection**

- Detects edges using horizontal and vertical gradients
- Threshold: 50 pixels for semi-transparent zones
- Preserves fine details at boundaries

**K-Means Color Clustering**

- Clusters corner pixels into 5 groups
- Identifies dominant background colors
- Tolerance: 40 units per channel
- 5 iterations for convergence

**Flood Fill Region Growing**

- BFS-based background identification
- Starts from image borders
- Respects edge boundaries
- Creates connected component analysis

**Gaussian Alpha Smoothing**

- 3x3 kernel smoothing
- Weights: `[1,2,1; 2,4,2; 1,2,1] / 16`
- Reduces aliasing artifacts
- Natural feathering effect

## API Comparisons

| Feature        | Clipdrop       | Hugging Face | Client-Side |
| -------------- | -------------- | ------------ | ----------- |
| Quality        | ⭐⭐⭐⭐⭐     | ⭐⭐⭐⭐     | ⭐⭐⭐      |
| Speed          | ⭐⭐⭐⭐       | ⭐⭐⭐       | ⭐⭐⭐⭐⭐  |
| Setup          | Easy           | Easy         | None        |
| Cost           | Free (limited) | Free         | Free        |
| Complex Scenes | Best           | Good         | Basic       |
| Hair/Details   | Excellent      | Good         | Fair        |

## Limitations & Future Improvements

### Current Limitations

- Client-side AI may struggle with complex images
- API rate limits apply to free tiers
- Very large images may be slow

### Future Enhancements

- [ ] WebGL acceleration for client-side processing
- [ ] User-guided selection tool (paint to remove)
- [ ] Batch processing multiple images
- [ ] Integration with more AI providers
- [ ] Custom background fill/replacement
- [ ] Real-time preview before processing

## Environment Variables

```env
# Required for Clipdrop (professional quality)
VITE_CLIPDROP_API_KEY=your_key

# Required for Hugging Face (high quality)
VITE_HUGGINGFACE_API_KEY=your_token

# Optional: For image enhancement
VITE_OPENAI_API_KEY=your_key
VITE_CLOUDFLARE_ACCOUNT_ID=your_id
VITE_CLOUDFLARE_API_KEY=your_key
```

## Support & Resources

- **Clipdrop Documentation**: https://clipdrop.co/api/docs
- **Hugging Face Guide**: https://huggingface.co/docs/hub/security-tokens
- **BRIA Model**: https://huggingface.co/briaai/BRIA-2.2-ControlNet-Removal
- **Report Issues**: Create an issue on the project repository

---

**Enjoy removing backgrounds with AI!** 🎨✨
