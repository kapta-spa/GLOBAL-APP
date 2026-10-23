
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
    Analyze these two images (Front and Back of a driver's license).
    ${referenceInstruction}
    
    IMPORTANT: ALL TEXT OUTPUT VALUES MUST BE IN ENGLISH.
    
    EXTRACT DATA RULES:
    1. "surname": Family name.
    2. "firstName": ONLY the very first name from the given names list.
    3. "middleName": ALL remaining given names after the first one.
    4. "personal": The alphanumeric value indicated exactly at Point 4d (FRONT).
    5. "code": The series of four distinct numbers or alphanumeric strings found immediately below label 4d (FRONT). Join them with spaces.
    6. "first": Locate the authorized class (usually B) in the table on the BACK. Extract ONLY the YEAR from the issue date (Column 10) for that category.
    7. "licenseNumber": The main identification number (Point 5). Extract ONLY the alphanumeric characters.
    8. "dateOfBirth": Point 3 date.
    9. "placeOfBirth": Point 3 location. TRANSLATE TO ENGLISH.
    10. "issueDate": Point 4a.
    11. "expiryDate": Point 4b.
    12. "authority": Extract value from Point 4c, TRANSLATE TO ENGLISH, and ALWAYS append the country name in English at the end.
    13. "class": Point 9 categories on FRONT. SEPARATE WITH COMMAS.
    14. "categoriesDates": Analyze the BACK table, Column 10.
    15. "explicacionCodigos": Column 12 (BACK) for codes 70, 01, 01.06, or 106.
    
    Format all dates as "DD Month YYYY".
    
    Return valid JSON.
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
            personal: { type: Type.STRING },
            code: { type: Type.STRING },
            first: { type: Type.STRING },
            licenseNumber: { type: Type.STRING },
            dateOfBirth: { type: Type.STRING },
            placeOfBirth: { type: Type.STRING },
            issueDate: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            class: { type: Type.STRING },
            authority: { type: Type.STRING },
            categoriesDates: { type: Type.STRING },
            explicacionCodigos: { type: Type.STRING },
          }
        }
      }
    });

    const result = JSON.parse(response.text.trim());
    result.fullName = `${result.surname || ''} ${result.firstName || ''} ${result.middleName || ''}`.trim();
    result.firstNames = `${result.firstName || ''} ${result.middleName || ''}`.trim();
    return result as ExtractedData;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "The AI could not process the images.");
  }
};
