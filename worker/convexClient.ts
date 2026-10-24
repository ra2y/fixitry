import { ConvexHttpClient } from "convex/browser";
import { config } from "./config";

export const convex = new ConvexHttpClient(config.convexUrl);
