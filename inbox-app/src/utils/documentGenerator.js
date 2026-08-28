import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { saveAs } from "file-saver";
import ImageModule from "docxtemplater-image-module-free";
import { generateClassDescriptions, formatCategoriesDates } from "./classDescriptions";

function base64DataURLToArrayBuffer(dataURL) {
  if (!dataURL || !dataURL.includes(',')) return new ArrayBuffer(0);
  const base64 = dataURL.split(',')[1];
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export const getAssignedNumber = (folderName, docIndex = 0) => {
    let assignedNumber = "";
    if (folderName) {
      const match = folderName.match(/^([a-zA-Z0-9]+(?:,\s*[a-zA-Z0-9]+)*)/);
      if (match) {
        const parts = match[1].split(',').map(s => s.trim());
        let part = parts[docIndex] || parts[0];
        if (docIndex > 0 && part && /^\d+$/.test(part) && /^[a-zA-Z]+/.test(parts[0])) {
           const prefix = parts[0].match(/^[a-zA-Z]+/)[0];
           part = prefix + part;
        }
        assignedNumber = part.replace(/[^a-zA-Z0-9]/g, '');
      } else {
        assignedNumber = folderName.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
      }
    }
    return assignedNumber;
};

export const generateWordDocument = async (templateArrayBuffer, data, imagesBase64, folderName, docIndex = 0) => {
  const zip = new PizZip(templateArrayBuffer);
  
  const imageOptions = {
    centered: false,
    getImage(tagValue, tagName) {
      if (!tagValue) return new ArrayBuffer(0);
      return base64DataURLToArrayBuffer(tagValue);
    },
    getSize(img, tagValue, tagName) {
      // Standard dimensions for driver's licenses to fit well on A4 (reduced 20%: 450x300 -> 360x240)
      return [360, 240]; 
    }
  };
  
  const imageModule = new ImageModule(imageOptions);

  const assignedNumber = getAssignedNumber(folderName, docIndex);

  let doc;
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [imageModule],
      nullGetter(part) {
        return "";
      },
      delimiters: {
        start: '{{',
        end: '}}'
      }
    });
    
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const classDescriptionsVal = (data.classDescriptions && data.classDescriptions.trim() !== '-' && data.classDescriptions.trim() !== '')
      ? data.classDescriptions
      : generateClassDescriptions(data.class || '');

    const codesVal = (data.codes && data.codes.trim() !== '' && data.codes.trim() !== '-') 
      ? data.codes 
      : ((data.explicacionCodigos && data.explicacionCodigos.trim() !== '' && data.explicacionCodigos.trim() !== '-') ? data.explicacionCodigos : '-');

    const personalVal = (data.personal && data.personal.trim() !== '' && data.personal.trim() !== '-') 
      ? data.personal 
      : ((data.point4d && data.point4d.trim() !== '' && data.point4d.trim() !== '-') ? data.point4d : '-');

    const middleNameVal = (data.middleName && data.middleName.trim() !== '' && data.middleName.trim() !== '""')
      ? data.middleName
      : '-';

    const categoriesDatesVal = formatCategoriesDates(data.categoriesDates || '');

    const renderData = {
      ...data,
      middleName: middleNameVal,
      personal: personalVal,
      point4d: personalVal,
      classDescriptions: classDescriptionsVal,
      class_descriptions: classDescriptionsVal,
      classDescription: classDescriptionsVal,
      categoriesDescriptions: classDescriptionsVal,
      codes: codesVal,
      explicacionCodigos: codesVal,
      conditions: (data.conditions && data.conditions.trim() !== '') ? data.conditions : codesVal,
      area: data.area || "-",
      file: data.file || "-",
      issuedDate: data.issuedDate || data.issueDate || "-",
      categoriesDates: categoriesDatesVal,
      gold: data.gold !== undefined ? data.gold : "-",
      today: today,
      assignedNumber: assignedNumber,
      license_front: imagesBase64[0] || "",
      license_back: imagesBase64[1] || "",
    };
    
    doc.render(renderData);
  } catch (error) {
    let errorMessage = error.message;
    if (error.properties) {
      if (error.properties.errors instanceof Array) {
        errorMessage = error.properties.errors.map(e => e.properties.explanation || e.message).join("\n");
      } else if (error.properties.explanation) {
        errorMessage = error.properties.explanation;
      }
    }
    console.error("Docxtemplater Error:", error);
    throw new Error(`Error en la plantilla Word:\n${errorMessage}`);
  }

  const out = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  return out;
};
