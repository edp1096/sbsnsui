// Single Instance Manager for Neutralino App
// Ensures only one instance of the application can run at a time
// Uses lock file and Neutralino events for inter-instance communication

const SingleInstanceManager = (function() {
    let lockFilePath = null;
    let isLocked = false;

    /**
     * Initialize the single instance manager
     * @returns {Promise<boolean>} true if this is the only instance, false if another instance is running
     */
    async function init() {
        try {
            // Build lock file path
            const appPath = NL_PATH || '.';
            lockFilePath = `${appPath}/.app.lock`;

            // Check if lock file exists
            const lockExists = await checkLockFile();

            if (lockExists) {
                // Try to validate if the process is actually running
                const isValid = await validateLock();

                if (isValid) {
                    // Another instance is running - broadcast focus request
                    try {
                        await Neutralino.events.broadcast('focusRequest');
                    } catch (broadcastError) {
                        console.error('[SingleInstance] Broadcast error:', broadcastError);
                    }

                    // Wait a brief moment for the broadcast to be delivered
                    await new Promise(resolve => setTimeout(resolve, 50));

                    return false;
                } else {
                    // Stale lock file, remove it
                    await removeLock();
                }
            }

            // Create lock file
            await createLock();

            // Listen for focus requests from other instances
            setupFocusListener();

            return true;

        } catch (error) {
            console.error('[SingleInstance] Init error:', error);
            // On error, allow the app to run
            return true;
        }
    }

    /**
     * Check if lock file exists
     */
    async function checkLockFile() {
        try {
            const stats = await Neutralino.filesystem.getStats(lockFilePath);
            return stats !== null;
        } catch (error) {
            // File doesn't exist
            return false;
        }
    }

    /**
     * Create lock file with current process info
     */
    async function createLock() {
        try {
            const lockData = {
                timestamp: Date.now(),
                appId: NL_APPID || 'js.neutralino.sample'
            };

            await Neutralino.filesystem.writeFile(
                lockFilePath,
                JSON.stringify(lockData, null, 2)
            );

            isLocked = true;
        } catch (error) {
            console.error('[SingleInstance] Error creating lock:', error);
            throw error;
        }
    }

    /**
     * Validate if the lock is from a running process
     */
    async function validateLock() {
        try {
            const lockContent = await Neutralino.filesystem.readFile(lockFilePath);
            const lockData = JSON.parse(lockContent);

            // Check if lock is too old (more than 1 hour = stale)
            const now = Date.now();
            const lockAge = now - lockData.timestamp;
            const ONE_HOUR = 60 * 60 * 1000;

            if (lockAge > ONE_HOUR) {
                return false;
            }

            // Lock is recent, assume valid
            return true;

        } catch (error) {
            // If we can't read the lock file, assume it's invalid
            return false;
        }
    }

    /**
     * Remove lock file
     */
    async function removeLock() {
        try {
            if (lockFilePath && isLocked) {
                await Neutralino.filesystem.remove(lockFilePath);
                isLocked = false;
            }
        } catch (error) {
            // Ignore errors when removing lock file
        }
    }

    /**
     * Setup listener for focus requests from other instances
     */
    function setupFocusListener() {
        Neutralino.events.on('focusRequest', async () => {
            try {
                await Neutralino.window.focus();
            } catch (error) {
                console.error('[SingleInstance] Focus error:', error);
            }
        });
    }

    /**
     * Cleanup before app exit
     */
    async function cleanup() {
        await removeLock();
    }

    // Public API
    return {
        init,
        cleanup
    };
})();
