import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { saveAs } from "file-saver";
import ImageModule from "docxtemplater-image-module-free";
import { generateClassDescriptions, generateBrazilClassDescriptions, generateChinaClassDescriptions, formatCategoriesDates } from "./classDescriptions";

const TRANSPARENT_1X1_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

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
  try {
    const base64 = cleanUrl.split(',')[1];
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.warn("Error converting base64 data to ArrayBuffer:", e);
    return new ArrayBuffer(0);
  }
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

export const generateWordDocument = async (templateArrayBuffer, data, imagesBase64 = [], folderName = '', docIndex = 0) => {
  const zip = new PizZip(templateArrayBuffer);
  
  const imageOptions = {
    centered: false,
    getImage(tagValue, tagName) {
      if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image/')) {
        return base64DataURLToArrayBuffer(TRANSPARENT_1X1_PNG);
      }
      return base64DataURLToArrayBuffer(tagValue);
    },
    getSize(img, tagValue, tagName) {
      if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image/') || tagValue === TRANSPARENT_1X1_PNG) {
        return [1, 1];
      }
      const maxWidth = 480;
      const maxHeight = 300;
      
      let origWidth = 0;
      let origHeight = 0;

      if (tagValue.includes('|')) {
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

    // Country detection helpers
    const folderLower = (folderName || '').toLowerCase();
    const isChina = Boolean(data.barcodeNumber && data.barcodeNumber !== '-') ||
                    Boolean(data.fileNumber && data.fileNumber !== '-') ||
                    (data.nationality && /chin/i.test(data.nationality)) ||
                    (data.authority && /chin/i.test(data.authority)) ||
                    /china|chinese|chino/i.test(folderLower);

    const isBrazil = (data.nationality && /brazil|brasil/i.test(data.nationality)) ||
                     (data.authority && /brazil|brasil/i.test(data.authority)) ||
                     Boolean(data.cpf && data.cpf !== '-') ||
                     Boolean(data.idDocument && data.idDocument !== '-') ||
                     /brazil|brasil|cnh/i.test(folderLower);

    // Class descriptions fallback
    let defaultClassDescriptions = (data.classDescriptions && data.classDescriptions.trim() !== '' && data.classDescriptions.trim() !== '-')
      ? data.classDescriptions
      : '';
    
    if (!defaultClassDescriptions) {
      if (isChina) {
        defaultClassDescriptions = generateChinaClassDescriptions(data.class || '');
      } else if (isBrazil) {
        defaultClassDescriptions = generateBrazilClassDescriptions(data.class || '');
      } else {
        defaultClassDescriptions = generateClassDescriptions(data.class || '');
      }
    }

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

    // Robust gender / sex resolution
    let defaultSex = (data.gender && data.gender.trim() !== '' && data.gender.trim() !== '-')
      ? data.gender.trim()
      : ((data.sex && data.sex.trim() !== '' && data.sex.trim() !== '-') ? data.sex.trim() : '');

    if (!defaultSex && (data.Gender || data.Sex)) {
      defaultSex = (data.Gender || data.Sex).trim();
    }
    if (defaultSex === '男' || defaultSex.toLowerCase() === 'm' || defaultSex.toLowerCase() === 'male' || defaultSex.toLowerCase() === 'masculino' || defaultSex.toLowerCase() === 'masculin') {
      defaultSex = 'Male';
    } else if (defaultSex === '女' || defaultSex.toLowerCase() === 'f' || defaultSex.toLowerCase() === 'female' || defaultSex.toLowerCase() === 'femenino' || defaultSex.toLowerCase() === 'féminin') {
      defaultSex = 'Female';
    }
    if (!defaultSex) defaultSex = '-';

    const defaultPersonal = (data.personal && data.personal.trim() !== '' && data.personal.trim() !== '-')
      ? data.personal
      : ((data.point4d && data.point4d.trim() !== '' && data.point4d.trim() !== '-') ? data.point4d : (data.cpf || '-'));

    const assignedNumberVal = (data.assignedNumber && data.assignedNumber.trim() !== '' && data.assignedNumber.trim() !== '-')
      ? data.assignedNumber.trim()
      : ((data.reference && data.reference.trim() !== '' && data.reference.trim() !== '-') ? data.reference.trim() : (assignedNumber || '-'));

    const firstObtainedVal = (data.firstIssued && data.firstIssued.trim() !== '' && data.firstIssued !== '-')
      ? data.firstIssued.trim()
      : ((data.firstObtained && data.firstObtained.trim() !== '' && data.firstObtained !== '-') 
        ? data.firstObtained.trim()
        : ((data.categoriesDates && data.categoriesDates.trim() !== '' && data.categoriesDates !== '-') ? data.categoriesDates.trim() : '-'));

    const cardNumVal = (data.cardNumber && data.cardNumber.trim() !== '' && data.cardNumber !== '-') ? data.cardNumber.trim() : '';
    const idDocVal = (data.idDocument && data.idDocument.trim() !== '' && data.idDocument !== '-') ? data.idDocument.trim() : '';
    const cpfVal = (data.cpf && data.cpf.trim() !== '' && data.cpf !== '-') ? data.cpf.trim() : '';
    const parentsVal = (data.parents && data.parents.trim() !== '' && data.parents !== '-') ? data.parents.trim() : '';
    
    const barcodeVal = (data.barcodeNumber && data.barcodeNumber.trim() !== '' && data.barcodeNumber !== '-')
      ? data.barcodeNumber.trim()
      : ((data.barcode && data.barcode.trim() !== '' && data.barcode !== '-') ? data.barcode.trim() : '');

    const fileNumVal = (data.fileNumber && data.fileNumber.trim() !== '' && data.fileNumber !== '-')
      ? data.fileNumber.trim()
      : ((data.fileNo && data.fileNo.trim() !== '' && data.fileNo !== '-') 
        ? data.fileNo.trim() 
        : ((data.file && data.file.trim() !== '' && data.file !== '-') ? data.file.trim() : ''));

    let defaultNationality = (data.nationality && data.nationality.trim() !== '' && data.nationality !== '-')
      ? data.nationality.trim()
      : '';
    if (!defaultNationality) {
      if (isChina) defaultNationality = 'Chinese';
      else if (isBrazil) defaultNationality = 'Brazilian';
      else if (/german|aleman|deutsch/i.test(folderLower)) defaultNationality = 'German';
      else if (/franc/i.test(folderLower)) defaultNationality = 'French';
      else if (/japan|japon/i.test(folderLower)) defaultNationality = 'Japanese';
      else if (/taiwan/i.test(folderLower)) defaultNationality = 'Taiwanese';
      else if (/denmark|dinamarca|danmark/i.test(folderLower)) defaultNationality = 'Danish';
      else if (/netherland|holand|dutch/i.test(folderLower)) defaultNationality = 'Dutch';
      else if (/swiss|suiz/i.test(folderLower)) defaultNationality = 'Swiss';
      else if (/canada/i.test(folderLower)) defaultNationality = 'Canadian';
      else if (/vietnam/i.test(folderLower)) defaultNationality = 'Vietnamese';
      else if (/hungar|hungri/i.test(folderLower)) defaultNationality = 'Hungarian';
    }

    // Build relevant details block for "Any other relevant licence details"
    const relevantLines = [];
    if (isChina) {
      if (defaultNationality) relevantLines.push(`Nationality: ${defaultNationality}`);
      if (barcodeVal) relevantLines.push(`Barcode number: ${barcodeVal}`);
      if (fileNumVal) relevantLines.push(`File No. ${fileNumVal}`);
    } else if (isBrazil) {
      if (cardNumVal) relevantLines.push(`Card Number: ${cardNumVal}`);
      if (idDocVal) relevantLines.push(`ID Document: ${idDocVal}`);
      if (cpfVal) relevantLines.push(`Individual Taxpayer Number: ${cpfVal}`);
      if (parentsVal) relevantLines.push(`Name of Parents:${parentsVal}`);
    } else {
      if (defaultNationality && defaultNationality !== '-') relevantLines.push(`Nationality: ${defaultNationality}`);
      if (cardNumVal) relevantLines.push(`Card Number: ${cardNumVal}`);
      if (idDocVal) relevantLines.push(`ID Document: ${idDocVal}`);
      if (cpfVal) relevantLines.push(`Individual Taxpayer Number: ${cpfVal}`);
      if (parentsVal) relevantLines.push(`Name of Parents:${parentsVal}`);
      if (barcodeVal) relevantLines.push(`Barcode number: ${barcodeVal}`);
      if (fileNumVal) relevantLines.push(`File No. ${fileNumVal}`);
    }
    const detailsVal = relevantLines.length > 0 ? relevantLines.join('\n') : '-';

    const middleNameVal = (data.middleName && data.middleName !== '-' && data.middleName.trim() !== '""') ? data.middleName.trim() : '';

    // Prepared image buffers
    const frontImg = imagesBase64[0] || "";
    const backImg = imagesBase64[1] || imagesBase64[0] || "";
    const img3 = imagesBase64[2] || "";
    const img4 = imagesBase64[3] || "";

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
      Sex: defaultSex,
      Gender: defaultSex,
      address: (data.address && data.address.trim() !== '') ? data.address : '-',
      Address: (data.address && data.address.trim() !== '') ? data.address : '-',
      reference: assignedNumberVal,
      placeOfBirth: (data.placeOfBirth && data.placeOfBirth.trim() !== '') ? data.placeOfBirth : '-',
      area: (data.area && data.area.trim() !== '') ? data.area : '-',
      file: fileNumVal || "-",
      fileNumber: fileNumVal || "-",
      fileNo: fileNumVal || "-",
      barcodeNumber: barcodeVal || "-",
      barcode: barcodeVal || "-",
      barcode_number: barcodeVal || "-",
      issuedDate: data.issueDate || "-",
      dateIssued: data.issueDate || "-",
      issueDate: data.issueDate || "-",
      expiryDate: data.expiryDate || "-",
      dateExpiry: data.expiryDate || "-",
      categoriesDates: firstObtainedVal,
      firstObtained: firstObtainedVal,
      dateFirstObtained: firstObtainedVal,
      firstIssued: firstObtainedVal,
      dateFirstIssued: firstObtainedVal,
      gold: (data.gold && data.gold.trim() !== '') ? data.gold : "-",
      today: today,
      fechaHoy: today,
      assignedNumber: assignedNumberVal,
      refNumber: assignedNumberVal,
      translationReferenceNumber: assignedNumberVal,
      // Brazilian fields & aliases
      cardNumber: cardNumVal || '-',
      CardNumber: cardNumVal || '-',
      card_number: cardNumVal || '-',
      serialNumber: cardNumVal || '-',
      espelho: cardNumVal || '-',
      idDocument: idDocVal || '-',
      IdDocument: idDocVal || '-',
      id_document: idDocVal || '-',
      docIdentidade: idDocVal || '-',
      identityDocument: idDocVal || '-',
      cpf: cpfVal || '-',
      CPF: cpfVal || '-',
      individualTaxpayerNumber: cpfVal || '-',
      IndividualTaxpayerNumber: cpfVal || '-',
      individual_taxpayer_number: cpfVal || '-',
      taxNumber: cpfVal || '-',
      parents: parentsVal || '-',
      Parents: parentsVal || '-',
      nameOfParents: parentsVal || '-',
      NameOfParents: parentsVal || '-',
      name_of_parents: parentsVal || '-',
      filiação: parentsVal || '-',
      Filiação: parentsVal || '-',
      filiacao: parentsVal || '-',
      Filiacao: parentsVal || '-',
      placeOfBirth: (data.placeOfBirth && data.placeOfBirth.trim() !== '') ? data.placeOfBirth : '-',
      PlaceOfBirth: (data.placeOfBirth && data.placeOfBirth.trim() !== '') ? data.placeOfBirth : '-',
      place_of_birth: (data.placeOfBirth && data.placeOfBirth.trim() !== '') ? data.placeOfBirth : '-',
      firstObtained: firstObtainedVal,
      FirstObtained: firstObtainedVal,
      first_obtained: firstObtainedVal,
      firstIssued: firstObtainedVal,
      FirstIssued: firstObtainedVal,
      first_issued: firstObtainedVal,
      habilitacao: firstObtainedVal,
      Habilitacao: firstObtainedVal,
      nationality: defaultNationality || '-',
      Nationality: defaultNationality || '-',
      relevantDetails: detailsVal,
      otherDetails: detailsVal,
      details: detailsVal,
      anyOtherRelevantLicenceDetails: detailsVal,
      anyOtherRelevantLicenseDetails: detailsVal,
      language: data.language || (isChina ? 'Chinese' : (isBrazil ? 'Portuguese' : 'English')),
      documentType: data.documentType || 'Scan or photograph of the original document',
      comments: data.comments || '-',
      translatorName: data.translatorName || 'Nura Majzoub Sapir',
      
      // Complete Image Aliases for Front / Back / Multiple images (UK, US, Spanish conventions)
      license_front: frontImg,
      licence_front: frontImg,
      licenseFront: frontImg,
      licenceFront: frontImg,
      license_image_front: frontImg,
      licence_image_front: frontImg,
      foto_frente: frontImg,
      fotoFrente: frontImg,
      licencia_frente: frontImg,
      licenciaFrente: frontImg,
      image1: frontImg,
      image_1: frontImg,
      img1: frontImg,
      img_1: frontImg,
      front: frontImg,
      frontImage: frontImg,
      front_image: frontImg,
      photo1: frontImg,
      photo_1: frontImg,
      photoFront: frontImg,
      photo_front: frontImg,
      image: frontImg,
      foto: frontImg,
      photo: frontImg,
      doc_front: frontImg,
      document_front: frontImg,
      main_card: frontImg,
      card_front: frontImg,
      card1: frontImg,

      license_back: backImg,
      licence_back: backImg,
      licenseBack: backImg,
      licenceBack: backImg,
      license_image_back: backImg,
      licence_image_back: backImg,
      foto_reverso: backImg,
      fotoReverso: backImg,
      foto_atras: backImg,
      fotoAtras: backImg,
      licencia_reverso: backImg,
      licenciaReverso: backImg,
      image2: backImg,
      image_2: backImg,
      img2: backImg,
      img_2: backImg,
      back: backImg,
      backImage: backImg,
      back_image: backImg,
      photo2: backImg,
      photo_2: backImg,
      photoBack: backImg,
      photo_back: backImg,
      doc_back: backImg,
      document_back: backImg,
      sub_card: backImg,
      record_card: backImg,
      card_back: backImg,
      card2: backImg,

      image3: img3,
      image_3: img3,
      img3: img3,
      photo3: img3,
      image4: img4,
      image_4: img4,
      img4: img4,
      photo4: img4,
      images: imagesBase64.map((img, i) => ({ image: img, img: img, url: img, index: i + 1 })),

      // User edits from modal take highest priority!
      ...data,
    };

    // Re-apply critical fallbacks if user edits left them blank
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
    if (!renderData.sex || renderData.sex === '-') {
      renderData.sex = defaultSex;
    }
    if (!renderData.gender || renderData.gender === '-') {
      renderData.gender = defaultSex;
    }
    if (!renderData.classDescriptions || renderData.classDescriptions === '-') {
      renderData.classDescriptions = defaultClassDescriptions;
    }
    if (!renderData.details || renderData.details === '-') {
      renderData.details = detailsVal;
      renderData.relevantDetails = detailsVal;
      renderData.otherDetails = detailsVal;
      renderData.anyOtherRelevantLicenceDetails = detailsVal;
    }

    // Convert any remaining empty strings, nulls or undefined values to "-" (excluding images and middleName)
    const imageKeySet = new Set([
      'license_front', 'licence_front', 'licenseFront', 'licenceFront', 'license_image_front', 'licence_image_front',
      'foto_frente', 'fotoFrente', 'licencia_frente', 'licenciaFrente', 'image1', 'image_1', 'img1', 'img_1',
      'front', 'frontImage', 'front_image', 'photo1', 'photo_1', 'photoFront', 'photo_front', 'image', 'foto', 'photo',
      'doc_front', 'document_front', 'main_card', 'card_front', 'card1',
      'license_back', 'licence_back', 'licenseBack', 'licenceBack', 'license_image_back', 'licence_image_back',
      'foto_reverso', 'fotoReverso', 'foto_atras', 'fotoAtras', 'licencia_reverso', 'licenciaReverso',
      'image2', 'image_2', 'img2', 'img_2', 'back', 'backImage', 'back_image', 'photo2', 'photo_2', 'photoBack', 'photo_back',
      'doc_back', 'document_back', 'sub_card', 'record_card', 'card_back', 'card2',
      'image3', 'image_3', 'img3', 'photo3', 'image4', 'image_4', 'img4', 'photo4', 'images'
    ]);

    for (const key of Object.keys(renderData)) {
      if (!imageKeySet.has(key) && key !== 'middleName') {
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

