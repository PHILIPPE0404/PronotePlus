document.addEventListener('DOMContentLoaded', async () => {
    loadPersonalization();
    lucide.createIcons();
    initLoginLoading();
    initLogin();
    initSupportModal();
    initPersonalizationControls();

    // Si une session valide existe déjà (rafraîchissement de page), on saute l'écran de connexion
    try {
        const me = await apiRequest('/api/me');
        if (me.logged_in) {
            const data = await apiRequest('/api/data');
            state.user = data.user;
            state.courses = data.courses;
            state.homework = data.homework;
            state.grades = construireGrades(data.notes);
            state.emails = data.emails;
            state.documents = data.documents;
            state.drive = data.drive || [];

            document.getElementById('login-page').classList.add('hidden');
            document.getElementById('app-container').classList.remove('hidden');
            initializeApp();
        }
    } catch (err) {
        // Pas de session active, on reste sur l'écran de connexion
    }
});

// Etat rempli avec les vraies données récupérées depuis /api/data après connexion
const state = {
    user: { name: "", class: "", school: "", avatar: "" },
    courses: [],
    homework: [],
    grades: [],
    emails: [],
    documents: [],
    drive: [],
};

async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

    if (!response.ok && !payload.error_code) {
        payload.error = payload.error || `Erreur serveur (${response.status})`;
    }
    return payload;
}

const loginLoading = {
    overlay: null,
    title: null,
    text: null,
    progress: null,
    timer: null,
};

function initLoginLoading() {
    loginLoading.overlay = document.getElementById('login-loading');
    loginLoading.title = document.getElementById('login-loading-title');
    loginLoading.text = document.getElementById('login-loading-text');
    loginLoading.progress = document.getElementById('login-loading-progress');
}

function showLoginLoading(step = 1, title = 'Connexion en cours', text = 'Vérification de tes informations…') {
    if (!loginLoading.overlay) initLoginLoading();
    if (!loginLoading.overlay) return;
    loginLoading.overlay.classList.remove('hidden');
    loginLoading.overlay.classList.add('is-visible');
    loginLoading.overlay.setAttribute('aria-busy', 'true');
    const connectionSvg = document.getElementById('connection-logo-svg');
    if (connectionSvg) {
        connectionSvg.classList.remove('animated');
        void connectionSvg.offsetWidth;
        connectionSvg.classList.add('animated');
    }
    loginLoading.title.textContent = title;
    loginLoading.text.textContent = text;
    loginLoading.progress.style.width = `${Math.min(94, 18 + step * 28)}%`;
    document.querySelectorAll('.loading-step').forEach((el, index) => {
        el.classList.toggle('active', index < step);
    });
    clearInterval(loginLoading.timer);
    let pulse = 0;
    loginLoading.timer = setInterval(() => {
        pulse = (pulse + 1) % 3;
        const dots = '.'.repeat(pulse + 1);
        loginLoading.text.textContent = text.replace(/…|\.+$/, '') + dots;
    }, 500);
}

function hideLoginLoading() {
    if (!loginLoading.overlay) return;
    clearInterval(loginLoading.timer);
    loginLoading.overlay.setAttribute('aria-busy', 'false');
    loginLoading.progress.style.width = '100%';
    setTimeout(() => {
        loginLoading.overlay.classList.remove('is-visible');
        setTimeout(() => loginLoading.overlay.classList.add('hidden'), 260);
    }, 180);
}



