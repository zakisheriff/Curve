// ============================================
// API Configuration
// ============================================

const API_KEYS = {
  // Hugging Face API Key (free, no credit card required)
  // Get it at: https://huggingface.co/settings/tokens
  // NOTE: This key is now REQUIRED for the Generative Fill feature to work correctly.
  huggingface: import.meta.env.VITE_HUGGINGFACE_API_KEY || "",

  // Optional: Background removal proxy URL (use a serverless proxy to avoid CORS)
  // Example: set `VITE_BG_PROXY_URL` to your proxy endpoint which will forward
  // requests to Hugging Face or any other background removal API server-side.
  bgProxy: import.meta.env.VITE_BG_PROXY_URL || "",
  // Optional: Hugging Face Space URL for background removal (e.g. https://huggingface.co/spaces/owner/space)
  // Set `VITE_HF_SPACE_URL` to the public Space URL (the code will POST to `/api/predict` or `/run/predict`).
  hfSpace: import.meta.env.VITE_HF_SPACE_URL || "",

  // Existing keys (kept for upscale/enhance functionality)
  openai: import.meta.env.VITE_OPENAI_API_KEY || "",
  cloudflare: {
    accountId: import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID || "",
    apiKey: import.meta.env.VITE_CLOUDFLARE_API_KEY || "",
  },
};

/**
 * Checks if the application should run in mock mode for Generative Fill/Enhance.
 * @returns {boolean} True if in mock mode (Hugging Face key missing or invalid).
 */
const isMockMode = () => {
  return !API_KEYS.huggingface || API_KEYS.huggingface.trim() === "";
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Converts a data URL (like image data) into a Blob object.
 * @param {string} dataurl - The data URL string.
 * @returns {Blob} The converted Blob.
 */
const dataURLtoBlob = (dataurl) => {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

const getColorsFromPrompt = (prompt) => {
  const lower = prompt.toLowerCase();
  if (
    lower.includes("ocean") ||
    lower.includes("sea") ||
    lower.includes("water")
  ) {
    return ["#667eea", "#3b82f6"];
  }
  if (
    lower.includes("sunset") ||
    lower.includes("fire") ||
    lower.includes("warm")
  ) {
    return ["#f093fb", "#f5576c"];
  }
  if (
    lower.includes("forest") ||
    lower.includes("nature") ||
    lower.includes("green")
  ) {
    return ["#4facfe", "#00f2fe"];
  }
  if (
    lower.includes("space") ||
    lower.includes("galaxy") ||
    lower.includes("cosmic")
  ) {
    return ["#30cfd0", "#330867"];
  }
  if (
    lower.includes("night") ||
    lower.includes("dark") ||
    lower.includes("moon")
  ) {
    return ["#2c3e50", "#4ca1af"];
  }
  // Default purple-pink gradient
  return ["#a8edea", "#fed6e3"];
};

const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
  const words = text.split(" ");
  let line = "";
  const lines = [];

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && i > 0) {
      lines.push(line);
      line = words[i] + " ";
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, x, startY + i * lineHeight);
  });
};

const applySharpen = (ctx, width, height) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  const side = Math.round(Math.sqrt(kernel.length));
  const halfSide = Math.floor(side / 2);
  const output = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0;

      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          const scy = y + cy - halfSide;
          const scx = x + cx - halfSide;

          if (scy >= 0 && scy < height && scx >= 0 && scx < width) {
            const srcOff = (scy * width + scx) * 4;
            const wt = kernel[cy * side + cx];

            r += data[srcOff] * wt;
            g += data[srcOff + 1] * wt;
            b += data[srcOff + 2] * wt;
          }
        }
      }

      const dstOff = (y * width + x) * 4;
      output.data[dstOff] = Math.min(255, Math.max(0, r));
      output.data[dstOff + 1] = Math.min(255, Math.max(0, g));
      output.data[dstOff + 2] = Math.min(255, Math.max(0, b));
      output.data[dstOff + 3] = data[dstOff + 3];
    }
  }

  ctx.putImageData(output, 0, 0);
};

