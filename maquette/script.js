// Navigation entre sections
const navItems = document.querySelectorAll('.nav-item[data-page]');
const sections = {
    dashboard: document.getElementById('dashboard-page'),
    map: document.getElementById('map-page'),
    reports: document.getElementById('reports-page'),
    tours: document.getElementById('tours-page'),
    optim: document.getElementById('optim-page'),
    collab: document.getElementById('collab-page'),
    settings: document.getElementById('settings-page')
};
const pageTitle = document.getElementById('pageMainTitle');
const pageSubTitle = document.getElementById('pageSubTitle');
const titles = {
    dashboard: { title: "Tableau de bord", sub: "Vue d'ensemble & indicateurs temps réel" },
    map: { title: "Cartographie interactive", sub: "Localisation des signalements et équipes en temps réel" },
    reports: { title: "Gestion des signalements", sub: "Suivi et affectation des demandes citoyennes" },
    tours: { title: "Tournées de nettoyage", sub: "Planification et suivi des équipes terrain" },
    optim: { title: "Optimisation IA", sub: "Recommandations intelligentes et gains opérationnels" },
    collab: { title: "Collaboration citoyenne", sub: "Échanges et participation active" },
    settings: { title: "Paramètres", sub: "Préférences utilisateur et configuration du système" }
};

function setActivePage(pageId) {
    Object.keys(sections).forEach(id => {
        sections[id].classList.remove('active-section');
    });
    sections[pageId].classList.add('active-section');
    
    navItems.forEach(item => {
        if(item.getAttribute('data-page') === pageId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    pageTitle.innerText = titles[pageId].title;
    pageSubTitle.innerHTML = `<i class="fas fa-sync-alt fa-fw"></i> ${titles[pageId].sub}`;
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        const page = item.getAttribute('data-page');
        setActivePage(page);
    });
});

// Gestion du modal de signalement
const modal = document.getElementById('reportModal');
const openBtn = document.getElementById('openReportModalBtn');
const openFromReports = document.getElementById('openReportFromReportsBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const submitBtn = document.getElementById('submitReportBtn');

function openModal() { modal.style.display = 'flex'; }
function closeModal() { modal.style.display = 'none'; }

openBtn.addEventListener('click', openModal);
if(openFromReports) openFromReports.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

submitBtn.addEventListener('click', () => {
    const type = document.getElementById('reportType').value;
    const loc = document.getElementById('reportLocation').value;
    alert(`✅ Signalement ajouté !\nType: ${type}\nLieu: ${loc}\n\nL'IA va optimiser l'affectation.`);
    closeModal();
    
    // Mise à jour dynamique si on est sur la page Signalements
    const activePage = document.querySelector('.page-section.active-section').id;
    if(activePage === 'reports-page') {
        const tableBody = document.getElementById('reportsTableBody');
        const newId = "#" + (Math.floor(Math.random() * 2000) + 1025);
        const newRow = `<tr><td>${newId}</td><td>${loc.substring(0, 20)}</td><td>${type}</td><td><span class="status-badge status-progress">Nouveau</span></td><td>—</td><td><i class="fas fa-eye"></i></td></tr>`;
        tableBody.insertAdjacentHTML('afterbegin', newRow);
    }
    
    // Incrémenter le compteur de signalements actifs sur le tableau de bord
    const statActive = document.getElementById('statActiveReports');
    if(statActive) {
        let val = parseInt(statActive.innerText);
        if(!isNaN(val)) statActive.innerText = val + 1;
    }
});

const saveSettingsBtn = document.getElementById('saveSettingsBtn');
if(saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
        alert("✅ Paramètres enregistrés avec succès !");
        // Ici vous pourriez ajouter une vraie logique de sauvegarde
    });
}