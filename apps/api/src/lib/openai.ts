import OpenAI from "openai";
import { config } from "../config.js";

export const openai = config.openAiKey ? new OpenAI({ apiKey: config.openAiKey }) : null;
