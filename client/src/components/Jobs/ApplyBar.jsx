import React from "react";

function ApplyBar({ selectedCount, onApply, onClear }) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-800 p-4 z-40 animate-slide-up">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="text-white">
          <span className="font-semibold">{selectedCount}</span> job{selectedCount > 1 ? "s" : ""} selected
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClear}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Clear Selection
          </button>
          <button
            onClick={onApply}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-900/50"
          >
            🚀 Apply to {selectedCount} Selected Job{selectedCount > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApplyBar;