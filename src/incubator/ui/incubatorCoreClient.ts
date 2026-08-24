import type { IncubatorCoreClient } from "./incubatorUiTypes";
import { createMockIncubatorCoreClient } from "./incubatorUiMock";

export function resolveIncubatorCoreClient(): IncubatorCoreClient {
  // The browser playground uses a public-only mock transport. The real core
  // stays server-side so biological signatures never enter the client bundle.
  return createMockIncubatorCoreClient();
}
