
import { GoogleGenAI, Type } from "@google/genai";
import PizZip from "pizzip";
import { ExtractedData } from "../types";

let genAI: GoogleGenAI | null = null;
const getAI = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no encontrada. Configúrala en los Ajustes.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
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
    const zip = new PizZip(new Uint8Array(arrayBuffer));
    const docXml = zip.file("word/document.xml")?.asText();
    if (!docXml) return "";
    return docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch (e) {
    console.error("Error reading reference Word:", e);
    return "";
  }
};

const formatAuthority = (authStr?: string): string => {
  if (!authStr) return "State Traffic Department, Brazil";
  let cleaned = authStr.trim();

  const stateMap: Record<string, string> = {
    AC: "Acre",
    AL: "Alagoas",
    AP: "Amapá",
    AM: "Amazonas",
    BA: "Bahia",
    CE: "Ceará",
    DF: "Federal District",
    ES: "Espírito Santo",
    GO: "Goiás",
    MA: "Maranhão",
    MT: "Mato Grosso",
    MS: "Mato Grosso do Sul",
    MG: "Minas Gerais",
    PA: "Pará",
    PB: "Paraíba",
    PR: "Paraná",
    PE: "Pernambuco",
    PI: "Piauí",
    RJ: "Rio de Janeiro",
    RN: "Rio Grande do Norte",
    RS: "Rio Grande do Sul",
    RO: "Rondônia",
    RR: "Roraima",
    SC: "Santa Catarina",
    SP: "São Paulo",
    SE: "Sergipe",
    TO: "Tocantins"
  };

  // If authority contains DETRAN (Departamento Estadual de Trânsito)
  if (/detran/i.test(cleaned)) {
    const match = cleaned.match(/detran[\s\/\-_:]*([a-z]{2})/i);
    if (match && match[1]) {
      const uf = match[1].toUpperCase();
      const stateName = stateMap[uf] || uf;
      return `State Traffic Department, ${stateName}, Brazil`;
    } else {
      let foundState = "";
      for (const [uf, name] of Object.entries(stateMap)) {
        if (new RegExp(`\\b(${name}|${uf})\\b`, "i").test(cleaned)) {
          foundState = name;
          break;
        }
      }
      if (foundState) {
        return `State Traffic Department, ${foundState}, Brazil`;
      }
      return `State Traffic Department, Brazil`;
    }
  }

  // If it doesn't end with Brazil, append it
  if (!/brazil/i.test(cleaned)) {
    cleaned = `${cleaned.replace(/,\s*$/, '')}, Brazil`;
  }

  return cleaned;
};

export const extractDataFromLicense = async (
  front: File,
  back: File,
  reference?: File | null
): Promise<ExtractedData> => {
  const frontBase64 = await fileToBase64(front);
  const backBase64 = await fileToBase64(back);
  const ai = getAI();
  
  const parts: any[] = [
    { inlineData: { data: frontBase64, mimeType: front.type } },
    { inlineData: { data: backBase64, mimeType: back.type } }
  ];

  let referenceInstruction = "";
  if (reference) {
    const referenceText = await extractTextFromDocx(reference);
    if (referenceText) {
      referenceInstruction = `REFERENCE CONTEXT FROM PREVIOUS DOCUMENT (Use this to understand formatting preferences): "${referenceText}"`;
    }
  }

  const prompt = `
    Analyze these two images (Front and Back of a Brazilian driver's license - CNH).
    ${referenceInstruction}
    
    IMPORTANT: ALL TEXT OUTPUT VALUES MUST BE IN ENGLISH.
    
    EXTRACT DATA RULES:
    1. "surname": Family name.
    2. "firstName": ONLY the very first name.
    3. "middleName": Remaining names.
    4. "licenseNumber": The main identification number (Nº Registro).
    5. "cardNumber": The vertical number on the left side (Nº Espelho/Serial).
    6. "idDocument": Section 4c (Doc. Identidade).
    7. "cpf": Section 4d (CPF).
    8. "parents": Section "Filiação" (Names of mother/father).
    9. "dateOfBirth": Date of birth.
    10. "firstObtained": "1ª Habilitação".
    11. "conditions": SECTION 12 (Observações). Translate codes or leave as detected if specific.
    12. "placeOfBirth": Location of birth (English translation if applicable).
    13. "issueDate": Date of issuance.
    14. "expiryDate": Date of expiration.
    15. "authority": Issuing authority. Translate it to English and ALWAYS append the country at the end (", Brazil"). If DETRAN is present, translate it as "State Traffic Department, <State Name>, Brazil". Example: "DETRAN RJ" -> "State Traffic Department, Rio de Janeiro, Brazil" or "DETRAN SP" -> "State Traffic Department, São Paulo, Brazil".
    16. "class": Vehicle categories (A, B, C...).
    17. "address": Try to find the address if present, or "Not provided".
    18. "nationality": "Brazilian" (usually).
    19. "gender": Detemine gender if possible, or "M/F".
    
    Format all dates as "DD Month YYYY" (e.g., 15 July 1985).
    Return valid JSON matching the schema provided.
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
            cardNumber: { type: Type.STRING },
            idDocument: { type: Type.STRING },
            cpf: { type: Type.STRING },
            parents: { type: Type.STRING },
            dateOfBirth: { type: Type.STRING },
            firstObtained: { type: Type.STRING },
            placeOfBirth: { type: Type.STRING },
            issueDate: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            class: { type: Type.STRING },
            codes: { type: Type.STRING },
            authority: { type: Type.STRING },
            categoriesDates: { type: Type.STRING },
            conditions: { type: Type.STRING },
            explicacionCodigos: { type: Type.STRING },
            address: { type: Type.STRING },
            nationality: { type: Type.STRING },
            gender: { type: Type.STRING },
          }
        }
      }
    });

    const text = response.text || "";
    // Clean JSON string just in case markdown blocks are present
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleanJson);

    if (!result.fullName) {
      result.fullName = `${result.surname || ''} ${result.firstName || ''} ${result.middleName || ''}`.trim();
    }
    if (!result.firstNames) {
      result.firstNames = `${result.firstName || ''} ${result.middleName || ''}`.trim();
    }
    if (result.authority) {
      result.authority = formatAuthority(result.authority);
    }
    
    return result as ExtractedData;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "La IA no pudo procesar las imágenes.");
  }
};
