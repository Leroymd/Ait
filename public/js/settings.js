// settings.js - Settings management

/**
 * This module is responsible for:
 * - Loading and saving application settings
 * - Managing the settings form
 * - Testing connections to exchanges and APIs
 */

import { state, elements, settings, settingsModal } from './app.js';
import { handleError, showToast } from './utils1.js';

/**
 * Load settings from localStorage
 */
export function loadSettingsFromStorage() {
    try {
        const savedSettings = localStorage.getItem('tradingAppSettings');
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            
            // Update application settings
            Object.assign(settings, parsedSettings);
            
            console.log('Settings successfully loaded from localStorage');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error loading settings from localStorage:', error);
        return false;
    }
}

/**
 * Save settings to localStorage
 * @returns {boolean} - success status
 */
export function saveSettingsToStorage() {
    try {
        localStorage.setItem('tradingAppSettings', JSON.stringify(settings));
        console.log('Settings successfully saved to localStorage');
        return true;
    } catch (error) {
        console.error('Error saving settings to localStorage:', error);
        return false;
    }
}

/**
 * Load settings into form
 */
export function loadSettingsToForm() {
    try {
        // Check for necessary form elements
        if (!elements.binanceApiKey || !elements.binanceSecretKey ||
            !elements.bybitApiKey || !elements.bybitSecretKey ||
            !elements.aiApiKey || !elements.aiEndpoint) {
            console.warn('Not all required settings form elements found');
            return false;
        }
        
        // Load API keys
        elements.binanceApiKey.value = settings.apiKeys.binance.apiKey || '';
        elements.binanceSecretKey.value = settings.apiKeys.binance.secretKey || '';
        elements.bybitApiKey.value = settings.apiKeys.bybit.apiKey || '';
        elements.bybitSecretKey.value = settings.apiKeys.bybit.secretKey || '';
        
        // Load AI settings
        elements.aiApiKey.value = settings.ai.apiKey || '';
        elements.aiEndpoint.value = settings.ai.endpoint || '';
        
        // Load trading settings
        if (elements.maxRiskPercent) {
            elements.maxRiskPercent.value = settings.trading.maxRiskPercent || 1;
        }
        
        if (elements.maxConcurrentTrades) {
            elements.maxConcurrentTrades.value = settings.trading.maxConcurrentTrades || 3;
        }
        
        if (elements.confirmationModeCheck) {
            elements.confirmationModeCheck.checked = settings.trading.confirmationMode !== false;
        }
        
        if (elements.depositAccelerationCheck) {
            elements.depositAccelerationCheck.checked = settings.trading.depositAcceleration === true;
        }
        
        console.log('Settings successfully loaded into form');
        return true;
    } catch (error) {
        console.error('Error loading settings into form:', error);
        return false;
    }
}

/**
 * Get settings from form
 * @returns {Object} - settings object
 */
function getSettingsFromForm() {
    try {
        // Check for necessary form elements
        if (!elements.binanceApiKey || !elements.binanceSecretKey ||
            !elements.bybitApiKey || !elements.bybitSecretKey ||
            !elements.aiApiKey || !elements.aiEndpoint) {
            console.warn('Not all required settings form elements found');
            return null;
        }
        
        // Create new settings object
        const newSettings = {
            apiKeys: {
                binance: {
                    apiKey: elements.binanceApiKey.value.trim(),
                    secretKey: elements.binanceSecretKey.value.trim()
                },
                bybit: {
                    apiKey: elements.bybitApiKey.value.trim(),
                    secretKey: elements.bybitSecretKey.value.trim()
                }
            },
            ai: {
                apiKey: elements.aiApiKey.value.trim(),
                endpoint: elements.aiEndpoint.value.trim()
            },
            trading: {
                maxRiskPercent: elements.maxRiskPercent ? parseFloat(elements.maxRiskPercent.value) || 1 : 1,
                maxConcurrentTrades: elements.maxConcurrentTrades ? parseInt(elements.maxConcurrentTrades.value) || 3 : 3,
                confirmationMode: elements.confirmationModeCheck ? elements.confirmationModeCheck.checked : true,
                depositAcceleration: elements.depositAccelerationCheck ? elements.depositAccelerationCheck.checked : false
            }
        };
        
        return newSettings;
    } catch (error) {
        console.error('Error getting settings from form:', error);
        return null;
    }
}

