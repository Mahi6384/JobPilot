import React from "react";
import { Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import Button from "../components/ui/Button";

function NotFound() {
  return (
    <div className="min-h-screen bg-surface-primary flex items-center justify-center px-6">
      <div className="bg-mesh" />
      <div className="text-center max-w-md relative animate-fade-in-up">
        <div className="text-8xl font-bold text-gradient mb-4">404</div>
        <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/">
            <Button variant="primary" icon={Home}>
              Go to Dashboard
            </Button>
          </Link>
          <Button
            variant="secondary"
            icon={ArrowLeft}
            onClick={() => window.history.back()}
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
