import vercelHandler from "../src/incubator/core/server/vercelHandler";

export const config = {
  maxDuration: 10,
  api: {
    bodyParser: false,
  },
};

export default vercelHandler;
