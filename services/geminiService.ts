
import { GoogleGenAI, Type } from "@google/genai";
import { Instrument } from "../types";
import { parseInstrumentResponse } from "./normalizeInstruments";

/**
 * GeminiService: Orchestrates the Vision-to-DCS extraction.
 * Uses Gemini-3-flash-preview for high-speed multimodal analysis of P&ID drawings.
 */

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const PID_ANALYSIS_SYSTEM_INSTRUCTION = `
You are an Expert Lead DCS/SCADA Automation Engineer and Process Control Architect. You possess deep, specialized knowledge of ISA-5.1 instrumentation standards, Siemens PCS7 Advanced Process Library (APL), and ABB 800xA system architectures.

YOUR TASK:
Analyze the provided P&ID image. Extract ALL control instruments, valves, motors, pumps, and transmitters. 

STRICT Siemens PCS7 APL Block Type Mapping:
- Analog Inputs (PT, TT, FT, LT, AT) -> "MonAnL"
- Analog Outputs (Control Valves) -> "VlvAnL"
- Digital Inputs (Switches) -> "MonDiL"
- Digital Outputs (On/Off Solenoid Valves) -> "VlvL"
- Motors/Pumps -> "MotL"
- PID Controllers -> "PIDConL"

BOM Estimation: Suggest a high-quality brand (Emerson, Siemens, ABB, Endress+Hauser) and estimated USD cost.
Topology: Infer process flow based on visual connections.
Safety Audit: Flag non-standard tags or missing engineering units.
`;

export const analyzePIDImage = async (base64Image: string): Promise<Instrument[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: "Extract ALL control instruments, especially analog transmitters and control valves. Provide full JSON output.",
          },
        ],
      },
      config: {
        systemInstruction: PID_ANALYSIS_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              tagName: { type: Type.STRING, description: "ISA-5.1 Tag Name" },
              equipmentType: { type: Type.STRING, description: "Broad category (e.g., Transmitter, Valve)" },
              signalType: { type: Type.STRING, description: "AI, AO, DI, or DO" },
              description: { type: Type.STRING, description: "Human readable functional description" },
              engineeringUnits: { type: Type.STRING, description: "e.g., barg, degC, m3/h" },
              pcs7BlockType: { type: Type.STRING, description: "Target Siemens APL Block" },
              abb800xaObject: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
              brand: { type: Type.STRING },
              model: { type: Type.STRING },
              estimatedCost: { type: Type.NUMBER },
              connectedTo: { type: Type.STRING, description: "Tag name of adjacent equipment" },
              safetyWarning: { type: Type.STRING, description: "Potential ISA compliance issues" },
            },
            required: ["tagName", "signalType", "pcs7BlockType"],
          },
        },
      },
    });

    return parseInstrumentResponse(response.text, `inst-${Date.now()}`);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

/**
 * Generates a conceptual 3D render of the process area based on instrumentation.
 */
export const generateDigitalTwin = async (instruments: Instrument[]): Promise<string> => {
  const summary = instruments.map(i => `${i.tagName}: ${i.description}`).join(', ');
  const prompt = `A professional photorealistic 3D industrial digital twin render of a process plant area containing these instruments: ${summary}. High-tech aesthetic, futuristic control room visualization, Unreal Engine 5 style, 8k resolution, cinematic lighting, blue and gray color palette.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
};
