import ItemData from "./item.mjs"
import { SYSTEM } from "../config/system.mjs"
import { BaseValue } from "./schemas/base-value.mjs"
import { Action } from "./schemas/action.mjs"

/**
 * @class EquipmentData
 * @extends {ItemData}
 * @type {string} subtype : Arme/Armures etc sous typed 'equipement
 * @type {string} martialCategory : catégorie de l'equiepement, ex : Baton, épée courte etc.
 * @type {string} damagetype : Type de dégat : perforant, tranchant, contondant
 * @type {object} quantity : Quantité stocké (nombre de flèches, ....)
 * @type {object} charges : nombre de charge dnas le cas d'un objet magique
 * @type {object} weight: Poid de l'équipement
 * @type {object} price: prix de l'équipement
 * @type {string} rarity: Difficultée à trouver l'objet en magasin
 * @type {boolean} equipped: indique si l'objet est équipé ou non
 * @type {object} properties: indique si l'objet peux ete équippé, cumulé, rechargé.
 * @type {object} usage: indique si on peux l'utiliser à 1 main, 2 mains ou les deux (1 main et demi)
 * @type {object} action : objet qui va gérer les effets de l'equiepement (ex : une attaque)
 */
export default class EquipmentData extends ItemData {
  static defineSchema() {
    const fields = foundry.data.fields
    return foundry.utils.mergeObject(super.defineSchema(), {
      subtype: new fields.StringField({ required: true }),
      tags: new fields.SetField(new fields.StringField({ required: false, blank: true, choices: SYSTEM.EQUIPMENT_TAGS })),
      martialCategory: new fields.StringField({ required: true }),
      damagetype: new fields.StringField({ required: true }),
      defense: new fields.NumberField({ integer: true, positive: true }),
      magicalDefense: new fields.NumberField({ integer: true }),
      quantity: new fields.SchemaField({
        current: new fields.NumberField({ required: true, nullable: false, initial: 1, integer: true, min: 0 }),
        max: new fields.NumberField({ required: false, nullable: true, integer: true, min: 0 }),
        destroyIfEmpty: new fields.BooleanField(),
      }),
      charges: new fields.SchemaField({
        current: new fields.NumberField({ integer: true, min: 0 }),
        max: new fields.NumberField({ integer: true, min: 0 }),
        destroyIfEmpty: new fields.BooleanField(),
      }),
      weight: new fields.SchemaField({
        value: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0 }),
        unit: new fields.StringField({ required: true, initial: "kg" }),
      }),
      price: new fields.SchemaField({
        value: new fields.NumberField({ required: true, nullable: false, initial: 0, integer: true, min: 0 }),
        unit: new fields.StringField({ required: true, initial: "pa" }),
      }),
      rarity: new fields.StringField({ required: true, initial: "common", choices: SYSTEM.EQUIPMENT_RARITY }),
      equipped: new fields.BooleanField(),
      // UUID du contenant dans lequel l'objet est rangé, ou null s'il est libre
      container: new fields.DocumentUUIDField({ type: "Item", required: false, nullable: true, initial: null }),
      properties: new fields.SchemaField({
        equipable: new fields.BooleanField(),
        reloadable: new fields.BooleanField(),
        stackable: new fields.BooleanField(),
      }),
      usage: new fields.SchemaField({
        oneHand: new fields.BooleanField(),
        twoHand: new fields.BooleanField(),
      }),
      range: new fields.EmbeddedDataField(BaseValue, { label: "CO.ui.range", nullable: true }),
      actions: new fields.ArrayField(new fields.EmbeddedDataField(Action)),
    })
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["CO.Equipment"]

  get isWeapon() {
    return this.subtype === SYSTEM.EQUIPMENT_SUBTYPES.weapon.id
  }

  get isArmor() {
    return this.subtype === SYSTEM.EQUIPMENT_SUBTYPES.armor.id
  }

  get isShield() {
    return this.subtype === SYSTEM.EQUIPMENT_SUBTYPES.shield.id
  }

  get isMisc() {
    return this.subtype === SYSTEM.EQUIPMENT_SUBTYPES.misc.id
  }

  get useHands() {
    if (this.usage.oneHand || this.usage.twoHand) return true
    return false
  }

  get isConsumable() {
    return this.subtype === SYSTEM.EQUIPMENT_SUBTYPES.consumable.id
  }

  get hasCharges() {
    return this.charges.current > 0
  }

  get hasQuantity() {
    return this.quantity.current > 0
  }

  /**
   * Calcule la valeur de défense totale de l'équipement.
   *
   * @returns {number} La valeur de défense totale, qui est la somme de la défense physique et magique.
   *                   Retourne 0 si l'équipement n'est ni une armure ni un bouclier.
   */
  get totalDefense() {
    if (!this.isArmor && !this.isShield) return 0
    return (this.defense || 0) + (this.magicalDefense ? this.magicalDefense : 0)
  }

  /**
   * Calcule le malus de surcharge pour l'équipement.
   *
   * @returns {number} Le malus de surcharge, qui est la défense physique moins la défense magique.
   *                   Retourne 0 si l'équipement n'est ni une armure ni un bouclier.
   */
  get overloadMalus() {
    if (!this.isArmor && !this.isShield) return 0
    let malus = this.defense || 0
    if (this.magicalDefense) malus -= this.magicalDefense
    return Math.max(0, malus)
  }

  /**
   * Calcule le malus magique pour l'équipement: nombre de PM supplémentaires nécessaires pour lancer un sort.
   *
   * @returns {number} Le malus magique, qui est la défense physique.
   *                   Retourne 0 si l'équipement n'est ni une armure ni un bouclier.
   */
  get magicalMalus() {
    if (!this.isArmor && !this.isShield) return 0
    return this.defense || 0
  }

  /**
   * Remonte les dommages de référence si c'est une arme, c'est-à-dire les dommages de la formule du premier resolver de la première action.
   *
   * @returns {string|undefined} La formule des dommages si l'équipement est une arme et possède des actions avec des résolveurs de dommages.
   *                             Retourne undefined sinon.
   */
  get damage() {
    if (this.isWeapon && this.actions.length > 0 && this.actions[0].resolvers.length > 0) {
      return this.actions[0].resolvers[0].dmg.formula
    }
    return undefined
  }

  /**
   * Remonter la formule d'attaque de référence si c'est une arme, c'est-à-dire la formule du premier resolver de la première action.
   *
   * @returns {string|undefined} La formule d'attaque si l'équipement est une arme et possède des actions avec des résolveurs de dommages.
   *                             Retourne undefined sinon.
   */
  get skill() {
    if (this.isWeapon && this.actions.length > 0 && this.actions[0].resolvers.length > 0) {
      return this.actions[0].resolvers[0].skill.formula
    }
    return undefined
  }
}
