// SB SNS UI - Main Application

// Global state
let isInitialized = false;

// Global toast function
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;

    const icon = document.createElement('div');
    icon.className = 'toast-icon';
    icon.textContent = type === 'error' ? '❌' : '✅';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'toast-message';
    messageDiv.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(messageDiv);
    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Initialize app
async function initApp() {
    try {
        // Check for single instance
        const isSingleInstance = await SingleInstanceManager.init();

        if (!isSingleInstance) {
            // Another instance is running, exit this instance immediately
            Neutralino.app.exit();
            return;
        }

        // Initialize database
        const success = await dbManager.init();

        if (!success) {
            showToast('Failed to initialize database!', 'error');
            return;
        }

        // Initialize settings manager
        await settingsManager.init();

        // Initialize selection manager
        await selectionManager.init();

        // Load previous configuration if exists
        await selectionManager.loadPreviousConfiguration();

        isInitialized = true;
    } catch (error) {
        console.error('App initialization failed:', error);
        showToast('Failed to initialize app: ' + error.message, 'error');
    }
}


// Handle window close
async function onWindowClose() {
    // Cleanup single instance lock
    await SingleInstanceManager.cleanup();

    // Neutralino automatically saves window state, so we just exit
    Neutralino.app.exit();
}

// Initialize Neutralino
Neutralino.init();

// Register event listeners
Neutralino.events.on("windowClose", onWindowClose);

// Wait for DOM and initialize app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
