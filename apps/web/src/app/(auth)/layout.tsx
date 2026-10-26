export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">{children}</main>;
}
