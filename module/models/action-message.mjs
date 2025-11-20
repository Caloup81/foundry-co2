import BaseMessageData from "./base-message.mjs"
import CustomEffectData from "./schemas/custom-effect.mjs"
import { CORoll } from "../documents/roll.mjs"
import Hitpoints from "../helpers/hitpoints.mjs"
import { Resolver } from "./schemas/resolver.mjs"
import Utils from "../helpers/utils.mjs"

export default class ActionMessageData extends BaseMessageData {
  static defineSchema() {
    const fields = foundry.data.fields
    return foundry.utils.mergeObject(super.defineSchema(), {
      subtype: new fields.StringField({
        required: true,
        choices: Object.values(SYSTEM.CHAT_MESSAGE_TYPES),
        initial: SYSTEM.CHAT_MESSAGE_TYPES.UNKNOWN,
      }),
      result: new fields.ObjectField(),
      linkedRoll: new fields.ObjectField(),
      customEffect: new fields.EmbeddedDataField(CustomEffectData),
      additionalEffect: new fields.SchemaField({
        active: new fields.BooleanField({ initial: false }),
        applyOn: new fields.StringField({ required: true, choices: SYSTEM.RESOLVER_RESULT, initial: SYSTEM.RESOLVER_RESULT.never.id }),
        successThreshold: new fields.NumberField({ integer: true, positive: true }),
        statuses: new fields.SetField(new fields.StringField({ required: true, blank: true, choices: SYSTEM.RESOLVER_ADDITIONAL_EFFECT_STATUS })),
        duration: new fields.StringField({ required: true, nullable: false, initial: "0" }),
        unit: new fields.StringField({ required: true, choices: SYSTEM.COMBAT_UNITE, initial: "round" }),
        formula: new fields.StringField({ required: false }),
        formulaType: new fields.StringField({ required: false, choices: SYSTEM.RESOLVER_FORMULA_TYPE }),
        elementType: new fields.StringField({ required: false }),
      }),
      showButton: new fields.BooleanField({ initial: true }),
    })
  }

  get isAttack() {
    return this.subtype === SYSTEM.CHAT_MESSAGE_TYPES.ATTACK
  }

  get isDamage() {
    return this.subtype === SYSTEM.CHAT_MESSAGE_TYPES.DAMAGE
  }

  get isSave() {
    return this.subtype === SYSTEM.CHAT_MESSAGE_TYPES.SAVE
  }

  get isFailure() {
    return this.isAttack && this.result.isFailure
  }

  // Est-ce que l'actor du user courant est ciblé par le message
  get isActorTargeted() {
    // Si c'est un MJ, on considère que tous les acteurs sont ciblés
    if (game.user.isGM) return true
    const actor = game.user.character
    if (!actor) return false
    const { id } = foundry.utils.parseUuid(actor.uuid)
    // Extrare tous les ids des cibles
    const targets = this.targets.map((target) => {
      const { id } = foundry.utils.parseUuid(target)
      return id
    })
    return targets.includes(id)
  }

  /**
   * Modifie le contenu HTML d'un message
   * @async
   * @param {PenombreMessage} message Le document ChatMessage en cours de rendu.
   * @param {HTMLElement} html Élément HTML représentant le message à modifier.
   * @returns {Promise<void>} Résout lorsque le HTML a été mis à jour.
   */
  async alterMessageHTML(message, html) {
    // Affiche ou non les boutons d'application des dommages
    if (!game.settings.get("co2", "displayChatDamageButtonsToAll") && !game.user.isGM) {
      html.querySelectorAll(".apply-dmg").forEach((btn) => {
        btn.style.display = "none"
      })
      html.querySelectorAll(".dr-checkbox").forEach((btn) => {
        btn.style.display = "none"
      })
    }

    // Affiche ou non la difficulté
    const displayDifficulty = game.settings.get("co2", "displayDifficulty")
    if (displayDifficulty === "none" || (displayDifficulty === "gm" && !game.user.isGM)) {
      html.querySelectorAll(".display-difficulty").forEach((elt) => {
        elt.remove()
      })
    }
  }

