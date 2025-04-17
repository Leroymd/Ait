// modules.js - Управление модулями

/**
 * Этот модуль отвечает за:
 * - загрузку и отображение списка модулей
 * - управление модулями (включение/отключение/удаление)
 * - загрузку новых модулей
 */

import { state, elements } from './app.js';
import { handleError, showToast } from './utils1.js';

/**
 * Загрузка списка модулей с сервера
 */
export function loadModules() {
    console.log('Загрузка списка модулей...');
    fetch('/api/modules')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ошибка ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Получены данные о модулях:', data);
            
            // Проверяем наличие данных о модулях
            if (data.modules && Array.isArray(data.modules)) {
                // Обновляем состояние
                state.modules = data.modules;
                
                // Обновляем список модулей в UI
                updateModulesList(data.modules);
                
                // Обновляем список установленных модулей в настройках
                updateInstalledModulesList();
            } else {
                console.warn('Данные о модулях имеют неверный формат:', data);
                // Загружаем тестовые данные модулей
                loadMockModules();
            }
        })
        .catch(error => {
            console.error('Ошибка при загрузке списка модулей:', error);
            // Загружаем тестовые данные модулей
            loadMockModules();
        });
}

/**
 * Загрузка тестовых данных модулей
 */
export function loadMockModules() {
    console.log('Загрузка тестовых данных модулей...');
    const mockModules = [
        { id: 'core', name: 'Ядро системы', active: true, description: 'Основной модуль системы' },
        { id: 'ai-analyzer', name: 'AI Анализатор', active: true, description: 'Анализ графиков с помощью ИИ' },
        { id: 'auto-trader', name: 'Автотрейдинг', active: true, description: 'Автоматическое исполнение сделок' },
        { id: 'risk-manager', name: 'Риск-менеджер', active: true, description: 'Контроль рисков и размера позиций' }
    ];
    
    state.modules = mockModules;
    updateModulesList(mockModules);
    updateInstalledModulesList();
    
    // Устанавливаем флаги доступности модулей
    state.aiModuleAvailable = true;
    if (elements.analyzeBtn) {
        elements.analyzeBtn.disabled = false;
    }
    
    state.autoTradingAvailable = true;
    if (elements.autoTradingSwitch) {
        elements.autoTradingSwitch.disabled = false;
    }
}

/**
 * Обновление списка модулей в UI
 * @param {Array} modules - список модулей для отображения
 */
export function updateModulesList(modules) {
    if (!elements.modulesList) {
        return;
    }
    
    // Очищаем список модулей
    elements.modulesList.innerHTML = '<div class="list-group-item d-flex justify-content-between align-items-center"><span>Ядро</span><span class="badge bg-success">Активно</span></div>';
    
    // Обновляем список модулей
    modules.forEach(module => {
        const moduleItem = document.createElement('div');
        moduleItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        moduleItem.innerHTML = `
            <span>${module.name}</span>
            <span class="badge ${module.active ? 'bg-success' : 'bg-secondary'}">${module.active ? 'Активно' : 'Неактивно'}</span>
        `;
        elements.modulesList.appendChild(moduleItem);
        
        // Проверяем, доступен ли AI модуль
        if (module.id === 'ai-analyzer' && module.active) {
            state.aiModuleAvailable = true;
            if (elements.analyzeBtn) {
                elements.analyzeBtn.disabled = false;
            }
        }
        
        // Проверяем, доступен ли модуль автотрейдинга
        if (module.id === 'auto-trader' && module.active) {
            state.autoTradingAvailable = true;
            if (elements.autoTradingSwitch) {
                elements.autoTradingSwitch.disabled = false;
            }
        }
    });
    
    // Добавляем сообщение в случае отсутствия дополнительных модулей
    if (modules.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'list-group-item text-center text-muted';
        emptyItem.textContent = 'Дополнительные модули не установлены';
        elements.modulesList.appendChild(emptyItem);
    }
}

/**
 * Обновление списка установленных модулей в настройках
 */
