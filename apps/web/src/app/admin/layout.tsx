// Auth-gated area: renders per request (session read), so skip the instant-navigation shell check.
export const instant = false;

export default function Layout({ children }: LayoutProps<"/admin">) {
  return children;
}
