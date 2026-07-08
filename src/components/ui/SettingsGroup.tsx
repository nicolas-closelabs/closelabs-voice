import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="space-y-2.5">
      {title && (
        <div className="px-1">
          <h2 className="font-heading text-[11px] font-semibold text-brand-text-muted uppercase tracking-wider">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-brand-text-secondary mt-1">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="bg-white border border-brand-border rounded-2xl overflow-visible shadow-[0_1px_2px_rgba(26,22,32,0.04)]">
        <div className="divide-y divide-brand-border">{children}</div>
      </div>
    </div>
  );
};
