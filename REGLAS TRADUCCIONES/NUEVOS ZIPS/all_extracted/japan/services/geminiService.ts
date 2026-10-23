
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const formatConditions = (text: string): string => {
  if (!text) return "";

  // Standardize glasses/spectacles variations
  let processed = text
    .replace(/(?:眼鏡等?|めがね等?|Glasses,?\s*etc\.?|Prescribed spectacles)/gi, "Prescribed spectacles");

  let lines = processed.split(/\r?\n/);
  if (lines.length === 1 && (processed.includes(',') || processed.includes(';'))) {
    lines = processed.split(/;|,/);
  }

  const cleaned = lines
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (/glasses|眼鏡|めgね|めがね|spectacle/i.test(line)) {
        return "Prescribed spectacles";
      }
      return line;
    });

  return Array.from(new Set(cleaned)).join("\n");
};

const formatClass = (text: string): string => {
  if (!text) return "";

  let result = text
    .replace(/普通/g, "Ordinary Vehicle")
    .replace(/準中型/g, "Semi-Medium Vehicle")
    .replace(/中型/g, "Medium Vehicle")
    .replace(/大型/g, "Large Vehicle")
    .replace(/大特/g, "Large Special Vehicle")
    .replace(/小特/g, "Small Special Vehicle")
    .replace(/原付/g, "Moped")
    .replace(/普自二/g, "Ordinary Motorcycle")
    .replace(/大自二/g, "Large Motorcycle")
    .replace(/(?:け引|牽引)/g, "Towing Vehicle");

  result = result
    .replace(/\bOrdinary(?!\s+Vehicle)/gi, "Ordinary Vehicle")
    .replace(/\bSemi-Medium(?!\s+Vehicle)/gi, "Semi-Medium Vehicle")
    .replace(/\bMedium(?!\s+Vehicle)/gi, "Medium Vehicle")
    .replace(/\bLarge(?!\s+(?:Special|Vehicle|Motorcycle))/gi, "Large Vehicle");

  result = result.replace(/\bVehicle\s+Vehicle\b/gi, "Vehicle");

  return result.trim();
};

export const extractDataFromLicense = async (
  frontBase64: string,
  backBase64: string
): Promise<ExtractedData> => {
  const parts: any[] = [
    { inlineData: { data: frontBase64, mimeType: 'image/jpeg' } },
    { inlineData: { data: backBase64, mimeType: 'image/jpeg' } }
  ];

  const prompt = `
    Extract info from this Japanese license and translate to English.
    
    1. surname: Family name (English Romaji)
    2. firstNames: Given names (English Romaji)
    3. licenseNumber: 12-digit ID
    4. assignedNumber: Any other document or reference number found
    5. dateOfBirth: translated Month (e.g. 05 May 1990)
    6. placeOfBirth: Prefecture (English)
    7. issueDate: DD Month YYYY
    8. expiryDate: DD Month YYYY
    9. authority: Authority + ", Japan"
    10. class: Map using: 普通->Ordinary Vehicle, 準中型->Semi-Medium Vehicle, 中型->Medium Vehicle, 大型->Large Vehicle, 大特->Large Special Vehicle, 大自二->Large Motorcycle, 普自二->Ordinary Motorcycle, 小特->Small Special Vehicle, 原付->Moped, け引->Towing Vehicle. ALWAYS append "Vehicle" to Ordinary, Semi-Medium, Medium, Large, Large Special, Small Special.
    11. categoriesDates: Grouped back dates
    12. codes: Conditions applying to licence (免許の条件等). 
        CRITICAL RULES FOR CONDITIONS:
        - If condition translates to "Glasses etc" or "眼鏡等", ALWAYS translate as "Prescribed spectacles".
        - If there are multiple conditions, put EACH condition on its own NEW LINE (using \\n). Example:
          Prescribed spectacles
          Ordinary vehicles limited to AT
    13. address: Full English address
    
    Output JSON only. No Japanese characters. Do NOT repeat fields.
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            surname: { type: Type.STRING },
            firstNames: { type: Type.STRING },
            fullName: { type: Type.STRING },
            licenseNumber: { type: Type.STRING },
            assignedNumber: { type: Type.STRING },
            dateOfBirth: { type: Type.STRING },
            placeOfBirth: { type: Type.STRING },
            issueDate: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            address: { type: Type.STRING },
            class: { type: Type.STRING },
            codes: { type: Type.STRING },
            authority: { type: Type.STRING },
            categoriesDates: { type: Type.STRING },
          },
          required: ["surname", "firstNames", "licenseNumber", "assignedNumber"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("The AI returned an empty response.");
    
    const cleanText = text.trim();
    try {
      const result = JSON.parse(cleanText);
      if (!result.fullName) {
        result.fullName = `${result.surname || ''} ${result.firstNames || ''}`.trim();
      }
      if (result.codes) {
        result.codes = formatConditions(result.codes);
      }
      if (result.class) {
        result.class = formatClass(result.class);
      }
      return result as ExtractedData;
    } catch (parseError) {
      console.error("JSON Parse Error. Content:", text);
      throw new Error(`Invalid JSON from AI: ${cleanText.substring(0, 100)}...`);
    }
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "The AI could not process the images.");
  }
};
