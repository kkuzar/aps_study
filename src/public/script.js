// public/script.js
const uploadForm = document.getElementById('uploadForm');
const rvtFileInput = document.getElementById('rvtFile');
const uploadButton = document.getElementById('uploadButton');
const statusArea = document.getElementById('statusArea');
const statusMessage = document.getElementById('statusMessage');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const downloadArea = document.getElementById('downloadArea');
const downloadButton = document.getElementById('downloadButton');
const downloadUrnSpan = document.getElementById('downloadUrn');
const errorArea = document.getElementById('errorArea');
const errorMessage = document.getElementById('errorMessage');

let socket;
let currentSocketId = null;

function connectWebSocket() {
    // Connect to the Socket.IO server
    // The server automatically serves the client library at /socket.io/socket.io.js
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to WebSocket server with ID:', socket.id);
        // We'll get the ID via the 'yourSocketId' event now
    });

    socket.on('yourSocketId', (id) => {
        console.log('Received Socket ID:', id);
        currentSocketId = id;
        // Enable upload form now that we have a socket ID
        uploadButton.disabled = false;
        statusMessage.textContent = 'Ready. Select an RVT file.';
    });


    socket.on('statusUpdate', (data) => {
        console.log('Status Update:', data);
        statusMessage.textContent = `Status: ${data.status}`;
        let progressPercent = 0;
        let progressStr = data.progress || '0%';

        if (typeof progressStr === 'string') {
            if (progressStr.includes('%')) {
                progressPercent = parseFloat(progressStr.replace('%', '')) || 0;
            } else if (data.status === 'uploading') {
                progressPercent = 10; // Assign arbitrary progress for stages
            } else if (data.status === 'processing') {
                progressPercent = 25;
            }
        }

        // Cap progress at 100
        progressPercent = Math.min(progressPercent, 100);

        progressBar.style.width = `${progressPercent}%`;
        progressText.textContent = typeof data.progress === 'string' ? data.progress : `${progressPercent}%`;

        // Show status area if hidden
        statusArea.style.display = 'block';
        errorArea.style.display = 'none'; // Hide errors on new status
    });

    socket.on('jobComplete', (data) => {
        console.log('Job Complete:', data);
        uploadButton.disabled = false; // Re-enable upload for another file
        rvtFileInput.value = ''; // Clear file input

        if (data.status === 'success') {
            statusMessage.textContent = 'Translation Successful!';
            progressBar.style.width = '100%';
            progressText.textContent = '100%';
            downloadUrnSpan.textContent = data.derivativeUrn; // Store the URN
            downloadArea.style.display = 'block';
            downloadButton.disabled = false;
            errorArea.style.display = 'none';
        } else {
            statusMessage.textContent = 'Translation Failed!';
            progressBar.style.width = '100%'; // Show full bar but maybe change color
            progressBar.style.backgroundColor = '#dc3545'; // Red for error
            progressText.textContent = 'Failed';
            downloadArea.style.display = 'none';
            downloadButton.disabled = true;
            errorMessage.textContent = data.message || 'An unknown error occurred.';
            errorArea.style.display = 'block';
        }
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server.');
        statusMessage.textContent = 'Disconnected. Please refresh the page.';
        uploadButton.disabled = true;
        downloadButton.disabled = true;
        currentSocketId = null;
    });

    socket.on('connect_error', (err) => {
        console.error('WebSocket connection error:', err);
        statusMessage.textContent = 'Connection error. Please refresh.';
        uploadButton.disabled = true;
        downloadButton.disabled = true;
    });
}

// --- Event Listeners ---
uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent default form submission

    if (!rvtFileInput.files || rvtFileInput.files.length === 0) {
        alert('Please select an RVT file.');
        return;
    }
    if (!currentSocketId) {
        alert('Not connected to server. Please wait or refresh.');
        return;
    }

    const file = rvtFileInput.files[0];
    const formData = new FormData();
    formData.append('rvtFile', file);
    formData.append('socketId', currentSocketId); // Send socket ID with the upload

    // Disable button, reset status
    uploadButton.disabled = true;
    downloadArea.style.display = 'none';
    downloadButton.disabled = true;
    errorArea.style.display = 'none';
    statusMessage.textContent = 'Uploading file...';
    progressBar.style.width = '5%'; // Initial progress indication
    progressBar.style.backgroundColor = '#4CAF50'; // Reset color
    progressText.textContent = 'Starting...';
    statusArea.style.display = 'block';


    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            // No 'Content-Type' header needed, browser sets it for FormData
        });

        const result = await response.json();

        if (!response.ok) {
            // Error handled by server sending 'jobComplete' failure via socket
            console.error('Upload request failed:', result.message);
            // UI update will happen via socket 'jobComplete' event
        } else {
            console.log('Upload initiated successfully:', result.message);
            // Status updates will now come via WebSocket
            statusMessage.textContent = 'Upload successful. Starting conversion...';
        }

    } catch (error) {
        console.error('Error submitting upload form:', error);
        statusMessage.textContent = 'Error starting upload.';
        errorMessage.textContent = `Client-side error: ${error.message}`;
        errorArea.style.display = 'block';
        uploadButton.disabled = false; // Re-enable on client error
    }
});

downloadButton.addEventListener('click', () => {
    const derivativeUrn = downloadUrnSpan.textContent;
    if (!derivativeUrn) {
        alert('Error: Derivative URN not found.');
        return;
    }

    console.log(`Requesting download for URN: ${derivativeUrn}`);
    // We will trigger the download by navigating to the backend endpoint
    // which will then stream the file or redirect to a signed URL.
    window.location.href = `/api/download-url/${derivativeUrn}`;

    // Optional: Provide feedback while download prepares
    downloadButton.textContent = 'Preparing Download...';
    downloadButton.disabled = true;
    setTimeout(() => { // Reset button after a delay
        downloadButton.textContent = 'Download IFC File';
        downloadButton.disabled = false;
    }, 5000); // Reset after 5 seconds
});

// --- Initial Setup ---
function initialize() {
    uploadButton.disabled = true; // Disable upload until socket connects
    statusMessage.textContent = 'Connecting to server...';
    connectWebSocket();
}

initialize(); // Start the connection process when the script loads