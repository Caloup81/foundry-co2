import ItemData from "./item.mjs"
import { Action } from "./schemas/action.mjs"

/**
 * @class ContainerData
 * @extends {ItemData}
 * Représente un contenant (sac, bourse, coffre, fontes de cheval, ...) capable de stocker
 * d'autres équipements de l'acteur, référencés par leur UUID.
 * @type {string[]} contents : liste des UUID des objets contenus
 * @type {string} location : texte libre indiquant où se trouve le contenant (maison, porté, monture, ...)
 * @type {object} weight : poids propre du contenant
 * @type {object} price : prix du contenant
 * @type {object[]} actions : actions/effets rattachés au contenant
 * @type {number} maxItems : nombre maximum d'objets distincts (0 = illimité)
 */
export default class ContainerData extends ItemData {
  static defineSchema() {
    const fields = foundry.data.fields
    return foundry.utils.mergeObject(super.defineSchema(), {
      contents: new fields.ArrayField(new fields.DocumentUUIDField({ type: "Item" })),
      location: new fields.StringField({ required: false, blank: true, initial: "" }),
      weight: new fields.SchemaField({
        value: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0 }),
        unit: new fields.StringField({ required: true, initial: "kg" }),
      }),
      price: new fields.SchemaField({
        value: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0 }),
        unit: new fields.StringField({ required: true, initial: "pa" }),
      }),
      actions: new fields.ArrayField(new fields.EmbeddedDataField(Action)),
      maxItems: new fields.NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
    })
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["CO.Container"]

  get isContainer() {
    return true
  }

  /**
   * Nombre total d'objets contenus, en tenant compte de la quantité de chaque objet
   * (ex. une outre de quantité 4 compte pour 4). Les objets non résolus comptent pour 1.
   * @returns {number}
   */
  get contentsCount() {
    let count = 0
    for (const uuid of this.contents) {
      const item = fromUuidSync(uuid)
      // On ignore les références non résolues (objet supprimé) pour ne pas gonfler le compteur
      if (item) count += item.system?.quantity?.current ?? 1
    }
    return count
  }

  /**
   * Résout et retourne les Items contenus à partir de leurs UUID.
   * Utilise fromUuidSync si le contenant est embarqué sur un acteur, sinon fromUuid.
   * (même logique que PathData.getCapacities)
   *
   * @returns {Promise<Array>} Un tableau des Items contenus.
   */
  async getContents() {
    let contents = []

    // Contenant embarqué sur un acteur
    if (this.parent.isEmbedded) {
      for (const uuid of this.contents) {
        const item = fromUuidSync(uuid)
        if (item) contents.push(item)
      }
    }
    // Non embarqué : monde ou compendium
    else {
      for (const uuid of this.contents) {
        const item = await fromUuid(uuid)
        if (item) contents.push(item)
      }
    }

    return contents
  }
}
