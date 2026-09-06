import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { saveAs } from "file-saver";
import ImageModule from "docxtemplater-image-module-free";
import { generateClassDescriptions, formatCategoriesDates } from "./classDescriptions";

function getImageDimensionsFromBuffer(buffer) {
  if (!buffer || buffer.byteLength < 8) return null;
  const view = new DataView(buffer);
  
  // PNG: 0x89504E47
  if (view.getUint32(0) === 0x89504E47) {
    if (buffer.byteLength >= 24) {
      const width = view.getUint32(16, false);
      const height = view.getUint32(20, false);
      return { width, height };
    }
  }
  
  // JPEG: 0xFFD8
  if (view.getUint16(0) === 0xFFD8) {
    let offset = 2;
    const len = buffer.byteLength;
    while (offset < len) {
      if (view.getUint8(offset) !== 0xFF) {
        offset++;
        continue;
      }
      const marker = view.getUint8(offset + 1);
      if (
        (marker >= 0xC0 && marker <= 0xC3) ||
        (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) ||
        (marker >= 0xCD && marker <= 0xCF)
      ) {
        if (offset + 9 <= len) {
          const height = view.getUint16(offset + 5, false);
          const width = view.getUint16(offset + 7, false);
          return { width, height };
        }
        break;
      } else if (marker === 0xD9 || marker === 0xDA) {
        break;
      } else {
        if (offset + 3 < len) {
          const segmentLength = view.getUint16(offset + 2, false);
          offset += 2 + segmentLength;
        } else {
          break;
        }
      }
    }
  }
  return null;
}

