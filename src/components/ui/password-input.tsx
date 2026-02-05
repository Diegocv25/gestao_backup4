import { useId, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type Props = Omit<React.ComponentProps<typeof Input>, "type"> & {
  labelShow?: string;
  labelHide?: string;
};

export function PasswordInput({ className, id, labelShow, labelHide, ...props }: Props) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const [visible, setVisible] = useState(false);

  const ariaLabel = useMemo(() => {
    return visible ? (labelHide ?? "Ocultar senha") : (labelShow ?? "Mostrar senha");
  }, [labelHide, labelShow, visible]);

  return (
    <div className="relative">
      <Input id={inputId} type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <button
        type="button"
        className={cn(
          "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1",
          "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
        aria-label={ariaLabel}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