// ============================================
// AI IMAGE GENERATION (Pollinations.ai)
// ============================================
export const generateImage = async (prompt) => {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    // Increased size for better mock experience
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=flux&width=1024&height=1024&seed=${Math.random()}`;

    // Verify the image loads
    const response = await fetch(imageUrl, { method: "HEAD" });

    if (!response.ok) {
      throw new Error(`Pollinations API error: ${response.status}`);
    }

    return {
      url: imageUrl,
      isMock: false,
    };
  } catch (error) {
    console.error("Pollinations.ai image generation failed:", error);
    // Fall back to the mock if the real API call fails
    return mockGenerateImage(prompt);
  }
};

// ============================================
// AI IMAGE UPSCALE (Mock)
// ============================================
export const upscaleImage = async (imageDataURL, scale = 2) => {
  return mockUpscaleImage(imageDataURL, scale);
};

// ============================================
// AI IMAGE ENHANCE (Cloudflare AI)
// ============================================
export const enhanceImage = async (imageDataURL) => {
  if (!API_KEYS.cloudflare.accountId || !API_KEYS.cloudflare.apiKey) {
    return mockEnhanceImage(imageDataURL);
  }

  try {
    const blob = await fetch(imageDataURL).then((r) => r.blob());

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${API_KEYS.cloudflare.accountId}/ai/run/@cf/ai-image-enhance`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEYS.cloudflare.apiKey}`,
        },
        body: blob,
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudflare API error: ${response.status}`);
    }

    const enhancedBlob = await response.blob();
    const enhancedDataURL = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(enhancedBlob);
    });

    return {
      url: enhancedDataURL,
      isMock: false,
    };
  } catch (error) {
    console.error("Cloudflare enhance failed:", error);
    return mockEnhanceImage(imageDataURL);
  }
};

// ============================================
// AI GENERATIVE FILL (FIXED: Hugging Face Inpainting - Returning Data URL)
// ============================================
/**
 * Performs generative fill (inpainting) on a specific area of an image.
 * @param {string} imageDataURL - The original image as data URL.
 * @param {string} maskDataURL - The mask indicating area to fill (white = fill, black = keep).
 * @param {string} prompt - Description of what to generate.
 * @returns {Promise} - Returns URL of the filled image.
 */
export const generativeFill = async (imageDataURL, maskDataURL, prompt) => {
  if (isMockMode()) {
    return {
      url: imageDataURL,
      isMock: true,
      message: "Hugging Face API Key is required for Generative Fill.",
    };
  }

  // Model specifically for Inpainting
  const model = "runwayml/stable-diffusion-inpainting";

  const imageBlob = dataURLtoBlob(imageDataURL);
  const maskBlob = dataURLtoBlob(maskDataURL);

  const formData = new FormData();
  // The 'image' is the source image
  formData.append("image", imageBlob, "image.png");
  // The 'mask' is the area to replace (white=replace, black=keep)
  formData.append("mask", maskBlob, "mask.png");
  // The 'prompt' is the text input
  formData.append("prompt", prompt);

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        headers: { Authorization: `Bearer ${API_KEYS.huggingface}` },
        // IMPORTANT: No explicit 'Content-Type' header for FormData
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      // Throw error to be caught and logged
      throw new Error(
        `Hugging Face Inpainting Error: ${response.status} - ${errorText}`
      );
    }

    const imageBlobResult = await response.blob();

    // *** FIX: Convert the resulting Blob back to a Data URL (base64) ***
    // This is necessary because the rest of the application (like `App.jsx`)
    // expects a Data URL for `imageData` state consistency.
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(imageBlobResult);
    });

    return { url: dataUrl, isMock: false };
  } catch (error) {
    console.error("Generative Fill failed, falling back to mock:", error);
    // Return original image in case of failure with error message
    return {
      url: imageDataURL,
      isMock: true,
      message: `Generative Fill Failed: ${error.message}`,
    };
  }
};

// ============================================
// MOCK IMPLEMENTATIONS (Fallback)
// ============================================

const mockGenerateImage = async (prompt) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Create a gradient placeholder with text
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d");

      // Gradient background based on prompt
      const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
      const colors = getColorsFromPrompt(prompt);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[1]);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1024, 1024);

      // Add text
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 48px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const words = prompt.split(" ").slice(0, 5).join(" ");
      wrapText(ctx, words, 512, 512, 900, 60);

      resolve({
        url: canvas.toDataURL("image/png"),
        isMock: true,
      });
    }, 1500);
  });
};

