import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import { PortfShell } from "@/components/PortfShell";
import { ChatShell } from "@/components/ChatShell";

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Caveat:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&family=Silkscreen:wght@400;700&family=Press+Start+2P&display=swap";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: "8BU | Long NGUYỄN - Senior Web Developer" },
    ],
    links: [
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/favicon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: GOOGLE_FONTS_HREF },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFoundComponent,
});

function RootDocument() {
  return (
    <html lang="en" data-theme="press">
      <head>
        <HeadContent />
      </head>
      <body>
        <PortfShell>
          <ChatShell>
            <Outlet />
          </ChatShell>
        </PortfShell>
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundComponent() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Lost?</h1>
      <p>That page doesn't exist.</p>
      <Link to="/">Back to home</Link>
    </div>
  );
}
