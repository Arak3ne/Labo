import vercelHandler from "./vercelHandler.js";

export { handleValidateHost, handleValidatePattern } from "../../../prologue/d14/server/d14Validate.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

export async function GET(request: Request): Promise<Response> {
  try {
    return await vercelHandler(request);
  } catch (error) {
    console.error("[labo-api]", error);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}

export { GET as POST, GET as PUT, GET as PATCH, GET as DELETE, GET as HEAD };