export function updateInstalledModulesList() {
    if (!elements.installedModulesList) {
        return;
    }
    
    // Очищаем список модулей
    elements.installedModulesList.innerHTML = '';
    
    // Добавляем ядро
    const coreItem = document.createElement('div');
    coreItem.className = 'list-group-item d-flex justify-content-between align-items-center';
    coreItem.innerHTML = `
        <div>
            <strong>Ядро системы</strong>
            <p class="mb-0 text-muted small">Основной модуль системы</p>
        </div>
        <span class="badge bg-success">Активно</span>
    `;
    elements.installedModulesList.appendChild(coreItem);
    
    // Добавляем установленные модули
    state.modules.forEach(module => {
        const moduleItem = document.createElement('div');
        moduleItem.className = 'list-group-item d-flex justify-content-between align-items-center';
        moduleItem.innerHTML = `
            <div>
                <strong>${module.name}</strong>
                <p class="mb-0 text-muted small">${module.description || 'Нет описания'}</p>
            </div>
            <div>
                <span class="badge ${module.active ? 'bg-success' : 'bg-secondary'} me-2">${module.active ? 'Активно' : 'Неактивно'}</span>
                <button class="btn btn-sm btn-outline-danger remove-module" data-module-id="${module.id}">✕</button>
                <button class="btn btn-sm btn-outline-secondary toggle-module" data-module-id="${module.id}" data-action="${module.active ? 'disable' : 'enable'}">
                    ${module.active ? '❌ Отключить' : '✓ Включить'}
                </button>
            </div>
        `;
        
        elements.installedModulesList.appendChild(moduleItem);
    });
    
    // Показываем сообщение, если нет дополнительных модулей
    if (state.modules.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'list-group-item text-center text-muted py-3';
        emptyItem.innerHTML = `
            <p class="mb-0">Дополнительные модули не установлены</p>
            <small>Загрузите модули для расширения функциональности</small>
        `;
        elements.installedModulesList.appendChild(emptyItem);
    }
    
    // Добавляем обработчики для кнопок
    addModuleButtonsHandlers();
}

/**
 * Добавление обработчиков для кнопок модулей
 */
function addModuleButtonsHandlers() {
    // Обработчики для кнопок удаления
    document.querySelectorAll('.remove-module').forEach(button => {
        button.addEventListener('click', (event) => {
            const moduleId = event.target.getAttribute('data-module-id');
            handleRemoveModule(moduleId);
        });
    });
    
    // Обработчики для кнопок включения/отключения
    document.querySelectorAll('.toggle-module').forEach(button => {
        button.addEventListener('click', (event) => {
            const moduleId = event.target.getAttribute('data-module-id');
            const action = event.target.getAttribute('data-action');
            toggleModule(moduleId, action === 'enable');
        });
    });
}

/**
 * Обработка удаления модуля
 * @param {string} moduleId - ID модуля для удаления
 */
export function handleRemoveModule(moduleId) {
    try {
        // Запрашиваем подтверждение
        if (!confirm('Вы уверены, что хотите удалить этот модуль? Это действие нельзя отменить.')) {
            return;
        }
        
        console.log('Удаление модуля:', moduleId);
        
        // Если нет соединения с сервером, имитируем удаление
        if (!state.connected) {
            mockModuleRemove(moduleId);
            return;
        }
        
        // Отправляем запрос на удаление модуля
        fetch(`/api/modules/${moduleId}/remove`, {
            method: 'POST'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ошибка: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Обновляем список модулей
                loadModules();
                
                // Проверяем, был ли удален AI модуль или автотрейдинг
                checkRemovedModuleImpact(moduleId);
                
                // Показываем уведомление об успехе
                showModuleRemoved(moduleId);
            } else {
                throw new Error(data.error || 'Неизвестная ошибка при удалении модуля');
            }
			      })
        .catch(error => {
            console.error('Ошибка при удалении модуля:', error);
            handleError(`Ошибка при удалении модуля: ${error.message}`);
            
            // Имитируем удаление в случае ошибки
            mockModuleRemove(moduleId);
        });
    } catch (error) {
        console.error('Ошибка при удалении модуля:', error);
        handleError('Произошла непредвиденная ошибка при удалении модуля');
    }
}