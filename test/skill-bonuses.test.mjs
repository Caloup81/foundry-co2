import test from "node:test"
import assert from "node:assert/strict"

import { summarizeSelectedSkillBonuses } from "../module/helpers/skill-bonuses.mjs"

test("résume uniquement les bonus présélectionnés", () => {
  const result = summarizeSelectedSkillBonuses([
    { name: "Conscience", pathName: "Échelle", hasPathName: true, additionalInfos: "Traumatisme", value: 3, selected: true },
    { name: "Empathie", value: -3, selected: false },
  ])

  assert.equal(result.total, 3)
  assert.deepEqual(result.skillUsed, [{ name: "Conscience (Échelle)", description: "Traumatisme", value: 3 }])
})
