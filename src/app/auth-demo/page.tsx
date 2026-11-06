import { vi } from "@/lib/locale";
import AuthScreen from "@/components/auth/AuthScreen";
import AccountStatesDemo from "@/components/auth/AccountStatesDemo";
export default function Page() { return <AuthScreen label={vi.auth.demo.title}><AccountStatesDemo /></AuthScreen>; }