function base64DataURLToArrayBuffer(dataURL) {
  if (!dataURL) return new ArrayBuffer(0);
  const cleanUrl = typeof dataURL === 'string' ? dataURL.split('|')[0] : dataURL;
  if (!cleanUrl.includes(',')) return new ArrayBuffer(0);
  const base64 = cleanUrl.split(',')[1];
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
      const maxWidth = 360;
      const maxHeight = 240;
      
      let origWidth = 0;
      let origHeight = 0;

      if (typeof tagValue === 'string' && tagValue.includes('|')) {
        const parts = tagValue.split('|');
        origWidth = parseFloat(parts[1]) || 0;
        origHeight = parseFloat(parts[2]) || 0;
      }

      if (!origWidth || !origHeight) {
        const dims = getImageDimensionsFromBuffer(img);
        if (dims) {
          origWidth = dims.width;
          origHeight = dims.height;
        }
      }

      if (origWidth > 0 && origHeight > 0) {
        const ratio = Math.min(maxWidth / origWidth, maxHeight / origHeight);
        return [Math.round(origWidth * ratio), Math.round(origHeight * ratio)];
      }

      // Default fallback if dimensions cannot be calculated
      return [maxWidth, maxHeight]; 
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
      : ((data.conditions && data.conditions.trim() !== '' && data.conditions.trim() !== '-')
        ? data.conditions.trim()
        : ((data.codes && data.codes.trim() !== '' && data.codes.trim() !== '-') ? data.codes.trim() : '-'));

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
      : ((data.point4d && data.point4d.trim() !== '' && data.point4d.trim() !== '-') ? data.point4d : (data.cpf || '-'));

    const assignedNumberVal = (data.assignedNumber && data.assignedNumber.trim() !== '' && data.assignedNumber.trim() !== '-')
      ? data.assignedNumber.trim()
      : ((data.reference && data.reference.trim() !== '' && data.reference.trim() !== '-') ? data.reference.trim() : (assignedNumber || '-'));

    const firstObtainedVal = (data.firstObtained && data.firstObtained.trim() !== '' && data.firstObtained !== '-')
      ? data.firstObtained.trim()
      : ((data.categoriesDates && data.categoriesDates.trim() !== '' && data.categoriesDates !== '-') ? data.categoriesDates.trim() : '-');

    const cardNumVal = (data.cardNumber && data.cardNumber.trim() !== '' && data.cardNumber !== '-') ? data.cardNumber.trim() : '';
    const idDocVal = (data.idDocument && data.idDocument.trim() !== '' && data.idDocument !== '-') ? data.idDocument.trim() : '';
    const cpfVal = (data.cpf && data.cpf.trim() !== '' && data.cpf !== '-') ? data.cpf.trim() : '';
    const parentsVal = (data.parents && data.parents.trim() !== '' && data.parents !== '-') ? data.parents.trim() : '';

    const relevantLines = [];
    if (cardNumVal) relevantLines.push(`Card Number: ${cardNumVal}`);
    if (idDocVal) relevantLines.push(`ID Document: ${idDocVal}`);
    if (cpfVal) relevantLines.push(`Individual Taxpayer Number: ${cpfVal}`);
    if (parentsVal) relevantLines.push(`Name of Parents:${parentsVal}`);
    const detailsVal = relevantLines.length > 0 ? relevantLines.join('\n') : '-';

    const middleNameVal = (data.middleName && data.middleName !== '-' && data.middleName.trim() !== '""') ? data.middleName.trim() : '';

    const renderData = {
      // Default fallbacks for empty fields
      middleName: middleNameVal,
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
      reference: assignedNumberVal,
      placeOfBirth: (data.placeOfBirth && data.placeOfBirth.trim() !== '') ? data.placeOfBirth : '-',
      area: "-",
      file: "-",
      issuedDate: data.issueDate || "-",
      categoriesDates: firstObtainedVal,
      firstObtained: firstObtainedVal,
      dateFirstObtained: firstObtainedVal,
      firstIssued: firstObtainedVal,
      gold: "-",
      today: today,
      fechaHoy: today,
      assignedNumber: assignedNumberVal,
      refNumber: assignedNumberVal,
      translationReferenceNumber: assignedNumberVal,
      // Brazilian fields & aliases
      cardNumber: cardNumVal || '-',
      idDocument: idDocVal || '-',
      cpf: cpfVal || '-',
      individualTaxpayerNumber: cpfVal || '-',
      parents: parentsVal || '-',
      nameOfParents: parentsVal || '-',
      filiação: parentsVal || '-',
      filiacao: parentsVal || '-',
      nationality: (data.nationality && data.nationality.trim() !== '') ? data.nationality : 'Brazilian',
      relevantDetails: detailsVal,
      otherDetails: detailsVal,
      details: detailsVal,
      anyOtherRelevantLicenceDetails: detailsVal,
      language: data.language || 'Portuguese',
      documentType: data.documentType || 'Scan or photograph of the original document',
      comments: data.comments || '-',
      translatorName: data.translatorName || 'Nura Majzoub Sapir',
      // User edits from modal take highest priority!
      ...data,
      // System images and aliases
      license_front: imagesBase64[0] || "",
      foto_frente: imagesBase64[0] || "",
      license_back: imagesBase64[1] || "",
      foto_reverso: imagesBase64[1] || "",
    };

    if (!renderData.assignedNumber || renderData.assignedNumber === '-' || renderData.assignedNumber.trim() === '') {
      renderData.assignedNumber = assignedNumberVal;
    }
    if (!renderData.reference || renderData.reference === '-' || renderData.reference.trim() === '') {
      renderData.reference = assignedNumberVal;
    }
    if (!renderData.citizen || renderData.citizen.trim() === '') {
      renderData.citizen = defaultCitizen;
    }
    if (renderData.middleName === '-' || !renderData.middleName) {
      renderData.middleName = '';
    }

    // Convert any remaining empty strings, nulls or undefined values to "-" (excluding system images and middleName)
    for (const key of Object.keys(renderData)) {
      if (key !== 'license_front' && key !== 'license_back' && key !== 'foto_frente' && key !== 'foto_reverso' && key !== 'middleName') {
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
