
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
import { ExtractedData } from "../types";

const formatProfessionalDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const VIETNAM_LICENSE_DESCRIPTIONS: Record<string, string> = {
  "A1": "A1 - Two-wheeled motorcycles with a cylinder capacity from 50 cm3 to under 175 cm3.",
  "A2": "A2 - Two-wheeled motorcycles with a cylinder capacity of 175 cm3 or more and class A1 vehicles.",
  "A3": "A3 - Three-wheeled motorbikes, class A1 vehicles and similar vehicles.",
  "A4": "A4 - Tractors with a design load capacity of up to 1,000 kg.",
  "B1": "B1 - Non-commercial passenger cars up to 9 seats, trucks and tractors under 3,500 kg.",
  "B2": "B2 - Passenger cars up to 9 seats, trucks and tractors under 3,500 kg.",
  "C": "C - Goods trucks and tractors with a load capacity of 3,500 kg or more.",
  "D": "D - Passenger vehicles with 10 to 30 seats, including driver seat.",
  "E": "E - Passenger vehicles with more than 30 seats.",
  "FB2": "FB2 - Class B2 vehicles towing a trailer of 750 kg or more.",
  "FC": "FC - Class C vehicles towing a trailer or semi-trailer.",
  "FD": "FD - Class D vehicles towing a trailer.",
  "FE": "FE - Class E vehicles towing a trailer.",
};

const getFilteredDescriptions = (licenseClasses: string): string => {
  if (!licenseClasses) return "";
  
  const classes = licenseClasses.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  
  const filtered = classes
    .map(cls => {
      const matchedKey = Object.keys(VIETNAM_LICENSE_DESCRIPTIONS).find(k => cls === k || cls.startsWith(k));
      return matchedKey ? VIETNAM_LICENSE_DESCRIPTIONS[matchedKey] : null;
    })
    .filter((v, i, a) => v !== null && a.indexOf(v) === i);

  return filtered.join('\n');
};

export const optimizeImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 1000;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        if (ctx) {
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error("Error loading image."));
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const cleanPlaceOfBirth = (val: string): string => {
  if (!val) return "";
  let clean = val.trim();
  
  // Remove starting labels with optional colons (case-insensitive)
  clean = clean.replace(/^(lieu de naissance|place of birth|birthplace|born in|lieu|birth place|de nacimiento)\s*[:\-–—]?\s*/i, "");
  
  // Remove department numbers or postal codes in parentheses like "(37)", "(75014)", etc.
  clean = clean.replace(/\s*\(\s*\d+\s*\)/g, "");
  
  // Remove trailing postal/dep numbers like " 37", " 75" etc at the end if there's a word first
  clean = clean.replace(/\s+\d{2,5}$/g, "");
  
  // Remove "France" or country suffix
  clean = clean.replace(/\s*,\s*France\s*/i, "");
  clean = clean.replace(/\s*,\s*FR\s*/i, "");

  // If there's still a comma or semicolon, keep only the first part before it
  if (clean.includes(',')) {
    clean = clean.split(',')[0];
  }
  if (clean.includes(';')) {
    clean = clean.split(';')[0];
  }
  
  // Double clean trailing or leading spaces or non-word chars like dashes
  clean = clean.trim().replace(/^[\-\–\—\s]+|[\-\–\—\s]+$/g, "");
  
  // Title case it nicely if it's all uppercase (e.g. TOURS -> Tours), but keep acronyms/double-names
  if (clean === clean.toUpperCase()) {
    clean = clean.split(' ')
      .map(word => {
        return word.split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('-');
      })
      .join(' ');
  }
  
  return clean.trim();
};

export const cleanAndGroupCategoriesDates = (raw: string): string => {
  if (!raw) return "";
  let text = raw.trim();
  
  // If the raw string is just a single date (the special case where all have the same date), 
  // e.g., "31 August 2021" or "15 January 2020", without any class prefixes (no ':'),
  // just return it directly.
  if (!text.includes(":")) {
    return text;
  }

  // Parse pairs of (classes, date)
  const dateToClasses: Map<string, Set<string>> = new Map();
  const lines = text.split(/\r?\n/);
  const segments: string[] = [];
  
  for (const line of lines) {
    // Split on comma only when the next part looks like "[ClassCode] :" (with lookahead)
    const matches = line.split(/,(?=\s*[A-Z0-9\s/&]+:)/i);
    for (const match of matches) {
      if (match.trim()) {
        segments.push(match.trim());
      }
    }
  }

  for (const seg of segments) {
    const parts = seg.split(":");
    if (parts.length >= 2) {
      const classPart = parts[0].trim();
      const datePart = parts.slice(1).join(":").trim();
      
      if (classPart && datePart) {
        // Split classes by comma/spaces
        const classes = classPart.split(/[\s,]+/i).map(c => c.trim()).filter(Boolean);
        const dateClean = datePart.trim();
        
        if (!dateToClasses.has(dateClean)) {
          dateToClasses.set(dateClean, new Set());
        }
        const set = dateToClasses.get(dateClean)!;
        for (const cls of classes) {
          set.add(cls);
        }
      }
    }
  }

  if (dateToClasses.size === 0) {
    return text;
  }

  // If ALL categories share the EXACT same date, output ONLY the date
  if (dateToClasses.size === 1) {
    const [onlyDate] = dateToClasses.keys();
    return onlyDate;
  }

  // Otherwise, sort and construct lines
  const resultLines: string[] = [];
  const uniqueDates = Array.from(dateToClasses.keys());
  
  for (const date of uniqueDates) {
    const classesSet = dateToClasses.get(date)!;
    const classesList = Array.from(classesSet);
    const classesStr = classesList.join(", ");
    resultLines.push(`${classesStr}: ${date}`);
  }

  return resultLines.join("\n");
};

