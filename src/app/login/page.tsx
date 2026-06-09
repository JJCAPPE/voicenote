import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Private workspace</p>
        <h1>VoiceNote</h1>
        <p>Sign in to record, organize, and search your notes.</p>
        <LoginForm />
      </section>
    </main>
  );
}
