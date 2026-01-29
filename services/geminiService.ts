
import { GoogleGenAI, Schema, Type, MediaResolution, Content } from "@google/genai";
import { AIResponse, FieldType } from "../types";

/**
 * @fileoverview Core Inference Service for the Visual Context Assistant.
 * 
 * DESIGN ARCHITECTURE:
 * This service implements a "Generative UI" pattern where the model (Gemini 3) 
 * acts as a controller, determining the optimal state transition between 
 * 'COLLECTING' (incomplete context) and 'COMPLETE' (task execution).
 * 
 * TECHNICAL DIFFERENTIATION:
 * 1. Leveraging "Test-Time Compute": Utilizing thinkingConfig to allow the model 
 *    to self-correct and verify context before responding.
 * 2. Tool Grounding: Integrating Google Search and URL Context for real-world factuality.
 * 3. Structured Outputs: Enforcing strict JSON schemas to ensure UI stability.
 */

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Metadata schema for generating dynamic input fields.
 * Follows a "Declarative UI" approach where the LLM defines the interface 
 * requirements based on its reasoning about the user's goal.
 */
const uiFieldSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Immutable identifier for state management." },
    type: {
      type: Type.STRING,
      enum: [
        FieldType.TEXT,
        FieldType.NUMBER,
        FieldType.DATE,
        FieldType.TEXTAREA,
        FieldType.FILE,
        FieldType.SELECT
      ],
      description: "Primitive type used for component factory instantiation."
    },
    label: { type: Type.STRING, description: "End-user facing semantic label." },
    placeholder: { type: Type.STRING, description: "Contextual hint for the user." },
    description: { type: Type.STRING, description: "Explains the model's reasoning for requiring this specific variable." },
    required: { type: Type.BOOLEAN, description: "Constraint for form validation." },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Enumerated values for SELECT-type inputs."
    }
  },
  required: ["id", "type", "label"]
};

/**
 * Primary response schema for the Visual Context loop.
 * Orchestrates the balance between conversational 'message' and technical 'analysis'.
 */
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      description: "State Machine indicator: 'COLLECTING' triggers Generative UI, 'COMPLETE' triggers Final Output."
    },
    message: { type: Type.STRING, description: "High-level conversational bridge. Must explain the model's current latent state and missing information." },
    fields: {
      type: Type.ARRAY,
      items: uiFieldSchema,
      description: "Collection of UI components required for the next inference step."
    },
    analysis: { type: Type.STRING, description: "Internal reasoning trace (Markdown). Focuses on the 'Why' behind the final answer." },
    final_output: { type: Type.STRING, description: "The definitive task deliverable (Code, Strategy, Document) in Markdown." },
    key_references: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Identified entities and variables used to ground the output."
    }
  },
  required: ["status", "message"]
};

/**
 * SYSTEM PROMPT: Behavioral steering for the Visual Context Engineer.
 * Uses "Chain of Thought" (CoT) and "Ambiguity Detection" heuristics.
 */
const SYSTEM_INSTRUCTION = `
You are the "Context Engineer" powering the "Automatic Visual Context" engine.
Your core mission is to shift the burden of "prompt engineering" from the user to the model.

PHILOSOPHY:
Most AI failures aren't due to model capability, but due to vague user prompting.
Instead of guessing or providing generic answers, you must architect a custom Generative UI to solicit the exact missing variables.
You are an active partner that "interviews" the user to guarantee context completeness.

CAPABILITIES:
- **Thinking Model**: Use your reasoning capabilities to detect ambiguity and missing constraints.
- **Google Search Grounding**: Proactively verify facts, libraries, and recent events.
- **URL Context**: If a user shares a link, analyze it deeply to extract context without asking the user to copy-paste.
- **Multimodality**: Process images and audio to understand the full picture.

YOUR PROCESS:
1. **Analyze**: When a user makes a request, analyze it for ambiguity.
2. **Contextualize**: Identify missing variables (Dates, Locations, Specific Files, Versions, Design constraints).
3. **Decide Status**:
   - **COLLECTING**: Use this status to show a UI on the right. In the 'message' field, provide a thorough conversational explanation of *why* this specific info improves the result.
   - **COMPLETE**: Provide a 'message' that summarizes the final conclusion, then put the deep technical analysis in 'analysis' and the final draft in 'final_output'.

RULES:
- Be intelligent about file inputs. Ask for relevant docs (specifications, error logs, research notes).
- Use 'googleSearch' extensively to ground your responses in reality.
- Do not provide a final output if the prompt is vague. Fix the prompt by asking the user via the generated UI.
`;

