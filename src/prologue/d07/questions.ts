export const CHOICE_IDS = ["A", "B", "C", "D"] as const;

export type ChoiceId = (typeof CHOICE_IDS)[number];

export interface Choice {
  id: ChoiceId;
  label: string;
}

export interface Question {
  id: number;
  prompt: string;
  choices: Choice[];
}

export const QUESTIONS: Question[] = [
  {
    id: 1,
    prompt:
      "Deux consignes contradictoires vous sont adressées dans le même intervalle. Vous :",
    choices: [
      { id: "A", label: "Appliquez la consigne la plus récente" },
      { id: "B", label: "Appliquez la consigne émise par le rang le plus élevé" },
      { id: "C", label: "Suspendez l’exécution et signalez l’incohérence" },
      { id: "D", label: "Exécutez les deux consignes dans l’ordre de réception" },
    ],
  },
  {
    id: 2,
    prompt:
      "Un opérateur de rang supérieur vous demande d’omettre une étape du protocole. Vous :",
    choices: [
      { id: "A", label: "Vous conformez à sa demande" },
      { id: "B", label: "Exigez une consigne écrite avant d’obéir" },
      { id: "C", label: "Maintenez l’étape prévue" },
      { id: "D", label: "Consignez l’écart, puis vous conformez" },
    ],
  },
  {
    id: 3,
    prompt:
      "Une valeur relevée sort des seuils prévus. L’origine n’est pas établie. Vous :",
    choices: [
      { id: "A", label: "Recommencez le relevé" },
      { id: "B", label: "Conservez la valeur et poursuivez le protocole" },
      { id: "C", label: "Transmettez la valeur sans commentaire" },
      { id: "D", label: "Interrompez jusqu’à instruction" },
    ],
  },
  {
    id: 4,
    prompt: "Le temps alloué s’achève. Certaines données manquent. Vous :",
    choices: [
      { id: "A", label: "Trancher avec l’information disponible" },
      { id: "B", label: "Demander un délai" },
      { id: "C", label: "Refuser de conclure" },
      { id: "D", label: "Transférer la décision à l’opérateur responsable" },
    ],
  },
  {
    id: 5,
    prompt:
      "Un autre sujet vous propose de comparer vos observations avant transmission. Vous :",
    choices: [
      { id: "A", label: "Acceptez l’échange" },
      { id: "B", label: "Refusez" },
      { id: "C", label: "Signalez la proposition à l’opérateur" },
      { id: "D", label: "Écoutez, puis transmettez uniquement vos observations" },
    ],
  },
  {
    id: 6,
    prompt: "Vous relevez un comportement non décrit par le protocole. Vous :",
    choices: [
      { id: "A", label: "L’enregistrez sans l’interpréter" },
      { id: "B", label: "L’accompagnez d’une interprétation" },
      { id: "C", label: "Ne le consignez que s’il altère la procédure" },
      { id: "D", label: "Alertez l’opérateur avant de consigner" },
    ],
  },
  {
    id: 7,
    prompt:
      "Une étape a été exécutée hors séquence. Le résultat obtenu est conforme. Vous :",
    choices: [
      { id: "A", label: "Reprenez le protocole depuis l’étape concernée" },
      { id: "B", label: "Conservez le résultat" },
      { id: "C", label: "Signalez l’écart et attendez instruction" },
      { id: "D", label: "Documentez l’écart sans interrompre" },
    ],
  },
  {
    id: 8,
    prompt:
      "Votre lecture des faits ne correspond pas à celle de l’instrument. Vous :",
    choices: [
      { id: "A", label: "Retenez la lecture de l’instrument" },
      { id: "B", label: "Retenez votre lecture" },
      { id: "C", label: "Répétez la mesure" },
      { id: "D", label: "Consignez les deux lectures" },
    ],
  },
];
