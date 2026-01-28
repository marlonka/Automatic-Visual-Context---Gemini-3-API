
/**
 * @fileoverview Domain types for the Visual Context system.
 * Defines the contract between the LLM inference output and the React UI state.
 */

export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  AWAITING_INPUT = 'AWAITING_INPUT', // Model has requested more context
  COMPLETE = 'COMPLETE'             // Model has generated the final artifact
}

/**
 * Supported field types for Generative UI generation.
 * These correspond to specific React components in the DynamicField factory.
 */
export enum FieldType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  TEXTAREA = 'textarea',
  FILE = 'file',
  SELECT = 'select'
}

/**
 * Interface for model-driven UI components.
 */
export interface UIField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  options?: string[];
  description?: string;
  required?: boolean;
}

/**
 * Attribution link for Google Search/URL Context grounding.
 */
export interface GroundingLink {
  uri: string;
  title: string;
}

/**
 * Root response object returned by the Gemini 3 Controller.
 */
export interface AIResponse {
  status: 'COLLECTING' | 'COMPLETE';
  message: string;
  fields?: UIField[];
  analysis?: string; 
  final_output?: string; 
  key_references?: string[]; 
  grounding_links?: GroundingLink[];
}

export interface Attachment {
  mimeType: string;
  data: string; // Base64 encoded media
}

/**
 * Internal chat state object.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content?: string;
  uiFields?: UIField[];
  analysis?: string;
  final_output?: string;
  formData?: Record<string, string | File>;
  groundingLinks?: GroundingLink[];
  attachments?: Attachment[];
}