/**
 * Sanitizes model outputs. Handles potential markdown fences generated 
 * during non-deterministic JSON generation.
 */
const cleanJsonOutput = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
  }
  return cleaned.trim();
};

/**
 * Orchestrates multi-turn conversation with multimodal inputs and tool-calling.
 * @param history The cumulative chat history for context preservation.
 * @param newInput Payload containing text and/or base64 encoded media.
 * @param modelName Target Gemini model identifier.
 */
export const sendMessageToGemini = async (
  history: Content[],
  newInput: { text?: string; files?: { mimeType: string; data: string }[] },
  modelName: string = "gemini-3-flash-preview"
): Promise<AIResponse> => {
  try {
    const currentParts: any[] = [];
    if (newInput.text) currentParts.push({ text: newInput.text });
    if (newInput.files) {
      newInput.files.forEach((f) => {
        currentParts.push({ inlineData: { mimeType: f.mimeType, data: f.data } });
      });
    }

    const contents = [...history, { role: "user", parts: currentParts }];

    // Dynamic Tool Selection: Enable URL analysis only when heuristic detects links.
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hasUrl = newInput.text && urlRegex.test(newInput.text);

    const tools: any[] = [{ googleSearch: {} }];
    if (hasUrl) {
        tools.push({ urlContext: {} });
    }

    const config: any = {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      tools: tools,
      temperature: 1, // High temperature used as Gemini 3's reasoning engine handles variance gracefully.
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH, // Ensuring fidelity for visual reasoning tasks.
    };

    /**
     * OPTIMIZATION: Thinking Level Strategy
     * - Gemini 3 Pro: High thinking for deep technical reasoning.
     * - Gemini 3 Flash: Medium thinking for responsive UI generation.
     */
    let level = "HIGH";
    if (modelName.includes("flash")) {
        level = "MEDIUM";
    }

    config.thinkingConfig = { 
      thinkingLevel: level 
    };

    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config,
    });

    const text = response.text;
    if (!text) throw new Error("Null response from inference engine.");

    // Strict JSON parsing with fallback.
    let jsonResponse: AIResponse;
    try {
        jsonResponse = JSON.parse(cleanJsonOutput(text)) as AIResponse;
    } catch (e) {
        console.error("Schema Mismatch or Invalid JSON:", text);
        throw new Error("Model failed to adhere to the requested response schema.");
    }

    if (!jsonResponse.grounding_links) {
        jsonResponse.grounding_links = [];
    }

    // Extraction of Grounding Chunks (Google Search) for UI attribution.
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
      const links = groundingChunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          uri: chunk.web.uri,
          title: chunk.web.title || "External Source"
        }));
      jsonResponse.grounding_links.push(...links);
    }

    // Extraction of URL Context results.
    const urlContextMetadata = response.candidates?.[0]?.urlContextMetadata;
    if (urlContextMetadata?.urlMetadata) {
        const urlLinks = urlContextMetadata.urlMetadata.map((meta: any) => ({
            uri: meta.retrievedUrl || meta.retrieved_url,
            title: "Retrieved Page Context"
        }));
        jsonResponse.grounding_links.push(...urlLinks);
    }

    return jsonResponse;
  } catch (error) {
    console.error("Inference Pipeline Failure:", error);
    throw error;
  }
};

/**
 * High-precision audio-to-text transcription.
 * Uses multimodal Gemini 3 Flash for low-latency processing of PCM data.
 */
export const transcribeAudio = async (
  base64Audio: string,
  mimeType: string
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Audio } },
            { text: "Transcribe the audio exactly as spoken. Zero markdown. Raw text only." }
          ]
        }
      ]
    });

    return response.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    throw new Error("Audio processing pipeline interrupted.");
  }
};