// ====== PERSONNALISATION (chargée depuis les préférences existantes, sans assistant de premier démarrage) ======
function loadPersonalization() {
    // V11: on nettoie une ancienne palette jaune/bleue pour repartir sur l'identité verte.
    if (localStorage.getItem('pronote_palette_version') !== '11') {
        localStorage.setItem('pronote_accent', 'green');
        localStorage.setItem('pronote_palette_version', '11');
    }
    const accent = localStorage.getItem('pronote_accent') || 'green';
    const size = localStorage.getItem('pronote_font_size') || 'normal';
    const colors = {
        green: ['#4ade80', '#22c55e'],
        blue: ['#60A5FA', '#38BDF8'],
        yellow: ['#FACC15', '#F59E0B'],
        pink: ['#F472B6', '#FB7185']
    };
    const sizes = { small: '14px', normal: '16px', large: '17.5px', xl: '19px' };
    const [a,b] = colors[accent] || colors.green;
    document.documentElement.style.setProperty('--accent-green', a);
    document.documentElement.style.setProperty('--accent-yellow', b);
    document.documentElement.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${a} 0%, ${b} 100%)`);
    document.documentElement.style.setProperty('--ui-font-size', sizes[size] || sizes.normal);
}
function initPersonalizationControls() { /* personnalisation complète retirée du premier démarrage */ }

function initialesDe(nom) {
    return (nom || "?").split(" ").filter(Boolean).slice(0, 2).map(m => m[0].toUpperCase()).join("");
}

// Construit state.grades (groupé par matière) à partir de la liste plate de notes renvoyée par l'API
function construireGrades(notes) {
    const parMatiere = {};
    notes.forEach(n => {
        const note = parseFloat(String(n.note).replace(",", "."));
        const sur = parseFloat(String(n.sur).replace(",", "."));
        const coef = parseFloat(String(n.coefficient).replace(",", ".")) || 1;
        if (!Number.isFinite(note) || !Number.isFinite(sur) || sur === 0) return;

        if (!parMatiere[n.matiere]) parMatiere[n.matiere] = [];
        parMatiere[n.matiere].push({
            name: n.date ? `Note du ${new Date(n.date).toLocaleDateString("fr-FR")}` : "Note",
            grade: note,
            total: sur,
            weight: coef,
        });
    });

    return Object.entries(parMatiere).map(([subject, items]) => ({
        subject, coef: 1, items,
    }));
}

// Connexion & Bouton voir le mot de passe
function initLogin() {
    initLoginLoading();
    const form = document.getElementById('login-form');
    const passwordInput = document.getElementById('password-input');
    const togglePasswordBtn = document.getElementById('toggle-password');

    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePasswordBtn.innerHTML = type === 'password' ? '<i data-lucide="eye"></i>' : '<i data-lucide="eye-off"></i>';
        lucide.createIcons();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username-input').value;
        const password = passwordInput.value;
        const submitBtn = form.querySelector('button[type="submit"]');
        let errorEl = document.getElementById('login-error');
        if (!errorEl) {
            errorEl = document.createElement('p');
            errorEl.id = 'login-error';
            errorEl.style.color = '#EF476F';
            errorEl.style.fontSize = '0.85rem';
            errorEl.style.marginTop = '10px';
            form.appendChild(errorEl);
        }
        errorEl.textContent = '';
        errorEl.classList.remove('login-error-support');
        submitBtn.disabled = true;
        submitBtn.classList.add('is-loading');
        submitBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span> Connexion…';
        showLoginLoading(1, 'Connexion en cours', 'Vérification de tes informations…');

        try {
            const loginRes = await apiRequest('/api/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });

            if (!loginRes.success) {
                errorEl.textContent = '';
                errorEl.classList.remove('login-error-support');

                if (loginRes.error_code === 'ENT_UNAVAILABLE') {
                    errorEl.classList.add('login-error-support');
                    errorEl.innerHTML = `
                        <strong>Connexion Pronote indisponible</strong><br>
                        ${loginRes.error || "La connexion Pronote n'est pas disponible depuis cet hébergement."}
                        <br><span class="login-error-detail">${loginRes.details || "L'accès à l'ENT est bloqué par l'hébergement."}</span>
                    `;
                } else {
                    errorEl.textContent = loginRes.error || "Connexion échouée.";
                }

                hideLoginLoading();
                submitBtn.disabled = false;
                submitBtn.classList.remove('is-loading');
                submitBtn.textContent = 'Se connecter';
                return;
            }

            showLoginLoading(2, 'Récupération des données', 'Chargement de ton emploi du temps, de tes devoirs et de tes notes…');
            const data = await apiRequest('/api/data');
            state.user = data.user;
            state.courses = data.courses;
            state.homework = data.homework;
            state.grades = construireGrades(data.notes);
            state.emails = data.emails;
            state.documents = data.documents;

            showLoginLoading(3, 'Presque prêt…', 'Mise en place de ton espace personnel…');
            const loginPage = document.getElementById('login-page');
            loginPage.style.animation = 'fadeSlideUp 0.35s reverse forwards';

            setTimeout(() => {
                loginPage.classList.add('hidden');
                const app = document.getElementById('app-container');
                app.classList.remove('hidden');
                initializeApp();
                hideLoginLoading();
                submitBtn.disabled = false;
                submitBtn.classList.remove('is-loading');

                // Vérifier si c'est la première connexion pour lancer le tutoriel
                if (!localStorage.getItem('pronote_onboarding_done')) {
                    startOnboardingTour();
                }
            }, 400);
        } catch (err) {
            hideLoginLoading();
            errorEl.textContent = "Impossible de contacter le serveur. Vérifie ta connexion et réessaie.";
            submitBtn.disabled = false;
            submitBtn.classList.remove('is-loading');
            submitBtn.textContent = 'Se connecter';
        }
    });

    const helpBtn = document.getElementById('login-help-btn');
    const helpModal = document.getElementById('login-help-modal');
    const helpAnswer = document.getElementById('help-answer');
    const closeHelpBtn = document.getElementById('close-login-help');
    if (helpBtn && helpModal && helpAnswer) {
        const closeHelp = () => {
            helpModal.classList.remove('is-visible');
            setTimeout(() => helpModal.classList.add('hidden'), 180);
        };
        helpBtn.addEventListener('click', () => {
            helpModal.classList.remove('hidden');
            requestAnimationFrame(() => helpModal.classList.add('is-visible'));
            lucide.createIcons();
        });
        closeHelpBtn?.addEventListener('click', closeHelp);
        helpModal.addEventListener('click', (event) => {
            if (event.target === helpModal) closeHelp();
        });
        document.querySelectorAll('.help-question').forEach(question => {
            question.addEventListener('click', () => {
                document.querySelectorAll('.help-question').forEach(q => q.classList.remove('selected'));
                question.classList.add('selected');
                helpAnswer.textContent = question.dataset.answer || '';
            });
        });
    }
}


function initSupportModal() {
    const openBtn = document.getElementById('support-btn');
    const modal = document.getElementById('support-modal');
    const closeBtn = document.getElementById('close-support');
    if (!openBtn || !modal) return;

    const open = () => {
        modal.classList.remove('hidden');
        requestAnimationFrame(() => modal.classList.add('is-visible'));
        modal.setAttribute('aria-hidden', 'false');
        lucide.createIcons();
    };
    const close = () => {
        modal.classList.remove('is-visible');
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => modal.classList.add('hidden'), 180);
    };

    openBtn.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('is-visible')) close();
    });
}

function initializeApp() {
    if (localStorage.getItem('pronote_theme') === 'light') document.body.classList.add('light-theme');
    document.getElementById('theme-toggle').addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('pronote_theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(t => t.classList.add('hidden'));
            
            btn.classList.add('active');
            const target = document.getElementById(`tab-${btn.dataset.tab}`);
            target.classList.remove('hidden');
            
            target.querySelectorAll('.animate-item').forEach(el => {
                el.style.animation = 'none';
                el.offsetHeight;
                el.style.animation = null;
            });
        });
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        location.reload();
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.add('hidden');
        });
    });

    // Pronote donne le nom sous la forme "NOM Prénom" (nom de famille en premier)
    const nomParts = (state.user.name || "").trim().split(' ');
    const prenom = nomParts.length > 1 ? nomParts[nomParts.length - 1] : (nomParts[0] || "");
    const nomFamille = nomParts.length > 1 ? nomParts.slice(0, -1).join(' ') : "";

    const initiales = initialesDe(state.user.name);
    document.getElementById('nav-avatar').textContent = initiales;
    document.getElementById('profile-avatar').textContent = initiales;
    document.getElementById('nav-name').textContent = prenom ? `${prenom} ${nomFamille.charAt(0)}.` : "Élève";
    document.getElementById('nav-class').textContent = state.user.class;
    document.getElementById('welcome-name').textContent = prenom || "à toi";
    document.getElementById('profile-name').textContent = state.user.name;
    document.getElementById('profile-class').textContent = state.user.class;
    const schoolEl = document.querySelector('.school-text');
    if (schoolEl) schoolEl.innerHTML = `<i data-lucide="building"></i> ${state.user.school}`;

    document.getElementById('restart-tour-btn').addEventListener('click', () => {
        startOnboardingTour();
    });

    loadAccueil();
    loadTimetable();
    loadHomework();
    loadGrades();
    loadDrive();
    loadEmails();
    loadProfile();
    initDashboardCustomizer();
    lucide.createIcons();
}

// ====== ACCUEIL & WIDGETS ======
function formatHeure(iso) {
    const d = new Date(iso);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function loadAccueil() {
    const maintenant = new Date();
    const aujourdhui = maintenant.toDateString();

    const todayCourses = state.courses
        .filter(c => new Date(c.debut).toDateString() === aujourdhui)
        .sort((a, b) => new Date(a.debut) - new Date(b.debut));

    const nextClass = state.courses
        .filter(c => new Date(c.debut) > maintenant && !c.annule)
        .sort((a, b) => new Date(a.debut) - new Date(b.debut))[0];

    const nextContainer = document.getElementById('next-class-content');
    if(nextClass) {
        nextContainer.innerHTML = `
            <div class="huge-grade" style="font-size:1.5rem; margin:5px 0;">${formatHeure(nextClass.debut)} - ${formatHeure(nextClass.fin)}</div>
            <p style="font-weight:bold; font-size:1.1rem;">${nextClass.subject}</p>
            <p class="mono-text" style="color:var(--text-secondary); margin-top:4px;">Salle : ${nextClass.room || '—'} | ${nextClass.teacher || ''}</p>
        `;
    } else {
        nextContainer.innerHTML = `<p style="color:var(--text-secondary)">Aucun cours prochainement.</p>`;
    }

    const todayList = document.getElementById('today-classes');
    todayList.innerHTML = '';
    if (todayCourses.length === 0) {
        todayList.innerHTML = `<li style="color:var(--text-secondary); font-size:0.9rem;">Pas de cours aujourd'hui.</li>`;
    }
    todayCourses.forEach(c => {
        const li = document.createElement('li');
        li.className = 'hw-item';
        li.style.cursor = 'pointer';
        li.innerHTML = `
            <span class="mono-text">${formatHeure(c.debut)}</span>
            <strong>${c.subject}</strong>
            <span class="tag">${c.room || ''}</span>
        `;
        li.addEventListener('click', () => showCourseWidgetContent(c));
        todayList.appendChild(li);
    });

    const urgentList = document.getElementById('urgent-homework');
    urgentList.innerHTML = '';
    const devoirsAFaire = state.homework
        .filter(h => !h.done)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 3);
    if (devoirsAFaire.length === 0) {
        urgentList.innerHTML = '<li style="color:var(--text-secondary); font-size:0.9rem;">Rien à faire pour l\'instant. 🎉</li>';
    }
    devoirsAFaire.forEach(h => {
        const dateLabel = new Date(h.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        urgentList.innerHTML += `
            <li class="hw-item">
                <div><strong>${h.subject}</strong> : ${h.description}</div>
                <span class="tag" style="color:var(--accent-yellow)">${dateLabel}</span>
            </li>
        `;
    });

    const recentGrades = document.getElementById('recent-grades-content');
    const toutesNotes = [];
    state.grades.forEach(s => s.items.forEach(item => toutesNotes.push({ subject: s.subject, ...item })));
    if (toutesNotes.length === 0) {
        recentGrades.innerHTML = `<p style="color:var(--text-secondary); font-size:0.9rem;">Pas encore de notes disponibles pour cette période.</p>`;
    } else {
        recentGrades.innerHTML = toutesNotes.slice(-3).reverse().map(n => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-color);">
                <span>${n.subject} (${n.name})</span>
                <strong style="color:var(--accent-green)">${n.grade} / ${n.total}</strong>
            </div>
        `).join('');
    }

    const quickMsg = document.getElementById('quick-messages-content');
    const unreadCount = state.emails.filter(e => e.unread).length;
    quickMsg.innerHTML = `
        <p style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:8px;">${unreadCount} nouveaux messages non lus.</p>
        <button class="btn-secondary" onclick="document.querySelector('[data-tab=\\'email\\']').click()" style="width:100%; justify-content:center;">Ouvrir la messagerie</button>
    `;

    const postit = document.getElementById('postit-text');
    postit.value = localStorage.getItem('pronote_postit') || "Penser à rendre le livre de philo au CDI !";
    postit.addEventListener('input', () => localStorage.setItem('pronote_postit', postit.value));
}

window.showCourseWidgetContent = function(c) {
    const box = document.getElementById('widget-course-desc');
    box.innerHTML = `
        <strong>${c.subject}</strong> (${formatHeure(c.debut)} - ${formatHeure(c.fin)})<br>
        <span style="color:var(--accent-green);">${c.teacher || ''} - Salle ${c.room || '—'}</span>
        <p style="margin-top:5px; color:var(--text-secondary); font-size:0.9rem;">${c.desc || "Aucun contenu renseigné."}</p>
    `;
}

// ====== PERSONNALISATION ACCUEIL (Drag & Drop & 3 tailles de widgets) ======
function initDashboardCustomizer() {
    const editBtn = document.getElementById('edit-dashboard-btn');
    const addBtn = document.getElementById('add-widget-btn');
    const grid = document.getElementById('main-grid');
    let isEditing = false;

    const savedLayout = JSON.parse(localStorage.getItem('pronote_dashboard_layout') || '{}');
    document.querySelectorAll('.widget').forEach(w => {
        const id = w.dataset.widget;
        if(savedLayout[id] === 'hidden') w.classList.add('hidden');
        if(savedLayout[id] === 'large') w.classList.add('col-span-2');
        if(savedLayout[id] === 'small') w.classList.add('widget-small');
    });

    editBtn.addEventListener('click', () => {
        isEditing = !isEditing;
        grid.classList.toggle('editing');
        addBtn.classList.toggle('hidden');

        if(isEditing) {
            editBtn.innerHTML = '<i data-lucide="check"></i> <span>Terminer</span>';
            document.querySelectorAll('.widget-controls').forEach(c => c.classList.remove('hidden'));
        } else {
            editBtn.innerHTML = '<i data-lucide="move"></i> <span>Personnaliser</span>';
            document.querySelectorAll('.widget-controls').forEach(c => c.classList.add('hidden'));
            saveDashboardLayout();
        }
        lucide.createIcons();
    });

    let draggedWidget = null;
    document.querySelectorAll('.widget').forEach(w => {
        w.addEventListener('dragstart', (e) => {
            if(!isEditing) { e.preventDefault(); return; }
            draggedWidget = w;
            e.dataTransfer.effectAllowed = 'move';
        });
        w.addEventListener('dragover', (e) => {
            if(!isEditing) return;
            e.preventDefault();
        });
        w.addEventListener('drop', (e) => {
            if(!isEditing || draggedWidget === w) return;
            e.preventDefault();
            const allWidgets = Array.from(grid.querySelectorAll('.widget'));
            const draggedPos = allWidgets.indexOf(draggedWidget);
            const targetPos = allWidgets.indexOf(w);
            if(draggedPos < targetPos) {
                grid.insertBefore(draggedWidget, w.nextSibling);
            } else {
                grid.insertBefore(draggedWidget, w);
            }
        });

        // Gestion du cycle des 3 tailles : Normal -> Grand (col-span-2) -> Petit (widget-small) -> Normal
        w.querySelector('.resize-w').addEventListener('click', () => {
            if(w.classList.contains('col-span-2')) {
                w.classList.remove('col-span-2');
                w.classList.add('widget-small');
            } else if(w.classList.contains('widget-small')) {
                w.classList.remove('widget-small');
            } else {
                w.classList.add('col-span-2');
            }
        });

        w.querySelector('.remove-w').addEventListener('click', () => {
            w.classList.add('hidden');
        });
    });

    addBtn.addEventListener('click', () => {
        const modal = document.getElementById('widget-modal');
        const list = document.getElementById('hidden-widgets-list');
        list.innerHTML = '';

        document.querySelectorAll('.widget').forEach(w => {
            if(w.classList.contains('hidden')) {
                const title = w.querySelector('h3').innerText;
                list.innerHTML += `<button class="btn-secondary" data-id="${w.dataset.widget}" style="justify-content:space-between;"><span>${title}</span> <i data-lucide="plus-circle"></i></button>`;
            }
        });

        if(list.innerHTML === '') list.innerHTML = '<p style="color:var(--text-secondary); text-align:center;">Tous les widgets sont déjà affichés.</p>';

        modal.classList.remove('hidden');
        lucide.createIcons();

        list.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelector(`.widget[data-widget="${btn.dataset.id}"]`).classList.remove('hidden');
                modal.classList.add('hidden');
            });
        });
    });
}

function saveDashboardLayout() {
    const layout = {};
    document.querySelectorAll('.widget').forEach(w => {
        if(w.classList.contains('hidden')) layout[w.dataset.widget] = 'hidden';
        else if(w.classList.contains('col-span-2')) layout[w.dataset.widget] = 'large';
        else if(w.classList.contains('widget-small')) layout[w.dataset.widget] = 'small';
        else layout[w.dataset.widget] = 'normal';
    });
    localStorage.setItem('pronote_dashboard_layout', JSON.stringify(layout));
}

// ====== EMPLOI DU TEMPS (précision à la minute, semaine courante) ======
const TT_HOUR_START = 8;
const TT_HOUR_END = 18; // grille de 8h à 18h
const TT_ROW_PX = 80;   // doit correspondre à grid-template-rows dans le CSS
const TT_PX_PER_MIN = TT_ROW_PX / 60;

let timetableWeekOffset = 0; // 0 = semaine courante

function getMondayOf(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function loadTimetable() {
    const grid = document.getElementById('timetable-grid');
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const nbRows = TT_HOUR_END - TT_HOUR_START;

    grid.innerHTML = '';
    grid.style.gridTemplateRows = `40px repeat(${nbRows}, ${TT_ROW_PX}px)`;
    grid.innerHTML += '<div style="grid-column: 1; grid-row: 1;"></div>';

    const monday = getMondayOf(new Date());
    monday.setDate(monday.getDate() + timetableWeekOffset * 7);

    days.forEach((d, i) => {
        const date = new Date(monday);
        date.setDate(date.getDate() + i);
        const label = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        grid.innerHTML += `<div class="tt-header" style="grid-column: ${i + 2}; grid-row: 1;">${d}<br><span class="mono-text" style="font-weight:400; font-size:0.7rem; color:var(--text-secondary);">${label}</span></div>`;
    });

    for(let h = TT_HOUR_START; h < TT_HOUR_END; h++) {
        grid.innerHTML += `<div class="tt-time" style="grid-column: 1; grid-row: ${h - TT_HOUR_START + 2};">${h}h00</div>`;
    }

    for (let i = 0; i < 5; i++) {
        const col = document.createElement('div');
        col.className = 'tt-day-col';
        col.style.gridColumn = i + 2;
        col.style.gridRow = `2 / span ${nbRows}`;
        col.dataset.day = i;
        grid.appendChild(col);
    }

    const weekEnd = new Date(monday);
    weekEnd.setDate(weekEnd.getDate() + 5);

    const coursSemaine = state.courses.filter(c => {
        const debut = new Date(c.debut);
        return debut >= monday && debut < weekEnd;
    });

    coursSemaine.forEach(c => {
        const debut = new Date(c.debut);
        const fin = new Date(c.fin);
        const dayIndex = (debut.getDay() + 6) % 7; // 0 = lundi ... 4 = vendredi
        if (dayIndex > 4) return;

        const col = grid.querySelector(`.tt-day-col[data-day="${dayIndex}"]`);
        if (!col) return;

        const startMin = (debut.getHours() - TT_HOUR_START) * 60 + debut.getMinutes();
        const dureeMin = (fin - debut) / 60000;
        if (startMin < 0 || startMin > nbRows * 60) return;

        const el = document.createElement('div');
        el.className = 'tt-cell' + (c.annule ? ' tt-cell-canceled' : '');
        el.style.top = `${startMin * TT_PX_PER_MIN}px`;
        el.style.height = `${Math.max(dureeMin * TT_PX_PER_MIN - 6, 22)}px`;

        el.innerHTML = `
            <strong>${c.subject}</strong><br>
            <span class="mono-text">${c.room || ''}</span><br>
            <span style="font-size:0.75rem; color:var(--text-secondary);">${c.teacher || ''}</span>
        `;

        el.addEventListener('click', () => openCourseModal(c));
        col.appendChild(el);
    });

    let navBar = document.getElementById('tt-week-nav');
    if (!navBar) {
        navBar = document.createElement('div');
        navBar.id = 'tt-week-nav';
        navBar.style.cssText = 'display:flex; align-items:center; justify-content:center; gap:20px; margin-bottom:12px;';
        navBar.innerHTML = `
            <button class="btn-secondary" id="tt-prev-week" style="width:auto; padding:6px 14px;">&larr; Semaine préc.</button>
            <span class="mono-text" id="tt-week-label" style="font-weight:600;"></span>
            <button class="btn-secondary" id="tt-next-week" style="width:auto; padding:6px 14px;">Semaine suiv. &rarr;</button>
        `;
        grid.parentElement.insertBefore(navBar, grid);
        document.getElementById('tt-prev-week').addEventListener('click', () => { timetableWeekOffset--; loadTimetable(); });
        document.getElementById('tt-next-week').addEventListener('click', () => { timetableWeekOffset++; loadTimetable(); });
    }
    const finSemaineAffichee = new Date(monday);
    finSemaineAffichee.setDate(finSemaineAffichee.getDate() + 4);
    document.getElementById('tt-week-label').textContent =
        `${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${finSemaineAffichee.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

function openCourseModal(c) {
    document.getElementById('modal-subject').textContent = c.subject;
    document.getElementById('modal-time').textContent = `${formatHeure(c.debut)} - ${formatHeure(c.fin)}`;
    document.getElementById('modal-room').textContent = c.room || '—';
    document.getElementById('modal-teacher').textContent = c.teacher || '—';
    document.getElementById('modal-description').textContent = c.desc || "Aucun contenu renseigné pour ce cours.";

    const filesEl = document.getElementById('modal-files');
    const fichiers = c.files || [];
    if(fichiers.length > 0) {
        document.getElementById('modal-attachments').classList.remove('hidden');
        filesEl.innerHTML = fichiers.map(f => `
            <li><a href="${f.url}" target="_blank"><i data-lucide="file-text"></i> ${f.name}</a></li>
        `).join('');
    } else {
        document.getElementById('modal-attachments').classList.add('hidden');
    }

    lucide.createIcons();
    document.getElementById('class-modal').classList.remove('hidden');
}

// ====== DEVOIRS PAR JOUR — progression + filtres + confetti ======
let homeworkFilter = 'all';

function updateHomeworkOverview() {
    const total = state.homework.length;
    const done = state.homework.filter(h => h.done).length;
    const todo = Math.max(0, total - done);
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    document.getElementById('homework-total')?.replaceChildren(document.createTextNode(String(total)));
    document.getElementById('homework-done')?.replaceChildren(document.createTextNode(String(done)));
    document.getElementById('homework-todo')?.replaceChildren(document.createTextNode(String(todo)));
    document.getElementById('homework-progress-text')?.replaceChildren(document.createTextNode(`${progress}%`));
    document.getElementById('homework-progress-pill')?.replaceChildren(document.createTextNode(`${progress}% terminé`));
    const bar = document.getElementById('homework-progress-bar');
    if (bar) bar.style.width = `${progress}%`;
}

function setHomeworkFilter(filter) {
    homeworkFilter = filter;
    document.querySelectorAll('.homework-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.homeworkFilter === filter);
    });
    loadHomework();
}

function loadHomework() {
    const container = document.getElementById('all-homework-list');
    if (!container) return;
    updateHomeworkOverview();
    container.innerHTML = '';

    const filtered = state.homework.filter(h => {
        if (homeworkFilter === 'todo') return !h.done;
        if (homeworkFilter === 'done') return !!h.done;
        return true;
    });

    const parDate = {};
    filtered
        .slice()
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(h => {
            if (!parDate[h.date]) parDate[h.date] = [];
            parDate[h.date].push(h);
        });

    if (filtered.length === 0) {
        const message = homeworkFilter === 'done'
            ? 'Aucun devoir terminé pour le moment.'
            : homeworkFilter === 'todo'
                ? '🎉 Tous tes devoirs sont terminés !'
                : 'Aucun devoir à venir. 🎉';
        container.innerHTML = `
            <div class="homework-empty-state">
                <div class="homework-empty-icon"><i data-lucide="sparkles"></i></div>
                <strong>${message}</strong>
                <span>${homeworkFilter === 'done' ? 'Valide un devoir pour le faire apparaître ici.' : 'Ton espace de travail est à jour.'}</span>
            </div>`;
        lucide.createIcons();
        return;
    }

    Object.keys(parDate).forEach(dateStr => {
        const label = new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const isToday = new Date(dateStr).toDateString() === new Date().toDateString();
        let groupHtml = `
            <div class="hw-day-group">
                <div class="hw-day-heading">
                    <div>
                        <h3 class="hw-day-title">${label.charAt(0).toUpperCase() + label.slice(1)}</h3>
                        ${isToday ? '<span class="hw-today-tag">Aujourd’hui</span>' : ''}
                    </div>
                    <span class="hw-day-count">${parDate[dateStr].length} devoir${parDate[dateStr].length > 1 ? 's' : ''}</span>
                </div>
        `;
        parDate[dateStr].forEach(h => {
            groupHtml += `
                <div class="hw-item ${h.done ? 'hw-item-done' : ''}">
                    <div class="hw-item-main">
                        <label class="hw-check-wrap" aria-label="${h.done ? 'Marquer comme non terminé' : 'Marquer comme terminé'}">
                            <input type="checkbox" id="hw-check-${h.id}" ${h.done ? 'checked' : ''} onchange="toggleHomework(event, '${h.id}')">
                            <span class="hw-check-custom"><i data-lucide="check"></i></span>
                        </label>
                        <label for="hw-check-${h.id}" class="hw-item-label ${h.done ? 'hw-done' : ''}">
                            <strong>${h.subject}</strong>
                            <span>${h.description}</span>
                        </label>
                    </div>
                    <span class="hw-state ${h.done ? 'done' : 'todo'}">${h.done ? 'Terminé' : 'À faire'}</span>
                </div>
            `;
        });
        groupHtml += `</div>`;
        container.innerHTML += groupHtml;
    });
    lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.homework-filter').forEach(btn => {
        btn.addEventListener('click', () => setHomeworkFilter(btn.dataset.homeworkFilter));
    });
});

