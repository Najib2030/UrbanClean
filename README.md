# 🌿 UrbanClean – Gestion collaborative de la propreté urbaine

Plateforme web (PWA) permettant aux citoyens de signaler des problèmes de propreté, aux agents de les traiter, et aux gestionnaires d’optimiser les tournées – le tout en temps réel.

## ✨ Fonctionnalités

### Citoyen
- Inscription / connexion sécurisée
- Signalement d’un problème (type, description, photo compressée, géolocalisation)
- Suivi des signalements (statut, agent assigné)
- Commentaires et suggestions sur la plateforme collaborative
- Notation de la résolution (étoiles + commentaire)
- Notifications personnalisables (commentaires, changement de statut, affectation)
- Multilingue (français, anglais, arabe) et thème clair/sombre

### Agent de terrain
- Consultation des signalements assignés
- Mise à jour du statut (En attente → En cours → Résolu)
- Visualisation des tournées optimisées (ordre des interventions)
- Notifications en temps réel

### Gestionnaire (Administrateur)
- Affectation manuelle des signalements aux agents
- Gestion des emplois du temps (calendrier, zones, postes matin/après-midi/journée complète)
- Tableau de bord avancé (statistiques, graphiques d’évolution, satisfaction citoyenne)
- Optimisation IA des tournées (itinéraire le plus court, économies de carburant/temps)
- Modération (blocage manuel, consultation des feedbacks)
- Configuration des notifications globales

### Modération & sécurité
- Filtrage automatique des commentaires (mots vulgaires, URLs interdits)
- Système de blocage progressif (2 min → 30 min → 24 h → 7 j → 30 j) après infractions
- Réinitialisation automatique du compteur d’infractions après 48 h sans problème

## 🛠 Stack technique (réelle)

| Composant        | Technologie                                      |
|------------------|--------------------------------------------------|
| **Frontend**     | React.js (Vite) + JavaScript                    |
| **Backend**      | Firebase (Authentication, Firestore)            |
| **Base de données** | Firestore (NoSQL)                             |
| **Cartographie** | Leaflet / OpenStreetMap                         |
| **Notifications**| API native du navigateur + toasts (react-hot-toast) |
| **Hébergement**  | Firebase Hosting (ou Vercel/Netlify)            |
| **Multilingue**  | i18next (FR, EN, AR) + direction RTL            |
| **Contact**      | EmailJS + reCAPTCHA                             |
| **PWA**          | Service Worker, installable sur mobile          |

## 📸 Captures d’écran (aperçu)

> À ajouter selon vos besoins.

## 🚀 Installation et déploiement

### Prérequis
- Node.js (18+)
- Compte Firebase (activer Auth, Firestore, Hosting)
- Clé API reCAPTCHA (optionnel pour contact)

### Étapes
```bash
git clone https://github.com/Najib2030/UrbanClean.git
cd UrbanClean
npm install
npm run dev
