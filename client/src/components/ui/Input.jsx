import React, { forwardRef } from "react";

const Input = forwardRef(
  (
    {
      label,
      error,
      icon: Icon,
      className = "",
      containerClassName = "",
      ...props
    },
    ref,
  ) => {
    return (
      <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={props.id}
            className="text-sm font-medium text-gray-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          )}
          <input
            ref={ref}
            className={`
              w-full h-10 rounded-xl
              bg-white/5 border border-white/10
              text-white placeholder-gray-500
              text-sm
              transition-all duration-200
              hover:border-white/20
              focus:outline-none focus:border-brand-400/50 focus:ring-2 focus:ring-brand-400/20
              disabled:opacity-50 disabled:cursor-not-allowed
              ${Icon ? "pl-10 pr-4" : "px-4"}
              ${error ? "border-red-500/50 focus:border-red-400/50 focus:ring-red-400/20" : ""}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-400 animate-fade-in">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
export default Input;
