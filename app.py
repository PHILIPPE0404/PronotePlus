"""
Pronote+ — projet final

Sert le frontend (une seule page, templates/index.html) et l'API JSON
avec de vraies données Pronote (via pronotepy + ent_ecollege78).

Installation :
    pip install flask pronotepy

Usage :
    python app.py

Puis ouvre http://localhost:5000
"""

import datetime
import json
import os
import smtplib
import uuid
from email.message import EmailMessage
from pathlib import Path

from flask import Flask, render_template, request, jsonify, session, send_from_directory
from werkzeug.utils import secure_filename

import pronotepy
from pronotepy.ent import ent_ecollege78

# ============================================
# CONFIGURATION DE TON ETABLISSEMENT
# ============================================
PRONOTE_URL = "https://0780119f.index-education.net/pronote/eleve.html"
ENT_FUNCTION = ent_ecollege78
# ============================================

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-only-change-this")

SAVE_DIR = "save"
DRIVE_ROOT = Path(SAVE_DIR) / "drive"
SENT_ROOT = Path(SAVE_DIR) / "sent"
MAX_UPLOAD_MB = int(os.getenv("PRONOTE_MAX_UPLOAD_MB", "25"))

# SMTP : rien n'est stocké en dur. Configure ces variables dans Windows/macOS/Linux.
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "1") not in {"0", "false", "False"}

clients = {}  # sessions Pronote en mémoire, indexées par identifiant


# ---------- Aides ----------

def get_client():
    username = session.get("user_id")
    client = clients.get(username) if username else None
    if client is None or not client.logged_in:
        return None
    return client


def safe(func, default):
    """Exécute func(), renvoie default en cas d'erreur — la structure des
    données Pronote varie selon la période de l'année et l'établissement."""
    try:
        return func(), None
    except Exception as e:
        return default, str(e)


def d(valeur):
    if isinstance(valeur, (datetime.date, datetime.datetime)):
        return valeur.isoformat()
    return valeur


def lesson_extra(l):
    """Extrait contenu texte + fichiers joints d'un cours, sans jamais lever."""
    contenu, fichiers = "", []
    try:
        content = l.content
        if content:
            contenu = getattr(content, "description", "") or ""
            for fichier in getattr(content, "files", []) or []:
                fichiers.append({
                    "name": getattr(fichier, "name", "Fichier"),
                    "url": getattr(fichier, "url", "#"),
                })
    except Exception:
        pass
    return contenu, fichiers



def user_storage_key(username):
    """Nom de dossier local stable et sûr pour une session utilisateur."""
    return secure_filename(username or "utilisateur") or "utilisateur"


def drive_dir(username):
    path = DRIVE_ROOT / user_storage_key(username)
    path.mkdir(parents=True, exist_ok=True)
    return path


def sent_file(username):
    SENT_ROOT.mkdir(parents=True, exist_ok=True)
    return SENT_ROOT / f"{user_storage_key(username)}.json"


def load_sent_messages(username):
    path = sent_file(username)
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []


def save_sent_message(username, message):
    messages = load_sent_messages(username)
    messages.insert(0, message)
    messages = messages[:100]
    sent_file(username).write_text(
        json.dumps(messages, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def list_drive_files(username):
    items = []
    folder = drive_dir(username)
    for path in sorted(folder.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if path.is_file():
            size = path.stat().st_size
            if size < 1024:
                size_label = f"{size} o"
            elif size < 1024 * 1024:
                size_label = f"{size / 1024:.1f} Ko"
            else:
                size_label = f"{size / (1024 * 1024):.1f} Mo"
            items.append({
                "id": path.name,
                "name": path.name,
                "size": size_label,
                "url": f"/api/drive/file/{path.name}",
            })
    return items


def send_smtp_message(to, subject, body):
    """Envoie un vrai message SMTP. Les identifiants viennent de l'environnement."""
    if not SMTP_USER or not SMTP_PASSWORD or not SMTP_FROM:
        raise RuntimeError(
            "SMTP non configuré : définis SMTP_USER, SMTP_PASSWORD et SMTP_FROM."
        )

    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)


def save_snapshot(username, client):
    """Dépose un JSON de ce qui a été récupéré à la connexion, dans save/."""
    try:
        os.makedirs(SAVE_DIR, exist_ok=True)
        snapshot = {
            "horodatage": datetime.datetime.now().isoformat(),
            "identifiant": username,
        }
        snapshot["profil"], _ = safe(lambda: {
            "nom": client.info.name,
            "classe": client.info.class_name,
            "etablissement": client.info.establishment,
        }, {})
        with open(os.path.join(SAVE_DIR, f"{username}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"), "w", encoding="utf-8") as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[save] Echec de la sauvegarde pour {username} : {e}")


# ---------- Pages ----------

@app.route("/")
def index():
    return render_template("index.html")


# ---------- Auth ----------

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"success": False, "error": "Identifiant et mot de passe requis"}), 400

    try:
        client = pronotepy.Client(
            PRONOTE_URL,
            username=username,
            password=password,
            ent=ENT_FUNCTION,
        )
    except Exception as e:
        # PythonAnywhere gratuit utilise un proxy sortant avec une liste
        # de domaines autorises. L'ENT eCollege78 peut donc renvoyer un
        # ProxyError/403 avant meme que Pronote reçoive la connexion.
        details = str(e)
        lowered = details.lower()
        ent_proxy_error = (
            "ent.ecollege78.fr" in lowered
            and ("proxyerror" in lowered or "403 forbidden" in lowered or "tunnel connection failed" in lowered)
        )

        if ent_proxy_error:
            return jsonify({
                "success": False,
                "error_code": "ENT_UNAVAILABLE",
                "error": "La connexion Pronote n'est pas disponible depuis cet hébergement.",
                "details": "L'hébergement bloque actuellement l'accès à l'ENT eCollege78. Ce n'est pas un problème d'identifiant ou de mot de passe.",
            }), 502

        app.logger.exception("Erreur pendant la connexion Pronote")
        return jsonify({
            "success": False,
            "error_code": "LOGIN_ERROR",
            "error": "Impossible de se connecter à Pronote pour le moment.",
        }), 502

    if not client.logged_in:
        return jsonify({"success": False, "error": "Identifiants invalides."}), 401

    session["user_id"] = username
    clients[username] = client
    save_snapshot(username, client)

    return jsonify({"success": True})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    username = session.get("user_id")
    clients.pop(username, None)
    session.clear()
    return jsonify({"success": True})


