export interface DumpLine {
  label: string;
  value: string;
}

export const BRAND = "MORUE SYSTEMS";
export const BRAND_D07 = "M.O.R.U.E.";
export const TERMINAL = "TERMINAL D-14";
export const TERMINAL_D07 = "TERMINAL  D-07";
export const CLOCK_DEAD = "ARRÊTÉE";

export const ARRIVAL_DUMP: DumpLine[] = [
  { label: "TERMINAL", value: "RÉVOQUÉ" },
  { label: "ALIMENTATION", value: "LOCALE" },
  { label: "RÉSEAU", value: "INDISPONIBLE" },
];

export const CTA_INIT = "INITIALISER LE TERMINAL";
export const CTA_RESTORE = "RESTAURER LA SESSION";

export const BOOT_LINES: DumpLine[] = [
  { label: "MÉMOIRE", value: "OK" },
  { label: "STOCKAGE LOCAL", value: "OK" },
  { label: "CONFIGURATION", value: "OK" },
  { label: "RÉSEAU", value: "INDISPONIBLE" },
  { label: "AUTORISATION", value: "ACCÈS REFUSÉ" },
  { label: "TERMINAL D-14", value: "RÉVOQUÉ" },
];

export const RECOVERY_LINES: DumpLine[] = [
  { label: "SESSION LOCALE", value: "DÉTECTÉE" },
  { label: "ARRÊT PRÉCÉDENT", value: "INCOMPLET" },
  { label: "RESTAURATION", value: "DISPONIBLE" },
];

export const RESTORE_LINES: DumpLine[] = [
  { label: "SESSION", value: "RESTAURÉE" },
  { label: "ÉTAT", value: "VERROUILLÉ" },
];

export const LOCK_REQUIRED = "SCHÉMA D'ACCÈS REQUIS";
export const LOCK_FAIL = "SCHÉMA NON RECONNU";
export const LOCK_OK = "SCHÉMA RECONNU";
export const LOCK_COOLDOWN = "ESSAIS SUSPENDUS";

export const ENV_RESTORE_TITLE = "RESTAURATION ENVIRONNEMENT LOCAL";

export const UNLOCK_LINES: DumpLine[] = [
  { label: "ACCÈS", value: "AUTORISÉ" },
  { label: "SESSION", value: "DÉVERROUILLÉE" },
  { label: "ENVIRONNEMENT", value: "LOCAL" },
];

export const IDENTITY_SESSION = "ELIAS VARENNE";

export const PANEL_EMPTY = "SÉLECTIONNER UN DOSSIER";
export const FOLDER_EMPTY = "AUCUN FICHIER";
export const FILE_NOTICE = "FICHIER LOCAL — LECTURE DIFFÉRÉE";
export const FOLDER_UNAVAILABLE = "INDISPONIBLE";
export const FOLDER_REVOKED = "RÉVOQUÉ";

export const FRAGMENT_LINE = "SESSION LOCALE";
export const FRAGMENT_CLEARING = "SUPPRESSION";

export const STRIP_SYNC = "SYNCHRONISATION CENTRALE";
export const STRIP_ID = "TERMINAL D-14 IDENTIFIÉ";
export const STRIP_REVOKE = "RÉVOCATION";
export const FOOT_NET_UP = "CONNEXION RÉSEAU ÉTABLIE";
export const FOOT_READONLY = "LECTURE SEULE";

export const VOID_LINES = [
  "SESSION NON AUTORISÉE",
  "ORIGINE D-14",
  "RÉVOCATION…",
] as const;

/** Tampons D-07 qui écrasent la session pendant la destruction. */
export const REVOKE_STAMPS = [
  "SESSION NON AUTORISÉE",
  "ORIGINE D-14",
  "PROCÉDURE DE RÉVOCATION",
  "FERMETURE DES RESSOURCES",
  "SUPPRESSION DE L'ÉTAT LOCAL",
] as const;

export const REVOKE_TICKS = 16;

export const F_TITLE = "SESSION RÉVOQUÉE";
export const F_SUBTITLE = "ACCÈS REFUSÉ";
export const F_BODY = [
  "Votre activité a été détectée.",
  "Cette session n'est plus disponible.",
  "Votre activité de pré-intégration est terminée.",
  "Vous pouvez fermer cette page.",
] as const;

export const F_LOG = [
  "Origine : D-14",
  "Statut : RÉVOQUÉ",
] as const;

export const COM_TITLE = "DERNIÈRE COMMUNICATION RÉCUPÉRÉE";
export const COM_SUBTITLE = "Transmission interrompue";
export const COM_LINES = [
  "CNRS / 04.02.2016",
  "",
  "REF 3.6.32—2.5.21—6.5.24—3.5.14",
  "    4.3.3—3.6.40—5.1.4—6.6.19",
] as const;
export const COM_STATUS = "NON TRANSMIS";

export const RES_TITLE = "RESSOURCE EXTERNE ASSOCIÉE";
export const RES_HOTE_PLACEHOLDER = "[ ............ ]";
export const RES_HOTE_SUFFIX = ".miraheze.org";
export const RES_HOTE_ERROR = "HÔTE NON RÉSOLU";
export const RES_CTA = "OUVRIR";

export const CHIP_TERMINAL_REVOKED = "TERMINAL RÉVOQUÉ";
export const CHIP_POWER = "ALIMENTATION LOCALE";
export const CHIP_NET_DOWN = "RÉSEAU INDISPONIBLE";
export const CHIP_SESSION_LOCAL = "SESSION LOCALE";
export const CHIP_LOCKED = "ÉTAT VERROUILLÉ";
export const CHIP_RESTORING = "RESTAURATION";

export const FOOT_LAST_STOP = "ARRÊT PRÉCÉDENT  INCOMPLET";
export const FOOT_VERIFY = "VÉRIFICATION EN COURS";
export const FOOT_DENIED = "ACCÈS REFUSÉ";
export const FOOT_RECOVERY = "RESTAURATION  LOCALE";
export const FOOT_LOCK = "VERROU  LOCAL";
export const FOOT_LOCK_WAIT = "VERROU  SUSPENDU";
export const FOOT_LOCAL_OK = "LOCAL  OK";
export const FOOT_DESKTOP = [
  "RÉSEAU  INDISPONIBLE",
  "STOCKAGE  LOCAL",
  "ÉCRITURE  AUTORISÉE",
] as const;
