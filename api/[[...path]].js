import vercelHandler from "../dist-server/vercelHandler.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

export async function GET(request) {
  try {
    return await vercelHandler(request);
  } catch (error) {
    console.error("[labo-api]", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}

export { GET as POST, GET as PUT, GET as PATCH, GET as DELETE };
