import { createPrivacyHandler } from "@/lib/b7/http";
import {
  authenticateB7Participant,
  b7Service,
} from "@/lib/b7/service.server";

export const PUT = createPrivacyHandler({
  authenticate: authenticateB7Participant,
  service: b7Service,
});
