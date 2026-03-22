import React from 'react';
import { Download, ToggleRight, FolderOpen, Chrome, X } from 'lucide-react';

export default function InstallGuideModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity">
      <div className="bg-gray-900 border border-gray-700/50 rounded-2xl p-6 w-[90%] max-w-lg shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Install JobPilot Extension</h2>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          We're currently in beta! Please follow these simple instructions to load the extension manually into Chrome.
        </p>

        <div className="space-y-4">
          <Step 
            number="1" 
            icon={<Download className="w-5 h-5 text-blue-400" />} 
            title="Extract the ZIP file" 
            desc="You just downloaded a ZIP file. Locate it and extract it to a folder." 
          />
          <Step 
            number="2" 
            icon={<Chrome className="w-5 h-5 text-blue-400" />} 
            title="Open Extensions Manager" 
            desc="Open a new tab and paste chrome://extensions/ in your address bar." 
          />
          <Step 
            number="3" 
            icon={<ToggleRight className="w-5 h-5 text-blue-400" />} 
            title="Enable Developer Mode" 
            desc="Look at the top-right corner and toggle 'Developer mode' on." 
          />
          <Step 
            number="4" 
            icon={<FolderOpen className="w-5 h-5 text-blue-400" />} 
            title="Load Unpacked" 
            desc="Click the 'Load unpacked' button at the top-left and select the extracted folder." 
          />
        </div>

        <button
          onClick={onClose}
          className="w-full mt-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
        >
          Got it, I'm ready!
        </button>
      </div>
    </div>
  );
}

function Step({ number, icon, title, desc }) {
  return (
    <div className="flex gap-4 items-start bg-gray-800/50 p-3 rounded-xl border border-gray-700/30 hover:bg-gray-800 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 border border-gray-700">
        {icon}
      </div>
      <div>
        <h4 className="text-gray-200 font-medium text-sm flex items-center gap-2">
          Step {number}: {title}
        </h4>
        <p className="text-gray-400 text-xs mt-1 leading-relaxed">
          {desc}
        </p>
      </div>
    </div>
  );
}
