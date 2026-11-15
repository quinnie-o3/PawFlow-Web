import { redirect } from "next/navigation";

/** The app's default URL: `/` always opens the dashboard. */
export default function Home() {
  redirect("/dashboard");
}
