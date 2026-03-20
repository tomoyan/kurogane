import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.grid}>
        <div className={styles.tag}>
          <span>Next.js 14</span>
          <span>·</span>
          <span>App Router</span>
          <span>·</span>
          <span>TypeScript</span>
        </div>

        <h1 className={styles.heading}>
          <span className={styles.hello}>Hello,</span>
          <span className={styles.world}>World.</span>
        </h1>

        <p className={styles.sub}>
          Your starter is live. Push to GitHub, deploy to Vercel.
        </p>

        <div className={styles.cards}>
          <a
            className={styles.card}
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.cardLabel}>Docs</span>
            <span className={styles.cardArrow}>↗</span>
            <p>Explore the Next.js documentation and learn the framework.</p>
          </a>

          <a
            className={styles.card}
            href="https://vercel.com/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.cardLabel}>Deploy</span>
            <span className={styles.cardArrow}>↗</span>
            <p>Push your repo and ship instantly with Vercel.</p>
          </a>

          <a
            className={styles.card}
            href="https://nextjs.org/learn"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.cardLabel}>Learn</span>
            <span className={styles.cardArrow}>↗</span>
            <p>Take the interactive Next.js tutorial step by step.</p>
          </a>
        </div>

        <footer className={styles.footer}>
          <span className={styles.dot} />
          <span>Ready to build</span>
        </footer>
      </div>
    </main>
  );
}
