
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
    You are a professional translator and OCR specialist for Vietnam Driver's Licenses (Giấy phép lái xe / DRIVING LICENCE).
    Your mission is to perform a complete, high-fidelity extraction of data into English from the provided front and back Vietnam driver's license images. 
    
    CRITICAL INSTRUCTIONS:
    - DO NOT skip any fields. Every property in the requested schema must be filled based on visual evidence.
    - All dates must be formatted strictly as: DD Month YYYY (e.g., "15 March 1988" or "20 May 2025"). Never use MM/DD/YYYY or DD.MM.YYYY in the final values.

    Specific Field Extraction Clues for Vietnam Driver's License:
    - fullName / fullname: "Họ tên / Full name" on front. Extract in full (e.g., "NGUYỄN VĂN A" or "Nguyen Van A").
    - gender: "Giới tính / Sex" on front. Output strictly "Male" or "Female" (Translate "Nam" -> "Male", "Nữ" -> "Female").
    - reverse: Serial / control code / number printed on the REVERSE (back) of the license card (e.g. "AV934767" or "Số phôi"). Look closely at the back of the card for red/black serial numbers.
    - nationality: "Quốc tịch / Nationality" on front. Translate to English (e.g. "Vietnamese" or "Vietnam").
    - address: "Nơi cư trú / Place of residence" on front. Extract full residence address translated to English / romanized text without diacritics.
    - licenseNumber: "Số / No." on front. Extract the license number (e.g., 790184018293).
    - class: "Hạng / Class" on front (e.g. "A1", "B2", "C", "D").
    - dateOfBirth: "Ngày sinh / Date of birth" on front. Format as DD Month YYYY.
    - issueDate: Issue date on front ("Ngày... tháng... năm..."). Format as DD Month YYYY.
    - expiryDate: Expiry date on front ("Giá trị đến / Expires"). Format as DD Month YYYY or "Unlimited" (if "Không thời hạn").
    - authority: Issuing authority on front/back (e.g., "SỞ GIAO THÔNG VẬN TẢI..." -> "Department of Transportation of...").
    - classDescriptions: Description printed on the REVERSE (back) of the license under "CLASSIFICATION OF MOTOR VEHICLES" / "Các loại xe cơ giới được điều khiển" corresponding to the holder's class (e.g. "A1 - Two-wheeled motorcycles with cylinder capacity from 50 cm3 to under 175 cm3"). Translate the vehicle classification text into clear English.
    - categoriesDates: Date printed on the REVERSE (back) of the license where it says "beginning date" / "Trúng tuyển ngày" / "Ngày trúng tuyển" / "Date of passing exam". Format as DD Month YYYY (e.g. "12 May 2018"). If not present, return "-".

    Format all dates as: DD Month YYYY.
    OUTPUT ONLY JSON.
  `;

  try {
    console.log("Starting AI Extraction for Vietnam Driver's License...");
    const resultCall = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        { inlineData: { data: cleanFront, mimeType: "image/jpeg" } },
        { inlineData: { data: cleanBack, mimeType: "image/jpeg" } },
        { text: "Extract all Vietnam driver's license data as requested in your system instructions. Be thorough and complete every single key." }
      ],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullName: { type: Type.STRING, description: "Full Name on front ('Họ tên / Full name')" },
            gender: { type: Type.STRING, description: "Gender strictly 'Male' or 'Female'" },
            reverse: { type: Type.STRING, description: "Serial number from the reverse (back) of the license, e.g. 'AV934767'" },
            nationality: { type: Type.STRING, description: "Nationality translated to English (e.g. 'Vietnamese')" },
            address: { type: Type.STRING, description: "Full address / Place of residence in English" },
            licenseNumber: { type: Type.STRING, description: "License Number ('Số / No.')" },
            dateOfBirth: { type: Type.STRING, description: "Date of Birth ('Ngày sinh') in DD Month YYYY format" },
            issueDate: { type: Type.STRING, description: "Issue Date in DD Month YYYY format" },
            expiryDate: { type: Type.STRING, description: "Expiry Date ('Giá trị đến') in DD Month YYYY format or 'Unlimited'" },
            class: { type: Type.STRING, description: "License Class ('Hạng'), e.g. 'A1', 'B2', 'C'" },
            classDescriptions: { type: Type.STRING, description: "Description from back of license under CLASSIFICATION OF MOTOR VEHICLES" },
            categoriesDates: { type: Type.STRING, description: "Beginning date / Date of passing exam on reverse ('Trúng tuyển ngày' / 'beginning date') in DD Month YYYY format" },
            authority: { type: Type.STRING, description: "Issuing Authority in English" },
          },
          required: [
            "fullName", 
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
    const fn = result.fullName || `${result.surname || ''} ${result.firstName || ''}`.trim();
    return {
      ...result,
      fullName: fn,
      fullname: fn,
    } as ExtractedData;
  } catch (error: any) {
    console.error("Extraction Error:", error);
    throw new Error("AI data error. Please use clearer photos.");
  }
};
