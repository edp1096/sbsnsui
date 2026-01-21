// Database management module for nanosuit converter

class DatabaseManager {
    constructor() {
        this.db = null;
        this.SQL = null;
    }

    // Initialize SQL.js and create database
    async init() {
        try {
            // Load SQL.js
            this.SQL = await initSqlJs({
                locateFile: file => `/js/${file}`
            });

            // Try to load existing database from storage
            const savedDb = await this.loadFromStorage();

            if (savedDb) {
                try {
                    this.db = new this.SQL.Database(savedDb);
                    console.log('Loaded existing database from storage');

                    // Migrate schema if needed
                    await this.migrateSchema();
                } catch (err) {
                    console.warn('Failed to load existing DB, creating new one:', err);
                    this.db = new this.SQL.Database();
                    await this.createSchema();
                }
            } else {
                // Create new database
                this.db = new this.SQL.Database();
                console.log('Created new database');
                await this.createSchema();
            }

            console.log('Database initialized successfully');

            return true;
        } catch (error) {
            console.error('Database initialization error:', error);
            return false;
        }
    }

    // Migrate existing schema (add missing columns)
    async migrateSchema() {
        try {
            // Check if table exists
            const tableCheck = this.db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='deckcns_files'");

            // Check if we have results with values
            const tableExists = tableCheck.length > 0 &&
                               tableCheck[0].values &&
                               tableCheck[0].values.length > 0;

            if (!tableExists) {
                // Table doesn't exist, create new schema
                this.db.run(`
                    CREATE TABLE deckcns_files (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        file_path TEXT NOT NULL,
                        file_name TEXT NOT NULL,
                        unique_fit_id TEXT NOT NULL,
                        content TEXT NOT NULL,
                        character_id TEXT DEFAULT 'EVE',
                        fit_mesh_type TEXT DEFAULT 'BODY',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(file_path, unique_fit_id)
                    )
                `);
            } else {
                // Table exists, check for missing columns
                const columns = this.db.exec("PRAGMA table_info(deckcns_files)");
                const columnNames = columns[0].values.map(row => row[1]);

                // Check if unique_fit_id column exists
                if (!columnNames.includes('unique_fit_id')) {
                    // Need to recreate table with new schema
                    // 1. Rename old table
                    this.db.run("ALTER TABLE deckcns_files RENAME TO deckcns_files_old");

                    // 2. Create new table with updated schema
                    this.db.run(`
                        CREATE TABLE deckcns_files (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            file_path TEXT NOT NULL,
                            file_name TEXT NOT NULL,
                            unique_fit_id TEXT NOT NULL,
                            content TEXT NOT NULL,
                            character_id TEXT DEFAULT 'EVE',
                            fit_mesh_type TEXT DEFAULT 'BODY',
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(file_path, unique_fit_id)
                        )
                    `);

                    // 3. Migrate data - extract unique_fit_id from content
                    const oldData = this.db.exec("SELECT * FROM deckcns_files_old");
                    if (oldData.length > 0 && oldData[0].values) {
                        const colNames = oldData[0].columns;
                        for (const row of oldData[0].values) {
                            const rowObj = {};
                            colNames.forEach((col, idx) => {
                                rowObj[col] = row[idx];
                            });

                            // Parse content to get UniqueFitID
                            try {
                                const content = JSON.parse(rowObj.content);
                                const uniqueFitId = Array.isArray(content) && content.length > 0
                                    ? (content[0].UniqueFitID || 'unknown')
                                    : 'unknown';

                                this.db.run(`
                                    INSERT INTO deckcns_files
                                    (file_path, file_name, unique_fit_id, content, character_id, fit_mesh_type, created_at, updated_at)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                `, [
                                    rowObj.file_path,
                                    rowObj.file_name,
                                    uniqueFitId,
                                    rowObj.content,
                                    rowObj.character_id || 'EVE',
                                    rowObj.fit_mesh_type || 'BODY',
                                    rowObj.created_at,
                                    rowObj.updated_at
                                ]);
                            } catch (e) {
                                console.warn('Failed to migrate row:', e);
                            }
                        }
                    }

                    // 4. Drop old table
                    this.db.run("DROP TABLE deckcns_files_old");
                } else {
                    // Add other missing columns if needed
                    if (!columnNames.includes('character_id')) {
                        this.db.run("ALTER TABLE deckcns_files ADD COLUMN character_id TEXT DEFAULT 'EVE'");
                    }

                    if (!columnNames.includes('fit_mesh_type')) {
                        this.db.run("ALTER TABLE deckcns_files ADD COLUMN fit_mesh_type TEXT DEFAULT 'BODY'");
                    }
                }
            }

            // Create indexes if they don't exist
            this.db.run("CREATE INDEX IF NOT EXISTS idx_file_path ON deckcns_files(file_path)");
            this.db.run("CREATE INDEX IF NOT EXISTS idx_file_name ON deckcns_files(file_name)");
            this.db.run("CREATE INDEX IF NOT EXISTS idx_unique_fit_id ON deckcns_files(unique_fit_id)");
            this.db.run("CREATE INDEX IF NOT EXISTS idx_character_id ON deckcns_files(character_id)");
            this.db.run("CREATE INDEX IF NOT EXISTS idx_fit_mesh_type ON deckcns_files(fit_mesh_type)");

            await this.saveToStorage();
        } catch (error) {
            console.error('Migration error:', error);
            throw error;
        }
    }

