
import { GoogleGenAI, Type } from "@google/genai";
import PizZip from "pizzip";
import { ExtractedData } from "../types";
import { generateClassDescriptions, normalizeCategoriesDates, getPermittedCategories } from "./categoryService";

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
    Analyze these two images of a driver's license from the Netherlands (Front and Back).
    ${referenceInstruction}
    
    IMPORTANT: ALL TEXT OUTPUT VALUES MUST BE IN ENGLISH.
    
    CRITICAL RULE FOR MISSING DATA:
    If any field does not have data, is missing, not visible, unreadable, or not applicable, assign a single hyphen "-" (dash). NEVER output empty strings "", null, or "N/A".
    
    EXTRACT DATA RULES:
    1. "surname": Family name (Point 1).
    2. "firstName": ONLY the very first name from the given names list (Point 2).
    3. "middleName": ALL remaining given names after the first one. If none, assign "-".
    4. "firstNames": All given names joined.
    5. "licenseNumber": The identification number at point 5.
    6. "citizen": EXTREMELY IMPORTANT - Look at the BACK (reverso) of the card, in the TOP LEFT area (parte superior izquierda). There are usually TWO series of numbers (The BSN and another numeric code nearby). 
       Extract BOTH and join them using a slash " / ".
       Example format: "150348563 / 1234567851".
    7. "dateOfBirth": Date at point 3.
    8. "placeOfBirth": Location at point 3. TRANSLATE TO ENGLISH.
    9. "issueDate": Point 4a.
    10. "expiryDate": Point 4b.
    11. "authority": Point 4c, TRANSLATE TO ENGLISH (e.g., "Mayor and Aldermen of...") and append "Netherlands".
    12. "class": Extract ONLY the categories that the driver is PERMITTED/AUTHORIZED to drive.
        - Look at Point 9 on the FRONT of the card (e.g. "B" or "AM, B, T").
        - In the table on the BACK, ONLY categories that have a valid start date in Column 10 are permitted!
        - CRITICAL: The back table pre-prints all EU categories (AM through T) as a blank grid, but rows WITHOUT dates in Column 10 are NOT permitted! NEVER extract categories that have empty/blank date cells in Column 10.
        - Format: Comma-separated list of ONLY permitted categories (e.g., "AM, B, T").
    13. "categoriesDates": Analyze the table on the BACK (reverso). Look at Column 10 (validity/start date for each category).
        - Extract ONLY the permitted categories and their validity date from Column 10.
        - If several categories have the same date, group them separated by commas.
          Example:
          A1,A2: 01 May 2026
          B: 12 April 2025
        - CRITICAL RULE: If all categories have the exact same date, output ONLY the date itself without category letters (e.g. "01 May 2026").
        - If no dates found, assign "-".
    14. "codes": Look for numeric strings in the TOP LEFT of the BACK (if different from BSN).
    15. "explicacionCodigos": Column 12 (BACK). Translate standard codes (01, 70, 106) into professional English descriptions. If none, assign "-".
    16. "code106From" & "code106To": Dates for probationary code 106 if present, otherwise "-".
    17. "classDescriptions": Provide official vehicle descriptions ONLY for the categories the driver is PERMITTED to drive (the ones extracted in "class").
        - Under NO circumstances should you output descriptions for unpermitted categories.
        - If the driver only has "B", output ONLY the description for B.
        - If the driver has "AM, B", output ONLY descriptions for AM and B.
        - Each permitted category on its own line.
    
    Format all dates as "DD Month YYYY" (e.g., 15 March 2024).
    
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
            citizen: { type: Type.STRING, description: "Both numeric series from back top-left corner (BSN / Serial)" },
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
          }
        }
      }
    });

    const result = JSON.parse(response.text.trim());

    // Helper to enforce "-" for empty, null, or undefined fields
    const sanitize = (val: any): string => {
      if (val === undefined || val === null || val === "null" || val === "undefined" || val === "N/A") {
        return "-";
      }
      const s = String(val).trim();
      return (s === "" || s === "-") ? "-" : s;
    };

    // Calculate fullName cleanly before middleName is converted to hyphen
    const rawSurname = result.surname && result.surname !== "-" ? result.surname : "";
    const rawFirstName = result.firstName && result.firstName !== "-" ? result.firstName : "";
    const rawMiddleName = result.middleName && result.middleName !== "-" ? result.middleName : "";

    if (!result.fullName || result.fullName === "-" || result.fullName === "null") {
      result.fullName = [rawSurname, rawFirstName, rawMiddleName].filter(Boolean).join(" ").trim() || "-";
    }

    if (!result.firstNames || result.firstNames === "-" || result.firstNames === "null") {
      result.firstNames = [rawFirstName, rawMiddleName].filter(Boolean).join(" ").trim() || "-";
    }

    // Sanitize all keys
    for (const key of Object.keys(result)) {
      result[key] = sanitize(result[key]);
    }

    // Apply exact user rules for categoriesDates and permitted categories
    result.categoriesDates = normalizeCategoriesDates(result.categoriesDates);

    // Ensure class contains ONLY the permitted categories
    const permittedCats = getPermittedCategories(result.class, result.categoriesDates);
    if (permittedCats.length > 0) {
      result.class = permittedCats.join(', ');
    } else {
      result.class = sanitize(result.class);
    }

    // Generate classDescriptions strictly for ONLY the permitted categories
    result.classDescriptions = generateClassDescriptions(result.class, result.categoriesDates);

    return result as ExtractedData;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "The AI could not process the images.");
  }
};