const mockUpscaleImage = async (imageDataURL, scale) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");

        // Use bicubic-like smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Slight sharpening filter
        applySharpen(ctx, canvas.width, canvas.height);

        resolve({
          url: canvas.toDataURL("image/png"),
          isMock: true,
        });
      };
      img.src = imageDataURL;
    }, 2000);
  });
};

const mockEnhanceImage = async (imageDataURL) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(img, 0, 0);

        // Apply enhancement filters
        ctx.filter = "contrast(1.1) saturate(1.15) brightness(1.05)";
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = "none";

        resolve({
          url: canvas.toDataURL("image/png"),
          isMock: true,
        });
      };
      img.src = imageDataURL;
    }, 1000);
  });
};

/**
 * Removes background from an image using AI.
 * Primary: Hugging Face BRIA model (optionally via `VITE_BG_PROXY_URL` to avoid CORS)
 * Fallback: Client-side intelligent background removal
 * @param {string} imageDataURL - The image data URL
 * @returns {Promise<{url: string, isMock: boolean}>} - Result with image URL and mock status
 */

// If you want to use a public Hugging Face Space for background removal, set `VITE_HF_SPACE_URL`.
// This helper will POST JSON { data: [dataURL] } to the Space endpoints and attempt to extract a data URL or returned image URL.
async function removeBackgroundSpace(imageDataURL) {
  try {
    const spaceUrl = API_KEYS.hfSpace && API_KEYS.hfSpace.trim();
    if (!spaceUrl) return null;

    const base = spaceUrl.replace(/\/$/, "");
    const endpoints = [
      `${base}/api/predict`,
      `${base}/run/predict`,
      `${base}/api`,
    ];

    for (const endpoint of endpoints) {
      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: [imageDataURL] }),
        });

        if (!resp.ok) {
          console.warn(`HF Space ${endpoint} returned ${resp.status}`);
          continue;
        }

        const json = await resp.json();
        let out = null;
        if (json) {
          if (Array.isArray(json.data) && json.data.length) out = json.data[0];
          else if (Array.isArray(json.predictions) && json.predictions.length)
            out = json.predictions[0];
          else if (Array.isArray(json.output) && json.output.length)
            out = json.output[0];
        }

        if (!out) {
          console.warn("HF Space response did not include usable data", json);
          continue;
        }

        if (typeof out === "string") {
          if (out.startsWith("data:")) return { url: out, isMock: false };
          if (out.startsWith("http")) {
            const fileResp = await fetch(out);
            if (!fileResp.ok) continue;
            const blob = await fileResp.blob();
            const reader = new FileReader();
            return await new Promise((resolve) => {
              reader.onloadend = () =>
                resolve({ url: reader.result, isMock: false });
              reader.readAsDataURL(blob);
            });
          }
        }

        if (typeof out === "object") {
          if (
            out.data &&
            typeof out.data === "string" &&
            out.data.startsWith("data:")
          )
            return { url: out.data, isMock: false };
          if (out.image && typeof out.image === "string") {
            if (out.image.startsWith("data:"))
              return { url: out.image, isMock: false };
            if (out.image.startsWith("http")) {
              const fileResp = await fetch(out.image);
              if (!fileResp.ok) continue;
              const blob = await fileResp.blob();
              const reader = new FileReader();
              return await new Promise((resolve) => {
                reader.onloadend = () =>
                  resolve({ url: reader.result, isMock: false });
                reader.readAsDataURL(blob);
              });
            }
          }
        }
      } catch (err) {
        console.warn("HF Space endpoint error", endpoint, err && err.message);
        continue;
      }
    }

    return null;
  } catch (err) {
    console.error("removeBackgroundSpace error:", err);
    return null;
  }
}

