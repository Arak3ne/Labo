export interface DesktopFile {
  id: string;
  name: string;
}

export interface DesktopFolder {
  id: string;
  name: string;
  files: DesktopFile[];
}

export const DESKTOP_FOLDERS: DesktopFolder[] = [
  {
    id: "documents",
    name: "DOCUMENTS",
    files: [
      { id: "prj-14-a", name: "PRJ-14-A" },
      { id: "prj-14-c", name: "PRJ-14-C" },
      { id: "prj-09-f", name: "PRJ-09-F" },
      { id: "dossier-k12", name: "DOSSIER_K12" },
      { id: "proto-m7", name: "PROTO_M7" },
    ],
  },
  {
    id: "notes",
    name: "NOTES",
    files: [
      { id: "note-prj-07", name: "NOTE_PRJ-07" },
      { id: "memo-prj-09", name: "MEMO_PRJ-09" },
      { id: "brief-c4", name: "BRIEF_C4" },
    ],
  },
  {
    id: "archives",
    name: "ARCHIVES",
    files: [
      { id: "archive-b2", name: "ARCHIVE_B2" },
      { id: "batch-c09", name: "BATCH_C09" },
      { id: "fiche-l6", name: "FICHE_L6" },
    ],
  },
];

export const DEFAULT_FOLDER_ID = "documents";
export const REVOKE_FOLDER_IDS = ["documents", "notes", "archives"] as const;

export function folderById(id: string): DesktopFolder | undefined {
  return DESKTOP_FOLDERS.find((folder) => folder.id === id);
}
