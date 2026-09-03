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
    prompt: "Bitax affirme avoir « compris le jeu ».",
    choices: [
      { id: "A", label: "Je l'écoute attentivement." },
      { id: "B", label: "Je note tout pour faire exactement l'inverse." },
      { id: "C", label: "Je lui demande ses sources." },
      { id: "D", label: "Je lui donne 48 heures avant de supprimer son message." },
    ],
  },
  {
    id: 2,
    prompt: "Vous découvrez une faille manifestement non prévue par l'organisation.",
    choices: [
      { id: "A", label: "Je la signale immédiatement." },
      { id: "B", label: "Je l'exploite immédiatement." },
      { id: "C", label: "Je la signale après l'avoir exploitée." },
      { id: "D", label: "Je demande si « c'est autorisé » sans préciser de quoi je parle." },
    ],
  },
  {
    id: 3,
    prompt: "Qu'est-ce que je peux faire pour baiser oblahh cette fois ci ?",
    choices: [
      { id: "A", label: "Je leak son dossier" },
      { id: "B", label: "Je leak son adresse" },
      { id: "C", label: "Je demande à ajunka si j'ai le droit" },
      { id: "D", label: "Je mets ma bite dans son cul" },
    ],
  },
  {
    id: 4,
    prompt: "M.O.R.U.E. vous accorde 100 crédits par erreur.",
    choices: [
      { id: "A", label: "Je signale l'erreur." },
      { id: "B", label: "Je ne touche à rien." },
      { id: "C", label: "Je dépense tout avant qu'elle s'en aperçoive." },
      { id: "D", label: "Quels 100 crédits ?" },
    ],
  },
  {
    id: 5,
    prompt: "Un document porte explicitement la mention « NE PAS PARTAGER ».",
    choices: [
      { id: "A", label: "Je ne le partage pas." },
      { id: "B", label: "Je le partage à mon alliance." },
      { id: "C", label: "Je fais une capture « au cas où »." },
      { id: "D", label: "Il est déjà dans un serveur Discord secondaire." },
    ],
  },
  {
    id: 6,
    prompt: "Après 47 minutes, votre groupe est toujours bloqué sur une énigme.",
    choices: [
      { id: "A", label: "Nous continuons méthodiquement." },
      { id: "B", label: "Nous reprenons depuis le début." },
      { id: "C", label: "Nous accusons l'énigme d'être mal conçue." },
      { id: "D", label: "Quelqu'un a demandé à ChatGPT il y a 32 minutes." },
    ],
  },
  {
    id: 7,
    prompt: "Vous trouvez que artone parle trop, qu'est-ce que vous faites ?",
    choices: [
      { id: "A", label: "Vous essayez de fonder une alliance pour le buter" },
      { id: "B", label: "Vous attendez que le MJ trouve un truc pour l'éliminer" },
      { id: "C", label: "Vous vous alliez à lui" },
      { id: "D", label: "Vous le bloquez" },
    ],
  },
  {
    id: 8,
    prompt: "Pourquoi pensez-vous avoir été sélectionné pour le Laboratoire ?",
    choices: [
      { id: "A", label: "Mes capacités intellectuelles." },
      { id: "B", label: "Mon sang-froid." },
      { id: "C", label: "Ma capacité à travailler en équipe." },
      { id: "D", label: "Il manquait probablement quelqu'un." },
    ],
  },
];
