import React from "react";

function Skeleton({ className = "", variant = "line" }) {
  const base = "skeleton";

  if (variant === "circle") {
    return <div className={`${base} rounded-full ${className}`} />;
  }

  if (variant === "card") {
    return <div className={`${base} rounded-2xl ${className}`} />;
  }

  return <div className={`${base} rounded-lg ${className}`} />;
}

function SkeletonCard({ className = "" }) {
  return (
    <div
      className={`rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 ${className}`}
    >
      <div className="flex items-start gap-4">
        <Skeleton variant="circle" className="w-10 h-10 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonStats({ count = 4, className = "" }) {
  return (
    <div className={`grid gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6"
        >
          <div className="flex items-center gap-4">
            <Skeleton variant="circle" className="w-12 h-12 flex-shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonStats };
export default Skeleton;
