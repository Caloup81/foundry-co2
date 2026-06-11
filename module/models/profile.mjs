import ItemData from "./item.mjs"
import { SYSTEM } from "../config/system.mjs"
import { Modifier } from "./schemas/modifier.mjs"

export default class ProfileData extends ItemData {
  static defineSchema() {
    const fields = foundry.data.fields
    return foundry.utils.mergeObject(super.defineSchema(), {
      family: new fields.StringField({ required: false, nullable: true }),
      maxDefenseArmor: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      modifiers: new fields.ArrayField(new fields.EmbeddedDataField(Modifier)),
      martialTrainingsWeapons: new fields.ObjectField(),
      martialTrainingsArmors: new fields.ObjectField(),
      martialTrainingsShields: new fields.ObjectField(),
      paths: new fields.ArrayField(new fields.DocumentUUIDField({ type: "Item" })),
      proficiencies: new fields.ArrayField(new fields.StringField()),
      mainProfile: new fields.BooleanField(),
      isPsionic: new fields.BooleanField(),
    })
  }

  /** @override */
  static LOCALIZATION_PREFIXES = ["CO.Profile"]

  /** @override */
  prepareBaseData() {
    super.prepareBaseData()
    if (this.family) {
      this.hp = this.isPsionic ? SYSTEM.PSIONICS.hp : SYSTEM.FAMILIES[this.family].hp
      this.fp = SYSTEM.FAMILIES[this.family].fp
      this.recoveryDice = SYSTEM.FAMILIES[this.family].recoveryDice
      this.recoveryBonus = SYSTEM.FAMILIES[this.family].recoveryBonus
    }
  }
}
