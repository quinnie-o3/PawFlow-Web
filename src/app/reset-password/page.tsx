import { Suspense } from "react";
import { vi } from "@/lib/locale";
import AuthScreen from "@/components/auth/AuthScreen";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
export default function Page() { return <AuthScreen label={vi.auth.reset.title}><Suspense fallback={<p>{vi.auth.loading}</p>}><ResetPasswordForm /></Suspense></AuthScreen>; }
