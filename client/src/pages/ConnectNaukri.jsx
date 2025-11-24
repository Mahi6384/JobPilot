import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function ConnectNaukri() {
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [linkedInConnecting, setLinkedInConnecting] = useState(false);
  const [linkedInConnected, setLinkedInConnected] = useState(false);
  const [linkedInMonitoring, setLinkedInMonitoring] = useState(false);
  const [linkedInStatusMessage, setLinkedInStatusMessage] = useState("");
  const pollingIntervalRef = useRef(null);
  const linkedInPollingIntervalRef = useRef(null);

  useEffect(() => {
    checkConnectionStatus();
    checkLinkedInConnectionStatus();

    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (linkedInPollingIntervalRef.current) {
        clearInterval(linkedInPollingIntervalRef.current);
      }
    };
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        "http://localhost:5000/api/naukri/status",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setConnected(response.data.connected);

      // If monitoring, show status
      if (response.data.monitoring || response.data.captureStatus) {
        setMonitoring(true);
        setStatusMessage(response.data.message || "Monitoring login status...");
      } else {
        setMonitoring(false);
        setStatusMessage("");
      }
    } catch (error) {
      console.error("Error checking connection status:", error);
    }
  };

  const checkLinkedInConnectionStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        "http://localhost:5000/api/linkedin/status",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setLinkedInConnected(response.data.connected);

      // If monitoring, show status
      if (response.data.monitoring || response.data.captureStatus) {
        setLinkedInMonitoring(true);
        setLinkedInStatusMessage(
          response.data.message || "Monitoring login status..."
        );
      } else {
        setLinkedInMonitoring(false);
        setLinkedInStatusMessage("");
      }
    } catch (error) {
      console.error("Error checking LinkedIn connection status:", error);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setMonitoring(false);
    setStatusMessage("");

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:5000/api/naukri/connect",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMonitoring(true);
      setStatusMessage(
        "Browser opened. Please log in to Naukri. Your session will be captured automatically..."
      );

      // Start polling for status
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const token = localStorage.getItem("token");
          const response = await axios.get(
            "http://localhost:5000/api/naukri/status",
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.data.connected && !response.data.monitoring) {
            // Session captured successfully!
            setConnected(true);
            setMonitoring(false);
            setStatusMessage("Naukri account connected successfully!");

            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }

            // Refresh status check
            checkConnectionStatus();
          } else if (response.data.captureStatus) {
            // Update status message
            setStatusMessage(response.data.message || "Monitoring...");

            // Check for errors or timeout
            if (
              response.data.captureStatus === "error" ||
              response.data.captureStatus === "timeout" ||
              response.data.captureStatus === "failed"
            ) {
              setMonitoring(false);
              setConnecting(false);
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
              }
            }
          }
        } catch (error) {
          console.error("Error polling status:", error);
        }
      }, 3000); // Poll every 3 seconds
    } catch (error) {
      console.error("Error connecting:", error);
      alert("Failed to start connection. Please try again.");
      setConnecting(false);
      setMonitoring(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleLinkedInConnect = async () => {
    setLinkedInConnecting(true);
    setLinkedInMonitoring(false);
    setLinkedInStatusMessage("");

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:5000/api/linkedin/connect",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setLinkedInMonitoring(true);
      setLinkedInStatusMessage(
        "Browser opened. Please log in to LinkedIn. Your session will be captured automatically..."
      );

      // Start polling for status
      if (linkedInPollingIntervalRef.current) {
        clearInterval(linkedInPollingIntervalRef.current);
      }

      linkedInPollingIntervalRef.current = setInterval(async () => {
        try {
          const token = localStorage.getItem("token");
          const response = await axios.get(
            "http://localhost:5000/api/linkedin/status",
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.data.connected && !response.data.monitoring) {
            // Session captured successfully!
            setLinkedInConnected(true);
            setLinkedInMonitoring(false);
            setLinkedInStatusMessage(
              "LinkedIn account connected successfully!"
            );

            if (linkedInPollingIntervalRef.current) {
              clearInterval(linkedInPollingIntervalRef.current);
            }

            // Refresh status check
            checkLinkedInConnectionStatus();
          } else if (response.data.captureStatus) {
            // Update status message
            setLinkedInStatusMessage(response.data.message || "Monitoring...");

            // Check for errors or timeout
            if (
              response.data.captureStatus === "error" ||
              response.data.captureStatus === "timeout" ||
              response.data.captureStatus === "failed"
            ) {
              setLinkedInMonitoring(false);
              setLinkedInConnecting(false);
              if (linkedInPollingIntervalRef.current) {
                clearInterval(linkedInPollingIntervalRef.current);
              }
            }
          }
        } catch (error) {
          console.error("Error polling LinkedIn status:", error);
        }
      }, 3000); // Poll every 3 seconds
    } catch (error) {
      console.error("Error connecting LinkedIn:", error);
      alert("Failed to start LinkedIn connection. Please try again.");
      setLinkedInConnecting(false);
      setLinkedInMonitoring(false);
    } finally {
      setLinkedInConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white p-4">
      <div className="max-w-4xl w-full">
        <h1 className="text-3xl font-bold mb-8 text-center">
          Connect Your Job Platforms
        </h1>
        <p className="mb-8 text-gray-300 text-center">
          Connect your accounts to enable automated job applications. We'll open
          browser windows where you can log in securely. Your sessions will be
          captured automatically once you log in.
        </p>

        <div className="flex justify-center mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold"
          >
            Go to Dashboard
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Naukri Connection Card */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">Naukri</h2>
            <p className="mb-4 text-gray-300 text-sm">
              Connect your Naukri account to scrape and apply to jobs.
            </p>

            {connected && (
              <div className="mb-4 p-4 bg-green-900/30 rounded-lg border border-green-500">
                <p className="text-green-300 mb-2">✅ Naukri Connected</p>
                {statusMessage && (
                  <p className="text-xs text-green-300">{statusMessage}</p>
                )}
              </div>
            )}

            {monitoring && (
              <div className="mb-4 p-4 bg-blue-900/30 rounded-lg border border-blue-500">
                <p className="text-blue-300 mb-2 text-sm">
                  🔄 Monitoring Login Status...
                </p>
                <p className="text-xs text-gray-300">{statusMessage}</p>
                <div className="mt-2 flex justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                </div>
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={connecting || monitoring}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              {connecting
                ? "Opening Browser..."
                : monitoring
                  ? "Monitoring..."
                  : connected
                    ? "Reconnect Naukri"
                    : "Connect Naukri"}
            </button>
          </div>

          {/* LinkedIn Connection Card */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-2xl font-bold mb-4">LinkedIn</h2>
            <p className="mb-4 text-gray-300 text-sm">
              Connect your LinkedIn account to scrape Easy Apply jobs.
            </p>

            {linkedInConnected && (
              <div className="mb-4 p-4 bg-green-900/30 rounded-lg border border-green-500">
                <p className="text-green-300 mb-2">✅ LinkedIn Connected</p>
                {linkedInStatusMessage && (
                  <p className="text-xs text-green-300">
                    {linkedInStatusMessage}
                  </p>
                )}
              </div>
            )}

            {linkedInMonitoring && (
              <div className="mb-4 p-4 bg-blue-900/30 rounded-lg border border-blue-500">
                <p className="text-blue-300 mb-2 text-sm">
                  🔄 Monitoring Login Status...
                </p>
                <p className="text-xs text-gray-300">{linkedInStatusMessage}</p>
                <div className="mt-2 flex justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                </div>
              </div>
            )}

            <button
              onClick={handleLinkedInConnect}
              disabled={linkedInConnecting || linkedInMonitoring}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              {linkedInConnecting
                ? "Opening Browser..."
                : linkedInMonitoring
                  ? "Monitoring..."
                  : linkedInConnected
                    ? "Reconnect LinkedIn"
                    : "Connect LinkedIn"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConnectNaukri;
