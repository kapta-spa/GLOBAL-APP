import React, { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { Mail, Check, LogOut, RefreshCw, Inbox, FolderPlus, X, FolderKanban, CheckCircle2, FolderOpen, Trash2, Briefcase, Settings, ClipboardList, UploadCloud } from 'lucide-react';
import './index.css';
import ImageEditorModal from './ImageEditorModal';
import TranslationPreviewModal from './TranslationPreviewModal';
import EmailPreviewModal from './EmailPreviewModal';
import EmailDetailModal from './EmailDetailModal';
import ManualUploadModal from './ManualUploadModal';
import { extractLicenseData } from './utils/geminiApi';
import { generateWordDocument, getAssignedNumber } from './utils/documentGenerator';
import { sendEmailWithPdf } from './utils/gmailService';

const GOOGLE_API_SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Modal Render Error caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="modal-overlay open" onClick={() => this.setState({ hasError: false })}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', padding: '24px', backgroundColor: '#ffffff', borderRadius: '12px' }}>
            <h3 style={{ color: '#dc2626', marginBottom: '12px', fontSize: '18px', fontWeight: 'bold' }}>Error al mostrar la vista previa</h3>
            <p style={{ color: '#374151', fontSize: '14px', marginBottom: '16px' }}>{this.state.error?.message}</p>
            <button className="btn-primary" onClick={() => this.setState({ hasError: false })}>Cerrar y Reintentar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  // Persisted Auth States
  const [token, setToken] = useState(() => localStorage.getItem('google_token') || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('google_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  // Data states
  const [emails, setEmails] = useState([]);
  const [activeLabels, setActiveLabels] = useState([]); 
  const [monthLabels, setMonthLabels] = useState([]); 
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox'); 
  const [selectedIds, setSelectedIds] = useState(new Set()); 
  
  // Modal states
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);
  const [isTranslationModalOpen, setIsTranslationModalOpen] = useState(false);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [croppedImages, setCroppedImages] = useState([]);
  const [licenseQueue, setLicenseQueue] = useState([]);
  const [processedDocs, setProcessedDocs] = useState([]);
  
  const [trackingNumber, setTrackingNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [editorUrls, setEditorUrls] = useState([]);
  const [editorFolder, setEditorFolder] = useState('');
  const [generatedDocxBlob, setGeneratedDocxBlob] = useState(null);
  const [activeEmailItem, setActiveEmailItem] = useState(null);
  const [activeCustomerEmail, setActiveCustomerEmail] = useState('');
  const [viewingEmail, setViewingEmail] = useState(null);
  const [isManualUploadOpen, setIsManualUploadOpen] = useState(false);
  const [manualUploadLabel, setManualUploadLabel] = useState(null);
  
  // Settings & Persisted
  const [targetMonthFolder, setTargetMonthFolder] = useState(() => {
    const saved = localStorage.getItem('targetMonthFolder');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [sheetName, setSheetName] = useState(() => {
    return localStorage.getItem('sheetName') || 'July 2026';
  });

  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem('geminiApiKey') || '';
  });

  // Preview Data
  const [previewData, setPreviewData] = useState({
    tab: '1HRGT',
    trackingId: '',
    trackingLabel: '',
    licenses: 1,
    availableTrackings: [],
    rowIdx: -1,
    client: '',
    country: '',
    language: '',
    price: '',
    spreadsheetId: ''
  });

  // Initial load if already authenticated
  useEffect(() => {
    if (token && user) {
      refreshData(token, activeTab);
    }
  }, []);

  const handleAuthError = (status) => {
    if (status === 401) {
      logOut();
      alert("Tu sesión de Google ha expirado por seguridad (dura 1 hora). Por favor vuelve a iniciar sesión con un clic.");
      throw new Error("Unauthorized");
    }
  };

  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      setToken(codeResponse.access_token);
      localStorage.setItem('google_token', codeResponse.access_token);
      fetchUserProfile(codeResponse.access_token);
    },
    onError: (error) => console.log('Login Failed:', error),
    scope: GOOGLE_API_SCOPES,
  });

  const logOut = () => {
    googleLogout();
    setUser(null);
    setToken(null);
    setEmails([]);
    setActiveLabels([]);
    setSelectedIds(new Set());
    localStorage.removeItem('google_token');
    localStorage.removeItem('google_user');
  };

  const fetchUserProfile = async (accessToken) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      setUser(data);
      localStorage.setItem('google_user', JSON.stringify(data));
      refreshData(accessToken, 'inbox');
    } catch (err) {
      console.error('Failed to fetch user profile', err);
    }
  };

  const refreshData = (accessToken = token, tab = activeTab) => {
    setSelectedIds(new Set());
    if (tab === 'inbox') {
      fetchInbox(accessToken);
    } else {
      fetchProgressLabels(accessToken);
    }
  };

  const fetchInbox = async (accessToken) => {
    setLoading(true);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=20', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      handleAuthError(res.status);
      const data = await res.json();
      
      if (data.messages && data.messages.length > 0) {
        const messageDetails = await Promise.all(
          data.messages.map(async (msg) => {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            return msgRes.json();
          })
        );
        
        const formattedEmails = messageDetails.map(msg => {
          const headers = msg.payload.headers;
          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
          const date = headers.find(h => h.name === 'Date')?.value || '';
          
          const senderMatch = from.match(/^(.*?)\s*</);
          const senderName = senderMatch ? senderMatch[1].replace(/"/g, '') : from;

          let bodyData = '';
          if (msg.payload.parts) {
            for (let part of msg.payload.parts) {
              if (part.mimeType === 'text/plain' && part.body.data) {
                bodyData = part.body.data;
                break;
              } else if (part.mimeType === 'text/html' && part.body.data) {
                bodyData = part.body.data;
              } else if (part.parts) {
                for (let subPart of part.parts) {
                   if (subPart.mimeType === 'text/plain' && subPart.body.data) {
                      bodyData = subPart.body.data; break;
                   }
                }
              }
            }
          } else if (msg.payload.body && msg.payload.body.data) {
            bodyData = msg.payload.body.data;
          }
          
          let fullBody = msg.snippet;
          if (bodyData) {
            try {
              fullBody = decodeURIComponent(escape(atob(bodyData.replace(/-/g, '+').replace(/_/g, '/'))));
              fullBody = fullBody.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
            } catch(e) {}
          }

          return {
            id: msg.id,
            threadId: msg.threadId,
            snippet: msg.snippet,
            fullBody: fullBody,
            subject,
            sender: senderName,
            fromRaw: from,
            rawDate: date ? new Date(date).toLocaleString() : '',
            date: date ? new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''
          };
        });
        setEmails(formattedEmails);
      } else {
        setEmails([]);
      }
    } catch (err) {
      console.error('Failed to fetch inbox', err);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('sheetName', sheetName);
    localStorage.setItem('geminiApiKey', geminiApiKey);
    setIsSettingsModalOpen(false);
  };

  const handleAssignTracking = async (passedTrackingNumber = trackingNumber, closeModals = true) => {
    if (!passedTrackingNumber.trim() || selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const newLabelName = `0. Work/0. 1 HOUR/0. DL IN PROGRESS/${passedTrackingNumber}`;
      let labelId = null;
      
      const createLabelRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLabelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
      });
      
      handleAuthError(createLabelRes.status);
      const createLabelData = await createLabelRes.json();
      
      if (createLabelRes.ok) {
        labelId = createLabelData.id;
      } else if (createLabelData.error && createLabelData.error.code === 409) {
        const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const listData = await listRes.json();
        const existingLabel = listData.labels.find(l => l.name === newLabelName);
        if (existingLabel) labelId = existingLabel.id;
      }

      if (!labelId) throw new Error("Could not create or find label");

      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          addLabelIds: [labelId],
          removeLabelIds: ['INBOX']
        })
      });

      setEmails(emails.filter(e => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
      if (closeModals) {
        setIsTrackingModalOpen(false);
        setTrackingNumber('');
      }
    } catch (err) {
      console.error('Failed to process emails', err);
      if (err.message !== "Unauthorized") {
        alert('Error processing emails. Check console.');
      }
    } finally {
      setProcessing(false);
    }
  };

  // NEW: Registration Flow
  const handleRegisterClick = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      // 1. Fetch full email to parse data
      let clientName = '';
      let nombre = '';
      let apellido = '';
      let country = '';
      let language = '';
      let price = '';
      let tab = '1HRGT';
      let foundData = false;

      for (let emailId of Array.from(selectedIds)) {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (msgRes.status === 401) handleAuthError(msgRes.status);
        const msgData = await msgRes.json();

        let bodyData = '';
        if (msgData.payload.parts) {
          for (let part of msgData.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body.data) {
              bodyData = part.body.data;
              break;
            } else if (part.mimeType === 'text/html' && part.body.data) {
              bodyData = part.body.data; // fallback
            } else if (part.parts) {
              for (let subPart of part.parts) {
                 if (subPart.mimeType === 'text/plain' && subPart.body.data) {
                    bodyData = subPart.body.data; break;
                 }
              }
            }
          }
        } else if (msgData.payload.body && msgData.payload.body.data) {
          bodyData = msgData.payload.body.data;
        }

        let emailText = '';
        if (bodyData) {
          emailText = decodeURIComponent(escape(atob(bodyData.replace(/-/g, '+').replace(/_/g, '/'))));
        } else {
          emailText = msgData.snippet || '';
        }

        let cleanText = emailText.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\r\n/g, '\n').replace(/\n+/g, '\n');

          const cleanExtracted = (text) => {
            if (!text) return '';
            let cleaned = text.split(/https?:\/\//i)[0]; // remove URLs and everything after
            cleaned = cleaned.replace(/<[^>]+>/g, ''); // remove HTML
            cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, ''); // remove emails
            return cleaned.trim();
          };
  
          const translateToEnglish = (text) => {
            if (!text) return '';
            const map = {
              'español': 'Spanish', 'espanol': 'Spanish', 'inglés': 'English', 'ingles': 'English',
              'francés': 'French', 'frances': 'French', 'alemán': 'German', 'aleman': 'German',
              'italiano': 'Italian', 'portugués': 'Portuguese', 'portugues': 'Portuguese',
              'japonés': 'Japanese', 'japones': 'Japanese', 'chino': 'Chinese', 'coreano': 'Korean',
              'ruso': 'Russian', 'árabe': 'Arabic', 'arabe': 'Arabic', 'holandés': 'Dutch', 'holandes': 'Dutch',
              'méxico': 'Mexico', 'mexico': 'Mexico', 'españa': 'Spain', 'espana': 'Spain',
              'francia': 'France', 'alemania': 'Germany', 'italia': 'Italy',
              'japón': 'Japan', 'japon': 'Japan', 'china': 'China', 'corea': 'Korea',
              'brasil': 'Brazil', 'rusia': 'Russia', 'suiza': 'Switzerland', 'suecia': 'Sweden',
              'holanda': 'Netherlands', 'países bajos': 'Netherlands', 'paises bajos': 'Netherlands',
              'bélgica': 'Belgium', 'belgica': 'Belgium', 'dinamarca': 'Denmark',
              'noruega': 'Norway', 'finlandia': 'Finland', 'polonia': 'Poland',
              'taiwán': 'Taiwan', 'taiwan': 'Taiwan'
            };
            const lower = text.toLowerCase();
            return map[lower] || text;
          };
  
          const buildRegex = (keywords) => new RegExp(`(?:^|[\\s>])(?:${keywords})[\\s]*(?:[:：][\\s]*|[\\s]+)([^\\n<]+)`, 'i');
          
          const nombreMatch = cleanText.match(buildRegex('Nombre|First Name|Name|Vorname|名前|氏名'));
          const apellidoMatch = cleanText.match(buildRegex('Apellido|Last Name|Surname|Nachname|苗字'));
          const countryMatch = cleanText.match(buildRegex('Land des[^:]*|Country[^:]*|País|Pais|国|発行国'));
          const languageMatch = cleanText.match(buildRegex('Sprache des[^:]*|Language[^:]*|Idioma|言語'));
          const priceMatch = cleanText.match(/-\s*\$(\d+)/) || cleanText.match(/Price.*\$(\d+)/i) || cleanText.match(/\$(\d+)/);

        if (nombreMatch || apellidoMatch || priceMatch) {
          nombre = cleanExtracted(nombreMatch ? nombreMatch[1] : '');
          apellido = cleanExtracted(apellidoMatch ? apellidoMatch[1] : '');
          clientName = `${nombre} ${apellido}`.trim();
          country = translateToEnglish(cleanExtracted(countryMatch ? countryMatch[1] : ''));
          language = translateToEnglish(cleanExtracted(languageMatch ? languageMatch[1] : ''));
          price = priceMatch ? `$${priceMatch[1]}` : '';
          
          if (emailText.includes('RVA') || (msgData.snippet && msgData.snippet.includes('RVA'))) {
            tab = 'RVA';
          }
          foundData = true;
          break; // Stop looking, we found the form email
        }
      }



      // 3. Find Spreadsheet ID
      const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${sheetName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false&fields=files(id)`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const driveData = await driveRes.json();
      if (!driveData.files || driveData.files.length === 0) {
        throw new Error(`No se encontró el archivo de Sheets con el nombre "${sheetName}"`);
      }
      const spreadsheetId = driveData.files[0].id;

      // 4. Fetch Sheet Data to find empty row
      const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tab}!E:K`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const sheetData = await sheetRes.json();
      const values = sheetData.values || [];

      let trackingId = '';
      let targetRowIdx = -1;
      let lastFilledClientIdx = -1;

      // Find the LAST row that actually has a Client name
      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        if (tab === '1HRGT') {
          // E is row[0] (DL#), G is row[2] (Client)
          if (row[2] && row[2].trim() !== '' && row[2].trim().toLowerCase() !== 'nombre') {
            lastFilledClientIdx = i;
          }
        } else {
          // RVA: E is row[0], F is row[1] (Client)
          if (row[1] && row[1].trim() !== '' && row[1].trim().toLowerCase() !== 'nombre') {
            lastFilledClientIdx = i;
          }
        }
      }

      // The target row is the first row AFTER the last filled client that has a DL#
      let availableTrackings = [];
      for (let i = lastFilledClientIdx + 1; i < values.length; i++) {
         const row = values[i];
         if (row[0] && row[0].trim() !== '') {
            if (targetRowIdx === -1) {
              trackingId = row[0].trim();
              targetRowIdx = i + 1; // 1-indexed for Sheets
            }
            availableTrackings.push(row[0].trim());
            // We only really need a few trackings (e.g. 4) for the multiple licenses logic
            if (availableTrackings.length >= 4) break;
         }
      }

      if (targetRowIdx === -1) {
        throw new Error(`No se encontró un número libre después del último cliente en la pestaña ${tab}.`);
      }

      let licensesCount = 1;
      let finalTrackingLabel = `${trackingId} ${nombre}`.trim();
      
      if (['$110', '$130', '$150'].includes(price)) {
         licensesCount = 2;
         if (availableTrackings.length > 1) {
            let t1 = trackingId.startsWith('B') ? trackingId : `B${trackingId}`;
            let t2 = availableTrackings[1];
            if (t2.startsWith('B')) t2 = t2.substring(1);
            finalTrackingLabel = `${t1}, ${t2} ${nombre}`.trim();
         }
      }

      setPreviewData({
        tab,
        trackingId,
        trackingLabel: finalTrackingLabel,
        licenses: licensesCount,
        availableTrackings,
        rowIdx: targetRowIdx,
        client: clientName,
        nombre,
        apellido,
        country,
        language,
        price,
        spreadsheetId
      });
      
      setIsPreviewModalOpen(true);
    } catch (err) {
      console.error(err);
      if (err.message !== "Unauthorized") {
        alert(`Error al registrar: ${err.message}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const confirmRegistration = async () => {
    setProcessing(true);
    try {
      const { tab, rowIdx, country, language, price, spreadsheetId, trackingId, trackingLabel, licenses, nombre, apellido } = previewData;
      const client = `${nombre || ''} ${apellido || ''}`.trim();
      let values = [];

      for (let i = 0; i < licenses; i++) {
        let currentPrice = i === 0 ? price : '$0';
        
        if (tab === '1HRGT') {
          values.push({
            range: `${tab}!F${rowIdx + i}:K${rowIdx + i}`,
            values: [["JC", client, country, language, "Stripe", currentPrice]]
          });
        } else {
          values.push({
            range: `${tab}!F${rowIdx + i}:J${rowIdx + i}`,
            values: [[client, country, language, "Stripe", currentPrice]]
          });
        }
      }

      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          valueInputOption: 'USER_ENTERED',
          data: values
        })
      });

      handleAuthError(updateRes.status);

      if (!updateRes.ok) {
        throw new Error("Fallo al actualizar Google Sheets");
      }

      // After updating Sheets, assign the label and move the email
      await handleAssignTracking(trackingLabel, false);
      setIsPreviewModalOpen(false);

    } catch (err) {
      console.error(err);
      if (err.message !== "Unauthorized") {
        alert("Error al confirmar el registro.");
      }
    } finally {
      setProcessing(false);
    }
  };


  const handleTrashEmails = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX']
        })
      });
      handleAuthError(res.status);
      setEmails(emails.filter(e => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to trash emails', err);
      if (err.message !== "Unauthorized") {
        alert('Error trashing emails.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleWorkLabel = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${token}` }
      });
      handleAuthError(listRes.status);
      const listData = await listRes.json();
      let workLabel = listData.labels.find(l => l.name === '0. Work');
      
      if (!workLabel) {
        const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: '0. Work', labelListVisibility: 'labelShow', messageListVisibility: 'show' })
        });
        workLabel = await createRes.json();
      }

      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          addLabelIds: [workLabel.id],
          removeLabelIds: ['INBOX']
        })
      });

      setEmails(emails.filter(e => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to add Work label', err);
      if (err.message !== "Unauthorized") {
        alert('Error etiquetando como 0. Work');
      }
    } finally {
      setProcessing(false);
    }
  };


  const fetchProgressLabels = async (accessToken) => {
    setLoading(true);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      handleAuthError(res.status);
      const data = await res.json();
      
      if (data.labels) {
        const prefix = '0. Work/0. 1 HOUR/0. DL IN PROGRESS/';
        const progress = data.labels.filter(l => 
          l.name.startsWith(prefix) && l.name !== prefix
        ).map(l => ({
          id: l.id,
          name: l.name,
          displayName: l.name.replace(prefix, '')
        }));
        setActiveLabels(progress);
      }
    } catch (err) {
      console.error('Failed to fetch labels', err);
    } finally {
      setLoading(false);
    }
  };

  const openFolderPicker = async () => {
    setIsFolderModalOpen(true);
    setLoading(true);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${token}` },
      });
      handleAuthError(res.status);
      const data = await res.json();
      if (data.labels) {
        const prefix = '0. Work/0. 1 HOUR/';
        const availableFolders = data.labels.filter(l => 
          l.name.startsWith(prefix) && 
          l.name !== prefix && 
          l.name !== '0. Work/0. 1 HOUR/0. DL IN PROGRESS' &&
          l.name.split('/').length === 3 
        ).map(l => ({
          id: l.id,
          name: l.name,
          displayName: l.name.replace(prefix, '')
        }));
        
        availableFolders.sort((a, b) => b.displayName.localeCompare(a.displayName));
        setMonthLabels(availableFolders);
      }
    } catch(err) {
      console.error('Failed to fetch month folders', err);
    } finally {
      setLoading(false);
    }
  };

  const selectTargetFolder = (folder) => {
    setTargetMonthFolder(folder);
    localStorage.setItem('targetMonthFolder', JSON.stringify(folder));
    setIsFolderModalOpen(false);
  };

  const handleFinalizeLabels = async () => {
    if (selectedIds.size === 0) return;
    if (!targetMonthFolder) {
      alert("Por favor selecciona primero la carpeta del mes.");
      openFolderPicker();
      return;
    }
    
    setProcessing(true);
    
    try {
      const labelsToMove = activeLabels.filter(l => selectedIds.has(l.id));

      for (const label of labelsToMove) {
        const newName = `${targetMonthFolder.name}/${label.displayName}`;
        
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${label.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newName
          })
        });
        handleAuthError(res.status);
      }

      await fetchProgressLabels(token);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to move labels', err);
      if (err.message !== "Unauthorized") {
        alert('Error al mover etiquetas. Puede que ya exista una con ese nombre.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const fetchGmailImageAttachments = async (msgData, accessToken) => {
    const attachmentUrls = [];
    const searchParts = async (parts) => {
      if (!parts) return;
      for (const part of parts) {
        if (part.parts) {
          await searchParts(part.parts);
        }
        const mimeType = part.mimeType || '';
        const filename = part.filename || '';
        const body = part.body || {};
        
        const isImageMime = mimeType.toLowerCase().startsWith('image/');
        const isImageExt = /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(filename);
        
        if ((isImageMime || isImageExt) && body.attachmentId) {
          try {
            const attachRes = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgData.id}/attachments/${body.attachmentId}`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (attachRes.ok) {
              const attachData = await attachRes.json();
              if (attachData.data) {
                const base64Data = attachData.data.replace(/-/g, '+').replace(/_/g, '/');
                const finalMime = mimeType || 'image/jpeg';
                attachmentUrls.push(`data:${finalMime};base64,${base64Data}`);
              }
            }
          } catch (err) {
            console.error("Error al descargar adjunto de Gmail:", err);
          }
        }
      }
    };

    if (msgData.payload) {
      if (msgData.payload.parts) {
        await searchParts(msgData.payload.parts);
      } else if (msgData.payload.body && msgData.payload.body.attachmentId) {
        await searchParts([msgData.payload]);
      }
    }
    return attachmentUrls;
  };

  const handleProcessFolder = async (label) => {
    setProcessing(true);
    setActiveEmailItem(label);
    try {
      // 1. Get messages with this label
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=${label.id}&maxResults=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      handleAuthError(res.status);
      const data = await res.json();
      
      if (!data.messages || data.messages.length === 0) {
        throw new Error('No se encontraron correos en esta carpeta.');
      }
      
      let allUrls = [];
      let customerEmailStr = "";
      
      // 2. Fetch the body of the most recent message(s) to extract links
      for (const msg of data.messages) {
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
           headers: { Authorization: `Bearer ${token}` }
        });
        const msgData = await msgRes.json();
        
        let bodyData = '';
        if (msgData.payload.parts) {
          for (let part of msgData.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body.data) {
              bodyData = part.body.data;
              break;
            } else if (part.mimeType === 'text/html' && part.body.data) {
              bodyData = part.body.data;
            } else if (part.parts) {
              for (let subPart of part.parts) {
                 if (subPart.mimeType === 'text/plain' && subPart.body.data) {
                    bodyData = subPart.body.data; break;
                 }
              }
            }
          }
        } else if (msgData.payload.body && msgData.payload.body.data) {
          bodyData = msgData.payload.body.data;
        }

        let emailText = '';
        if (bodyData) {
          emailText = decodeURIComponent(escape(atob(bodyData.replace(/-/g, '+').replace(/_/g, '/'))));
          // Extract wix static urls
          const regex = /https:\/\/static\.wixstatic\.com\/media\/[^\s"']+/gi;
          const matches = emailText.match(regex);
          if (matches) {
            allUrls = [...allUrls, ...matches];
          }
        }

        if (!customerEmailStr) {
          let foundEmail = '';
          if (emailText) {
             // Buscar TODOS los correos en el texto
             const allEmailsRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
             const emailsInBody = emailText.match(allEmailsRegex) || [];
             
             // Filtrar los correos que sabemos que NO son del cliente
             const ignoreList = ['info@wix.com', 'no-reply@wix.com', 'nuramajzoub1@gmail.com', 'wix.com', 'support@wix.com'];
             const possibleClientEmails = emailsInBody.filter(e => {
                const lower = e.toLowerCase();
                return !ignoreList.some(ignore => lower.includes(ignore));
             });

             if (possibleClientEmails.length > 0) {
               foundEmail = possibleClientEmails[0];
             }
          }
          if (!foundEmail) {
             const fromHeader = msgData.payload.headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
             const match = fromHeader.match(/<([^>]+)>/);
             foundEmail = match ? match[1] : fromHeader;
          }
          if (foundEmail) {
            customerEmailStr = foundEmail;
            setActiveCustomerEmail(foundEmail);
          }
        }
      }
      
      if (allUrls.length === 0) {
         // Intentar buscar archivos de imagen adjuntos en los correos de Gmail
         for (const msg of data.messages) {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
               headers: { Authorization: `Bearer ${token}` }
            });
            const msgData = await msgRes.json();
            const attachments = await fetchGmailImageAttachments(msgData, token);
            if (attachments.length > 0) {
               allUrls = [...allUrls, ...attachments];
            }
         }
      }
      
      if (allUrls.length === 0) {
         // Si sigue sin haber enlaces ni adjuntos, abrir el modal de carga manual
         setManualUploadLabel(label);
         setEditorFolder(label.displayName);
         setIsManualUploadOpen(true);
         return;
      }
      
      // Remove duplicates
      allUrls = [...new Set(allUrls)];
      
      setEditorUrls(allUrls);
      setEditorFolder(label.displayName);
      setIsImageEditorOpen(true);
      
    } catch (err) {
      console.error(err);
      if (err.message !== "Unauthorized") {
         alert(`Error: ${err.message}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleManualUploadLoaded = (dataUrls) => {
    setIsManualUploadOpen(false);
    setEditorUrls(dataUrls);
    if (manualUploadLabel) {
      setEditorFolder(manualUploadLabel.displayName);
    }
    setIsImageEditorOpen(true);
  };

  const processNextLicense = async (queue, docs) => {
    if (queue.length === 0) {
      setIsImageEditorOpen(false);
      setIsEmailPreviewOpen(true);
      return;
    }
    
    setProcessing(true);
    try {
      const currentImages = queue[0];
      let country = "";
      const folderLower = editorFolder.toLowerCase();
      const availableCountries = ['alemania', 'germany', 'deutschland', 'belgica', 'brazil', 'canada', 'china', 'denmark', 'dinamarca', 'danmark', 'hungria', 'indonesia', 'vietnam', 'francia', 'japon', 'taiwan', 'taiwán', 'suiza', 'swiss', 'switzerland'];
      for (const c of availableCountries) {
        if (folderLower.includes(c)) {
          country = c;
          break;
        }
      }
      if (!country) {
        const parts = editorFolder.split(' ');
        const candidate = parts.length > 1 ? parts[1].toLowerCase() : '';
        if (candidate.includes('franc')) country = 'francia';
        else if (candidate.includes('japon') || candidate.includes('japan')) country = 'japon';
        else if (candidate.includes('denmark') || candidate.includes('dinamarca') || candidate.includes('danmark')) country = 'denmark';
        else if (candidate.includes('aleman') || candidate.includes('german') || candidate.includes('deutsch')) country = 'alemania';
        else if (candidate.includes('suiz') || candidate.includes('swiss') || candidate.includes('switzer')) country = 'suiza';
        else if (availableCountries.includes(candidate)) country = candidate;
      }
      
      if (country === 'dinamarca' || country === 'danmark') {
        country = 'denmark';
      } else if (country === 'germany' || country === 'deutschland') {
        country = 'alemania';
      } else if (country === 'swiss' || country === 'switzerland') {
        country = 'suiza';
      }
      
      if (!availableCountries.includes(country) && country !== 'denmark' && country !== 'suiza') {
        country = "";
      }
      
      setCroppedImages(currentImages);
      const data = await extractLicenseData(geminiApiKey, currentImages, country);
      setExtractedData(data);
      setIsImageEditorOpen(false);
      setIsTranslationModalOpen(true);
    } catch(err) {
      console.error("Error extracted data", err);
      setIsImageEditorOpen(true);
      alert("Error procesando imagen: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEditorComplete = async (croppedImagesDataUrls) => {
    // setIsImageEditorOpen(false); moved to processNextLicense so it stays open during loading
    
    const queue = [];
    for (let i = 0; i < croppedImagesDataUrls.length; i += 2) {
      queue.push(croppedImagesDataUrls.slice(i, i + 2));
    }
    
    setLicenseQueue(queue);
    setProcessedDocs([]);
    
    await processNextLicense(queue, []);
  };

  const handleTranslationSave = async (finalData, templateArrayBuffer) => {
    try {
      console.log("Generating Word Document...");
      const docIndex = processedDocs.length;
      const docxBlob = await generateWordDocument(templateArrayBuffer, finalData, croppedImages, editorFolder, docIndex);
      console.log("Word Document generated successfully. Blob size:", docxBlob.size);
      
      const isMultiple = licenseQueue.length + processedDocs.length > 1;
      const displayIndex = processedDocs.length + 1;
      
      const assignedNumber = getAssignedNumber(editorFolder, docIndex);
      const fileName = assignedNumber || editorFolder;
      
      const newDocs = [...processedDocs, { blob: docxBlob, name: fileName }];
      setProcessedDocs(newDocs);
      
      setIsTranslationModalOpen(false);
      
      const nextQueue = licenseQueue.slice(1);
      setLicenseQueue(nextQueue);
      
      await processNextLicense(nextQueue, newDocs);
    } catch (err) {
      console.error("Error generando documento:", err);
      alert("Error al generar documento Word: " + err.message);
    }
  };

  const handleTranslationDownload = async (finalData, templateArrayBuffer) => {
    try {
      console.log("Generating Word Document for download...");
      const docIndex = processedDocs.length;
      const docxBlob = await generateWordDocument(templateArrayBuffer, finalData, croppedImages, editorFolder, docIndex);
      const url = URL.createObjectURL(docxBlob);
      const a = document.createElement('a');
      a.href = url;
      const assignedNumber = getAssignedNumber(editorFolder, docIndex);
      a.download = `${assignedNumber || editorFolder}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generating doc for download:", err);
      alert("Error al descargar Word: " + err.message);
    }
  };

  const handleSendEmailFinal = async (pdfBlobsArray, finalEmailTo) => {
    try {
      if (!finalEmailTo) {
        alert("Falta el correo del cliente.");
        return;
      }
      const subject = "Your Translation is ready!";
      const htmlBody = `
        <div style="text-align: center; margin-bottom: 20px;">
          Hello, your translation is ready 💫<br /><br />
          <strong style="color: #ef4444;">⚠️ IMPORTANT ⚠️</strong><br /><br />
          <strong style="color: #ef4444;">As part of our quality management process, please check all names, dates, and numbers, and let us know if any corrections are required.</strong>
        </div>
        <div style="text-align: center; margin-bottom: 40px;">
          If everything is correct, the translation is ready to use.<br /><br />
          We provide fast and reliable certified translation and interpreting services in all major world languages. We wish you all the best and would be happy to assist you with any future projects.
        </div>
        <div style="text-align: center; font-size: 13px; line-height: 1.6;">
          Kind Regards,<br />
          Juan Carlos Flores<br />
          W: <a href="http://www.globaltranslations.co.nz">www.globaltranslations.co.nz</a><br />
          E: <a href="mailto:info@globaltranslations.co.nz">info@globaltranslations.co.nz</a><br />
          P: +64 6 560 2232 M: +64 22 096 2125<br />
          <a href="https://wa.me/64220962125">WhatsApp Chat</a>
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #64748b; font-style: italic;">
          Ngā Mihi. शुक्रिया. Thank you. 谢谢. Gracias. ありがとう. Danke. شكرا. Obrigado.<br />
          “The World is but one country, and mankind its citizens.” Bahá’u’lláh
        </div>
      `;
      
      await sendEmailWithPdf(token, finalEmailTo, subject, htmlBody, pdfBlobsArray);
      
      
      alert("Correo enviado exitosamente a " + finalEmailTo);
      
      if (activeEmailItem) {
        // Find label and add a 'sent' flag or remove it?
        // Let's mark it as sent in state
        setActiveLabels(prev => prev.map(l => l.id === activeEmailItem.id ? { ...l, sent: true } : l));
      }
      setIsEmailPreviewOpen(false);
      setIsTranslationModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error enviando correo: " + err.message);
    }
  };

  const toggleSelection = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const handleTabSwitch = (tab) => {
    if (processing) return;
    setActiveTab(tab);
    refreshData(token, tab);
  };

  if (!user) {
    return (
      <div className="login-screen">
        <Mail size={64} className="login-icon" />
        <h1 className="login-title">Global Automatization</h1>
        <p className="login-subtitle">Organiza tus ventas de forma automatizada.</p>
        <button className="btn-primary" onClick={() => login()} style={{ padding: '14px 28px', fontSize: '1.1rem' }}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div>
      <header className="app-header">
        <div className="app-title">Global Automatization</div>
        <div style={{display: 'flex', gap: '10px'}}>
          <button className={`btn-icon ${loading ? 'spinning' : ''}`} onClick={() => refreshData()} title="Refresh">
            <RefreshCw size={20} />
          </button>
          <button className="btn-icon" onClick={() => setIsSettingsModalOpen(true)} title="Settings">
            <Settings size={20} />
          </button>
          <button className="btn-icon" onClick={logOut} title="Log Out">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'inbox' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('inbox')}
        >
          Inbox
        </button>
        <button 
          className={`tab ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('progress')}
        >
          En Progreso
        </button>
      </div>
      
      {/* Target Folder Selector */}
      {activeTab === 'progress' && (
        <div style={{ padding: '12px 16px', backgroundColor: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Carpeta actual: <br/>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              {targetMonthFolder ? targetMonthFolder.displayName : 'Ninguna seleccionada'}
            </strong>
          </div>
          <button onClick={openFolderPicker} className="btn-primary" style={{ backgroundColor: 'var(--surface-hover)', padding: '6px 12px' }}>
            <FolderOpen size={16} /> Cambiar
          </button>
        </div>
      )}

      {loading && !isSettingsModalOpen && !isPreviewModalOpen ? (
        <div className="loader-container">
          <svg className="spinner" width="40" height="40" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" />
          </svg>
          <p>Cargando datos...</p>
        </div>
      ) : (
        <div className="email-list">
          {activeTab === 'inbox' && (
            emails.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <Inbox size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p>No hay correos nuevos.</p>
              </div>
            ) : (
              emails.map(email => {
                const isSelected = selectedIds.has(email.id);
                return (
                  <div 
                    key={email.id} 
                    className={`email-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setViewingEmail(email)}
                  >
                    <div 
                      className="checkbox-container"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(email.id);
                      }}
                      title="Seleccionar correo"
                    >
                      {isSelected && <Check size={16} color="white" />}
                    </div>
                    <div className="email-content">
                      <div className="email-header-row">
                        <div className="email-sender">{email.sender}</div>
                        <div className="email-date">{email.date}</div>
                      </div>
                      <div className="email-subject">{email.subject}</div>
                      <div className="email-snippet">{email.snippet}</div>
                    </div>
                  </div>
                );
              })
            )
          )}

          {activeTab === 'progress' && (
            activeLabels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <FolderKanban size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                <p>No hay etiquetas en progreso.</p>
              </div>
            ) : (
              activeLabels.map(label => {
                const isSelected = selectedIds.has(label.id);
                return (
                  <div 
                    key={label.id} 
                    className={`email-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelection(label.id)}
                  >
                    <div className="checkbox-container">
                      {isSelected && <Check size={16} color="white" />}
                    </div>
                    <div className="email-content" style={{ display: 'flex', alignItems: 'center', minHeight: '32px', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <FolderKanban size={18} style={{ marginRight: '12px', color: 'var(--accent-color)' }} />
                        <div className="email-subject" style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {label.displayName}
                          {label.displayName.match(/\[(.*?)\]/) && (
                            <span style={{ fontSize: '0.8rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                              {label.displayName.match(/\[(.*?)\]/)[1]}
                            </span>
                          )}
                          {label.sent && <span style={{ fontSize: '0.75rem', backgroundColor: '#10b981', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>Enviado</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button  
                          className="btn-secondary" 
                          style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setManualUploadLabel(label);
                            setEditorFolder(label.displayName);
                            setIsManualUploadOpen(true);
                          }}
                          disabled={processing}
                          title="Subir fotos manualmente desde tu computadora"
                        >
                          <UploadCloud size={14} /> Fotos
                        </button>
                        <button  
                          className="btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                          onClick={(e) => { e.stopPropagation(); handleProcessFolder(label); }}
                          disabled={processing}
                        >
                          {processing ? '...' : 'Procesar'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className={`action-bar ${selectedIds.size > 0 ? 'visible' : ''}`}>
        <div className="selection-count">
          {selectedIds.size} {selectedIds.size === 1 ? 'sel.' : 'sel.'}
        </div>
        
        {activeTab === 'inbox' ? (
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flexWrap: 'nowrap' }}>
            {/* Trash Action */}
            <button 
              className="btn-primary" 
              style={{ backgroundColor: 'var(--danger-color)', padding: '10px', flexShrink: 0 }}
              onClick={handleTrashEmails}
              disabled={processing}
            >
              <Trash2 size={18} />
            </button>

            {/* 0. Work Action */}
            <button 
              className="btn-primary" 
              style={{ backgroundColor: 'var(--surface-hover)', padding: '10px', flexShrink: 0 }}
              onClick={handleWorkLabel}
              disabled={processing}
            >
              <Briefcase size={18} />
              0. Work
            </button>

            {/* Registrar (Sheets) Action */}
            <button 
              className="btn-primary"
              style={{ backgroundColor: '#10b981', padding: '10px 12px', flexShrink: 0 }}
              onClick={handleRegisterClick}
              disabled={processing}
            >
              <ClipboardList size={18} />
              {processing ? '...' : 'Registrar'}
            </button>

            {/* DL IN PROGRESS Action */}
            <button 
              className="btn-primary" 
              onClick={() => setIsTrackingModalOpen(true)}
              disabled={processing}
              style={{ flexShrink: 0 }}
            >
              <FolderPlus size={18} />
              Tracking
            </button>
          </div>
        ) : (
          <button 
            className="btn-primary" 
            style={{ backgroundColor: 'var(--success-color)' }}
            onClick={handleFinalizeLabels}
            disabled={processing}
          >
            <CheckCircle2 size={18} />
            {processing ? 'Moviendo...' : 'Mover a Carpeta'}
          </button>
        )}
      </div>

      {/* Settings Modal */}
      <div className={`modal-overlay ${isSettingsModalOpen ? 'open' : ''}`} onClick={() => setIsSettingsModalOpen(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Configuración</h2>
            <button className="btn-icon" onClick={() => setIsSettingsModalOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <div className="input-group">
            <label className="input-label">Nombre del Archivo Google Sheets (Mes)</label>
            <input 
              type="text" 
              className="text-input" 
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
            />
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8}}>
              Ejemplo: "July 2026". La app buscará este archivo para registrar los pedidos.
            </p>
          </div>
          <div className="input-group" style={{marginTop: '16px'}}>
            <label className="input-label">Gemini API Key</label>
            <input 
              type="password" 
              className="text-input" 
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
            />
            <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8}}>
              Esta clave es necesaria para traducir y extraer datos de las fotos.
            </p>
          </div>
          <button className="btn-primary btn-block" onClick={saveSettings}>
            Guardar
          </button>
        </div>
      </div>

      {/* Preview Modal for Sheets Registration */}
      <div className={`modal-overlay ${isPreviewModalOpen ? 'open' : ''}`} onClick={() => !processing && setIsPreviewModalOpen(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header">
            <h2 className="modal-title">Pre-visualización</h2>
            <button className="btn-icon" onClick={() => !processing && setIsPreviewModalOpen(false)}>
              <X size={24} />
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
             <div className="input-group">
                <label className="input-label">Pestaña Detectada</label>
                <select 
                  className="text-input" 
                  value={previewData.tab} 
                  onChange={(e) => setPreviewData({...previewData, tab: e.target.value})}
                >
                  <option value="1HRGT">1HRGT</option>
                  <option value="RVA">RVA</option>
                </select>
             </div>

             <div className="input-group">
                <label className="input-label">Número de Licencias</label>
                <select 
                  className="text-input" 
                  value={previewData.licenses} 
                  onChange={(e) => {
                    const lics = parseInt(e.target.value, 10);
                    let newLabel = previewData.availableTrackings[0] || previewData.trackingId;
                    if (lics > 1 && previewData.availableTrackings.length >= lics) {
                      newLabel = `${previewData.availableTrackings[0]}, ${previewData.availableTrackings[lics - 1]}`;
                    }
                    newLabel = `${newLabel} ${previewData.nombre || ''}`.trim();
                    setPreviewData({...previewData, licenses: lics, trackingLabel: newLabel});
                  }}
                >
                  <option value={1}>1 Licencia</option>
                  <option value={2}>2 Licencias</option>
                  <option value={3}>3 Licencias</option>
                  <option value={4}>4 Licencias</option>
                </select>
             </div>

             <div className="input-group">
                <label className="input-label">Pedido</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.trackingLabel} 
                  onChange={(e) => setPreviewData({...previewData, trackingLabel: e.target.value})}
                />
                <p style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Fila inicial en Sheets: {previewData.rowIdx}</p>
             </div>

             <div className="input-group">
                <label className="input-label">Nombre</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.nombre || ''} 
                  onChange={(e) => setPreviewData({...previewData, nombre: e.target.value})}
                />
             </div>

             <div className="input-group">
                <label className="input-label">Apellido</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.apellido || ''} 
                  onChange={(e) => setPreviewData({...previewData, apellido: e.target.value})}
                />
             </div>

             <div className="input-group">
                <label className="input-label">País (Country)</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.country} 
                  onChange={(e) => setPreviewData({...previewData, country: e.target.value})}
                />
             </div>

             <div className="input-group">
                <label className="input-label">Idioma (Language)</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.language} 
                  onChange={(e) => setPreviewData({...previewData, language: e.target.value})}
                />
             </div>

             <div className="input-group">
                <label className="input-label">Precio (Price)</label>
                <input 
                  type="text" className="text-input" 
                  value={previewData.price} 
                  onChange={(e) => setPreviewData({...previewData, price: e.target.value})}
                />
             </div>
          </div>
          
          <button 
            className="btn-primary btn-block" 
            onClick={confirmRegistration}
            disabled={processing}
            style={{marginTop: 15, backgroundColor: '#10b981'}}
          >
            {processing ? 'Guardando en Sheets...' : 'Aceptar y Mover a Progreso'}
          </button>
        </div>
      </div>

      {/* Modal for Tracking Number (Inbox) */}
      <div className={`modal-overlay ${isTrackingModalOpen ? 'open' : ''}`} onClick={() => !processing && setIsTrackingModalOpen(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">Asignar Número de Rastreo</h2>
            <button className="btn-icon" onClick={() => !processing && setIsTrackingModalOpen(false)}>
              <X size={24} />
            </button>
          </div>
          
          <div className="input-group">
            <label className="input-label">Tracking / Order Number</label>
            <input 
              type="text" 
              className="text-input" 
              placeholder="e.g. B3812 or RVA3473" 
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              disabled={processing}
            />
          </div>
          
          <button 
            className="btn-primary btn-block" 
            onClick={() => handleAssignTracking(trackingNumber, true)}
            disabled={!trackingNumber.trim() || processing}
          >
            {processing ? 'Procesando...' : 'Mover a DL IN PROGRESS'}
          </button>
        </div>
      </div>
      
      {/* Modal for Folder Picker */}
      <div className={`modal-overlay ${isFolderModalOpen ? 'open' : ''}`} onClick={() => !loading && setIsFolderModalOpen(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
          <div className="modal-header" style={{ marginBottom: 10 }}>
            <h2 className="modal-title">Selecciona la Carpeta Destino</h2>
            <button className="btn-icon" onClick={() => setIsFolderModalOpen(false)}>
              <X size={24} />
            </button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {monthLabels.length === 0 && !loading && (
              <p style={{color: 'var(--text-secondary)'}}>No se encontraron otras carpetas bajo "0. 1 HOUR".</p>
            )}
            
            {monthLabels.map(folder => (
              <div 
                key={folder.id} 
                className="email-item" 
                style={{ marginBottom: 8, padding: '12px' }}
                onClick={() => selectTargetFolder(folder)}
              >
                <FolderOpen size={18} style={{ marginRight: 12, color: 'var(--accent-color)' }}/>
                {folder.displayName}
              </div>
            ))}
          </div>
        </div>
      </div>

        <ImageEditorModal
          isOpen={isImageEditorOpen}
          onClose={() => setIsImageEditorOpen(false)}
          imageUrls={editorUrls}
          folderName={editorFolder}
          onComplete={handleEditorComplete}
          isProcessing={processing}
        />

      <ErrorBoundary>
        <TranslationPreviewModal
          isOpen={isTranslationModalOpen}
          onClose={() => setIsTranslationModalOpen(false)}
          initialData={extractedData}
          folderName={editorFolder}
          onSave={handleTranslationSave}
          onDownloadWord={handleTranslationDownload}
        />
      </ErrorBoundary>

      <EmailPreviewModal
        isOpen={isEmailPreviewOpen}
        onClose={() => setIsEmailPreviewOpen(false)}
        processedDocs={processedDocs}
        folderName={editorFolder}
        customerEmail={activeCustomerEmail}
        onSendEmail={handleSendEmailFinal}
        onBack={() => {
          setIsEmailPreviewOpen(false);
          setIsTranslationModalOpen(true);
        }}
      />

      <EmailDetailModal
        email={viewingEmail}
        isOpen={!!viewingEmail}
        onClose={() => setViewingEmail(null)}
        isSelected={viewingEmail ? selectedIds.has(viewingEmail.id) : false}
        onToggleSelect={toggleSelection}
        token={token}
        onProcessAttachments={(urls, folderName) => {
          setEditorUrls(urls);
          setEditorFolder(folderName);
          setIsImageEditorOpen(true);
        }}
      />

      <ManualUploadModal
        isOpen={isManualUploadOpen}
        onClose={() => setIsManualUploadOpen(false)}
        folderName={manualUploadLabel ? manualUploadLabel.displayName : editorFolder}
        label={manualUploadLabel}
        token={token}
        onImagesLoaded={handleManualUploadLoaded}
      />

      {processing && (
        <div className="processing-overlay">
          <div className="spinner">
            <svg viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
            </svg>
          </div>
          <div className="processing-text" style={{marginTop: '15px', color: 'white', fontWeight: 'bold', fontSize: '18px'}}>Procesando...</div>
        </div>
      )}
    </div>
  );
}

export default App;
