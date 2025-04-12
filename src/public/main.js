const rvtFileInput = document.getElementById('rvtFile');
const uploadButton = document.getElementById('uploadButton');
const uploadStatus = document.getElementById('uploadStatus');
const urnDisplay = document.getElementById('urnDisplay');
const translationStatus = document.getElementById('translationStatus');
const translationProgress = document.getElementById('translationProgress');
const downloadIfcButton = document.getElementById('downloadIfcButton');
const loadViewerButton = document.getElementById('loadViewerButton');
const viewerDiv = document.getElementById('apsViewer');

let currentUrn = null; // Store the URN of the uploaded file
let viewer = null;
let ifcDownloadUrn = null; // Store the URN of the downloadable IFC derivative

let socket = null;

// --- Socket.IO Setup ---
function setupSocket() {
    socket = io();

    socket.on('connection', () => {
        console.log('Connected to Socket.IO server:', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from Socket.IO server');
        updateTranslationStatus('Disconnected from status updates.', 'N/A');
    });

    socket.on('translation-status', (data) => {
        console.log('Received status update:', data);
        if (data.urn === currentUrn) { // Only update if it's for the current file
            updateTranslationStatus(data.status, data.progress);
            if (data.status === 'success' && data.ifcUrn) {
                ifcDownloadUrn = data.ifcUrn; // Store the derivative URN
                downloadIfcButton.disabled = false;
                console.log('IFC derivative ready for download:', ifcDownloadUrn);
            } else if (data.status === 'failed' || data.status === 'timeout') {
                downloadIfcButton.disabled = true;
                ifcDownloadUrn = null;
            }
        }
    });
}

setupSocket();

// --- UI Event Listeners ---
uploadButton.addEventListener('click', handleUploadAndTranslate);
loadViewerButton.addEventListener('click', launchViewer);
downloadIfcButton.addEventListener('click', downloadIfc);

// --- Functions ---

async function handleUploadAndTranslate() {
    const file = rvtFileInput.files[0];
    if (!file) {
        updateUploadStatus('Please select an RVT file first.');
        return;
    }

    // Disable buttons during processing
    uploadButton.disabled = true;
    loadViewerButton.disabled = true;
    downloadIfcButton.disabled = true;
    updateUploadStatus('Uploading file...');
    updateTranslationStatus('Status: Idle', 'Progress: 0%');
    urnDisplay.textContent = 'N/A';
    currentUrn = null;
    ifcDownloadUrn = null;

    const formData = new FormData();
    formData.append('rvtFile', file);

    try {
        // 1. Upload the file
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`Upload failed: ${errorData.message || uploadResponse.statusText}`);
        }

        const uploadResult = await uploadResponse.json();
        currentUrn = uploadResult.urn; // Store the source URN
        updateUploadStatus(`Upload successful! URN: ${currentUrn}`);
        urnDisplay.textContent = currentUrn;
        loadViewerButton.disabled = false; // Enable viewer button

        // 2. Start the translation job
        updateTranslationStatus('Starting translation...', '0%');
        const translateResponse = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urn: currentUrn }),
        });

        if (!translateResponse.ok) {
            const errorData = await translateResponse.json();
            throw new Error(`Translation start failed: ${errorData.message || translateResponse.statusText}`);
        }

        const translateResult = await translateResponse.json();
        updateTranslationStatus('Translation job submitted. Waiting for updates...', '0%');
        console.log('Translation job info:', translateResult);

        // 3. Tell the server (via Socket.IO) to start monitoring this URN
        socket.emit('monitor-translation', currentUrn);

    } catch (error) {
        console.error('Error during upload/translate:', error);
        updateUploadStatus(`Error: ${error.message}`);
        updateTranslationStatus('Status: Error', 'Progress: N/A');
    } finally {
        uploadButton.disabled = false; // Re-enable upload button even on error
    }
}

function updateUploadStatus(message) {
    uploadStatus.textContent = message;
}

function updateTranslationStatus(status, progress) {
    translationStatus.textContent = `Status: ${status}`;
    translationProgress.textContent = `Progress: ${progress}`;
}

async function getViewerToken() {
    try {
        const response = await fetch('/api/auth/token');
        if (!response.ok) {
            throw new Error('Failed to get viewer token');
        }
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Error fetching viewer token:', error);
        alert('Could not get token for viewer. See console for details.');
        return null;
    }
}

function launchViewer() {
    if (!currentUrn) {
        alert('No file uploaded yet.');
        return;
    }
    if (viewer) {
        // If viewer exists, just load the new document
        loadDocument(currentUrn);
        return;
    }

    const options = {
        env: 'AutodeskProduction', // Use 'AutodeskStaging' for staging environment
        getAccessToken: async (onSuccess) => {
            const token = await getViewerToken();
            if (token) {
                const expiresInSeconds = 3599; // Approx 1 hour
                onSuccess(token, expiresInSeconds);
            } else {
                console.error("Failed to obtain viewer token for initialization.");
                // Optionally handle error for the user
            }
        },
        api: 'derivativeV2', // for models uploaded to OSS
        // api: 'derivativeV2_EU', // for models uploaded to EMEA region OSS
        // api: 'derivativeV2_AUS', // for models uploaded to AUS region OSS
    };

    Autodesk.Viewing.Initializer(options, () => {
        viewer = new Autodesk.Viewing.GuiViewer3D(viewerDiv);
        viewer.start();
        loadDocument(currentUrn);
    });
}

function loadDocument(urn) {
    const documentId = 'urn:' + btoa(urn).replace(/=/g, ''); // Base64 URL-safe encode
    Autodesk.Viewing.Document.load(documentId, onDocumentLoadSuccess, onDocumentLoadFailure);
}

function onDocumentLoadSuccess(doc) {
    const viewables = doc.getRoot().getDefaultGeometry();
    if (viewables) {
        viewer.loadDocumentNode(doc, viewables).then(i => {
            // Document loaded successfully
            console.log('Viewer document loaded.');
        });
    } else {
        console.error('Document contains no viewables.');
        alert('This document does not contain any viewable geometry.');
    }
}

function onDocumentLoadFailure(viewerErrorCode, viewerErrorMsg) {
    console.error('Viewer load failed - errorCode:' + viewerErrorCode + ' msg:' + viewerErrorMsg);
    alert('Could not load document in viewer. See console for details.');
}

function downloadIfc() {
    if (!currentUrn) {
        alert('No source URN available.');
        return;
    }
    if (!ifcDownloadUrn) {
        alert('IFC derivative URN not available or translation not complete.');
        return;
    }
    // Redirect the browser to the download endpoint
    // The backend will handle getting the signed URL and redirecting again

    const downloadUrl =  fetch(`/api/download/ifc?urn=${currentUrn}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json())
        .then(data=>{
            const url = data.url
            window.open(url, '_blank');
            return url
        });

    downloadUrl.then(url => {
       if(url){
           console.log('Download URL: ' + url);
       }
    });

    // window.open(downloadUrl, '_blank');
}