export const removeBackground = async (imageDataURL) => {
  // Primary: try client-side AI eraser (no API keys required). Uses TensorFlow.js + BodyPix if available.
  try {
    const clientResult = await removeBackgroundClientAI(imageDataURL);
    if (clientResult) {
      console.log("✓ Client-side AI background removal successful");
      return clientResult;
    }
  } catch (err) {
    console.warn(
      "Client-side AI eraser failed or not available, continuing with other methods",
      err && err.message
    );
  }
  /**
   * Client-side AI background eraser using TensorFlow.js + BodyPix.
   * Falls back gracefully if TF or the model isn't installed.
   */
  async function removeBackgroundClientAI(imageDataURL) {
    try {
      // Dynamic import so it only loads when needed
      const tf = await import("@tensorflow/tfjs");
      const bodyPix = await import("@tensorflow-models/body-pix");

      // Load a lightweight BodyPix model for speed
      const net = await bodyPix.load({
        architecture: "MobileNetV1",
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2,
      });

      // Helper to load image element
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.onload = () => resolve(im);
        im.onerror = (e) =>
          reject(new Error("Failed to load image for client AI"));
        im.src = imageDataURL;
      });

      // Run person segmentation; this model is tuned for people but works reasonably for subjects with clear separation.
      // Use `segmentPerson` for speed and simpler mask.
      const segmentation = await net.segmentPerson(img, {
        internalResolution: "medium",
        segmentationThreshold: 0.7,
      });

      const { width, height } = img;
      // Draw original image to canvas then apply mask to alpha channel
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // segmentation.data is a Uint8Array of 0/1 values per pixel
      for (let i = 0; i < segmentation.data.length; i++) {
        const alpha = segmentation.data[i] ? 255 : 0;
        data[i * 4 + 3] = alpha;
      }

      ctx.putImageData(imageData, 0, 0);

      return { url: canvas.toDataURL("image/png"), isMock: false };
    } catch (err) {
      // If modules are not available or model fails, instruct how to enable.
      if (err && err.code === "ERR_MODULE_NOT_FOUND") {
        console.warn(
          "TensorFlow or BodyPix not installed. Install with: npm install @tensorflow/tfjs @tensorflow-models/body-pix"
        );
      } else {
        console.warn(
          "Client-side background eraser error:",
          err && err.message
        );
      }
      return null;
    }
  }
  // If a background-proxy is configured, prefer that (it should forward to an API server-side)
  if (API_KEYS.bgProxy && API_KEYS.bgProxy.trim() !== "") {
    try {
      console.log("Attempting background removal via configured bg proxy...");
      const result = await removeBackgroundHuggingFace(imageDataURL, {
        useProxy: true,
      });
      if (result) return result;
    } catch (error) {
      console.warn(
        "Background proxy failed, trying direct Hugging Face...",
        error
      );
    }
  }

  // Try Hugging Face directly (requires a valid HF token)
  if (API_KEYS.huggingface && API_KEYS.huggingface.trim() !== "") {
    try {
      console.log("Attempting background removal with Hugging Face...");
      const result = await removeBackgroundHuggingFace(imageDataURL, {
        useProxy: false,
      });
      if (result) return result;
    } catch (error) {
      console.warn(
        "Hugging Face background removal failed, using client-side fallback...",
        error
      );
    }
  }

  // Fallback to advanced client-side AI removal
  console.log("Using client-side AI background removal fallback...");
  return advancedRemoveBackground(imageDataURL);
};

/**
 * Remove background using Hugging Face BRIA model
 */
