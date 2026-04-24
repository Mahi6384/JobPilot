import React, { useState, useEffect, useCallback } from "react";
import { Plug, Download, CheckCircle, Loader } from "lucide-react";
import InstallGuideModal from "./InstallGuideModal";
import Button from "../ui/Button";
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

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const prompted = localStorage.getItem("extensionInstallPrompted") === "true";

    // New users (just finished onboarding) should see the download + unpacked tutorial once.
    if (!connected && user?.onboardingStatus === "completed" && !prompted) {
      setShowGuide(true);
      localStorage.setItem("extensionInstallPrompted", "true");
    }
  }, [connected]);

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

  const downloadExtension = () => {
    const link = document.createElement("a");
    // Cache-bust so users always get the newest ZIP (CDN/browser can otherwise reuse an old file).
    link.href = `/JobPilot-Extension.zip?v=${Date.now()}`;
    link.download = "JobPilot-Extension.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setHasDownloaded(true);
    localStorage.setItem("extensionDownloaded", "true");
  };

  if (connected) {
    const isProcessing = extStatus?.processing;

    return (
      <div className="glass rounded-2xl p-5 border-l-[3px] border-l-emerald-500">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-white font-medium text-sm">Extension Connected</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-emerald-400">
            {isProcessing ? "Processing queue..." : "Watching for jobs"}
          </span>
        </div>

        <div className="flex gap-2 mb-3">
          <Button
            onClick={downloadExtension}
            variant="ghost"
            size="sm"
            icon={Download}
            className="flex-1"
          >
            Re-download
          </Button>
          <Button
            onClick={() => setShowGuide(true)}
            variant="ghost"
            size="sm"
            className="flex-1"
          >
            Install steps
          </Button>
        </div>

        {isProcessing && extStatus?.currentJob && (
          <div className="text-xs text-brand-300 bg-brand-500/10 rounded-lg px-3 py-2 mb-2 border border-brand-500/20">
            Applying: {extStatus.currentJob.title}
          </div>
        )}

        {(extStatus?.processed > 0 ||
          extStatus?.failed > 0 ||
          extStatus?.skipped > 0) && (
          <div className="flex gap-3 text-xs mt-2">
            <span className="text-emerald-400">
              {extStatus.processed} applied
            </span>
            <span className="text-red-400">{extStatus.failed} failed</span>
            <span className="text-amber-400">
              {extStatus.skipped} skipped
            </span>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 mt-3">
            <Loader className="w-3 h-3 text-brand-400 animate-spin" />
            <span className="text-xs text-gray-400">
              {extStatus.queueSize} remaining in queue
            </span>
          </div>
        )}

        <InstallGuideModal
          isOpen={showGuide}
          onClose={() => setShowGuide(false)}
          onDownload={downloadExtension}
          downloadLabel="Re-download Extension"
        />
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5 border-l-[3px] border-l-amber-500">
      <div className="flex items-center gap-3 mb-3">
        <Plug className="w-5 h-5 text-amber-400" />
        <span className="text-white font-medium text-sm">Chrome Extension</span>
      </div>

      <p className="text-gray-400 text-xs mb-4">
        Install the extension to auto-apply to jobs
      </p>

      <Button
        onClick={() => {
          downloadExtension();
          setShowGuide(true);
        }}
        variant="primary"
        size="sm"
        icon={Download}
        className="w-full"
      >
        {hasDownloaded ? "Download Again" : "Download Extension"}
      </Button>

      <InstallGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onDownload={downloadExtension}
        downloadLabel={hasDownloaded ? "Download Again" : "Download Extension"}
      />
    </div>
  );
}

export default ExtensionStatus;
