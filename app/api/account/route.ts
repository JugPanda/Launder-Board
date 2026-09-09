import { createAccountHandler } from "@/lib/b7/http";
import {
  authenticateB7Account,
  b7Service,
} from "@/lib/b7/service.server";

export const DELETE = createAccountHandler({
  authenticate: authenticateB7Account,
  service: b7Service,
});
