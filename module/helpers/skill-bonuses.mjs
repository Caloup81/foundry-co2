/**
 * Prépare le total et le récapitulatif des bonus présélectionnés avant l'ouverture d'un dialogue.
 * Les bonus sélectionnés manuellement sont toujours relus depuis le DOM à la validation.
 *
 * @param {Array<object>} bonuses Lignes retournées par Actor#getSkillBonuses.
 * @returns {{total: number, skillUsed: Array<{name: string, description: string, value: number}>}}
 */
export function summarizeSelectedSkillBonuses(bonuses = []) {
  const selected = bonuses.filter((bonus) => bonus.selected === true)
  return {
    total: selected.reduce((total, bonus) => total + (Number(bonus.value) || 0), 0),
    skillUsed: selected.map((bonus) => ({
      name: `${bonus.name}${bonus.hasPathName ? ` (${bonus.pathName})` : ""}`,
      description: bonus.additionalInfos ?? "",
      value: Number(bonus.value) || 0,
    })),
  }
}
