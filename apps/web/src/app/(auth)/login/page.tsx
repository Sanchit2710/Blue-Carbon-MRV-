import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { login } from "../actions";

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Log in</h1>
      <AuthForm action={login} mode="login" />
      <p className="mt-6 text-sm text-slate-600">No account? <Link href="/signup" className="font-medium text-teal-800 underline">Sign up</Link></p>
    </>
  );
}
