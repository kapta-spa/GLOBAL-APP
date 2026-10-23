
import { GoogleGenAI, Type } from "@google/genai";
import PizZip from "pizzip";
import { ExtractedData } from "../types";

let aiInstance: any = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '';
    aiInstance = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return aiInstance;
};

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
    Analyze these two images (Front and Back of a Czech Republic driver's license / Česká republika Řidičský průkaz).
    ${referenceInstruction}
    
    IMPORTANT: ALL TEXT OUTPUT VALUES MUST BE IN ENGLISH EXCEPT THE "language" field.
    
    EXTRACT DATA RULES:
    1. "surname": Family name (Příjmení / Item 1).
    2. "firstName": ONLY the very first name from the given names list (Jméno / Item 2).
    3. "middleName": ALL remaining given names after the first one. If only one name exists, leave this empty ("").
    4. "firstNames": All given names joined (for reference).
    5. "licenseNumber": The main identification number (Číslo řidičského průkazu / Item 5). Extract ONLY the alphanumeric characters.
    6. "dateOfBirth": Point 3 date of birth (Datum narození). Format: "DD Month YYYY".
    7. "placeOfBirth": Point 3 location (Místo narození). TRANSLATE TO ENGLISH (e.g. "Prague", "Brno", "Ostrava", etc.).
    8. "issueDate": Point 4a date of issue (Datum vydání). Format: "DD Month YYYY".
    9. "expiryDate": Point 4b date of expiry (Platnost do). Format: "DD Month YYYY". If no expiry date is found or indefinite, value must be "Indefinite".
    10. "authority": Extract value from Point 4c (Vydal / Issuing Authority), TRANSLATE TO ENGLISH (e.g. "Municipal Authority of Prague", "Magistrate of the City of Brno"), and ALWAYS append ", Czech Republic" at the end.
    11. "class": Extract ALL categories listed in Point 9 on the FRONT. SEPARATE THEM WITH COMMAS (e.g. "AM, A1, B, BE, T").
    12. "categoriesDates": Analyze the BACK table, Column 10 (10. Platí od). Group categories that have the EXACT same initial issue date. Format the output with the categories followed by the date, ONE GROUP PER LINE. 
        Example format:
        AM: 01 January 2000
        B1, B: 03 February 2001
        C1, C: 01 March 2002
        DO NOT put all groups on the same line. Use a newline character (\n) between each group.
    13. "classDescriptions": For EVERY license category found on the license, generate its description from the list below. EACH CATEGORY MUST START ON A NEW LINE.
        
        CRITICAL: DO NOT include any source links, URLs, or text like "Source: https://..." in this field. ONLY return the descriptions for the categories.
        
        List to use:
        - AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.
        - A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.
        - A2 - motorcycles with a power rating under 35 kW.
        - A - heavy motorcycles without power restrictions.
        - B1 - quadricycles.
        - B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers.
        - BE - vehicle of category B towing a heavy trailer of under 3,500 kg.
        - C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers.
        - C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.
        - C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.
        - CE - vehicle of category C towing a heavy trailer.
        - D1 - passenger vehicles built for fewer than 16 passengers and that is no longer than 8 m.
        - D1E - vehicle of category D1 towing a heavy trailer.
        - D - passenger vehicles for more than eight passengers.
        - DE - vehicle of category D towing a heavy trailer.
        - T - Tractors and self-propelled agricultural or forestry machinery.
        - Code 10 - Limited to the operation of a specific vehicle type or under specific conditions.
        
        ONLY include descriptions for the categories actually present on the license.
    14. "codes": Look at the TOP LEFT corner of the BACK or the document serial number. Extract the series/code string.
    15. "explicacionCodigos": (Conditions / Restrictions) Look at Column 12 (BACK) or Front restrictions. If found, generate the EXACT text from this list ONLY:
        - For Code "01" (or "01.01", "01.06"): "01- Correction of vision and/or eye protection"
        - For Code "70": "70. Exchange of driver's license number"
        - For Code "78": "78- Restricted to vehicles with automatic transmission"
        - For Code "95": "95- Driver holding CPC (Certificate of Professional Competence)"
        - For Class A1 restrictions: "Class A1- limited to 45 km/h"
        - For Code "106": "106- Operation of motor vehicles for the transport of passengers, with a maximum weight of 3,500 kilograms and more than 17 seats (including the driver’s seat)"
        
        Combine all found into a single coherent paragraph. If none are found, ALWAYS return a single hyphen "-".
    16. "code106From" & "code106To": Extract these specifically if code 106 is present.
    17. "language": Look specifically at the BACK or title legend of the license, where the field numbers or title translations are listed. Identify and list all the languages present (e.g. "Czech" or "Czech, English, French").
    18. Format all dates as "DD Month YYYY".
    
    IMPORTANT: IGNORE any "Source:" or URL information found in the reference document context. DO NOT reproduce these URLs in the extracted fields.
    
    Return valid JSON.
  `;

  parts.push({ text: prompt });
  const ai = getAI();

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
            language: { type: Type.STRING },
          }
        }
      }
    });

    const resultText = response.text || "{}";
    const result = JSON.parse(resultText.trim());
    if (!result.fullName) {
      result.fullName = `${result.surname || ''} ${result.firstName || ''} ${result.middleName || ''}`.trim();
    }
    return result as ExtractedData;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "The AI could not process the images.");
  }
};
