# Code Examples & Technical Reference

## How Background Removal Works in Your App

### User Flow

```javascript
// User clicks "Remove Background" in AI Tools menu
handleRemoveBackground() {
  ↓
  API.removeBackground(imageData) {
    ↓
    // Try Clipdrop first
    if (VITE_CLIPDROP_API_KEY) → removeBackgroundClipdrop()
    ↓
    // Try HuggingFace if Clipdrop unavailable
    if (VITE_HUGGINGFACE_API_KEY) → removeBackgroundHuggingFace()
    ↓
    // Use built-in AI if no keys
    advancedRemoveBackground() {
      1. detectEdges()
      2. identifyBackground()
      3. smoothAlphaEdges()
      return PNG with transparency
    }
  }
  ↓
  Display result
  Export as PNG
}
```

## API Integration Examples

### Using Clipdrop API

```javascript
const removeBackgroundClipdrop = async (imageDataURL) => {
  const blob = dataURLtoBlob(imageDataURL);
  const formData = new FormData();
  formData.append("image_file", blob);

  const response = await fetch("https://clipdrop-api.co/remove-background/v1", {
    method: "POST",
    headers: {
      "x-api-key": "sk_your_api_key_here",
    },
    body: formData,
  });

  const resultBlob = await response.blob();
  // Convert to data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        url: reader.result,
        isMock: false,
      });
    };
    reader.readAsDataURL(resultBlob);
  });
};
```

### Using Hugging Face API

```javascript
const removeBackgroundHuggingFace = async (imageDataURL) => {
  const blob = dataURLtoBlob(imageDataURL);

  const response = await fetch(
    "https://api-inference.huggingface.co/models/briaai/BRIA-2.2-ControlNet-Removal",
    {
      headers: {
        Authorization: `Bearer hf_your_token_here`,
      },
      method: "POST",
      body: blob,
    }
  );

  const resultBlob = await response.blob();
  // Convert to data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        url: reader.result,
        isMock: false,
      });
    };
    reader.readAsDataURL(resultBlob);
  });
};
```

## Client-Side Algorithm - Detailed

### 1. Edge Detection with Sobel Operator

```javascript
const detectEdges = (data, width, height) => {
  const edges = new Float32Array(width * height);

  // Sobel kernels for edge detection
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  // For each pixel (except borders)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      // Apply 3x3 kernel
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;

          // Convert to grayscale
          const gray =
            data[idx] * 0.299 + // R
            data[idx + 1] * 0.587 + // G
            data[idx + 2] * 0.114; // B

          // Apply kernel
          const kernel_idx = (ky + 1) * 3 + (kx + 1);
          gx += gray * sobelX[kernel_idx];
          gy += gray * sobelY[kernel_idx];
        }
      }

      // Calculate gradient magnitude
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = Math.min(255, magnitude);
    }
  }

  return edges;
};
```

### 2. Background Color Clustering (K-Means)

```javascript
const clusterColors = (colors, k) => {
  // Initialize k random centroids
  const centroids = [];
  for (let i = 0; i < Math.min(k, colors.length); i++) {
    centroids.push(colors[Math.floor(Math.random() * colors.length)].slice());
  }

  // K-means iterations
  for (let iter = 0; iter < 5; iter++) {
    // Step 1: Assign each point to nearest centroid
    const clusters = centroids.map(() => []);
    for (const color of colors) {
      let minDist = Infinity;
      let nearestCluster = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = colorDistance(color, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          nearestCluster = i;
        }
      }
      clusters[nearestCluster].push(color);
    }

    // Step 2: Update centroids
    for (let i = 0; i < centroids.length; i++) {
      if (clusters[i].length > 0) {
        let r = 0,
          g = 0,
          b = 0;
        for (const color of clusters[i]) {
          r += color[0];
          g += color[1];
          b += color[2];
        }
        centroids[i] = [
          Math.round(r / clusters[i].length),
          Math.round(g / clusters[i].length),
          Math.round(b / clusters[i].length),
        ];
      }
    }
  }

  return centroids;
};
```

### 3. Flood Fill Background Identification

```javascript
const identifyBackground = (data, edges, width, height) => {
  const bgMask = new Uint8Array(width * height);

  // Sample corners and cluster colors
  const cornerSamples = sampleCornerPixels(data, width, height);
  const bgColorPalette = clusterColors(cornerSamples, 5);

  const visited = new Uint8Array(width * height);
  const queue = [];

  // Start from all border pixels
  for (let x = 0; x < width; x++) {
    queue.push([x, 0]);
    queue.push([x, height - 1]);
    visited[x] = 1;
    visited[(height - 1) * width + x] = 1;
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push([0, y]);
    queue.push([width - 1, y]);
    visited[y * width] = 1;
    visited[y * width + width - 1] = 1;
  }

  // BFS to find connected background regions
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const idx = y * width + x;

    if (visited[idx]) continue;
    visited[idx] = 1;

    const pixelIdx = idx * 4;
    const r = data[pixelIdx];
    const g = data[pixelIdx + 1];
    const b = data[pixelIdx + 2];

    // Check if pixel is background color
    if (isBackgroundColor(r, g, b, bgColorPalette)) {
      bgMask[idx] = 0; // Make transparent

      // Add neighbors to queue
      if (x > 0) queue.push([x - 1, y]);
      if (x < width - 1) queue.push([x + 1, y]);
      if (y > 0) queue.push([x, y - 1]);
      if (y < height - 1) queue.push([x, y + 1]);
    } else {
      // Soft edge: use edge strength
      const edgeStrength = edges[idx];
      bgMask[idx] = edgeStrength < 50 ? 128 : 255;
    }
  }

  return bgMask;
};
```

