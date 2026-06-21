import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "warning";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-primary text-white border border-white/20 hover:bg-primary-dark hover:border-white/30",
  secondary:
    "bg-surface-raised text-white/80 border border-surface-raised hover:bg-[#4a7a57] hover:text-white",
  danger: "bg-red-700 text-white border border-red-600/40 hover:bg-red-800",
  warning:
    "bg-amber-400/10 text-amber-300 border border-amber-400/30 hover:bg-amber-400/20 hover:border-amber-400/60 hover:text-amber-200",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          ${styles[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="animate-spin h-4 w-4" />}
      {children}
    </button>
  );
}
