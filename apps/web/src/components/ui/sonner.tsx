import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Editorial toaster — terracotta-tinted, no system theme switching here
 * (theme tokens already drive light/dark via prefers-color-scheme; if a
 * manual toggle lands in Phase 15, the `theme` prop here can read from
 * the app store).
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
