// import dotenv from 'dotenv';
// dotenv.config();

// API Configuration

const API_KEYS = {
  openai: import.meta.env.VITE_OPENAI_API_KEY || "",
  replicate: import.meta.env.VITE_REPLICATE_API_KEY || "",
  cloudflare: {
    accountId: import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID || "",
    apiKey: import.meta.env.VITE_CLOUDFLARE_API_KEY || "",
  },
};

// Check if running in mock mode
const isMockMode = () => {
  return (
    !API_KEYS.openai.startsWith("sk-") && !API_KEYS.replicate.startsWith("r8_")
  );
};

// ============================================
// AI IMAGE GENERATION (OpenAI DALL-E)
// ============================================
export const generateImage = async (prompt) => {
  if (isMockMode()) {
    return mockGenerateImage(prompt);
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEYS.openai}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      url: data.data[0].url,
      isMock: false,
    };
  } catch (error) {
    console.error("OpenAI generation failed:", error);
    return mockGenerateImage(prompt);
  }
};

// ============================================
// AI IMAGE UPSCALE (Replicate Real-ESRGAN)
// ============================================
export const upscaleImage = async (imageDataURL, scale = 2) => {
  if (isMockMode()) {
    return mockUpscaleImage(imageDataURL, scale);
  }

  try {
    // Start prediction
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${API_KEYS.replicate}`,
      },
      body: JSON.stringify({
        version:
          "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
        input: {
          image: imageDataURL,
          scale: scale,
          face_enhance: false,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`);
    }

    const prediction = await response.json();

    // Poll for completion
    let result = prediction;
    while (result.status !== "succeeded" && result.status !== "failed") {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            Authorization: `Token ${API_KEYS.replicate}`,
          },
        }
      );

      result = await pollResponse.json();
    }

    if (result.status === "failed") {
      throw new Error("Upscaling failed");
    }

    return {
      url: result.output,
      isMock: false,
    };
  } catch (error) {
    console.error("Replicate upscale failed:", error);
    return mockUpscaleImage(imageDataURL, scale);
  }
};

// ============================================
// AI IMAGE ENHANCE (Cloudflare AI)
// ============================================
export const enhanceImage = async (imageDataURL) => {
  if (isMockMode()) {
    return mockEnhanceImage(imageDataURL);
  }

  try {
    // Convert data URL to blob
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
      ctx.font = "bold 48px -apple-system, BlinkMacSystemFont, sans-serif";
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

// ============================================
// HELPER FUNCTIONS
// ============================================

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

export default {
  generateImage,
  upscaleImage,
  enhanceImage,
};
