import { GoogleGenAI, Type } from "@google/genai";
import PizZip from "pizzip";
import { ExtractedData } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build'
    }
  }
});

/**
 * Fast client-side image compression for OCR/Extraction.
 * Reduces high-resolution camera photos (10MB+) to ~250KB crisp images,
 * eliminating network upload bottlenecks and speeding up processing by up to 10x.
 */
export const compressImageForOcr = async (file: File, maxDim = 1600): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => {
        const base64String = (e.target?.result as string).split(',')[1];
        resolve(base64String);
      };
      img.src = e.target?.result as string;
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
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("API Key de Gemini no encontrada. Por favor, confígurala en los ajustes.");
  }
  
  // Parallel fast client-side image compression
  const [frontBase64, backBase64] = await Promise.all([
    compressImageForOcr(front),
    compressImageForOcr(back)
  ]);

  const parts: any[] = [
    { inlineData: { data: frontBase64, mimeType: "image/jpeg" } },
    { inlineData: { data: backBase64, mimeType: "image/jpeg" } }
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
    
    CRITICAL: YOU MUST APPLY "REGLAS LATINO" (LATIN AMERICAN & INTERNATIONAL DRIVER'S LICENSE TRANSLATION RULES):
    Applies to Chile, Mexico (all states: CDMX, Estado de México, Jalisco, Nuevo León, Puebla, Veracruz, etc.), Argentina, Uruguay, Colombia, Peru, and other international jurisdictions.
    
    IMPORTANT: ALL TEXT OUTPUT VALUES MUST BE IN ENGLISH EXCEPT FOR PROPER NAMES OF PERSONS.
    
    SPECIFIC EXTRACTION & TRANSLATION RULES:
    1. "surname": Family name(s) / Apellidos. If missing: "-".
    2. "firstName": ONLY the very first given name / Primer nombre. If missing: "-".
    3. "middleName": ALL remaining given names / Segundo y demás nombres. If no second name, output "-".
    4. "firstNames": All given names combined ("firstName" + "middleName").
    5. "fullName": Full name ("surname" + "firstName" + "middleName").
    6. "licenseNumber": Main identification/license number (or Folio, DNI, RUT/RUN, Document No.). If missing: "-".
    7. "curp": National tax or identification ID if present (e.g. CURP, RFC, RUT, DNI, Cédula de Identidad). If not present: "-".
    8. "blood": Blood type / Grupo sanguíneo / RH factor (e.g., "O+", "A-", "O Positive"). If not present: "-".
    9. "barcode": Alpha-numeric code associated with the barcode/QR or document control code. If not present: "-".
    10. "dateOfBirth": Date of birth formatted strictly as "DD Month YYYY" (e.g., "15 March 1988"). If missing: "-".
    11. "placeOfBirth": Place/City/State of birth translated to English (e.g., "Santiago, Chile" or "Jalisco, Mexico"). If not present: "-".
    12. "issueDate": Issue date / Expedición formatted strictly as "DD Month YYYY". If missing: "-".
    13. "expiryDate": Expiration date / Vencimiento / Vigencia formatted strictly as "DD Month YYYY". If the license indicates permanent/indefinite validity (e.g., "Permanente" in Mexico), output "Permanent". If missing: "-".
    14. "authority": Issuing authority translated to English AND append the country name at the end separated by comma (e.g., "Ministry of Transport and Telecommunications, Chile" or "Secretariat of Mobility of Mexico City, Mexico" or "National Road Safety Agency, Argentina").
    15. "class": Extract driving license category/type (e.g., "Class B", "Type A - Automovilista", "B1", "Class A, B"). If missing: "-".
    16. "categoriesDates": Extract category validity periods if present on the back table (e.g., "Class B: 10 Jan 2022 - 10 Jan 2028"). If not present: "-".
    17. "codes": Restriction codes or annotations (e.g., "01 - Corrective lenses", "Automatic transmission", "None"). If not present: "-".
    
    18. "explicacion" (and "explicacionCodigos"):
        - Provide the professional English translation/description of the allowed driving license categories/classes.
        - If the license explicitly details the description on the front or back, translate that text.
        - If the license only shows the category/class letters/code (e.g., "Clase B" in Chile, "Tipo A - Automovilista" in Mexico, "Categoría B1" in Colombia, "Clase B.1" in Argentina, etc.) without description on the card, provide the official technical short description in English according to that country's traffic laws (e.g., "Class B: Motor vehicles with 3 or more wheels designed for the transportation of persons (up to 9 seats) or cargo with a gross vehicle weight up to 3,500 kg...").
        - Include translation for specific restrictions/codes if found.
    
    19. "gender":
        - Extract sex/gender. If indicated on the license (M/F, Masc/Fem, Hombre/Mujer), output "Male" or "Female".
        - If the license DOES NOT indicate gender/sex, output "-" (a single hyphen).
    
    20. "organs":
        - Extract organ donor status. If indicated on the license (e.g., "Donador: Sí", "Donante: No", "Donador de órganos: S"), output "Yes" or "No".
        - If the license DOES NOT indicate organ donation, return "" (empty string) so it is removed.
    
    21. "address":
        - Extract full home/residential address if indicated on the license.
        - If the license DOES NOT indicate an address, return "" (empty string) so it is removed.
    
    22. "nationality":
        - Extract nationality and translate to English (e.g., "Mexican", "Chilean", "Colombian", "Argentine", "French").
        - If the license DOES NOT indicate nationality, return "" (empty string) so it is removed.
    
    GLOBAL RULE FOR EMPTY FIELDS:
    - For "organs", "address", and "nationality": return "" (empty string) when not indicated on the license.
    - For ALL OTHER fields without data: output "-" (single hyphen), NEVER leave them blank or empty!
    
    Return valid JSON.
  `;

  parts.push({ text: prompt });

  const schemaConfig = {
    type: Type.OBJECT,
    properties: {
      surname: { type: Type.STRING },
      firstName: { type: Type.STRING },
      middleName: { type: Type.STRING },
      firstNames: { type: Type.STRING },
      fullName: { type: Type.STRING },
      licenseNumber: { type: Type.STRING },
      curp: { type: Type.STRING },
      blood: { type: Type.STRING },
      gender: { type: Type.STRING },
      organs: { type: Type.STRING },
      address: { type: Type.STRING },
      nationality: { type: Type.STRING },
      barcode: { type: Type.STRING },
      dateOfBirth: { type: Type.STRING },
      placeOfBirth: { type: Type.STRING },
      issueDate: { type: Type.STRING },
      expiryDate: { type: Type.STRING },
      class: { type: Type.STRING },
      codes: { type: Type.STRING },
      authority: { type: Type.STRING },
      categoriesDates: { type: Type.STRING },
      explicacionCodigos: { type: Type.STRING },
      explicacion: { type: Type.STRING },
    }
  };

  const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: parts,
        config: {
          responseMimeType: "application/json",
          responseSchema: schemaConfig,
        }
      });

      const responseText = response.text;
      if (!responseText) throw new Error("No response from AI");
      const parsedResult = JSON.parse(responseText.trim());

      // Normalize and synchronize fields
      if (!parsedResult.fullName || parsedResult.fullName === '-') {
        const partsName = [parsedResult.surname, parsedResult.firstName, parsedResult.middleName]
          .filter(n => n && n !== '-')
          .join(' ');
        parsedResult.fullName = partsName || '-';
      }

      if (!parsedResult.firstNames || parsedResult.firstNames === '-') {
        const partsFirst = [parsedResult.firstName, parsedResult.middleName]
          .filter(n => n && n !== '-')
          .join(' ');
        parsedResult.firstNames = partsFirst || (parsedResult.firstName || '-');
      }

      if (parsedResult.explicacionCodigos && !parsedResult.explicacion) {
        parsedResult.explicacion = parsedResult.explicacionCodigos;
      } else if (parsedResult.explicacion && !parsedResult.explicacionCodigos) {
        parsedResult.explicacionCodigos = parsedResult.explicacion;
      }

      return parsedResult as ExtractedData;
    } catch (error: any) {
      console.warn(`Attempt with model ${modelName} failed:`, error);
      lastError = error;
      // If error is 404 / entity not found, continue to fallback model
      const errMsg = error?.message || String(error);
      if (!errMsg.includes("NOT_FOUND") && !errMsg.includes("404")) {
        // Not a missing model error, break early
        break;
      }
    }
  }

  // Handle and format the final error
  console.error("Gemini Error:", lastError);
  let friendlyMessage = "No se pudieron procesar las imágenes de la licencia.";
  if (lastError) {
    try {
      const parsed = typeof lastError.message === 'string' && lastError.message.startsWith('{')
        ? JSON.parse(lastError.message)
        : null;
      if (parsed?.error?.message) {
        friendlyMessage = parsed.error.message;
      } else if (lastError.message) {
        friendlyMessage = lastError.message;
      }
    } catch {
      friendlyMessage = lastError.message || String(lastError);
    }
  }
  throw new Error(friendlyMessage);
};
