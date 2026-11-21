# Setup laptop — à faire ce soir (≈ 15 min)

Objectif : arriver demain à BeCentral avec tout qui tourne, **sans rien installer sur place**.

## 1. Prérequis

| Outil | Version | Vérifier | Installer |
| --- | --- | --- | --- |
| Git + clé SSH GitHub | — | `ssh -T git@github.com` | [docs GitHub](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) |
| Node.js | ≥ 20.19 | `node -v` | [nodejs.org](https://nodejs.org) ou `mise`/`nvm` |
| uv (Python) | récent | `uv --version` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Stripe CLI | récent | `stripe --version` | [docs.stripe.com/stripe-cli](https://docs.stripe.com/stripe-cli) puis `stripe login` |
| Docker | — | `docker run --rm hello-world` | seulement pour le scan Aikido |
| GitHub CLI (optionnel) | — | `gh auth status` | [cli.github.com](https://cli.github.com) |

Python 3.11 n'est **pas** à installer : uv le télécharge tout seul.

## Démarrage rapide (une commande)

```bash
npm start                 # installe ce qui manque, demande les clés Stripe test une fois, lance API + front (+ webhooks)
npm start -- --share      # idem + URL publique https (Cloudflare Quick Tunnel, sans compte), pour un téléphone ou le jury
npm start -- --reset      # remet à zéro les points ECO (démo propre)
npm start -- --offline    # sans WiFi : trajets rejoués depuis le cache commité, paiement en mode démo
npm run warm:cache        # (en ligne) rafraîchit ce cache, puis commiter apps/api/trainscanner/data/cache
npm start -- --prod       # construit et lance l'image Docker de production sur http://localhost:8100
```

Déroulé de la démo et parades : [`DEMO.md`](DEMO.md). Le reste de ce document détaille les étapes à la main.

## Déployer (Render, plan gratuit)

1. Se connecter sur render.com avec GitHub, puis ouvrir
   `https://render.com/deploy?repo=https://github.com/The-trappists/train-scanner`. Render lit `render.yaml`.
2. Renseigner `STRIPE_SECRET_KEY` (sk_test_…) et `VITE_STRIPE_PUBLISHABLE_KEY` (pk_test_…), puis Apply.
   L'URL ressemble à `https://trainscanner-xxxx.onrender.com`.
3. Optionnel, pour les webhooks : Stripe Dashboard (mode test) → Developers → Webhooks → endpoint
   `https://<app>/api/stripe/webhook`, avec les événements `checkout.session.completed`,
   `checkout.session.async_payment_succeeded` et `checkout.session.expired`. Copier le `whsec_…` dans
   `STRIPE_WEBHOOK_SECRET`. Sans webhook, les paiements sont quand même confirmés : l'app interroge Stripe au retour.

Limites du plan gratuit : le service s'endort après 15 min sans trafic (≈ 1 min de réveil, **ouvrir l'URL juste
avant le pitch**). Le disque est éphémère, donc les points ECO repartent de zéro à chaque redéploiement.

## 2. Installer le projet

```bash
git clone git@github.com:The-trappists/train-scanner.git
cd train-scanner
npm run setup            # npm install + uv sync (dépendances front + back)
cp .env.example .env && chmod 600 .env
```

Remplis `.env` avec les clés **Stripe en mode test** (Dashboard → Developers → API keys) ; les autres clés
sont envoyées **par message privé** (jamais dans le repo, une issue ou Slack public) :

```
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # optionnel : `npm run dev:api` l'injecte tout seul (voir ci-dessous)
AIKIDO_API_KEY=...                # pour le release gate
```

Webhooks en local : rien à faire. Si la Stripe CLI est installée et connectée (`stripe login`), `npm run dev:api`
lance aussi `stripe listen` (lignes préfixées `[stripe]`) et passe le secret à l'API. Pour le désactiver :
`STRIPE_LISTEN=0 npm run dev:api`. Pour le lancer seul : `npm run dev:stripe`.

## 3. Vérifier que tout marche

```bash
npm run check            # lint + format + tests + build — à relancer avant chaque push
```

Puis dans **deux terminaux** :

```bash
npm run dev:api          # API sur http://localhost:8100  (doc interactive : /docs)
npm run dev              # front sur http://localhost:5173
```

Ouvre http://localhost:5173 et vérifie :

- [ ] « API: ok » s'affiche (pas de bandeau rouge)
- [ ] « Stripe (server) » et « Stripe (browser) » sont **configured**

Release gate : `docker pull aikidosecurity/local-scanner` (1,1 Go, à faire ce soir) puis
`scripts/aikido_release_gate.sh` → **RELEASE GATE PASS**.

## 4. Règles de la journée

- Une branche par issue → PR vers `main` → CI verte → merge. Petites PR, souvent.
- Écris `Closes #N` dans la PR pour fermer l'issue automatiquement.
- **Stripe en mode test uniquement.** La clé secrète ne quitte jamais le backend.
- Les prix viennent **uniquement de l'API** — le front ne recalcule rien.
- Tu changes les modèles de l'API ? Mets à jour `apps/web/src/api/types.ts` et lance `npm run gen:api` dans la même PR.
- Besoin d'aide ? Mentionne `@claude` dans une issue ou une PR.
- **15:45 : freeze**, plus aucune feature.

## 5. Dépannage

| Problème | Solution |
| --- | --- |
| Port 8100 déjà pris | `API_PORT=8200 npm run dev:api` et `API_PORT=8200 npm run dev` |
| Bandeau rouge « API error » dans le front | l'API ne tourne pas → `npm run dev:api` |
| `uv: command not found` | relance ton terminal après l'install de uv |
| `npm ci` / peer deps qui échouent | Node trop vieux → `node -v` doit être ≥ 20.19 |
| Webhook Stripe 400 « signature » | `STRIPE_WEBHOOK_SECRET` doit être celui affiché par le `stripe listen` en cours (`npm run dev:api` s'en charge) |
| `[stripe] CLI not logged in or offline` | `stripe login`, puis relance `npm run dev:api` |

## 6. Demain — sac à dos

Carte d'identité · laptop + chargeur · multiprise · casque/écouteurs · adaptateur HDMI/USB-C.
**Portes à 10:00**, BeCentral, Cantersteen 12 (en face de la Galerie Ravenstein).
Kickoff 10:30 au 1er étage (Central Hall), on code au 2e (The Factory).
