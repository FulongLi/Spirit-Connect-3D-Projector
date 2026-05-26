"use client";

import styles from "./SocialMorphLinks.module.css";

export interface SocialMorphTarget {
  id: string;
  label: string;
  url: string;
}

interface SocialMorphLinksProps {
  items: SocialMorphTarget[];
  activeId: string | null;
  onActivate: (item: SocialMorphTarget) => void;
  onDeactivate: () => void;
}

export default function SocialMorphLinks({
  items,
  activeId,
  onActivate,
  onDeactivate,
}: SocialMorphLinksProps) {
  return (
    <nav className={styles.root} aria-label="Social particle targets">
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`${styles.item} ${active ? styles.active : ""}`}
            onPointerEnter={() => onActivate(item)}
            onPointerDown={(event) => {
              event.preventDefault();
              onActivate(item);
            }}
            onPointerUp={onDeactivate}
            onPointerCancel={onDeactivate}
            onPointerLeave={onDeactivate}
            onFocus={() => onActivate(item)}
            onBlur={onDeactivate}
            aria-pressed={active}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
