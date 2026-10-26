import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { AuthSplit } from "@/components/site/AuthSplit";
import { photos } from "@/lib/photos";
import { login } from "../actions";

export default function LoginPage() {
  return (
    <AuthSplit photo={photos.login} caption="Every decision on BlueCarbon names the reviewer and the reason.">
      <h1 className="text-4xl font-semibold text-mangrove">Welcome back</h1>
      <p className="mt-2 mb-8 text-muted-foreground">Log in to your projects, reviews or portfolio.</p>
      <AuthForm action={login} mode="login" />
      <p className="mt-8 text-muted-foreground">New to BlueCarbon? <Link href="/signup" className="font-medium text-mangrove underline underline-offset-4">Create an account</Link></p>
    </AuthSplit>
  );
}
