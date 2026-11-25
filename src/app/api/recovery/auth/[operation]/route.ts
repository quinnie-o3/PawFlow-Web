import { recoveryProxy } from "@/features/auth/recovery/recoveryProxy";

export async function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
  const { operation } = await context.params;
  return recoveryProxy(request, operation);
}
