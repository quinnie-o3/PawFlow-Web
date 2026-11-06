import { Suspense } from "react";
import { vi } from "@/lib/locale";
import AuthScreen from "@/components/auth/AuthScreen";
import VerifyEmailForm from "@/components/auth/VerifyEmailForm";
export const metadata = { title: vi.auth.verification.title, description: vi.auth.verification.disabledBody };
export default function Page() { return <AuthScreen label={vi.auth.verification.title}><Suspense fallback={<p>{vi.auth.loading}</p>}><VerifyEmailForm /></Suspense></AuthScreen>; }
