import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const styles: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary:
    "bg-surface-raised text-white/80 border border-surface-raised hover:bg-[#4a7a57] hover:text-white",
  danger: "bg-red-700 text-white hover:bg-red-800",
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
