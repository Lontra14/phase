// Rogue Forge: the settings (sound, animations, language…) reachable from every
// screen, not only inside a game. A small gear in the top-right corner.

import { useState } from "react";
import { useLocation } from "react-router";

import { PreferencesModal } from "../components/settings/PreferencesModal";

export function SettingsFab() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  if (location.pathname.startsWith("/game/")) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Settings"
        title="Settings"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          top: 10,
          right: 12,
          zIndex: 60,
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "1px solid #3a3346",
          background: "rgba(12,11,18,.85)",
          color: "#ecca7e",
          fontSize: 20,
          lineHeight: "36px",
          cursor: "pointer",
          boxShadow: "0 4px 14px rgba(0,0,0,.45)",
        }}
      >
        ⚙
      </button>
      {open && <PreferencesModal onClose={() => setOpen(false)} />}
    </>
  );
}
