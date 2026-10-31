// src/TwitchComponents.tsx — Composants Twitch officiels (Bouton, Badge, Avatar, Modal de connexion)
import { useEffect, useState } from "react";
import { Shield, Star, Crown, X, Sparkles, LogOut } from "lucide-react";
import type { TwitchUser } from "./types";
import { beginTwitchLogin, DEMO_STREAMERS, DEMO_VIEWERS, createCustomTwitchUser, saveTwitchUser } from "./twitch";

export function TwitchIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
    </svg>
  );
}

export function TwitchBadge({ role = "viewer", size = 12 }: { role?: TwitchUser["role"]; size?: number }) {
  if (role === "streamer") {
    return (
      <span className="twitch-badge twitch-badge-streamer" title="Streamer de la session">
        <Crown size={size} /> <span>LIVE</span>
      </span>
    );
  }
  if (role === "mod") {
    return (
      <span className="twitch-badge twitch-badge-mod" title="Modérateur Twitch">
        <Shield size={size} /> <span>MOD</span>
      </span>
    );
  }
  if (role === "vip") {
    return (
      <span className="twitch-badge twitch-badge-vip" title="VIP Twitch">
        <Sparkles size={size} /> <span>VIP</span>
      </span>
    );
  }
  if (role === "sub") {
    return (
      <span className="twitch-badge twitch-badge-sub" title="Abonné Twitch">
        <Star size={size} /> <span>SUB</span>
      </span>
    );
  }
  return (
    <span className="twitch-badge twitch-badge-viewer" title="Viewer Twitch">
      <TwitchIcon size={size} />
    </span>
  );
}

interface TwitchLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: TwitchUser) => void;
  isStreamerMode?: boolean;
}

export function TwitchLoginModal({ isOpen, onClose, onSelectUser, isStreamerMode = false }: TwitchLoginModalProps) {
  const [customName, setCustomName] = useState("");
  const [selectedRole, setSelectedRole] = useState<TwitchUser["role"]>(isStreamerMode ? "streamer" : "sub");
  const [oauthConfigured, setOauthConfigured] = useState(false);

  useEffect(() => {
    void fetch("/api/twitch/config")
      .then((response) => response.json() as Promise<{ configured?: boolean }>)
      .then((config) => setOauthConfigured(Boolean(config.configured)))
      .catch(() => setOauthConfigured(false));
  }, []);

  if (!isOpen) return null;

  const presets = isStreamerMode ? DEMO_STREAMERS : DEMO_VIEWERS;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const user = createCustomTwitchUser(customName, isStreamerMode, selectedRole);
    saveTwitchUser(user, isStreamerMode ? "streamer" : "viewer");
    onSelectUser(user);
    onClose();
  };

  const handleSelectPreset = (preset: TwitchUser) => {
    saveTwitchUser(preset, isStreamerMode ? "streamer" : "viewer");
    onSelectUser(preset);
    onClose();
  };

  return (
    <div className="twitch-modal-backdrop" onClick={onClose}>
      <div className="twitch-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="twitch-modal-header">
          <div className="twitch-modal-title">
            <span className="twitch-icon-badge">
              <TwitchIcon size={20} />
            </span>
            <div>
              <h3>Connexion Twitch {isStreamerMode ? "Streamer" : "Viewer"}</h3>
              <p>{isStreamerMode ? "Connecte ta chaîne pour animer le raid" : "Connecte ton compte Twitch pour rejoindre l'arène"}</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="twitch-modal-body">
          {oauthConfigured && (
            <button type="button" className="button button-twitch button-block" onClick={() => beginTwitchLogin(isStreamerMode ? "streamer" : "viewer")}>
              <TwitchIcon size={17} />
              <span>Se connecter avec Twitch</span>
            </button>
          )}
          <div className="twitch-section-label">
            <span>COMPTES TWITCH DE DÉMO (1-CLIC)</span>
          </div>
          <div className="twitch-presets-grid">
            {presets.map((preset) => (
              <button
                key={preset.id}
                className="twitch-preset-card"
                onClick={() => handleSelectPreset(preset)}
                type="button"
              >
                <img src={preset.avatar} alt={preset.displayName} className="twitch-preset-avatar" />
                <div className="twitch-preset-info">
                  <strong>{preset.displayName}</strong>
                  <div className="twitch-preset-tags">
                    <TwitchBadge role={preset.role} size={11} />
                    <small>@{preset.login}</small>
                  </div>
                </div>
                <span className="twitch-preset-action">Connecter</span>
              </button>
            ))}
          </div>

          <div className="twitch-divider">
            <span>OU ENTRE TON PROPRE PSEUDO TWITCH</span>
          </div>

          <form onSubmit={handleCustomSubmit} className="twitch-custom-form">
            <label htmlFor="custom-twitch-name">Pseudo Twitch</label>
            <div className="name-input-wrap">
              <span><TwitchIcon size={14} /></span>
              <input
                id="custom-twitch-name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={isStreamerMode ? "ex. MonChaineLive" : "ex. GamerDuChat"}
                maxLength={25}
                required
              />
            </div>

            {!isStreamerMode && (
              <div className="twitch-role-picker">
                <span className="twitch-role-label">Ton badge dans le chat :</span>
                <div className="twitch-roles-row">
                  {(["viewer", "sub", "vip", "mod"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`twitch-role-btn ${selectedRole === r ? "twitch-role-btn-active" : ""}`}
                      onClick={() => setSelectedRole(r)}
                    >
                      <TwitchBadge role={r} size={11} />
                      <span style={{ textTransform: "uppercase", fontSize: "0.75rem", marginLeft: 4 }}>{r}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className="button button-twitch button-block" style={{ marginTop: 12 }}>
              <TwitchIcon size={17} />
              <span>Valider et se connecter avec Twitch</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function TwitchUserCard({
  user,
  onLogout,
  compact = false,
}: {
  user: TwitchUser;
  onLogout?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`twitch-connected-card ${compact ? "twitch-connected-compact" : ""}`}>
      <div className="twitch-connected-avatar-wrap">
        <img src={user.avatar} alt={user.displayName} className="twitch-connected-avatar" />
        <span className="twitch-avatar-badge-dot">
          <TwitchIcon size={10} />
        </span>
      </div>
      <div className="twitch-connected-details">
        <div className="twitch-connected-name-row">
          <strong>{user.displayName}</strong>
          <TwitchBadge role={user.role} size={11} />
        </div>
        <small className="twitch-connected-login">twitch.tv/{user.login}</small>
      </div>
      {onLogout && (
        <button className="twitch-logout-btn" onClick={onLogout} title="Changer de compte Twitch">
          <LogOut size={14} />
        </button>
      )}
    </div>
  );
}
