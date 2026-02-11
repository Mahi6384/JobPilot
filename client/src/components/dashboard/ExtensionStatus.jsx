import React from "react";
import { Plug } from "lucide-react";

function ExtensionStatus() {
  const isConnected = false; 
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Plug className={`w-5 h-5 ${isConnected ? "text-green-400" : "text-red-400"}`} />
        <span className="text-white font-medium">Extension Status</span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"} animate-pulse`}></div>
        <span className={`text-sm ${isConnected ? "text-green-400" : "text-red-400"}`}>
          {isConnected ? "Connected" : "Not Connected"}
        </span>
      </div>
      {!isConnected && (
        <button className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
          Install Extension
        </button>
      )}
    </div>
  );
}

export default ExtensionStatus;