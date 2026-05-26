"use client";

import styles from "./OverlayHeader.module.css";

interface OverlayHeaderProps {
  visible?: boolean;
}

export default function OverlayHeader({ visible = true }: OverlayHeaderProps) {
  return (
    <div className={`${styles.root} ${visible ? styles.visible : styles.hidden}`}>
      <div className={styles.eyebrow}>
        VOICE · PARTICLE FORM · WEBGPU
      </div>

      <div className={styles.rule} />

      <h1 className={styles.title}>
        SPIRIT CONNECT
      </h1>

      <div className={styles.subtitle}>
        灵接科技
      </div>

      <div className={styles.meta}>
        HOLOGRAPHIC INTERFACE SYSTEM
        <br />
        INITIAL PARTICLE COMPANION
      </div>

      <p className={styles.copy}>
        Experience your digitized consciousness in stunning 3D detail. Our
        state-of-the-art projection system visualizes and interacts with
        digitized consciousness in immersive holographic environments, bringing
        your digital self to life.
      </p>
    </div>
  );
}