window.toggleHomework = function(event, id) {
    const item = state.homework.find(h => h.id === id);
    if(item) {
        item.done = !item.done;
        if(item.done) {
            const rect = event.target.getBoundingClientRect();
            triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
        apiRequest('/api/homework/toggle', {
            method: 'POST',
            body: JSON.stringify({ id: item.id, done: item.done }),
        }).catch(() => {});
        loadHomework();
        loadAccueil();
    }
}

function triggerConfetti(x, y) {
    for(let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        const angle = Math.random() * Math.PI * 2;
        const speed = 25 + Math.random() * 45;
        particle.style.setProperty('--dx', `${Math.cos(angle) * speed}px`);
        particle.style.setProperty('--dy', `${Math.sin(angle) * speed}px`);
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 600);
    }
}

// ====== NOTES & SIMULATEUR ======
function loadGrades() {
    const listEl = document.getElementById('subjects-grades');
    listEl.innerHTML = '';
    const simSelect = document.getElementById('sim-subject');
    simSelect.innerHTML = '';

    let totalPoints = 0;
    let totalCoef = 0;

    state.grades.forEach((s, idx) => {
        let subSum = 0;
        let subWeight = 0;
        s.items.forEach(item => {
            subSum += (item.grade / item.total) * 20 * item.weight;
            subWeight += item.weight;
        });
        const subAvg = subWeight > 0 ? subSum / subWeight : 0;
        totalPoints += subAvg * s.coef;
        totalCoef += s.coef;

        simSelect.innerHTML += `<option value="${idx}">${s.subject}</option>`;

        let detailsHtml = '';
        s.items.forEach(item => {
            const contribution = ((item.grade / item.total) * 20 * (item.weight / subWeight)).toFixed(2);
            detailsHtml += `
                <div class="grade-detail-row">
                    <span>${item.name} (Coef ${item.weight})</span>
                    <span><strong>${item.grade} / ${item.total}</strong> <span style="color:var(--text-secondary); font-size:0.8rem;">(+${contribution} pts sur la moy. matière)</span></span>
                </div>
            `;
        });

        listEl.innerHTML += `
            <div class="subject-card">
                <div class="subject-header" onclick="toggleSubjectDetails(this)">
                    <div>
                        <strong>${s.subject}</strong> <span class="tag" style="margin-left:10px;">Coef ${s.coef}</span>
                    </div>
                    <div style="font-size:1.2rem; font-weight:bold; color:var(--accent-green);">${subAvg.toFixed(2)}/20 <i data-lucide="chevron-down" style="width:16px; vertical-align:middle; margin-left:5px;"></i></div>
                </div>
                <div class="subject-details">
                    ${detailsHtml}
                </div>
            </div>
        `;
    });

    const overall = totalCoef > 0 ? (totalPoints / totalCoef).toFixed(2) : 0;
    document.getElementById('overall-avg').textContent = `${overall}/20`;
    lucide.createIcons();

    setupSimulator(totalPoints, totalCoef);
}

