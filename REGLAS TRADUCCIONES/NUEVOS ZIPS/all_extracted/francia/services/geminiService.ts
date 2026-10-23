
import { GoogleGenAI, Type } from "@google/genai";
import PizZip from "pizzip";
import { ExtractedData } from "../types";
import { cleanPlaceOfBirth, cleanAndGroupCategoriesDates } from "./docService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  frontBase64: string,
  backBase64: string,
  reference?: File | null
): Promise<ExtractedData> => {
  const cleanFront = frontBase64.includes(',') ? frontBase64.split(',')[1] : frontBase64;
  const cleanBack = backBase64.includes(',') ? backBase64.split(',')[1] : backBase64;
  
  const systemPrompt = `
    You are a professional translator specializing in French Driver's Licenses.
    Your mission is to perform a complete, high-fidelity extraction of data into English from the provided front and back driver's license images. 
    
    CRITICAL INSTRUCTIONS:
    - DO NOT skip any fields. Every property in the requested schema must be filled based on visual evidence.
    - If a field is present, look for it with extreme diligence.
    - All dates must be formatted strictly as: DD Month YYYY (e.g., "12 March 2017" or "15 January 2020"). Never use MM/DD/YYYY or DD.MM.YYYY in the final values.

    Specific Field Extraction Clues:
    - surname: Found at Point 1 on the front. Extract in UPPERCASE.
    - firstName: First word/name from Point 2 on the front.
    - middleName: Any remaining names from Point 2 on the front (return empty if none).
    - firstNames: All names from Point 2 on the front.
    - licenseNumber: Found at Point 5 on the front. Extract the complete number (e.g. 17AA49102).
    - dateOfBirth: First part of Point 3 on the front. Format correctly, e.g., "15 September 1993".
    - placeOfBirth: Second part of Point 3 on the front (labeled "Lieu de naissance" or following the date of birth). Extract ONLY the city/municipal name itself (e.g., "Tours", "Paris", "Lyon"). Translate to English if applicable. Absolutely NO sentences, NO introduction, NO state/department zipcode numbers, and NO country names unless it is part of the name. It must be strictly the city/place name.
    - issueDate: Found at Point 4a on the front. Represents the card issue date.
    - expiryDate: Found at Point 4b on the front. Represents the card expiry date. If there is a dash (—) or "—", return "-".
    - authority: Found at Point 4c on the front. Convert/translate to English (e.g. "Prefecture which issued", "Ministry of Interior", "Préfet de...", "ANTS") and ALWAYS append ", France".
    - address: Labeled as Point 8 on either the front or back. Extract fully.
    - nationality: Extract if visible on the license, e.g. "French".
    - gender: Extract Sexe (M, F).
    - class: Comma-separated list of ONLY the authorized categories (those with a valid date in Column 10 on the back). Do NOT output unauthorized ones.
    - categoriesDates: Column 10 from the back grid. Extract and format the authorized categories. 
      - If ALL authorized categories share the EXACT same first issue date, output ONLY the date (e.g., "15 January 2020") without class prefixes.
      - Otherwise, group classes that have the EXACT same date on the same line, separated by commas (e.g., "B1, B: 31 August 2021"), and separate other classes/different dates with a new line (e.g. "AM: 07 October 2017\nB1, B: 31 August 2021"). Do not put all different dates on the same line.
    - codes: Text codes in the top left area of the back (outside the class grid). Look extremely closely: there are always exactly THREE (3) distinct alphanumeric series/codes here. Two are printed horizontally, and ONE is printed VERTICALLY (usually a longer 12-digit series, e.g., 182302007045). You MUST find all three, including the vertical one, and combine them into a single comma-separated list (e.g. "14091., 30602, 182302007045"). do NOT omit the vertical code.
    - explicacionCodigos: Translate French codes in Column 12 to English. E.g.:
      - 01: Eyesight correction (glasses/contacts)
      - 70: Exchange of license (e.g., 70.06...)
      - 106: National probationary code. If found, format it EXACTLY as follows: "106- Subject to the application of article R. 413-5 during probationary period from [START DATE] to [END DATE] (Speed limits: 110km/h on motorways where the limit is 130km/h; 100km/h on motorways with a lower speed limit and on roads with two separate carriageways separated by a central reservation; 80km/h on other roads.)"
    - code106From/To: The start/end dates specified next to the 106 code, if present.

    Format all dates as: DD Month YYYY.
    OUTPUT ONLY JSON.
  `;

  try {
    console.log("Starting AI Extraction...");
    const resultCall = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { inlineData: { data: cleanFront, mimeType: "image/jpeg" } },
        { inlineData: { data: cleanBack, mimeType: "image/jpeg" } },
        { text: "Extract all license data as requested in your system instructions. Be thorough and complete every single key." }
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            surname: { type: Type.STRING, description: "Point 1: Surname in UPPERCASE" },
            firstName: { type: Type.STRING, description: "Point 2: First Name ONLY" },
            middleName: { type: Type.STRING, description: "Point 2: Middle names (remaining names, empty if none)" },
            firstNames: { type: Type.STRING, description: "Point 2: All first names" },
            licenseNumber: { type: Type.STRING, description: "Point 5: License number" },
            dateOfBirth: { type: Type.STRING, description: "Point 3: Date of birth (DD Month YYYY, e.g. 15 September 1993)" },
            placeOfBirth: { type: Type.STRING, description: "Point 3: Place of birth city name only, e.g. 'Paris' or 'Tours'. No extra text or departement numbers." },
            issueDate: { type: Type.STRING, description: "Point 4a: Card issue date (DD Month YYYY)" },
            expiryDate: { type: Type.STRING, description: "Point 4b: Card expiry date (DD Month YYYY or '-')" },
            authority: { type: Type.STRING, description: "Point 4c: Issuing authority in English with ', France' appended" },
            address: { type: Type.STRING, description: "Point 8: Full address if visible" },
            nationality: { type: Type.STRING, description: "Nationality of the holder if visible" },
            gender: { type: Type.STRING, description: "Gender (Sexe) if visible" },
            class: { type: Type.STRING, description: "Point 9: Comma-separated list of authorized category classes from column 10, e.g. 'AM, B'" },
            categoriesDates: { type: Type.STRING, description: "Extract and group authorized categories by dates. Classes with the exact same date should be on the same line (e.g., 'B1, B: 31 August 2021'). Differing dates must be placed on separate lines (e.g., 'AM: 07 October 2017\\nB1, B: 31 August 2021'). If all classes have the same date, output ONLY the date string (e.g. '15 January 2020') without prefixes." },
            codes: { type: Type.STRING, description: "Extract all THREE series/codes found at the top left of the back. This MUST include the two horizontal codes and the ONE vertical code (e.g. '14091., 30602, 182302007045'). Format them as a single comma-separated list." },
            explicacionCodigos: { type: Type.STRING, description: "Column 12: Code explanations in English. Translate 01, 70, or 106 as per prompt" },
            code106From: { type: Type.STRING, description: "Code 106 probationary period start date (DD Month YYYY) if present" },
            code106To: { type: Type.STRING, description: "Code 106 probationary period end date (DD Month YYYY) if present" },
          },
          required: [
            "surname", 
            "firstName", 
            "licenseNumber"
          ]
        }
      }
    });

    console.log("AI Extraction complete.");
    const textResponse = resultCall.text;
    if (!textResponse) {
      throw new Error("Empty response from AI");
    }

    const result = JSON.parse(textResponse.trim());
    if (result.placeOfBirth) {
      result.placeOfBirth = cleanPlaceOfBirth(result.placeOfBirth);
    }
    if (result.categoriesDates) {
      result.categoriesDates = cleanAndGroupCategoriesDates(result.categoriesDates);
    }
    return {
      ...result,
      fullName: `${result.surname || ''} ${result.firstName || ''} ${result.middleName || ''}`.trim()
    } as ExtractedData;
  } catch (error: any) {
    console.error("Extraction Error:", error);
    throw new Error("AI data error. Please use clearer photos.");
  }
};
