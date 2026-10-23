
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
    1. "surname": Family name (Label 1).
    2. "firstName": The FIRST given name from Label 2. Ensure it is complete.
    3. "middleName": ALL names that follow the first given name in Label 2. If there are multiple additional names, include them ALL here.
    4. "firstNames": ALL names from Label 2 combined exactly as they appear.
    5. "licenseNumber": The main identification number (Label 5). Extract ONLY the alphanumeric characters.
    6. "dateOfBirth": Date found at Point 3.
    7. "placeOfBirth": Location found at Point 3. TRANSLATE TO ENGLISH.
    8. "issueDate": General issue date (Point 4a).
    9. "expiryDate": General expiry date (Point 4b).
    10. "authority": Issuing authority (Point 4c). TRANSLATE TO ENGLISH and append country name if not present.
    11. "address": Extract the full address indicated on the license. Ensure street, city, and zip are included if visible.
    12. "gender": Identify the gender. Output MUST be exactly "Male" or "Female".
    13. "blood": Identify the blood type (e.g., A+, O-, B+, etc.).
    14. "codes": Look at the REVERSE (BACK) side, TOP RIGHT corner. Extract any numeric/alphanumeric strings found there.
    15. "class": Extract ALL categories listed in Point 9 on the FRONT (e.g. A, B, BE). SEPARATE THEM WITH COMMAS.
    16. "categoriesDates": Analyze the BACK table, Column 10 (valid from). Group identical dates for different categories if they exist.
    17. "explicacionCodigos": Look at Column 12 (BACK) for ALL categories and identify specific codes for the whole license:
        - Code "70": "70. Exchange of driver's license number [extract number]"
        - Code "01": "01- Vision correction and/or protection"
        - Code "01.06": "01.06- Prescribed spectacles or contact lenses"
        - Code "106": "106- Subject to the application of article R. 413-5 from [DateFrom] to [DateTo]"
    18. Format all dates as "DD Month YYYY" (e.g., 15 January 2024).
    19. Capture ALL names accurately. Do not truncate any names.
    
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
            firstNames: { type: Type.STRING },
            fullName: { type: Type.STRING },
            licenseNumber: { type: Type.STRING },
            dateOfBirth: { type: Type.STRING },
            placeOfBirth: { type: Type.STRING },
            issueDate: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            address: { type: Type.STRING },
            gender: { type: Type.STRING },
            blood: { type: Type.STRING },
            class: { type: Type.STRING },
            codes: { type: Type.STRING },
            authority: { type: Type.STRING },
            categoriesDates: { type: Type.STRING },
            code106From: { type: Type.STRING },
            code106To: { type: Type.STRING },
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