# TP 6 — Stack de monitoring (Prometheus + Loki + Grafana)

## Architecture

```
Application (Node.js)
  ├── /metrics  ──────────────────►  Prometheus  ──┐
  │                                                 │
  └── stdout (JSON)  ──► Promtail  ──► Loki  ───────┤
                                                    │
                                                    ▼
                                               Grafana :3000
```

## Démarrage

```bash
# Depuis src/app/
docker compose -f docker-compose.yml \
               -f docker-compose.monitoring.yml up -d
```

| Service    | URL                      | Credentials  |
|------------|--------------------------|--------------|
| Grafana    | http://localhost:3000    | admin / admin |
| Prometheus | http://localhost:9090    | —            |
| Loki       | http://localhost:3100    | —            |


```bash
# Générer du trafic
watch curl -X GET http://localhost:3001/api/items
```

---

## Ajouter Loki comme data source dans Grafana

La data source Loki n'est **pas provisionnée automatiquement** : elle doit être ajoutée manuellement la première fois (ou via le provisioning — voir section suivante).

### Étapes manuelles (UI)

1. Ouvrir **http://localhost:3000** et se connecter (`admin` / `admin`).

2. Dans le menu latéral gauche, aller dans **Connections → Data sources** (ou `⚙ Configuration → Data sources` selon la version).

3. Cliquer sur **Add data source**.

4. Rechercher et sélectionner **Loki**.

5. Dans le champ **URL**, saisir :
   ```
   http://loki:3100
   ```
   > On utilise le nom du service Docker (`loki`) et non `localhost` car Grafana s'exécute dans le même réseau Docker Compose.

6. Laisser les autres champs par défaut (pas d'authentification requise en local).

7. Cliquer sur **Save & test** → le message « Data source connected and labels found » confirme que Loki est joignable.

---

## Explorer les logs dans Grafana (LogQL)

1. Dans Grafana, ouvrir **Explore** (icône boussole dans le menu).
2. Sélectionner la data source **Loki**.
3. Exemples de requêtes LogQL :

| Objectif | Requête LogQL |
|---|---|
| Tous les logs de l'API | `{service="api"}` |
| Logs d'erreur uniquement | `{service="api"} \| json \| level="error"` |
| Requêtes HTTP lentes (> 200 ms) | `{service="api"} \| json \| duration_ms > 200` |
| Taux d'erreurs 5xx (1 min) | `rate({service="api"} \| json \| status >= 500 [1m])` |

---

## Provisionner Loki automatiquement (recommandé)

Pour éviter de reconfigurer la data source à chaque `docker compose down -v`, on peut la déclarer en YAML dans le répertoire de provisioning de Grafana.

### 1. Créer le fichier de provisioning

Créer le fichier `monitoring/grafana/provisioning/datasources/loki.yml` :

```yaml
# monitoring/grafana/provisioning/datasources/loki.yml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    version: 1
    editable: false
```

> Pour ajouter Prometheus en même temps, créer un fichier `prometheus.yml` dans le même répertoire :
> ```yaml
> apiVersion: 1
> datasources:
>   - name: Prometheus
>     type: prometheus
>     access: proxy
>     url: http://prometheus:9090
>     isDefault: true
>     version: 1
>     editable: false
> ```

### 2. Monter le répertoire dans docker-compose.monitoring.yml

Le service `grafana` doit monter le répertoire `provisioning` :

```yaml
grafana:
  volumes:
    - grafana_data:/var/lib/grafana
    - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
```

> Ce montage est déjà présent dans le `docker-compose.monitoring.yml` fourni.

### 3. Appliquer les changements

```bash
docker compose -f docker-compose.yml \
               -f docker-compose.monitoring.yml restart grafana
```

Grafana charge le fichier au démarrage : la data source Loki apparaît automatiquement dans **Connections → Data sources**.

---

## Vérification rapide

```bash
# Générer du trafic
curl -X GET http://localhost:3001/api/items

# Vérifier que Promtail pousse bien vers Loki
curl -s http://localhost:3100/loki/api/v1/labels | jq .

# Vérifier que Prometheus scrape l'API
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[].health'
```