window.toggleSubjectDetails = function(headerEl) {
    const details = headerEl.nextElementSibling;
    details.classList.toggle('open');
}

function setupSimulator(currentTotalPoints, currentTotalCoef) {
    const simSubject = document.getElementById('sim-subject');
    const simGrade = document.getElementById('sim-grade');
    const simResult = document.getElementById('sim-result');

    function calculateSim() {
        const subIndex = simSubject.value;
        const val = parseFloat(simGrade.value);
        if(isNaN(val)) {
            simResult.textContent = "";
            return;
        }
        const s = state.grades[subIndex];
        let subSum = val * 1; 
        let subWeight = 1;
        s.items.forEach(item => {
            subSum += (item.grade / item.total) * 20 * item.weight;
            subWeight += item.weight;
        });
        const newSubAvg = subSum / subWeight;

        let newTotalPoints = 0;
        state.grades.forEach((sub, i) => {
            if(i == subIndex) {
                newTotalPoints += newSubAvg * sub.coef;
            } else {
                let oldSum = 0, oldW = 0;
                sub.items.forEach(it => { oldSum += (it.grade / it.total) * 20 * it.weight; oldW += it.weight; });
                newTotalPoints += (oldW > 0 ? oldSum / oldW : 0) * sub.coef;
            }
        });
        const newOverall = (newTotalPoints / currentTotalCoef).toFixed(2);
        simResult.textContent = `Nouvelle moyenne générale estimée : ${newOverall}/20 (Matière : ${newSubAvg.toFixed(2)}/20)`;
    }

    simSubject.onchange = calculateSim;
    simGrade.oninput = calculateSim;
}

