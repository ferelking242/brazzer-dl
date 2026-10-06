import { Library, Settings, UserRound } from "lucide-react";

export type ViewKey = "library" | "settings" | "account";

const DOCK_ITEMS: { id: ViewKey; label: string; icon: typeof Library }[] = [
  { id: "library", label: "Bibliothèque", icon: Library },
  { id: "settings", label: "Réglages", icon: Settings },
  { id: "account", label: "Compte", icon: UserRound },
];

export function Dock({
  active,
  onChange,
  badge,
}: {
  active: ViewKey;
  onChange: (view: ViewKey) => void;
  badge?: Partial<Record<ViewKey, number>>;
}) {
  return (
    <nav className="dock" aria-label="Navigation principale">
      <div className="dock-inner">
        {DOCK_ITEMS.map((item) => {
          const Icon = item.icon;
          const count = badge?.[item.id];
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`dock-item ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(item.id)}
            >
              <span className="dock-icon">
                <Icon size={19} strokeWidth={1.9} />
                {typeof count === "number" && count > 0 && <span className="dock-badge">{count}</span>}
              </span>
              <span className="dock-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
