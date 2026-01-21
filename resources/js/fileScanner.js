// File scanner module for scanning *.deckcns.json files

class FileScanner {
    constructor() {
        this.foundFiles = [];
        this.scanInProgress = false;
        this.excludeFolders = [];  // Folders to exclude from scanning
    }

    // Main scan function
    async scanDirectory(dirPath, excludeFolders = []) {
        this.foundFiles = [];
        this.scanInProgress = true;
        this.excludeFolders = excludeFolders;

        try {
            await this.scanRecursive(dirPath);
            this.scanInProgress = false;
            return this.foundFiles;
        } catch (error) {
            console.error('Error scanning directory:', error);
            this.scanInProgress = false;
            throw error;
        }
    }

    // Normalize path separators
    normalizePath(path) {
        // Remove trailing slashes and normalize separators
        return path.replace(/\\/g, '/').replace(/\/+$/, '');
    }

    // Join paths correctly
    joinPath(dir, file) {
        const normalizedDir = this.normalizePath(dir);
        return `${normalizedDir}/${file}`;
    }

    // Recursive directory scanning
    async scanRecursive(dirPath) {
        try {
            // Read directory entries
            const entries = await Neutralino.filesystem.readDirectory(dirPath);

            for (const entry of entries) {
                // Skip hidden files and directories
                if (entry.entry.startsWith('.')) {
                    continue;
                }

                // Skip excluded folders
                if (this.excludeFolders.includes(entry.entry)) {
                    continue;
                }

                const fullPath = this.joinPath(dirPath, entry.entry);

                if (entry.type === 'DIRECTORY') {
                    // Recursively scan subdirectories
                    try {
                        await this.scanRecursive(fullPath);
                    } catch (err) {
                        // Skip directories that can't be accessed
                    }
                } else if (entry.type === 'FILE') {
                    // Check if file matches *.dekcns.json pattern (case insensitive)
                    const fileName = entry.entry.toLowerCase();
                    if (fileName.endsWith('.dekcns.json')) {
                        this.foundFiles.push({
                            path: fullPath,
                            name: entry.entry
                        });
                    }
                }
            }
        } catch (error) {
            throw error;
        }
    }

    // Fix malformed JSON by removing trailing commas
    fixJsonString(jsonString) {
        // Remove trailing commas before closing brackets/braces
        return jsonString
            .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
            .replace(/\r\n/g, '\n');         // Normalize line endings
    }

    // Read and parse a JSON file
    async readJsonFile(filePath) {
        try {
            let content = await Neutralino.filesystem.readFile(filePath);

            // Try to fix common JSON issues
            content = this.fixJsonString(content);

            return JSON.parse(content);
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error.message);
            throw error;
        }
    }

    // Scan and import files to database
    async scanAndImport(dirPath, dbManager, progressCallback, excludeFolders = []) {
        try {
            // Show progress
            if (progressCallback) {
                progressCallback({ stage: 'scanning', message: 'Scanning directory...' });
            }

            // Scan for files
            const files = await this.scanDirectory(dirPath, excludeFolders);

            if (progressCallback) {
                progressCallback({
                    stage: 'found',
                    message: `Found ${files.length} files`,
                    count: files.length
                });
            }

            // Import files to database
            let imported = 0;
            let failed = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];

                try {
                    if (progressCallback) {
                        progressCallback({
                            stage: 'importing',
                            message: `Importing ${file.name}...`,
                            current: i + 1,
                            total: files.length
                        });
                    }

                    // Read and parse JSON
                    const content = await this.readJsonFile(file.path);

                    // Process each item in the array
                    if (Array.isArray(content) && content.length > 0) {
                        for (const item of content) {
                            // Extract required fields
                            const uniqueFitId = item.UniqueFitID || `unknown_${Date.now()}`;
                            const rawCharId = item.CharacterID || 'EVE';
                            const characterId = rawCharId.toUpperCase();
                            const rawFitMeshType = item.FitMeshType || 'BODY';
                            const fitMeshType = rawFitMeshType.toUpperCase();

                            // Save each item to database separately
                            await dbManager.upsertFile(file.path, file.name, uniqueFitId, [item], characterId, fitMeshType);
                        }
                    } else {
                        // Fallback for non-array or empty content
                        const uniqueFitId = 'unknown';
                        await dbManager.upsertFile(file.path, file.name, uniqueFitId, content, 'EVE', 'BODY');
                    }
                    imported++;
                } catch (error) {
                    console.error(`Failed to import ${file.path}:`, error);
                    failed++;
                }
            }

            if (progressCallback) {
                progressCallback({
                    stage: 'complete',
                    message: `Import complete: ${imported} succeeded, ${failed} failed`,
                    imported,
                    failed
                });
            }

            return { imported, failed, total: files.length };
        } catch (error) {
            console.error('Error in scanAndImport:', error);
            throw error;
        }
    }

    // Get scan progress
    isScanning() {
        return this.scanInProgress;
    }

    // Get found files count
    getFoundCount() {
        return this.foundFiles.length;
    }
}

// Export global instance
const fileScanner = new FileScanner();
