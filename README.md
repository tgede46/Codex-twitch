# CrowdRaid

MVP web responsive pour jouer avec le chat d’un streamer. Le jeu s’affiche dans le navigateur ; OBS affiche l’overlay avec une source navigateur.

## Lancer en local

```bash
npm install
npm run dev
```

Vite sert l’interface sur `http://localhost:5173`. Socket.IO démarre le serveur de jeu sur le port `3001`.

Pour tester avec un téléphone sur le même Wi-Fi, ouvre `http://<IP-DE-L-ORDINATEUR>:5173` depuis le téléphone. Si le pare-feu bloque l’accès, autorise les ports `5173` et `3001` sur le réseau local.

## Connexion Twitch réelle

La connexion Twitch utilise OAuth 2.0 Authorization Code côté serveur. Le secret Twitch
ne doit jamais être placé dans le frontend ou dans une variable `VITE_`.

1. Crée une application dans la [Twitch Developer Console](https://dev.twitch.tv/console/apps).
2. Ajoute cette URL de redirection :
   `http://localhost:3001/api/twitch/callback`
3. Copie `.env.example` vers `.env`.
4. Renseigne `TWITCH_CLIENT_ID` et `TWITCH_CLIENT_SECRET`.
5. Lance `npm run dev`, puis utilise **Se connecter avec Twitch**.

En développement, Vite relaie automatiquement les routes `/api` vers le serveur
CrowdRaid. Si OAuth n’est pas configuré, les comptes de démonstration restent disponibles.

## Commande Twitch `!attaque`

Le serveur peut recevoir la commande `!attaque` via Twitch EventSub. Pour l’activer
en production, configure une URL HTTPS publique qui pointe vers :
`https://ton-domaine.com/api/twitch/eventsub`

Ajoute ensuite ces variables :

```env
TWITCH_EVENTSUB_CALLBACK_URL=https://ton-domaine.com/api/twitch/eventsub
TWITCH_EVENTSUB_SECRET=une_valeur_aleatoire_d_au_moins_32_caracteres
```

Après la connexion du streamer, CrowdRaid crée automatiquement l’abonnement
EventSub. La commande fonctionne pour le jeu Boss Raid et respecte le délai de
800 ms par viewer.

## Démo

1. Ouvre l’accueil et clique sur **Créer une partie**.
2. Dans le lobby, affiche le QR code ou copie le lien viewer.
3. Choisis l’un des cinq jeux (Pixel Jump Royale, Co-Op Boss Raid, Speed Quiz Show, Marble Fall 2D, Arena Royale 2D), sa durée (3 à 10 minutes) et si tu participes ou animes seulement.
4. Clique sur **Lancer la partie** quand tes viewers sont prêts. Le chrono se termine automatiquement.
5. Ajoute `/overlay/<CODE>` comme source navigateur dans OBS.
6. Les viewers jouent depuis leur téléphone avec les commandes du jeu sélectionné ; les scores et le classement évoluent en direct.

Les cinq arènes sont rendues en 2D avec Phaser. Marble Fall et Arena Royale sont des versions 2D simplifiées pour le MVP, sans moteur 3D.

Les sessions et scores sont gardés en mémoire serveur. Un redémarrage les efface.