/**
 * Handle save settings button
 */
export function handleSaveSettings() {
    try {
        // Get settings from form
        const newSettings = getSettingsFromForm();
        if (!newSettings) {
            handleError('Error getting settings from form');
            return false;
        }
        
        // Update application settings
        Object.assign(settings, newSettings);
        
        // Save settings to localStorage
        if (!saveSettingsToStorage()) {
            showToast('Settings saved only in application memory', 'warning');
        }
        
        // Send settings to server
        sendSettingsToServer(newSettings)
            .then(success => {
                if (success) {
                    showToast('Settings successfully saved', 'success');
                    
                    // Close modal if it exists
                    if (settingsModal) {
                        settingsModal.hide();
                    }
                } else {
                    showToast('Settings saved locally but not sent to server', 'warning');
                }
            })
            .catch(error => {
                console.error('Error saving settings:', error);
                showToast('Settings saved locally but not sent to server', 'warning');
            });
        
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        handleError('An error occurred while saving settings');
        return false;
    }
}

/**
 * Send settings to server
 * @param {Object} settings - settings to send
 * @returns {Promise<boolean>} - success status
 */
async function sendSettingsToServer(settings) {
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error('Error sending settings to server:', error);
        return false;
    }
}

/**
 * Test connection to exchange or API
 * @param {string} type - connection type (binance, bybit, ai)
 * @returns {Promise<boolean>} - success status
 */
export async function testConnection(type) {
    try {
        // Show loading indicator on corresponding button
        const buttonId = `test${type.charAt(0).toUpperCase() + type.slice(1)}Connection`;
        const button = document.getElementById(buttonId);
        
        if (button) {
            button.disabled = true;
            button.innerHTML = `
                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                Testing...
            `;
        }
        
        // Get settings from form
        const formSettings = getSettingsFromForm();
        if (!formSettings) {
            throw new Error('Could not get settings from form');
        }
        
        // Send request to test connection
        const response = await fetch(`/api/test-connection/${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                [type]: type === 'binance' ? formSettings.apiKeys.binance :
                        type === 'bybit' ? formSettings.apiKeys.bybit :
                        formSettings.ai
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Connection to ${getConnectionName(type)} successful`, 'success');
        } else {
            showToast(`Connection error to ${getConnectionName(type)}: ${data.error}`, 'danger');
        }
        
        return data.success;
    } catch (error) {
        console.error(`Error testing connection to ${type}:`, error);
        showToast(`Connection error to ${getConnectionName(type)}`, 'danger');
        return false;
    } finally {
        // Restore button
        const buttonId = `test${type.charAt(0).toUpperCase() + type.slice(1)}Connection`;
        const button = document.getElementById(buttonId);
        
        if (button) {
            button.disabled = false;
            button.textContent = `Test Connection`;
        }
    }
}

/**
 * Get readable connection name
 * @param {string} type - connection type
 * @returns {string} - connection name
 */
function getConnectionName(type) {
    switch (type) {
        case 'binance':
            return 'Binance';
        case 'bybit':
            return 'Bybit';
        case 'ai':
            return 'AI API';
        case 'telegram':
            return 'Telegram';
        default:
            return type;
    }
}

/**
 * Reset settings to defaults
 */