// ====== DRIVE (Espace personnel & fichiers par matière) ======
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
}

async function refreshDrive() {
    const result = await apiRequest('/api/drive');
    if (result.files) {
        state.drive = result.files;
        loadDrive();
    }
}

function loadDrive() {
    const personalList = document.getElementById('personal-drive-list');
    const subjectDriveList = document.getElementById('subject-drive-list');

    personalList.innerHTML = '';
    if (!state.drive.length) {
        personalList.innerHTML = '<li class="drive-empty">Aucun fichier personnel pour le moment.</li>';
    }

    state.drive.forEach(doc => {
        personalList.innerHTML += `
            <li class="drive-file-row">
                <a href="${escapeHtml(doc.url)}" target="_blank" rel="noopener">
                    <i data-lucide="file-text"></i>
                    <span>${escapeHtml(doc.name)}</span>
                </a>
                <span class="drive-file-actions">
                    <span class="mono-text">${escapeHtml(doc.size)}</span>
                    <button class="btn-icon drive-delete-btn" title="Supprimer" data-drive-name="${escapeHtml(doc.name)}"><i data-lucide="trash-2"></i></button>
                </span>
            </li>
        `;
    });

    subjectDriveList.innerHTML = '';
    const subjectsMap = {};
    state.courses.forEach(c => {
        (c.files || []).forEach(f => {
            if (!subjectsMap[c.subject]) subjectsMap[c.subject] = [];
            subjectsMap[c.subject].push(f);
        });
    });

    if (Object.keys(subjectsMap).length === 0) {
        subjectDriveList.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem;">Aucun fichier partagé par tes professeurs pour le moment.</p>';
    }

    for (const [subject, files] of Object.entries(subjectsMap)) {
        let filesHtml = '';
        files.forEach(f => {
            filesHtml += `
                <div class="subject-drive-file">
                    <a href="${escapeHtml(f.url)}" target="_blank" rel="noopener">
                        <i data-lucide="file"></i> ${escapeHtml(f.name)}
                    </a>
                    <span class="mono-text">Partagé par le prof</span>
                </div>
            `;
        });

        subjectDriveList.innerHTML += `
            <div class="subject-drive-card">
                <strong>${escapeHtml(subject)}</strong>
                ${filesHtml}
            </div>
        `;
    }

    const uploadButton = document.getElementById('upload-file-btn');
    const fileInput = document.getElementById('drive-file-input');
    if (uploadButton && fileInput && !uploadButton.dataset.bound) {
        uploadButton.dataset.bound = '1';
        uploadButton.onclick = () => fileInput.click();
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);

            uploadButton.disabled = true;
            uploadButton.classList.add('is-loading');
            try {
                const res = await fetch('/api/drive/upload', { method: 'POST', body: formData });
                const data = await res.json();
                if (!res.ok || !data.success) throw new Error(data.error || 'Upload impossible.');
                state.drive.unshift(data.file);
                loadDrive();
            } catch (err) {
                alert(err.message);
            } finally {
                uploadButton.disabled = false;
                uploadButton.classList.remove('is-loading');
                fileInput.value = '';
            }
        });
    }

    document.querySelectorAll('.drive-delete-btn').forEach(btn => {
        btn.onclick = async (evt) => {
            evt.preventDefault();
            const filename = btn.dataset.driveName;
            if (!confirm(`Supprimer « ${filename} » ?`)) return;
            const res = await fetch(`/api/drive/file/${encodeURIComponent(filename)}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok || !data.success) {
                alert(data.error || 'Suppression impossible.');
                return;
            }
            state.drive = state.drive.filter(f => f.name !== filename);
            loadDrive();
        };
    });
    lucide.createIcons();
}

// ====== MESSAGERIE EMAIL SMTP (Trié par lu / non lu) ======
function loadEmails() {
    const list = document.getElementById('email-list');
    list.innerHTML = '';

    const sortedEmails = [...state.emails].sort((a, b) => {
        if (a.unread !== b.unread) return b.unread - a.unread;
        return String(b.time || '').localeCompare(String(a.time || ''));
    });

    if (!sortedEmails.length) {
        list.innerHTML = '<div class="email-empty">Aucun message pour le moment.</div>';
    }

    sortedEmails.forEach(e => {
        list.innerHTML += `
            <div class="email-item ${e.unread ? 'email-unread' : ''}" data-email-id="${escapeHtml(e.id)}">
                <div style="display:flex; align-items:center; gap:15px; width:100%;">
                    <div class="avatar" style="width:35px; height:35px; font-size:0.9rem;">${escapeHtml((e.sender || '?').charAt(0).toUpperCase())}</div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:3px; gap:10px;">
                            <strong>${escapeHtml(e.sender)}</strong>
                            <span class="mono-text" style="color:var(--text-secondary); font-size:0.8rem;">${escapeHtml(e.time || '')}</span>
                        </div>
                        <p style="color:var(--text-secondary); font-size:0.9rem;">${escapeHtml(e.subject)}</p>
                    </div>
                </div>
            </div>
        `;
    });

    list.querySelectorAll('[data-email-id]').forEach(item => {
        item.addEventListener('click', () => openEmail(item.dataset.emailId));
    });

    document.getElementById('new-email-btn').onclick = () => {
        document.getElementById('email-status').textContent = '';
        document.getElementById('email-modal').classList.remove('hidden');
    };

    document.getElementById('send-email-form').onsubmit = async (evt) => {
        evt.preventDefault();
        const to = document.getElementById('email-to').value.trim();
        const sub = document.getElementById('email-subject').value.trim();
        const body = document.getElementById('email-body').value.trim();
        const button = evt.target.querySelector('button[type="submit"]');
        const status = document.getElementById('email-status');

        button.disabled = true;
        status.textContent = 'Envoi SMTP…';
        status.className = 'email-status';

        try {
            const result = await apiRequest('/api/email/send', {
                method: 'POST',
                body: JSON.stringify({ to, subject: sub, body })
            });
            if (!result.success) throw new Error(result.error || 'Envoi impossible.');

            state.emails.unshift(result.message);
            loadEmails();
            document.getElementById('email-modal').classList.add('hidden');
            evt.target.reset();
        } catch (err) {
            status.textContent = err.message;
            status.classList.add('error');
        } finally {
            button.disabled = false;
        }
    };
}

window.openEmail = function(id) {
    const email = state.emails.find(e => String(e.id) === String(id));
    if (email) {
        email.unread = false;
        document.getElementById('read-email-subject').textContent = email.subject;
        document.getElementById('read-email-sender').textContent = `De : ${email.sender}`;
        document.getElementById('read-email-body').textContent = email.body;
        document.getElementById('read-email-modal').classList.remove('hidden');
        loadEmails();
    }
}

// ====== PROFIL ======
function loadProfile() {
    const docsList = document.getElementById('documents-list');
    docsList.innerHTML = '';
    state.documents.forEach(d => {
        docsList.innerHTML += `
            <li>
                <a href="#"><i data-lucide="file-text"></i> ${d.name}</a>
                <span class="mono-text" style="color:var(--text-secondary); font-size:0.8rem;">${d.size}</span>
            </li>
        `;
    });
}

// ====== TUTORIEL / ONBOARDING (Première connexion) ======
const tourSteps = [
    { title: "Bienvenue sur Pronote+ !", text: "Quelques étapes pour découvrir ton espace scolaire." },
    { title: "Le tableau de bord", text: "Ton accueil est personnalisable : déplace les widgets, change leur taille ou masque ceux dont tu n’as pas besoin." },
    { title: "Emploi du temps", text: "Consulte tes cours et ouvre une séance pour retrouver la salle, le professeur, le contenu et les fichiers joints." },
    { title: "Devoirs", text: "Coche tes travaux au fur et à mesure. La page des devoirs affiche ta progression et sépare facilement les tâches à faire des tâches terminées." },
    { title: "Notes", text: "Retrouve tes notes par matière et utilise le simulateur pour voir l’effet d’une future note sur ta moyenne." },
    { title: "Drive & Messagerie", text: "Retrouve tes documents et tes fichiers de cours dans le Drive, puis consulte ou envoie des messages depuis la messagerie." }
];

let currentTourStep = 0;

function startOnboardingTour() {
    currentTourStep = 0;
    renderTourStep();
    document.getElementById('onboarding-modal').classList.remove('hidden');
}

function renderTourStep() {
    const step = tourSteps[currentTourStep];
    document.getElementById('tour-step-indicator').textContent = `Étape ${currentTourStep + 1} sur ${tourSteps.length}`;
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-text').textContent = step.text;
    lucide.createIcons();

    const prevBtn = document.getElementById('tour-prev-btn');
    const nextBtn = document.getElementById('tour-next-btn');

    prevBtn.style.display = currentTourStep === 0 ? 'none' : 'block';
    nextBtn.textContent = currentTourStep === tourSteps.length - 1 ? 'Terminer' : 'Suivant';
}

document.addEventListener('DOMContentLoaded', () => {
    const prevBtn = document.getElementById('tour-prev-btn');
    const nextBtn = document.getElementById('tour-next-btn');
    const skipBtn = document.getElementById('tour-skip-btn');
    const closeTourBtn = document.getElementById('close-tour-btn');

    if(prevBtn) {
        prevBtn.onclick = () => {
            if(currentTourStep > 0) {
                currentTourStep--;
                renderTourStep();
            }
        };
    }

    if(nextBtn) {
        nextBtn.onclick = () => {
            if(currentTourStep < tourSteps.length - 1) {
                currentTourStep++;
                renderTourStep();
            } else {
                localStorage.setItem('pronote_onboarding_done', 'true');
                document.getElementById('onboarding-modal').classList.add('hidden');
            }
        };
    }

    if(skipBtn) {
        skipBtn.onclick = () => {
            localStorage.setItem('pronote_onboarding_done', 'true');
            document.getElementById('onboarding-modal').classList.add('hidden');
        };
    }

    if(closeTourBtn) {
        closeTourBtn.onclick = () => {
            localStorage.setItem('pronote_onboarding_done', 'true');
            document.getElementById('onboarding-modal').classList.add('hidden');
        };
    }
});
