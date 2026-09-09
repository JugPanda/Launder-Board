import { createCompetitionHandlers } from "@/lib/b7/http";
import {
  authenticateB7Participant,
  b7Service,
} from "@/lib/b7/service.server";

const handlers = createCompetitionHandlers({
  authenticate: authenticateB7Participant,
  service: b7Service,
});

export const POST = handlers.POST;
