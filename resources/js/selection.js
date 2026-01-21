// Selection Manager for SB SNS UI

class SelectionManager {
    constructor() {
        this.allFiles = [];
        this.selectedItems = [];  // Array of {file, enabled, order}
        this.currentCharacter = 'EVE';
        this.currentMeshFilter = 'ALL';  // New: mesh type filter
        this.searchQuery = '';  // New: search query
        this.sortOrders = {};  // Track sort order for each mesh section: 'asc' or 'desc'

        // Define which mesh types use radio vs checkbox
        this.radioMeshTypes = ['Body', 'Face', 'Hair', 'Weapon'];
        this.checkboxMeshTypes = ['PonyTail', 'Ears', 'Eyes'];
    }

    // Initialize selection manager
    async init() {
        // Setup event listeners
        this.setupEventListeners();

        // Load files from database
        await this.loadFiles();
    }

    // Setup event listeners
    setupEventListeners() {
        // Character tab switching
        const charTabs = document.querySelectorAll('.char-tab-btn');
        charTabs.forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchCharacter(btn.dataset.character);
            });
        });

        // Mesh type filter switching
        const meshFilterBtns = document.querySelectorAll('.mesh-filter-btn');
        meshFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchMeshFilter(btn.dataset.meshType);
            });
        });

        // Search input
        const searchInput = document.getElementById('searchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');

        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();
            clearSearchBtn.style.display = this.searchQuery ? 'block' : 'none';
            this.renderCharacterContent();
        });

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            this.searchQuery = '';
            clearSearchBtn.style.display = 'none';
            this.renderCharacterContent();
            searchInput.focus();
        });

        // Scan button
        document.getElementById('selectDirBtn').addEventListener('click', async () => {
            await this.handleScan();
        });

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', async () => {
            await this.loadFiles();
        });

        // Save button
        document.getElementById('saveSelectionBtn').addEventListener('click', async () => {
            await this.saveConfiguration();
        });
    }

    // Handle scan
    async handleScan() {
        const settings = settingsManager.getSettings();

        if (!settings.scanPath) {
            this.showToast('Please set scan path in Settings first!', 'error');
            settingsManager.switchTab('settings');
            return;
        }

        try {
            document.getElementById('selectDirBtn').disabled = true;
            document.getElementById('refreshBtn').disabled = true;

            await fileScanner.scanAndImport(
                settings.scanPath,
                dbManager,
                this.updateProgress.bind(this),
                settings.excludeFolders || []
            );

            await this.loadFiles();

            document.getElementById('selectDirBtn').disabled = false;
            document.getElementById('refreshBtn').disabled = false;
        } catch (error) {
            console.error('Error scanning:', error);
            this.showToast('Error scanning directory: ' + error.message, 'error');

            document.getElementById('selectDirBtn').disabled = false;
            document.getElementById('refreshBtn').disabled = false;
        }
    }

    // Update progress
    updateProgress(progress) {
        const progressPanel = document.getElementById('progress');
        const progressText = document.getElementById('progressText');
        const progressFill = document.getElementById('progressFill');

        switch (progress.stage) {
            case 'scanning':
                progressPanel.style.display = 'block';
                progressText.textContent = progress.message;
                progressFill.style.width = '10%';
                break;
            case 'found':
                progressText.textContent = progress.message;
                progressFill.style.width = '30%';
                break;
            case 'importing':
                const percent = 30 + (progress.current / progress.total) * 60;
                progressText.textContent = `${progress.message} (${progress.current}/${progress.total})`;
                progressFill.style.width = percent + '%';
                break;
            case 'complete':
                progressText.textContent = progress.message;
                progressFill.style.width = '100%';
                setTimeout(() => {
                    progressPanel.style.display = 'none';
                    progressFill.style.width = '0%';
                }, 2000);
                break;
        }
    }

    // Load files from database
    async loadFiles() {
        this.allFiles = dbManager.getAllFiles();
        console.log('Loaded files:', this.allFiles.length);

        if (this.allFiles.length > 0) {
            document.getElementById('refreshBtn').disabled = false;
        }

        this.renderCharacterContent();
    }

    // Switch character tab
    switchCharacter(character) {
        this.currentCharacter = character;

        // Update active tab
        const charTabs = document.querySelectorAll('.char-tab-btn');
        charTabs.forEach(btn => {
            if (btn.dataset.character === character) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Render content for selected character
        this.renderCharacterContent();
    }

    // Switch mesh type filter
    switchMeshFilter(meshType) {
        this.currentMeshFilter = meshType;

        // Update active filter button
        const filterBtns = document.querySelectorAll('.mesh-filter-btn');
        filterBtns.forEach(btn => {
            if (btn.dataset.meshType === meshType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Render content with filter applied
        this.renderCharacterContent();
    }

    // Render character content
    renderCharacterContent() {
        const container = document.getElementById('characterContent');

        // Filter files by current character
        let characterFiles = this.allFiles.filter(file => {
            const charId = (file.character_id || 'EVE').toUpperCase();
            // If ALL is selected, show all characters
            if (this.currentCharacter === 'ALL') {
                return true;
            }
            return charId === this.currentCharacter;
        });

        // Apply search filter
        if (this.searchQuery) {
            characterFiles = characterFiles.filter(file => {
                const displayName = this.getDisplayName(file).toLowerCase();
                const uniqueFitID = this.getUniqueFitID(file).toLowerCase();
                return displayName.includes(this.searchQuery) || uniqueFitID.includes(this.searchQuery);
            });
        }

        if (characterFiles.length === 0) {
            const message = this.searchQuery
                ? 'No items found matching "' + this.searchQuery + '"'
                : 'No items found for ' + this.currentCharacter;
            container.innerHTML = '<p class="empty-state">' + message + '</p>';
            return;
        }

        // Group by FitMeshType
        const grouped = this.groupByMeshType(characterFiles);

        // Render sections
        let html = '';

        // Radio sections (single selection)
        ['Body', 'Face', 'Hair', 'Weapon'].forEach(meshType => {
            // Apply mesh type filter
            if (this.currentMeshFilter !== 'ALL' && this.currentMeshFilter !== meshType) {
                return;
            }
            if (grouped[meshType] && grouped[meshType].length > 0) {
                html += this.renderMeshSection(meshType, grouped[meshType], 'radio');
            }
        });

        // Checkbox sections (multiple selection)
        ['PonyTail', 'Ears', 'Eyes'].forEach(meshType => {
            // Apply mesh type filter
            if (this.currentMeshFilter !== 'ALL' && this.currentMeshFilter !== meshType) {
                return;
            }
            if (grouped[meshType] && grouped[meshType].length > 0) {
                html += this.renderMeshSection(meshType, grouped[meshType], 'checkbox');
            }
        });

        container.innerHTML = html || '<p class="empty-state">No compatible items found</p>';

        // Attach selection event listeners
        this.attachSelectionListeners();
    }

    // Group files by mesh type
    groupByMeshType(files) {
        const grouped = {};

        files.forEach(file => {
            const content = file.content;
            if (!Array.isArray(content) || content.length === 0) return;

            const firstItem = content[0];
            const fitMeshType = (firstItem.FitMeshType || 'Body');
            const meshSubType = firstItem.MeshSubType || '';

            // Determine final mesh type
            let meshType = fitMeshType;
            if (fitMeshType === 'Hair' && meshSubType === 'PonyTail') {
                meshType = 'PonyTail';
            }

            if (!grouped[meshType]) {
                grouped[meshType] = [];
            }
            grouped[meshType].push(file);
        });

        return grouped;
    }

    // Render mesh section
    renderMeshSection(meshType, files, inputType) {
        const sectionName = this.getMeshTypeName(meshType);
        const groupName = `${this.currentCharacter}_${meshType}`;
        const sectionKey = `${this.currentCharacter}_${meshType}`;

        // Get current sort order (default to ascending)
        if (!this.sortOrders[sectionKey]) {
            this.sortOrders[sectionKey] = 'asc';
        }
        const sortOrder = this.sortOrders[sectionKey];

        // Sort files by DisplayName
        const sortedFiles = [...files].sort((a, b) => {
            const nameA = this.getDisplayName(a).toLowerCase();
            const nameB = this.getDisplayName(b).toLowerCase();
            if (sortOrder === 'asc') {
                return nameA.localeCompare(nameB);
            } else {
                return nameB.localeCompare(nameA);
            }
        });

        let html = `<div class="mesh-section">`;
        html += `<div class="mesh-section-header">`;
        html += `<h4>${sectionName} (${inputType === 'radio' ? 'Select One' : 'Select Multiple'})</h4>`;
        html += `<button class="sort-btn" data-section="${sectionKey}" title="Toggle sort order">`;
        html += sortOrder === 'asc' ? '🔼 A-Z' : '🔽 Z-A';
        html += `</button>`;
        html += `</div>`;
        html += `<div class="mesh-items">`;

        sortedFiles.forEach(file => {
            const displayName = this.getDisplayName(file);
            const uniqueFitID = this.getUniqueFitID(file);
            const isSelected = this.isItemSelected(file.id);

            // Use actual character_id for radio group name (important when currentCharacter is 'ALL')
            const fileCharId = (file.character_id || 'EVE').toUpperCase();
            const actualGroupName = `${fileCharId}_${meshType}`;

            html += `<div class="selection-item">`;
            html += `<label>`;
            html += `<input type="${inputType}" name="${actualGroupName}" value="${file.id}" ${isSelected ? 'checked' : ''}>`;
            html += `<div style="flex: 1;">`;
            html += `<div class="selection-item-name">${this.escapeHtml(displayName)}</div>`;
            html += `<div class="selection-item-id">${this.escapeHtml(uniqueFitID)}</div>`;
            html += `</div>`;
            html += `</label>`;
            html += `</div>`;
        });

        html += `</div>`;
        html += `</div>`;

        return html;
    }

    // Get mesh type display name
    getMeshTypeName(meshType) {
        const names = {
            'Body': '🧥 Body (Nanosuit)',
            'Face': '😊 Face',
            'Hair': '💇 Hair',
            'Weapon': '⚔️ Weapon',
            'PonyTail': '🎀 Ponytail',
            'Ears': '👂 Ears',
            'Eyes': '👓 Eyes'
        };
        return names[meshType] || meshType;
    }

    // Get display name from file
    getDisplayName(file) {
        try {
            if (Array.isArray(file.content) && file.content.length > 0 && file.content[0].DisplayName) {
                return file.content[0].DisplayName;
            }
        } catch (e) {
            console.warn('Failed to extract DisplayName:', e);
        }
        return file.file_name;
    }

    // Get UniqueFitID from file
    getUniqueFitID(file) {
        try {
            if (Array.isArray(file.content) && file.content.length > 0 && file.content[0].UniqueFitID) {
                return file.content[0].UniqueFitID;
            }
        } catch (e) {
            console.warn('Failed to extract UniqueFitID:', e);
        }
        return 'Unknown';
    }

    // Check if item is selected
    isItemSelected(fileId) {
        return this.selectedItems.some(item => item.file.id === fileId);
    }

    // Attach selection listeners
    attachSelectionListeners() {
        const inputs = document.querySelectorAll('.selection-item input[type="radio"], .selection-item input[type="checkbox"]');
        inputs.forEach(input => {
            input.addEventListener('change', (e) => {
                this.handleSelectionChange(e.target);
            });
        });

        // Attach sort button listeners
        const sortBtns = document.querySelectorAll('.sort-btn');
        sortBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleSort(btn.dataset.section);
            });
        });
    }

    // Toggle sort order
    toggleSort(sectionKey) {
        if (this.sortOrders[sectionKey] === 'asc') {
            this.sortOrders[sectionKey] = 'desc';
        } else {
            this.sortOrders[sectionKey] = 'asc';
        }
        this.renderCharacterContent();
    }

    // Handle selection change
    handleSelectionChange(input) {
        const fileId = parseInt(input.value);
        const file = this.allFiles.find(f => f.id === fileId);

        if (!file) return;

        if (input.type === 'radio') {
            // Radio: remove other items of same type from same character
            const content = file.content[0];
            const fitMeshType = content.FitMeshType || 'Body';
            const charId = (file.character_id || 'EVE').toUpperCase();

            this.selectedItems = this.selectedItems.filter(item => {
                const itemContent = item.file.content[0];
                const itemMeshType = itemContent.FitMeshType || 'Body';
                const itemCharId = (item.file.character_id || 'EVE').toUpperCase();

                return !(itemMeshType === fitMeshType && itemCharId === charId);
            });

            // Add new selection
            if (input.checked) {
                this.selectedItems.push({
                    file: file,
                    enabled: true,
                    order: this.selectedItems.length
                });
            }
        } else {
            // Checkbox: toggle
            if (input.checked) {
                if (!this.isItemSelected(fileId)) {
                    this.selectedItems.push({
                        file: file,
                        enabled: true,
                        order: this.selectedItems.length
                    });
                }
            } else {
                this.selectedItems = this.selectedItems.filter(item => item.file.id !== fileId);
            }
        }

        // Update selected items display
        this.renderSelectedItems();
    }

    // Render selected items
    renderSelectedItems() {
        const container = document.getElementById('selectedItemsList');
        const saveBtn = document.getElementById('saveSelectionBtn');

        if (this.selectedItems.length === 0) {
            container.innerHTML = '<p class="empty-state">No items selected</p>';
            saveBtn.disabled = true;
            return;
        }

        saveBtn.disabled = false;

        let html = '';
        this.selectedItems.forEach((item, index) => {
            const displayName = this.getDisplayName(item.file);
            const uniqueFitID = this.getUniqueFitID(item.file);
            const charId = (item.file.character_id || 'EVE').toUpperCase();
            const content = item.file.content[0];
            const meshType = content.FitMeshType || 'Body';

            html += `<div class="selected-item-card" draggable="true" data-index="${index}">`;
            html += `<div class="selected-item-header">`;
            html += `<span class="drag-handle">☰</span>`;
            html += `<span class="selected-item-name">${this.escapeHtml(displayName)}</span>`;
            html += `<div class="selected-item-actions">`;
            html += `<button class="open-location-btn" data-index="${index}" title="Open file location in Explorer">📂</button>`;
            html += `<button class="toggle-btn ${item.enabled ? 'enabled' : 'disabled'}" data-index="${index}">`;
            html += item.enabled ? 'ON' : 'OFF';
            html += `</button>`;
            html += `<button class="remove-btn" data-index="${index}">✕</button>`;
            html += `</div>`;
            html += `</div>`;
            html += `<div class="selected-item-details">`;
            html += `${charId} / ${meshType} / ${this.escapeHtml(uniqueFitID)}`;
            html += `</div>`;
            html += `</div>`;
        });

        container.innerHTML = html;

        // Attach event listeners for selected items
        this.attachSelectedItemListeners();
    }

    // Attach selected item listeners
    attachSelectedItemListeners() {
        // Open location buttons
        document.querySelectorAll('.open-location-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent triggering card click
                const index = parseInt(e.target.dataset.index);
                const filePath = this.selectedItems[index].file.file_path;
                await this.openFileLocation(filePath);
            });
        });

        // Toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.selectedItems[index].enabled = !this.selectedItems[index].enabled;
                this.renderSelectedItems();
            });
        });

        // Remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                const fileId = this.selectedItems[index].file.id;

                // Remove from selected items
                this.selectedItems.splice(index, 1);

                // Uncheck in UI
                const input = document.querySelector(`.selection-item input[value="${fileId}"]`);
                if (input) input.checked = false;

                this.renderSelectedItems();
            });
        });

        // Click on card to open UserConfigs
        document.querySelectorAll('.selected-item-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking buttons
                if (e.target.closest('.toggle-btn') || e.target.closest('.remove-btn')) {
                    return;
                }
                const index = parseInt(card.dataset.index);
                this.openUserConfigsPanel(index);
            });
        });

        // Close UserConfigs panel
        const closeBtn = document.getElementById('closeConfigPanelBtn');
        if (closeBtn) {
            closeBtn.onclick = () => this.closeUserConfigsPanel();
        }

        // Drag and drop
        this.setupDragAndDrop();
    }

    // Setup drag and drop
    setupDragAndDrop() {
        const cards = document.querySelectorAll('.selected-item-card');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.dataset.index);
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', (e) => {
                card.classList.remove('dragging');
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(card.dataset.index);

                if (fromIndex !== toIndex) {
                    // Reorder items
                    const item = this.selectedItems.splice(fromIndex, 1)[0];
                    this.selectedItems.splice(toIndex, 0, item);
                    this.renderSelectedItems();
                }
            });
        });
    }

    // Open UserConfigs panel
    openUserConfigsPanel(itemIndex) {
        this.currentEditingIndex = itemIndex;
        const item = this.selectedItems[itemIndex];
        const content = item.file.content[0];
        const userConfigs = content.UserConfigs;
        const outfitPaths = content.OutfitPaths;

        const panel = document.getElementById('userConfigsPanel');
        const contentDiv = document.getElementById('userConfigsContent');

        // Hide character content and controls
        document.querySelector('.control-panel').style.display = 'none';
        document.querySelector('.character-tabs').style.display = 'none';
        document.querySelector('.mesh-type-filter').style.display = 'none';
        document.querySelector('.search-box').style.display = 'none';
        document.getElementById('characterContent').style.display = 'none';

        const hasUserConfigs = userConfigs && Object.keys(userConfigs).length > 0;
        const hasMultipleOutfitPaths = outfitPaths && Array.isArray(outfitPaths) && outfitPaths.length > 1;

        if (!hasUserConfigs && !hasMultipleOutfitPaths) {
            contentDiv.innerHTML = '<p class="no-configs-msg">This item has no UserConfigs or OutfitPath options available.</p>';
            panel.style.display = 'flex';
            return;
        }

        // Render UserConfigs
        let html = '';

        // OutfitPath selection (if multiple paths exist)
        if (hasMultipleOutfitPaths) {
            html += this.renderOutfitPathOptions(outfitPaths, item);
        }

        // ShapeKeys
        if (userConfigs && userConfigs.ShapeKeys && userConfigs.ShapeKeys.length > 0) {
            html += this.renderShapeKeys(userConfigs.ShapeKeys);
        }

        // MaterialToggles
        if (userConfigs && userConfigs.MaterialToggles && userConfigs.MaterialToggles.length > 0) {
            html += this.renderMaterialToggles(userConfigs.MaterialToggles);
        }

        // ScalarControls
        if (userConfigs && userConfigs.ScalarControls && userConfigs.ScalarControls.length > 0) {
            html += this.renderScalarControls(userConfigs.ScalarControls);
        }

        // VectorControls
        if (userConfigs && userConfigs.VectorControls && userConfigs.VectorControls.length > 0) {
            html += this.renderVectorControls(userConfigs.VectorControls);
        }

        // TextureOptions
        if (userConfigs && userConfigs.TextureOptions && userConfigs.TextureOptions.length > 0) {
            html += this.renderTextureOptions(userConfigs.TextureOptions);
        }

        contentDiv.innerHTML = html;
        panel.style.display = 'flex';

        // Attach event listeners for UserConfigs inputs
        this.attachUserConfigsListeners();
    }

    // Close UserConfigs panel
    closeUserConfigsPanel() {
        // Hide UserConfigs panel
        document.getElementById('userConfigsPanel').style.display = 'none';

        // Show character content and controls
        document.querySelector('.control-panel').style.display = 'flex';
        document.querySelector('.character-tabs').style.display = 'flex';
        document.querySelector('.mesh-type-filter').style.display = 'flex';
        document.querySelector('.search-box').style.display = 'flex';
        document.getElementById('characterContent').style.display = 'block';

        this.currentEditingIndex = null;
    }

    // Render ShapeKeys
    renderShapeKeys(shapeKeys) {
        let html = '<div class="config-section">';
        html += '<h4 class="config-section-title">🎭 Shape Keys (Morph Targets)</h4>';

        shapeKeys.forEach((key, index) => {
            const min = key.Min || 0;
            const max = key.Max || 1;
            const step = key.Step || 0.01;
            const value = key.Value !== undefined ? key.Value : min;
            const displayName = key.DisplayName || key.ShapeKeyName || 'Shape Key';

            html += '<div class="config-item">';
            html += `<label class="config-label">${this.escapeHtml(displayName)}</label>`;
            if (key.Description) {
                html += `<p class="config-description">${this.escapeHtml(key.Description)}</p>`;
            }
            html += '<div class="slider-container">';
            html += `<input type="range" class="slider" data-type="shapekey" data-index="${index}" `;
            html += `min="${min}" max="${max}" step="${step}" value="${value}">`;
            html += `<input type="number" class="slider-value" data-type="shapekey" data-index="${index}" `;
            html += `min="${min}" max="${max}" step="${step}" value="${value}">`;
            html += '</div>';
            html += '</div>';
        });

        html += '</div>';
        return html;
    }

    // Render MaterialToggles
    renderMaterialToggles(toggles) {
        let html = '<div class="config-section">';
        html += '<h4 class="config-section-title">👁️ Material Toggles</h4>';

        toggles.forEach((toggle, index) => {
            const checked = toggle.Value !== false;
            const displayName = toggle.DisplayName || `Material ${toggle.MaterialIndex}`;

            html += '<div class="config-item">';
            html += '<label class="checkbox-label">';
            html += `<input type="checkbox" class="config-checkbox" data-type="materialtoggle" data-index="${index}" ${checked ? 'checked' : ''}>`;
            html += `<span>${this.escapeHtml(displayName)}</span>`;
            if (toggle.MaterialIndex !== undefined) {
                html += ` <span class="material-index">(Index: ${toggle.MaterialIndex})</span>`;
            }
            html += '</label>';
            html += '</div>';
        });

        html += '</div>';
        return html;
    }

    // Render ScalarControls
    renderScalarControls(controls) {
        let html = '<div class="config-section">';
        html += '<h4 class="config-section-title">🎚️ Scalar Parameters</h4>';

        controls.forEach((ctrl, index) => {
            const min = ctrl.Min || 0;
            const max = ctrl.Max || 1;
            const step = ctrl.Step || 0.01;
            const value = ctrl.Value !== undefined ? ctrl.Value : min;
            const displayName = ctrl.DisplayName || ctrl.ParamName || 'Parameter';

            html += '<div class="config-item">';
            html += `<label class="config-label">${this.escapeHtml(displayName)}</label>`;
            if (ctrl.ParamName) {
                html += `<p class="config-description">Parameter: ${this.escapeHtml(ctrl.ParamName)}`;
                if (ctrl.MaterialIndex !== undefined) {
                    html += ` (Material ${ctrl.MaterialIndex})`;
                }
                html += '</p>';
            }
            html += '<div class="slider-container">';
            html += `<input type="range" class="slider" data-type="scalar" data-index="${index}" `;
            html += `min="${min}" max="${max}" step="${step}" value="${value}">`;
            html += `<input type="number" class="slider-value" data-type="scalar" data-index="${index}" `;
            html += `min="${min}" max="${max}" step="${step}" value="${value}">`;
            html += '</div>';
            html += '</div>';
        });

        html += '</div>';
        return html;
    }

    // Render VectorControls
    renderVectorControls(controls) {
        let html = '<div class="config-section">';
        html += '<h4 class="config-section-title">🎨 Vector Parameters (Colors)</h4>';

        controls.forEach((ctrl, index) => {
            const displayName = ctrl.DisplayName || ctrl.ParamName || 'Color';
            const value = ctrl.Value || [1, 1, 1, 1];

            html += '<div class="config-item">';
            html += `<label class="config-label">${this.escapeHtml(displayName)}</label>`;
            if (ctrl.ParamName) {
                html += `<p class="config-description">Parameter: ${this.escapeHtml(ctrl.ParamName)}`;
                if (ctrl.MaterialIndex !== undefined) {
                    html += ` (Material ${ctrl.MaterialIndex})`;
                }
                html += '</p>';
            }

            // RGBA sliders
            html += '<div class="color-sliders">';
            const labels = ['R', 'G', 'B', 'A'];
            for (let i = 0; i < 4; i++) {
                const min = (ctrl.Min && ctrl.Min[i] !== undefined) ? ctrl.Min[i] : 0;
                const max = (ctrl.Max && ctrl.Max[i] !== undefined) ? ctrl.Max[i] : 1;
                const step = (ctrl.Step && ctrl.Step[i] !== undefined) ? ctrl.Step[i] : 0.01;
                const val = value[i] !== undefined ? value[i] : 1;

                html += '<div class="color-slider-item">';
                html += `<label class="color-label">${labels[i]}</label>`;
                html += '<div class="slider-container">';
                html += `<input type="range" class="slider color-slider-${labels[i].toLowerCase()}" `;
                html += `data-type="vector" data-index="${index}" data-component="${i}" `;
                html += `min="${min}" max="${max}" step="${step}" value="${val}">`;
                html += `<input type="number" class="slider-value" `;
                html += `data-type="vector" data-index="${index}" data-component="${i}" `;
                html += `min="${min}" max="${max}" step="${step}" value="${val}">`;
                html += '</div>';
                html += '</div>';
            }
            html += '</div>';

            html += '</div>';
        });

        html += '</div>';
        return html;
    }

    // Render OutfitPath options (when multiple paths exist)
    renderOutfitPathOptions(outfitPaths, item) {
        let html = '<div class="config-section">';
        html += '<h4 class="config-section-title">👗 Outfit Path Selection</h4>';

        // Get currently selected index (default to 0)
        const selectedIndex = item.selectedOutfitPathIndex !== undefined ? item.selectedOutfitPathIndex : 0;

        html += '<div class="config-item">';
        html += '<label class="config-label">Choose Outfit Variant</label>';
        html += '<p class="config-description">Multiple outfit paths are available. Select one to use:</p>';
        html += '<select class="config-select" data-type="outfitpath">';

        outfitPaths.forEach((path, index) => {
            const selected = index === selectedIndex ? 'selected' : '';
            // Extract readable name from path (e.g., "/Game/.../Croft.Croft" -> "Croft")
            const pathParts = path.split('/');
            const fileName = pathParts[pathParts.length - 1];
            const displayName = fileName.split('.')[0] || `Option ${index + 1}`;

            html += `<option value="${index}" ${selected}>${this.escapeHtml(displayName)}</option>`;
        });

        html += '</select>';
        html += '</div>';
        html += '</div>';

        return html;
    }

    // Render TextureOptions
    renderTextureOptions(options) {
        let html = '<div class="config-section">';
        html += '<h4 class="config-section-title">🖼️ Texture Options</h4>';

        options.forEach((opt, index) => {
            const displayName = opt.DisplayName || opt.ParamName || 'Texture';
            const value = opt.Value || 0;
            const optionNames = opt.OptionNames || [];

            html += '<div class="config-item">';
            html += `<label class="config-label">${this.escapeHtml(displayName)}</label>`;
            if (opt.ParamName) {
                html += `<p class="config-description">Parameter: ${this.escapeHtml(opt.ParamName)}`;
                if (opt.MaterialIndex !== undefined) {
                    html += ` (Material ${opt.MaterialIndex})`;
                }
                html += '</p>';
            }
            html += `<select class="config-select" data-type="texture" data-index="${index}">`;
            optionNames.forEach((name, i) => {
                const selected = i === value ? 'selected' : '';
                html += `<option value="${i}" ${selected}>${this.escapeHtml(name)}</option>`;
            });
            html += '</select>';
            html += '</div>';
        });

        html += '</div>';
        return html;
    }

    // Attach UserConfigs event listeners
    attachUserConfigsListeners() {
        if (this.currentEditingIndex === null) return;

        const item = this.selectedItems[this.currentEditingIndex];
        const userConfigs = item.file.content[0].UserConfigs;

        // ShapeKey sliders
        document.querySelectorAll('.slider[data-type="shapekey"], .slider-value[data-type="shapekey"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const value = parseFloat(e.target.value);
                userConfigs.ShapeKeys[index].Value = value;

                // Sync slider and number input
                const otherInputs = document.querySelectorAll(`[data-type="shapekey"][data-index="${index}"]`);
                otherInputs.forEach(inp => inp.value = value);
            });
        });

        // MaterialToggle checkboxes
        document.querySelectorAll('.config-checkbox[data-type="materialtoggle"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                userConfigs.MaterialToggles[index].Value = e.target.checked;
            });
        });

        // Scalar sliders
        document.querySelectorAll('.slider[data-type="scalar"], .slider-value[data-type="scalar"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const value = parseFloat(e.target.value);
                userConfigs.ScalarControls[index].Value = value;

                // Sync slider and number input
                const otherInputs = document.querySelectorAll(`[data-type="scalar"][data-index="${index}"]`);
                otherInputs.forEach(inp => inp.value = value);
            });
        });

        // Vector sliders (RGBA)
        document.querySelectorAll('.slider[data-type="vector"], .slider-value[data-type="vector"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const component = parseInt(e.target.dataset.component);
                const value = parseFloat(e.target.value);

                if (!userConfigs.VectorControls[index].Value) {
                    userConfigs.VectorControls[index].Value = [1, 1, 1, 1];
                }
                userConfigs.VectorControls[index].Value[component] = value;

                // Sync slider and number input
                const otherInputs = document.querySelectorAll(`[data-type="vector"][data-index="${index}"][data-component="${component}"]`);
                otherInputs.forEach(inp => inp.value = value);
            });
        });

        // Texture select
        document.querySelectorAll('.config-select[data-type="texture"]').forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                userConfigs.TextureOptions[index].Value = parseInt(e.target.value);
            });
        });

        // OutfitPath select
        document.querySelectorAll('.config-select[data-type="outfitpath"]').forEach(select => {
            select.addEventListener('change', (e) => {
                const selectedIndex = parseInt(e.target.value);
                // Store the selected outfit path index in the item
                this.selectedItems[this.currentEditingIndex].selectedOutfitPathIndex = selectedIndex;
                console.log('Selected outfit path index:', selectedIndex);
            });
        });
    }

    // Save configuration
    async saveConfiguration() {
        const settings = settingsManager.getSettings();

        if (!settings.outputPath) {
            this.showToast('Please set output path in Settings first!', 'error');
            settingsManager.switchTab('settings');
            return;
        }

        try {
            // Build sns.settings.json structure
            const config = {
                Enabled: document.getElementById('globalEnabled').checked,
                ShowPonytail: document.getElementById('globalShowPonytail').checked,
                Replacements: []
            };

            // Add selected items in order
            this.selectedItems.forEach(item => {
                const content = item.file.content[0];
                const replacement = {
                    UniqueFitID: content.UniqueFitID
                };

                // Add Enabled field if disabled
                if (!item.enabled) {
                    replacement.Enabled = false;
                }

                // Add selected OutfitMesh if multiple paths exist (save as string)
                if (content.OutfitPaths && Array.isArray(content.OutfitPaths) && content.OutfitPaths.length > 1) {
                    const selectedIndex = item.selectedOutfitPathIndex !== undefined ? item.selectedOutfitPathIndex : 0;
                    replacement.OutfitMesh = content.OutfitPaths[selectedIndex];
                    console.log(`Saving OutfitMesh for ${content.UniqueFitID}: ${replacement.OutfitMesh}`);
                }

                // Add UserConfigs if present
                if (content.UserConfigs) {
                    replacement.UserConfigs = content.UserConfigs;
                }

                config.Replacements.push(replacement);
            });

            // Save to file
            const jsonContent = JSON.stringify(config, null, '\t');
            await Neutralino.filesystem.writeFile(settings.outputPath, jsonContent);

            console.log('Configuration saved:', config);

            // Create reload flag if option is enabled in settings
            const createReloadFlag = settings.autoReloadFlag;
            if (createReloadFlag) {
                await this.createReloadFlag(settings.outputPath);
            }

            // Show success message with F9 instruction
            this.showSaveSuccessMessage(settings.outputPath, createReloadFlag);

        } catch (error) {
            console.error('Error saving configuration:', error);
            this.showToast('Error saving configuration: ' + error.message, 'error');
        }
    }

    // Create reload flag file
    async createReloadFlag(outputPath) {
        try {
            // Extract directory from output path
            const lastSlashIndex = Math.max(outputPath.lastIndexOf('/'), outputPath.lastIndexOf('\\'));
            const directory = outputPath.substring(0, lastSlashIndex);

            // Detect which separator was used in the original path
            const separator = outputPath.includes('\\') ? '\\' : '/';
            const flagPath = `${directory}${separator}sns.reload.flag`;

            // Create flag file with timestamp
            const timestamp = new Date().toISOString();
            const flagContent = `Reload requested at: ${timestamp}`;

            await Neutralino.filesystem.writeFile(flagPath, flagContent);
            console.log('Reload flag created:', flagPath);
        } catch (error) {
            console.error('Error creating reload flag:', error);
            // Don't fail the save if flag creation fails
        }
    }

    // Show save success message
    showSaveSuccessMessage(outputPath, flagCreated) {
        const message = `Configuration saved! Press F9 in-game to reload.`;
        this.showToast(message, 'success');
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

    // Load previous configuration from sns.settings.json
    async loadPreviousConfiguration() {
        const settings = settingsManager.getSettings();

        // Check if output path is set
        if (!settings.outputPath) {
            console.log('No output path set, skipping previous configuration load');
            return;
        }

        try {
            // Try to read sns.settings.json
            console.log('Attempting to load previous configuration from:', settings.outputPath);
            const fileContent = await Neutralino.filesystem.readFile(settings.outputPath);
            const config = JSON.parse(fileContent);

            console.log('Previous configuration loaded:', config);

            // Restore global options
            if (config.Enabled !== undefined) {
                document.getElementById('globalEnabled').checked = config.Enabled;
            }

            if (config.ShowPonytail !== undefined) {
                document.getElementById('globalShowPonytail').checked = config.ShowPonytail;
            }

            // Restore selected items from Replacements
            if (config.Replacements && Array.isArray(config.Replacements)) {
                const restoredItems = [];

                for (const replacement of config.Replacements) {
                    const uniqueFitID = replacement.UniqueFitID;
                    if (!uniqueFitID) continue;

                    // Find file in database by UniqueFitID
                    const file = this.allFiles.find(f => {
                        const content = f.content[0];
                        return content.UniqueFitID === uniqueFitID;
                    });

                    if (file) {
                        // Determine enabled state (default true if not specified)
                        const enabled = replacement.Enabled !== false;

                        const restoredItem = {
                            file: file,
                            enabled: enabled
                        };

                        // Restore OutfitMesh selection if specified (from OutfitMesh string)
                        if (replacement.OutfitMesh) {
                            const content = file.content[0];
                            if (content.OutfitPaths && Array.isArray(content.OutfitPaths)) {
                                const pathIndex = content.OutfitPaths.indexOf(replacement.OutfitMesh);
                                if (pathIndex !== -1) {
                                    restoredItem.selectedOutfitPathIndex = pathIndex;
                                    console.log(`Restored OutfitMesh for ${uniqueFitID}: index ${pathIndex} (${replacement.OutfitMesh})`);
                                }
                            }
                        }

                        restoredItems.push(restoredItem);

                        console.log(`Restored: ${uniqueFitID} (enabled: ${enabled})`);
                    } else {
                        console.warn(`File not found for UniqueFitID: ${uniqueFitID}`);
                    }
                }

                // Update selectedItems and UI
                this.selectedItems = restoredItems;
                this.renderSelectedItems();

                // Update checkboxes/radios in the selection UI
                this.updateSelectionInputs();

                console.log(`Restored ${restoredItems.length} items from previous configuration`);

                // Show success message
                if (restoredItems.length > 0) {
                    const message = `✅ Previous configuration restored!\n\n` +
                                  `${restoredItems.length} item(s) loaded from sns.settings.json`;
                    console.log(message);
                }
            }

        } catch (error) {
            // Silently ignore errors (file not found, invalid JSON, etc.)
            console.log('Could not load previous configuration:', error.message);
        }
    }

    // Update selection inputs (checkboxes/radios) based on selectedItems
    updateSelectionInputs() {
        // Clear all selections first
        const allInputs = document.querySelectorAll('.selection-item input[type="radio"], .selection-item input[type="checkbox"]');
        allInputs.forEach(input => input.checked = false);

        // Check inputs for selected items
        this.selectedItems.forEach(item => {
            const fileId = item.file.id;
            const input = document.querySelector(`.selection-item input[value="${fileId}"]`);
            if (input) {
                input.checked = true;
            }
        });
    }

    // Open file location in Explorer
    async openFileLocation(filePath) {
        try {
            if (!filePath) {
                this.showToast('File path not available', 'error');
                return;
            }

            // Normalize path separators for Windows
            const normalizedPath = filePath.replace(/\//g, '\\');

            // Use explorer /select to open folder and select the file
            const command = `explorer /select,"${normalizedPath}"`;

            await Neutralino.os.execCommand(command);
            console.log('Opened file location:', normalizedPath);
        } catch (error) {
            console.error('Error opening file location:', error);
            this.showToast('Failed to open file location: ' + error.message, 'error');
        }
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export global instance
const selectionManager = new SelectionManager();
