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

## 2. Installer le projet

```bash
git clone git@github.com:UnPtitBelge/train-scanner.git
cd train-scanner
npm run setup            # npm install + uv sync (dépendances front + back)
cp .env.example .env && chmod 600 .env
```

Remplis `.env` avec les clés **Stripe en mode test** (Dashboard → Developers → API keys) ; les autres clés
sont envoyées **par message privé** (jamais dans le repo, une issue ou Slack public) :

```
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # affiché par `stripe listen` (voir ci-dessous)
AIKIDO_API_KEY=...                # pour le release gate
```

Webhooks en local : `stripe listen --forward-to localhost:8100/api/stripe/webhook`.

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
| Webhook Stripe 400 « signature » | `STRIPE_WEBHOOK_SECRET` doit être celui affiché par le `stripe listen` en cours |

## 6. Demain — sac à dos

Carte d'identité · laptop + chargeur · multiprise · casque/écouteurs · adaptateur HDMI/USB-C.
**Portes à 10:00**, BeCentral, Cantersteen 12 (en face de la Galerie Ravenstein).
Kickoff 10:30 au 1er étage (Central Hall), on code au 2e (The Factory).
