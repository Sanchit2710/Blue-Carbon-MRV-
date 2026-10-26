import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthSplit } from "@/components/site/AuthSplit";
import { photos } from "@/lib/photos";
import { signup } from "../actions";

export default function SignupPage() {
  return (
    <AuthSplit photo={photos.signup} caption="Register once, then send evidence straight from the riverbank.">
      <h1 className="text-4xl font-semibold text-mangrove">Create your account</h1>
      <p className="mt-2 mb-8 text-muted-foreground">Takes about a minute. You can add your organisation next.</p>
      <AuthForm action={signup} mode="signup" />
      <p className="mt-8 text-muted-foreground">Already registered? <Link href="/login" className="font-medium text-mangrove underline underline-offset-4">Log in</Link></p>
      <p className="mt-3 text-sm text-muted-foreground">Verifier accounts are set up by the platform team.</p>
    </AuthSplit>
  );
}
