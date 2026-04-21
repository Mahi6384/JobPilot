import React from "react";

function Placeholder({ title }) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
      <p className="text-sm text-gray-400">Coming soon.</p>
    </div>
  );
}

export default Placeholder;