@app.route("/api/me")
def api_me():
    client = get_client()
    return jsonify({"logged_in": client is not None})


# ---------- Données agrégées ----------

@app.route("/api/data")
def api_data():
    client = get_client()
    if not client:
        return jsonify({"error": "Non autorisé"}), 401

    # --- Profil ---
    profil, _ = safe(lambda: {
        "name": client.info.name,
        "class": client.info.class_name,
        "school": (client.info.establishment or "").strip(),
    }, {"name": "", "class": "", "school": ""})

    # --- Emploi du temps (1 semaine avant -> 3 semaines après, pour la navigation) ---
    def fetch_courses():
        today = datetime.date.today()
        debut = today - datetime.timedelta(days=7)
        fin = today + datetime.timedelta(days=21)
        lessons = client.lessons(debut, fin)
        result = []
        for l in lessons:
            contenu, fichiers = lesson_extra(l)
            result.append({
                "id": f"{l.start.isoformat()}_{l.subject.name if l.subject else ''}",
                "subject": l.subject.name if l.subject else "Cours",
                "teacher": getattr(l, "teacher_name", "") or "",
                "room": l.classroom,
                "debut": d(l.start),
                "fin": d(l.end),
                "annule": l.canceled,
                "desc": contenu,
                "files": fichiers,
            })
        return result

    courses, _ = safe(fetch_courses, [])

    # --- Devoirs ---
    def fetch_homework():
        today = datetime.date.today()
        hw = client.homework(today)
        return [{
            "id": f"{d(h.date)}_{h.subject.name if h.subject else ''}",
            "subject": h.subject.name if h.subject else "Matière",
            "description": h.description,
            "date": d(h.date),
            "done": h.done,
        } for h in hw]

    homework, _ = safe(fetch_homework, [])

    # --- Notes (liste plate ; regroupées par matière côté frontend) ---
    def fetch_grades():
        period = client.current_period
        return [{
            "matiere": g.subject.name if g.subject else "Matière",
            "note": str(g.grade),
            "sur": str(g.out_of),
            "coefficient": str(getattr(g, "coefficient", 1) or 1),
            "date": d(getattr(g, "date", None)),
        } for g in period.grades]

    notes, _ = safe(fetch_grades, [])

    # --- Messagerie (best-effort : l'API de messagerie de pronotepy est
    # moins stable que le reste, donc on ne casse jamais la page si elle échoue) ---
    def fetch_discussions():
        discussions = client.discussions()
        result = []
        for disc in discussions:
            messages = list(getattr(disc, "messages", []) or [])
            dernier = messages[-1] if messages else None
            result.append({
                "id": getattr(disc, "id", None) or len(result) + 1,
                "sender": getattr(dernier, "author", None) or "Pronote",
                "subject": getattr(disc, "subject", "Message"),
                "body": getattr(dernier, "content", "") if dernier else "",
                "time": d(getattr(dernier, "date", None)) if dernier else "",
                "unread": not getattr(disc, "read", True),
            })
        return result

    emails, _ = safe(fetch_discussions, [])
    emails.extend(load_sent_messages(session.get("user_id")))
    emails.sort(key=lambda item: item.get("time", ""), reverse=True)

    # --- Documents administratifs ---
    def fetch_documents():
        if not hasattr(client, "export_documents"):
            return []
        return [{
            "name": getattr(doc, "name", "Document"),
            "size": "",
        } for doc in client.export_documents()]

    documents, _ = safe(fetch_documents, [])

    return jsonify({
        "user": profil,
        "courses": courses,
        "homework": homework,
        "notes": notes,
        "emails": emails,
        "documents": documents,
        "drive": list_drive_files(session.get("user_id")),
    })


