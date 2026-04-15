import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

const variants = {
  primary:
    "bg-brand-500 hover:bg-brand-600 text-white shadow-glow hover:shadow-glow-lg active:scale-[0.97]",
  secondary:
    "bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 hover:border-white/20 active:scale-[0.97]",
  ghost:
    "bg-transparent hover:bg-white/5 text-gray-300 hover:text-white active:scale-[0.97]",
  danger:
    "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 active:scale-[0.97]",
  gradient:
    "bg-gradient-brand text-white shadow-glow hover:shadow-glow-lg hover:brightness-110 active:scale-[0.97]",
};

const sizes = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2.5 rounded-xl",
};

const Button = forwardRef(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      icon: Icon,
      iconRight: IconRight,
      children,
      className = "",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-medium
          transition-all duration-200 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          focus-ring select-none
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : Icon ? (
          <Icon className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
        ) : null}
        {children}
        {IconRight && !loading && (
          <IconRight className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
export default Button;
