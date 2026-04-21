import React from "react";
import { Download, ToggleRight, FolderOpen, Chrome } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

export default function InstallGuideModal({
  isOpen,
  onClose,
  onDownload,
  downloadLabel = "Download Extension",
}) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Install JobPilot Extension"
      size="lg"
    >
      <p className="text-gray-400 text-sm mb-6 leading-relaxed">
        We're currently in beta! Follow these steps to load the extension
        manually into Chrome.
      </p>

      <div className="mb-5">
        {/* <Button
          onClick={onDownload}
          variant="primary"
          className="w-full"
          icon={Download}
        >
          {downloadLabel}
        </Button> */}
        <p className="text-xs text-gray-500 mt-2 text-center">
          After downloading, extract the ZIP and load it into Chrome.
        </p>
      </div>

      <div className="space-y-3">
        <Step
          number="1"
          icon={<Download className="w-4 h-4 text-brand-400" />}
          title="Extract the ZIP file"
          desc="Locate the downloaded ZIP file and extract it to a folder."
        />
        <Step
          number="2"
          icon={<Chrome className="w-4 h-4 text-brand-400" />}
          title="Open Extensions Manager"
          desc="Open a new tab and paste chrome://extensions/ in the address bar."
        />
        <Step
          number="3"
          icon={<ToggleRight className="w-4 h-4 text-brand-400" />}
          title="Enable Developer Mode"
          desc="Toggle 'Developer mode' on at the top-right corner."
        />
        <Step
          number="4"
          icon={<FolderOpen className="w-4 h-4 text-brand-400" />}
          title="Load Unpacked"
          desc="Click 'Load unpacked' and select the extracted folder."
        />
      </div>

      <div className="mt-6">
        <Button onClick={onClose} variant="primary" className="w-full">
          Got it, I'm ready!
        </Button>
      </div>
    </Modal>
  );
}

function Step({ number, icon, title, desc }) {
  return (
    <div className="w-full flex gap-3 items-start p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
      <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white">
          Step {number}: {title}
        </h4>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed break-words">
          {desc}
        </p>
      </div>
    </div>
  );
}
