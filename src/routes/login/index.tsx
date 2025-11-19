import { createFileRoute, useRouter } from "@tanstack/react-router";
import LoginForm from "@/components/auth/login-form";
import type { LoginSubmission, RegisterSubmission } from "@/schemas/auth/login";
import { loginFn, registerFn } from "@/actions/auth-submit";
import { useState } from "react";
import { useAuth } from "@/contexts/auth";

export const Route = createFileRoute("/login/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { refetch } = useAuth();

  const handleLogin = async (loginData: LoginSubmission) => {
    try {
      setError(null);
      const result = await loginFn({ data: loginData });

      // If we get a result, check if it's an error
      if (result && "error" in result && result.error) {
        setError(result.error);
      } else if (result && "success" in result && result.success) {
        // Success - refetch user data and navigate
        await refetch();
        router.navigate({ to: "/" });
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("حدث خطأ أثناء تسجيل الدخول");
    }
  };

  const handleRegister = async (registerData: RegisterSubmission) => {
    try {
      setError(null);
      const result = await registerFn({ data: registerData });

      // If we get a result, check if it's an error
      if (result && "error" in result && result.error) {
        setError(result.error);
      } else if (result && "success" in result && result.success) {
        // Success - refetch user data and navigate
        await refetch();
        router.navigate({ to: "/guides" });
      }
    } catch (err) {
      console.error("Register error:", err);
      setError("حدث خطأ أثناء إنشاء الحساب");
    }
  };

  return (
    <>
      {error && (
        <div className="max-w-2xl p-4 mb-4 bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}
      <LoginForm onLogin={handleLogin} onRegister={handleRegister} />
    </>
  );
}