  /**
   * Ajoute les listeners du message
   * @async
   * @param {HTMLElement} html Élément HTML représentant le message à modifier.
   */
  async addListeners(html) {
    // Click sur les boutons d'application des dommages
    if (game.settings.get("co2", "displayChatDamageButtonsToAll")) {
      const damageButtons = html.querySelectorAll(".apply-dmg")
      if (damageButtons) {
        damageButtons.forEach((btn) => {
          btn.addEventListener("click", (ev) => Hitpoints.onClickChatMessageApplyButton(ev, html, context))
        })
      }
    } else {
      if (game.user.isGM) {
        const damageButtons = html.querySelectorAll(".apply-dmg")
        if (damageButtons) {
          damageButtons.forEach((btn) => {
            btn.addEventListener("click", (ev) => Hitpoints.onClickChatMessageApplyButton(ev, html, context))
          })
        }
      }
    }

    // Click sur le bouton de chance si c'est un jet d'attaque raté
    if (this.isFailure) {
      const luckyButton = html.querySelector(".lp-button-attack")
      const displayButton = game.user.isGM || this.parent.isAuthor

      if (luckyButton && displayButton) {
        luckyButton.addEventListener("click", async (event) => {
          event.preventDefault()
          event.stopPropagation()
          const messageId = event.currentTarget.closest(".message").dataset.messageId
          if (!messageId) return
          const message = game.messages.get(messageId)

          let rolls = this.parent.rolls
          rolls[0].options.bonus = String(parseInt(rolls[0].options.bonus) + 10)
          rolls[0].options.hasLuckyPoints = false
          rolls[0]._total = parseInt(rolls[0].total) + 10

          let newResult = CORoll.analyseRollResult(rolls[0])

          // L'acteur consomme son point de chance
          const actorId = rolls[0].options.actorId
          const actor = game.actors.get(actorId)
          if (actor.system.resources.fortune.value > 0) {
            actor.system.resources.fortune.value -= 1
            await actor.update({ "system.resources.fortune.value": actor.system.resources.fortune.value })
          }

          // Si on a un succes et qu'en plus on est en option ou on jette automatiquement les dommages
          if (newResult.isSuccess && game.settings.get("co2", "useComboRolls")) {
            const damageRoll = Roll.fromData(message.system.linkedRoll)
            await damageRoll.toMessage(
              { style: CONST.CHAT_MESSAGE_STYLES.OTHER, type: "action", system: { subtype: "damage" }, speaker: message.speaker },
              { rollMode: rolls[0].options.rollMode },
            )
          }

          // Gestion des custom effects
          const customEffect = message.system.customEffect
          const additionalEffect = message.system.additionalEffect
          if (customEffect && additionalEffect && Resolver.shouldManageAdditionalEffect(newResult, additionalEffect)) {
            const target = message.system.targets.length > 0 ? message.system.targets[0] : null
            if (target) {
              const targetActor = fromUuidSync(target)
              if (game.user.isGM) await targetActor.applyCustomEffect(customEffect)
              else {
                await game.users.activeGM.query("co2.applyCustomEffect", { ce: customEffect, targets: [targetActor.uuid] })
              }
            }
          }

          // Mise à jour du message de chat
          // Le MJ peut mettre à jour le message de chat
          if (game.user.isGM) {
            await message.update({ rolls: rolls, "system.result": newResult })
          }
          // Sinon on émet un message pour mettre à jour le message de chat
          else {
            await game.users.activeGM.query("co2.updateMessageAfterLuck", { existingMessageId: message.id, rolls: rolls, result: newResult })
          }
        })
      }
    }

    // Click sur le bouton de jet opposé
    const oppositeButton = html.querySelector(".opposite-roll")
    const displayOppositeButton = game.user.isGM || this.isActorTargeted

    if (oppositeButton && displayOppositeButton) {
      oppositeButton.addEventListener("click", async (event) => {
        event.preventDefault()
        event.stopPropagation()
        const messageId = event.currentTarget.closest(".message").dataset.messageId
        if (!messageId) return
        const message = game.messages.get(messageId)

        const dataset = event.currentTarget.dataset
        const oppositeValue = dataset.oppositeValue
        const oppositeTarget = dataset.oppositeTarget

        const targetActor = fromUuidSync(oppositeTarget)
        if (!targetActor) return
        const value = Utils.evaluateOppositeFormula(oppositeValue, targetActor)

        const formula = value ? `1d20 + ${value}` : `1d20`
        const roll = await new Roll(formula).roll()
        const difficulty = roll.total

        let rolls = message.rolls
        rolls[0].options.oppositeRoll = false
        rolls[0].options.difficulty = difficulty

        let newResult = CORoll.analyseRollResult(rolls[0])
        if (newResult.isSuccess) {
          const damageRoll = Roll.fromData(message.system.linkedRoll)
          await damageRoll.toMessage(
            { style: CONST.CHAT_MESSAGE_STYLES.OTHER, type: "action", system: { subtype: "damage" }, speaker: message.speaker },
            { rollMode: rolls[0].options.rollMode },
          )
        }

        // Gestion des custom effects
        const customEffect = message.system.customEffect
        const additionalEffect = message.system.additionalEffect
        if (customEffect && additionalEffect && Resolver.shouldManageAdditionalEffect(newResult, additionalEffect)) {
          if (game.user.isGM) await targetActor.applyCustomEffect(customEffect)
          else {
            await game.users.activeGM.query("co2.applyCustomEffect", { ce: customEffect, targets: [targetActor.uuid] })
          }
        }

        // Mise à jour du message de chat
        // Le MJ peut mettre à jour le message de chat
        if (game.user.isGM) {
          await message.update({ rolls: rolls, "system.result": newResult })
        }
        // Sinon on émet un message pour mettre à jour le message de chat
        else {
          await game.users.activeGM.query("co2.updateMessageAfterOpposedRoll", { existingMessageId: message.id, rolls: rolls, result: newResult })
        }
      })
    }

    // click sur le bouton de jet de sauvegarde
    // On va lancer un jet de compétence basé sur la difficultée récupérée dans le context du message et on envoi le resultat au GM pour mise à jour
    // du message et application du résultat
    const saveButton = html.querySelector(".save-roll")
    const displaySaveButton = game.user.isGM || this.isActorTargeted

    if (saveButton && displaySaveButton) {
      saveButton.addEventListener("click", async (event) => {
        event.preventDefault()
        event.stopPropagation()
        const messageId = event.currentTarget.closest(".message").dataset.messageId
        if (!messageId) {
          console.log("Evenement de click sur le bouton de jet de sauvegarde : erreur dans la récupération de l'ID du message")
          return
        }
        const message = game.messages.get(messageId)
        if (!message || !message.system) {
          console.log("Evenement de click sur le bouton de jet de sauvegarde : erreur dans la récupération du message ou de son context")
          return
        }
        console.log("message : ", message)
        const dataset = event.currentTarget.dataset
        console.log("dataset : ", dataset)
        const targetUuid = dataset.saveTarget
        const saveAbility = dataset.saveAbility
        const difficulty = dataset.saveDifficulty

        const targetActor = fromUuidSync(targetUuid)
        if (!targetActor) {
          console.log("Evenement de click sur le bouton de jet de sauvegarde : erreur dans la récupération de l'acteur cible")
          return
        }

        // Ok donc je vais demander à l'acteur cible de faire un rollSkill
        const retour = await targetActor.rollSkill(saveAbility, { difficulty: difficulty, showResult: false })
        message.system.result = retour.result
        message.system.linkedRoll = retour.roll

        console.log("result : ", retour.result)

        let rolls = this.parent.rolls
        rolls[0] = retour.roll
        rolls[0].options.oppositeRoll = false

        // TODO : Doit on prévoir autre chose qu'un effet supplémentaire ? genre des dés de degat bonus appliqué si jet raté ? A voir...

        // Doit on appliquer l'effet s'il y en a
        const customEffect = message.system.customEffect
        const additionalEffect = message.system.additionalEffect
        if (customEffect && additionalEffect && Resolver.shouldManageAdditionalEffect(retour.result, additionalEffect)) {
          console.log("on va appliquer les effets", "customEffect : ", customEffect)

          if (game.user.isGM) await targetActor.applyCustomEffect(customEffect)
          else {
            await game.users.activeGM.query("co2.applyCustomEffect", { ce: customEffect, targets: [targetActor.uuid] })
          }
        }

        // Mise à jour du message de chat
        // Le MJ peut mettre à jour le message de chat
        if (game.user.isGM) {
          await message.update({ rolls: rolls, "system.showButton": false, "system.result": retour.result })
        }
        // Sinon on émet un message pour mettre à jour le message de chat
        else {
          await game.users.activeGM.query("co2.updateMessageAfterSavedRoll", { existingMessageId: message.id, rolls: rolls, result: retour.result })
        }
      })
    }
  }
}
