
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
      referenceInstruction = `REFERENCE CONTEXT FROM PREVIOUS DOCUMENT: "${referenceText}"\nUse this reference document as a guide for terminology, translation style, and field structure.`;
    }
  }

  const prompt = `
    You are an expert driver's license OCR and translation engine.
    Analyze these two images (Front and Back of a driver's license).
    ${referenceInstruction}
    
    CRITICAL MANDATES:
    1. ALL TEXT OUTPUT VALUES MUST BE IN ENGLISH.
    2. ALL DATES (dateOfBirth, issueDate, expiryDate, categoriesDates) MUST strictly use the format "DD Month YYYY" (e.g., "01 January 2026"). Translate month names to English.
    3. You MUST extract every single field. Do NOT leave any required field blank or null. If a field like middleName or codes is not present on the license, output an empty string "".
    4. If expiryDate is empty, missing, or indefinite on the license, output strictly "Indefinite".
    
    FIELD INSTRUCTIONS:
    - "surname": Family name from Point 1.
    - "firstName": ONLY the very first given name from Point 2.
    - "middleName": ALL remaining given names from Point 2 (or empty string "" if none).
    - "firstNames": Combined given names (firstName + middleName).
    - "fullName": Full legal name (surname + firstName + middleName).
    - "licenseNumber": Main identification/license number from Point 5.
    - "dateOfBirth": Date from Point 3 (Format: "DD Month YYYY").
    - "placeOfBirth": Location/city/country from Point 3 (Translate to English).
    - "issueDate": Date from Point 4a (Format: "DD Month YYYY").
    - "expiryDate": Date from Point 4b (Format: "DD Month YYYY"). Output "Indefinite" if missing or blank.
    - "authority": Translate the issuing authority from Point 4c into English, followed by a comma and the Country name in English (e.g., "Prefecture of Police, France" or "Berlin City Council, Germany").
    - "class": Extract ALL authorized categories/classes listed on the license (Point 9 or back table, e.g., AM, A1, A2, A, B, BE, B1, C1, C1E, C, CE, D1, D1E, D, DE, M, S, L, T).
    - "categoriesDates": Analyze Column 10 on the BACK. List categories with their expiry dates in format "Category: Date" or "Category1, Category2: Date". One line per group of categories that share the same date, separated by newlines (\n). Example:
      AM: 01 January 2000
      B1, B: 03 February 2001
      C1, C: 01 March 2002
    - "codes": Analyze Column 12 on the BACK. Compare found numerical codes with the list below. Output the NUMBER followed by the EXACT explanation.
        Format: "NUMBER- Explanation" (separated by newlines \n)
        Example: "01- Vision correction and/or protection device"
        
        LIST OF CODES:
        - 01- Vision correction and/or protection device
        - 70- Exchange of driver's license number, issued by
        - 171- Class C1, also valid for motor vehicles of class D with a maximum permissible mass not exceeding 7,500 kg, but without passengers.
        - 172- Class C, valid also for motor vehicles of class D, but without passengers.
        - 79.03- Only three-wheeled vehicles
        - 79.04- Only vehicle combinations of three-wheeled vehicles and a trailer with a maximum permissible mass not exceeding 750 kg.
        - 79.06- Vehicles (vehicle combination) of category BE, provided that the maximum permissible mass of the trailer exceeds 3,500 kg.
        - 79 (C1E > 12.000 kg, L ≤ 3)- Restriction of class CE due to the authorization resulting from the previous class 3 to drive three-axle trains with a towing vehicle of class C1 and more than 12,000 kg total mass and trains with a towing vehicle of class C1 and trailers without registration, where the total mass can be more than 12,000 kg and three-axle trains consisting of a towing vehicle of class C1 and a trailer, where the maximum permissible mass of the trailer exceeds the unladen mass of the towing vehicle (part not covered by C1E). The aforementioned authorizations do not apply to semitrailers with a total permissible mass of more than 7.5 tons. The letter L in this code stands for the number of axles.
        - 174- Class L, also valid for driving tractors with a maximum speed determined by their design of not more than 40 km/h, also with a single-axle trailer (whereby axles with a distance of less than 1.0 m from each other are considered to be one axle) as well as combinations of these tractors and trailers, if they are driven at a speed of not more than 25 km/h
        - 175- Class L, also valid for driving motor vehicles with a maximum speed determined by their design of not more than 25 km/h and for driving motor vehicles other than those belonging to classes A, A1, A2 and AM with an engine capacity of not more than 50 cm3
        - 181- Class T, only valid for motor vehicles of class S (since 19.1.2013 AM)
        - 197- The test was taken on a motor vehicle with automatic transmission and practical training for driving class B vehicles with manual transmission was completed.

        If a code from the license is NOT in this list, DISCARD IT.

    Return valid JSON containing all keys.
  `;

  parts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
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
            codes: { type: Type.STRING },
            authority: { type: Type.STRING },
            categoriesDates: { type: Type.STRING }
          },
          required: [
            "surname", "firstName", "middleName", "firstNames", "fullName",
            "licenseNumber", "dateOfBirth", "placeOfBirth", "issueDate",
            "expiryDate", "class", "codes", "authority", "categoriesDates"
          ]
        }
      }
    });

    const result = JSON.parse(response.text.trim());
    
    // Fallback normalization & completion
    const surname = (result.surname || "").trim();
    const firstName = (result.firstName || "").trim();
    const middleName = (result.middleName || "").trim();
    const firstNames = (result.firstNames || `${firstName} ${middleName}`).replace(/\s+/g, ' ').trim();
    const fullName = (result.fullName || `${surname} ${firstNames}`).replace(/\s+/g, ' ').trim();

    result.surname = surname;
    result.firstName = firstName;
    result.middleName = middleName;
    result.firstNames = firstNames;
    result.fullName = fullName;
    result.licenseNumber = (result.licenseNumber || "").trim();
    result.dateOfBirth = (result.dateOfBirth || "").trim();
    result.placeOfBirth = (result.placeOfBirth || "").trim();
    result.issueDate = (result.issueDate || "").trim();
    result.expiryDate = (result.expiryDate || "").trim() || "Indefinite";
    result.authority = (result.authority || "").trim();
    result.class = (result.class || "").trim();
    result.categoriesDates = (result.categoriesDates || "").trim();
    result.codes = (result.codes || "").trim();

    return result as ExtractedData;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "The AI could not process the images.");
  }
};
