import React from "react";
import { Rocket, X } from "lucide-react";
import Button from "../ui/Button";

function ApplyBar({ selectedCount, onApply, onClear }) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
      <div className="glass-strong border-t border-white/[0.1] shadow-glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
              <span className="text-sm font-bold text-brand-400">{selectedCount}</span>
            </div>
            <span className="text-sm text-gray-300">
              job{selectedCount > 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" icon={X} onClick={onClear}>
              Clear
            </Button>
            <Button
              variant="gradient"
              size="md"
              icon={Rocket}
              onClick={onApply}
            >
              Apply to {selectedCount} Job{selectedCount > 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplyBar;
