import { ReactNode } from "react";

interface GlassPanelProps {
    children: ReactNode;
    className?: string;
    variant?: "default" | "strong";
}

/**
 * GlassPanel — reusable glassmorphism container.
 * The base building-block for every layout section in OCMS.
 */
export default function GlassPanel({
    children,
    className = "",
    variant = "default",
}: GlassPanelProps) {
    const base = variant === "strong" ? "glass-strong" : "glass";

    return (
        <div className={`${base} rounded-lg ${className}`}>
            {children}
        </div>
    );
}
