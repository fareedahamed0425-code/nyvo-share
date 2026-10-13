import React from "react";
import { motion } from "motion/react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: "indigo" | "cyan" | "emerald" | "amber" | "rose" | "none";
  hoverEffect?: boolean;
  id?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = "",
  glowColor = "indigo",
  hoverEffect = false,
  id,
}) => {
  const glowStyles = {
    indigo: "shadow-[0_8px_32px_0_rgba(99,102,241,0.15)] hover:shadow-[0_12px_40px_0_rgba(99,102,241,0.25)]",
    cyan: "shadow-[0_8px_32px_0_rgba(6,182,212,0.15)] hover:shadow-[0_12px_40px_0_rgba(6,182,212,0.25)]",
    emerald: "shadow-[0_8px_32px_0_rgba(16,185,129,0.15)] hover:shadow-[0_12px_40px_0_rgba(16,185,129,0.25)]",
    amber: "shadow-[0_8px_32px_0_rgba(245,158,11,0.15)] hover:shadow-[0_12px_40px_0_rgba(245,158,11,0.25)]",
    rose: "shadow-[0_8px_32px_0_rgba(244,63,94,0.15)] hover:shadow-[0_12px_40px_0_rgba(244,63,94,0.25)]",
    none: "shadow-lg",
  };

  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={hoverEffect ? { y: -3, scale: 1.005 } : undefined}
      className={`glass-panel relative overflow-hidden rounded-3xl text-slate-100 transition-all duration-300 ${
        glowColor !== "none" ? glowStyles[glowColor] : ""
      } ${className}`}
    >
      {/* Subtle top edge highlight reflection */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />
      {/* Subtle inner gradient shift */}
      <div className="absolute -inset-px bg-gradient-to-b from-white/5 to-transparent pointer-events-none rounded-2xl" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};
