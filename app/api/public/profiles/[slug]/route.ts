import { createPublicHandlers } from "@/lib/b7/http";
import { b7Service } from "@/lib/b7/service.server";

const handlers = createPublicHandlers({ service: b7Service });

export const GET = handlers.profile.GET;
