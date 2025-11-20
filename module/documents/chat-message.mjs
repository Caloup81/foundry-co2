export default class COChatMessage extends ChatMessage {
  /** @inheritDoc */
  async renderHTML({ canDelete, canClose = false, ...rest } = {}) {
    const html = await super.renderHTML({ canDelete, canClose, ...rest })
    this._enrichChatCard(html)
    return html
  }

  /**
   * Get the Actor which is the author of a chat card.
   * @returns {Actor|void}
   */
  getAssociatedActor() {
    if (this.speaker.scene && this.speaker.token) {
      const scene = game.scenes.get(this.speaker.scene)
      const token = scene?.tokens.get(this.speaker.token)
      if (token) return token.actor
    }
    return game.actors.get(this.speaker.actor)
  }

  _enrichChatCard(html) {
    const actor = this.getAssociatedActor()

    let img
    let nameText
    if (this.isContentVisible) {
      img = actor?.img ?? this.author.avatar
      nameText = this.alias
    } else {
      img = this.author.avatar
      nameText = this.author.name
    }

    const avatar = document.createElement("a")
    avatar.classList.add("avatar")
    if (actor) avatar.dataset.uuid = actor.uuid
    const avatarImg = document.createElement("img")
    Object.assign(avatarImg, { src: img, alt: nameText })
    avatar.append(avatarImg)

    const name = document.createElement("span")
    name.classList.add("name-stacked")
    const title = document.createElement("span")
    title.classList.add("title")
    title.append(nameText)
    name.append(title)

    const sender = html.querySelector(".message-sender")
    sender?.replaceChildren(avatar, name)
    // Html.querySelector(".whisper-to")?.remove()
  }

  /**
   * Met à jour le message après l'utilisation d'un point de chance
   *
   * @param {Object} options The options object
   * @param {string} options.existingMessageId The ID of the existing message to update
   * @param {Array} options.rolls The array of roll objects to add to the message
   * @param {*} options.result The result value to store in the message's system data
   * @returns {Promise<void>} A promise that resolves when the message update is complete
   * @private
   * @static
   * @async
   */
  static async _handleQueryUpdateMessageAfterLuck({ existingMessageId, rolls, result } = {}) {
    const message = game.messages.get(existingMessageId)
    if (!message) return
    await message.update({ rolls: rolls, "system.result": result })
  }

  /**
   * Met à jour le message après un jet opposé
   *
   * @param {Object} options The options object
   * @param {string} options.existingMessageId The ID of the existing message to update
   * @param {Array} options.rolls The array of roll objects to add to the message
   * @param {*} options.result The result value to store in the message's system data
   * @returns {Promise<void>} A promise that resolves when the message update is complete
   * @private
   * @static
   * @async
   */
  static async _handleQueryUpdateMessageAfterOpposedRoll({ existingMessageId, rolls, result } = {}) {
    const message = game.messages.get(existingMessageId)
    if (!message) return
    await message.update({ rolls: rolls, "system.result": result })
  }

  /**
   * Met à jour le message après un jet opposé
   *
   * @param {Object} options The options object
   * @param {string} options.existingMessageId The ID of the existing message to update
   * @param {Array} options.rolls The array of roll objects to add to the message
   * @param {*} options.result The result value to store in the message's system data
   * @param {String} options.newcontent div innerHtml for replace button
   * @param {String} options.luckyContent div innerHtml for add after new content
   * @param {String} options.formula div innerHtml for formula
   * @returns {Promise<void>} A promise that resolves when the message update is complete
   * @private
   * @static
   * @async
   */
  static async _handleQueryUpdateMessageAfterSavedRoll({ existingMessageId, rolls, result, newcontent, luckyContent, formula } = {}) {
    const message = game.messages.get(existingMessageId)
    if (!message) return
    const parser = new DOMParser()
    const doc = parser.parseFromString(message.content, "text/html")
    const saveButton = doc.querySelector("button.save-roll[data-save-target][data-save-ability][data-save-difficulty]")
    if (saveButton && newcontent) {
      const tempDiv = document.createElement("div")
      tempDiv.innerHTML = newcontent
      saveButton.replaceWith(...tempDiv.childNodes)
    }
    // Gestion du bouton de point de chance
    const luckyDiv = doc.querySelector("div.card-content section.result div.form-group.total-result")
    console.log("luckyDiv", luckyDiv)
    if (luckyDiv && luckyContent && luckyContent !== "") {
      const tempDiv = document.createElement("div")
      tempDiv.innerHTML = luckyContent
      luckyDiv.insertAdjacentHTML("afterend", luckyContent)
    }
    //Mise à jour de la formule :
    const diceFormulaDiv = doc.querySelector("footer.card-footer div.dice-roll div.dice-result div.dice-formula")
    if (diceFormulaDiv) {
      const tempDiv = document.createElement("div")
      tempDiv.innerHTML = formula
      diceFormulaDiv.replaceWith(...tempDiv.childNodes)
    }

    const updatedContent = doc.body.innerHTML
    message.content = updatedContent

    await message.update({ rolls: rolls, "system.result": result, "system.showButton": false, content: updatedContent })
  }
}
