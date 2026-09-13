# Pronote+ — correction connexion hébergement

Cette version transforme l'erreur brute de connexion ENT/Pronote en message utilisateur clair lorsque l'hébergement bloque l'accès à `ent.ecollege78.fr` via un proxy.

Message affiché :
> La connexion Pronote n'est pas disponible depuis cet hébergement.

Le serveur renvoie un code `ENT_UNAVAILABLE` (HTTP 502) au lieu d'exposer le traceback ou le message technique complet.

## Installation

```bash
python -m pip install -r requirements.txt
python app.py
```


## Render (free)
This project is prepared for Render Web Service deployment.
Build command: `pip install -r requirements.txt`
Start command: `gunicorn --bind 0.0.0.0:$PORT app:app`
Set SMTP variables only if you use email sending. Note: Render Free blocks outbound SMTP ports 25/465/587; HTTPS calls such as the ENT login use normal outbound internet access.

The free filesystem is ephemeral on Render, so files stored only under `save/` can be lost on restart/redeploy. Use persistent external storage/database for data that must survive.