    // Create database schema
    async createSchema() {
        const schema = `
            CREATE TABLE IF NOT EXISTS deckcns_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                unique_fit_id TEXT NOT NULL,
                content TEXT NOT NULL,
                character_id TEXT DEFAULT 'EVE',
                fit_mesh_type TEXT DEFAULT 'BODY',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(file_path, unique_fit_id)
            );

            CREATE INDEX IF NOT EXISTS idx_file_path ON deckcns_files(file_path);
            CREATE INDEX IF NOT EXISTS idx_file_name ON deckcns_files(file_name);
            CREATE INDEX IF NOT EXISTS idx_unique_fit_id ON deckcns_files(unique_fit_id);
            CREATE INDEX IF NOT EXISTS idx_character_id ON deckcns_files(character_id);
            CREATE INDEX IF NOT EXISTS idx_fit_mesh_type ON deckcns_files(fit_mesh_type);
        `;

        this.db.run(schema);
        await this.saveToStorage();
    }

    // Insert or update a deckcns file
    async upsertFile(filePath, fileName, uniqueFitId, content, characterId = 'EVE', fitMeshType = 'BODY') {
        try {
            const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

            const stmt = this.db.prepare(`
                INSERT INTO deckcns_files (file_path, file_name, unique_fit_id, content, character_id, fit_mesh_type, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(file_path, unique_fit_id)
                DO UPDATE SET
                    file_name = excluded.file_name,
                    content = excluded.content,
                    character_id = excluded.character_id,
                    fit_mesh_type = excluded.fit_mesh_type,
                    updated_at = CURRENT_TIMESTAMP
            `);

            stmt.bind([filePath, fileName, uniqueFitId, contentStr, characterId, fitMeshType]);
            stmt.step();
            stmt.free();

            await this.saveToStorage();
            return true;
        } catch (error) {
            console.error('Error upserting file:', error);
            return false;
        }
    }

    // Get all files
    getAllFiles() {
        try {
            const stmt = this.db.prepare('SELECT * FROM deckcns_files ORDER BY updated_at DESC');
            const results = [];

            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push({
                    ...row,
                    content: JSON.parse(row.content)
                });
            }

            stmt.free();
            return results;
        } catch (error) {
            console.error('Error getting all files:', error);
            return [];
        }
    }

    // Get file by ID
    getFileById(id) {
        try {
            const stmt = this.db.prepare('SELECT * FROM deckcns_files WHERE id = ?');
            stmt.bind([id]);

            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return {
                    ...row,
                    content: JSON.parse(row.content)
                };
            }

            stmt.free();
            return null;
        } catch (error) {
            console.error('Error getting file by ID:', error);
            return null;
        }
    }

    // Delete file by ID
    async deleteFile(id) {
        try {
            const stmt = this.db.prepare('DELETE FROM deckcns_files WHERE id = ?');
            stmt.bind([id]);
            stmt.step();
            stmt.free();

            await this.saveToStorage();
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }

    // Clear all files
    async clearAll() {
        try {
            this.db.run('DELETE FROM deckcns_files');
            await this.saveToStorage();
            return true;
        } catch (error) {
            console.error('Error clearing all files:', error);
            return false;
        }
    }

    // Get statistics
    getStats() {
        try {
            const stmt = this.db.prepare('SELECT COUNT(*) as count FROM deckcns_files');
            stmt.step();
            const result = stmt.getAsObject();
            stmt.free();
            return result.count;
        } catch (error) {
            console.error('Error getting stats:', error);
            return 0;
        }
    }

    // Get files grouped by character
    getFilesByCharacter() {
        try {
            const files = this.getAllFiles();
            const grouped = {};

            files.forEach(file => {
                const charId = file.character_id || 'EVE';
                if (!grouped[charId]) {
                    grouped[charId] = [];
                }
                grouped[charId].push(file);
            });

            return grouped;
        } catch (error) {
            console.error('Error grouping files by character:', error);
            return {};
        }
    }

    // Get unique character IDs
    getCharacterIds() {
        try {
            const stmt = this.db.prepare('SELECT DISTINCT character_id FROM deckcns_files ORDER BY character_id');
            const results = [];

            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push(row.character_id);
            }

            stmt.free();
            return results;
        } catch (error) {
            console.error('Error getting character IDs:', error);
            return [];
        }
    }

    // Get unique FitMeshType values
    getFitMeshTypes() {
        try {
            const stmt = this.db.prepare('SELECT DISTINCT fit_mesh_type FROM deckcns_files ORDER BY fit_mesh_type');
            const results = [];

            while (stmt.step()) {
                const row = stmt.getAsObject();
                results.push(row.fit_mesh_type);
            }

            stmt.free();
            return results;
        } catch (error) {
            console.error('Error getting fit mesh types:', error);
            return [];
        }
    }

    // Save database to Neutralino storage
    async saveToStorage() {
        try {
            const data = this.db.export();
            const base64 = this.arrayBufferToBase64(data);
            await Neutralino.storage.setData('deckcns_database', base64);

            const fileCount = this.getStats();
            console.log(`Database saved to storage (${fileCount} files, ${base64.length} bytes)`);
            return true;
        } catch (error) {
            console.error('Error saving to storage:', error);
            return false;
        }
    }

    // Load database from Neutralino storage
    async loadFromStorage() {
        try {
            const base64 = await Neutralino.storage.getData('deckcns_database');
            if (base64) {
                console.log(`Loading database from storage (${base64.length} bytes)`);
                return this.base64ToArrayBuffer(base64);
            }
            return null;
        } catch (error) {
            console.log('No existing database found, will create new one');
            return null;
        }
    }

    // Helper: Convert ArrayBuffer to Base64
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    // Helper: Convert Base64 to Uint8Array (required by SQL.js)
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes; // Return Uint8Array, not ArrayBuffer
    }
}

// Export global instance
const dbManager = new DatabaseManager();