const removeBackgroundHuggingFace = async (
  imageDataURL,
  options = { useProxy: false }
) => {
  try {
    const blob = dataURLtoBlob(imageDataURL);

    // If a bg proxy is configured and caller requested it, try the proxy first.
    if (
      options.useProxy &&
      API_KEYS.bgProxy &&
      API_KEYS.bgProxy.trim() !== ""
    ) {
      try {
        const proxyResp = await fetch(API_KEYS.bgProxy, {
          method: "POST",
          headers: API_KEYS.huggingface
            ? { Authorization: `Bearer ${API_KEYS.huggingface}` }
            : {},
          body: blob,
        });

        if (proxyResp.ok) {
          const resultBlob = await proxyResp.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () =>
              resolve({ url: reader.result, isMock: false });
            reader.readAsDataURL(resultBlob);
          });
        }

        console.warn(
          `BG proxy responded with ${proxyResp.status}, falling back to direct endpoints`
        );
      } catch (proxyErr) {
        console.warn("BG proxy request failed:", proxyErr.message);
      }
    }

    // Try multiple Hugging Face model endpoints in case one is unavailable
    const modelEndpoints = [
      "https://api-inference.huggingface.co/models/briaai/BRIA-2.2-ControlNet-Removal",
      "https://api-inference.huggingface.co/models/briaai/BRIA-2.3",
      "https://api-inference.huggingface.co/models/briaai/BRIA-RMBG-1.4",
    ];

    for (const endpoint of modelEndpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${API_KEYS.huggingface}` },
          method: "POST",
          body: blob,
        });

        if (response.status === 410) {
          console.warn(
            `Model at ${endpoint} returned 410 Gone, trying next...`
          );
          continue;
        }

        if (!response.ok) {
          console.warn(
            `Hugging Face background removal failed: ${response.status}`,
            await response.text()
          );
          continue;
        }

        const resultBlob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () =>
            resolve({ url: reader.result, isMock: false });
          reader.readAsDataURL(resultBlob);
        });
      } catch (endpointError) {
        console.warn(`Failed to reach ${endpoint}:`, endpointError.message);
        continue;
      }
    }

    console.warn("All Hugging Face model endpoints failed or unavailable");
    return null;
  } catch (error) {
    console.error("Hugging Face background removal error:", error);
    return null;
  }
};

/**
 * Advanced AI-based background removal using intelligent edge detection and color analysis
 * Runs on the client side for instant results
 */
const advancedRemoveBackground = async (imageDataURL) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        // Draw image
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Step 1: Analyze image to find dominant background colors and edges
        const edges = detectEdges(data, canvas.width, canvas.height);

        // Step 2: Identify background regions using multiple methods
        const bgMask = identifyBackground(
          data,
          edges,
          canvas.width,
          canvas.height
        );

        // Step 3: Apply smart alpha blending for smooth transitions
        for (let i = 0; i < data.length; i += 4) {
          const pixelIndex = i / 4;
          const alpha = bgMask[pixelIndex];
          data[i + 3] = alpha; // Set alpha channel
        }

        // Step 4: Apply feathering/smoothing on edges
        smoothAlphaEdges(data, bgMask, canvas.width, canvas.height);

        ctx.putImageData(imageData, 0, 0);

        resolve({
          url: canvas.toDataURL("image/png"),
          isMock: true,
        });
      };
      img.src = imageDataURL;
    }, 1500);
  });
};

/**
 * Detect edges in the image using Sobel operator
 */
const detectEdges = (data, width, height) => {
  const edges = new Float32Array(width * height);

  // Sobel operator kernels
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      // Apply Sobel operator
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray =
            data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
          const kernel_idx = (ky + 1) * 3 + (kx + 1);
          gx += gray * sobelX[kernel_idx];
          gy += gray * sobelY[kernel_idx];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = Math.min(255, magnitude);
    }
  }

  return edges;
};

/**
 * Identify background regions using color clustering and edge information
 */
const identifyBackground = (data, edges, width, height) => {
  const bgMask = new Uint8Array(width * height);

  // Sample corner pixels to get background color palette
  const cornerSamples = sampleCornerPixels(data, width, height);
  const bgColorPalette = clusterColors(cornerSamples, 5);

  // Flood fill from edges using background colors
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

  // BFS to identify connected background regions
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const idx = y * width + x;

    if (visited[idx]) continue;
    visited[idx] = 1;

    const pixelIdx = idx * 4;
    const r = data[pixelIdx];
    const g = data[pixelIdx + 1];
    const b = data[pixelIdx + 2];

    // Check if this pixel matches background color palette
    if (isBackgroundColor(r, g, b, bgColorPalette)) {
      bgMask[idx] = 0; // Transparent
      // Add neighbors to queue
      if (x > 0) queue.push([x - 1, y]);
      if (x < width - 1) queue.push([x + 1, y]);
      if (y > 0) queue.push([x, y - 1]);
      if (y < height - 1) queue.push([x, y + 1]);
    } else {
      // Check edge strength for soft transitions
      const edgeStrength = edges[idx];
      if (edgeStrength < 50) {
        bgMask[idx] = 128; // Semi-transparent
      } else {
        bgMask[idx] = 255; // Opaque (foreground)
      }
    }
  }

  return bgMask;
};

/**
 * Sample pixels from image corners
 */
const sampleCornerPixels = (data, width, height) => {
  const samples = [];
  const sampleSize = Math.min(
    50,
    Math.floor(width / 10),
    Math.floor(height / 10)
  );

  // Top-left
  for (let y = 0; y < sampleSize; y++) {
    for (let x = 0; x < sampleSize; x++) {
      const idx = (y * width + x) * 4;
      samples.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
  }

  // Top-right
  for (let y = 0; y < sampleSize; y++) {
    for (let x = width - sampleSize; x < width; x++) {
      const idx = (y * width + x) * 4;
      samples.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
  }

  // Bottom-left
  for (let y = height - sampleSize; y < height; y++) {
    for (let x = 0; x < sampleSize; x++) {
      const idx = (y * width + x) * 4;
      samples.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
  }

  // Bottom-right
  for (let y = height - sampleSize; y < height; y++) {
    for (let x = width - sampleSize; x < width; x++) {
      const idx = (y * width + x) * 4;
      samples.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
  }

  return samples;
};

/**
 * Cluster similar colors using simple k-means
 */
const clusterColors = (colors, k) => {
  if (colors.length === 0) return [];

  // Initialize centroids from random samples
  const centroids = [];
  for (let i = 0; i < Math.min(k, colors.length); i++) {
    centroids.push(colors[Math.floor(Math.random() * colors.length)].slice());
  }

  // Simple k-means iterations
  for (let iter = 0; iter < 5; iter++) {
    // Assign points to nearest centroid
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

    // Update centroids
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

/**
 * Calculate Euclidean distance between two RGB colors
 */
const colorDistance = (c1, c2) => {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

/**
 * Check if a color matches any in the background palette
 */
const isBackgroundColor = (r, g, b, palette) => {
  const threshold = 40; // Color similarity threshold
  for (const [pr, pg, pb] of palette) {
    const dist = Math.sqrt((r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2);
    if (dist < threshold) return true;
  }
  return false;
};

/**
 * Smooth alpha channel at edges for better blending
 */
const smoothAlphaEdges = (data, alphaMask, width, height) => {
  // Apply Gaussian blur to alpha channel for smooth transitions
  const tempAlpha = new Uint8Array(alphaMask);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // Apply 3x3 Gaussian kernel
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

  // Update alpha channel in image data
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    data[i + 3] = tempAlpha[pixelIndex];
  }
};

/**
 * Mock background removal using canvas filters (legacy fallback)
 */

/**
 * AI Expand - Expands an image with AI-generated content to fill a larger canvas
 * @param {string} imageDataURL - The image data URL
 * @param {number} expandFactor - How much to expand (e.g., 1.5 for 50% expansion)
 * @param {string} prompt - Optional prompt to guide the expansion
 * @returns {Promise<{url: string, isMock: boolean}>} - Result with expanded image URL
 */
export const aiExpand = async (
  imageDataURL,
  expandFactor = 1.5,
  prompt = ""
) => {
  if (isMockMode()) {
    return mockAIExpand(imageDataURL, expandFactor);
  }

  try {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        try {
          const newWidth = Math.round(img.width * expandFactor);
          const newHeight = Math.round(img.height * expandFactor);

          // Create expanded canvas
          const canvas = document.createElement("canvas");
          canvas.width = newWidth;
          canvas.height = newHeight;
          const ctx = canvas.getContext("2d");

          // Fill background with image average color
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = img.width;
          tempCanvas.height = img.height;
          const tempCtx = tempCanvas.getContext("2d");
          tempCtx.drawImage(img, 0, 0);

          const imgData = tempCtx.getImageData(
            0,
            0,
            img.width,
            img.height
          ).data;
          let r = 0,
            g = 0,
            b = 0;
          for (let i = 0; i < imgData.length; i += 4) {
            r += imgData[i];
            g += imgData[i + 1];
            b += imgData[i + 2];
          }
          const pixelCount = imgData.length / 4;
          r = Math.round(r / pixelCount);
          g = Math.round(g / pixelCount);
          b = Math.round(b / pixelCount);

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(0, 0, newWidth, newHeight);

          // Draw original image in the center
          const offsetX = (newWidth - img.width) / 2;
          const offsetY = (newHeight - img.height) / 2;
          ctx.drawImage(img, offsetX, offsetY);

          // Use Hugging Face for outpainting
          const maskCanvas = document.createElement("canvas");
          maskCanvas.width = newWidth;
          maskCanvas.height = newHeight;
          const maskCtx = maskCanvas.getContext("2d");
          maskCtx.fillStyle = "#000000";
          maskCtx.fillRect(0, 0, newWidth, newHeight);
          maskCtx.fillStyle = "#ffffff";
          maskCtx.fillRect(offsetX, offsetY, img.width, img.height);

          // Try to use outpainting model
          const maskUrl = maskCanvas.toDataURL("image/png");
          const mainUrl = canvas.toDataURL("image/png");

          const formData = new FormData();
          // Convert data URLs to blobs
          const mainBlob = dataURLtoBlob(mainUrl);
          const maskBlob = dataURLtoBlob(maskUrl);

          formData.append("init_image", mainBlob);
          formData.append("mask", maskBlob);
          formData.append(
            "prompt",
            prompt || "seamless extension, continuation"
          );

          const response = await fetch(
            "https://api-inference.huggingface.co/models/diffusers/stable-diffusion-2-inpainting",
            {
              headers: { Authorization: `Bearer ${API_KEYS.huggingface}` },
              method: "POST",
              body: formData,
            }
          );

          if (!response.ok) {
            console.warn("AI expand failed, using mock mode");
            const fallback = await mockAIExpand(imageDataURL, expandFactor);
            resolve(fallback);
            return;
          }

          const resultBlob = await response.blob();
          const url = URL.createObjectURL(resultBlob);

          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              url: reader.result,
              isMock: false,
            });
          };
          reader.readAsDataURL(resultBlob);
        } catch (error) {
          console.error("AI expand error in onload:", error);
          const fallback = await mockAIExpand(imageDataURL, expandFactor);
          resolve(fallback);
        }
      };
      img.onerror = () => {
        reject(new Error("Failed to load image"));
      };
      img.src = imageDataURL;
    });
  } catch (error) {
    console.error("AI expand error:", error);
    return mockAIExpand(imageDataURL, expandFactor);
  }
};

/**
 * Mock AI Expand using canvas - creates a seamless expansion
 */
const mockAIExpand = async (imageDataURL, expandFactor = 1.5) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const newWidth = Math.round(img.width * expandFactor);
        const newHeight = Math.round(img.height * expandFactor);

        const canvas = document.createElement("canvas");
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext("2d");

        // Get average color from image edges
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.drawImage(img, 0, 0);
        const imageData = tempCtx.getImageData(
          0,
          0,
          img.width,
          img.height
        ).data;

        let r = 0,
          g = 0,
          b = 0;
        for (let i = 0; i < imageData.length; i += 4) {
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
        }
        const pixelCount = imageData.length / 4;
        r = Math.round(r / pixelCount);
        g = Math.round(g / pixelCount);
        b = Math.round(b / pixelCount);

        // Draw gradient background (mock outpainting effect)
        const gradient = ctx.createLinearGradient(0, 0, newWidth, newHeight);
        gradient.addColorStop(
          0,
          `rgb(${Math.min(255, r + 20)}, ${Math.min(255, g + 20)}, ${Math.min(
            255,
            b + 20
          )})`
        );
        gradient.addColorStop(0.5, `rgb(${r}, ${g}, ${b})`);
        gradient.addColorStop(
          1,
          `rgb(${Math.max(0, r - 20)}, ${Math.max(0, g - 20)}, ${Math.max(
            0,
            b - 20
          )})`
        );

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, newWidth, newHeight);

        // Draw original in center
        const offsetX = (newWidth - img.width) / 2;
        const offsetY = (newHeight - img.height) / 2;
        ctx.drawImage(img, offsetX, offsetY);

        // Add subtle edge blending
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < 30; i++) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.05 - i * 0.001})`;
          ctx.fillRect(
            offsetX - i,
            offsetY - i,
            img.width + i * 2,
            img.height + i * 2
          );
        }

        resolve({
          url: canvas.toDataURL("image/png"),
          isMock: true,
        });
      };
      img.src = imageDataURL;
    }, 2000);
  });
};

export default {
  generateImage,
  upscaleImage,
  enhanceImage,
  generativeFill,
  removeBackground,
  aiExpand,
};
