import React, { forwardRef } from "react";

const Card = forwardRef(
  ({ glass = false, hover = false, glow = false, className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-2xl
          ${glass
            ? "glass"
            : "bg-white/[0.03] border border-white/[0.06]"
          }
          ${hover
            ? "transition-all duration-300 hover:bg-white/[0.05] hover:border-white/[0.1] hover:shadow-card-hover hover:-translate-y-0.5"
            : ""
          }
          ${glow ? "border-glow" : ""}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

function CardHeader({ className = "", children }) {
  return (
    <div className={`px-6 py-4 border-b border-white/[0.06] ${className}`}>
      {children}
    </div>
  );
}

function CardContent({ className = "", children }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

function CardFooter({ className = "", children }) {
  return (
    <div className={`px-6 py-4 border-t border-white/[0.06] ${className}`}>
      {children}
    </div>
  );
}

export { Card, CardHeader, CardContent, CardFooter };
export default Card;