# ---------- Drive personnel ----------

@app.route("/api/drive", methods=["GET"])
def api_drive():
    username = session.get("user_id")
    if not username or get_client() is None:
        return jsonify({"error": "Non autorisé"}), 401
    return jsonify({"files": list_drive_files(username)})


@app.route("/api/drive/upload", methods=["POST"])
def api_drive_upload():
    username = session.get("user_id")
    if not username or get_client() is None:
        return jsonify({"error": "Non autorisé"}), 401

    uploaded = request.files.get("file")
    if uploaded is None or not uploaded.filename:
        return jsonify({"success": False, "error": "Aucun fichier sélectionné."}), 400

    filename = secure_filename(uploaded.filename)
    if not filename:
        return jsonify({"success": False, "error": "Nom de fichier invalide."}), 400

    uploaded.stream.seek(0, os.SEEK_END)
    size = uploaded.stream.tell()
    uploaded.stream.seek(0)
    if size > MAX_UPLOAD_MB * 1024 * 1024:
        return jsonify({
            "success": False,
            "error": f"Fichier trop volumineux. Limite : {MAX_UPLOAD_MB} Mo."
        }), 413

    # Remplace un fichier du même nom dans l'espace personnel.
    destination = drive_dir(username) / filename
    uploaded.save(destination)
    return jsonify({"success": True, "file": next(
        (f for f in list_drive_files(username) if f["name"] == filename), None
    )})


@app.route("/api/drive/file/<path:filename>", methods=["GET"])
def api_drive_file(filename):
    username = session.get("user_id")
    if not username or get_client() is None:
        return jsonify({"error": "Non autorisé"}), 401
    safe_name = secure_filename(filename)
    if safe_name != filename:
        return jsonify({"error": "Nom de fichier invalide"}), 400
    return send_from_directory(drive_dir(username), safe_name, as_attachment=False)


@app.route("/api/drive/file/<path:filename>", methods=["DELETE"])
def api_drive_delete(filename):
    username = session.get("user_id")
    if not username or get_client() is None:
        return jsonify({"error": "Non autorisé"}), 401
    safe_name = secure_filename(filename)
    if safe_name != filename:
        return jsonify({"error": "Nom de fichier invalide"}), 400
    target = drive_dir(username) / safe_name
    if not target.exists():
        return jsonify({"success": False, "error": "Fichier introuvable."}), 404
    target.unlink()
    return jsonify({"success": True})


# ---------- Messagerie SMTP sortante ----------

@app.route("/api/email/send", methods=["POST"])
def api_email_send():
    username = session.get("user_id")
    if not username or get_client() is None:
        return jsonify({"success": False, "error": "Non autorisé"}), 401

    data = request.get_json() or {}
    to = str(data.get("to", "")).strip()
    subject = str(data.get("subject", "")).strip()
    body = str(data.get("body", "")).strip()

    if not to or "@" not in to:
        return jsonify({"success": False, "error": "Entre une adresse e-mail valide."}), 400
    if not subject:
        return jsonify({"success": False, "error": "L'objet est obligatoire."}), 400
    if not body:
        return jsonify({"success": False, "error": "Le message est vide."}), 400

    try:
        send_smtp_message(to, subject, body)
    except Exception as exc:
        print(f"[smtp] Echec d'envoi vers {to} : {exc}")
        return jsonify({"success": False, "error": str(exc)}), 502

    sent = {
        "id": f"sent-{uuid.uuid4().hex}",
        "sender": f"Moi → {to}",
        "subject": subject,
        "body": body,
        "time": datetime.datetime.now().isoformat(),
        "unread": False,
        "sent": True,
    }
    save_sent_message(username, sent)
    return jsonify({"success": True, "message": sent})


# ---------- Devoirs : coche/décoche ----------

@app.route("/api/homework/toggle", methods=["POST"])
def api_homework_toggle():
    client = get_client()
    if not client:
        return jsonify({"error": "Non autorisé"}), 401

    data = request.get_json() or {}
    hw_id = data.get("id")
    done = data.get("done")

    def fetch():
        today = datetime.date.today()
        for h in client.homework(today):
            current_id = f"{d(h.date)}_{h.subject.name if h.subject else ''}"
            if current_id == hw_id:
                h.set_done(done)
                return True
        return False

    result, erreur = safe(fetch, False)
    return jsonify({"success": result, "erreur": erreur})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
