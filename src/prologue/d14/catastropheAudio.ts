import * as sound from "./d14Sound";

export function stingAlarm(): void {
  sound.alarmHit();
}

export function stingTear(): void {
  sound.tear();
}

export function stingCrtOff(): void {
  sound.crtOff();
}

export function stingBlow(): void {
  sound.blow();
}
