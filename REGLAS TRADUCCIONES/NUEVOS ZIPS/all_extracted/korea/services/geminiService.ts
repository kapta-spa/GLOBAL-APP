
import { GoogleGenAI, Type } from "@google/genai";
import PizZip from "pizzip";
import { ExtractedData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
};

const extractTextFromDocx = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    const docXml = zip.file("word/document.xml")?.asText();
    if (!docXml) return "";
    return docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.error("Error reading reference Word:", e);
    return "";
  }
};

export const extractDataFromLicense = async (
  front: File,
  back: File,
  reference?: File | null
): Promise<ExtractedData> => {
  const frontBase64 = await fileToBase64(front);
  const backBase64 = await fileToBase64(back);
  
  const parts: any[] = [
    { inlineData: { data: frontBase64, mimeType: front.type } },
    { inlineData: { data: backBase64, mimeType: back.type } }
  ];

  let referenceInstruction = "";
  if (reference) {
    const referenceText = await extractTextFromDocx(reference);
    if (referenceText) {
      referenceInstruction = `REFERENCE CONTEXT FROM PREVIOUS DOCUMENT: "${referenceText}"`;
    }
  }

  const prompt = `
    Analyze these images of a South Korean driver's license.
    ${referenceInstruction}
    
    IMPORTANT RULES FOR KOREAN LICENSE EXTRACTION:
    1. "dateOfBirth": Look at the second line (Resident Registration Number). Extract the first 6 digits (YYMMDD) and convert to "DD Month YYYY". 
       Example: If "840227-1031213", dateOfBirth is "27 February 1984". 
       (If the digit after the hyphen is 1 or 2, it's 1900s. If 3 or 4, it's 2000s).
    2. "registration": Extract the number from the second line AFTER the hyphen.
       Example: If "840227- 1031213", registration is "1031213".
    3. "serial": Extract the alphanumeric code found directly BELOW the photo (e.g., "9X69J5").
    4. "period": Look for the section containing "적성검사" (Aptitude test) and "기간" (Period).
       Combine the first date (after 적성검사) and the second date (in 기간) using " to ".
       Example: "01 January 2027 to 31 December 2027".
    5. "surname": Family name in English (usually found near the top).
    6. "firstName": First given name in English.
    7. "middleName": Remaining given names in English.
    8. "licenseNumber": The main license number at the top.
    9. "issueDate": Date found next to Point 4a or similar signature date.
    10. "authority": Organization at the bottom, translated to English + Country (e.g., "Seoul Metropolitan Police Agency, South Korea").
    11. "class": Extract categories (e.g., 1종 보통).
    
    ALL dates must be in "DD Month YYYY" format in English.
    Return valid JSON matching the schema.
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
            firstName: { type: Type.STRING },
            middleName: { type: Type.STRING },
            firstNames: { type: Type.STRING },
            fullName: { type: Type.STRING },
            licenseNumber: { type: Type.STRING },
            dateOfBirth: { type: Type.STRING },
            registration: { type: Type.STRING },
            serial: { type: Type.STRING },
            period: { type: Type.STRING },
            placeOfBirth: { type: Type.STRING },
            issueDate: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            class: { type: Type.STRING },
            codes: { type: Type.STRING },
            authority: { type: Type.STRING },
            categoriesDates: { type: Type.STRING },
            explicacionCodigos: { type: Type.STRING },
          }
        }
      }
    });

    const result = JSON.parse(response.text.trim());
    if (!result.fullName) {
      result.fullName = `${result.surname || ''} ${result.firstName || ''} ${result.middleName || ''}`.trim();
    }
    return result as ExtractedData;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "The AI could not process the images.");
  }
};
