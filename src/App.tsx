import { useEffect, useState, type FormEvent } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp,
  Copy, ExternalLink, Gamepad2, Heart, Link2, LockKeyhole, MonitorPlay, MoreHorizontal,
  Play, Radio, RotateCw, Shield, Sparkles, Swords, Trophy, Users, Zap,
} from "lucide-react";
import { Arena } from "./Arena";
import type { Ack, SessionState } from "./types";

type ServerAck = Ack<{ code?: string; hostToken?: string; playerId?: string; rank?: number; state?: SessionState; damage?: number }>;
const socket = io(import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:3001` : undefined);

function useSocket() {
  return socket;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link className={`brand ${compact ? "brand-compact" : ""}`} to="/" aria-label="CrowdRaid, accueil"><span className="brand-icon"><Swords size={19} strokeWidth={2.5} /></span><span>Crowd<span>Raid</span></span></Link>;
}

function StatusPill({ state }: { state: SessionState | null }) {
  if (!state) return <span className="status-pill status-waiting"><i /> Connexion…</span>;
  if (state.status === "live") return <span className="status-pill status-live"><i /> En direct</span>;
  if (state.status === "ended") return <span className="status-pill status-ended"><i /> Terminée</span>;
  return <span className="status-pill status-waiting"><i /> En attente</span>;
}

function Landing({ socket }: { socket: Socket }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    const onConnect = () => { setConnected(true); setError(""); };
    const onDisconnect = () => setConnected(false);
    const onError = (reason: Error) => { setConnected(false); setError(`Serveur indisponible : ${reason.message}`); };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onError);
    if (socket.connected) onConnect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onError);
    };
  }, []);

  const createSession = () => {
    if (!socket.connected) {
      setError("Le serveur ne répond pas. Vérifie qu’il est bien démarré.");
      return;
    }
    setBusy(true);
    socket.emit("session:create", (result: ServerAck) => {
      setBusy(false);
      if (!result.ok || !result.code || !result.hostToken) {
        setError(result.ok ? "La session n’a pas pu être créée." : result.error);
        return;
      }
      localStorage.setItem(`crowdraid:host:${result.code}`, result.hostToken);
      navigate(`/host/${result.code}`);
    });
  };

  return <div className="landing-page">
    <nav className="landing-nav page-width"><Brand /><div className="landing-nav-right"><span className="nav-caption"><span className="tiny-spark">✦</span> Le chat entre dans le jeu</span><a href="#how" className="text-link">Comment ça marche <ArrowDownToLine size={15} /></a></div></nav>
    <main>
      <section className="hero page-width">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-icon"><Radio size={13} /></span> MULTIJOUEUR · EN DIRECT · GRATUIT</div>
          <h1>Votre chat.<br /><span>Dans la partie.</span></h1>
          <p className="hero-description">Transformez votre live en arène coopérative. Vos viewers rejoignent depuis leur téléphone et attaquent le boss avec vous.</p>
          <div className="hero-actions"><button className="button button-primary button-large" onClick={createSession} disabled={busy || !connected}>{busy ? <RotateCw size={17} className="spin" /> : <Play size={17} fill="currentColor" />} {busy ? "Création…" : "Lancer une partie"}<ArrowRight size={16} /></button><a className="button button-quiet button-large" href="#how">Découvrir <ArrowDownToLine size={16} /></a></div>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <div className="hero-trust"><span className="avatar-stack"><i>J</i><i>M</i><i>A</i></span><span><strong>{connected ? "Serveur prêt" : "Connexion au serveur…"}</strong><br />Aucun compte viewer requis</span></div>
        </div>
        <div className="hero-art" aria-label="Illustration du boss violet et des viewers en jeu">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-glow" />
          <div className="float-tag float-tag-top"><span className="float-tag-icon"><Users size={15} /></span><span><strong>128 viewers</strong><small>ont rejoint la partie</small></span><span className="live-wave"><i /><i /><i /></span></div>
          <div className="hero-monster"><div className="monster-horn horn-left"/><div className="monster-horn horn-right"/><div className="monster-face"><i /><i /></div><div className="monster-mouth"/><div className="monster-body-shine"/></div>
          <div className="hero-ground" />
          <div className="mini-player player-a"><i /> <span>luma</span></div><div className="mini-player player-b"><i /> <span>naya</span></div><div className="mini-player player-c"><i /> <span>kiro</span></div>
          <div className="float-tag float-tag-bottom"><span className="damage-burst"><Zap size={17} fill="currentColor" /></span><span><small>Attaque collective</small><strong>−380 PV !</strong></span><span className="float-plus">+24</span></div>
          <div className="hero-star star-a">✦</div><div className="hero-star star-b">✦</div><div className="hero-star star-c">·</div>
        </div>
        <div className="hero-bottom-note"><span className="scroll-line" /> Une nouvelle façon de vivre le live <span className="scroll-line" /></div>
      </section>

      <section className="how-section" id="how"><div className="page-width">
        <div className="section-heading"><div><span className="eyebrow">SIMPLE COMME UN LIVE</span><h2>Ensemble, en trois étapes.</h2></div><p>Le streamer lance. Le chat rejoint. Le boss tremble.</p></div>
        <div className="steps-grid">
          <article className="step-card"><span className="step-index">01</span><div className="step-icon violet-icon"><MonitorPlay size={21} /></div><h3>Lance ta session</h3><p>Ouvre ton dashboard et ajoute l’overlay CrowdRaid à OBS en source navigateur.</p><span className="step-connector">↗</span></article>
          <article className="step-card"><span className="step-index">02</span><div className="step-icon peach-icon"><ArrowUpRight size={21} /></div><h3>Le chat rejoint</h3><p>Affiche le QR code. Tes viewers scannent, choisissent un pseudo, et c’est parti.</p><span className="step-connector">↗</span></article>
          <article className="step-card"><span className="step-index">03</span><div className="step-icon mint-icon"><Sparkles size={21} /></div><h3>Tout le monde attaque</h3><p>Chaque tap compte. Le boss encaisse, les scores montent, le stream s’enflamme.</p><span className="step-connector">✦</span></article>
        </div>
      </div></section>
      <footer className="landing-footer page-width"><Brand compact /><span>Conçu pour les lives qui rassemblent.</span><span className="footer-pill"><Heart size={13} /> Fait pour jouer ensemble</span></footer>
    </main>
  </div>;
}

function Topbar({ state, code }: { state: SessionState | null; code: string }) {
  return <header className="app-topbar"><Brand compact /><div className="topbar-center"><span className="topbar-game-icon"><Gamepad2 size={15} /></span><span>Co-Op Boss Raid</span><ChevronDown size={14} /></div><div className="topbar-right"><StatusPill state={state} /><span className="topbar-divider" /><span className="session-code-label">SESSION <strong>{code}</strong></span><button className="icon-button help-button" aria-label="Aide" title="Aide"><CircleHelp size={18} /></button><div className="user-avatar" aria-label="Profil streamer">S</div></div></header>;
}

function HostPage({ socket }: { socket: Socket }) {
  const { code = "" } = useParams();
  const [state, setState] = useState<SessionState | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const hostToken = localStorage.getItem(`crowdraid:host:${code}`) ?? "";
  const viewerUrl = `${window.location.origin}/play/${code}`;
  const overlayUrl = `${window.location.origin}/overlay/${code}`;

  useEffect(() => {
    const receive = (next: SessionState) => setState(next);
    socket.on("session:state", receive);
    const join = () => socket.emit("host:join", { code, hostToken }, (result: ServerAck) => {
      if (result.ok && result.state) setState(result.state);
      if (!result.ok) setMessage(result.error);
    });
    if (socket.connected) join(); else socket.once("connect", join);
    return () => { socket.off("session:state", receive); socket.off("connect", join); };
  }, [socket, code, hostToken]);

  const act = (event: "host:start" | "host:rage" | "host:end") => {
    socket.emit(event, (result: ServerAck) => {
      if (!result.ok) setMessage(result.error);
      else setMessage(event === "host:rage" ? "Rage activée ! Double dégâts pendant 10 secondes." : event === "host:start" ? "La partie est lancée !" : "Partie terminée.");
      window.setTimeout(() => setMessage(""), 4000);
    });
  };
  const copyLink = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { setMessage("Copie indisponible : sélectionne et copie le lien."); }
  };

  const pct = state ? (state.bossHp / state.bossMaxHp) * 100 : 100;
  return <div className="dashboard-page">
    <Topbar state={state} code={code} />
    <aside className="app-sidebar">
      <div className="sidebar-group-label">ESPACE STREAMER</div>
      <button className="sidebar-item sidebar-item-active"><MonitorPlay size={17} /><span>Ma session</span><i /></button>
      <button className="sidebar-item" onClick={() => window.open(overlayUrl, "_blank", "noopener,noreferrer")}><ExternalLink size={16} /><span>Overlay OBS</span><ArrowUpRight size={14} className="sidebar-trailing" /></button>
      <div className="sidebar-bottom"><div className="sidebar-help"><Shield size={17} /><span><strong>Session privée</strong><small>Seul toi contrôles la partie.</small></span></div><div className="sidebar-user"><span className="user-avatar user-avatar-large">S</span><span><strong>Streamer</strong><small>Compte démo</small></span><MoreHorizontal size={17} /></div></div>
    </aside>
    <main className="dashboard-main">
      <div className="dashboard-heading"><div className="breadcrumb"><span>Dashboard</span><span>/</span><strong>Session en cours</strong></div><div className="heading-title-row"><div><h1>Salut, streamer <span className="wave-hand">✦</span></h1><p>Ta communauté est prête à entrer dans l’arène.</p></div><div className="heading-buttons"><button className="button button-white" onClick={() => window.open(overlayUrl, "_blank", "noopener,noreferrer")}><MonitorPlay size={16} /> Tester l’overlay</button><button className="button button-primary" onClick={() => act("host:end")} disabled={state?.status === "ended"}><span className="button-live-dot" /> Terminer la partie</button></div></div></div>
      {message && <div className="toast-message" role="status"><Check size={15} /> {message}</div>}
      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>JOUEURS EN LIGNE</span><span className="stat-icon stat-icon-purple"><Users size={16} /></span></div><div className="stat-value">{state?.playerCount ?? 0}<small> viewers</small></div><div className="stat-foot"><span className="stat-live"><i /> Live maintenant</span><span>dans cette session</span></div></div>
        <div className="stat-card"><div className="stat-top"><span>DÉGÂTS DE L’ÉQUIPE</span><span className="stat-icon stat-icon-peach"><Zap size={16} /></span></div><div className="stat-value">{(state?.totalDamage ?? 0).toLocaleString("fr-FR")}<small> pts</small></div><div className="stat-foot"><span className="stat-foot-positive"><ArrowUpRight size={13} /> Collectifs</span><span>depuis le début</span></div></div>
        <div className="stat-card"><div className="stat-top"><span>VIE DU BOSS</span><span className="stat-icon stat-icon-mint"><Heart size={16} /></span></div><div className="stat-value">{state?.bossHp ?? 1000}<small> / {state?.bossMaxHp ?? 1000} PV</small></div><div className="stat-progress"><i style={{ width: `${pct}%` }} /></div><div className="stat-foot"><span>{Math.round(100 - pct)}% vaincu</span><span>Golem violet</span></div></div>
      </div>
      <div className="dashboard-content-grid">
        <section className="surface-card stream-card">
          <div className="surface-heading"><div><h2>Ton arène</h2><p>Aperçu de ce que ton audience voit sur le stream.</p></div><div className="live-caption"><i /> {state?.status === "live" ? "LIVE" : state?.status === "ended" ? "FINI" : "PRÊT"}</div></div>
          <div className="arena-frame"><div className="arena-hud"><div className="boss-hud"><span className="boss-name"><span className="boss-crown">♛</span> GOLEM VIOLET</span><div className="boss-health-row"><div className="boss-health"><i style={{ width: `${pct}%` }} /></div><span>{state?.bossHp ?? 1000}<small>/{state?.bossMaxHp ?? 1000}</small></span></div></div><div className="arena-players"><Users size={14} /> {state?.playerCount ?? 0} joueurs</div></div><Arena state={state} /><div className="arena-bottom-hud"><div className="arena-event"><span className="event-spark"><Sparkles size={14} /></span><span>{state?.lastEvent || "Les viewers attendent le lancement…"}</span></div><div className="arena-hud-score"><Trophy size={13} /> TOP 5</div></div></div>
          <div className="arena-footer"><div className="overlay-status"><span className="overlay-status-icon"><MonitorPlay size={15} /></span><span><strong>Overlay OBS</strong><small>Source navigateur · 1920 × 1080</small></span><span className="connection-check"><Check size={13} /></span></div><button className="button button-outline" onClick={() => window.open(overlayUrl, "_blank", "noopener,noreferrer")}>Ouvrir l’overlay <ArrowUpRight size={15} /></button></div>
        </section>
        <section className="surface-card leaderboard-card">
          <div className="surface-heading leaderboard-heading"><div><h2>Meilleurs joueurs</h2><p>Les héros du live, aujourd’hui.</p></div><button className="icon-button" aria-label="Plus d’options"><MoreHorizontal size={19} /></button></div>
          <div className="leaderboard-list">
            {(state?.topPlayers ?? []).map((player, index) => <div className={`leaderboard-row rank-${index + 1}`} key={player.id}><span className="rank-medal">{index === 0 ? <span>♛</span> : `0${index + 1}`}</span><span className={`leader-avatar avatar-color-${index % 5}`}>{player.nickname.slice(0, 1).toUpperCase()}</span><span className="leader-name">{player.nickname}<small>{index === 0 ? "Top damage" : "Raid member"}</small></span><span className="leader-score">{player.score}<small> pts</small></span></div>)}
            {(!state || state.topPlayers.length === 0) && <div className="empty-leaderboard"><span className="empty-trophy"><Trophy size={20} /></span><strong>Le classement se prépare</strong><span>Dès la première attaque, les joueurs apparaîtront ici.</span></div>}
          </div>
          <button className="leaderboard-link" onClick={() => copyLink(viewerUrl)}>Partager le lien de la partie <ArrowRight size={15} /></button>
        </section>
      </div>
      <div className="join-strip"><div className="join-strip-icon"><Sparkles size={17} /></div><div className="join-strip-copy"><strong>Fais entrer ton chat dans la partie</strong><span>Affiche le QR code ou copie le lien dans ton chat Twitch.</span></div><div className="join-link-chip"><Link2 size={14} /><span>{viewerUrl.replace(/^https?:\/\//, "")}</span><button aria-label="Copier le lien viewer" onClick={() => copyLink(viewerUrl)}>{copied ? <Check size={15} /> : <Copy size={15} />}</button></div><button className="button button-rage" onClick={() => act("host:rage")} disabled={state?.status !== "live" || state.rageActive}><Zap size={15} fill="currentColor" /> {state?.rageActive ? "Rage activée" : "Rage du boss"}</button></div>
      {state?.status === "waiting" && <div className="launch-row"><span><span className="launch-indicator" /> Partage le lien, puis lance la partie quand les viewers sont prêts.</span><button className="button button-primary" onClick={() => act("host:start")}><Play size={15} fill="currentColor" /> Lancer la partie</button></div>}
    </main>
  </div>;
}

function OverlayPage({ socket }: { socket: Socket }) {
  const { code = "" } = useParams();
  const [state, setState] = useState<SessionState | null>(null);
  const viewerUrl = `${window.location.origin}/play/${code}`;
  useEffect(() => {
    const receive = (next: SessionState) => setState(next);
    socket.on("session:state", receive);
    const join = () => socket.emit("overlay:join", { code }, (result: ServerAck) => { if (result.ok && result.state) setState(result.state); });
    if (socket.connected) join(); else socket.once("connect", join);
    return () => { socket.off("session:state", receive); socket.off("connect", join); };
  }, [socket, code]);

  const pct = state ? (state.bossHp / state.bossMaxHp) * 100 : 100;
  return <main className="overlay-page"><div className="overlay-stage"><div className="overlay-hud-top"><div className="overlay-boss-label"><span className="overlay-crown">♛</span><div><strong>GOLEM VIOLET</strong><span className="overlay-hp-track"><i style={{ width: `${pct}%` }} /></span></div><b>{state?.bossHp ?? 1000}<small> / 1000</small></b></div><span className="overlay-live"><i /> {state?.playerCount ?? 0} JOUEURS EN LIGNE</span></div><Arena state={state} className="arena-overlay" />{state?.lastEvent && <div className="overlay-event">{state.lastEvent}</div>}<div className="overlay-bottom"><div className="overlay-top-list"><span className="overlay-list-title"><Trophy size={12} /> TOP RAIDERS</span>{(state?.topPlayers ?? []).slice(0, 5).map((player, index) => <span className="overlay-rank" key={player.id}><b>{index + 1}</b>{player.nickname}<small>{player.score}</small></span>)}</div><div className="overlay-join-card"><QRCodeSVG value={viewerUrl} size={75} level="M" bgColor="#ffffff" fgColor="#27164e" /><div><strong>REJOINS LE RAID</strong><span>Scanne pour jouer</span><b>{viewerUrl.replace(/^https?:\/\//, "")}</b></div></div></div></div></main>;
}

function ViewerPage({ socket }: { socket: Socket }) {
  const { code = "" } = useParams();
  const [nickname, setNickname] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [myRank, setMyRank] = useState(0);
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState<SessionState | null>(null);
  const [feedback, setFeedback] = useState("Prêt à attaquer ? Chaque coup aide l’équipe.");
  const [error, setError] = useState("");
  const [attackBusy, setAttackBusy] = useState(false);

  useEffect(() => {
    const receive = (next: SessionState) => setState(next);
    const receiveRank = (rank: number) => setMyRank(rank);
    socket.on("session:state", receive);
    socket.on("viewer:rank", receiveRank);
    const saved = localStorage.getItem(`crowdraid:player:${code}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { id: string; nickname: string };
        setNickname(parsed.nickname);
        setPlayerId(parsed.id);
        const join = () => socket.emit("viewer:join", { code, nickname: parsed.nickname, playerId: parsed.id }, (result: ServerAck) => {
          if (result.ok) { setJoined(true); if (result.state) setState(result.state); if (result.rank) setMyRank(result.rank); }
          else setError(result.error);
        });
        if (socket.connected) join(); else socket.once("connect", join);
      } catch { localStorage.removeItem(`crowdraid:player:${code}`); }
    }
    return () => { socket.off("session:state", receive); socket.off("viewer:rank", receiveRank); };
  }, [socket, code]);

  const joinGame = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    socket.emit("viewer:join", { code, nickname }, (result: ServerAck) => {
      if (!result.ok) { setError(result.error); return; }
      const id = result.playerId ?? crypto.randomUUID();
      setPlayerId(id);
      if (result.rank) setMyRank(result.rank);
      setJoined(true);
      if (result.state) setState(result.state);
      localStorage.setItem(`crowdraid:player:${code}`, JSON.stringify({ id, nickname: nickname.trim() }));
    });
  };
  const attack = () => {
    if (attackBusy || state?.status !== "live") return;
    setAttackBusy(true);
    socket.emit("game:attack", (result: ServerAck) => {
      setAttackBusy(false);
      if (!result.ok) { setFeedback(result.error); return; }
      setFeedback(`Bien joué ! +${result.damage} dégâts pour toi.`);
      window.setTimeout(() => setFeedback("Ton attaque compte pour l’équipe."), 1800);
    });
  };
  const shareSession = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Rejoins mon raid !", url: window.location.href }); } catch { /* Viewer cancelled sharing. */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setFeedback("Lien copié. Invite tes amis dans le raid !");
    } catch {
      setFeedback("Partage ce lien avec tes amis pour jouer ensemble.");
    }
  };

  const myScore = state?.topPlayers.find((player) => player.id === playerId)?.score ?? 0;
  const pct = state ? (state.bossHp / state.bossMaxHp) * 100 : 100;

  return <main className="viewer-page"><header className="viewer-header"><Brand compact /><span className="viewer-connected"><i />{state?.status === "live" ? "Partie en direct" : state?.status === "ended" ? "Partie terminée" : "En attente du streamer"}</span></header>
    {!joined ? <section className="join-screen"><div className="join-decoration decor-one" /><div className="join-decoration decor-two" /><div className="join-card"><div className="join-game-icon"><Swords size={23} /></div><span className="join-overline">TU ES INVITÉ·E À</span><h1>Le chat contre<br /><span>le boss.</span></h1><p>Rejoins la partie du streamer. Choisis ton pseudo et attaque avec tout le monde.</p><form onSubmit={joinGame}><label htmlFor="nickname">Ton pseudo</label><div className="name-input-wrap"><span>@</span><input id="nickname" value={nickname} onChange={(event) => setNickname(event.target.value.slice(0, 16))} placeholder="ex. Luma" maxLength={16} autoComplete="nickname" required /></div>{error && <div className="inline-error" role="alert">{error}</div>}<button className="button button-primary button-block" type="submit" disabled={!nickname.trim()}><Gamepad2 size={17} /> Rejoindre la partie <ArrowRight size={16} /></button></form><div className="join-safe-note"><LockKeyhole size={13} /> Pas de compte. Pas de téléchargement. Juste du jeu.</div></div></section>
    : <section className="controller-screen"><div className="controller-greeting"><div><span className="join-overline">SESSION {code}</span><h1>À toi de jouer, <span>{nickname}.</span></h1></div><span className="controller-player-count"><Users size={15} /> {state?.playerCount ?? 1} dans le raid</span></div><div className={`mobile-boss-card ${state?.rageActive ? "boss-raging" : ""}`}><div className="mobile-boss-top"><span className="mobile-boss-avatar"><span>♛</span></span><div><small>BOSS DU RAID</small><strong>Golem violet</strong></div><span className="mobile-boss-state">{state?.rageActive ? "RAGE" : state?.status === "ended" ? "FINI" : "EN JEU"}</span></div><div className="mobile-hp-row"><span>VIE DU BOSS</span><b>{state?.bossHp ?? 1000}<small> / {state?.bossMaxHp ?? 1000} PV</small></b></div><div className="mobile-health"><i style={{ width: `${pct}%` }} /></div><div className="boss-status-copy">{state?.lastEvent || "Ton équipe est prête."}</div></div>
      <div className="your-score-card"><span className="your-score-icon"><Zap size={17} /></span><span><small>TES DÉGÂTS</small><strong>{myScore} <em>pts</em></strong></span><span className="your-rank-pill">{myRank > 0 ? `#${myRank}` : "—"}</span></div>
      {state?.status === "waiting" ? <div className="controller-wait"><div className="wait-pulse"><Radio size={22} /></div><strong>Le streamer arrive…</strong><span>La partie commencera dans un instant.</span></div> : state?.status === "ended" ? <div className="controller-wait controller-ended"><div className="wait-pulse"><Trophy size={22} /></div><strong>Beau raid, {nickname} !</strong><span>Merci d’avoir joué avec la communauté.</span></div> : <><button className={`attack-button ${attackBusy ? "attack-pressed" : ""}`} onClick={attack} disabled={attackBusy}><span className="attack-button-inner"><Swords size={30} /><strong>{attackBusy ? "À L’ATTAQUE…" : "ATTAQUER"}<small>Touche pour frapper le boss</small></strong><ArrowRight size={19} /></span></button><p className="attack-feedback" aria-live="polite"><Sparkles size={14} /> {feedback}</p></>}
      <div className="controller-bottom"><div><Trophy size={16} /><span><strong>Top raid</strong><small>{state?.topPlayers.slice(0, 3).map((player) => player.nickname).join(" · ") || "Le classement arrive bientôt"}</small></span></div><button onClick={shareSession} aria-label="Partager la partie"><ArrowUpRight size={18} /></button></div>
    </section>}
  </main>;
}

function NotFound() { return <main className="not-found"><Brand /><h1>Cette arène n’existe pas.</h1><p>Le lien est peut-être expiré.</p><Link className="button button-primary" to="/">Retour à l’accueil <ArrowRight size={16} /></Link></main>; }

export default function App() {
  const socket = useSocket();
  return <Routes><Route path="/" element={<Landing socket={socket} />} /><Route path="/host/:code" element={<HostPage socket={socket} />} /><Route path="/overlay/:code" element={<OverlayPage socket={socket} />} /><Route path="/play/:code" element={<ViewerPage socket={socket} />} /><Route path="*" element={<NotFound />} /></Routes>;
}
