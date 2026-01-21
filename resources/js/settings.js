// Settings Manager for SB SNS UI

class SettingsManager {
    constructor() {
        this.scanPath = '';
        this.outputPath = '';
        this.autoReloadFlag = false;
        this.excludeFolders = [];  // Array of folder names to exclude
        this.STORAGE_KEY = 'sns_ui_settings';
    }

    // Initialize settings
    async init() {
        // Load saved settings
        await this.loadSettings();

        // Setup event listeners
        this.setupEventListeners();

        // Update UI with loaded settings
        this.updateUI();
    }

    // Setup event listeners
    setupEventListeners() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Scan path selection
        document.getElementById('selectScanPathBtn').addEventListener('click', () => {
            this.selectScanPath();
        });

        // Output path selection
        document.getElementById('selectOutputPathBtn').addEventListener('click', () => {
            this.selectOutputPath();
        });

        // Open scan path in explorer
        document.getElementById('openScanPathBtn').addEventListener('click', () => {
            this.openInExplorer(this.scanPath);
        });

        // Open output path in explorer
        document.getElementById('openOutputPathBtn').addEventListener('click', () => {
            // Open parent directory for file path
            if (this.outputPath) {
                const lastSlash = Math.max(this.outputPath.lastIndexOf('/'), this.outputPath.lastIndexOf('\\'));
                const directory = this.outputPath.substring(0, lastSlash);
                this.openInExplorer(directory);
            }
        });

