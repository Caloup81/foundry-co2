import CoBaseItemSheet from "./base-item-sheet.mjs"
import Utils from "../../helpers/utils.mjs"

export default class CoContainerSheet extends CoBaseItemSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["container"],
    position: {
      width: 600,
      height: 720,
    },
    actions: {
      removeContent: CoContainerSheet.#onRemoveContent,
    },
  }

  /** @override */
  static PARTS = {
    header: { template: "systems/co2/templates/items/shared/header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    description: { template: "systems/co2/templates/items/container-description.hbs" },
    details: { template: "systems/co2/templates/items/container.hbs" },
    actions: {
      template: "systems/co2/templates/items/shared/actions.hbs",
      templates: [
        "systems/co2/templates/items/parts/conditions-part.hbs",
        "systems/co2/templates/items/parts/modifiers-part.hbs",
        "systems/co2/templates/items/parts/modifier.hbs",
        "systems/co2/templates/items/parts/resolvers-part.hbs",
        "systems/co2/templates/items/parts/resolver-part.hbs",
      ],
      scrollable: [".tab", ".action-body"],
    },
  }

  /** @override */
  static TABS = {
    primary: {
      tabs: [{ id: "description" }, { id: "details" }, { id: "actions" }],
      initial: "description",
      labelPrefix: "CO.sheet.tabs.container",
    },
  }

  #actionTabSelected = null

  /** @override */
  async _prepareContext() {
    const context = await super._prepareContext()
    context.resolverSystemFields = this.document.system.schema.fields.actions.element.fields.resolvers.element.fields
    return context
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    await super._preparePartContext(partId, context, options)
    switch (partId) {
      case "description": {
        // En vue limitée, le contenu du contenant est masqué
        context.isLimitedView = this.isLimitedView
        // Résolution des objets contenus pour l'affichage (image, nom, quantité, tooltip)
        const enrichHTML = foundry.applications.ux.TextEditor.implementation.enrichHTML
        const contents = this.isLimitedView ? [] : await this.document.system.getContents()
        for (const content of contents) {
          content.enrichedTooltip = await enrichHTML(content.system.description ?? "")
        }
        context.contents = contents
        break
      }
      case "actions":
        context.subtabs = this._prepareActionsTabs()
        break
    }
    if (CONFIG.debug.co2?.sheets) console.debug(Utils.log(`CoContainerSheet - context`), context)
    return context
  }

  _prepareActionsTabs() {
    if (!this.document.system.actions || this.document.system.actions.length === 0) return {}
    const tabs = {}
    for (const [actionId, action] of Object.entries(this.document.system.actions)) {
      if (!action) continue
      const tabId = `action-${actionId}`
      tabs[tabId] = {
        group: "actions",
        id: tabId,
        active: false,
        icon: "fa-solid fa-bolt",
        label: action.name || game.i18n.localize("CO.sheet.tabs.capacity.action"),
      }
    }
    if (this.#actionTabSelected && tabs[this.#actionTabSelected]) {
      tabs[this.#actionTabSelected].active = true
    } else {
      this.#actionTabSelected = "action-0"
      tabs[this.#actionTabSelected].active = true
    }

    return tabs
  }

  /** @inheritDoc */
  changeTab(tab, group, options) {
    super.changeTab(tab, group, options)
    if (group === "actions") {
      this.#actionTabSelected = tab
    }
  }

  /**
   * Un équipement déposé sur la feuille du contenant est ajouté à son contenu (ou sa quantité
   * incrémentée s'il est empilable et déjà présent). La création sur l'acteur et la gestion de
   * l'empilement sont déléguées à COItem.addOrIncrementContent.
   * @override
   * @param {COItem} item L'équipement déposé
   * @returns {Promise<Item|boolean>}
   */
  async _onDropEquipmentItem(item) {
    return this.item.addOrIncrementContent(item)
  }

  /**
   * Retire un objet du contenant (sans le supprimer de l'acteur).
   * @param {PointerEvent} event The originating click event
   * @param {HTMLElement} target The capturing HTML element which defined a [data-action]
   * @returns {Promise}
   */
  static async #onRemoveContent(event, target) {
    if (!this.isEditable) return
    event.preventDefault()
    const uuid = target.closest(".item")?.dataset.itemUuid
    if (uuid) return this.item.removeContent(uuid)
  }
}
