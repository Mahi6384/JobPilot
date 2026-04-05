import React, { useState, useEffect, useCallback } from "react";
import { Plug, Download, CheckCircle, Loader } from "lucide-react";
import InstallGuideModal from "./InstallGuideModal";
import {
  isExtensionConnected,
  onConnectionChange,
  getExtensionStatus,
} from "../../utils/extensionBridge";

function ExtensionStatus() {
  const [connected, setConnected] = useState(isExtensionConnected());
  const [extStatus, setExtStatus] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(() => {
    return localStorage.getItem("extensionDownloaded") === "true";
  });

  useEffect(() => {
    const unsub = onConnectionChange((isConn) => setConnected(isConn));
    return unsub;
  }, []);

  const pollStatus = useCallback(async () => {
    if (!connected) return;
    const status = await getExtensionStatus();
    if (status) setExtStatus(status);
  }, [connected]);

  useEffect(() => {
    if (!connected) return;
    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [connected, pollStatus]);

  const handleInstallClick = () => {
    const link = document.createElement("a");
    link.href = "/JobPilot-Extension.zip";
    link.download = "JobPilot-Extension.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowGuide(true);
    setHasDownloaded(true);
    localStorage.setItem("extensionDownloaded", "true");
  };

  if (connected) {
    const isProcessing = extStatus?.processing;

    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-white font-medium">Extension Connected</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-green-400">
            {isProcessing ? "Processing queue..." : "Watching for jobs"}
          </span>
        </div>

        {isProcessing && extStatus?.currentJob && (
          <div className="text-xs text-blue-300 bg-blue-900/30 rounded-lg px-3 py-2 mb-2">
            Applying: {extStatus.currentJob.title}
          </div>
        )}

        {(extStatus?.processed > 0 ||
          extStatus?.failed > 0 ||
          extStatus?.skipped > 0) && (
          <div className="flex gap-3 text-xs mt-2">
            <span className="text-green-400">
              {extStatus.processed} applied
            </span>
            <span className="text-red-400">{extStatus.failed} failed</span>
            <span className="text-yellow-400">
              {extStatus.skipped} skipped
            </span>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 mt-3">
            <Loader className="w-3 h-3 text-blue-400 animate-spin" />
            <span className="text-xs text-gray-400">
              {extStatus.queueSize} remaining in queue
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Plug className="w-5 h-5 text-red-400" />
        <span className="text-white font-medium">Get the JobPilot Extension</span>
      </div>

      <p className="text-gray-400 text-sm mb-3">
        Install the extension to auto-apply to jobs
      </p>

      <button
        onClick={handleInstallClick}
        className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex justify-center items-center gap-2 font-medium"
      >
        <Download className="w-4 h-4" />
        {hasDownloaded ? "Download Again" : "Download JobPilot Extension"}
      </button>

      <InstallGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </div>
  );
}

export default ExtensionStatus;