export const generateFilledDoc = async (
  template: File,
  data: ExtractedData,
  frontImgBase64: string,
  backImgBase64: string
): Promise<Blob> => {
  try {
    const arrayBuffer = await template.arrayBuffer();
    const zip = new PizZip(new Uint8Array(arrayBuffer));

    const imageOptions = {
      centered: false,
      getImage: (tagValue: string) => {
        const base64 = tagValue.includes(',') ? tagValue.split(',')[1] : tagValue;
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes.buffer;
      },
      getSize: () => [312, 195],
    };

    const ImageModuleClass = ImageModule.default || ImageModule;
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [new ImageModuleClass(imageOptions)],
      delimiters: { start: '{{', end: '}}' },
      nullGetter() { return "-"; }
    });

    const val = (v: any) => (!v || String(v).trim() === "" || v === "N/A" || v === "null" || v === "undefined" ? "-" : String(v));

    const authorityVal = val(data.authority);
    const issueDateVal = val(data.issueDate);
    const expiryDateVal = val(data.expiryDate);
    const classVal = val(data.class);
    const classDescVal = val(data.classDescriptions) || getFilteredDescriptions(classVal) || "-";
    const reverseVal = val(data.reverse);
    const surnameVal = val(data.surname);
    const firstNameVal = val(data.firstName);
    const middleNameVal = val(data.middleName);
    const firstNamesVal = val(data.firstNames || `${firstNameVal} ${middleNameVal}`.trim());
    const fullNameVal = val(data.fullname || data.fullName || `${surnameVal} ${firstNameVal} ${middleNameVal}`.trim());
    const dobVal = val(data.dateOfBirth);
    const licenseNumberVal = val(data.licenseNumber);
    const addressVal = val(data.address);
    const nationalityVal = val(data.nationality);
    const genderVal = val(data.gender);
    const categoriesDatesVal = val(data.categoriesDates);

    const fullData = {
      ...data,
      assignedNumber: data.assignedNumber ? String(data.assignedNumber).trim() : "",
      surname: surnameVal,
      firstName: firstNameVal,
      middleName: middleNameVal,
      firstNames: firstNamesVal,
      fullName: fullNameVal,
      fullname: fullNameVal,
      Fullname: fullNameVal,
      FULLNAME: fullNameVal,
      class: classVal,
      Class: classVal,
      classDescriptions: classDescVal,
      class_descriptions: classDescVal,
      ClassDescriptions: classDescVal,
      licenseDescriptions: classDescVal,
      reverse: reverseVal,
      Reverse: reverseVal,
      REVERSE: reverseVal,
      reverseNumber: reverseVal,
      categoriesDates: categoriesDatesVal,
      CategoriesDates: categoriesDatesVal,
      categories_dates: categoriesDatesVal,
      licenseNumber: licenseNumberVal,
      authority: authorityVal,
      address: addressVal,
      Address: addressVal,
      nationality: nationalityVal,
      Nationality: nationalityVal,
      gender: genderVal,
      Gender: genderVal,
      dateOfBirth: dobVal,
      issueDate: issueDateVal,
      expiryDate: expiryDateVal,
      foto_frente: frontImgBase64,
      foto_reverso: backImgBase64,
      license_front: frontImgBase64,
      license_back: backImgBase64,
      today: formatProfessionalDate(new Date()),
      fechaHoy: formatProfessionalDate(new Date()),

      // Direct template tag mappings with full set of variations for docxtemplater
      "fullname": fullNameVal,
      "fullName": fullNameVal,
      "Full name": fullNameVal,
      "gender": genderVal,
      "Gender": genderVal,
      "reverse": reverseVal,
      "Reverse": reverseVal,
      "nationality": nationalityVal,
      "Nationality": nationalityVal,
      "address": addressVal,
      "Address": addressVal,
      "classDescriptions": classDescVal,
      "ClassDescriptions": classDescVal,
      "Description of licence class/es": classDescVal,
      "categoriesDates": categoriesDatesVal,
      "Categories dates": categoriesDatesVal,
      "Categories Dates": categoriesDatesVal,
      "Licence issuing authority and country": authorityVal,
      "Licence issuing authority": authorityVal,
      "Date licence was first obtained": categoriesDatesVal !== "-" ? categoriesDatesVal : issueDateVal,
      "Date licence card is due to expire": expiryDateVal,
      "Licence class/es held": classVal,
      "Licence number": licenseNumberVal,
      "Date of birth": dobVal,
      "Conditions applying to licence": "-",
      "Conditions applying to license": "-",
      "Conditions": "-",
      "Licence holder’s place of birth": "-",
      "Licence holder's place of birth": "-",
      "Place of birth": "-",
      "Categories dates": "-",
      "Codes": "-",
      "explicacionCodigos": "-",
    };

    doc.render(fullData);
    return doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
    });
  } catch (error: any) {
    throw new Error(error.message || "Error generating Word file.");
  }
};
