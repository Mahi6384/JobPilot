import React, { useState } from "react";
import { Plug, Download } from "lucide-react";
import InstallGuideModal from "./InstallGuideModal";

function ExtensionStatus() {
  const isConnected = false;
  const [showGuide, setShowGuide] = useState(false);
  const [hasDownloaded, setHasDownloaded] = useState(() => {
    return localStorage.getItem("extensionDownloaded") === "true";
  });

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

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Plug
          className={`w-5 h-5 ${isConnected ? "text-green-400" : "text-red-400"}`}
        />
        <span className="text-white font-medium"> Download Extension </span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        {/* <div
          className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`}
        ></div> */}
        {/* <span
          className={`text-sm ${isConnected ? "text-green-400" : "text-red-400"}`}
        >
          {isConnected ? "Connected" : "Not Connected"}
        </span> */}
      </div>
      {!isConnected && (
        <>
          <button
            onClick={handleInstallClick}
            className={`w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex justify-center items-center gap-2 font-medium`}
          >
            <Download className="w-4 h-4" />
            {hasDownloaded ? "Download Again" : "Download Extension ZIP"}
          </button>

          <InstallGuideModal
            isOpen={showGuide}
            onClose={() => setShowGuide(false)}
          />
        </>
      )}
    </div>
  );
}

export default ExtensionStatus;
