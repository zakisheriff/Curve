import React from "react";

export default function BottomToolbar({
  fileInputRef,
  setActiveSheet,
  undo,
  redo,
  historyIndex,
  history,
  image,
}) {
  return (
    image && (
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
    )
  );
}
