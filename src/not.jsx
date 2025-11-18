import React, { useState, useRef, useEffect } from "react";

// Mock API functions (replace with your actual API)
const API = {
  generateImage: async (prompt) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { url: `https://picsum.photos/800/600?random=${Date.now()}`, isMock: true };
  },
  enhanceImage: async (imageData) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { url: imageData };
  },
  upscaleImage: async (imageData, scale) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { url: imageData };
  },
  removeBackground: async (imageData) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { url: imageData, isMock: true };
  },
  generativeFill: async (imageData, maskData, prompt) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { url: imageData };
  }
};

export default function App() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Layer system - each layer can be an image or text
  const [layers, setLayers] = useState([]);
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
  
  // Crop state
  const [isCropping, setIsCropping] = useState(false);
  const [cropRect, setCropRect] = useState(null);
  const cropStartRef = useRef(null);
  
  // Canvas rendering
  useEffect(() => {
    if (canvasRef.current) {
      drawCanvas();
    }
  }, [layers, selectedLayerId, isDarkMode, isCropping, cropRect]);
  
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };
  
  // Layer management functions
  const createLayer = (type, data) => {
    const newLayer = {
      id: layerIdCounter,
      type, // 'image' or 'text'
      name: type === 'image' ? `Image ${layerIdCounter}` : `Text ${layerIdCounter}`,
      visible: true,
      opacity: 100,
      locked: false,
      ...data
    };
    
    setLayerIdCounter(prev => prev + 1);
    setLayers(prev => [...prev, newLayer]);
    setSelectedLayerId(newLayer.id);
    saveHistory();
    
    return newLayer.id;
  };
  
  const addImageLayer = (imageData, imageSrc) => {
    const img = new Image();
    img.onload = () => {
      createLayer('image', {
        imageData,
        image: img,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        borderRadius: 0
      });
    };
    img.src = imageSrc;
  };
  
  const addTextLayer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    createLayer('text', {
      text: "Double click to edit",
      x: canvas.offsetWidth / 2,
      y: canvas.offsetHeight / 2,
      size: 48,
      color: isDarkMode ? "#ffffff" : "#000000",
      fontFamily: "Arial"
    });
    
    setActiveSheet('textEdit');
  };
  
  const updateLayer = (id, updates) => {
    setLayers(prev => prev.map(layer => 
      layer.id === id ? { ...layer, ...updates } : layer
    ));
  };
  
  const deleteLayer = (id) => {
    setLayers(prev => prev.filter(layer => layer.id !== id));
    if (selectedLayerId === id) {
      setSelectedLayerId(layers.length > 1 ? layers[0].id : null);
    }
    saveHistory();
  };
  
  const duplicateLayer = (id) => {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    
    const newLayer = {
      ...layer,
      id: layerIdCounter,
      name: `${layer.name} copy`
    };
    
    setLayerIdCounter(prev => prev + 1);
    setLayers(prev => [...prev, newLayer]);
    saveHistory();
  };
  
  const moveLayer = (id, direction) => {
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index + 1 : index - 1;
    if (newIndex < 0 || newIndex >= layers.length) return;
    
    const newLayers = [...layers];
    [newLayers[index], newLayers[newIndex]] = [newLayers[newIndex], newLayers[index]];
    setLayers(newLayers);
    saveHistory();
  };
  
  // History management
  const saveHistory = () => {
    const state = {
      layers: JSON.parse(JSON.stringify(layers.map(l => {
        if (l.type === 'image') {
          return { ...l, image: null, imageData: l.imageData };
        }
        return l;
      }))),
      selectedLayerId
    };
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    if (newHistory.length > 50) newHistory.shift();
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  
  const restoreState = async (state) => {
    const restoredLayers = await Promise.all(state.layers.map(async (layer) => {
      if (layer.type === 'image' && layer.imageData) {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve({ ...layer, image: img });
          };
          img.src = layer.imageData;
        });
      }
      return layer;
    }));
    
    setLayers(restoredLayers);
    setSelectedLayerId(state.selectedLayerId);
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
  
  // File handling
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      addImageLayer(ev.target.result, ev.target.result);
      if (layers.length === 0) {
        // First image - initialize history
        setTimeout(() => {
          const initialState = {
            layers: [{ ...layers[0] }],
            selectedLayerId: layers[0]?.id
          };
          setHistory([initialState]);
          setHistoryIndex(0);
        }, 100);
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Canvas drawing
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, w, h);
    
    // Draw checkerboard background for transparency
    drawCheckerboard(ctx, w, h);
    
    // Draw layers from bottom to top
    layers.forEach((layer) => {
      if (!layer.visible) return;
      
      ctx.save();
      ctx.globalAlpha = layer.opacity / 100;
      
      if (layer.type === 'image' && layer.image) {
        drawImageLayer(ctx, layer, w, h);
      } else if (layer.type === 'text') {
        drawTextLayer(ctx, layer);
      }
      
      // Draw selection border if selected
      if (layer.id === selectedLayerId && !isCropping) {
        ctx.strokeStyle = "#667eea";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        if (layer.type === 'image' && layer.image) {
          const imgW = layer.image.width;
          const imgH = layer.image.height;
          const scaleFactor = Math.min(w / imgW, h / imgH) * 0.7;
          const drawW = imgW * scaleFactor * layer.scale;
          const drawH = imgH * scaleFactor * layer.scale;
          
          ctx.translate(w / 2 + layer.x, h / 2 + layer.y);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          ctx.strokeRect(-drawW / 2, -drawH / 2, drawW, drawH);
        }
      }
      
      ctx.restore();
    });
    
    // Draw crop overlay
    if (isCropping && cropRect) {
      drawCropOverlay(ctx, w, h);
    }
  };
  
  const drawCheckerboard = (ctx, w, h) => {
    const size = 20;
    ctx.fillStyle = isDarkMode ? "#2a2a2a" : "#e0e0e0";
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = isDarkMode ? "#1a1a1a" : "#f5f5f5";
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        if ((x / size + y / size) % 2 === 0) {
          ctx.fillRect(x, y, size, size);
        }
      }
    }
  };
  
  const drawImageLayer = (ctx, layer, w, h) => {
    const imgW = layer.image.width;
    const imgH = layer.image.height;
    const scaleFactor = Math.min(w / imgW, h / imgH) * 0.7;
    const drawW = imgW * scaleFactor;
    const drawH = imgH * scaleFactor;
    
    ctx.save();
    ctx.translate(w / 2 + layer.x, h / 2 + layer.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.scale, layer.scale);
    
    // Apply border radius if set
    if (layer.borderRadius > 0) {
      const maxRadius = Math.min(drawW, drawH) / 2;
      const r = Math.min(layer.borderRadius, maxRadius);
      
      ctx.beginPath();
      ctx.moveTo(-drawW / 2 + r, -drawH / 2);
      ctx.lineTo(drawW / 2 - r, -drawH / 2);
      ctx.quadraticCurveTo(drawW / 2, -drawH / 2, drawW / 2, -drawH / 2 + r);
      ctx.lineTo(drawW / 2, drawH / 2 - r);
      ctx.quadraticCurveTo(drawW / 2, drawH / 2, drawW / 2 - r, drawH / 2);
      ctx.lineTo(-drawW / 2 + r, drawH / 2);
      ctx.quadraticCurveTo(-drawW / 2, drawH / 2, -drawW / 2, drawH / 2 - r);
      ctx.lineTo(-drawW / 2, -drawH / 2 + r);
      ctx.quadraticCurveTo(-drawW / 2, -drawH / 2, -drawW / 2 + r, -drawH / 2);
      ctx.closePath();
      ctx.clip();
    }
    
    ctx.drawImage(layer.image, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  };
  
  const drawTextLayer = (ctx, layer) => {
    ctx.font = `${layer.size}px ${layer.fontFamily}`;
    ctx.fillStyle = layer.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(layer.text, layer.x, layer.y);
  };
  
  const drawCropOverlay = (ctx, w, h) => {
    if (!cropRect) return;
    
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, w, h);
    
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.globalCompositeOperation = "source-over";
    
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    
    // Draw handles
    const handleSize = 10;
    ctx.fillStyle = "#ffffff";
    const corners = [
      [cropRect.x, cropRect.y],
      [cropRect.x + cropRect.w, cropRect.y],
      [cropRect.x, cropRect.y + cropRect.h],
      [cropRect.x + cropRect.w, cropRect.y + cropRect.h]
    ];
    
    corners.forEach(([x, y]) => {
      ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize);
    });
    
    ctx.restore();
  };
  
  // Pointer events for layer manipulation
  const gestureRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startScale: 1,
    startRotation: 0
  });
  
  const handlePointerDown = (e) => {
    if (!selectedLayerId || isCropping) return;
    
    const layer = layers.find(l => l.id === selectedLayerId);
    if (!layer || layer.locked) return;
    
    gestureRef.current.isDragging = true;
    gestureRef.current.startX = e.clientX || e.touches?.[0]?.clientX;
    gestureRef.current.startY = e.clientY || e.touches?.[0]?.clientY;
    
    if (layer.type === 'image') {
      gestureRef.current.startLayerX = layer.x;
      gestureRef.current.startLayerY = layer.y;
    }
  };
  
  const handlePointerMove = (e) => {
    if (!gestureRef.current.isDragging || !selectedLayerId) return;
    
    const layer = layers.find(l => l.id === selectedLayerId);
    if (!layer || layer.locked) return;
    
    const x = e.clientX || e.touches?.[0]?.clientX;
    const y = e.clientY || e.touches?.[0]?.clientY;
    
    const dx = x - gestureRef.current.startX;
    const dy = y - gestureRef.current.startY;
    
    if (layer.type === 'image') {
      updateLayer(layer.id, {
        x: gestureRef.current.startLayerX + dx,
        y: gestureRef.current.startLayerY + dy
      });
    } else if (layer.type === 'text') {
      updateLayer(layer.id, {
        x: layer.x + dx,
        y: layer.y + dy
      });
      gestureRef.current.startX = x;
      gestureRef.current.startY = y;
    }
  };
  
  const handlePointerUp = () => {
    if (gestureRef.current.isDragging) {
      gestureRef.current.isDragging = false;
      saveHistory();
    }
  };
  
  // AI functions
  const handleAIGenerate = async (prompt) => {
    setIsProcessing(true);
    setProcessingMessage("Generating image with AI...");
    
    try {
      const result = await API.generateImage(prompt);
      addImageLayer(result.url, result.url);
      setActiveSheet(null);
      showToast("Image generated successfully");
    } catch (err) {
      showToast("AI generation failed");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleRemoveBackground = async () => {
    if (!selectedLayerId) return;
    
    const layer = layers.find(l => l.id === selectedLayerId);
    if (!layer || layer.type !== 'image') return;
    
    setIsProcessing(true);
    setProcessingMessage("Removing background...");
    
    try {
      const result = await API.removeBackground(layer.imageData);
      
      const img = new Image();
      img.onload = () => {
        updateLayer(layer.id, { image: img, imageData: result.url });
        saveHistory();
        showToast("Background removed");
      };
      img.src = result.url;
    } catch (err) {
      showToast("Background removal failed");
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Export function
  const exportImage = () => {
    setIsProcessing(true);
    setProcessingMessage("Exporting your masterpiece...");
    
    setTimeout(() => {
      const exportCanvas = document.createElement("canvas");
      const ctx = exportCanvas.getContext("2d");
      
      exportCanvas.width = 1920;
      exportCanvas.height = 1080;
      
      ctx.fillStyle = isDarkMode ? "#1a1a1a" : "#ffffff";
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      
      // Draw all visible layers
      layers.forEach((layer) => {
        if (!layer.visible) return;
        
        ctx.save();
        ctx.globalAlpha = layer.opacity / 100;
        
        if (layer.type === 'image' && layer.image) {
          const w = exportCanvas.width;
          const h = exportCanvas.height;
          const imgW = layer.image.width;
          const imgH = layer.image.height;
          const scaleFactor = Math.min(w / imgW, h / imgH) * 0.7;
          const drawW = imgW * scaleFactor;
          const drawH = imgH * scaleFactor;
          
          ctx.translate(w / 2 + layer.x, h / 2 + layer.y);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          ctx.scale(layer.scale, layer.scale);
          ctx.drawImage(layer.image, -drawW / 2, -drawH / 2, drawW, drawH);
        } else if (layer.type === 'text') {
          ctx.font = `${layer.size}px ${layer.fontFamily}`;
          ctx.fillStyle = layer.color;
          ctx.textAlign = "center";
          ctx.fillText(layer.text, layer.x, layer.y);
        }
        
        ctx.restore();
      });
      
      const dataURL = exportCanvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `curve-export-${Date.now()}.png`;
      link.href = dataURL;
      link.click();
      
      setIsProcessing(false);
      setActiveSheet(null);
      showToast("Image exported successfully");
    }, 1000);
  };
  
  const selectedLayer = layers.find(l => l.id === selectedLayerId);
  
  return (
    <div className={`app ${isDarkMode ? "dark" : "light"}`}>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body, html {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow: hidden;
        }
        
        .app {
          width: 100vw;
          height: 100vh;
          display: flex;
          flex-direction: column;
          transition: background-color 0.3s ease;
        }
        
        .app.light {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #333;
        }
        
        .app.dark {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #fff;
        }
        
        .top-nav {
          height: 60px;
          padding: 0 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .top-nav h1 {
          font-size: 24px;
          font-weight: 600;
          background: linear-gradient(135deg, #fff 0%, #e0e0e0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .top-nav-controls {
          display: flex;
          gap: 10px;
        }
        
        .main-container {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        
        .canvas-area {
          flex: 1;
          position: relative;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .main-canvas {
          max-width: 100%;
          max-height: 100%;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .layers-panel {
          width: 300px;
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.1);
          border-left: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        
        .layers-header {
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .layers-header h3 {
          font-size: 16px;
          font-weight: 600;
        }
        
        .layers-list {
          flex: 1;
          padding: 10px;
          overflow-y: auto;
        }
        
        .layer-item {
          padding: 12px;
          margin-bottom: 8px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .layer-item:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .layer-item.selected {
          border-color: #667eea;
          background: rgba(102, 126, 234, 0.2);
        }
        
        .layer-thumbnail {
          width: 40px;
          height: 40px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        
        .layer-info {
          flex: 1;
          min-width: 0;
        }
        
        .layer-name {
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .layer-details {
          font-size: 11px;
          opacity: 0.6;
          margin-top: 2px;
        }
        
        .layer-controls {
          display: flex;
          gap: 5px;
        }
        
        .icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        
        .icon-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: scale(1.05);
        }
        
        .icon-btn:active {
          transform: scale(0.95);
        }
        
        .icon-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        
        .primary-btn {
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        .primary-btn:active {
          transform: translateY(0);
        }
        
        .secondary-btn {
          padding: 10px 20px;
          border-radius: 8px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          background: transparent;
          color: inherit;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .secondary-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.5);
        }
        
        .bottom-toolbar {
          height: 80px;
          padding: 0 20px;
          backdrop-filter: blur(10px);
          background: rgba(255, 255, 255, 0.1);
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .sheet {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .sheet-content {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 30px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .dark .sheet-content {
          background: rgba(30, 30, 46, 0.95);
          color: #fff;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        
        .sheet-header h3 {
          font-size: 20px;
          font-weight: 600;
        }
        
        .slider-group {
          margin-bottom: 20px;
        }
        
        .slider-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          font-size: 14px;
        }
        
        .slider-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        input[type="range"] {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: rgba(102, 126, 234, 0.2);
          outline: none;
          -webkit-appearance: none;
        }
        
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .slider-value {
          min-width: 50px;
          text-align: right;
          font-weight: 600;
          color: #667eea;
        }
        
        input[type="text"], input[type="number"] {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 2px solid rgba(102, 126, 234, 0.3);
          background: rgba(255, 255, 255, 0.1);
          color: inherit;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
        }
        
        input[type="text"]:focus, input[type="number"]:focus {
          border-color: #667eea;
          background: rgba(255, 255, 255, 0.15);
        }
        
        .processing-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          animation: fadeIn 0.3s ease;
        }
        
        .spinner-container {
          position: relative;
          width: 120px;
          height: 120px;
        }
        
        .spinner {
          width: 100%;
          height: 100%;
          border: 4px solid rgba(102, 126, 234, 0.2);
          border-top-color: #667eea;
          border-right-color: #764ba2;
          border-radius: 50%;
          animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .spinner-glow {
          position: absolute;
          inset: -10px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(102, 126, 234, 0.3) 0%, transparent 70%);
          animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        
        .processing-text {
          margin-top: 30px;
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          text-align: center;
          animation: fadeInOut 2s ease-in-out infinite;
        }
        
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        
        .processing-subtext {
          margin-top: 10px;
          font-size: 14px;
          opacity: 0.7;
          color: #e0e0e0;
        }
        
        .toast {
          position: fixed;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          padding: 15px 25px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(10px);
          color: white;
          font-weight: 500;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          animation: toastIn 0.3s ease;
          z-index: 3000;
        }
        
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 40px;
          text-align: center;
        }
        
        .empty-icon {
          font-size: 64px;
          opacity: 0.3;
        }
        
        .empty-state p {
          font-size: 18px;
          opacity: 0.7;
        }
        
        .layer-actions {
          padding: 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          gap: 8px;
        }
        
        .layer-actions button {
          flex: 1;
          padding: 8px;
          border-radius: 6px;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: inherit;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .layer-actions button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        
        .button-group {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
        
        .button-group button {
          flex: 1;
        }
        
        @media (max-width: 768px) {
          .layers-panel {
            position: fixed;
            right: -300px;
            top: 60px;
            bottom: 80px;
            transition: right 0.3s ease;
            z-index: 100;
          }
          
          .layers-panel.open {
            right: 0;
          }
        }
      `}</style>
      
      {/* Top Navigation */}
      <div className="top-nav">
        <h1>✨ Curve Editor Pro</h1>
        <div className="top-nav-controls">
          <button 
            className="icon-btn" 
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo"
          >
            ↶
          </button>
          <button 
            className="icon-btn" 
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo"
          >
            ↷
          </button>
          <button 
            className="icon-btn" 
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
      
      {/* Main Container */}
      <div className="main-container">
        {/* Canvas Area */}
        <div className="canvas-area">
          {layers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎨</div>
              <p>Start by adding an image or generating one with AI</p>
              <button 
                className="primary-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Import Image
              </button>
              <button 
                className="secondary-btn"
                onClick={() => setActiveSheet('aiGenerate')}
              >
                Generate with AI
              </button>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="main-canvas"
              width={1200}
              height={800}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          )}
        </div>
        
        {/* Layers Panel */}
        <div className="layers-panel">
          <div className="layers-header">
            <h3>Layers</h3>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button 
                className="icon-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Add Image Layer"
              >
                🖼️
              </button>
              <button 
                className="icon-btn"
                onClick={addTextLayer}
                title="Add Text Layer"
              >
                T
              </button>
            </div>
          </div>
          
          <div className="layers-list">
            {layers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', opacity: 0.5 }}>
                <p>No layers yet</p>
              </div>
            ) : (
              [...layers].reverse().map((layer) => (
                <div
                  key={layer.id}
                  className={`layer-item ${layer.id === selectedLayerId ? 'selected' : ''}`}
                  onClick={() => setSelectedLayerId(layer.id)}
                >
                  <div className="layer-thumbnail">
                    {layer.type === 'image' ? '🖼️' : 'T'}
                  </div>
                  <div className="layer-info">
                    <div className="layer-name">{layer.name}</div>
                    <div className="layer-details">
                      {layer.type === 'image' ? 'Image Layer' : 'Text Layer'} • {layer.opacity}%
                    </div>
                  </div>
                  <div className="layer-controls">
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayer(layer.id, { visible: !layer.visible });
                      }}
                      title={layer.visible ? "Hide" : "Show"}
                    >
                      {layer.visible ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLayer(layer.id);
                      }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {selectedLayer && (
            <div style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <div className="slider-group">
                <label>Opacity</label>
                <div className="slider-wrapper">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedLayer.opacity}
                    onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
                  />
                  <span className="slider-value">{selectedLayer.opacity}%</span>
                </div>
              </div>
              
              {selectedLayer.type === 'image' && (
                <>
                  <div className="slider-group">
                    <label>Scale</label>
                    <div className="slider-wrapper">
                      <input
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.1"
                        value={selectedLayer.scale}
                        onChange={(e) => updateLayer(selectedLayer.id, { scale: Number(e.target.value) })}
                      />
                      <span className="slider-value">{selectedLayer.scale.toFixed(1)}x</span>
                    </div>
                  </div>
                  
                  <div className="slider-group">
                    <label>Rotation</label>
                    <div className="slider-wrapper">
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={selectedLayer.rotation}
                        onChange={(e) => updateLayer(selectedLayer.id, { rotation: Number(e.target.value) })}
                      />
                      <span className="slider-value">{selectedLayer.rotation}°</span>
                    </div>
                  </div>
                  
                  <div className="slider-group">
                    <label>Border Radius</label>
                    <div className="slider-wrapper">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedLayer.borderRadius}
                        onChange={(e) => updateLayer(selectedLayer.id, { borderRadius: Number(e.target.value) })}
                      />
                      <span className="slider-value">{selectedLayer.borderRadius}px</span>
                    </div>
                  </div>
                </>
              )}
              
              {selectedLayer.type === 'text' && (
                <>
                  <div className="slider-group">
                    <label>Text</label>
                    <input
                      type="text"
                      value={selectedLayer.text}
                      onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                    />
                  </div>
                  
                  <div className="slider-group">
                    <label>Size</label>
                    <div className="slider-wrapper">
                      <input
                        type="range"
                        min="10"
                        max="120"
                        value={selectedLayer.size}
                        onChange={(e) => updateLayer(selectedLayer.id, { size: Number(e.target.value) })}
                      />
                      <span className="slider-value">{selectedLayer.size}px</span>
                    </div>
                  </div>
                  
                  <div className="slider-group">
                    <label>Color</label>
                    <input
                      type="color"
                      value={selectedLayer.color}
                      onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                      style={{ width: '100%', height: '40px', cursor: 'pointer' }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          
          <div className="layer-actions">
            <button 
              onClick={() => selectedLayer && duplicateLayer(selectedLayer.id)}
              disabled={!selectedLayer}
            >
              Duplicate
            </button>
            <button 
              onClick={() => selectedLayer && moveLayer(selectedLayer.id, 'up')}
              disabled={!selectedLayer}
            >
              ↑
            </button>
            <button 
              onClick={() => selectedLayer && moveLayer(selectedLayer.id, 'down')}
              disabled={!selectedLayer}
            >
              ↓
            </button>
          </div>
        </div>
      </div>
      
      {/* Bottom Toolbar */}
      <div className="bottom-toolbar">
        <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Import">
          📁
        </button>
        <button className="icon-btn" onClick={() => setActiveSheet('aiGenerate')} title="AI Generate">
          ✨
        </button>
        <button 
          className="icon-btn" 
          onClick={handleRemoveBackground}
          disabled={!selectedLayer || selectedLayer.type !== 'image'}
          title="Remove Background"
        >
          🎭
        </button>
        <button className="icon-btn" onClick={addTextLayer} title="Add Text">
          T
        </button>
        <button 
          className="icon-btn" 
          onClick={exportImage}
          disabled={layers.length === 0}
          title="Export"
        >
          💾
        </button>
      </div>
      
      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        multiple
      />
      
      {/* AI Generate Sheet */}
      {activeSheet === 'aiGenerate' && (
        <div className="sheet" onClick={() => setActiveSheet(null)}>
          <div className="sheet-content" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <h3>Generate with AI</h3>
              <button className="icon-btn" onClick={() => setActiveSheet(null)}>✕</button>
            </div>
            <input
              type="text"
              placeholder="Describe your image..."
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.target.value) {
                  handleAIGenerate(e.target.value);
                }
              }}
              autoFocus
            />
            <p style={{ marginTop: '10px', fontSize: '12px', opacity: 0.7 }}>
              Press Enter to generate
            </p>
          </div>
        </div>
      )}
      
      {/* Processing Overlay */}
      {isProcessing && (
        <div className="processing-overlay">
          <div className="spinner-container">
            <div className="spinner-glow"></div>
            <div className="spinner"></div>
          </div>
          <div className="processing-text">{processingMessage}</div>
          <div className="processing-subtext">This may take a moment...</div>
        </div>
      )}
      
      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}