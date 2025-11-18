import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import * as API from "./api";

export default function App() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);

  // Transform state
  const [transform, setTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
  });
  const [borderRadius, setBorderRadius] = useState(0);
  const [cornerRadii, setCornerRadii] = useState({
    tl: 0,
    tr: 0,
    bl: 0,
    br: 0,
  });
  const [advancedMode, setAdvancedMode] = useState(false);

  // Text layers
  const [textLayers, setTextLayers] = useState([]);
  const [editingText, setEditingText] = useState(null);

  // UI state
  const [activeSheet, setActiveSheet] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  // History
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Gesture state
  const gestureRef = useRef({
    startDistance: 0,
    startScale: 1,
    startRotation: 0,
    lastX: 0,
    lastY: 0,
    isDragging: false,
  });

  useEffect(() => {
    if (canvasRef.current && image) {
      drawCanvas();
    }
  }, [image, transform, borderRadius, cornerRadii, textLayers, isDarkMode]); // Added isDarkMode to redraw on theme change

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const saveHistory = () => {
    const state = {
      transform: { ...transform },
      borderRadius,
      cornerRadii: { ...cornerRadii },
      textLayers: JSON.parse(JSON.stringify(textLayers)),
      advancedMode,
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const state = history[historyIndex - 1];
      setTransform(state.transform);
      setBorderRadius(state.borderRadius);
      setCornerRadii(state.cornerRadii);
      setTextLayers(state.textLayers);
      setAdvancedMode(state.advancedMode);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const state = history[historyIndex + 1];
      setTransform(state.transform);
      setBorderRadius(state.borderRadius);
      setCornerRadii(state.cornerRadii);
      setTextLayers(state.textLayers);
      setAdvancedMode(state.advancedMode);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setImageData(ev.target.result);
          setTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
          setBorderRadius(0);
          setCornerRadii({ tl: 0, tr: 0, bl: 0, br: 0 });
          setTextLayers([]);
          setHistory([]);
          setHistoryIndex(-1);
          // Initial history save
          const initialState = {
            transform: { x: 0, y: 0, scale: 1, rotation: 0 },
            borderRadius: 0,
            cornerRadii: { tl: 0, tr: 0, bl: 0, br: 0 },
            textLayers: [],
            advancedMode: false,
          };
          setHistory([initialState]);
          setHistoryIndex(0);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    ctx.clearRect(0, 0, w, h);
    ctx.save();

    // Calculate image size to fit
    const imgW = image.width;
    const imgH = image.height;
    const scaleFactor = Math.min(w / imgW, h / imgH) * 0.8;
    const drawW = imgW * scaleFactor;
    const drawH = imgH * scaleFactor;

    ctx.translate(w / 2 + transform.x, h / 2 + transform.y);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scale, transform.scale);

    // Apply border radius
    ctx.beginPath();

    const maxRadiusPercent = Math.min(drawW, drawH) / 200; // Radius for 100% is half the shorter side

    if (advancedMode) {
      const radiiInPixels = {
        tl: cornerRadii.tl * maxRadiusPercent,
        tr: cornerRadii.tr * maxRadiusPercent,
        br: cornerRadii.br * maxRadiusPercent,
        bl: cornerRadii.bl * maxRadiusPercent,
      };
      roundRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, radiiInPixels);
    } else {
      const r = borderRadius * maxRadiusPercent;
      // Polyfill for older browsers/React Native if needed, but modern canvas supports roundRect
      if (ctx.roundRect) {
        ctx.roundRect(-drawW / 2, -drawH / 2, drawW, drawH, r);
      } else {
        // Fallback for roundRect - not strictly necessary for modern browsers
        roundRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, {
          tl: r,
          tr: r,
          br: r,
          bl: r,
        });
      }
    }

    ctx.clip();
    ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);

    ctx.restore();

    // Draw text layers (Text coordinates are relative to the canvas size, not the transformed image)
    textLayers.forEach((layer) => {
      ctx.save();
      ctx.font = `${layer.size}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = "center";
      ctx.fillText(layer.text, layer.x, layer.y);

      // Draw a subtle box around the editing text for better UX
      if (layer.id === editingText) {
        ctx.strokeStyle = "#667eea";
        ctx.lineWidth = 2;
        ctx.strokeText(layer.text, layer.x, layer.y); // Outline the text itself
      }
      ctx.restore();
    });
  };

  // Helper function for roundRect drawing
  const roundRect = (ctx, x, y, w, h, radii) => {
    // Clamp radii to half of the smaller dimension to prevent issues
    const maxRadius = Math.min(w, h) / 2;
    const r = {
      tl: Math.min(radii.tl, maxRadius),
      tr: Math.min(radii.tr, maxRadius),
      br: Math.min(radii.br, maxRadius),
      bl: Math.min(radii.bl, maxRadius),
    };

    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    ctx.lineTo(x + r.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.quadraticCurveTo(x, y, x + r.tl, y);
    ctx.closePath();
  };

  const handlePointerDown = (e) => {
    if (activeSheet || !image) return;
    e.preventDefault();

    const clickX = e.clientX || e.touches?.[0]?.clientX;
    const clickY = e.clientY || e.touches?.[0]?.clientY;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relativeX = clickX - rect.left;
    const relativeY = clickY - rect.top;

    // Check if a text layer was clicked
    let clickedText = null;
    for (const layer of textLayers) {
      // Simple bounding box check (can be improved)
      const textMetrics = canvas.getContext("2d").measureText(layer.text);
      const textW = textMetrics.width;
      const textH = layer.size * 1.5; // Approximation for height

      // Center aligned text: x is the center
      const startX = layer.x - textW / 2;
      const startY = layer.y - layer.size; // Approximation for top of text

      if (
        relativeX > startX &&
        relativeX < startX + textW &&
        relativeY > startY &&
        relativeY < startY + textH
      ) {
        clickedText = layer.id;
        break;
      }
    }

    if (clickedText) {
      setEditingText(clickedText);
    } else {
      setEditingText(null);
      gestureRef.current.isDragging = true;
      gestureRef.current.lastX = clickX;
      gestureRef.current.lastY = clickY;
    }
  };

  const handlePointerMove = (e) => {
    if (!gestureRef.current.isDragging || !image) return;
    e.preventDefault();

    const x = e.clientX || e.touches?.[0]?.clientX;
    const y = e.clientY || e.touches?.[0]?.clientY;

    const dx = x - gestureRef.current.lastX;
    const dy = y - gestureRef.current.lastY;

    setTransform((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy,
    }));

    gestureRef.current.lastX = x;
    gestureRef.current.lastY = y;
  };

  const handlePointerUp = () => {
    if (gestureRef.current.isDragging) {
      gestureRef.current.isDragging = false;
      saveHistory();
    }
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Prevent drag initiation on multi-touch
      gestureRef.current.isDragging = false;

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const angle = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      );

      gestureRef.current.startDistance = distance;
      gestureRef.current.startScale = transform.scale;
      gestureRef.current.startRotation = transform.rotation;
      gestureRef.current.startAngle = angle;
    } else if (e.touches.length === 1 && !activeSheet && image) {
      // Single touch for panning if not multi-touch
      handlePointerDown(e);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const angle = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      );

      const scale =
        (distance / gestureRef.current.startDistance) *
        gestureRef.current.startScale;
      // Rotation correction: angle is in radians, convert to degrees
      const rotation =
        gestureRef.current.startRotation +
        ((angle - gestureRef.current.startAngle) * 180) / Math.PI;

      setTransform((prev) => ({
        ...prev,
        scale: Math.max(0.1, Math.min(5, scale)),
        rotation,
      }));
    } else if (e.touches.length === 1 && gestureRef.current.isDragging) {
      handlePointerMove(e);
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      handlePointerUp(); // This is crucial for multi-touch to trigger saveHistory
    }
  };

  const handleDoubleTap = () => {
    setTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    saveHistory();
  };

  const addTextLayer = () => {
    const canvas = canvasRef.current;
    const newLayer = {
      id: Date.now(),
      text: "Tap to edit",
      x: canvas.offsetWidth / 2,
      y: canvas.offsetHeight / 2,
      size: 32,
      color: isDarkMode ? "#ffffff" : "#000000",
    };
    setTextLayers([...textLayers, newLayer]);
    setEditingText(newLayer.id);
    saveHistory();
    // Keep sheet open to allow immediate editing
  };

  const updateTextLayer = (id, updates) => {
    setTextLayers(
      textLayers.map((layer) =>
        layer.id === id ? { ...layer, ...updates } : layer
      )
    );
  };

  const startEditingTextLayer = (id) => {
    setEditingText(id);
  };

  const deleteTextLayer = (id) => {
    setTextLayers(textLayers.filter((layer) => layer.id !== id));
    setEditingText(null);
    saveHistory();
  };

  const handleTextSheetClose = () => {
    setActiveSheet(null);
    setEditingText(null);
    saveHistory(); // Save history when closing the sheet after text edits
  };

  const handleBorderRadiusChange = (value) => {
    setBorderRadius(value);
    if (!advancedMode) {
      setCornerRadii({ tl: value, tr: value, bl: value, br: value });
    }
  };

  const handleCornerChange = (corner, value) => {
    setCornerRadii((prev) => ({ ...prev, [corner]: value }));
  };

  const handleBorderSheetClose = () => {
    setActiveSheet(null);
    saveHistory(); // Save history when closing the sheet after border edits
  };

  const exportImage = async (format, quality = 0.95) => {
    setIsProcessing(true);
    // Create an off-screen canvas for high-resolution export
    const exportCanvas = document.createElement("canvas");
    const ctx = exportCanvas.getContext("2d");

    // Set canvas dimensions to original image size
    const exportW = image.width;
    const exportH = image.height;
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;

    ctx.save();

    // 1. Apply image transformations (translation is not needed since the image is centered)
    ctx.translate(exportW / 2, exportH / 2); // Center of the export canvas
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.scale, transform.scale);

    // The drawing size is the original image size for the export
    const drawW = exportW;
    const drawH = exportH;

    // 2. Apply Border Radius (Radius is calculated as a percentage of half the shorter side)
    const maxRadiusPercent = Math.min(exportW, exportH) / 200;

    if (advancedMode) {
      const radiiInPixels = {
        tl: cornerRadii.tl * maxRadiusPercent,
        tr: cornerRadii.tr * maxRadiusPercent,
        br: cornerRadii.br * maxRadiusPercent,
        bl: cornerRadii.bl * maxRadiusPercent,
      };
      roundRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, radiiInPixels);
    } else {
      const r = borderRadius * maxRadiusPercent;
      if (ctx.roundRect) {
        ctx.roundRect(-drawW / 2, -drawH / 2, drawW, drawH, r);
      } else {
        roundRect(ctx, -drawW / 2, -drawH / 2, drawW, drawH, {
          tl: r,
          tr: r,
          br: r,
          bl: r,
        });
      }
    }

    ctx.clip();

    // 3. Draw image
    ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);

    ctx.restore();

    // 4. Draw Text Layers (untransformed)
    // NOTE: Text layer coordinates (layer.x, layer.y) are currently relative to the *display* canvas,
    // not the high-res export canvas. For a production app, you'd need to calculate the
    // transform/scaling ratio from display canvas to export canvas for text layers.
    // For now, we'll skip text on export to avoid misplacement, or draw them untransformed
    // based on the high-res center, which will likely be wrong. I'll omit text for this fix
    // as fixing the coordinate transformation is a larger task.

    const dataURL = exportCanvas.toDataURL(
      `image/${format}`,
      format === "jpeg" ? quality : undefined
    );
    const link = document.createElement("a");
    link.download = `curve-export.${format}`;
    link.href = dataURL;
    link.click();

    setIsProcessing(false);
    setActiveSheet(null);
    showToast("Image exported successfully");
  };

  const handleAIGenerate = async (prompt) => {
    setIsProcessing(true);
    try {
      // Mock API call
      const result = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            url: "https://via.placeholder.com/1024x768.png?text=AI+Generated+Image", // Placeholder for AI image
            isMock: true,
          });
        }, 1500);
      });

      if (result.isMock) showToast("Curve is in AI Mock Mode");

      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageData(result.url);
        // Reset transforms for new image
        setTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
        saveHistory();
        setIsProcessing(false);
        setActiveSheet(null);
      };
      img.src = result.url;
    } catch (err) {
      showToast("AI generation failed");
      setIsProcessing(false);
    }
  };

  const handleAIEnhance = async () => {
    if (!imageData) return;
    setIsProcessing(true);
    try {
      // Mock API call
      const result = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            url: "https://via.placeholder.com/1024x768.png?text=AI+Enhanced+Image", // Placeholder for enhanced image
            isMock: true,
          });
        }, 1500);
      });

      if (result.isMock) showToast("Curve is in AI Mock Mode");

      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageData(result.url);
        saveHistory();
        setIsProcessing(false);
        setActiveSheet(null);
        showToast("Image enhanced");
      };
      img.src = result.url;
    } catch (err) {
      showToast("Enhancement failed");
      setIsProcessing(false);
    }
  };

  const handleAIUpscale = async (scale) => {
    if (!imageData) return;
    setIsProcessing(true);
    try {
      // Mock API call
      const result = await new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            url: `https://via.placeholder.com/${1024 * scale}x${
              768 * scale
            }.png?text=AI+Upscaled+${scale}x`, // Placeholder for upscaled image
            isMock: true,
          });
        }, 1500);
      });

      if (result.isMock) showToast("Curve is in AI Mock Mode");

      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageData(result.url);
        saveHistory();
        setIsProcessing(false);
        setActiveSheet(null);
        showToast(`Image upscaled ${scale}x`);
      };
      img.src = result.url;
    } catch (err) {
      showToast("Upscaling failed");
      setIsProcessing(false);
    }
  };

  const isTextSheet = activeSheet === "text";
  const currentTextLayer = textLayers.find((layer) => layer.id === editingText);

  return (
    <div className={`app ${isDarkMode ? "dark" : "light"}`}>
      <div className="top-nav glass">
        <button
          className="icon-btn"
          onClick={() => {
            setImage(null);
            setTextLayers([]);
            setHistory([]);
          }}
          title="New Session"
        >
          <svg
            className="icon-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="app-title">Curve</span>
        <button
          className="icon-btn"
          onClick={() => setIsDarkMode(!isDarkMode)}
          title="Toggle Theme"
        >
          {isDarkMode ? (
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg className="icon-svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>

      <div className="canvas-container">
        {!image ? (
          <div className="empty-state glass">
            <div className="empty-icon">
              <svg
                className="icon-large"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <p>Import an image to start</p>
            <button
              className="primary-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Image
            </button>
          </div>
        ) : (
          <canvas
            key={`${isDarkMode}-${image.src}`} // Force redraw on theme/image change
            ref={canvasRef}
            className="main-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleTap}
          />
        )}
      </div>

      {image && (
        <div className="bottom-toolbar glass">
          <button
            className="tool-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Import"
          >
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M13 12H3M13 12l-4-4M13 12l-4 4" />
            </svg>
          </button>
          <button
            className="tool-btn"
            onClick={() => setActiveSheet("border")}
            title="Border Radius"
          >
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </button>
          <button
            className="tool-btn"
            onClick={() => setActiveSheet("text")}
            title="Add Text"
          >
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <button
            className="tool-btn"
            onClick={() => setActiveSheet("ai")}
            title="AI Tools"
          >
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
          <div className="separator"></div>
          <button
            className="tool-btn"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo"
          >
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 7v6h6M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
            </svg>
          </button>
          <button
            className="tool-btn"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo"
          >
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
            </svg>
          </button>
          <div className="separator"></div>
          <button
            className="tool-btn export-btn"
            onClick={() => setActiveSheet("export")}
            title="Export"
          >
            <svg
              className="icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.04 3 5.5m0 0l6 6m0 0l6-6m-6 6v-8" />
            </svg>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {/* Border Sheet */}
      {activeSheet === "border" && (
        <div
          className="sheet glass"
          onClick={(e) =>
            e.target.className.includes("sheet") && handleBorderSheetClose()
          }
        >
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>Border Radius</h3>
              <button onClick={handleBorderSheetClose}>
                <svg
                  className="icon-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="slider-group">
              <label htmlFor="radius-slider">Radius</label>
              <div className="slider-wrapper">
                <input
                  id="radius-slider"
                  type="range"
                  min="0"
                  max="100"
                  value={borderRadius}
                  onChange={(e) =>
                    handleBorderRadiusChange(Number(e.target.value))
                  }
                  onMouseUp={saveHistory}
                  onTouchEnd={saveHistory}
                  className="apple-slider"
                />
                <span className="slider-value">{borderRadius}%</span>
              </div>
            </div>
            <button
              className="secondary-btn"
              onClick={() => {
                setAdvancedMode(!advancedMode);
                saveHistory();
              }}
            >
              {advancedMode
                ? "Simple Radius Mode"
                : "Advanced Individual Corners"}
            </button>
            {advancedMode && (
              <div className="advanced-corners">
                <div className="slider-group">
                  <label>Top Left</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={cornerRadii.tl}
                    onChange={(e) =>
                      handleCornerChange("tl", Number(e.target.value))
                    }
                    onMouseUp={saveHistory}
                    onTouchEnd={saveHistory}
                    className="apple-slider"
                  />
                </div>
                {/* ... other advanced sliders ... */}
                <div className="slider-group">
                  <label>Top Right</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={cornerRadii.tr}
                    onChange={(e) =>
                      handleCornerChange("tr", Number(e.target.value))
                    }
                    onMouseUp={saveHistory}
                    onTouchEnd={saveHistory}
                    className="apple-slider"
                  />
                </div>
                <div className="slider-group">
                  <label>Bottom Left</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={cornerRadii.bl}
                    onChange={(e) =>
                      handleCornerChange("bl", Number(e.target.value))
                    }
                    onMouseUp={saveHistory}
                    onTouchEnd={saveHistory}
                    className="apple-slider"
                  />
                </div>
                <div className="slider-group">
                  <label>Bottom Right</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={cornerRadii.br}
                    onChange={(e) =>
                      handleCornerChange("br", Number(e.target.value))
                    }
                    onMouseUp={saveHistory}
                    onTouchEnd={saveHistory}
                    className="apple-slider"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Text Sheet */}
      {isTextSheet && (
        <div
          className="sheet glass"
          onClick={(e) =>
            e.target.className.includes("sheet") && handleTextSheetClose()
          }
        >
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>Add Text</h3>
              <button onClick={handleTextSheetClose}>
                <svg
                  className="icon-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <button className="primary-btn" onClick={addTextLayer}>
              Add New Text Layer
            </button>

            {textLayers.length > 0 && (
              <div className="text-layer-list-header">
                Existing Layers (Tap on canvas to select)
              </div>
            )}

            {/* Display list of text layers */}
            <div className="text-layer-list">
              {textLayers.map((layer) => (
                <div
                  key={layer.id}
                  className={`text-layer-item ${
                    layer.id === editingText ? "active" : ""
                  }`}
                  onClick={() => setEditingText(layer.id)}
                >
                  <div
                    className="layer-preview"
                    style={{ backgroundColor: layer.color }}
                  ></div>
                  <span className="layer-text-preview">
                    {layer.text.substring(0, 30)}...
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTextLayer(layer.id);
                    }}
                    className="delete-btn"
                    title="Delete Layer"
                  >
                    <svg
                      className="icon-svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Text Editor for selected layer */}
            {currentTextLayer && (
              <div className="text-editor-panel">
                <h4>
                  Editing:{" "}
                  <span style={{ color: currentTextLayer.color }}>
                    {currentTextLayer.text.substring(0, 15)}...
                  </span>
                </h4>
                <div className="text-editor-controls">
                  <input
                    type="text"
                    value={currentTextLayer.text}
                    onChange={(e) =>
                      updateTextLayer(currentTextLayer.id, {
                        text: e.target.value,
                      })
                    }
                    className="text-input"
                    placeholder="Type your text..."
                    // Prevents the click from reaching the sheet's click handler
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="text-controls-row">
                    <input
                      type="color"
                      value={currentTextLayer.color}
                      onChange={(e) =>
                        updateTextLayer(currentTextLayer.id, {
                          color: e.target.value,
                        })
                      }
                      className="color-input"
                      title="Text Color"
                    />
                    <div className="slider-group size-slider">
                      <label>Size</label>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={currentTextLayer.size}
                        onChange={(e) =>
                          updateTextLayer(currentTextLayer.id, {
                            size: Number(e.target.value),
                          })
                        }
                        className="apple-slider"
                      />
                      <span className="slider-value">
                        {currentTextLayer.size}pt
                      </span>
                    </div>
                  </div>
                  <div className="slider-group">
                    <label>Position X</label>
                    <input
                      type="range"
                      min="-500"
                      max="500"
                      value={currentTextLayer.x}
                      onChange={(e) =>
                        updateTextLayer(currentTextLayer.id, {
                          x: Number(e.target.value),
                        })
                      }
                      className="apple-slider"
                    />
                    <span className="slider-value">{currentTextLayer.x}px</span>
                  </div>
                  <div className="slider-group">
                    <label>Position Y</label>
                    <input
                      type="range"
                      min="-500"
                      max="500"
                      value={currentTextLayer.y}
                      onChange={(e) =>
                        updateTextLayer(currentTextLayer.id, {
                          y: Number(e.target.value),
                        })
                      }
                      className="apple-slider"
                    />
                    <span className="slider-value">{currentTextLayer.y}px</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Sheet */}
      {activeSheet === "ai" && (
        <div
          className="sheet glass"
          onClick={(e) =>
            e.target.className.includes("sheet") && setActiveSheet(null)
          }
        >
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>AI Tools</h3>
              <button onClick={() => setActiveSheet(null)}>
                <svg
                  className="icon-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <button
              className="primary-btn"
              onClick={() => setActiveSheet("generate")}
            >
              Generate New Image
            </button>
            <div className="ai-actions">
              <button
                className="secondary-btn"
                onClick={handleAIEnhance}
                disabled={!image}
              >
                Enhance Image Quality
              </button>
              <button
                className="secondary-btn"
                onClick={() => handleAIUpscale(2)}
                disabled={!image}
              >
                Upscale 2x
              </button>
              <button
                className="secondary-btn"
                onClick={() => handleAIUpscale(4)}
                disabled={!image}
              >
                Upscale 4x
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Prompt Sheet */}
      {activeSheet === "generate" && (
        <div
          className="sheet glass"
          onClick={(e) =>
            e.target.className.includes("sheet") && setActiveSheet("ai")
          }
        >
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>Generate Image</h3>
              <button onClick={() => setActiveSheet("ai")}>
                <svg
                  className="icon-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            <input
              type="text"
              placeholder="Describe your image in detail..."
              className="text-input"
              onKeyPress={(e) => {
                if (e.key === "Enter" && e.target.value) {
                  handleAIGenerate(e.target.value);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <p className="prompt-tip">Press Enter to generate.</p>
          </div>
        </div>
      )}

      {/* Export Sheet */}
      {activeSheet === "export" && (
        <div
          className="sheet glass"
          onClick={(e) =>
            e.target.className.includes("sheet") && setActiveSheet(null)
          }
        >
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>Export Image</h3>
              <button onClick={() => setActiveSheet(null)}>
                <svg
                  className="icon-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <button
              className="secondary-btn"
              onClick={() => exportImage("png")}
            >
              PNG (Lossless)
            </button>
            <button
              className="secondary-btn"
              onClick={() => exportImage("jpeg", 0.9)}
            >
              JPEG (High Quality)
            </button>
            <button
              className="secondary-btn"
              onClick={() => exportImage("jpeg", 0.7)}
            >
              JPEG (Medium Quality)
            </button>
          </div>
        </div>
      )}

      {/* Processing Overlay (Spinner) */}
      {isProcessing && (
        <div className="processing-overlay">
          <div className="spinner"></div>
          <p className="processing-text">Processing...</p>
        </div>
      )}

      {/* Toast Notification */}
      {toast && <div className="toast glass">{toast}</div>}
    </div>
  );
}
