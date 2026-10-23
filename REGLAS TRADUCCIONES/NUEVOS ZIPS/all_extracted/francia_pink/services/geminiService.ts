import { GoogleGenAI, Type } from "@google/genai";
import PizZip from "pizzip";
import { ExtractedData } from "../types";

let genAIInstance: GoogleGenAI | null = null;
const getAI = (): GoogleGenAI => {
  if (!genAIInstance) {
    const key = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!key) {
      throw new Error("API Key de Gemini no configurada. Por favor revisa las variables de entorno.");
    }
    genAIInstance = new GoogleGenAI({ apiKey: key });
  }
  return genAIInstance;
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

const responseSchema = {
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
  }
};

export const extractDataFromLicense = async (
  frontB64: string,
  backB64: string,
  reference?: File | null
): Promise<ExtractedData> => {
  const ai = getAI();
  
  // Limpiar el prefijo data:image/...;base64, si existe
  const cleanFront = frontB64.includes(',') ? frontB64.split(',')[1] : frontB64;
  const cleanBack = backB64.includes(',') ? backB64.split(',')[1] : backB64;

  const parts: any[] = [
    { inlineData: { data: cleanFront, mimeType: "image/jpeg" } },
    { inlineData: { data: cleanBack, mimeType: "image/jpeg" } }
  ];

  let referenceInstruction = "";
  if (reference) {
    const referenceText = await extractTextFromDocx(reference);
    if (referenceText) {
      referenceInstruction = `CONTEXTO DE REFERENCIA (Úsalo para guiar la extracción): "${referenceText}"`;
    }
  }

  const prompt = `
    Analyze the provided images of a French Driver's License (Front and Back).
    ${referenceInstruction}
    
    CORE REQUIREMENT: TRANSLATE SPECIFIC FIELDS TO ENGLISH AS DIRECTED BELOW.
    
    FIELDS TO EXTRACT:
    1.  "surname": Family name (e.g., MARTIN).
    2.  "firstName": The FIRST given name ONLY (e.g., if "JEAN PIERRE", extract "JEAN").
    3.  "middleName": ALL other given names after the first one (e.g., "PIERRE"). Empty if none.
    4.  "firstNames": All given names exactly as they appear.
    5.  "fullName": Formal full name (Surname + first names).
    6.  "licenseNumber": Unique document number (Point 5). Alphanumeric only.
    7.  "dateOfBirth": Date in Point 3. Format: "DD Month YYYY" (e.g., 14 July 1985).
    8.  "placeOfBirth": Location in Point 3. ***TRANSLATE TO ENGLISH*** (e.g., "PARIS (75)" remains "PARIS (75)", but "FRANCE" remains "FRANCE").
    9.  "issueDate": Date in Point 4a. Format: "DD Month YYYY".
    10. "expiryDate": Date in Point 4b. Format: "DD Month YYYY".
    11. "authority": Point 4c. ***TRANSLATE TO ENGLISH*** and append "FRANCE" at the end. Example: "PREFECTURE DE POLICE" -> "POLICE HEADQUARTERS, FRANCE".
    12. "class": List all ALLOWED / PERMITTED categories, separated by commas (e.g., "B" or "A1, B").
        HOW TO DETERMINE ALLOWED CATEGORIES ON FRENCH PINK LICENSES:
        - Traditional 3-panel pink paper licenses (permis rose à 3 volets):
          Check the categories table (A1, A, B, B1, C, D, E(B), etc.). A category is ONLY ALLOWED if it has:
          a) An official round or oval prefecture stamp (cachet/tampon de préfecture) stamped in the box to the right, OR
          b) A stamped or handwritten issue/validation date, OR
          c) The word "Permanent", "A titre permanent", or "Valide" stamped/written next to it.
          * Categories without stamps or dates, or marked with a diagonal cancellation slash/line, are NOT permitted.
        - Credit card format (plastic card):
          Check Point 9 on front or the table on the back with valid dates in columns 10/11.
    13. "classDescriptions": TRANSLATE TO ENGLISH the descriptions of all ALLOWED categories identified above.
        Provide the formal vehicle authorization details for each permitted category, noting if it is marked as Permanent or has a validation date.
        Use standard UK/English official definitions:
        - Category AM: Mopeds and light quadricycles (up to 50cc or 4 kW).
        - Category A1: Light motorcycles not exceeding 125 cc and 11 kW.
        - Category A2: Motorcycles with power not exceeding 35 kW.
        - Category A: All motorcycles with or without sidecar.
        - Category B1: Heavy motor tricycles and quadricycles.
        - Category B: Motor vehicles with maximum authorized mass not exceeding 3,500 kg and no more than 8 passenger seats (Permanent validity).
        - Category BE / E(B): Category B vehicle coupled with a trailer over 750 kg up to 3,500 kg.
        - Category C1: Goods vehicles between 3,500 kg and 7,500 kg.
        - Category C: Heavy goods vehicles exceeding 3,500 kg.
        - Category CE: Heavy goods vehicle with a trailer over 750 kg.
        - Category D1: Passenger transport vehicles with 9 to 16 passenger seats.
        - Category D: Passenger transport vehicles (buses) with more than 8 passenger seats.
        Format "classDescriptions" clearly with each allowed category on its own line.
    14. "categoriesDates": Back table or category section. List the earliest start date found for each major category if multiple exists.
    15. "codes": Top left of BACK side (or series notation on pink license). Usually 3 sets of numbers/letters.
    16. "explicacionCodigos": Locate Column 12 on BACK (or restrictive codes). Translate found codes to these specific English blocks:
        - If "70": "70. Exchange of driver's license number [extract it]"
        - If "01": "01- Vision correction and/or protection"
        - If "01.06": "01.06- Prescribed spectacles or contact lenses"
        - If "106": "106- Subject to the application of article R. 413-5 during probationary period from [DateFrom] to [DateTo]"
        
    FORMATTING & MISSING DATA RULES:
    - If ANY field has no data, is not present, not found, or not applicable, DO NOT output "null", "None", or "N/A". ALWAYS output a single hyphen "-" as its value.
    - All dates MUST be "DD Month YYYY". If a date cannot be determined, use "-".
    - OUTPUT MUST BE VALID JSON matching the schema.
  `;

  parts.push({ text: prompt });

  // Modelos a probar en orden: gemini-2.5-flash (muy estable con imágenes) -> gemini-3-flash-preview -> gemini-2.5-pro
  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-pro'
  ];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`Intentando extracción con modelo: ${modelName}...`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error(`El modelo ${modelName} no devolvió texto.`);
      }

      const result = JSON.parse(text.trim());
      
      // Sanitizar todos los campos: si no tiene dato o es null/vacio/N/A, colocar "-"
      for (const key of Object.keys(result)) {
        const val = result[key];
        if (
          val === null ||
          val === undefined ||
          (typeof val === 'string' && (
            val.trim() === '' ||
            val.trim().toLowerCase() === 'null' ||
            val.trim().toLowerCase() === 'n/a' ||
            val.trim().toLowerCase() === 'none'
          ))
        ) {
          result[key] = '-';
        } else if (typeof val === 'string') {
          result[key] = val.trim();
        }
      }

      if (!result.fullName || result.fullName === '-') {
        const nameParts = [result.surname, result.firstName, result.middleName].filter(n => n && n !== '-');
        result.fullName = nameParts.length > 0 ? nameParts.join(' ') : '-';
      }
      return result as ExtractedData;
    } catch (err: any) {
      console.warn(`Fallo con el modelo ${modelName}:`, err);
      lastError = err;
      // Continuar al siguiente modelo en la lista de respaldo
    }
  }

  // Si todos los modelos fallaron:
  let friendlyMessage = "Error en el servicio de IA de Google al procesar las imágenes.";
  if (lastError?.message) {
    try {
      const parsed = JSON.parse(lastError.message);
      if (parsed?.error?.message) {
        friendlyMessage = `Google AI Error (500): ${parsed.error.message}. Por favor intenta de nuevo en unos segundos.`;
      } else {
        friendlyMessage = lastError.message;
      }
    } catch {
      friendlyMessage = lastError.message;
    }
  }

  throw new Error(friendlyMessage);
};
