import BottomToolbar from "./components/BottomToolbar";
import React, { useState, useRef, useEffect } from "react";
import "./App.css";
import * as API from "./api";
import TopNav from "./components/TopNav";

export default function App() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(null);
  const [imageData, setImageData] = useState(null);

  // Transform state (Resize/Rotate/Pan - Non-destructive)
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

  // Generative fill state
  const [isGenerativeFillMode, setIsGenerativeFillMode] = useState(false);
  const [generativeFillPrompt, setGenerativeFillPrompt] = useState("");
  const [fillMaskCanvas, setFillMaskCanvas] = useState(null);
  const fillCanvasRef = useRef(null);
  const fillCtxRef = useRef(null);
  const fillStartRef = useRef({ x: 0, y: 0 });
  const [isDrawingFillMask, setIsDrawingFillMask] = useState(false);

  // Multi-layer system
  const [imageLayers, setImageLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const [layerIdCounter, setLayerIdCounter] = useState(0);

  // UI state
  const [activeSheet, setActiveSheet] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("Processing...");
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
    startAngle: 0,
  });

  // Crop state (Destructive - changes image data)
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState(null); // {x, y, w, h, straightenAngle}
  const cropStartRef = useRef(null);
  const cropHasMovedRef = useRef(false);
  const [cropAspectRatio, setCropAspectRatio] = useState(null); // null = free, or a number for locked ratio
  const [cropConstrainProportions, setCropConstrainProportions] =
    useState(false);
  const [showCropGrid, setShowCropGrid] = useState(true);

  // AI Expand state
  const [isAIExpandMode, setIsAIExpandMode] = useState(false);
  const [aiExpandFactor, setAIExpandFactor] = useState(1.5);
  const [aiExpandPrompt, setAIExpandPrompt] = useState("");

  useEffect(() => {
    if (canvasRef.current && image) {
      drawCanvas();
    }
  }, [
    image,
    transform,
    borderRadius,
    cornerRadii,
    textLayers,
    imageLayers,
    selectedLayerId,
    isDarkMode,
    isGenerativeFillMode,
    fillMaskCanvas,
    isCropping,
    cropRect,
    showCropGrid,
  ]);

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
      imageLayers: JSON.parse(
        JSON.stringify(
          imageLayers.map((l) => {
            if (l.type === "image") {
              return { ...l, image: null, imageData: l.imageData };
            }
            return l;
          })
        )
      ),
      selectedLayerId,
      advancedMode,
      // Store image data URL to reliably restore the base image
      imageData: imageData,
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const restoreState = async (state) => {
    setTransform(state.transform);
    setBorderRadius(state.borderRadius);
    setCornerRadii(state.cornerRadii);
    setTextLayers(state.textLayers);
    setAdvancedMode(state.advancedMode);
    setSelectedLayerId(state.selectedLayerId);

    // Restore image layers with proper image objects
    if (state.imageLayers) {
      const restoredLayers = await Promise.all(
        state.imageLayers.map(async (layer) => {
          if (layer.type === "image" && layer.imageData) {
            return new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                resolve({ ...layer, image: img });
              };
              img.src = layer.imageData;
            });
          }
          return layer;
        })
      );
      setImageLayers(restoredLayers);
    }

    // --- FIX: Correctly restore image from history's data URL ---
    if (state.imageData) {
      const img = new Image();
      // Only set the state once the image is loaded to prevent drawing errors
      img.onload = () => {
        setImage(img);
      };
      img.src = state.imageData;
      setImageData(state.imageData);
    } else {
      setImage(null);
      setImageData(null);
    }
    // -----------------------------------------------------------
  };

  const undo = () => {
    if (historyIndex > 0) {
      const state = history[historyIndex - 1];
      restoreState(state);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const state = history[historyIndex + 1];
      restoreState(state);
      setHistoryIndex(historyIndex + 1);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* LAYER MANAGEMENT (Multi-layer system from not.jsx)                       */
  /* -------------------------------------------------------------------------- */

  const createImageLayer = (imageData, imageSrc) => {
    const img = new Image();
    img.onload = () => {
      const newLayer = {
        id: layerIdCounter,
        type: "image",
        name: `Image ${layerIdCounter}`,
        visible: true,
        opacity: 100,
        locked: false,
        imageData,
        image: img,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        borderRadius: 0,
      };

      setLayerIdCounter((prev) => prev + 1);
      setImageLayers((prev) => [...prev, newLayer]);
      setSelectedLayerId(newLayer.id);
      saveHistory();
    };
    img.src = imageSrc;
  };

  const updateImageLayer = (id, updates) => {
    setImageLayers((prev) =>
      prev.map((layer) => (layer.id === id ? { ...layer, ...updates } : layer))
    );
  };

  const deleteImageLayer = (id) => {
    setImageLayers((prev) => prev.filter((layer) => layer.id !== id));
    if (selectedLayerId === id) {
      setSelectedLayerId(imageLayers.length > 1 ? imageLayers[0].id : null);
    }
    saveHistory();
  };

  const duplicateImageLayer = (id) => {
    const layer = imageLayers.find((l) => l.id === id);
    if (!layer) return;

    const newLayer = {
      ...layer,
      id: layerIdCounter,
      name: `${layer.name} copy`,
    };

    setLayerIdCounter((prev) => prev + 1);
    setImageLayers((prev) => [...prev, newLayer]);
    saveHistory();
  };

  const moveImageLayer = (id, direction) => {
    const index = imageLayers.findIndex((l) => l.id === id);
    if (index === -1) return;

    const newIndex = direction === "up" ? index + 1 : index - 1;
    if (newIndex < 0 || newIndex >= imageLayers.length) return;

    const newLayers = [...imageLayers];
    [newLayers[index], newLayers[newIndex]] = [
      newLayers[newIndex],
      newLayers[index],
    ];
    setImageLayers(newLayers);
    saveHistory();
  };

  /* -------------------------------------------------------------------------- */
  /* CROP IMPLEMENTATION (Fixed)                      */
  /* -------------------------------------------------------------------------- */

  const initializeCropMode = () => {
    if (!image) return;
    setIsCropping(true);
    setActiveSheet(null); // Close any open sheet
    // Set initial crop rect to full image size (with a slight margin/padding)
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const padding = 20;

    setCropRect({
      x: padding,
      y: padding,
      w: w - 2 * padding,
      h: h - 2 * padding,
      dragHandle: null, // Tracks the currently dragged handle
      straightenAngle: 0, // For straightening logic
    });
    setCropAspectRatio(null);
    setCropConstrainProportions(false);
    setShowCropGrid(true);
  };

  const handleCropStart = (e) => {
    if (!isCropping || activeSheet) return;
    e.preventDefault();

    const clickX = e.clientX || e.touches?.[0]?.clientX;
    const clickY = e.clientY || e.touches?.[0]?.clientY;
    const canvas = canvasRef.current;
    if (!canvas || !cropRect) return;
    const rect = canvas.getBoundingClientRect();
    const relativeX = clickX - rect.left;
    const relativeY = clickY - rect.top;

    // Check if a handle is clicked (simplified logic for center handles/corners)
    const hitThreshold = 15; // pixels
    let dragHandle = null;

    const handles = [
      { name: "tl", x: cropRect.x, y: cropRect.y },
      { name: "tr", x: cropRect.x + cropRect.w, y: cropRect.y },
      { name: "bl", x: cropRect.x, y: cropRect.y + cropRect.h },
      { name: "br", x: cropRect.x + cropRect.w, y: cropRect.y + cropRect.h },
      { name: "t", x: cropRect.x + cropRect.w / 2, y: cropRect.y },
      { name: "b", x: cropRect.x + cropRect.w / 2, y: cropRect.y + cropRect.h },
      { name: "l", x: cropRect.x, y: cropRect.y + cropRect.h / 2 },
      { name: "r", x: cropRect.x + cropRect.w, y: cropRect.y + cropRect.h / 2 },
      // Check for a move of the entire rectangle
      {
        name: "move",
        x: cropRect.x + cropRect.w / 2,
        y: cropRect.y + cropRect.h / 2,
        moveThreshold: 0,
      },
    ];

    for (const handle of handles) {
      const distance = Math.hypot(relativeX - handle.x, relativeY - handle.y);
      if (distance < hitThreshold) {
        dragHandle = handle.name;
        break;
      }
    }

    // Check for 'move' if not near a handle
    if (
      !dragHandle &&
      relativeX > cropRect.x &&
      relativeX < cropRect.x + cropRect.w &&
      relativeY > cropRect.y &&
      relativeY < cropRect.y + cropRect.h
    ) {
      dragHandle = "move";
    }

    if (dragHandle) {
      cropStartRef.current = {
        x: relativeX,
        y: relativeY,
        rect: { ...cropRect }, // Save initial crop rect state
        dragHandle: dragHandle,
      };
      cropHasMovedRef.current = false;
      setCropRect((prev) => ({ ...prev, dragHandle: dragHandle }));
    } else {
      // Start a new crop selection
      cropStartRef.current = {
        x: relativeX,
        y: relativeY,
        rect: null, // Indicates a new selection
        dragHandle: "new",
      };
      cropHasMovedRef.current = false;
      setCropRect(null); // Temporarily clear old rect while drawing
    }
  };

  const handleCropMove = (e) => {
    if (!cropStartRef.current || !isCropping || activeSheet) return;
    e.preventDefault();
    cropHasMovedRef.current = true;

    const clickX = e.clientX || e.touches?.[0]?.clientX;
    const clickY = e.clientY || e.touches?.[0]?.clientY;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relativeX = clickX - rect.left;
    const relativeY = clickY - rect.top;

    const startX = cropStartRef.current.x;
    const startY = cropStartRef.current.y;
    const dragHandle = cropStartRef.current.dragHandle;
    const originalRect = cropStartRef.current.rect;

    let newRect = { x: 0, y: 0, w: 0, h: 0 };
    const straightenAngle = originalRect?.straightenAngle || 0;

    if (dragHandle === "new") {
      // Drawing a new crop rectangle
      const x = Math.min(startX, relativeX);
      const y = Math.min(startY, relativeY);
      const w = Math.abs(startX - relativeX);
      const h = Math.abs(startY - relativeY);
      newRect = { x, y, w, h };
    } else if (dragHandle === "move") {
      // Moving the entire crop rectangle
      const dx = relativeX - startX;
      const dy = relativeY - startY;
      newRect = {
        x: originalRect.x + dx,
        y: originalRect.y + dy,
        w: originalRect.w,
        h: originalRect.h,
      };
      // Clamp to canvas bounds
      newRect.x = Math.max(0, Math.min(rect.width - newRect.w, newRect.x));
      newRect.y = Math.max(0, Math.min(rect.height - newRect.h, newRect.y));
    } else if (originalRect) {
      // Resizing an existing crop rectangle
      let dx = relativeX - startX;
      let dy = relativeY - startY;

      let newX = originalRect.x;
      let newY = originalRect.y;
      let newW = originalRect.w;
      let newH = originalRect.h;

      // Apply dimension changes based on handle
      if (dragHandle.includes("l")) {
        newX = Math.min(originalRect.x + originalRect.w, originalRect.x + dx);
        newW = originalRect.x + originalRect.w - newX;
      } else if (dragHandle.includes("r")) {
        newW = Math.max(0, originalRect.w + dx);
      }

      if (dragHandle.includes("t")) {
        newY = Math.min(originalRect.y + originalRect.h, originalRect.y + dy);
        newH = originalRect.y + originalRect.h - newY;
      } else if (dragHandle.includes("b")) {
        newH = Math.max(0, originalRect.h + dy);
      }

      // Handle aspect ratio constraint
      if (cropConstrainProportions && cropAspectRatio) {
        const ratio = cropAspectRatio;
        // Simple corner constraint logic
        if (dragHandle.includes("l") || dragHandle.includes("r")) {
          // Adjust height based on new width
          const calculatedH = newW / ratio;

          if (dragHandle.includes("t")) {
            newY = originalRect.y + originalRect.h - calculatedH;
            newH = calculatedH;
          } else if (dragHandle.includes("b")) {
            newH = calculatedH;
          }
        } else if (dragHandle.includes("t") || dragHandle.includes("b")) {
          // Adjust width based on new height
          const calculatedW = newH * ratio;

          if (dragHandle.includes("l")) {
            newX = originalRect.x + originalRect.w - calculatedW;
            newW = calculatedW;
          } else if (dragHandle.includes("r")) {
            newW = calculatedW;
          }
        }

        // Re-clamp and center adjustments for center handles
        newW = Math.max(10, newW);
        newH = Math.max(10, newH);
        newX = Math.min(newX, originalRect.x + originalRect.w - newW);
        newY = Math.min(newY, originalRect.y + originalRect.h - newH);
      }

      newRect = {
        x: newX,
        y: newY,
        w: newW,
        h: newH,
      };
    }

    // Final sanity check for min size and bounds
    if (newRect.w < 10) newRect.w = 10;
    if (newRect.h < 10) newRect.h = 10;
    newRect.x = Math.max(0, Math.min(rect.width - newRect.w, newRect.x));
    newRect.y = Math.max(0, Math.min(rect.height - newRect.h, newRect.y));
    newRect.w = Math.min(rect.width - newRect.x, newRect.w);
    newRect.h = Math.min(rect.height - newRect.y, newRect.h);

    setCropRect({
      ...newRect,
      dragHandle: dragHandle,
      straightenAngle: straightenAngle,
    });
  };

  const handleCropEnd = () => {
    if (!isCropping || !cropStartRef.current) return;
    setCropRect((prev) => ({ ...prev, dragHandle: null }));
    cropStartRef.current = null;
  };

  const setStraightenAngle = (angle) => {
    setCropRect((prev) => ({
      ...prev,
      straightenAngle: angle,
    }));
  };

  const applyCrop = () => {
    if (!image || !cropRect) return;
    setIsProcessing(true);

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const canvasW = rect.width;
    const canvasH = rect.height;

    // Calculate image draw dimensions (must match drawCanvas when not transforming)
    const imgW = image.width;
    const imgH = image.height;
    const scaleFactor = Math.min(canvasW / imgW, canvasH / imgH) * 0.8;
    const drawW = imgW * scaleFactor;
    const drawH = imgH * scaleFactor;

    // The scale factor for converting screen pixels (cropRect) to image pixels
    const pixelScale = imgW / drawW;

    // Top-left corner of the scaled, centered image on the canvas (when isCropping=true)
    const imageCanvasX = canvasW / 2 - drawW / 2;
    const imageCanvasY = canvasH / 2 - drawH / 2;

    // Calculate the source crop area on the original image (in original pixels, pre-rotation)
    const sourceCropX = (cropRect.x - imageCanvasX) * pixelScale;
    const sourceCropY = (cropRect.y - imageCanvasY) * pixelScale;
    const sourceCropW = cropRect.w * pixelScale;
    const sourceCropH = cropRect.h * pixelScale;

    // Final crop output canvas setup
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = sourceCropW;
    finalCanvas.height = sourceCropH;
    const ctx = finalCanvas.getContext("2d");

    // Apply straightening (reverse rotation) and draw
    ctx.save();
    ctx.translate(finalCanvas.width / 2, finalCanvas.height / 2);
    ctx.rotate((cropRect.straightenAngle * Math.PI) / 180); // Apply rotation to source image before drawing

    // Draw the section of the image we want to keep, applying the inverse rotation
    ctx.drawImage(
      image,
      sourceCropX, // sx
      sourceCropY, // sy
      sourceCropW, // sw
      sourceCropH, // sh
      -sourceCropW / 2, // dx
      -sourceCropH / 2, // dy
      sourceCropW, // dw
      sourceCropH // dh
    );

    ctx.restore();

    const croppedImg = new window.Image();
    croppedImg.onload = () => {
      setImage(croppedImg);
      setImageData(finalCanvas.toDataURL());
      setIsCropping(false);
      setCropRect(null);
      // Reset transform state as the new image is the new un-transformed layer
      setTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
      setIsProcessing(false);
      setActiveSheet(null);
      showToast("Image cropped");
      saveHistory();
    };
    croppedImg.onerror = () => {
      setIsProcessing(false);
      showToast("Failed to apply crop");
    };
    croppedImg.src = finalCanvas.toDataURL();
  };

  /* -------------------------------------------------------------------------- */
  /* FILE HANDLING                               */
  /* -------------------------------------------------------------------------- */

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
            imageData: ev.target.result,
          };
          setHistory([initialState]);
          setHistoryIndex(0);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* CANVAS DRAWING (Fixed)                             */
  /* -------------------------------------------------------------------------- */

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

    // 1. Draw image with Transform (non-destructive) and Border Radius
    ctx.save();

    // Calculate image size to fit
    const imgW = image.width;
    const imgH = image.height;
    const scaleFactor = Math.min(w / imgW, h / imgH) * 0.8;
    const drawW = imgW * scaleFactor;
    const drawH = imgH * scaleFactor;

    // --- FIX: Suppress transform when cropping for visual alignment ---
    if (isCropping) {
      // When cropping, only center the image without user transform
      ctx.translate(w / 2, h / 2);
    } else {
      // Apply user transform (pan, rotate, scale)
      ctx.translate(w / 2 + transform.x, h / 2 + transform.y);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(transform.scale, transform.scale);
    }
    // ------------------------------------------------------------------

    // Apply border radius clip path
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
    ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);

    ctx.restore();

    // 2. Draw image layers (multi-layer support from not.jsx)
    imageLayers.forEach((layer) => {
      if (!layer.visible || !layer.image) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;

      const imgW = layer.image.width;
      const imgH = layer.image.height;
      const scaleFactor = Math.min(w / imgW, h / imgH) * 0.7;
      const drawW_layer = imgW * scaleFactor;
      const drawH_layer = imgH * scaleFactor;

      ctx.translate(w / 2 + layer.x, h / 2 + layer.y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.scale, layer.scale);

      // Apply border radius to layer if set
      if (layer.borderRadius > 0) {
        const maxRadius = Math.min(drawW_layer, drawH_layer) / 2;
        const r = Math.min(layer.borderRadius, maxRadius);

        ctx.beginPath();
        ctx.moveTo(-drawW_layer / 2 + r, -drawH_layer / 2);
        ctx.lineTo(drawW_layer / 2 - r, -drawH_layer / 2);
        ctx.quadraticCurveTo(
          drawW_layer / 2,
          -drawH_layer / 2,
          drawW_layer / 2,
          -drawH_layer / 2 + r
        );
        ctx.lineTo(drawW_layer / 2, drawH_layer / 2 - r);
        ctx.quadraticCurveTo(
          drawW_layer / 2,
          drawH_layer / 2,
          drawW_layer / 2 - r,
          drawH_layer / 2
        );
        ctx.lineTo(-drawW_layer / 2 + r, drawH_layer / 2);
        ctx.quadraticCurveTo(
          -drawW_layer / 2,
          drawH_layer / 2,
          -drawW_layer / 2,
          drawH_layer / 2 - r
        );
        ctx.lineTo(-drawW_layer / 2, -drawH_layer / 2 + r);
        ctx.quadraticCurveTo(
          -drawW_layer / 2,
          -drawH_layer / 2,
          -drawW_layer / 2 + r,
          -drawH_layer / 2
        );
        ctx.closePath();
        ctx.clip();
      }

      ctx.drawImage(
        layer.image,
        -drawW_layer / 2,
        -drawH_layer / 2,
        drawW_layer,
        drawH_layer
      );

      // Draw selection border if selected
      if (layer.id === selectedLayerId && !isCropping) {
        ctx.strokeStyle = "#667eea";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(
          -drawW_layer / 2,
          -drawH_layer / 2,
          drawW_layer,
          drawH_layer
        );
      }

      ctx.restore();
    });

    // 3. Draw text layers (untransformed, relative to canvas space)
    textLayers.forEach((layer) => {
      ctx.save();
      // Ensure font is readable/sensible
      ctx.font = `${layer.size}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      ctx.fillStyle = layer.color;
      ctx.textAlign = "center";
      ctx.fillText(layer.text, layer.x, layer.y);
      if (layer.id === editingText) {
        ctx.strokeStyle = "#667eea";
        ctx.lineWidth = 2;
        ctx.strokeText(layer.text, layer.x, layer.y);
      }
      ctx.restore();
    });

    // 4. Draw magnetic grid lines (only when not cropping)
    if (image && !isCropping) {
      // Snap threshold in px
      const snapThreshold = 8;
      // Show vertical center line if near center
      if (Math.abs(transform.x) < snapThreshold) {
        ctx.save();
        ctx.strokeStyle = "#ff00a6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(w / 2, 0);
        ctx.lineTo(w / 2, h);
        ctx.stroke();
        ctx.restore();
      }
      // Show horizontal center line if near center
      if (Math.abs(transform.y) < snapThreshold) {
        ctx.save();
        ctx.strokeStyle = "#ff00a6";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Draw crop rectangle overlay
    if (isCropping && cropRect) {
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([0]);
      ctx.lineJoin = "round";

      // Apply straighten angle rotation to the crop rectangle
      const cx = cropRect.x + cropRect.w / 2;
      const cy = cropRect.y + cropRect.h / 2;

      ctx.translate(cx, cy);
      ctx.rotate((cropRect.straightenAngle * Math.PI) / 180);
      ctx.translate(-cx, -cy);

      // Draw overlay shadow (everything outside the crop rect)
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = "destination-out";
      ctx.fillRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
      ctx.globalCompositeOperation = "source-over";

      // Draw crop border
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

      // Draw Rule of Thirds Grid
      if (showCropGrid) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 1;
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(cropRect.x + cropRect.w / 3, cropRect.y);
        ctx.lineTo(cropRect.x + cropRect.w / 3, cropRect.y + cropRect.h);
        ctx.moveTo(cropRect.x + (cropRect.w * 2) / 3, cropRect.y);
        ctx.lineTo(cropRect.x + (cropRect.w * 2) / 3, cropRect.y + cropRect.h);
        // Horizontal lines
        ctx.moveTo(cropRect.x, cropRect.y + cropRect.h / 3);
        ctx.lineTo(cropRect.x + cropRect.w, cropRect.y + cropRect.h / 3);
        ctx.moveTo(cropRect.x, cropRect.y + (cropRect.h * 2) / 3);
        ctx.lineTo(cropRect.x + cropRect.w, cropRect.y + (cropRect.h * 2) / 3);
        ctx.stroke();
      }

      // Draw handles
      const handleSize = 8;
      ctx.fillStyle = "#ffffff";
      ctx.setLineDash([0]);
      // Corners
      ctx.fillRect(
        cropRect.x - handleSize / 2,
        cropRect.y - handleSize / 2,
        handleSize,
        handleSize
      );
      ctx.fillRect(
        cropRect.x + cropRect.w - handleSize / 2,
        cropRect.y - handleSize / 2,
        handleSize,
        handleSize
      );
      ctx.fillRect(
        cropRect.x - handleSize / 2,
        cropRect.y + cropRect.h - handleSize / 2,
        handleSize,
        handleSize
      );
      ctx.fillRect(
        cropRect.x + cropRect.w - handleSize / 2,
        cropRect.y + cropRect.h - handleSize / 2,
        handleSize,
        handleSize
      );
      ctx.restore();
    }

    // 5. Draw generative fill mask overlay
    if (fillMaskCanvas) {
      ctx.save();
      ctx.globalAlpha = 0.6;

      // We must re-apply the image transformations *before* drawing the mask
      ctx.translate(w / 2 + transform.x, h / 2 + transform.y);
      ctx.rotate((transform.rotation * Math.PI) / 180);
      ctx.scale(transform.scale, transform.scale);

      // Draw mask with semi-transparent overlay
      // The mask is at original image resolution, so it must be drawn at drawW/drawH size
      ctx.drawImage(fillMaskCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }
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

  /* -------------------------------------------------------------------------- */
  /* POINTER/TOUCH EVENTS                           */
  /* -------------------------------------------------------------------------- */

  const handlePointerDown = (e) => {
    if (isCropping) return handleCropStart(e);
    if (activeSheet || !image || isGenerativeFillMode) return;
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
    if (isCropping) return handleCropMove(e);
    if (!gestureRef.current.isDragging || !image || isGenerativeFillMode)
      return;
    e.preventDefault();

    const x = e.clientX || e.touches?.[0]?.clientX;
    const y = e.clientY || e.touches?.[0]?.clientY;

    const dx = x - gestureRef.current.lastX;
    const dy = y - gestureRef.current.lastY;

    setTransform((prev) => {
      let newX = prev.x + dx;
      let newY = prev.y + dy;
      // Snap to center if near center (magnetic)
      const snapThreshold = 8;
      if (Math.abs(newX) < snapThreshold) newX = 0;
      if (Math.abs(newY) < snapThreshold) newY = 0;
      return { ...prev, x: newX, y: newY };
    });

    gestureRef.current.lastX = x;
    gestureRef.current.lastY = y;
  };

  const handlePointerUp = () => {
    if (isCropping) return handleCropEnd();
    if (gestureRef.current.isDragging) {
      gestureRef.current.isDragging = false;
      saveHistory();
    }
  };

  const handleTouchStart = (e) => {
    if (isCropping) return handleCropStart(e);
    if (isGenerativeFillMode) return;
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
    if (isCropping) return handleCropMove(e);
    if (isGenerativeFillMode) return;
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
    if (isCropping) return handleCropEnd(e);
    if (isGenerativeFillMode) return;
    if (e.touches.length === 0) {
      // Check if all touches are lifted
      handlePointerUp();
    }
  };

  const handleDoubleTap = () => {
    if (isCropping || isGenerativeFillMode) return;
    setTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    saveHistory();
  };

  /* -------------------------------------------------------------------------- */
  /* OTHER SHEET HANDLERS                           */
  /* -------------------------------------------------------------------------- */

  const addTextLayer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    const maxRadiusPercent = Math.min(drawW, drawH) / 200;

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

    // 4. Draw image layers (multi-layer support)
    imageLayers.forEach((layer) => {
      if (!layer.visible || !layer.image) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;

      const imgW = layer.image.width;
      const imgH = layer.image.height;
      const scaleFactor = Math.min(exportW / imgW, exportH / imgH) * 0.7;
      const drawW_layer = imgW * scaleFactor;
      const drawH_layer = imgH * scaleFactor;

      ctx.translate(exportW / 2 + layer.x, exportH / 2 + layer.y);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.scale, layer.scale);

      // Apply border radius if set
      if (layer.borderRadius > 0) {
        const maxRadius = Math.min(drawW_layer, drawH_layer) / 2;
        const r = Math.min(layer.borderRadius, maxRadius);

        ctx.beginPath();
        ctx.moveTo(-drawW_layer / 2 + r, -drawH_layer / 2);
        ctx.lineTo(drawW_layer / 2 - r, -drawH_layer / 2);
        ctx.quadraticCurveTo(
          drawW_layer / 2,
          -drawH_layer / 2,
          drawW_layer / 2,
          -drawH_layer / 2 + r
        );
        ctx.lineTo(drawW_layer / 2, drawH_layer / 2 - r);
        ctx.quadraticCurveTo(
          drawW_layer / 2,
          drawH_layer / 2,
          drawW_layer / 2 - r,
          drawH_layer / 2
        );
        ctx.lineTo(-drawW_layer / 2 + r, drawH_layer / 2);
        ctx.quadraticCurveTo(
          -drawW_layer / 2,
          drawH_layer / 2,
          -drawW_layer / 2,
          drawH_layer / 2 - r
        );
        ctx.lineTo(-drawW_layer / 2, -drawH_layer / 2 + r);
        ctx.quadraticCurveTo(
          -drawW_layer / 2,
          -drawH_layer / 2,
          -drawW_layer / 2 + r,
          -drawH_layer / 2
        );
        ctx.closePath();
        ctx.clip();
      }

      ctx.drawImage(
        layer.image,
        -drawW_layer / 2,
        -drawH_layer / 2,
        drawW_layer,
        drawH_layer
      );
      ctx.restore();
    });

    // 5. Draw Text Layers (omitted coordinate conversion for brevity, but would go here)

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

  /* -------------------------------------------------------------------------- */
  /* AI API HANDLERS (Confirmed saveHistory is called)     */
  /* -------------------------------------------------------------------------- */

  const handleAIGenerate = async (prompt) => {
    setIsProcessing(true);
    try {
      const result = await API.generateImage(prompt);

      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageData(result.url);
        setTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
        saveHistory(); // History saved
        setIsProcessing(false);
        setActiveSheet(null);
        // Provide clear feedback if mock mode was used
        showToast(
          result.isMock
            ? "Mock image generated (Check Gemini API key)"
            : "Image generated successfully"
        );
      };
      img.onerror = () => {
        console.error("Failed to load image:", result.url);
        showToast("Failed to load generated image");
        setIsProcessing(false);
      };
      img.src = result.url;
    } catch (err) {
      console.error("AI generation error:", err);
      showToast("AI generation failed");
      setIsProcessing(false);
    }
  };

  const handleAIEnhance = async () => {
    if (!imageData) return;
    setIsProcessing(true);
    try {
      const result = await API.enhanceImage(imageData);
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageData(result.url);
        saveHistory(); // History saved
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
      const result = await API.upscaleImage(imageData, scale);
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageData(result.url);
        saveHistory(); // History saved
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
        saveHistory(); // History saved
        setIsProcessing(false);
        setActiveSheet(null);
        showToast(
          result.isMock
            ? "Background removed (Mock mode - Check API key)"
            : "Background removed successfully"
        );
      };
      img.onerror = () => {
        console.error("Failed to load processed image");
        showToast("Failed to process image");
        setIsProcessing(false);
      };
      img.src = result.url;
    } catch (err) {
      console.error("Background removal error:", err);
      showToast("Background removal failed");
      setIsProcessing(false);
    }
  };

  const handleAIExpand = async () => {
    if (!imageData) {
      showToast("Please load an image first");
      return;
    }
    setIsProcessing(true);
    try {
      const result = await API.aiExpand(
        imageData,
        aiExpandFactor,
        aiExpandPrompt
      );
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setImage(img);
        setImageData(result.url);
        setTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
        saveHistory(); // History saved
        setIsProcessing(false);
        setActiveSheet(null);
        setIsAIExpandMode(false);
        showToast(
          result.isMock
            ? "Image expanded (Mock mode - Check API key)"
            : "Image expanded successfully"
        );
      };
      img.onerror = () => {
        console.error("Failed to load expanded image");
        showToast("Failed to expand image");
        setIsProcessing(false);
      };
      img.src = result.url;
    } catch (err) {
      console.error("AI expand error:", err);
      showToast("AI expand failed");
      setIsProcessing(false);
    }
  };

  const resetGenerativeFill = () => {
    setIsGenerativeFillMode(false);
    setGenerativeFillPrompt("");
    setFillMaskCanvas(null);
    fillCanvasRef.current = null;
    fillCtxRef.current = null;
  };

  const handleGenerativeFill = async () => {
    if (!imageData || !generativeFillPrompt.trim() || !fillMaskCanvas) {
      showToast("Please draw a selection and enter a prompt");
      return;
    }

    // Check if any drawing was actually made (i.e., mask isn't all black)
    const ctx = fillCtxRef.current;
    if (!ctx) {
      showToast("Mask context is missing.");
      return;
    }
    const imageDataCheck = ctx.getImageData(
      0,
      0,
      fillMaskCanvas.width,
      fillMaskCanvas.height
    );
    let hasDrawn = false;
    for (let i = 0; i < imageDataCheck.data.length; i += 4) {
      // Check if red channel (or any, since it's B&W) is white (255)
      if (imageDataCheck.data[i] > 0) {
        hasDrawn = true;
        break;
      }
    }

    if (!hasDrawn) {
      showToast("Please draw a mask selection on the image.");
      return;
    }

    setIsProcessing(true);
    try {
      const maskDataUrl = fillMaskCanvas.toDataURL("image/png");

      const result = await API.generativeFill(
        imageData,
        maskDataUrl,
        generativeFillPrompt
      );

      const img = new Image();
      img.onload = () => {
        setImage(img);
        setImageData(result.url);
        saveHistory(); // History saved
        setIsProcessing(false);
        resetGenerativeFill(); // Reset fill state
        setActiveSheet(null);
        showToast("Generative fill applied!");
      };
      img.src = result.url;
    } catch (err) {
      showToast("Generative fill failed: " + err.message);
      setIsProcessing(false);
      resetGenerativeFill();
    }
  };

  const startGenerativeFill = () => {
    if (!image) {
      showToast("Please load an image first");
      return;
    }

    setIsGenerativeFillMode(true);
    setActiveSheet(null);

    // Create a mask canvas at original image resolution
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = image.width;
    maskCanvas.height = image.height;
    const maskCtx = maskCanvas.getContext("2d");

    // Fill with black (black = don't fill, white = fill)
    maskCtx.fillStyle = "#000000";
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    setFillMaskCanvas(maskCanvas);
    fillCanvasRef.current = maskCanvas;
    fillCtxRef.current = maskCtx;
  };

  const onFillMouseDown = (e) => {
    if (!fillCtxRef.current || !image) return;
    setIsDrawingFillMask(true);

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    // Calculate image dimensions on canvas
    const imgW = image.width;
    const imgH = image.height;
    const scaleFactor = Math.min(w / imgW, h / imgH) * 0.8;

    // Center offset from the main canvas size
    const offsetX = w / 2;
    const offsetY = h / 2;

    // Get mouse position relative to canvas center
    const mouseX = (e.clientX || e.touches?.[0]?.clientX) - rect.left - offsetX;
    const mouseY = (e.clientY || e.touches?.[0]?.clientY) - rect.top - offsetY;

    // Convert to image coordinates
    // We must reverse the transformations applied in drawCanvas
    const sinR = Math.sin((transform.rotation * Math.PI) / 180);
    const cosR = Math.cos((transform.rotation * Math.PI) / 180);

    // 1. Reverse Pan
    const pannedX = mouseX - transform.x;
    const pannedY = mouseY - transform.y;

    // 2. Reverse Rotation
    const rotatedX = pannedX * cosR + pannedY * sinR;
    const rotatedY = pannedY * cosR - pannedX * sinR;

    // 3. Reverse Scale
    const scaledX = rotatedX / transform.scale;
    const scaledY = rotatedY / transform.scale;

    // 4. Reverse initial fit scale and center
    const imgX = scaledX / scaleFactor + imgW / 2;
    const imgY = scaledY / scaleFactor + imgH / 2;

    // Start drawing a line (dot)
    fillCtxRef.current.strokeStyle = "#FFFFFF";
    fillCtxRef.current.lineWidth = 50;
    fillCtxRef.current.lineCap = "round";
    fillCtxRef.current.lineJoin = "round";
    fillCtxRef.current.beginPath();
    fillCtxRef.current.moveTo(imgX, imgY);
    fillCtxRef.current.lineTo(imgX, imgY); // Draw a dot
    fillCtxRef.current.stroke();

    fillStartRef.current = { x: imgX, y: imgY };
    setFillMaskCanvas(fillCtxRef.current.canvas);
  };

  const onFillMouseMove = (e) => {
    if (!isDrawingFillMask || !fillCtxRef.current || !image) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    // Calculate image dimensions on canvas
    const imgW = image.width;
    const imgH = image.height;
    const scaleFactor = Math.min(w / imgW, h / imgH) * 0.8;

    // Center offset from the main canvas size
    const offsetX = w / 2;
    const offsetY = h / 2;

    // Get mouse position relative to canvas center
    const mouseX = (e.clientX || e.touches?.[0]?.clientX) - rect.left - offsetX;
    const mouseY = (e.clientY || e.touches?.[0]?.clientY) - rect.top - offsetY;

    // Convert to image coordinates (reverse transformations)
    const sinR = Math.sin((transform.rotation * Math.PI) / 180);
    const cosR = Math.cos((transform.rotation * Math.PI) / 180);

    const pannedX = mouseX - transform.x;
    const pannedY = mouseY - transform.y;

    const rotatedX = pannedX * cosR + pannedY * sinR;
    const rotatedY = pannedY * cosR - pannedX * sinR;

    const scaledX = rotatedX / transform.scale;
    const scaledY = rotatedY / transform.scale;

    const imgX = scaledX / scaleFactor + imgW / 2;
    const imgY = scaledY / scaleFactor + imgH / 2;

    // Draw on mask (white = fill area)
    fillCtxRef.current.strokeStyle = "#FFFFFF";
    fillCtxRef.current.lineWidth = 50;
    fillCtxRef.current.lineCap = "round";
    fillCtxRef.current.lineJoin = "round";
    fillCtxRef.current.beginPath();
    fillCtxRef.current.moveTo(fillStartRef.current.x, fillStartRef.current.y);
    fillCtxRef.current.lineTo(imgX, imgY);
    fillCtxRef.current.stroke();

    fillStartRef.current = { x: imgX, y: imgY };
    // Force a re-render to redraw the main canvas with the updated mask overlay
    setFillMaskCanvas(fillCtxRef.current.canvas);
  };

  const onFillMouseUp = () => {
    if (isDrawingFillMask) {
      setIsDrawingFillMask(false);

      // Critical change to make prompt appear and mask visible.
      if (fillMaskCanvas) {
        // 1. End drawing mode so canvas input switches back to pan/zoom if needed,
        // and the prompt input shows in the sheet.
        setIsGenerativeFillMode(false);
        // 2. Open the sheet to ask for the prompt.
        setActiveSheet("generativeFill");
      }
    }
  };

  const isTextSheet = activeSheet === "text";
  const currentTextLayer = textLayers.find((layer) => layer.id === editingText);

  /* -------------------------------------------------------------------------- */
  /* RENDER                                    */
  /* -------------------------------------------------------------------------- */

  return (
    <div className={`app ${isDarkMode ? "dark" : "light"}`}>
      <TopNav
        setImage={setImage}
        setTextLayers={setTextLayers}
        setHistory={setHistory}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />

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
          <>
            <canvas
              key={`${isDarkMode}-${image.src}`}
              ref={canvasRef}
              className="main-canvas"
              onPointerDown={
                isGenerativeFillMode ? onFillMouseDown : handlePointerDown
              }
              onPointerMove={
                isGenerativeFillMode ? onFillMouseMove : handlePointerMove
              }
              onPointerUp={
                isGenerativeFillMode ? onFillMouseUp : handlePointerUp
              }
              onTouchStart={
                isGenerativeFillMode ? onFillMouseDown : handleTouchStart
              }
              onTouchMove={
                isGenerativeFillMode ? onFillMouseMove : handleTouchMove
              }
              onTouchEnd={isGenerativeFillMode ? onFillMouseUp : handleTouchEnd}
              onDoubleClick={handleDoubleTap}
              style={{
                cursor: isGenerativeFillMode
                  ? "crosshair"
                  : isCropping
                  ? cropRect?.dragHandle === "move"
                    ? "move"
                    : cropRect?.dragHandle
                    ? "crosshair" // Simplified handle cursor
                    : "move"
                  : "grab",
              }}
            />
          </>
        )}
      </div>

      <BottomToolbar
        fileInputRef={fileInputRef}
        setActiveSheet={setActiveSheet}
        undo={undo}
        redo={redo}
        historyIndex={historyIndex}
        history={history}
        image={image}
        isCropping={isCropping}
        setIsCropping={setIsCropping}
        applyCrop={applyCrop}
        initializeCropMode={initializeCropMode}
        isProcessing={isProcessing}
        isAIExpandMode={isAIExpandMode}
        setIsAIExpandMode={setIsAIExpandMode}
      />

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
              <button
                className="secondary-btn"
                onClick={startGenerativeFill}
                disabled={!image}
              >
                Generative Fill
              </button>
              <button
                className="secondary-btn"
                onClick={handleRemoveBackground}
                disabled={!image}
              >
                Remove Background
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generative Fill Sheet */}
      {activeSheet === "generativeFill" && (
        <div
          className="sheet glass"
          onClick={(e) =>
            e.target.className.includes("sheet") && setActiveSheet("ai")
          }
        >
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>Generative Fill</h3>
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

            {/* 1. START DRAWING BUTTON */}
            {!fillMaskCanvas && (
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#888",
                  marginBottom: "1rem",
                }}
              >
                1. Click to Start Drawing, then draw on the image area.
              </p>
            )}

            {!isGenerativeFillMode && !fillMaskCanvas && (
              <button className="primary-btn" onClick={startGenerativeFill}>
                Start Drawing Selection
              </button>
            )}

            {/* 2. DRAWING ACTIVE INSTRUCTIONS */}
            {isGenerativeFillMode && (
              <>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "#00eaff",
                    fontWeight: "bold",
                    marginBottom: "1rem",
                  }}
                >
                  **Drawing Mode Active.** Draw a white mask on the canvas. Lift
                  mouse to proceed.
                </p>
                <button
                  className="secondary-btn"
                  onClick={() => {
                    resetGenerativeFill();
                    setActiveSheet("ai");
                  }}
                  style={{ marginTop: "0.5rem", width: "100%" }}
                >
                  Cancel Drawing
                </button>
              </>
            )}

            {/* 3. PROMPT INPUT (When mask is drawn and drawing mode is off) */}
            {fillMaskCanvas && !isGenerativeFillMode && (
              <>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "#ff00a6",
                    fontWeight: "bold",
                    marginBottom: "1rem",
                  }}
                >
                  **Mask Drawn.** Now, enter your prompt below and click Apply
                  Fill.
                </p>
                <input
                  type="text"
                  placeholder="Describe what to generate..."
                  value={generativeFillPrompt}
                  onChange={(e) => setGenerativeFillPrompt(e.target.value)}
                  className="text-input"
                  style={{
                    border: "1px solid #667eea",
                    marginBottom: "1rem",
                  }}
                />
                <button
                  className="primary-btn"
                  onClick={handleGenerativeFill}
                  disabled={isProcessing || !generativeFillPrompt.trim()}
                >
                  {isProcessing ? "Processing..." : "Apply Fill"}
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => {
                    resetGenerativeFill();
                  }}
                  style={{ marginTop: "0.5rem", width: "100%" }}
                >
                  Clear Mask and Cancel
                </button>
              </>
            )}
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

      {/* Transform Sheet */}
      {activeSheet === "transform" && (
        <div
          className="sheet glass"
          onClick={(e) =>
            e.target.className.includes("sheet") && setActiveSheet(null)
          }
        >
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>Transform Image</h3>
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

            <div className="slider-group">
              <label htmlFor="scale-slider">Scale</label>
              <div className="slider-wrapper">
                <input
                  id="scale-slider"
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={transform.scale}
                  onChange={(e) => {
                    setTransform({
                      ...transform,
                      scale: Number(e.target.value),
                    });
                  }}
                  onMouseUp={saveHistory}
                  onTouchEnd={saveHistory}
                  className="apple-slider"
                />
                <span className="slider-value">
                  {transform.scale.toFixed(1)}x
                </span>
              </div>
            </div>

            <div className="slider-group">
              <label htmlFor="rotation-slider">Rotation</label>
              <div className="slider-wrapper">
                <input
                  id="rotation-slider"
                  type="range"
                  min="0"
                  max="360"
                  value={transform.rotation}
                  onChange={(e) => {
                    setTransform({
                      ...transform,
                      rotation: Number(e.target.value),
                    });
                  }}
                  onMouseUp={saveHistory}
                  onTouchEnd={saveHistory}
                  className="apple-slider"
                />
                <span className="slider-value">{transform.rotation}°</span>
              </div>
            </div>

            <div className="slider-group">
              <label htmlFor="x-slider">Horizontal Position</label>
              <div className="slider-wrapper">
                <input
                  id="x-slider"
                  type="range"
                  min="-200"
                  max="200"
                  value={transform.x}
                  onChange={(e) => {
                    setTransform({
                      ...transform,
                      x: Number(e.target.value),
                    });
                  }}
                  onMouseUp={saveHistory}
                  onTouchEnd={saveHistory}
                  className="apple-slider"
                />
                <span className="slider-value">{transform.x}px</span>
              </div>
            </div>

            <div className="slider-group">
              <label htmlFor="y-slider">Vertical Position</label>
              <div className="slider-wrapper">
                <input
                  id="y-slider"
                  type="range"
                  min="-200"
                  max="200"
                  value={transform.y}
                  onChange={(e) => {
                    setTransform({
                      ...transform,
                      y: Number(e.target.value),
                    });
                  }}
                  onMouseUp={saveHistory}
                  onTouchEnd={saveHistory}
                  className="apple-slider"
                />
                <span className="slider-value">{transform.y}px</span>
              </div>
            </div>

            <button
              className="secondary-btn"
              onClick={() => {
                setTransform({
                  x: 0,
                  y: 0,
                  scale: 1,
                  rotation: 0,
                });
                saveHistory();
              }}
            >
              Reset Transform
            </button>
          </div>
        </div>
      )}

      {/* AI Expand Sheet */}
      {activeSheet === "aiExpand" && (
        <div
          className="sheet glass"
          onClick={(e) =>
            e.target.className.includes("sheet") && setActiveSheet(null)
          }
        >
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>AI Expand Image</h3>
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

            <p style={{ marginBottom: "1.5rem", fontSize: "0.9rem" }}>
              Expand your image with AI-generated content. The original image
              will be centered and the surrounding area will be filled with
              AI-generated content.
            </p>

            <div className="slider-group">
              <label htmlFor="expand-factor-slider">Expand Factor</label>
              <div className="slider-wrapper">
                <input
                  id="expand-factor-slider"
                  type="range"
                  min="1.1"
                  max="3"
                  step="0.1"
                  value={aiExpandFactor}
                  onChange={(e) => setAIExpandFactor(Number(e.target.value))}
                  className="apple-slider"
                />
                <span className="slider-value">
                  {aiExpandFactor.toFixed(1)}x
                </span>
              </div>
            </div>

            <div className="slider-group">
              <label htmlFor="expand-prompt-input">Prompt (Optional)</label>
              <input
                id="expand-prompt-input"
                type="text"
                placeholder="e.g., seamless extension, beautiful landscape"
                value={aiExpandPrompt}
                onChange={(e) => setAIExpandPrompt(e.target.value)}
                className="text-input"
                style={{
                  border: "1px solid #667eea",
                  marginBottom: "1rem",
                }}
              />
            </div>

            <button
              className="primary-btn"
              onClick={handleAIExpand}
              disabled={isProcessing}
              style={{ width: "100%" }}
            >
              {isProcessing ? "Expanding..." : "Expand Image"}
            </button>
            <button
              className="secondary-btn"
              onClick={() => setActiveSheet(null)}
              style={{ marginTop: "0.5rem", width: "100%" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Crop Options Sheet */}
      {activeSheet === "cropOptions" && (
        <div
          className="sheet glass"
          onClick={(e) =>
            e.target.className.includes("sheet") && setActiveSheet(null)
          }
        >
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>Crop Options</h3>
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

            {/* Straighten Slider */}
            <div className="slider-group">
              <label htmlFor="straighten-slider">Straighten</label>
              <div className="slider-wrapper">
                <input
                  id="straighten-slider"
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={cropRect?.straightenAngle || 0}
                  onChange={(e) => setStraightenAngle(Number(e.target.value))}
                  className="apple-slider"
                  onMouseUp={saveHistory}
                  onTouchEnd={saveHistory}
                />
                <span className="slider-value">
                  {cropRect?.straightenAngle.toFixed(1) || 0}°
                </span>
              </div>
            </div>

            {/* Aspect Ratio Presets */}
            <div className="aspect-ratio-presets">
              <button
                className={`secondary-btn ${
                  cropAspectRatio === null ? "active-tool-btn" : ""
                }`}
                onClick={() => {
                  setCropAspectRatio(null);
                  setCropConstrainProportions(false);
                }}
              >
                Free
              </button>
              <button
                className={`secondary-btn ${
                  cropAspectRatio === 1 ? "active-tool-btn" : ""
                }`}
                onClick={() => {
                  setCropAspectRatio(1);
                  setCropConstrainProportions(true);
                }}
              >
                1:1
              </button>
              <button
                className={`secondary-btn ${
                  cropAspectRatio === 16 / 9 ? "active-tool-btn" : ""
                }`}
                onClick={() => {
                  setCropAspectRatio(16 / 9);
                  setCropConstrainProportions(true);
                }}
              >
                16:9
              </button>
              <button
                className={`secondary-btn ${
                  cropAspectRatio === 4 / 3 ? "active-tool-btn" : ""
                }`}
                onClick={() => {
                  setCropAspectRatio(4 / 3);
                  setCropConstrainProportions(true);
                }}
              >
                4:3
              </button>
              <button
                className={`secondary-btn ${
                  cropAspectRatio === 3 / 2 ? "active-tool-btn" : ""
                }`}
                onClick={() => {
                  setCropAspectRatio(3 / 2);
                  setCropConstrainProportions(true);
                }}
              >
                3:2
              </button>
              <button
                className={`secondary-btn ${
                  cropAspectRatio === 9 / 16 ? "active-tool-btn" : ""
                }`}
                onClick={() => {
                  setCropAspectRatio(9 / 16);
                  setCropConstrainProportions(true);
                }}
              >
                9:16
              </button>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={showCropGrid}
                  onChange={(e) => setShowCropGrid(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <span>Show Rule of Thirds Grid</span>
              </label>
            </div>

            <button
              className="secondary-btn"
              onClick={() => setActiveSheet(null)}
              style={{ width: "100%" }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Processing Overlay (Spinner) */}
      {isProcessing && (
        <div className="processing-overlay">
          <div className="spinner"></div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && <div className="toast glass">{toast}</div>}
    </div>
  );
}
