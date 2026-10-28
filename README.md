# CrowdRaid

MVP web responsive pour jouer avec le chat d’un streamer. Le jeu s’affiche dans le navigateur ; OBS affiche l’overlay avec une source navigateur.

## Lancer en local

```bash
npm install
npm run dev
```

Vite sert l’interface sur `http://localhost:5173`. Socket.IO démarre le serveur de jeu sur le port `3001`.

Pour tester avec un téléphone sur le même Wi-Fi, ouvre `http://<IP-DE-L-ORDINATEUR>:5173` depuis le téléphone. Si le pare-feu bloque l’accès, autorise les ports `5173` et `3001` sur le réseau local.

## Démo

1. Ouvre l’accueil et clique sur **Lancer une partie**.
2. Partage le lien `/play/<CODE>` ou scanne le QR code dans l’overlay.
3. Clique sur **Lancer la partie** dans le tableau streamer.
4. Ajoute `/overlay/<CODE>` comme source navigateur dans OBS.
5. Attaque depuis le téléphone ; les PV du boss et le classement évoluent en direct.

Les sessions et scores sont gardés en mémoire serveur. Un redémarrage les efface.
