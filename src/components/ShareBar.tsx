"use client";

import { useState } from "react";

interface Props {
  title: string;
  /** Texte calculé à la demande (au clic) pour éviter de le construire en boucle. */
  getText: () => string;
  /** Libellé du bouton de partage principal. */
  shareLabel?: string;
  /** Affiche le bouton WhatsApp dédié. */
  whatsapp?: boolean;
  /** Texte spécifique à WhatsApp (par défaut : `getText`). Utile pour envoyer
   *  une version compacte qui tient dans un seul message. */
  getWhatsappText?: () => string;
}

type Feedback = { kind: "ok" | "err"; msg: string } | null;

/** Lien officiel WhatsApp pré-rempli. */
function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function ShareBar({
  title,
  getText,
  shareLabel = "Partager",
  whatsapp = false,
  getWhatsappText,
}: Props) {
  const [feedback, setFeedback] = useState<Feedback>(null);

  const flash = (f: Feedback) => {
    setFeedback(f);
    window.setTimeout(() => setFeedback(null), 2500);
  };

  // Partage natif iOS/Android (feuille de partage : Notes, Messages, Mail, WhatsApp…).
  const onShare = async () => {
    const text = getText();
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title, text });
      } catch {
        /* partage annulé : on ne fait rien */
      }
      return;
    }
    // Repli : copie dans le presse-papier.
    await copy(text);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash({ kind: "ok", msg: "Copié dans le presse-papier ✓" });
    } catch {
      flash({ kind: "err", msg: "Copie impossible sur ce navigateur" });
    }
  };

  const onWhatsapp = () => {
    const text = (getWhatsappText ?? getText)();
    window.open(whatsappHref(text), "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onShare}
          className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95"
        >
          📤 {shareLabel}
        </button>
        {whatsapp && (
          <button
            onClick={onWhatsapp}
            className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white active:scale-95"
          >
            🟢 WhatsApp
          </button>
        )}
        <button
          onClick={() => copy(getText())}
          aria-label="Copier"
          className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 active:scale-95"
        >
          📋 Copier
        </button>
      </div>
      {feedback && (
        <p
          className={`mt-2 text-center text-xs ${
            feedback.kind === "ok" ? "text-green-600" : "text-red-600"
          }`}
        >
          {feedback.msg}
        </p>
      )}
    </div>
  );
}
