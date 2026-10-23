
import { GoogleGenAI, Type } from "@google/genai";
import PizZip from "pizzip";
import { ExtractedData } from "../types";

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
  images: File[],
  reference?: File | null
): Promise<ExtractedData> => {
  // Always create a new GoogleGenAI instance right before making an API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const parts: any[] = [];
  
  for (const img of images) {
    const b64 = await fileToBase64(img);
    parts.push({ inlineData: { data: b64, mimeType: img.type } });
  }

  let referenceInstruction = "";
  if (reference) {
    const referenceText = await extractTextFromDocx(reference);
    if (referenceText) {
      referenceInstruction = `REFERENCE CONTEXT FROM PREVIOUS DOCUMENT: "${referenceText}"`;
    }
  }

  const prompt = `
    Analyze these 4 images of a Chinese Driver's License.
    ${referenceInstruction}
    
    IMPORTANT RULES:
    1. TRANSLATE ALL CHINESE TEXT TO ENGLISH.
    2. ALL DATES must be formatted with the month in English text (e.g., "DD Month YYYY", like "15 January 1990").
    
    SPECIFIC EXTRACTION RULES:
    - "firstIssued": Extract the date indicated as "Date of first issued" (初次领证日期).
    - "issueDate": Extract the FIRST date indicated in the "Valid Period" (有效起始日期).
    - "expiryDate": Extract the SECOND (last) date indicated in the "Valid Period" (有效期限). If the field indicates long term, permanent, or no specific date, use "To Long Term".
    - "explicacionCodigos": Translate the text found in the "Record" (记录) section.
    - "barcodeNumber": Find and extract the number located directly underneath the barcode.
    - "fileNumber": Find the number after "档案编号" (File Number) on the record card.
    - "surname": Family name in Pinyin/English.
    - "firstName": Given names in Pinyin/English.
    - "fullName": Full name in Pinyin/English.
    - "licenseNumber": Citizen ID / License ID.
    - "dateOfBirth": Date of birth.
    - "nationality": English translation.
    - "address": Full address translated to English.
    - "gender": "Male" or "Female".
    - "class": Vehicle class (e.g., C1).
    - "authority": Issuing department translated to English.

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
            fullName: { type: Type.STRING },
            licenseNumber: { type: Type.STRING },
            gender: { type: Type.STRING },
            nationality: { type: Type.STRING },
            address: { type: Type.STRING },
            dateOfBirth: { type: Type.STRING },
            firstIssued: { type: Type.STRING },
            issueDate: { type: Type.STRING },
            expiryDate: { type: Type.STRING },
            class: { type: Type.STRING },
            authority: { type: Type.STRING },
            explicacionCodigos: { type: Type.STRING },
            barcodeNumber: { type: Type.STRING },
            fileNumber: { type: Type.STRING },
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("The AI returned an empty response.");
    }
    const result = JSON.parse(text.trim());
    return result as ExtractedData;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "The AI could not process the Chinese license images.");
  }
};
