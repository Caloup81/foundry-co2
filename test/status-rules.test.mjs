import test from "node:test"
import assert from "node:assert/strict"

import { findAutomaticCriticalStatus, resolveStatusId } from "../module/helpers/status-rules.mjs"
import Utils from "../module/helpers/utils.mjs"

test("resolveStatusId suit les remplacements et résiste aux cycles", () => {
  assert.equal(resolveStatusId("unconscious", { unconscious: "immobilized" }), "immobilized")
  assert.equal(resolveStatusId("a", { a: "b", b: "a" }), "a")
})

test("findAutomaticCriticalStatus respecte le type d'action", () => {
  const statuses = new Set(["immobilized"])
  const meleeOnly = { immobilized: { automaticCritical: ["melee"] } }
  const allAttacks = { immobilized: { automaticCritical: "all" } }

  assert.equal(findAutomaticCriticalStatus(statuses, "melee", meleeOnly), "immobilized")
  assert.equal(findAutomaticCriticalStatus(statuses, "ranged", meleeOnly), null)
  assert.equal(findAutomaticCriticalStatus(statuses, "spell", allAttacks), "immobilized")
})

test("un critique forcé survit au recalcul après un point de chance", () => {
  const [result] = Utils.recomputeTargetResults([{ forcedOutcome: "critical", isSuccess: false, isFailure: true, isCritical: false, isFumble: true, needsOppositeRoll: true }], 1, {
    isFumble: true,
  })

  assert.deepEqual(
    { isSuccess: result.isSuccess, isFailure: result.isFailure, isCritical: result.isCritical, isFumble: result.isFumble, needsOppositeRoll: result.needsOppositeRoll },
    { isSuccess: true, isFailure: false, isCritical: true, isFumble: false, needsOppositeRoll: false },
  )
})
