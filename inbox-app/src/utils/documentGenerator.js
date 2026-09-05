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

    const defaultClassDescriptions = (data.classDescriptions && data.classDescriptions.trim() !== '' && data.classDescriptions.trim() !== '-')
      ? data.classDescriptions
      : generateClassDescriptions(data.class || '');

    const defaultCitizen = (data.citizen && data.citizen.trim() !== '' && data.citizen.trim() !== '-')
      ? data.citizen
      : ((data.bsn && data.bsn.trim() !== '' && data.bsn.trim() !== '-') ? data.bsn : '-');

    let defaultCodes = (data.explicacionCodigos && data.explicacionCodigos.trim() !== '' && data.explicacionCodigos.trim() !== '-') 
      ? data.explicacionCodigos.trim() 
      : ((data.codes && data.codes.trim() !== '' && data.codes.trim() !== '-') ? data.codes.trim() : '-');

    if (defaultCodes !== '-' && defaultCitizen !== '-') {
      const cleanCodes = defaultCodes.replace(/[\s\/,-]+/g, '');
      const cleanCit = defaultCitizen.replace(/[\s\/,-]+/g, '');
      if ((cleanCit && (cleanCodes === cleanCit || cleanCodes.includes(cleanCit))) || /^\d{8,}[\s\/,-]*\d*$/.test(defaultCodes.trim())) {
        defaultCodes = '-';
      }
    }

    const defaultEye = (data.eye && data.eye.trim() !== '' && data.eye.trim() !== '-')
      ? data.eye
      : ((data.eyeColor && data.eyeColor.trim() !== '' && data.eyeColor.trim() !== '-') ? data.eyeColor : '-');

    const defaultSex = (data.sex && data.sex.trim() !== '' && data.sex.trim() !== '-')
      ? data.sex
      : ((data.gender && data.gender.trim() !== '' && data.gender.trim() !== '-') ? data.gender : '-');

    const defaultPersonal = (data.personal && data.personal.trim() !== '' && data.personal.trim() !== '-')
      ? data.personal
      : ((data.point4d && data.point4d.trim() !== '' && data.point4d.trim() !== '-') ? data.point4d : '-');

    const assignedNumberVal = (data.assignedNumber && data.assignedNumber.trim() !== '' && data.assignedNumber.trim() !== '-')
      ? data.assignedNumber
      : (assignedNumber || '-');

    const renderData = {
      // Default fallbacks for empty fields
      middleName: '-',
      personal: defaultPersonal,
      point4d: defaultPersonal,
      citizen: defaultCitizen,
      classDescriptions: defaultClassDescriptions,
      class_descriptions: defaultClassDescriptions,
      classDescription: defaultClassDescriptions,
      categoriesDescriptions: defaultClassDescriptions,
      codes: defaultCodes,
      explicacionCodigos: defaultCodes,
      conditions: defaultCodes,
      height: (data.height && data.height.trim() !== '') ? data.height : '-',
      eye: defaultEye,
      eyeColor: defaultEye,
      sex: defaultSex,
      gender: defaultSex,
      address: (data.address && data.address.trim() !== '') ? data.address : '-',
      reference: (data.reference && data.reference.trim() !== '') ? data.reference : '-',
      placeOfBirth: (data.placeOfBirth && data.placeOfBirth.trim() !== '') ? data.placeOfBirth : '-',
      area: "-",
      file: "-",
      issuedDate: data.issueDate || "-",
      categoriesDates: data.categoriesDates || "-",
      gold: "-",
      today: today,
      assignedNumber: assignedNumberVal,
      // User edits from modal take highest priority!
      ...data,
      // System images
      license_front: imagesBase64[0] || "",
      license_back: imagesBase64[1] || "",
    };

    if (!renderData.assignedNumber || renderData.assignedNumber === '-' || renderData.assignedNumber.trim() === '') {
      renderData.assignedNumber = assignedNumberVal;
    }
    if (!renderData.citizen || renderData.citizen.trim() === '') {
      renderData.citizen = defaultCitizen;
    }

    // Convert any remaining empty strings, nulls or undefined values to "-" (excluding system images)
    for (const key of Object.keys(renderData)) {
      if (key !== 'license_front' && key !== 'license_back' && key !== 'foto_frente' && key !== 'foto_reverso') {
        const val = renderData[key];
        if (val === undefined || val === null || val === 'null' || val === 'undefined' || (typeof val === 'string' && val.trim() === '')) {
          renderData[key] = '-';
        }
      }
    }
    
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
