import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { saveAs } from "file-saver";
import ImageModule from "docxtemplater-image-module-free";
import { generateClassDescriptions, generateBrazilClassDescriptions, generateChinaClassDescriptions, generateItalyClassDescriptions, normalizeItalianAuthority, filterClassDescriptionsByHeldClasses, formatCategoriesDates, formatLicenseClasses, formatJapanLicenseClasses, getCleanJapanCondition, formatClassDescriptions, getCleanGermanCodes } from "./classDescriptions";
import { COUNTRY_TEMPLATES } from "../config/countryPrompts";
import { getNormalizedCountryKey, formatBrazilAuthority, sanitizeAuthority } from "./geminiApi";

const TRANSPARENT_1X1_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

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

// Fetch country template directly from server (/templates/[country].docx)
export const loadCountryTemplate = async (templateNameOrKey, ...candidates) => {
  let targetTemplate = '';
  
  if (templateNameOrKey && typeof templateNameOrKey === 'string') {
    const trimmed = templateNameOrKey.trim();
    if (trimmed.endsWith('.docx')) {
      targetTemplate = trimmed;
    } else {
      const key = getNormalizedCountryKey(trimmed);
      if (key && COUNTRY_TEMPLATES[key]) {
        targetTemplate = COUNTRY_TEMPLATES[key];
      } else if (COUNTRY_TEMPLATES[trimmed.toLowerCase()]) {
        targetTemplate = COUNTRY_TEMPLATES[trimmed.toLowerCase()];
      }
    }
  }
  
  if (!targetTemplate) {
    const allCandidates = [templateNameOrKey, ...candidates];
    for (const c of allCandidates) {
      if (!c || typeof c !== 'string') continue;
      const key = getNormalizedCountryKey(c);
      if (key && COUNTRY_TEMPLATES[key]) {
        targetTemplate = COUNTRY_TEMPLATES[key];
        break;
      }
    }
  }
  
  if (!targetTemplate) {
    targetTemplate = 'alemania.docx';
  }
  
  console.log(`Cargando plantilla oficial desde el servidor: ${targetTemplate}`);
  
  let response = await fetch(`./templates/${targetTemplate}`);
  if (!response.ok) {
    response = await fetch(`/templates/${targetTemplate}`);
  }
  if (!response.ok) {
    throw new Error(`No se pudo cargar la plantilla oficial ${targetTemplate} (${response.statusText})`);
  }
  return await response.arrayBuffer();
};

