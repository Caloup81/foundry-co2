import COBaseActorSheet from "./base-actor-sheet.mjs"

export class COMiniCharacterSheet extends COBaseActorSheet {
  static DEFAULT_OPTIONS = {
    classes: ["character", "character-mini"],
    position: { width: 420, height: 700, left: 80 },
    window: {
      contentClasses: ["character-content", "character-mini"],
      resizable: true,
    },
    actions: {
      roll: COMiniCharacterSheet.#onRoll,
      useRecovery: COMiniCharacterSheet.#onUseRecovery,
      rollFortune: COMiniCharacterSheet.#onRollFortune,
    },
  }

  // PARTS réduits : header + main (main inclut déjà actions.hbs via "templates")
  static PARTS = {
    header: { template: "systems/co2/templates/actors/character-header.hbs" },
    sidebar: { template: "systems/co2/templates/actors/mini-character-sidebar.hbs" },
    main: {
      template: "systems/co2/templates/actors/character-main.hbs",
      templates: ["systems/co2/templates/actors/shared/actions.hbs"],
    },
  }

  // Onglet unique "main"
  static TABS = {
    primary: {
      tabs: [{ id: "main" }],
      initial: "main",
      labelPrefix: "CO.sheet.tabs.character",
    },
  }

  async _prepareContext() {
    const context = await super._prepareContext()
    context.isMinimized = true

    return context
  }

  /**
   * Handle roll events
   * @param {PointerEvent} event The originating click event
   * @param {HTMLElement} target The capturing HTML element which defined a [data-action]
   */
  static #onRoll(event, target) {
    const dataset = target.dataset
    const type = dataset.rollType
    const rollTarget = dataset.rollTarget

    switch (type) {
      case "skillcheck":
        this.document.rollSkill(rollTarget)
        break
      case "combatcheck":
        // Handle combat check
        break
      default:
        // Handle other roll types
        break
    }
  }

  /**
   * Gère l'utilisation des points de récupération ou du repos complet pour l'acteur.
   *
   * @param {PointerEvent} event The originating click event
   * @param {HTMLElement} target The capturing HTML element which defined a [data-action]
   */
  static #onUseRecovery(event, target) {
    event.preventDefault()
    const dataset = target.dataset
    let isFullRest = false
    if (dataset.option && dataset.option === "fullRest") isFullRest = true
    return this.document.system.useRecovery(isFullRest)
  }

  static async #onRollFortune(event, target) {
    event.preventDefault()
    await this.actor.system.rollFortune()
  }
}
