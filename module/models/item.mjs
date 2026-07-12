/**
 * Define the data schema for an Item
 * source : the uuid of the item or actor where the item comes from
 * origin : the name of the book where the item comes from
 * slug : slugify the name of the item
 * tags : a set of tags to categorize the item
 */
export default class ItemData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields
    return {
      description: new fields.HTMLField({ textSearch: true }),
      source: new fields.StringField({ required: true }),
      origin: new fields.StringField({ required: true }),
      slug: new fields.StringField({ required: true }),
      gmNotes: new fields.HTMLField(),
    }
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData()
    this.slug = this.parent.name.slugify({ strict: true })
  }

  get isCapacity() {
    return this.parent?.type === "capacity"
  }
}
