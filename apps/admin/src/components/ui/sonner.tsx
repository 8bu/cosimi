import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Admin toaster — same token-driven chrome as apps/web's copy. Per-app
 * primitives are deliberately duplicated (shadcn customization model);
 * tokens flow through `bg-background`/`text-foreground`/`border-border`
 * so dark mode lights up without any sonner-side config.
 *
 * Theme attribute (`[data-theme="dark"]`) lives on <html> and tokens
 * cascade down — no need to forward a `theme` prop here.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
