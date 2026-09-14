# Pronote+

Pronote+ est une interface web scolaire personnelle développée avec **Python, Flask, JavaScript et CSS**.

Le projet a pour objectif de regrouper dans une seule interface les principales informations scolaires : emploi du temps, travail à faire, notes, documents/Drive, messagerie et profil.

## ✨ Fonctionnalités

- 🔐 **Connexion Pronote**
  - Connexion via `pronotepy` et l'ENT eCollege78.
  - Gestion de session côté serveur.
  - Affichage d'erreurs de connexion plus lisibles.
  - Écran de chargement pendant la récupération des données.

- 🏠 **Tableau de bord**
  - Prochain cours.
  - Emploi du temps du jour.
  - Devoirs à faire.
  - Notes récentes.
  - Messagerie.
  - Widget Post-it personnalisable.

- 🗓️ **Emploi du temps**
  - Affichage des cours.
  - Salle, professeur, horaires et contenu lorsqu'ils sont disponibles.
  - Documents joints aux cours.

- ✅ **Devoirs**
  - Classement par date.
  - Coche des devoirs terminés.
  - Indication visuelle des tâches terminées.

- 📊 **Notes**
  - Notes regroupées par matière.
  - Moyenne générale.
  - Simulateur de moyenne.

- 📁 **Drive**
  - Espace personnel.
  - Upload de fichiers.
  - Téléchargement.
  - Suppression de fichiers.
  - Limite de taille configurable.

- ✉️ **Messagerie**
  - Affichage des discussions récupérées depuis Pronote.
  - Envoi SMTP configurable.
  - Historique des messages envoyés côté application.

- 👤 **Profil**
  - Nom, classe et établissement.
  - Documents administratifs lorsqu'ils sont disponibles.

## 🧰 Technologies

- Python 3
- Flask
- pronotepy
- ent_ecollege78
- JavaScript
- HTML5
- CSS3
- Gunicorn pour le déploiement
- SVG / Lucide pour les icônes et éléments d'interface

## 📦 Installation locale

### 1. Cloner le dépôt

```bash
git clone https://github.com/PHILIPPE0404/PronotePlus.git
cd PronotePlus
```

### 2. Créer un environnement virtuel

Windows :

```powershell
py -3.13 -m venv .venv
.venv\Scripts\activate
```

Linux / macOS :

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Installer les dépendances

```bash
pip install -r requirements.txt
```

### 4. Configurer les variables d'environnement

Copier `.env.example` vers un fichier `.env` si tu utilises un outil de chargement d'environnement, ou définir les variables directement dans ton système.

Variables utilisées par Pronote+ :

```text
FLASK_SECRET_KEY=une-cle-secrete
PRONOTE_MAX_UPLOAD_MB=25

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=ton-adresse@example.com
SMTP_PASSWORD=mot-de-passe-ou-mot-de-passe-application
SMTP_FROM=ton-adresse@example.com
SMTP_USE_SSL=1
```

**Ne publie jamais un mot de passe SMTP, une clé secrète ou des identifiants Pronote dans GitHub.**

### 5. Lancer l'application

```bash
python app.py
```

Puis ouvrir :

```text
http://127.0.0.1:5000
```

## 🚀 Déploiement sur Render

Le projet est préparé pour un déploiement Flask avec Gunicorn.

Commandes classiques :

```bash
pip install -r requirements.txt
```

puis :

```bash
gunicorn app:app
```

Le projet contient également un `render.yaml` pour faciliter la configuration.

### Déploiement automatique avec GitHub

Si le service Render est connecté au dépôt GitHub et que **Auto-Deploy** est activé :

```text
Modification du code
        ↓
GitHub → Commit
        ↓
Render détecte le commit
        ↓
Build
        ↓
Déploiement
```

## 🔒 Sécurité

- Ne jamais mettre de secrets dans le dépôt public.
- Utiliser des variables d'environnement pour Flask et SMTP.
- Utiliser des identifiants de test pour le développement lorsque possible.
- Vérifier régulièrement les dépendances Python.
- Ne pas partager les fichiers contenant des informations personnelles ou des données de connexion.

## ⚠️ Stockage et hébergement

Le Drive personnel et l'historique local des messages sont stockés dans le dossier `save/`.

Sur certains hébergements gratuits, le système de fichiers peut être temporaire ou être réinitialisé lors d'un redéploiement. Pour un usage durable, il faut prévoir un stockage persistant ou une base de données adaptée.

## 🧪 Dépannage

### Erreur pendant la connexion Pronote

Vérifier :

1. Les identifiants.
2. L'URL Pronote configurée dans `app.py`.
3. Le connecteur `ent_ecollege78`.
4. La version installée de `pronotepy`.
5. Les éventuelles restrictions réseau de l'hébergeur.

### Erreur SMTP

Vérifier :

1. `SMTP_HOST`
2. `SMTP_PORT`
3. `SMTP_USER`
4. `SMTP_PASSWORD`
5. `SMTP_FROM`
6. Les restrictions réseau de l'hébergeur.

## 📂 Structure

```text
PronotePlus/
├── app.py
├── requirements.txt
├── render.yaml
├── Procfile
├── .env.example
├── templates/
│   └── index.html
├── static/
│   ├── app.js
│   └── style.css
└── save/
    ├── drive/
    └── sent/
```

## 👨‍💻 Crédits

**Philippe ALOPO** — conception, développement et direction du projet.

**OpenAI / ChatGPT** — assistance à la conception, au développement, au débogage et à l'amélioration de l'interface.

## 📄 Licence

Ce projet est avant tout un projet personnel et scolaire.

Aucune licence open source spécifique n'est indiquée ici pour le moment. Ajoute une licence explicite dans le dépôt si tu souhaites définir précisément les conditions de réutilisation du code.

## 📬 Contact

Pour les questions ou retours concernant le projet :

**philippe.alopo@gmail.com**
