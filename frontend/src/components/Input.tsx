interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export default function Input({ error, className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full px-3 py-2 text-sm rounded-lg outline-none transition-colors
          text-white placeholder:text-white/30
          focus:ring-2 focus:ring-primary/60 focus:border-transparent
          ${
            error
              ? "border border-red-500/50 bg-red-900/20"
              : "border border-surface-raised bg-surface-raised hover:border-primary/40"
          }
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}`}
      {...props}
    />
  );
}
