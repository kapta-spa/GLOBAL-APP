import React, { useState, useEffect } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { Mail, Check, LogOut, RefreshCw, Inbox, FolderPlus, X, FolderKanban, CheckCircle2, FolderOpen, Trash2, Briefcase } from 'lucide-react';
import './index.css';

const GOOGLE_API_SCOPES = 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.labels';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  
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
  
  const [trackingNumber, setTrackingNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Target folder state
  const [targetMonthFolder, setTargetMonthFolder] = useState(() => {
    const saved = localStorage.getItem('targetMonthFolder');
    return saved ? JSON.parse(saved) : null;
  });

  const login = useGoogleLogin({
    onSuccess: (codeResponse) => {
      setToken(codeResponse.access_token);
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
  };

  const fetchUserProfile = async (accessToken) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      setUser(data);
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
      const data = await res.json();
      
      if (data.messages && data.messages.length > 0) {
        const messageDetails = await Promise.all(
          data.messages.map(async (msg) => {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
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

          return {
            id: msg.id,
            threadId: msg.threadId,
            snippet: msg.snippet,
            subject,
            sender: senderName,
            date: new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })
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

  const handleAssignTracking = async () => {
    if (!trackingNumber.trim() || selectedIds.size === 0) return;
    setProcessing(true);
    try {
      const newLabelName = `0. Work/0. 1 HOUR/0. DL IN PROGRESS/${trackingNumber}`;
      let labelId = null;
      
      const createLabelRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLabelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
      });
      
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
      setIsTrackingModalOpen(false);
      setTrackingNumber('');
    } catch (err) {
      console.error('Failed to process emails', err);
      alert('Error processing emails. Check console.');
    } finally {
      setProcessing(false);
    }
  };

  const handleTrashEmails = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX']
        })
      });
      setEmails(emails.filter(e => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to trash emails', err);
      alert('Error trashing emails.');
    } finally {
      setProcessing(false);
    }
  };

  const handleWorkLabel = async () => {
    if (selectedIds.size === 0) return;
    setProcessing(true);
    try {
      // Find the ID for "0. Work"
      const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const listData = await listRes.json();
      let workLabel = listData.labels.find(l => l.name === '0. Work');
      
      // If it doesn't exist, create it (just in case)
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
      alert('Error etiquetando como 0. Work');
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
        
        await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${label.id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newName
          })
        });
      }

      await fetchProgressLabels(token);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to move labels', err);
      alert('Error al mover etiquetas. Puede que ya exista una con ese nombre.');
    } finally {
      setProcessing(false);
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
        <h1 className="login-title">Sales Inbox Flow</h1>
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
        <div className="app-title">Sales Inbox</div>
        <div style={{display: 'flex', gap: '10px'}}>
          <button className={`btn-icon ${loading ? 'spinning' : ''}`} onClick={() => refreshData()} title="Refresh">
            <RefreshCw size={20} />
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

      {loading ? (
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
                    onClick={() => toggleSelection(email.id)}
                  >
                    <div className="checkbox-container">
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
                    <div className="email-content" style={{ display: 'flex', alignItems: 'center', minHeight: '32px' }}>
                      <FolderKanban size={18} style={{ marginRight: '12px', color: 'var(--accent-color)' }} />
                      <div className="email-subject" style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {label.displayName}
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
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Trash Action */}
            <button 
              className="btn-primary" 
              style={{ backgroundColor: 'var(--danger-color)', padding: '10px' }}
              onClick={handleTrashEmails}
              disabled={processing}
              title="Mover a papelera"
            >
              <Trash2 size={18} />
            </button>

            {/* 0. Work Action */}
            <button 
              className="btn-primary" 
              style={{ backgroundColor: 'var(--surface-hover)', padding: '10px 16px' }}
              onClick={handleWorkLabel}
              disabled={processing}
            >
              <Briefcase size={18} />
              0. Work
            </button>

            {/* DL IN PROGRESS Action */}
            <button 
              className="btn-primary" 
              onClick={() => setIsTrackingModalOpen(true)}
              disabled={processing}
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
            onClick={handleAssignTracking}
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

    </div>
  );
}

export default App;