### 4. Gaussian Smoothing on Alpha Channel

```javascript
const smoothAlphaEdges = (data, alphaMask, width, height) => {
  // Create temporary alpha channel
  const tempAlpha = new Uint8Array(alphaMask);

  // Apply Gaussian blur to alpha channel
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // 3x3 Gaussian kernel weights:
      // [1, 2, 1]
      // [2, 4, 2]
      // [1, 2, 1]
      // Divided by 16 for normalization

      const sum =
        alphaMask[(y - 1) * width + (x - 1)] * 1 +
        alphaMask[(y - 1) * width + x] * 2 +
        alphaMask[(y - 1) * width + (x + 1)] * 1 +
        alphaMask[y * width + (x - 1)] * 2 +
        alphaMask[idx] * 4 +
        alphaMask[y * width + (x + 1)] * 2 +
        alphaMask[(y + 1) * width + (x - 1)] * 1 +
        alphaMask[(y + 1) * width + x] * 2 +
        alphaMask[(y + 1) * width + (x + 1)] * 1;

      tempAlpha[idx] = Math.round(sum / 16);
    }
  }

  // Update image data alpha channel
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    data[i + 3] = tempAlpha[pixelIndex];
  }
};
```

## Integration with Your App

### In App.jsx

```javascript
// Handler already exists in your code:
const handleRemoveBackground = async () => {
  if (!imageData) {
    showToast("Please load an image first");
    return;
  }
  setIsProcessing(true);
  try {
    const result = await API.removeBackground(imageData);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      setImageData(result.url);
      saveHistory(); // Save to history for undo
      setIsProcessing(false);
      setActiveSheet(null);
      showToast(
        result.isMock
          ? "Background removed (Client-Side AI)"
          : "Background removed successfully"
      );
    };
    img.src = result.url;
  } catch (err) {
    console.error("Background removal error:", err);
    showToast("Background removal failed");
    setIsProcessing(false);
  }
};
```

## Environment Variables

### .env.local Example

```env
# Clipdrop (Priority 1 - Best Quality)
VITE_CLIPDROP_API_KEY=sk_prod_abcd1234efgh5678

# Hugging Face (Priority 2 - Good Quality)
VITE_HUGGINGFACE_API_KEY=hf_abcdefghijklmnopqrstuvwxyz123456789

# Other features (optional)
VITE_OPENAI_API_KEY=sk_test_123456789
VITE_CLOUDFLARE_ACCOUNT_ID=d1234567890abcdef
VITE_CLOUDFLARE_API_KEY=v1.abcdef123456789
```

## Performance Optimization

### For Large Images

```javascript
// In api.js - auto-optimize large images
const optimizeImageForAPI = (imageDataURL) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // If image is too large, resize it
      if (img.width > 2048 || img.height > 2048) {
        const canvas = document.createElement("canvas");
        const maxDim = 1024;
        const scale = Math.min(maxDim / img.width, maxDim / img.height);

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } else {
        resolve(imageDataURL);
      }
    };
    img.src = imageDataURL;
  });
};
```

## Error Handling

```javascript
// Built-in error handling with fallback
export const removeBackground = async (imageDataURL) => {
  try {
    // Try Clipdrop
    if (API_KEYS.clipdrop) {
      const result = await removeBackgroundClipdrop(imageDataURL);
      if (result) return result;
    }
  } catch (error) {
    console.warn("Clipdrop failed:", error);
  }

  try {
    // Try HuggingFace
    if (API_KEYS.huggingface) {
      const result = await removeBackgroundHuggingFace(imageDataURL);
      if (result) return result;
    }
  } catch (error) {
    console.warn("HuggingFace failed:", error);
  }

  // Fallback to client-side
  return advancedRemoveBackground(imageDataURL);
};
```

## Testing

### Unit Test Example

```javascript
// Test the color distance function
import { colorDistance } from "./api.js";

test("colorDistance calculates Euclidean distance", () => {
  const color1 = [255, 0, 0]; // Red
  const color2 = [0, 255, 0]; // Green
  const distance = colorDistance(color1, color2);

  // Expected: sqrt(255^2 + 255^2) ≈ 360.6
  expect(distance).toBeCloseTo(360.6, 1);
});
```

## Further Customization

### Adjust Background Detection Sensitivity

```javascript
// In advancedRemoveBackground()
const bgColorPalette = clusterColors(cornerSamples, 5); // More clusters = more precise

// Adjust tolerance
const isBackgroundColor = (r, g, b, palette) => {
  const threshold = 40; // Lower = stricter detection
  // ...
};
```

### Fine-tune Smoothing

```javascript
// More iterations = smoother edges (but slower)
for (let iter = 0; iter < 10; iter++) {
  // Increase from 1
  smoothAlphaEdges(data, bgMask, width, height);
}
```

---

**These examples show how the AI background removal integrates with your Curve app!**
