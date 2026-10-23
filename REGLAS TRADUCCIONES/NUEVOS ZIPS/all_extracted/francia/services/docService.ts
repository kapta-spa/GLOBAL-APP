
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

const LICENSE_DESCRIPTIONS: Record<string, string> = {
  "AM": "AM - 2-wheel, 3-wheel vehicles and light quadricycles with a maximum design speed of not more than 45 km/h.",
  "A1": "A1 - light motorcycles with a cylinder capacity not more than 125 cubic centimetres and a power rating less than 11 kW.",
  "A2": "A2 - motorcycles with a power rating under 35 kW.",
  "A": "A - heavy motorcycles without power restrictions.",
  "B1": "B1 - heavy motorized quadricycle whose empty weight is a maximum of 450 kg if it is intended for the transport of persons, and 600 kg if it is intended for the transport of goods.",
  "B": "B - passenger vehicles weighing up to 3,500 kg and seating not more than eight passengers, in addition to the driver.",
  "BE": "BE - vehicle of category B towing a heavy trailer of under 3,500 kg.",
  "C1": "C1 - goods vehicles between 3,500 kg and 7,500 kg and for up to eight passengers.",
  "C1E": "C1E - vehicle of category C1 or B towing a heavy trailer; with a combined mass of up to 12,000 kg.",
  "C": "C - goods vehicles weighing more than 3,500 kg and seating not more than eight passengers.",
  "CE": "CE - vehicle of category C towing a heavy trailer.",
  "D1": "D1 - vehicles for the transport of not more than 16 passengers, in addition to the driver, and with a maximum length of 8 metres.",
  "D1E": "D1E - vehicle of category D1 towing a heavy trailer.",
  "D": "D - vehicles for the transport of more than 8 passengers.",
  "DE": "DE - vehicle of category D towing a heavy trailer.",
};

const getFilteredDescriptions = (licenseClasses: string): string => {
  if (!licenseClasses) return "";
  
  // Clean classes (e.g. "AM, B1, B" -> ["AM", "B1", "B"])
  const classes = licenseClasses.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  
  const filtered = classes
    .map(cls => {
      // Direct match or partial match (e.g. if the class is "B1(70)" it should match "B1")
      const matchedKey = Object.keys(LICENSE_DESCRIPTIONS).find(k => cls === k || cls.startsWith(k));
      return matchedKey ? LICENSE_DESCRIPTIONS[matchedKey] : null;
    })
    .filter((v, i, a) => v !== null && a.indexOf(v) === i); // Remove nulls and duplicates

  const descriptionsText = filtered.join('\n');
  
  return descriptionsText;
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
      nullGetter() { return ""; }
    });

    const val = (v: any) => (v === undefined || v === null || v === "N/A" || v === "null" ? "" : String(v));

    const authorityVal = val(data.authority);
    const issueDateVal = val(data.issueDate);
    const expiryDateVal = val(data.expiryDate);
    const classVal = val(data.class);
    const classDescVal = getFilteredDescriptions(classVal);
    const conditionsVal = val(data.explicacionCodigos);
    const placeOfBirthCleanVal = cleanPlaceOfBirth(val(data.placeOfBirth));
    const surnameVal = val(data.surname);
    const firstNameVal = val(data.firstName);
    const middleNameVal = val(data.middleName);
    const firstNamesVal = val(data.firstNames || `${firstNameVal} ${middleNameVal}`.trim());
    const fullNameVal = val(data.fullName || `${surnameVal} ${firstNameVal} ${middleNameVal}`.trim());
    const dobVal = val(data.dateOfBirth);
    const licenseNumberVal = val(data.licenseNumber);
    const addressVal = val(data.address);
    const nationalityVal = val(data.nationality);
    const genderVal = val(data.gender);
    const categoriesDatesVal = cleanAndGroupCategoriesDates(val(data.categoriesDates));
    const codesVal = val(data.codes);

    const fullData = {
      ...data,
      assignedNumber: val(data.assignedNumber),
      surname: surnameVal,
      firstName: firstNameVal,
      middleName: middleNameVal,
      firstNames: firstNamesVal,
      fullName: fullNameVal,
      class: classVal,
      classDescriptions: classDescVal,
      licenseDescriptions: classDescVal,
      categoriesDates: categoriesDatesVal,
      codes: codesVal,
      licenseNumber: licenseNumberVal,
      authority: authorityVal,
      placeOfBirth: placeOfBirthCleanVal,
      foto_frente: frontImgBase64,
      foto_reverso: backImgBase64,
      license_front: frontImgBase64,
      license_back: backImgBase64,
      today: formatProfessionalDate(new Date()),
      fechaHoy: formatProfessionalDate(new Date()),

      // Direct template tag mappings with full set of variations for docxtemplater
      "Licence issuing authority and country": authorityVal,
      "Licence issuing authority & country": authorityVal,
      "Licence Issuing Authority and Country": authorityVal,
      "Licence issuing authority": authorityVal,
      "licence_issuing_authority_and_country": authorityVal,
      "licenceIssuingAuthorityAndCountry": authorityVal,

      "Date licence was first obtained": issueDateVal,
      "Date licence first obtained": issueDateVal,
      "Date Licence Was First Obtained": issueDateVal,
      "date_licence_was_first_obtained": issueDateVal,
      "dateLicenceWasFirstObtained": issueDateVal,

      "Date licence card is due to expire": expiryDateVal,
      "Date licence card due to expire": expiryDateVal,
      "Date Licence Card Due to Expire": expiryDateVal,
      "date_licence_card_is_due_to_expire": expiryDateVal,
      "dateLicenceCardIsDueToExpire": expiryDateVal,

      "Licence class/es held": classVal,
      "Licence classes held": classVal,
      "Licence class held": classVal,
      "Licence class/es": classVal,
      "Licence classes": classVal,
      "Licence class": classVal,
      "Licence class/es held ": classVal,
      "licence_class_es_held": classVal,
      "licenceClassesHeld": classVal,

      "Description of licence class/es": classDescVal,
      "Description of licence classes": classDescVal,
      "Description of licence class": classDescVal,
      "description_of_licence_class_es": classDescVal,
      "descriptionOfLicenceClasses": classDescVal,

      "Conditions applying to licence": conditionsVal,
      "Conditions applying to license": conditionsVal,
      "Conditions of licence": conditionsVal,
      "Conditions": conditionsVal,
      "conditions_applying_to_licence": conditionsVal,
      "conditionsApplyingToLicence": conditionsVal,

      "Licence holder’s place of birth": placeOfBirthCleanVal,
      "Licence holder's place of birth": placeOfBirthCleanVal,
      "Licence holder’s place of birth ": placeOfBirthCleanVal,
      "Licence holder's place of birth ": placeOfBirthCleanVal,
      "Licence holder place of birth": placeOfBirthCleanVal,
      "Place of birth": placeOfBirthCleanVal,
      "Place of Birth": placeOfBirthCleanVal,
      "place_of_birth": placeOfBirthCleanVal,
      "placeOfBirth": placeOfBirthCleanVal,

      // Additional fields
      "Surname": surnameVal,
      "First name": firstNameVal,
      "Middle name": middleNameVal,
      "First names": firstNamesVal,
      "Full name": fullNameVal,
      "Licence number": licenseNumberVal,
      "Date of birth": dobVal,
      "Address": addressVal,
      "Nationality": nationalityVal,
      "Gender": genderVal,
      "Categories dates": categoriesDatesVal,
      "Codes": codesVal,
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