export const generateWordDocument = async (templateArrayBuffer, data, imagesBase64 = [], folderName = '', docIndex = 0) => {
  const zip = new PizZip(templateArrayBuffer);
  
  const imageOptions = {
    centered: false,
    getImage(tagValue) {
      if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image/')) {
        return base64DataURLToArrayBuffer(TRANSPARENT_1X1_PNG);
      }
      return base64DataURLToArrayBuffer(tagValue);
    },
    getSize(img, tagValue) {
      if (!tagValue || typeof tagValue !== 'string' || !tagValue.startsWith('data:image/') || tagValue === TRANSPARENT_1X1_PNG) {
        return [1, 1];
      }
      // Standard UK/International translation card display size
      return [280, 175];
    }
  };
  
  const ImageModuleClass = ImageModule.default || ImageModule;
  const imageModule = new ImageModuleClass(imageOptions);

  const assignedNumber = getAssignedNumber(folderName, docIndex);

  const DocxtemplaterClass = Docxtemplater.default || Docxtemplater;

  const doc = new DocxtemplaterClass(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [imageModule],
    nullGetter() {
      return "";
    },
    delimiters: {
      start: '{{',
      end: '}}'
    }
  });

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  // Value cleaner helper
  const val = (v) => {
    if (v === undefined || v === null || String(v).toLowerCase() === 'undefined' || String(v).toLowerCase() === 'null') {
      return '-';
    }
    const s = String(v).trim();
    return s === '' ? '-' : s;
  };

  // Image slots (1, 2, 3, 4)
  const img1 = imagesBase64[0] || "";
  const img2 = imagesBase64[1] || imagesBase64[0] || "";
  const img3 = imagesBase64[2] || imagesBase64[0] || "";
  const img4 = imagesBase64[3] || imagesBase64[1] || imagesBase64[0] || "";

  const firstName = val(data.firstName);
  const middleName = (data.middleName && data.middleName !== '-' && data.middleName !== '""') ? data.middleName.trim() : '';
  const firstNames = val(data.firstNames || [firstName, middleName].filter(p => p && p !== '-').join(' ') || firstName);
  const surname = val(data.surname);
  const fullName = val(data.fullName || data.fullname || [surname, firstNames].filter(p => p && p !== '-').join(' '));

  const isChinaDoc = Boolean(data.templateName && (data.templateName.includes('china') || data.templateName.includes('chino'))) ||
                     /chin/i.test(data.nationality || '') ||
                     /chin/i.test(data.country || '') ||
                     /chin|车辆管理所|公安/i.test(data.authority || '') ||
                     /china|chinese|chino/i.test(folderName);
  const isBrazilDoc = Boolean(data.templateName && (data.templateName.includes('brazil') || data.templateName.includes('brasil') || data.templateName.includes('cnh'))) ||
                      /brazil|brasil|cnh/i.test(data.nationality || '') ||
                      /brazil|brasil/i.test(data.country || '') ||
                      /brazil|brasil|detran|denatran|senatran/i.test(data.authority || '') ||
                      /brazil|brasil|cnh/i.test(folderName);
  const isItalyDoc = Boolean(data.templateName && data.templateName.includes('italia')) || /ital/i.test(folderName) || /ital/i.test(data.country || '') || /MC[-/\s]?[A-Z]{2}|MIT-UCO|UCO|MIT-DTT|DTT/i.test(data.authority || '');
  const isJapanDoc = Boolean(data.templateName && (data.templateName.includes('japon') || data.templateName.includes('japan'))) ||
                     /japan|japon/i.test(folderName) ||
                     /japan|japon/i.test(data.country || '') ||
                     /japan|japon/i.test(data.nationality || '') ||
                     /public safety commission/i.test(data.authority || '');
  const isGermanDoc = Boolean(data.templateName && (data.templateName.includes('alemania') || data.templateName.includes('german'))) ||
                      /alemania|german|germany|deutsch/i.test(folderName) ||
                      /alemania|german|germany|deutsch/i.test(data.country || '') ||
                      (!/denmark|dinamarca|danmark|france|francia|spain|espa|ital|japan|japon|china|czech|checa|brazil|brasil/i.test(folderName) &&
                       !/denmark|dinamarca|danmark|france|francia|spain|espa|ital|japan|japon|china|czech|checa|brazil|brasil/i.test(data.country || '') &&
                       (/german|alemania|deutsch/i.test(data.nationality || '') || /germany|alemania|deutschland/i.test(data.authority || '')));

  let authorityVal = val(data.authority);
  if (isItalyDoc && authorityVal && authorityVal !== '-') {
    authorityVal = normalizeItalianAuthority(authorityVal);
  } else if (isChinaDoc && authorityVal && authorityVal !== '-') {
    authorityVal = authorityVal.replace(/,\s*China$/i, '').trim();
  } else if (isJapanDoc && authorityVal && authorityVal !== '-') {
    if (!authorityVal.toLowerCase().includes('japan')) {
      authorityVal = `${authorityVal}, Japan`;
    }
  } else if (isBrazilDoc && authorityVal && authorityVal !== '-') {
    authorityVal = formatBrazilAuthority(authorityVal);
  }

  // Ensure issuing authority contains ONLY the genuine license country
  const docCountry = data.country || folderName || data.nationality || data.templateName || '';
  if (authorityVal && authorityVal !== '-') {
    authorityVal = sanitizeAuthority(authorityVal, docCountry);
  }

  let classVal = val(data.class);
  if (isJapanDoc && classVal && classVal !== '-') {
    classVal = formatJapanLicenseClasses(classVal);
  }

  let classDesc = data.classDescriptions;
  if (!classDesc || classDesc === '-' || classDesc.trim() === '') {
    if (isChinaDoc) {
      classDesc = generateChinaClassDescriptions(data.class || '');
    } else if (isBrazilDoc) {
      classDesc = generateBrazilClassDescriptions(data.class || '');
    } else if (isItalyDoc) {
      classDesc = generateItalyClassDescriptions(data.class || '');
    } else if (data.class || data.categoriesDates) {
      classDesc = generateClassDescriptions(`${data.class || ''} ${data.categoriesDates || ''}`);
    }
  } else {
    if (isItalyDoc) {
      classDesc = filterClassDescriptionsByHeldClasses(classDesc, data.class || '', 'italia');
    } else {
      classDesc = formatClassDescriptions(classDesc);
    }
  }

  const barcodeNumberVal = val(
    data.barcodeNumber ||
    data.barcode ||
    data.barcode_number ||
    data.barCode ||
    data.barCodeNumber ||
    data.barcodeNo ||
    data.bar_code ||
    data.codebar
  );

  const fileNumberVal = val(
    data.fileNumber ||
    data.file ||
    data.fileNo ||
    data.file_no ||
    data.filenumber ||
    data.file_number ||
    data.recordNumber ||
    data.recordFileNumber ||
    data.archiveNumber ||
    data.archiveNo ||
    data.dangan ||
    data.danganNumber ||
    data.danganBianhao
  );

  const japanCleanCondition = isJapanDoc ? getCleanJapanCondition(data) : '-';
  const germanCleanCodes = isGermanDoc ? getCleanGermanCodes(data) : '-';

  const explicacionCodigosVal = isJapanDoc 
    ? val(japanCleanCondition)
    : isGermanDoc
    ? val(germanCleanCodes)
    : val(
        data.explicacionCodigos ||
        data.conditions ||
        data.condition ||
        data.explicacion ||
        data.record ||
        data.records ||
        data.recordCard ||
        data.recordDetails ||
        data.remarks ||
        data.remark ||
        data.observations ||
        data.observaciones ||
        data.notes ||
        data.note ||
        data.violations
      );

  const codesVal = isJapanDoc ? val(japanCleanCondition) : (isGermanDoc ? val(germanCleanCodes) : val(data.codes));

  // Prepare full render object
  const renderData = {
    ...data,
    // Identification
    assignedNumber: val(data.assignedNumber !== '-' && data.assignedNumber ? data.assignedNumber : (assignedNumber || '-')),
    licenseNumber: val(data.licenseNumber),
    barcodeNumber: barcodeNumberVal,
    barcode: barcodeNumberVal,
    fileNumber: fileNumberVal,
    file: fileNumberVal,
    fileNo: fileNumberVal,
    cardNumber: val(data.cardNumber || data.card_number || data.cardNumberVertical || data.numeroEspelho || data.numero_espelho || data.espelho || data.nEspelho || data.serialNumber || data.serial),
    idDocument: val(data.idDocument || data.id_document || data.docIdentidade || data.doc_identidade || data.identityDocument || data.rg || data.identidade),
    cpf: val(data.cpf || data.CPF || data.individualTaxpayerNumber || data.taxpayerNumber || data.taxId),
    personal: val(data.personal || data.point4d || data.cpf),
    point4d: val(data.point4d || data.personal || data.cpf),
    citizen: val(data.citizen || data.bsn),
    reference: val(data.reference),

    // Names
    surname: surname,
    firstName: firstName,
    middleName: isBrazilDoc ? ((data.middleName && data.middleName !== '-') ? data.middleName.trim() : '') : (middleName || '-'),
    firstNames: firstNames,
    fullName: fullName,
    fullname: fullName,
    parents: val(data.parents || data.filiação || data.filiacao || data.nameOfParents || data.parentNames),

    // Dates
    dateOfBirth: val(data.dateOfBirth),
    firstIssued: val(data.firstIssued || data.issueDate || data.firstObtained),
    firstObtained: val(data.firstObtained || formatCategoriesDates(data.categoriesDates || data.firstObtained || data.firstIssued)),
    issueDate: val(data.issueDate || data.firstIssued),
    expiryDate: val(data.expiryDate) || 'Indefinite',
    categoriesDates: val(formatCategoriesDates(data.categoriesDates || data.firstObtained || data.firstIssued)),
    today: today,
    fechaHoy: today,

    // Categories & Conditions
    class: classVal,
    Class: classVal,
    classDescriptions: val(classDesc),
    codes: codesVal,
    explicacionCodigos: explicacionCodigosVal,
    explicacion: explicacionCodigosVal,
    conditions: explicacionCodigosVal,

    // Attributes & Location
    authority: authorityVal,
    placeOfBirth: val(data.placeOfBirth),
    address: val(data.address),
    nationality: val(data.nationality),
    gender: isBrazilDoc ? 'Not stated' : val(data.gender || data.sex),
    sex: isBrazilDoc ? 'Not stated' : val(data.sex || data.gender),
    height: val(data.height),
    eye: val(data.eye || data.eyeColor),
    eyeColor: val(data.eyeColor || data.eye),
    reverse: val(data.reverse || data.explicacionCodigos || data.codes),

    // Image tags mapping for all templates
    foto_1: img1,
    foto_2: img2,
    foto_3: img3,
    foto_4: img4,
    image1: img1,
    image2: img2,
    image3: img3,
    image4: img4,
    license_front: img1,
    license_back: img2,
    licence_front: img1,
    licence_back: img2,
    fotoFrente: img1,
    fotoReverso: img2,
    front: img1,
    back: img2
  };

  try {
    doc.render(renderData);
  } catch (error) {
    console.error("Docxtemplater render error:", error);
    if (error.properties && error.properties.errors) {
      const messages = error.properties.errors.map(e => e.message).join(" | ");
      throw new Error(`Error en la plantilla Word: ${messages}`);
    }
    throw error;
  }

  const out = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  return out;
};

export const downloadWordDocument = (blob, filename) => {
  saveAs(blob, filename);
};