        // Save settings
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.saveSettings();
        });

        // Reset settings
        document.getElementById('resetSettingsBtn').addEventListener('click', () => {
            this.resetSettings();
        });

        // Add exclude folder
        document.getElementById('addExcludeFolderBtn').addEventListener('click', () => {
            this.addExcludeFolder();
        });

        // Allow Enter key to add exclude folder
        document.getElementById('excludeFolderInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addExcludeFolder();
            }
        });
    }

    // Switch tab
    switchTab(tabName) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab content
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            if (content.id === `${tabName}TabContent`) {
                content.classList.add('active');
                content.style.display = 'block';
            } else {
                content.classList.remove('active');
                content.style.display = 'none';
            }
        });
    }

    // Select scan directory
    async selectScanPath() {
        try {
            const path = await Neutralino.os.showFolderDialog('Select mod directory containing *.dekcns.json files');
            if (path) {
                this.scanPath = path;
                document.getElementById('scanPathInput').value = path;
                await this.validatePaths();
            }
        } catch (error) {
            console.error('Error selecting scan path:', error);
            this.showToast('Error selecting directory: ' + error.message, 'error');
        }
    }

    // Select output file path
    async selectOutputPath() {
        try {
            // Use file dialog to select sns.settings.json
            const path = await Neutralino.os.showSaveDialog('Select or create sns.settings.json file', {
                filters: [
                    { name: 'JSON Files', extensions: ['json'] }
                ]
            });

            if (path) {
                // Ensure it ends with .json
                let finalPath = path;
                if (!finalPath.toLowerCase().endsWith('.json')) {
                    finalPath += '.json';
                }

                this.outputPath = finalPath;
                document.getElementById('outputPathInput').value = finalPath;
                await this.validatePaths();
            }
        } catch (error) {
            console.error('Error selecting output path:', error);
            this.showToast('Error selecting file: ' + error.message, 'error');
        }
    }

    // Validate paths
    async validatePaths() {
        const scanPathStatus = document.getElementById('scanPathStatus');
        const outputPathStatus = document.getElementById('outputPathStatus');
        const openScanBtn = document.getElementById('openScanPathBtn');
        const openOutputBtn = document.getElementById('openOutputPathBtn');

        // Validate scan path
        if (!this.scanPath) {
            scanPathStatus.textContent = 'Not set';
            scanPathStatus.className = 'validation-status not-set';
            openScanBtn.disabled = true;
        } else {
            try {
                // Check if directory exists
                await Neutralino.filesystem.readDirectory(this.scanPath);
                scanPathStatus.textContent = '✓ Valid';
                scanPathStatus.className = 'validation-status valid';
                openScanBtn.disabled = false;
            } catch (error) {
                scanPathStatus.textContent = '✗ Invalid or inaccessible';
                scanPathStatus.className = 'validation-status invalid';
                openScanBtn.disabled = true;
            }
        }

        // Validate output path
        if (!this.outputPath) {
            outputPathStatus.textContent = 'Not set';
            outputPathStatus.className = 'validation-status not-set';
            openOutputBtn.disabled = true;
        } else {
            // Extract directory from file path
            const lastSlash = Math.max(this.outputPath.lastIndexOf('/'), this.outputPath.lastIndexOf('\\'));
            const directory = this.outputPath.substring(0, lastSlash);

            try {
                // Check if parent directory exists
                await Neutralino.filesystem.readDirectory(directory);
                outputPathStatus.textContent = '✓ Valid (parent directory exists)';
                outputPathStatus.className = 'validation-status valid';
                openOutputBtn.disabled = false;
            } catch (error) {
                outputPathStatus.textContent = '✗ Parent directory does not exist';
                outputPathStatus.className = 'validation-status invalid';
                openOutputBtn.disabled = true;
            }
        }
    }

    // Add exclude folder
    addExcludeFolder() {
        const input = document.getElementById('excludeFolderInput');
        let folderName = input.value.trim();

        if (!folderName) {
            this.showToast('Please enter a folder name', 'error');
            return;
        }

        // Remove any path separators (only folder name is needed)
        if (folderName.includes('/') || folderName.includes('\\')) {
            this.showToast('Please enter folder name only (without path separators)', 'error');
            return;
        }

        // Check if already exists
        if (this.excludeFolders.includes(folderName)) {
            this.showToast('Folder already in exclude list', 'error');
            return;
        }

        // Add to list
        this.excludeFolders.push(folderName);
        input.value = '';
        this.renderExcludeFolders();
    }

    // Remove exclude folder
    removeExcludeFolder(folderName) {
        this.excludeFolders = this.excludeFolders.filter(f => f !== folderName);
        this.renderExcludeFolders();
    }

    // Render exclude folders list
    renderExcludeFolders() {
        const container = document.getElementById('excludeFoldersList');

        if (this.excludeFolders.length === 0) {
            container.innerHTML = '<p class="empty-state">No folders excluded</p>';
            return;
        }

        let html = '';
        this.excludeFolders.forEach(folderName => {
            html += '<div class="exclude-folder-item">';
            html += `<span class="exclude-folder-name">${this.escapeHtml(folderName)}</span>`;
            html += `<button class="exclude-folder-remove" data-folder="${this.escapeHtml(folderName)}">Remove</button>`;
            html += '</div>';
        });

        container.innerHTML = html;

        // Attach event listeners
        container.querySelectorAll('.exclude-folder-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeExcludeFolder(btn.dataset.folder);
            });
        });
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Save settings to Neutralino storage
    async saveSettings() {
        try {
            // Get autoReloadFlag from checkbox
            this.autoReloadFlag = document.getElementById('autoReloadFlag').checked;

            const settings = {
                scanPath: this.scanPath,
                outputPath: this.outputPath,
                autoReloadFlag: this.autoReloadFlag,
                excludeFolders: this.excludeFolders
            };

            await Neutralino.storage.setData(this.STORAGE_KEY, JSON.stringify(settings));
            console.log('Settings saved:', settings);
            this.showToast('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showToast('Error saving settings: ' + error.message, 'error');
        }
    }

    // Load settings from Neutralino storage
    async loadSettings() {
        try {
            const data = await Neutralino.storage.getData(this.STORAGE_KEY);
            if (data) {
                const settings = JSON.parse(data);
                this.scanPath = settings.scanPath || '';
                this.outputPath = settings.outputPath || '';
                this.autoReloadFlag = settings.autoReloadFlag || false;
                this.excludeFolders = settings.excludeFolders || [];
                console.log('Settings loaded:', settings);
            }
        } catch (error) {
            console.log('No existing settings found, using defaults');
        }
    }

    // Update UI with current settings
    updateUI() {
        document.getElementById('scanPathInput').value = this.scanPath;
        document.getElementById('outputPathInput').value = this.outputPath;
        document.getElementById('autoReloadFlag').checked = this.autoReloadFlag;
        this.renderExcludeFolders();
        this.validatePaths();
    }

    // Reset settings
    async resetSettings() {
        if (!confirm('Are you sure you want to reset all settings to default?')) {
            return;
        }

        try {
            this.scanPath = '';
            this.outputPath = '';
            this.autoReloadFlag = false;
            this.excludeFolders = [];
            await Neutralino.storage.setData(this.STORAGE_KEY, JSON.stringify({}));
            this.updateUI();
            this.showToast('Settings reset successfully!');
        } catch (error) {
            console.error('Error resetting settings:', error);
            this.showToast('Error resetting settings: ' + error.message, 'error');
        }
    }

    // Get current settings
    getSettings() {
        return {
            scanPath: this.scanPath,
            outputPath: this.outputPath,
            autoReloadFlag: this.autoReloadFlag,
            excludeFolders: this.excludeFolders
        };
    }

    // Show toast notification
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');

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

    // Open path in file explorer
    async openInExplorer(path) {
        if (!path) {
            this.showToast('No path set', 'error');
            return;
        }

        try {
            // Get OS info
            const osInfo = await Neutralino.os.getEnv('OS');

            // Normalize path for the OS
            let normalizedPath = path;

            // Detect Windows by checking for backslashes or drive letters
            const isWindows = path.includes('\\') || /^[A-Z]:/i.test(path);

            if (isWindows) {
                // Windows: use explorer.exe
                normalizedPath = path.replace(/\//g, '\\');
                await Neutralino.os.execCommand(`explorer.exe "${normalizedPath}"`);
            } else {
                // Linux/Mac: use xdg-open or open
                normalizedPath = path.replace(/\\/g, '/');
                try {
                    // Try xdg-open first (Linux)
                    await Neutralino.os.execCommand(`xdg-open "${normalizedPath}"`);
                } catch (error) {
                    // Fall back to open (macOS)
                    await Neutralino.os.execCommand(`open "${normalizedPath}"`);
                }
            }
        } catch (error) {
            console.error('Error opening path in explorer:', error);
            this.showToast('Could not open path in explorer: ' + error.message, 'error');
        }
    }
}

// Export global instance
const settingsManager = new SettingsManager();
