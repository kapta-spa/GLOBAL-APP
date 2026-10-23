import { GoogleGenAI, Type } from "@google/genai";
import PizZip from "pizzip";
import { ExtractedData, getClassDescriptions } from "../types";

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
  // Inicializar AI justo antes del uso para evitar errores de ReferenceError con process.env global
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
    3. "middleName": ALL remaining given names after the first one. If only one name exists, leave this empty.
    4. "firstNames": All given names joined (for reference).
    5. "licenseNumber": The main identification number. Extract ONLY the alphanumeric characters.
    6. "dateOfBirth": Point 3 date.
    7. "placeOfBirth": Point 3 location. TRANSLATE TO ENGLISH.
    8. "issueDate": Point 4a.
    9. "expiryDate": Point 4b.
    10. "authority": Extract value from Point 4c, TRANSLATE TO ENGLISH, and ALWAYS append the country name in English at the end (e.g. "Hungary").
    11. "class": Extract ALL categories listed in Point 9 on the FRONT and/or in the BACK table (Column 9/10). SEPARATE THEM WITH COMMAS. Recognize both standard EU categories (AM, A1, A2, A, B1, B, C1, C, D1, D, BE, CE, DE, etc.) AND special national Hungarian categories:
        - K: Garden tractor, animal-drawn vehicle
        - T: Agricultural tractor and 2 heavy trailers, slow vehicle and trailer, garden tractor, animal-drawn vehicle
        - M: Moped, animal-drawn vehicle, garden tractor (after 16 years of age)
        - TR: Trolleybus, agricultural tractor and 2 heavy trailers, moped, slow vehicle and trailer, garden tractor, animal-drawn vehicle
        - V: Tram, garden tractor, animal-drawn vehicle
    12. "categoriesDates": Analyze the BACK table, Column 10. Group identical dates.
    13. "codes": Look ONLY at the TOP LEFT corner of the BACK. Extract the series of 3 strings.
    14. "explicacionCodigos": Look at Column 12 (BACK) and identify ONLY these specific codes. If found, generate the EXACT text below:
        - Code "70": "70. Exchange of driver's license number [extract number]"
        - Code "01": "01- Vision correction and/or protection"
        - Code "01.06": "01.06- Prescribed spectacles or contact lenses"
        - Code "106": "106- Subject to the application of article R. 413-5 during probationary period from [DateFrom] to [DateTo] (Speed limits: 110km/h in Freeways where limit is 130km/h, 100km/h in freeways with lower speed limit or double roads, 80 km/h on other roads.)"
        
        Combine all found into a single coherent paragraph. If none are found, leave empty.
    15. "code106From" & "code106To": Extract these specifically if code 106 is present.
    16. "licenseLanguage": Identify the language(s) of the original document text (e.g., "French", "French and Dutch", "Spanish").
    17. Format all dates as "DD Month YYYY".
    18. "classDescriptions": For only the permitted categories extracted in "class", list their descriptions.
    
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
            class: { type: Type.STRING },
            classDescriptions: { type: Type.STRING },
            codes: { type: Type.STRING },
            authority: { type: Type.STRING },
            categoriesDates: { type: Type.STRING },
            code106From: { type: Type.STRING },
            code106To: { type: Type.STRING },
            explicacionCodigos: { type: Type.STRING },
            licenseLanguage: { type: Type.STRING },
          }
        }
      }
    });

    const result = JSON.parse(response.text.trim());
    if (!result.fullName) {
      result.fullName = `${result.surname || ''} ${result.firstName || ''} ${result.middleName || ''}`.trim();
    }
    // Ensure classDescriptions uses the exact user-provided text for all permitted categories
    result.classDescriptions = getClassDescriptions(result.class) || result.classDescriptions || "";
    return result as ExtractedData;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "The AI could not process the images.");
  }
};