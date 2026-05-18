type AlertProps = {
  type: "success" | "error" | "info" | "warning";
  message: string;
};

export function Alert({ type, message }: AlertProps) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return (
    <div className={`rounded-md border px-4 py-3 text-sm font-medium ${styles[type]}`}>
      {message}
    </div>
  );
}
