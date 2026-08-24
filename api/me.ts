export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

async function handle(request: Request): Promise<Response> {
  try {
    const { default: vercelHandler } = await import(
      "../src/incubator/core/server/vercelHandler"
    );
    const result = await vercelHandler(request);
    if (result instanceof Response) return result;
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("[labo-api]", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}

export default handle;
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