export function resetSettings() {
    // Confirm action
    if (!confirm('Are you sure you want to reset all settings to default values? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Create default settings object
        const defaultSettings = {
            apiKeys: {
                binance: { apiKey: '', secretKey: '' },
                bybit: { apiKey: '', secretKey: '' }
            },
            ai: {
                apiKey: '',
                endpoint: ''
            },
            trading: {
                maxRiskPercent: 1,
                maxConcurrentTrades: 3,
                confirmationMode: true,
                depositAcceleration: false
            }
        };
        
        // Update application settings
        Object.assign(settings, defaultSettings);
        
        // Save settings to localStorage
        saveSettingsToStorage();
        
        // Load settings into form
        loadSettingsToForm();
        
        showToast('Settings reset to default values', 'info');
    } catch (error) {
        console.error('Error resetting settings:', error);
        handleError('An error occurred while resetting settings');
    }
}

/**
 * Export settings to file
 */
export function exportSettings() {
    try {
        // Create copy of settings without sensitive data
        const exportSettings = JSON.parse(JSON.stringify(settings));
        
        // Mask secret keys
        if (exportSettings.apiKeys) {
            if (exportSettings.apiKeys.binance) {
                exportSettings.apiKeys.binance.secretKey = exportSettings.apiKeys.binance.secretKey ? '********' : '';
            }
            
            if (exportSettings.apiKeys.bybit) {
                exportSettings.apiKeys.bybit.secretKey = exportSettings.apiKeys.bybit.secretKey ? '********' : '';
            }
        }
        
        if (exportSettings.ai) {
            exportSettings.ai.apiKey = exportSettings.ai.apiKey ? '********' : '';
        }
        
        // Add metadata
        const exportData = {
            exportDate: new Date().toISOString(),
            settings: exportSettings
        };
        
        // Create file content
        const content = JSON.stringify(exportData, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `trading-app-settings-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        
        // Remove link and free URL
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
        showToast('Settings successfully exported', 'success');
    } catch (error) {
        console.error('Error exporting settings:', error);
        handleError('An error occurred while exporting settings');
    }
}

/**
 * Import settings from file
 * @param {File} file - settings file
 */
export function importSettings(file) {
    try {
        if (!file) {
            handleError('No file selected');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const fileContent = event.target.result;
                const importData = JSON.parse(fileContent);
                
                // Check that file contains settings
                if (!importData.settings) {
                    throw new Error('Settings not found in file');
                }
                
                // Confirm action
                if (!confirm('Are you sure you want to import settings? Current settings will be replaced.')) {
                    return;
                }
                
                // Check if secret keys should be preserved
                const keepSecrets = confirm('Keep current API keys and secret data?');
                
                // Create copy of imported settings
                const newSettings = JSON.parse(JSON.stringify(importData.settings));
                
                // Save secret keys if needed
                if (keepSecrets) {
                    if (newSettings.apiKeys && settings.apiKeys) {
                        if (newSettings.apiKeys.binance && settings.apiKeys.binance) {
                            if (newSettings.apiKeys.binance.secretKey === '********' || !newSettings.apiKeys.binance.secretKey) {
                                newSettings.apiKeys.binance.secretKey = settings.apiKeys.binance.secretKey;
                            }
                            
                            if (newSettings.apiKeys.binance.apiKey === '********' || !newSettings.apiKeys.binance.apiKey) {
                                newSettings.apiKeys.binance.apiKey = settings.apiKeys.binance.apiKey;
                            }
                        }
                        
                        if (newSettings.apiKeys.bybit && settings.apiKeys.bybit) {
                            if (newSettings.apiKeys.bybit.secretKey === '********' || !newSettings.apiKeys.bybit.secretKey) {
                                newSettings.apiKeys.bybit.secretKey = settings.apiKeys.bybit.secretKey;
                            }
                            
                            if (newSettings.apiKeys.bybit.apiKey === '********' || !newSettings.apiKeys.bybit.apiKey) {
                                newSettings.apiKeys.bybit.apiKey = settings.apiKeys.bybit.apiKey;
                            }
                        }
                    }
                    
                    if (newSettings.ai && settings.ai) {
                        if (newSettings.ai.apiKey === '********' || !newSettings.ai.apiKey) {
                            newSettings.ai.apiKey = settings.ai.apiKey;
                        }
                    }
                }
                
                // Update application settings
                Object.assign(settings, newSettings);
                
                // Save settings to localStorage
                saveSettingsToStorage();
                
                // Load settings into form
                loadSettingsToForm();
                
                showToast('Settings successfully imported', 'success');
            } catch (error) {
                console.error('Error processing imported file:', error);
                handleError(`Error importing settings: ${error.message}`);
            }
        };
        
        reader.onerror = () => {
            handleError('Error reading file');
        };
        
        reader.readAsText(file);
    } catch (error) {
        console.error('Error importing settings:', error);
        handleError('An error occurred while importing settings');
    }
}