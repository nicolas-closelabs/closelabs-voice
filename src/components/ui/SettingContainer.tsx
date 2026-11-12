import React, { useEffect, useRef, useState } from "react";
import { Tooltip } from "./Tooltip";

interface SettingContainerProps {
  title: string;
  description: string;
  children: React.ReactNode;
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  layout?: "horizontal" | "stacked";
  disabled?: boolean;
  tooltipPosition?: "top" | "bottom";
}

export const SettingContainer: React.FC<SettingContainerProps> = ({
  title,
  description,
  children,
  descriptionMode = "tooltip",
  grouped = false,
  layout = "horizontal",
  disabled = false,
  tooltipPosition = "top",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showTooltip]);

  const toggleTooltip = () => {
    setShowTooltip(!showTooltip);
  };

  const containerClasses = grouped
    ? "px-4 p-2"
    : "px-4 p-2 rounded-lg border border-mid-gray/20";

  if (layout === "stacked") {
    if (descriptionMode === "tooltip") {
      return (
        <div className={containerClasses}>
          <div className="flex items-center gap-2 mb-2">
            <h3
              className={`text-sm font-medium ${disabled ? "opacity-50" : ""}`}
            >
              {title}
            </h3>
            <div
              ref={tooltipRef}
              className="relative"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={toggleTooltip}
            >
              <svg
                className="w-4 h-4 text-mid-gray cursor-help hover:text-logo-primary transition-colors duration-200 select-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-label="Más información"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleTooltip();
                  }
                }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {showTooltip && (
                <Tooltip targetRef={tooltipRef} position="top">
                  <p className="text-sm text-center leading-relaxed">
                    {description}
                  </p>
                </Tooltip>
              )}
            </div>
          </div>
          <div className="w-full">{children}</div>
        </div>
      );
    }

    return (
      <div className={containerClasses}>
        <div className="mb-2">
          <h3 className={`text-sm font-medium ${disabled ? "opacity-50" : ""}`}>
            {title}
          </h3>
          <p className={`text-sm ${disabled ? "opacity-50" : ""}`}>
            {description}
          </p>
        </div>
        <div className="w-full">{children}</div>
      </div>
    );
  }

  // Horizontal layout (default). «Tinta y voz»: la explicación va SIEMPRE debajo del nombre, a la
  // vista (antes, en un ícono "i" con un globo: un médico no la encontraba). Renglón de 66 de alto
  // mínimo, nombre 17/600 y frase 15 en `tinta-2`; el control pegado a la derecha.
  void descriptionMode;
  void tooltipRef;
  void showTooltip;
  void toggleTooltip;
  void tooltipPosition;
  return (
    <div
      className={`flex items-center justify-between gap-6 min-h-[66px] py-2 ${
        grouped ? "" : "border-b border-linea"
      }`}
    >
      <div className={`min-w-0 ${disabled ? "opacity-50" : ""}`}>
        <h3 className="font-sans text-[17px] leading-6 font-semibold text-tinta">
          {title}
        </h3>
        {description && (
          <p className="text-[15px] leading-[22px] text-tinta-2">{description}</p>
        )}
      </div>
      <div className="relative shrink-0 flex items-center gap-3.5">{children}</div>
    </div>
  );
};
