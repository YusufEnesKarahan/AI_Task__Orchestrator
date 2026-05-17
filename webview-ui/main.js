const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage: () => undefined };

document.addEventListener('DOMContentLoaded', () => {
    const projectTitleInput = document.getElementById('project-title-input');
    const projectTitleDisplay = document.getElementById('project-title-display');
    const ideaInput = document.getElementById('idea-input');
    const generateWorkflowBtn = document.getElementById('generate-workflow-btn');
    const taskList = document.getElementById('task-list');
    const selectedTask = document.getElementById('selected-task');
    const promptPreview = document.getElementById('prompt-preview');
    const promptHistory = document.getElementById('prompt-history');
    const approvalList = document.getElementById('approval-list');
    const providerStatusLabel = document.getElementById('provider-status-label');
    const providerStatusMessage = document.getElementById('provider-status-message');
    const logList = document.getElementById('log-list');

    // Prompt Queue elements
    const generateAllPromptsBtn = document.getElementById('generate-all-prompts-btn');
    const approveAllBtn = document.getElementById('approve-all-btn');
    const rejectAllBtn = document.getElementById('reject-all-btn');
    const executeQueueBtn = document.getElementById('execute-queue-btn');
    const cancelQueueBtn = document.getElementById('cancel-queue-btn');
    const promptQueueList = document.getElementById('prompt-queue-list');

    const requiredElements = [
        projectTitleDisplay,
        generateWorkflowBtn,
        taskList,
        selectedTask,
        promptPreview,
        promptHistory,
        approvalList,
        providerStatusLabel,
        providerStatusMessage,
        logList,
        approveAllBtn,
        rejectAllBtn,
        executeQueueBtn,
        cancelQueueBtn,
        promptQueueList
    ];

    if (requiredElements.some((element) => !element)) {
        console.error('Webview cannot initialize because one or more required elements are missing.');
        return;
    }

    generateWorkflowBtn?.addEventListener('click', () => {
        vscode.postMessage({
            command: 'generateWorkflow',
            payload: {
                projectTitle: projectTitleInput?.value ?? '',
                ideaText: ideaInput?.value ?? ''
            }
        });
    });

    // Prompt Queue Event Listeners
    generateAllPromptsBtn?.addEventListener('click', () => {
        vscode.postMessage({ command: 'generateAllPrompts' });
    });

    approveAllBtn?.addEventListener('click', () => {
        vscode.postMessage({ command: 'approveAllDraftPrompts' });
    });

    rejectAllBtn?.addEventListener('click', () => {
        vscode.postMessage({ command: 'rejectAllDraftPrompts' });
    });

    executeQueueBtn?.addEventListener('click', () => {
        vscode.postMessage({ command: 'executeApprovedPrompts' });
    });

    cancelQueueBtn?.addEventListener('click', () => {
        vscode.postMessage({ command: 'cancelQueue' });
    });

    window.addEventListener('message', (event) => {
        const message = event?.data;

        if (!message || message.command !== 'renderState') {
            return;
        }

        try {
            renderState(message.payload);
        } catch (error) {
            console.error('Failed to render state in webview:', error);
        }
    });

    function renderState(payload) {
        const safePayload = payload || {};
        projectTitleDisplay.textContent = safePayload.projectTitle || 'AI Task Orchestrator';
        renderTasks(safePayload.tasks || []);
        renderSelectedTask(safePayload.selectedTask);
        renderPrompt(safePayload.prompt);
        renderPromptHistory(safePayload.promptHistory || []);
        renderApprovals(safePayload.approvals || []);
        renderProviderStatus(safePayload.providerStatus);
        renderLogs(safePayload.logs || []);
        renderPrompts(safePayload.prompts || [], safePayload.queueRunning);
    }

    function renderProviderStatus(status) {
        if (!status) {
            providerStatusLabel.textContent = 'Provider bilinmiyor';
            providerStatusLabel.className = 'provider-badge provider-error';
            providerStatusMessage.textContent = 'Provider durumu henüz yüklenmedi.';
            return;
        }

        providerStatusLabel.textContent = status.label;
        providerStatusLabel.className = `provider-badge provider-${status.severity}`;
        providerStatusMessage.textContent = status.message;
    }

    function renderTasks(tasks) {
        taskList.innerHTML = '';

        if (!tasks.length) {
            taskList.innerHTML = '<div class="empty-state">Henüz görev üretilmedi.</div>';
            return;
        }

        tasks.forEach((task, index) => {
            const item = document.createElement('article');
            item.className = `task-item ${task.selected ? 'task-item-selected' : ''}`;

            const order = document.createElement('span');
            order.className = 'task-order';
            order.textContent = String(index + 1).padStart(2, '0');

            const content = document.createElement('div');
            content.className = 'task-content';

            const title = document.createElement('h3');
            title.textContent = task.title;

            const status = document.createElement('span');
            status.className = `status-badge status-${task.status}`;
            status.textContent = translateStatus(task.status);

            const description = document.createElement('p');
            description.className = 'task-description';
            description.textContent = task.description || '';

            const validationMeta = document.createElement('span');
            validationMeta.className = 'inline-meta';
            validationMeta.textContent = `Validation: ${translateValidationStatus(task.validationStatus)}`;

            const topLine = document.createElement('div');
            topLine.className = 'task-topline';
            topLine.append(title, status);

            const actions = document.createElement('div');
            actions.className = 'task-actions';

            actions.append(
                buildActionButton(task.selected ? 'Seçili' : 'Görevi Seç', task.selected, () => {
                    vscode.postMessage({
                        command: 'selectTask',
                        payload: { taskId: task.id }
                    });
                }),
                buildActionButton('Prompt Üret', false, () => {
                    vscode.postMessage({
                        command: 'generatePrompt',
                        payload: { taskId: task.id }
                    });
                }),
                buildActionButton('Approval Simüle Et', false, () => {
                    vscode.postMessage({
                        command: 'simulateApprovalAction',
                        payload: { taskId: task.id }
                    });
                })
            );

            content.append(topLine, description, validationMeta, actions);
            item.append(order, content);
            taskList.appendChild(item);
        });
    }

    function renderSelectedTask(task) {
        if (!task) {
            selectedTask.className = 'empty-state';
            selectedTask.textContent = 'Henüz görev seçilmedi.';
            return;
        }

        selectedTask.className = 'selected-task-card';
        selectedTask.innerHTML = `
            <strong>${escapeHtml(task.title)}</strong>
            <p>${escapeHtml(task.description || 'Açıklama yok.')}</p>
            <span class="inline-meta">Task type: ${escapeHtml(task.type)}</span>
            <span class="inline-meta">Validation: ${escapeHtml(translateValidationStatus(task.validation?.status))}</span>
        `;
    }

    function renderPrompt(prompt) {
        if (!prompt) {
            promptPreview.className = 'prompt-preview empty-state';
            promptPreview.textContent = 'Henüz prompt üretilmedi.';
            return;
        }

        promptPreview.className = 'prompt-preview';
        promptPreview.textContent =
            `[Template]\n${prompt.templateName}\n\n` +
            `[System Prompt]\n${prompt.systemPrompt}\n\n` +
            `[User Prompt]\n${prompt.userPrompt}`;
    }

    function renderPromptHistory(items) {
        promptHistory.innerHTML = '';

        if (!items.length) {
            promptHistory.innerHTML = '<div class="empty-state">Henüz prompt geçmişi yok.</div>';
            return;
        }

        items.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'meta-item';
            row.textContent = `Task: ${item.taskId} | ${new Date(item.createdAt).toLocaleTimeString()}`;
            promptHistory.appendChild(row);
        });
    }

    function renderApprovals(items) {
        approvalList.innerHTML = '';

        if (!items.length) {
            approvalList.innerHTML = '<div class="empty-state">Henüz onay bekleyen işlem yok.</div>';
            return;
        }

        items.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'approval-card';

            const text = document.createElement('div');
            text.className = 'approval-copy';
            text.innerHTML = `
                <strong>${escapeHtml(item.actionSummary)}</strong>
                <p>${escapeHtml(item.reason)}</p>
                <span class="inline-meta">${escapeHtml(item.severity)} | ${escapeHtml(item.status)}</span>
            `;

            const actions = document.createElement('div');
            actions.className = 'task-actions';
            actions.append(
                buildActionButton('Onayla', item.status !== 'pending', () => {
                    vscode.postMessage({
                        command: 'approveRequest',
                        payload: { approvalId: item.id }
                    });
                }),
                buildActionButton('Reddet', item.status !== 'pending', () => {
                    vscode.postMessage({
                        command: 'rejectRequest',
                        payload: { approvalId: item.id }
                    });
                })
            );

            row.append(text, actions);
            approvalList.appendChild(row);
        });
    }

    function renderLogs(logs) {
        logList.innerHTML = '';

        if (!logs.length) {
            logList.innerHTML = '<div class="empty-state">Henüz log yok.</div>';
            return;
        }

        logs.forEach((log) => {
            const entry = document.createElement('div');
            entry.className = `log-entry log-${log.level}`;
            entry.textContent = `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`;
            logList.appendChild(entry);
        });
    }

    function renderPrompts(prompts, queueRunning) {
        promptQueueList.innerHTML = '';

        if (queueRunning) {
            executeQueueBtn.style.display = 'none';
            cancelQueueBtn.style.display = 'inline-block';
            generateAllPromptsBtn.disabled = true;
            approveAllBtn.disabled = true;
            rejectAllBtn.disabled = true;
        } else {
            executeQueueBtn.style.display = 'inline-block';
            cancelQueueBtn.style.display = 'none';
            generateAllPromptsBtn.disabled = false;
            approveAllBtn.disabled = false;
            rejectAllBtn.disabled = false;
        }

        if (!prompts.length) {
            promptQueueList.innerHTML =
                '<div class="empty-state">Henüz prompt üretilmedi. Fikrinizi girip "Fikirden Prompt Üret" butonuna tıklayın.</div>';
            return;
        }

        prompts.forEach((prompt, index) => {
            const card = document.createElement('div');
            card.className = 'prompt-card';

            const header = document.createElement('div');
            header.className = 'prompt-card-header';

            const titleWrap = document.createElement('div');
            titleWrap.className = 'prompt-card-title';
            titleWrap.textContent = `${index + 1}. ${prompt.title || 'İsimsiz Prompt'}`;

            const metaWrap = document.createElement('div');
            metaWrap.className = 'prompt-card-meta';

            const statusBadge = document.createElement('span');
            statusBadge.className = `status-badge status-${prompt.status}`;
            statusBadge.textContent = prompt.status;

            const toggleBtn = buildActionButton('Görüntüle', false, () => {
                const isExpanded = body.classList.toggle('expanded');
                toggleBtn.textContent = isExpanded ? 'Gizle' : 'Görüntüle';
            });

            metaWrap.append(statusBadge, toggleBtn);
            header.append(titleWrap, metaWrap);

            const body = document.createElement('div');
            body.className = 'prompt-card-body';
            body.innerHTML = `<strong>Sistem Promptu:</strong>\n${escapeHtml(prompt.systemPrompt)}\n\n<strong>İçerik:</strong>\n${escapeHtml(prompt.content)}`;

            const editArea = document.createElement('textarea');
            editArea.className = 'prompt-edit-area';
            editArea.value = prompt.content;

            const actions = document.createElement('div');
            actions.className = 'prompt-card-actions';

            if (prompt.status === 'draft' || prompt.status === 'rejected' || prompt.status === 'cancelled') {
                actions.append(
                    buildActionButton('Onayla', false, () => {
                        vscode.postMessage({ command: 'approvePrompt', payload: { promptId: prompt.id } });
                    })
                );

                const editBtn = buildActionButton('Düzenle', false, () => {
                    const isEditing = editArea.classList.contains('editing');
                    if (isEditing) {
                        vscode.postMessage({
                            command: 'updatePromptContent',
                            payload: { promptId: prompt.id, content: editArea.value }
                        });
                        editArea.classList.remove('editing');
                        body.style.display = '';
                        editBtn.textContent = 'Düzenle';
                        toggleBtn.style.display = 'inline-block';
                    } else {
                        editArea.classList.add('editing');
                        body.style.display = 'none';
                        editBtn.textContent = 'Kaydet';
                        toggleBtn.style.display = 'none';
                    }
                });
                actions.append(editBtn);
            }

            if (prompt.status === 'draft' || prompt.status === 'approved') {
                actions.append(
                    buildActionButton('Reddet', false, () => {
                        vscode.postMessage({ command: 'rejectPrompt', payload: { promptId: prompt.id } });
                    })
                );
            }

            // Manual Workflow Buttons
            if (prompt.status === 'ready_for_manual_send') {
                actions.append(
                    buildActionButton('Kopyala', false, () => {
                        const fullText = `[System Prompt]\n${prompt.systemPrompt}\n\n[User Prompt]\n${prompt.content}`;
                        navigator.clipboard.writeText(fullText);
                        vscode.postMessage({
                            command: 'addPromptNote',
                            payload: { promptId: prompt.id, note: 'Panoya kopyalandı.' }
                        });
                    }),
                    buildActionButton('Gönderildi İşaretle', false, () => {
                        vscode.postMessage({ command: 'markPromptSent', payload: { promptId: prompt.id } });
                    })
                );
            }

            if (
                prompt.status === 'ready_for_manual_send' ||
                prompt.status === 'sent_manually' ||
                prompt.status === 'awaiting_manual_result'
            ) {
                actions.append(
                    buildActionButton('Sonucu Gir (Tamamlandı)', false, () => {
                        // Basit prompt dialog kullanımı
                        // VS Code webview içinde window.prompt genelde desteklenmez ama tarayıcı mode'u için veya
                        // UI'da ayrı bir div render edilerek de yapılabilir. Şimdilik dummy mesaj göndereceğiz:
                        // "Daha kompleks bir UI yapılana kadar sabit metin atalım" demek yerine
                        // vscode input kutusu açtırmak için backend'e command atılabilir.
                        // Fakat biz payload content alabiliyoruz. Şimdilik sadece "Tamamlandı" olarak işaretliyoruz.
                        vscode.postMessage({
                            command: 'markPromptCompleted',
                            payload: { promptId: prompt.id, content: '[Manuel Olarak Tamamlandı - Sonuç girilmedi]' }
                        });
                    }),
                    buildActionButton('Not Ekle', false, () => {
                        vscode.postMessage({
                            command: 'addPromptNote',
                            payload: { promptId: prompt.id, note: 'Kullanıcı tarafından incelendi.' }
                        });
                    })
                );
            }

            card.append(header, body, editArea, actions);

            if (prompt.responseText) {
                const responseEl = document.createElement('div');
                responseEl.className = 'prompt-card-response';
                let executionInfo = prompt.provider ? `(${prompt.provider})` : '(Bilinmiyor)';
                if (prompt.executionResult && prompt.executionResult.durationMs) {
                    executionInfo += ` - ${prompt.executionResult.durationMs}ms`;
                }
                responseEl.innerHTML = `<strong>Yanıt ${executionInfo}:</strong>\n${escapeHtml(prompt.responseText)}`;
                card.append(responseEl);
            }

            if (prompt.errorMessage) {
                const errorEl = document.createElement('div');
                errorEl.className = 'prompt-card-error';
                errorEl.innerHTML = `<strong>Hata:</strong> ${escapeHtml(prompt.errorMessage)}`;
                card.append(errorEl);
            }

            promptQueueList.appendChild(card);
        });
    }

    function buildActionButton(label, disabled, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'secondary-button';
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener('click', onClick);
        return button;
    }

    function translateStatus(status) {
        switch (status) {
            case 'pending':
                return 'Bekliyor';
            case 'running':
                return 'Çalışıyor';
            case 'completed':
                return 'Tamamlandı';
            case 'error':
                return 'Hata';
            default:
                return status;
        }
    }

    function translateValidationStatus(status) {
        switch (status) {
            case 'success':
                return 'Ba\u015Far\u0131l\u0131';
            case 'failed':
                return 'Ba\u015Far\u0131s\u0131z';
            case 'skipped':
                return 'Atland\u0131';
            case 'not_applicable':
                return 'Uygulanamaz';
            default:
                return 'Hen\u00FCz yok';
        }
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    vscode.postMessage({ command: 'panelReady' });
});
