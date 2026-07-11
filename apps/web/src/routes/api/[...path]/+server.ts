import { app } from "@openlocale/api";
import type { RequestHandler } from "./$types";

const handler: RequestHandler = ({ request }) => app.fetch(request);

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
  handler as HEAD
};
