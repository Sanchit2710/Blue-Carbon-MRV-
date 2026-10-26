import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { signup } from "../actions";

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Create account</h1>
      <AuthForm action={signup} mode="signup" />
      <p className="mt-6 text-sm text-slate-600">Already registered? <Link href="/login" className="font-medium text-teal-800 underline">Log in</Link></p>
      <p className="mt-2 text-xs text-slate-500">Verifier/admin accounts are provisioned by platform operators, not self-service.</p>
    </>
  );
}
