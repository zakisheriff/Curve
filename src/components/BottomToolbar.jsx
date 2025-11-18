import React from "react";

export default function BottomToolbar({
  fileInputRef,
  setActiveSheet,
  undo,
  redo,
  historyIndex,
  history,
  image,
  isCropping,
  setIsCropping,
  applyCrop,
  isProcessing,
  initializeCropMode,
  isAIExpandMode,
  setIsAIExpandMode,
}) {
  return (
    image && (
      <div className="bottom-toolbar glass">
        {/* Import Button */}
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
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </button>

        {/* Border Radius Button - UPDATED */}
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

        {/* Add Text Button */}
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
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="4 7 4 4 20 4 20 7"></polyline>
            <line x1="9" y1="20" x2="15" y2="20"></line>
            <line x1="12" y1="4" x2="12" y2="20"></line>
          </svg>
        </button>

        {/* AI Tools Button */}
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
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2c-.5 0-1 .5-1 1v2c0 .5.5 1 1 1s1-.5 1-1V3c0-.5-.5-1-1-1zm0 18c-.5 0-1 .5-1 1v2c0 .5.5 1 1 1s1-.5 1-1v-2c0-.5-.5-1-1-1zM20 12c0-.5.5-1 1-1h2c.5 0 1 .5 1 1s-.5 1-1 1h-2c-.5 0-1-.5-1-1zM2 12c0-.5.5-1 1-1h2c.5 0 1 .5 1 1s-.5 1-1 1H3c-.5 0-1-.5-1-1z"></path>
            <circle cx="12" cy="12" r="6"></circle>
            <path d="M9 12h.01M15 12h.01M12 15h.01"></path>
          </svg>
        </button>

        
        {/* Crop Button (Toggle) - FIX APPLIED HERE */}
        <button
          className={`tool-btn ${isCropping ? "active-tool-btn" : ""}`}
          onClick={() => {
            setIsCropping(!isCropping);
            if (!isCropping) {
              setTimeout(() => initializeCropMode?.(), 0);
            }
          }}
          title={isCropping ? "Cancel Crop" : "Crop Image"}
        >
          <svg
            className="icon-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path>
            <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path>
          </svg>
        </button>

        {/* Apply Crop Button */}
        {isCropping && (
          <>
            <button
              className="tool-btn"
              onClick={() => setActiveSheet("cropOptions")}
              title="Crop Options"
            >
              <svg
                className="icon-svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="1"></circle>
                <path d="M12 1v6m0 6v6"></path>
                <path d="M4.22 4.22l4.24 4.24m5.08 0l4.24-4.24"></path>
                <path d="M1 12h6m6 0h6"></path>
                <path d="M4.22 19.78l4.24-4.24m5.08 0l4.24 4.24"></path>
              </svg>
            </button>
            <button
              className="tool-btn primary-btn"
              onClick={applyCrop}
              title="Apply Crop"
            >
              <svg
                className="icon-svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>
          </>
        )}

        {/* AI Expand Button */}
        <button
          className={`tool-btn ${isAIExpandMode ? "active-tool-btn" : ""}`}
          onClick={() => setActiveSheet("aiExpand")}
          title="AI Expand Image"
          disabled={isProcessing}
        >
          <svg
            className="icon-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
        </button>

        {/* Transform Image Button */}
        <button
          className="tool-btn"
          onClick={() => setActiveSheet("transform")}
          title="Transform Image"
        >
          <svg
            className="icon-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3H19M2 7.08v-3h3M22 7.08v-3H19M2 16.92v3h3"></path>
            <polygon points="17 4 17 4 11 10 7 6 7 6 13 18 17 18 20 18 20 18 17 4"></polygon>
          </svg>
        </button>

        <div className="separator"></div>

        {/* Undo Button - UPDATED */}
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

        {/* Export Button */}
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
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </button>
      </div>
    )
  );
}
