import { handleBff } from "@/lib/server/bff/handler";
export const runtime="nodejs";
export const dynamic="force-dynamic";
async function handle(request: Request, context: {params: Promise<{path:string[]}>}) {
  const {path}=await context.params;
  return handleBff(request,path.join('/'));
}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
